"""Shared cash-flow logic: forecast, gap closer and alerts.

'Today' always comes from get_today(session) so demo dates work.
Amounts are rounded to 2 decimals for display.
"""
import math
from datetime import date, datetime, timedelta, timezone

from sqlmodel import Session, select

from app.models.entities import Bill, ClinicSettings, Invoice, Payer
from app.schemas.api import (
    AlertOut,
    BillFundingChainOut,
    BillFundingSourceOut,
    ForecastPointOut,
    ForecastResponseOut,
    ForecastScenarioIn,
    GapActionOut,
    ShortageWarningOut,
)
from app.services.invoice_logic import compute_status, get_today, outstanding


def _round(value: float) -> float:
    return round(value, 2)


def _settings(session: Session) -> ClinicSettings | None:
    return session.get(ClinicSettings, 1)


def _open_invoices(session: Session) -> list[tuple[Invoice, Payer]]:
    """Invoices that are not fully paid, with their payer."""
    default_p = session.exec(select(Payer)).first() or Payer(id="PAY-DEFAULT", name="Self Pay", type="PATIENT")
    invoices = session.exec(select(Invoice)).all()
    res = []
    for inv in invoices:
        if inv.paid_at is not None or outstanding(inv) <= 0:
            continue
        payer = session.get(Payer, inv.payer_id) if inv.payer_id else None
        res.append((inv, payer or default_p))
    return res


def _expected_date(inv: Invoice, today: date) -> date:
    """The promised date if it is still ahead; otherwise the due date, or today if already overdue."""
    if inv.promise_to_pay_date is not None and inv.promise_to_pay_date > today:
        return inv.promise_to_pay_date
    return max(inv.due_date, today)


def daily_expected_collections(session: Session, start: date, horizon_days: int,
                               scenario: ForecastScenarioIn | None = None) -> dict[date, float]:
    """Expected inflow for each day from start for horizon_days days. Zero-filled."""
    days = {start + timedelta(days=i): 0.0 for i in range(horizon_days)}
    for inv, _payer in _open_invoices(session):
        if scenario is not None and scenario.payer_id and inv.payer_id != scenario.payer_id:
            continue
        expected = _expected_date(inv, start)
        if scenario is not None:
            if scenario.bill_to_defer_id == inv.id:
                expected += timedelta(days=scenario.deferral_days)
            expected += timedelta(days=scenario.extra_delay_days)
        if expected in days:
            days[expected] += outstanding(inv)
    return days


def _upcoming_expenses(session: Session, start: date, horizon_days: int) -> float:
    """Bill amounts due inside the window. One-off bills already paid are skipped."""
    end = start + timedelta(days=horizon_days - 1)
    total = 0.0
    for bill in session.exec(select(Bill)).all():
        step = bill.repeats_every_days
        if not step or step <= 0:
            if bill.paid_at is None and start <= bill.first_due_date <= end:
                total += bill.amount
            continue
        due = bill.first_due_date
        if due < start:
            skips = math.ceil((start - due).days / step)
            due = due + timedelta(days=skips * step)
        while due <= end:
            total += bill.amount
            due += timedelta(days=step)
    return total


def build_forecast(session: Session, horizon_days: int,
                   scenario: ForecastScenarioIn | None = None) -> ForecastResponseOut:
    start = get_today(session)
    cfg = _settings(session)
    opening = cfg.opening_cash if cfg else 0.0
    weekly = cfg.weekly_walk_in_collections if cfg else 0.0
    buffer = cfg.safety_buffer if cfg else 0.0
    rejection = (scenario.rejection_pct / 100) if scenario is not None else 0.0

    likely_by_day = daily_expected_collections(session, start, horizon_days)
    scenario_by_day = (daily_expected_collections(session, start, horizon_days, scenario)
                       if scenario is not None else None)

    # Precalculate daily upcoming expenses across the window
    end = start + timedelta(days=horizon_days - 1)
    daily_expenses_map: dict[date, float] = {start + timedelta(days=i): 0.0 for i in range(horizon_days)}
    for bill in session.exec(select(Bill)).all():
        step = bill.repeats_every_days
        if not step or step <= 0:
            if bill.paid_at is None and start <= bill.first_due_date <= end:
                daily_expenses_map[bill.first_due_date] += bill.amount
            continue
        due = bill.first_due_date
        if due < start:
            skips = math.ceil((start - due).days / step)
            due = due + timedelta(days=skips * step)
        while due <= end:
            daily_expenses_map[due] += bill.amount
            due += timedelta(days=step)

    points: list[ForecastPointOut] = []
    warnings: list[ShortageWarningOut] = []
    cumulative_likely = 0.0
    cumulative_scenario = 0.0
    cumulative_expenses = 0.0

    for i in range(horizon_days):
        day = start + timedelta(days=i)
        likely_inflow = likely_by_day[day]
        cumulative_likely += likely_inflow
        if scenario_by_day is not None:
            cumulative_scenario += scenario_by_day[day] * (1 - rejection)
        else:
            cumulative_scenario += likely_inflow
        cumulative_expenses += daily_expenses_map[day]

        walk_in_likely = weekly * (i + 1) / 7.0
        walk_in_cautious = weekly * 0.8 * (i + 1) / 7.0

        # Likely line: projected actual cash position
        likely_balance = opening + walk_in_likely + cumulative_likely - cumulative_expenses
        # Cautious line: conservative risk-adjusted cash position (25% haircut/delay on pending receivables, 80% walk-ins)
        cautious_balance = opening + walk_in_cautious + (cumulative_likely * (1 - max(0.20, rejection))) - cumulative_expenses
        what_if_balance = opening + walk_in_likely + cumulative_scenario - cumulative_expenses

        points.append(ForecastPointOut(
            date=day,
            likely=_round(likely_balance),
            cautious=_round(cautious_balance),
            what_if=_round(what_if_balance),
            safety_buffer=buffer,
            zero_line=0.0,
        ))

        # Check for cash dipping below safety buffer or zero
        lowest_projected = min(likely_balance, cautious_balance)
        if lowest_projected < buffer:
            warnings.append(ShortageWarningOut(
                date=day,
                projected_balance=_round(lowest_projected),
                message=(f"Cash may fall to Rs {lowest_projected:,.0f} on {day.day} {day:%B %Y}, "
                         f"below the safety buffer of Rs {buffer:,.0f}."),
            ))

    return ForecastResponseOut(
        horizon_days=horizon_days,
        points=points,
        shortage_warnings=warnings,
        expected_collections=_round(sum(likely_by_day.values())),
        upcoming_expenses=_round(_upcoming_expenses(session, start, horizon_days)),
    )


