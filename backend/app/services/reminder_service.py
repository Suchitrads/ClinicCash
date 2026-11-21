from datetime import datetime, timezone
from urllib.parse import quote

from sqlalchemy import func
from sqlmodel import Session, select

from app.config import settings
from app.models.entities import Invoice, Payer, Reminder
from app.services.invoice_logic import get_today, outstanding

# Plain English, short sentences, everyday words.
TEMPLATES = {
    "friendly": "Hello {name}. This is a reminder that invoice {invoice_id} for Rs {amount} "
                "is due on {date}. Please pay when you can. Thank you.",
    "firm": "Hello {name}. Invoice {invoice_id} for Rs {amount} is past due. "
            "Please pay it this week. Thank you.",
    "final": "Hello {name}. Invoice {invoice_id} for Rs {amount} is overdue. "
             "This is the last reminder. Please pay now. Thank you.",
}


def _fmt_amount(value: float) -> str:
    return str(int(value)) if float(value).is_integer() else f"{value:.2f}"


def _fmt_date(d) -> str:
    return f"{d.day} {d:%B %Y}"


def generate_reminder_for_invoice(session: Session, invoice_id: str, tone: str, language: str) -> Reminder:
    """Build and save a reminder for one invoice. Raises LookupError if the invoice does not exist."""
    invoice_id = invoice_id.strip()
    inv = session.exec(
        select(Invoice).where(func.lower(Invoice.id) == invoice_id.lower())
    ).first()
    if inv is None:
        raise LookupError("Invoice not found")
    payer = session.get(Payer, inv.payer_id) if inv.payer_id else None
    if payer is None:
        payer = session.exec(select(Payer)).first() or Payer(id="PAY-DEFAULT", name="Self Pay", type="PATIENT")
    today = get_today(session)

    balance = outstanding(inv)
    text = TEMPLATES[tone].format(
        name=payer.name,
        invoice_id=inv.id,
        amount=_fmt_amount(balance),
        date=_fmt_date(inv.due_date),
    )
    # Non-English languages: English text with a language tag, no unverified translation.
    message = text if language == "en" else f"[{language}] {text}"

    upi_link = (f"upi://pay?pa={settings.upi_id}&pn=ClinicCash"
                f"&am={_fmt_amount(balance)}&tn={inv.id}")
    whatsapp_link = f"https://wa.me/?text={quote(message, safe='')}"

    reminder = Reminder(
        invoice_id=inv.id,
        tone=tone,
        language=language,
        message=message,
        upi_link=upi_link,
        whatsapp_link=whatsapp_link,
        created_at=datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc),
    )
    session.add(reminder)
    session.commit()
    session.refresh(reminder)
    return reminder
