"""Report rows for the Reports page.

Each builder returns (columns, rows). build_report() adds the title.
Amounts are rounded to 2 decimals. Overdue rows reuse analytics.overdue_items.
"""
import csv
import io
from collections import defaultdict
from collections.abc import Callable
from datetime import date

from sqlmodel import Session, select

from app.models.entities import Invoice, Payer, PaymentHistory
from app.services.analytics import overdue_items
from app.services.invoice_logic import get_today, outstanding

REPORT_TITLES = {
    "collections": "Collections by month",
    "outstanding": "Outstanding by payer",
    "delays": "Overdue invoices",
    "payer-reliability": "Payer reliability",
    "monthly-cashflow": "Monthly cash flow",
}


def _round(value: float) -> float:
    return round(value, 2)


def _month(day: date) -> str:
    return f"{day.year}-{day.month:02d}"


def _payer_label(payer: Payer) -> str:
    return payer.name or payer.id


def _payments(session: Session) -> list[tuple[PaymentHistory, Payer]]:
    default_p = session.exec(select(Payer)).first() or Payer(id="PAY-DEFAULT", name="Self Pay", type="PATIENT")
    payments = session.exec(select(PaymentHistory)).all()
    res = []
    for pay in payments:
        payer = session.get(Payer, pay.payer_id) if pay.payer_id else None
        res.append((pay, payer or default_p))
    return res


def _monthly_totals(session: Session) -> list[tuple[str, int, float]]:
    """Paid payments grouped by month: (month, payment count, amount), oldest month first."""
    totals: dict[str, list] = defaultdict(lambda: [0, 0.0])
    for pay, _payer in _payments(session):
        bucket = totals[_month(pay.paid_date)]
        bucket[0] += 1
        bucket[1] += pay.amount
    return [(month, count, amount) for month, (count, amount) in sorted(totals.items())]


def _collections(session: Session) -> tuple[list[str], list[list]]:
    columns = ["Month", "Payments", "Amount Collected"]
    rows = [[month, count, _round(amount)] for month, count, amount in _monthly_totals(session)]
    return columns, rows


def _outstanding(session: Session) -> tuple[list[str], list[list]]:
    """Unpaid invoices grouped by payer, largest outstanding amount first."""
    columns = ["Payer", "Open Invoices", "Outstanding Amount"]
    invoices = session.exec(select(Invoice)).all()
    default_p = session.exec(select(Payer)).first() or Payer(id="PAY-DEFAULT", name="Self Pay", type="PATIENT")
    by_payer: dict[str, dict] = {}
    for inv in invoices:
        due = outstanding(inv)
        if inv.paid_at is not None or due <= 0:
            continue
        payer = session.get(Payer, inv.payer_id) if inv.payer_id else None
        p = payer or default_p
        entry = by_payer.setdefault(p.id, {"name": _payer_label(p), "count": 0, "total": 0.0})
        entry["count"] += 1
        entry["total"] += due
    ordered = sorted(by_payer.values(), key=lambda e: -e["total"])
    rows = [[e["name"], e["count"], _round(e["total"])] for e in ordered]
    return columns, rows


def _delays(session: Session) -> tuple[list[str], list[list]]:
    """Overdue invoices, most days overdue first."""
    columns = ["Invoice", "Payer", "Due Date", "Days Overdue", "Amount Due"]
    today = get_today(session)
    items = sorted(overdue_items(session, today), key=lambda item: -item[2])
    rows = [
        [inv.id, _payer_label(payer), inv.due_date.isoformat(), days, _round(outstanding(inv))]
        for inv, payer, days in items
    ]
    return columns, rows


def _payer_reliability(session: Session) -> tuple[list[str], list[list]]:
    """Per payer: share of payments received on or before the due date."""
    columns = ["Payer", "Payments", "Paid On Time", "On-Time Share (%)"]
    stats: dict[str, dict] = {}
    for pay, payer in _payments(session):
        entry = stats.setdefault(payer.id, {"name": _payer_label(payer), "count": 0, "on_time": 0})
        entry["count"] += 1
        if pay.paid_date <= pay.due_date:
            entry["on_time"] += 1
    rows = []
    for entry in sorted(stats.values(), key=lambda e: e["name"]):
        share = entry["on_time"] / entry["count"] * 100
        rows.append([entry["name"], entry["count"], entry["on_time"], round(share, 1)])
    return columns, rows


def _monthly_cashflow(session: Session) -> tuple[list[str], list[list]]:
    """Collections per month with a running total."""
    columns = ["Month", "Collected", "Running Total"]
    rows = []
    running = 0.0
    for month, _count, amount in _monthly_totals(session):
        running += amount
        rows.append([month, _round(amount), _round(running)])
    return columns, rows


_BUILDERS: dict[str, Callable[[Session], tuple[list[str], list[list]]]] = {
    "collections": _collections,
    "outstanding": _outstanding,
    "delays": _delays,
    "payer-reliability": _payer_reliability,
    "monthly-cashflow": _monthly_cashflow,
}


def build_report(session: Session, report_type: str) -> dict | None:
    """Return {"title", "columns", "rows"} for a known report type, else None."""
    builder = _BUILDERS.get(report_type)
    if builder is None:
        return None
    columns, rows = builder(session)
    return {"title": REPORT_TITLES[report_type], "columns": columns, "rows": rows}


def report_to_csv(report: dict) -> str:
    """Header row = columns; every value quoted."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, quoting=csv.QUOTE_ALL, lineterminator="\n")
    writer.writerow(report["columns"])
    writer.writerows(report["rows"])
    return buffer.getvalue()