def build_bill_funding_chain(session: Session) -> list[BillFundingChainOut]:
    """Computes bill funding chain: matching expected cash, walk-ins and receivables to each upcoming bill."""
    today = get_today(session)
    cfg = _settings(session)
    opening_cash = cfg.opening_cash if cfg else 0.0
    weekly_walk_in = cfg.weekly_walk_in_collections if cfg else 0.0
    daily_walk_in = weekly_walk_in / 7.0

    # Retrieve all unpaid bills ordered by due date
    bills = [b for b in session.exec(select(Bill)).all() if b.paid_at is None]
    bills.sort(key=lambda b: b.first_due_date)

    # Retrieve open receivables with their expected arrival date
    open_receivables = []
    for inv, payer in _open_invoices(session):
        amt = outstanding(inv)
        if amt > 0:
            exp_date = _expected_date(inv, today)
            patient_label = inv.patient_name or payer.name
            open_receivables.append({
                "id": inv.id,
                "label": f"{patient_label}",
                "payer_name": payer.name,
                "amount": amt,
                "expected_date": exp_date,
            })
    open_receivables.sort(key=lambda r: r["expected_date"])

    # Running tracking of allocated funds
    allocated_cash = 0.0
    allocated_walkin = 0.0
    allocated_receivables: dict[str, float] = {r["id"]: 0.0 for r in open_receivables}

    chain: list[BillFundingChainOut] = []

    for bill in bills:
        days_ahead = max(0, (bill.first_due_date - today).days)
        due_str = f"day {days_ahead}" if days_ahead > 0 else "today"

        needed = bill.amount
        sources: list[BillFundingSourceOut] = []

        # 1. Opening cash allocation
        avail_cash = max(0.0, opening_cash - allocated_cash)
        if avail_cash > 0 and needed > 0:
            take_cash = min(avail_cash, needed)
            allocated_cash += take_cash
            needed -= take_cash
            sources.append(BillFundingSourceOut(name="Opening Cash", amount=_round(take_cash), source_type="cash"))

        # 2. Cumulative walk-ins up to bill's due date
        total_walkin_to_date = days_ahead * daily_walk_in
        avail_walkin = max(0.0, total_walkin_to_date - allocated_walkin)
        if avail_walkin > 0 and needed > 0:
            take_walkin = min(avail_walkin, needed)
            allocated_walkin += take_walkin
            needed -= take_walkin
            sources.append(BillFundingSourceOut(name="Walk-ins", amount=_round(take_walkin), source_type="walk_in"))

        # 3. Expected invoice collections arriving on or before bill due date
        for r in open_receivables:
            if needed <= 0:
                break
            if r["expected_date"] <= bill.first_due_date:
                avail_rec = max(0.0, r["amount"] - allocated_receivables[r["id"]])
                if avail_rec > 0:
                    take_rec = min(avail_rec, needed)
                    allocated_receivables[r["id"]] += take_rec
                    needed -= take_rec
                    sources.append(BillFundingSourceOut(
                        name=r["label"],
                        amount=_round(take_rec),
                        source_type="invoice"
                    ))

        funded = bill.amount - needed
        gap = max(0.0, round(needed, 2))

        if gap <= 0:
            status = "fully_covered"
            source_labels = " + ".join([s.name for s in sources[:3]])
            if len(sources) > 3:
                source_labels += f" + {len(sources) - 3} others"
            narrative = f"{bill.name} ₹{bill.amount:,.0f} on {due_str}: covered by {source_labels or 'cash inflows'}, gap ₹0."
            rec = "Fully funded by projected receipts. No financing or reminder action required."
        else:
            status = "partially_covered" if funded > 0 else "gap"
            # Find candidate payer to bridge this gap
            future_rec = [r for r in open_receivables if r["expected_date"] > bill.first_due_date]
            lead_payer = future_rec[0]["payer_name"] if future_rec else "Infosoft"
            prior_day = max(1, days_ahead - 1)
            narrative = f"{bill.name} on {due_str}: gap ₹{gap:,.0f} unless {lead_payer} pays by day {prior_day}."
            rec = f"Chase {lead_payer} for early clearance, or ask supplier for 7-day payment window deferral."

        chain.append(BillFundingChainOut(
            bill_id=bill.id,
            bill_name=bill.name,
            amount=bill.amount,
            due_date=bill.first_due_date,
            due_in_days=days_ahead,
            sources=sources,
            funded_amount=_round(funded),
            gap_amount=_round(gap),
            status=status,
            narrative=narrative,
            recommendation=rec,
        ))

    return chain


