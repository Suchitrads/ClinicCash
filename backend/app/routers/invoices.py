from datetime import date, timedelta
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.db import get_session
from app.models.entities import Invoice, Payer, PaymentHistory, PaymentPlan, Reminder
from app.schemas.api import (InvoiceIn, InvoiceOut, InvoiceUpdate, PaymentIn, PaymentOut,
                             PayerRef, PromiseIn)
from app.schemas.common import Envelope
from app.services.invoice_logic import get_today, to_invoice_out

router = APIRouter(tags=["invoices"])

INVOICE_NOT_FOUND = "Invoice not found"


def _load(session: Session, invoice_id: str) -> tuple[Invoice, Payer]:
    invoice_id = invoice_id.strip()
    inv = session.exec(
        select(Invoice).where(func.lower(Invoice.id) == invoice_id.lower())
    ).first()
    if inv is None:
        raise HTTPException(status_code=404, detail=INVOICE_NOT_FOUND)
    payer = session.get(Payer, inv.payer_id) if inv.payer_id else None
    if payer is None:
        payer = session.exec(select(Payer)).first()
        if payer is None:
            payer = Payer(id="PAY-DEFAULT", name="Self Pay", type="PATIENT")
            session.add(payer)
            session.flush()
        inv.payer_id = payer.id
        session.add(inv)
        session.flush()
    return inv, payer


def _resolve_payer(session: Session, payer_ref: PayerRef) -> Payer:
    # 1. By ID
    if payer_ref.id:
        p = session.get(Payer, payer_ref.id)
        if p is not None:
            return p
        p = session.exec(select(Payer).where(func.lower(Payer.id) == payer_ref.id.lower())).first()
        if p is not None:
            return p
    # 2. By Name
    name = (payer_ref.name or "").strip()
    if name:
        p = session.exec(select(Payer).where(func.lower(Payer.name) == name.lower())).first()
        if p is not None:
            return p
        p = session.exec(select(Payer).where(func.lower(Payer.name).contains(name.lower()))).first()
        if p is not None:
            return p
        # 3. Create new payer
        ptype = "INSURER" if ("TPA" in name or "Insurance" in name) else "PATIENT"
        pid = payer_ref.id if (payer_ref.id and not payer_ref.id.lower().startswith("payer-")) else f"PAY-{uuid4().hex[:6].upper()}"
        new_payer = Payer(id=pid, name=name, type=ptype)
        session.add(new_payer)
        session.flush()
        return new_payer
    # Fallback to first existing payer if neither provided
    p = session.exec(select(Payer)).first()
    if p is not None:
        return p
    fallback = Payer(id="PAY-DEFAULT", name="Self Pay", type="PATIENT")
    session.add(fallback)
    session.flush()
    return fallback


@router.get("/payers", response_model=Envelope[list[PayerRef]])
def list_payers(session: Session = Depends(get_session)):
    payers = session.exec(select(Payer).order_by(Payer.name)).all()
    data = [PayerRef(id=p.id, name=p.name) for p in payers]
    return {"data": data, "meta": {"count": len(data)}}


@router.get("/invoices", response_model=Envelope[list[InvoiceOut]])
def list_invoices(
    search: Optional[str] = None,
    payer: Optional[str] = None,
    status: Optional[Literal["paid", "pending", "overdue", "promise_to_pay"]] = None,
    sortBy: Optional[Literal["dueDate", "amount"]] = None,
    sortDir: Literal["asc", "desc"] = "asc",
    session: Session = Depends(get_session),
):
    today = get_today(session)
    default_p = session.exec(select(Payer)).first() or Payer(id="PAY-DEFAULT", name="Self Pay", type="PATIENT")
    invoices = session.exec(select(Invoice)).all()
    rows = []
    for inv in invoices:
        p = session.get(Payer, inv.payer_id) if inv.payer_id else None
        rows.append((inv, p or default_p))
    items = [(inv, to_invoice_out(inv, p, today)) for inv, p in rows]

    if search and search.strip():
        q = search.strip().lower()
        items = [
            (inv, o) for inv, o in items
            if q in inv.id.lower()
            or (inv.item_label and q in inv.item_label.lower())
            or (o.payer.name and q in o.payer.name.lower())
            or (o.patient_name and q in o.patient_name.lower())
        ]
    if payer:
        items = [(inv, o) for inv, o in items if inv.payer_id == payer]
    if status:
        items = [(inv, o) for inv, o in items if o.status == status]
    if sortBy:
        key = (lambda t: t[1].due_date) if sortBy == "dueDate" else (lambda t: t[1].amount)
        items.sort(key=key, reverse=(sortDir == "desc"))

    data = [o for _, o in items]
    return {"data": data, "meta": {"count": len(data)}}


