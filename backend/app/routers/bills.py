from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db import get_session
from app.models.entities import Bill
from app.schemas.api import BillFundingChainOut, BillIn, BillOut, BillUpdate
from app.schemas.common import Envelope
from app.services.analytics import build_bill_funding_chain
from app.services.invoice_logic import get_today

router = APIRouter(tags=["bills"])

BILL_NOT_FOUND = "Bill not found"

# frontend recurrence -> repeats_every_days (None = one-off bill)
RECURRENCE_DAYS = {
    "none": None,
    "weekly": 7,
    "monthly": 30,
    "quarterly": 90,
    "yearly": 365,
    "custom": 30,
}


def _load(session: Session, bill_id: str) -> Bill:
    bill = session.get(Bill, bill_id.strip())
    if bill is None:
        raise HTTPException(status_code=404, detail=BILL_NOT_FOUND)
    return bill


def _apply_status(bill: Bill, status: str, today: date) -> None:
    # 'paid' stamps paid_at (keeps an existing stamp); any other status clears it.
    if status == "paid":
        if bill.paid_at is None:
            bill.paid_at = today
    else:
        bill.paid_at = None


def to_bill_out(bill: Bill, today: date) -> BillOut:
    if bill.repeats_every_days is None:
        recurrence = "none"
    elif bill.repeats_every_days == 7:
        recurrence = "weekly"
    elif bill.repeats_every_days == 30:
        recurrence = "monthly"
    elif bill.repeats_every_days == 90:
        recurrence = "quarterly"
    elif bill.repeats_every_days == 365:
        recurrence = "yearly"
    else:
        recurrence = "custom"
    # status is 'paid' once paid_at is set, 'overdue' if due before today, otherwise 'pending'
    if bill.paid_at is not None:
        status = "paid"
    elif bill.first_due_date < today:
        status = "overdue"
    else:
        status = "pending"
    return BillOut(
        id=bill.id,
        name=bill.name,
        amount=bill.amount,
        due_date=bill.first_due_date,
        recurrence=recurrence,
        deferrable=bill.is_deferrable,
        status=status,
    )


@router.get("/bills", response_model=Envelope[list[BillOut]])
def list_bills(session: Session = Depends(get_session)):
    today = get_today(session)
    data = [to_bill_out(b, today) for b in session.exec(select(Bill)).all()]
    return {"data": data, "meta": {"count": len(data)}}


@router.get("/bills/funding-chain", response_model=Envelope[list[BillFundingChainOut]])
def get_funding_chain(session: Session = Depends(get_session)):
    data = build_bill_funding_chain(session)
    return {"data": data, "meta": {"count": len(data)}}


@router.get("/bills/{bill_id}", response_model=Envelope[BillOut])
def get_bill(bill_id: str, session: Session = Depends(get_session)):
    bill = _load(session, bill_id)
    return {"data": to_bill_out(bill, get_today(session))}


@router.post("/bills", response_model=Envelope[BillOut])
def create_bill(body: BillIn, session: Session = Depends(get_session)):
    today = get_today(session)
    bill = Bill(
        id=f"BILL-{uuid4().hex[:8].upper()}",
        name=body.name,
        amount=body.amount,
        first_due_date=body.due_date,
        repeats_every_days=RECURRENCE_DAYS[body.recurrence],
        is_deferrable=body.deferrable,
    )
    if body.status is not None:
        _apply_status(bill, body.status, today)
    session.add(bill)
    session.commit()
    session.refresh(bill)
    return {"data": to_bill_out(bill, today)}


@router.put("/bills/{bill_id}", response_model=Envelope[BillOut])
def update_bill(bill_id: str, body: BillUpdate, session: Session = Depends(get_session)):
    bill = _load(session, bill_id)
    fields = body.model_fields_set

    if "name" in fields and body.name is not None:
        bill.name = body.name
    if "amount" in fields and body.amount is not None:
        bill.amount = body.amount
    if "due_date" in fields and body.due_date is not None:
        bill.first_due_date = body.due_date
    if "recurrence" in fields and body.recurrence is not None:
        bill.repeats_every_days = RECURRENCE_DAYS[body.recurrence]
    if "deferrable" in fields and body.deferrable is not None:
        bill.is_deferrable = body.deferrable
    if "status" in fields and body.status is not None:
        _apply_status(bill, body.status, get_today(session))

    session.add(bill)
    session.commit()
    session.refresh(bill)
    return {"data": to_bill_out(bill, get_today(session))}


@router.delete("/bills/{bill_id}", response_model=Envelope[None])
def delete_bill(bill_id: str, session: Session = Depends(get_session)):
    bill = _load(session, bill_id)
    session.delete(bill)
    session.commit()
    return {"data": None}
