from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.db import get_session
from app.models.entities import Bill
from app.schemas.api import GapActionOut
from app.schemas.common import Envelope
from app.services.analytics import build_gap_actions, overdue_items
from app.services.invoice_logic import get_today, outstanding
from app.services.reminder_service import generate_reminder_for_invoice

router = APIRouter(tags=["gap-closer"])

GAP_PREFIX = "gap-"
DEFER_PREFIX = "gap-defer-"


@router.get("/gap-closer/actions", response_model=Envelope[list[GapActionOut]])
def list_gap_actions(session: Session = Depends(get_session)):
    data = build_gap_actions(session)
    return {"data": data, "meta": {"count": len(data)}}


@router.post("/gap-closer/actions/{action_id}/execute", response_model=Envelope[GapActionOut])
def execute_gap_action(action_id: str, session: Session = Depends(get_session)):
    if action_id.startswith(DEFER_PREFIX):
        bill_id = action_id[len(DEFER_PREFIX):]
        bill = session.get(Bill, bill_id)
        if bill is None:
            raise HTTPException(status_code=404, detail="Bill not found")
        bill.first_due_date = bill.first_due_date + timedelta(days=7)
        bill.defer_days = (bill.defer_days or 0) + 7
        session.add(bill)
        session.commit()
        session.refresh(bill)
        return {
            "data": GapActionOut(
                id=action_id,
                title=f"Ask {bill.name} for 7 days: moves ₹{bill.amount:,.0f} out of the window",
                estimated_amount=round(bill.amount, 2),
                impact=f"Successfully deferred {bill.name} by 7 days. Cash deficit resolved.",
                effort="low",
                explanation=f"New due date: {bill.first_due_date.strftime('%d %b %Y')}. Payment shifted out of the critical window.",
            )
        }

    if not action_id.startswith(GAP_PREFIX):
        raise HTTPException(status_code=404, detail="Gap action not found")
    payer_id = action_id[len(GAP_PREFIX):]

    today = get_today(session)
    items = [item for item in overdue_items(session, today) if item[1].id == payer_id]
    if not items:
        # Check if the payer exists in open invoices
        for action in build_gap_actions(session):
            if action.id == action_id:
                return {"data": action}
        raise HTTPException(status_code=404, detail="Gap action not found")

    # Remind about the most overdue invoice for this payer.
    most_overdue = max(items, key=lambda item: item[2])[0]
    generate_reminder_for_invoice(session, most_overdue.id, tone="firm", language="en")

    payer_name = items[0][1].name if items else payer_id
    total_est = sum(outstanding(inv) for inv, _, _ in items)
    return {
        "data": GapActionOut(
            id=action_id,
            title=f"Chase {payer_name}: +₹{total_est:,.0f}",
            estimated_amount=round(total_est, 2),
            impact=f"Payment link & reminder dispatched for overdue balance of ₹{total_est:,.0f}.",
            effort="low",
            explanation="WhatsApp reminder and payment prompt dispatched to payer.",
        )
    }
