from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.models.entities import Invoice, Payer
from app.schemas.common import Envelope

router = APIRouter(tags=["invoices"])


@router.get("/invoices", response_model=Envelope[list[dict]])
def list_invoices(session: Session = Depends(get_session)):
    rows = session.exec(select(Invoice, Payer).join(Payer, Invoice.payer_id == Payer.id)).all()
    data = []
    for inv, payer in rows:
        item = inv.model_dump()
        item["payer_name"] = payer.name
        item["payer_type"] = payer.type
        data.append(item)
    return {"data": data, "meta": {"count": len(data)}}