def overdue_items(session: Session, today: date) -> list[tuple[Invoice, Payer, int]]:
    """Overdue invoices (per compute_status) with their payer and days overdue."""
    items = []
    for inv, payer in _open_invoices(session):
        if compute_status(inv, today) == "overdue":
            items.append((inv, payer, (today - inv.due_date).days))
    return items


def _effort(max_days: int) -> str:
    if max_days <= 30:
        return "low"
    if max_days <= 60:
        return "medium"
    return "high"


def build_gap_actions(session: Session) -> list[GapActionOut]:
    """Generates specific gap closing actions: chasing overdue payers and deferring supplier bills."""
    today = get_today(session)
    by_payer: dict[str, dict] = {}
    for inv, payer, days in overdue_items(session, today):
        g = by_payer.setdefault(payer.id, {"name": payer.name, "total": 0.0, "count": 0, "max_days": 0})
        g["total"] += outstanding(inv)
        g["count"] += 1
        g["max_days"] = max(g["max_days"], days)

    actions = []
    for payer_id, g in sorted(by_payer.items(), key=lambda kv: -kv[1]["total"]):
        payer_title = g["name"] or payer_id
        actions.append(GapActionOut(
            id=f"gap-{payer_id}",
            title=f"Chase {payer_title}: +₹{g['total']:,.0f}",
            estimated_amount=_round(g["total"]),
            impact=f"+₹{g['total']:,.0f} direct cash recovery into clinic account",
            effort=_effort(g["max_days"]),
            explanation=(f"{g['count']} overdue invoice(s), the oldest {g['max_days']} days late. "
                         "Send a reminder with direct UPI payment link."),
        ))

    # Add deferral actions for deferrable bills
    for bill in session.exec(select(Bill)).all():
        if bill.paid_at is None and bill.is_deferrable:
            actions.append(GapActionOut(
                id=f"gap-defer-{bill.id}",
                title=f"Ask {bill.name} for 7 days: moves ₹{bill.amount:,.0f} out of the window",
                estimated_amount=_round(bill.amount),
                impact=f"Moves ₹{bill.amount:,.0f} expense out of the critical 7-day crunch window",
                effort="low",
                explanation=f"Supplier {bill.name} permits 7-day payment window deferrals. Shifts due date by 7 days in the forecast.",
            ))

    return actions


def build_alerts(session: Session, now: datetime) -> list[AlertOut]:
    today = get_today(session)
    cfg = _settings(session)
    threshold = cfg.reminder_threshold_days if cfg else 7
    due_soon = cfg.due_soon_days if cfg else 7
    created_at = (now if now.tzinfo else now.replace(tzinfo=timezone.utc)).astimezone(timezone.utc).isoformat()

    alerts: list[AlertOut] = []
    for inv, payer in _open_invoices(session):
        name = payer.name or payer.id
        if compute_status(inv, today) == "overdue":
            days = (today - inv.due_date).days
            if days > threshold:
                alerts.append(AlertOut(
                    id=f"alert-overdue-{inv.id}", severity="critical", type="overdue",
                    message=f"Invoice {inv.id} for {name} is {days} days overdue.",
                    created_at=created_at,
                ))
        elif 0 <= (inv.due_date - today).days <= due_soon:
            alerts.append(AlertOut(
                id=f"alert-due-{inv.id}", severity="warning", type="due_soon",
                message=f"Invoice {inv.id} for {name} is due in {(inv.due_date - today).days} days.",
                created_at=created_at,
            ))
        promise = inv.promise_to_pay_date
        if promise is not None and today <= promise <= today + timedelta(days=due_soon):
            alerts.append(AlertOut(
                id=f"alert-promise-{inv.id}", severity="info", type="promise_due",
                message=f"{name} promised to pay invoice {inv.id} on {promise.day} {promise:%B %Y}.",
                created_at=created_at,
            ))
    return alerts
