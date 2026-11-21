from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.models.entities import Bill, ClinicSettings, Invoice, Payer
from app.schemas.api import DashboardSummaryOut
from app.schemas.common import Envelope
from app.services.invoice_logic import compute_status, get_today, outstanding

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=Envelope[DashboardSummaryOut])
def dashboard_summary(session: Session = Depends(get_session)):
    """Formulas (all 0-safe):
    - openingCash: ClinicSettings.opening_cash (0 if no settings row).
    - totalOutstanding: sum of (amount - paid_amount) over unpaid invoices.
    - overdueAmount: same, only for status 'overdue'.
    - expectedCollections: same, for statuses 'promise_to_pay' and 'pending'.
    - cashRunwayDays: opening cash / daily burn. Daily burn = recurring bills
      scaled to 30 days (amount * 30 / repeats_every_days) divided by 30.
      Returns 0 when there is no recurring burn (runway cannot be computed).
    - financialHealthScore: 0-100. 100 when nothing is outstanding, otherwise
      100 * (1 - overdueAmount / totalOutstanding), clamped to 0..100.
    """
    today = get_today(session)
    settings_row = session.get(ClinicSettings, 1)
    opening_cash = float(settings_row.opening_cash) if settings_row else 0.0

    invoices = session.exec(select(Invoice)).all()
    total_outstanding = 0.0
    overdue_amount = 0.0
    expected = 0.0
    for inv in invoices:
        status = compute_status(inv, today)
        if status == "paid":
            continue
        due = outstanding(inv)
        total_outstanding += due
        if status == "overdue":
            overdue_amount += due
        elif status in ("promise_to_pay", "pending"):
            expected += due

    monthly_burn = 0.0
    for bill in session.exec(select(Bill)).all():
        if bill.repeats_every_days and bill.repeats_every_days > 0:
            monthly_burn += bill.amount * 30 / bill.repeats_every_days
    daily_burn = monthly_burn / 30

    runway = int(opening_cash / daily_burn) if daily_burn > 0 else 0
    if total_outstanding > 0:
        score = round(100 * (1 - overdue_amount / total_outstanding))
    else:
        score = 100
    score = max(0, min(100, score))

    return {"data": DashboardSummaryOut(
        opening_cash=opening_cash,
        total_outstanding=total_outstanding,
        overdue_amount=overdue_amount,
        expected_collections=expected,
        cash_runway_days=max(0, runway),
        financial_health_score=score,
    )}