@router.get("/invoices/{invoice_id}", response_model=Envelope[InvoiceOut])
def get_invoice(invoice_id: str, session: Session = Depends(get_session)):
    inv, payer = _load(session, invoice_id)
    return {"data": to_invoice_out(inv, payer, get_today(session))}


@router.post("/invoices", response_model=Envelope[InvoiceOut])
def create_invoice(body: InvoiceIn, session: Session = Depends(get_session)):
    payer_ref = body.payer or (PayerRef(id=body.payer_id) if body.payer_id else PayerRef(name="Self Pay"))
    payer = _resolve_payer(session, payer_ref)
    today = get_today(session)
    label = body.item_label or (f"Service - {body.patient_name}" if body.patient_name else "Medical services")

    is_plan = bool(body.is_installment_plan and body.plan_months and body.plan_months > 1)
    if is_plan:
        n_months = body.plan_months
        installment_amount = round(body.amount / n_months, 2)
        inv = Invoice(
            id=f"INV-{uuid4().hex[:8].upper()}",
            payer_id=payer.id,
            patient_name=body.patient_name,
            item_label=f"{label} (Month 1 of {n_months})",
            amount=installment_amount,
            paid_amount=min(body.paid_amount, installment_amount),
            due_date=body.due_date,
            promise_to_pay_date=body.promise_date,
            claim_stage=body.claim_stage or "Submitted",
            created_at=today,
        )
        if inv.paid_amount >= inv.amount:
            inv.paid_at = today
            session.add(PaymentHistory(
                payer_id=payer.id,
                invoice_id=inv.id,
                amount=inv.paid_amount,
                due_date=inv.due_date,
                paid_date=today,
                method="cash",
            ))
        session.add(inv)
        session.flush()

        # Create all future monthly scheduled invoices
        for k in range(2, n_months + 1):
            future_due = body.due_date + timedelta(days=30 * (k - 1))
            future_inv = Invoice(
                id=f"INV-{uuid4().hex[:8].upper()}",
                payer_id=payer.id,
                patient_name=body.patient_name,
                item_label=f"{label} (Month {k} of {n_months})",
                amount=installment_amount,
                paid_amount=0.0,
                due_date=future_due,
                promise_to_pay_date=None,
                claim_stage="Scheduled",
                created_at=today,
            )
            session.add(future_inv)

        session.add(PaymentPlan(
            invoice_id=inv.id,
            installments=n_months,
            amount_per_installment=installment_amount,
            start_date=body.due_date,
            status="active",
            frequency="monthly",
        ))
        session.commit()
        session.refresh(inv)
        return {"data": to_invoice_out(inv, payer, today)}

    inv = Invoice(
        id=f"INV-{uuid4().hex[:8].upper()}",
        payer_id=payer.id,
        patient_name=body.patient_name,
        item_label=label,
        amount=body.amount,
        paid_amount=body.paid_amount,
        due_date=body.due_date,
        promise_to_pay_date=body.promise_date,
        claim_stage=body.claim_stage or "Submitted",
        created_at=today,
    )
    if inv.paid_amount >= inv.amount:
        inv.paid_at = today
        session.add(PaymentHistory(
            payer_id=payer.id,
            invoice_id=inv.id,
            amount=inv.paid_amount,
            due_date=inv.due_date,
            paid_date=today,
            method="cash",
        ))
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return {"data": to_invoice_out(inv, payer, today)}


