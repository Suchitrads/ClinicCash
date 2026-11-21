from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.schemas.api import AlertOut
from app.schemas.common import Envelope
from app.services.analytics import build_alerts

router = APIRouter(tags=["alerts"])


@router.get("/alerts", response_model=Envelope[list[AlertOut]])
def list_alerts(session: Session = Depends(get_session)):
    data = build_alerts(session, datetime.now(timezone.utc))
    return {"data": data, "meta": {"count": len(data)}}
