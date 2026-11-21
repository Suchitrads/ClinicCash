from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.db import get_session
from app.models.entities import Bill, Payer
from app.schemas.common import Envelope
from app.services.forecast_engine import Scenario
from app.services.forecast_service import build_forecast

router = APIRouter(tags=["forecast"])


@router.get("/forecast", response_model=Envelope[dict])
def get_forecast(
    horizon_days: int = Query(90, ge=1, le=365),
    scenario_payer_id: Optional[str] = None,
    late_days: int = Query(0, ge=0, le=365),
    insurer_rejection_pct: float = Query(0, ge=0, le=100),
    defer_bill_id: Optional[str] = None,
    defer_days: int = Query(0, ge=0, le=90),
    session: Session = Depends(get_session),
):
    if scenario_payer_id and not session.get(Payer, scenario_payer_id):
        raise HTTPException(status_code=404, detail=f"Payer {scenario_payer_id} not found")
    if defer_bill_id and not session.get(Bill, defer_bill_id):
        raise HTTPException(status_code=404, detail=f"Bill {defer_bill_id} not found")

    scenario = Scenario(payer_id=scenario_payer_id, late_days=late_days,
                        insurer_rejection_pct=insurer_rejection_pct,
                        defer_bill_id=defer_bill_id, defer_days=defer_days)
    data = build_forecast(session, horizon_days, scenario)
    return {"data": data, "meta": {"points": len(data["points"])}}