@router.put("/invoices/{invoice_id}", response_model=Envelope[InvoiceOut])
def update_invoice(invoice_id: str, body: InvoiceUpdate, session: Session = Depends(get_session)):
    inv, payer = _load(session, invoice_id)
    if "payer" in body.model_fields_set and body.payer is not None:
        payer = _resolve_payer(session, body.payer)
        inv.payer_id = payer.id

    if "patient_name" in body.model_fields_set:
        inv.patient_name = body.patient_name

    column_for = {
        "item_label": "item_label",
        "amount": "amount",
        "paid_amount": "paid_amount",
        "due_date": "due_date",
        "claim_stage": "claim_stage",
        "promise_date": "promise_to_pay_date",
    }
    for field in body.model_fields_set & column_for.keys():
        setattr(inv, column_for[field], getattr(body, field))

    today = get_today(session)
    if (inv.paid_amount or 0) >= inv.amount and inv.paid_at is None:
        inv.paid_at = today
    elif (inv.paid_amount or 0) < inv.amount:
        inv.paid_at = None

    session.add(inv)
    session.commit()
    session.refresh(inv)
    return {"data": to_invoice_out(inv, payer, today)}


@router.delete("/invoices/{invoice_id}", response_model=Envelope[None])
def delete_invoice(invoice_id: str, session: Session = Depends(get_session)):
    inv, _ = _load(session, invoice_id)
    for model in (PaymentHistory, PaymentPlan, Reminder):
        for row in session.exec(select(model).where(model.invoice_id == inv.id)).all():
            session.delete(row)
    session.delete(inv)
    session.commit()
    return {"data": None}


@router.post("/invoices/{invoice_id}/payments", response_model=Envelope[PaymentOut])
def record_payment(invoice_id: str, body: PaymentIn, session: Session = Depends(get_session)):
    inv, _ = _load(session, invoice_id)
    paid_on: date = body.paid_on or get_today(session)
    ph = PaymentHistory(
        payer_id=inv.payer_id,
        invoice_id=inv.id,
        amount=body.amount,
        due_date=inv.due_date,
        paid_date=paid_on,
        method=body.method,
    )
    inv.paid_amount = (inv.paid_amount or 0.0) + body.amount
    if inv.paid_amount >= inv.amount and inv.paid_at is None:
        inv.paid_at = paid_on
    session.add(ph)
    session.add(inv)
    session.commit()
    session.refresh(ph)
    return {"data": PaymentOut(id=str(ph.id), invoice_id=inv.id, amount=ph.amount,
                               paid_on=ph.paid_date, method=ph.method or "")}


@router.post("/invoices/{invoice_id}/mark-paid", response_model=Envelope[InvoiceOut])
def mark_paid(invoice_id: str, session: Session = Depends(get_session)):
    inv, payer = _load(session, invoice_id)
    today = get_today(session)
    remaining = max(0.0, inv.amount - (inv.paid_amount or 0.0))
    inv.paid_amount = inv.amount
    inv.paid_at = today
    if remaining > 0:
        session.add(PaymentHistory(
            payer_id=inv.payer_id,
            invoice_id=inv.id,
            amount=remaining,
            due_date=inv.due_date,
            paid_date=today,
            method="cash",
        ))
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return {"data": to_invoice_out(inv, payer, today)}


@router.post("/invoices/{invoice_id}/promise-to-pay", response_model=Envelope[InvoiceOut])
def promise_to_pay(invoice_id: str, body: PromiseIn, session: Session = Depends(get_session)):
    inv, payer = _load(session, invoice_id)
    inv.promise_to_pay_date = body.promise_date
    session.add(inv)
    session.commit()
    session.refresh(inv)
    return {"data": to_invoice_out(inv, payer, get_today(session))}
