import calendar
import math
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.db import get_session
from app.models.entities import Invoice, Payer, PaymentPlan
from app.schemas.api import InstallmentPlanIn, PaymentPlanOut
from app.schemas.common import Envelope
from app.services.invoice_logic import get_today, outstanding

router = APIRouter(tags=["payment-plans"])


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _installment_date(start: date, frequency: str, k: int) -> date:
    if frequency == "weekly":
        return date.fromordinal(start.toordinal() + 7 * k)
    if frequency == "biweekly":
        return date.fromordinal(start.toordinal() + 14 * k)
    return _add_months(start, k)


def _to_out(plan: PaymentPlan, inv: Invoice, payer: Payer, today: date) -> PaymentPlanOut:
    name = f"{payer.name} - {inv.item_label}" if inv.item_label else payer.name
    # Next installment: first date on or after today, else the last scheduled one.
    dates = [_installment_date(plan.start_date, plan.frequency, k)
             for k in range(max(1, plan.installments))]
    next_date = next((d for d in dates if d >= today), dates[-1])
    return PaymentPlanOut(
        id=str(plan.id),
        name=name,
        total_amount=inv.amount,
        paid_amount=inv.paid_amount or 0.0,
        remaining_amount=outstanding(inv),
        installment_amount=plan.amount_per_installment,
        frequency=plan.frequency,
        next_payment_date=next_date,
    )


@router.post("/invoices/{invoice_id}/payment-plans", response_model=Envelope[PaymentPlanOut])
def create_payment_plan(invoice_id: str, body: InstallmentPlanIn,
                        session: Session = Depends(get_session)):
    invoice_id = invoice_id.strip()
    inv = session.exec(
        select(Invoice).where(func.lower(Invoice.id) == invoice_id.lower())
    ).first()
    if inv is None:
        raise HTTPException(status_code=404, detail="Invoice not found")
    payer = session.get(Payer, inv.payer_id) if inv.payer_id else None
    if payer is None:
        payer = session.exec(select(Payer)).first() or Payer(id="PAY-DEFAULT", name="Self Pay", type="PATIENT")
    today = get_today(session)
    installments = max(1, math.ceil(outstanding(inv) / body.installment_amount))
    plan = PaymentPlan(
        invoice_id=inv.id,
        installments=installments,
        amount_per_installment=body.installment_amount,
        start_date=body.start_date,
        status="active",
        frequency=body.frequency,
    )
    session.add(plan)
    session.commit()
    session.refresh(plan)
    return {"data": _to_out(plan, inv, payer, today)}


@router.get("/payment-plans", response_model=Envelope[list[PaymentPlanOut]])
def list_payment_plans(session: Session = Depends(get_session)):
    today = get_today(session)
    default_p = session.exec(select(Payer)).first() or Payer(id="PAY-DEFAULT", name="Self Pay", type="PATIENT")
    plans = session.exec(select(PaymentPlan).order_by(PaymentPlan.id)).all()
    data = []
    for plan in plans:
        inv = session.get(Invoice, plan.invoice_id)
        if not inv:
            continue
        payer = session.get(Payer, inv.payer_id) if inv.payer_id else default_p
        data.append(_to_out(plan, inv, payer or default_p, today))
    return {"data": data, "meta": {"count": len(data)}}
