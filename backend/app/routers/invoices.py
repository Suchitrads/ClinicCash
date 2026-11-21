from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.db import get_session
from app.models.entities import ClinicSettings, Invoice, Payer, PaymentHistory
from app.schemas.common import Envelope

router = APIRouter(tags=["invoices"])


class InvoiceCreate(BaseModel):
    payer_id: str
    item_label: str = Field(min_length=1)
    amount: float = Field(gt=0)
    due_date: date


class MarkPaid(BaseModel):
    paid_date: Optional[date] = None


class Promise(BaseModel):
    promise_to_pay_date: date


def _today(session: Session) -> date:
    return session.get(ClinicSettings, 1).demo_today


def _to_dict(inv: Invoice, payer: Payer) -> dict:
    item = inv.model_dump()
    item["payer_name"] = payer.name
    item["payer_type"] = payer.type
    return item


def _next_id(session: Session) -> str:
    ids = session.exec(select(Invoice.id)).all()
    nums = [int(i[4:]) for i in ids if i.startswith("INV-") and i[4:].isdigit()]
    return f"INV-{(max(nums) if nums else 0) + 1:03d}"


def _get_invoice(session: Session, invoice_id: str) -> tuple[Invoice, Payer]:
    inv = session.get(Invoice, invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    return inv, session.get(Payer, inv.payer_id)


@router.get("/invoices", response_model=Envelope[list[dict]])
def list_invoices(session: Session = Depends(get_session)):
    rows = session.exec(select(Invoice, Payer).join(Payer, Invoice.payer_id == Payer.id)).all()
    data = [_to_dict(inv, payer) for inv, payer in rows]
    return {"data": data, "meta": {"count": len(data)}}


@router.get("/invoices/{invoice_id}", response_model=Envelope[dict])
def get_invoice(invoice_id: str, session: Session = Depends(get_session)):
    inv, payer = _get_invoice(session, invoice_id)
    return {"data": _to_dict(inv, payer)}


@router.post("/invoices", response_model=Envelope[dict], status_code=201)
def create_invoice(body: InvoiceCreate, session: Session = Depends(get_session)):
    payer = session.get(Payer, body.payer_id)
    if not payer:
        raise HTTPException(status_code=404, detail=f"Payer {body.payer_id} not found")
    inv = Invoice(id=_next_id(session), payer_id=body.payer_id, item_label=body.item_label,
                  amount=body.amount, due_date=body.due_date, created_at=_today(session))
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return {"data": _to_dict(inv, payer)}


@router.post("/invoices/{invoice_id}/mark-paid", response_model=Envelope[dict])
def mark_paid(invoice_id: str, body: MarkPaid = MarkPaid(), session: Session = Depends(get_session)):
    inv, payer = _get_invoice(session, invoice_id)
    if inv.paid_at:
        raise HTTPException(status_code=409, detail="Invoice is already paid")
    paid_date = body.paid_date or _today(session)
    inv.paid_at = paid_date
    session.add(inv)
    session.add(PaymentHistory(payer_id=inv.payer_id, amount=inv.amount,
                               due_date=inv.due_date, paid_date=paid_date))
    session.commit()
    session.refresh(inv)
    return {"data": _to_dict(inv, payer)}


@router.post("/invoices/{invoice_id}/promise", response_model=Envelope[dict])
def set_promise(invoice_id: str, body: Promise, session: Session = Depends(get_session)):
    inv, payer = _get_invoice(session, invoice_id)
    if inv.paid_at:
        raise HTTPException(status_code=409, detail="Invoice is already paid")
    if body.promise_to_pay_date < _today(session):
        raise HTTPException(status_code=422, detail="Promise date cannot be in the past")
    inv.promise_to_pay_date = body.promise_to_pay_date
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return {"data": _to_dict(inv, payer)}