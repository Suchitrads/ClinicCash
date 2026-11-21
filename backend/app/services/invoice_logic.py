from datetime import date

from sqlmodel import Session

from app.models.entities import ClinicSettings, Invoice, Payer
from app.schemas.api import InvoiceOut, PayerRef

NEXT_ACTION = {
    "overdue": "Send a reminder today",
    "pending": "Wait for payment",
    "promise_to_pay": "Check on the promised date",
    "paid": "No action needed",
}


def get_today(session: Session) -> date:
    """The app's 'today': ClinicSettings.demo_today, falling back to the real date."""
    row = session.get(ClinicSettings, 1)
    if row is not None and row.demo_today is not None:
        return row.demo_today
    return date.today()


def outstanding(inv: Invoice) -> float:
    return max(0.0, inv.amount - (inv.paid_amount or 0.0))


def compute_status(inv: Invoice, today: date) -> str:
    if inv.paid_at is not None:
        return "paid"
    if inv.promise_to_pay_date is not None and inv.promise_to_pay_date > today:
        return "promise_to_pay"
    if inv.due_date < today:
        return "overdue"
    return "pending"


def to_invoice_out(inv: Invoice, payer: Payer, today: date) -> InvoiceOut:
    status = compute_status(inv, today)
    overdue = 0 if status == "paid" else max(0, (today - inv.due_date).days)
    patient_name = getattr(inv, "patient_name", None) or (payer.name if payer.type == "PATIENT" else None)
    return InvoiceOut(
        id=inv.id,
        payer=PayerRef(id=payer.id, name=payer.name),
        patient_name=patient_name,
        item_label=inv.item_label or "",
        amount=inv.amount,
        paid_amount=inv.paid_amount or 0.0,
        due_date=inv.due_date,
        claim_stage=inv.claim_stage or "",
        status=status,
        promise_date=inv.promise_to_pay_date,
        overdue_days=overdue,
        next_action=NEXT_ACTION[status],
    )
