from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.db import get_session
from app.schemas.api import ForecastResponseOut, ForecastScenarioIn
from app.schemas.common import Envelope
from app.services.analytics import build_forecast

router = APIRouter(tags=["forecast"])


@router.get("/forecast", response_model=Envelope[ForecastResponseOut])
def get_forecast(horizon: int = Query(30, ge=7, le=180), session: Session = Depends(get_session)):
    return {"data": build_forecast(session, horizon)}


@router.post("/forecast/scenario", response_model=Envelope[ForecastResponseOut])
def post_forecast_scenario(body: ForecastScenarioIn,
                           horizon: int = Query(30, ge=7, le=180),
                           session: Session = Depends(get_session)):
    return {"data": build_forecast(session, horizon, body)}
