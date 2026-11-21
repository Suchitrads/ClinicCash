from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models.entities import Reminder
from app.schemas.api import ReminderIn, ReminderOut
from app.schemas.common import Envelope
from app.services.reminder_service import generate_reminder_for_invoice

router = APIRouter(tags=["reminders"])


def _to_out(r: Reminder) -> ReminderOut:
    return ReminderOut(id=str(r.id), invoice_id=r.invoice_id, tone=r.tone,
                       language=r.language, message=r.message,
                       upi_link=r.upi_link, whatsapp_link=r.whatsapp_link)


@router.get("/reminders", response_model=Envelope[list[ReminderOut]])
def list_reminders(session: Session = Depends(get_session)):
    rows = session.exec(select(Reminder).order_by(Reminder.id)).all()
    data = [_to_out(r) for r in rows]
    return {"data": data, "meta": {"count": len(data)}}


@router.post("/reminders/generate", response_model=Envelope[ReminderOut])
def generate_reminder(body: ReminderIn, session: Session = Depends(get_session)):
    try:
        reminder = generate_reminder_for_invoice(session, body.invoice_id, body.tone, body.language)
    except LookupError:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {"data": _to_out(reminder)}
