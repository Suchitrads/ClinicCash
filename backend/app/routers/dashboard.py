from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.schemas.common import Envelope
from app.services.dashboard import build_dashboard

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard", response_model=Envelope[dict])
def dashboard(session: Session = Depends(get_session)):
    return {"data": build_dashboard(session)}