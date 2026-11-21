from dataclasses import dataclass
from datetime import date, timedelta
from math import ceil
from typing import Optional

# Used only when a payer has fewer than MIN_HISTORY past payments (assumptions, not learned).
DEFAULT_DELAYS = {"PATIENT": (5.0, 10.0), "CORPORATE": (20.0, 30.0), "INSURER": (35.0, 45.0)}
MIN_HISTORY = 3
BROKEN_PROMISE_EXTRA_DAYS = 7


@dataclass(frozen=True)
class PayerDelay:
    avg: float
    p80: float
    learned: bool


@dataclass(frozen=True)
class InvoiceIn:
    id: str
    payer_id: str
    payer_type: str
    amount: float
    due_date: date
    promise_date: Optional[date] = None


@dataclass(frozen=True)
class BillIn:
    id: str
    name: str
    amount: float
    first_due_date: date
    repeats_every_days: Optional[int] = None
    is_deferrable: bool = False
    defer_days: int = 0


@dataclass(frozen=True)
class Scenario:
    payer_id: Optional[str] = None
    late_days: int = 0
    insurer_rejection_pct: float = 0
    defer_bill_id: Optional[str] = None
    defer_days: int = 0


def compute_delay(payer_type: str, delays: list[int]) -> PayerDelay:
    """Average and 80th percentile delay from history, or type defaults if too little history."""
    clean = sorted(max(0, x) for x in delays)
    if len(clean) >= MIN_HISTORY:
        avg = round(sum(clean) / len(clean), 1)
        p80 = clean[ceil(0.8 * len(clean)) - 1]
        return PayerDelay(avg=avg, p80=float(p80), learned=True)
    avg, p80 = DEFAULT_DELAYS[payer_type]
    return PayerDelay(avg=avg, p80=p80, learned=False)


def expected_date(due: date, delay_days: float, today: date, earliest_days: int,
                  promise: Optional[date] = None, broken_basis_days: Optional[float] = None) -> date:
    floor = today + timedelta(days=earliest_days)
    if promise is not None:
        if promise >= today:
            return promise  # open promise overrides the expected date
        basis = broken_basis_days if broken_basis_days is not None else delay_days
        return max(floor, due + timedelta(days=ceil(basis))) + timedelta(days=BROKEN_PROMISE_EXTRA_DAYS)
    return max(floor, due + timedelta(days=ceil(delay_days)))


def bill_dates(first_due: date, repeat_days: Optional[int], start: date, end: date, shift: int = 0) -> list[date]:
    out = []
    base = first_due
    while base <= end:
        shifted = base + timedelta(days=shift)
        if start <= shifted <= end:
            out.append(shifted)
        if not repeat_days:
            break
        base += timedelta(days=repeat_days)
    return out


def _add(arr: list[float], d: date, amount: float, today: date) -> None:
    idx = (d - today).days
    if 0 <= idx < len(arr):
        arr[idx] += amount


def _summary(points: list[dict]) -> dict:
    out = {}
    for line in ("likely", "cautious", "what_if"):
        key = f"{line}_balance"
        low_i = min(range(len(points)), key=lambda i: points[i][key])
        out[line] = {
            "lowest_balance": points[low_i][key],
            "lowest_day": low_i,
            "first_below_zero_day": next((i for i, p in enumerate(points) if p[key] < 0), None),
        }
    return out


def forecast(today: date, invoices: list[InvoiceIn], bills: list[BillIn],
             delays: dict[str, PayerDelay], opening_cash: float, weekly_walk_in: float,
             safety_buffer: float, earliest_days: int,
             scenario: Optional[Scenario] = None, horizon: int = 90) -> dict:
    sc = scenario or Scenario()
    n = horizon + 1
    walk_in = weekly_walk_in / 7  # spread evenly across days (explicit assumption)
    likely_in, cautious_in, what_in = [0.0] * n, [0.0] * n, [0.0] * n
    likely_out, what_out = [0.0] * n, [0.0] * n

    for inv in invoices:
        d = delays[inv.payer_id]
        likely_d = expected_date(inv.due_date, d.avg, today, earliest_days, inv.promise_date, d.p80)
        cautious_d = expected_date(inv.due_date, d.p80, today, earliest_days, inv.promise_date, d.p80)
        what_d, what_amt = likely_d, inv.amount
        if sc.payer_id and inv.payer_id == sc.payer_id and sc.late_days:
            what_d = likely_d + timedelta(days=sc.late_days)
        if inv.payer_type == "INSURER" and sc.insurer_rejection_pct:
            what_amt = inv.amount * (1 - sc.insurer_rejection_pct / 100)
        _add(likely_in, likely_d, inv.amount, today)
        _add(cautious_in, cautious_d, inv.amount, today)
        _add(what_in, what_d, what_amt, today)

    end = today + timedelta(days=horizon)
    for b in bills:
        for bd in bill_dates(b.first_due_date, b.repeats_every_days, today, end):
            _add(likely_out, bd, b.amount, today)
        shift = 0
        if sc.defer_bill_id == b.id and b.is_deferrable:
            shift = sc.defer_days or b.defer_days
        for bd in bill_dates(b.first_due_date, b.repeats_every_days, today, end, shift):
            _add(what_out, bd, b.amount, today)

    lb = cb = wb = opening_cash
    points = []
    for i in range(n):
        lb += walk_in + likely_in[i] - likely_out[i]
        cb += walk_in + cautious_in[i] - likely_out[i]
        wb += walk_in + what_in[i] - what_out[i]
        points.append({
            "date": (today + timedelta(days=i)).isoformat(),
            "walk_in_inflow": round(walk_in, 2),
            "likely_inflow": round(likely_in[i], 2),
            "cautious_inflow": round(cautious_in[i], 2),
            "what_if_inflow": round(what_in[i], 2),
            "bills_outflow": round(likely_out[i], 2),
            "likely_balance": round(lb, 2),
            "cautious_balance": round(cb, 2),
            "what_if_balance": round(wb, 2),
            "safety_buffer": safety_buffer,
            "cautious_below_zero": cb < 0,
            "cautious_below_buffer": cb < safety_buffer,
            "what_if_below_zero": wb < 0,
        })
    return {"points": points, "summary": _summary(points)}