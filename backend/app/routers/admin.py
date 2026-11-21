from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.schemas.common import Envelope
from app.services.seed import reset_and_seed

router = APIRouter(tags=["admin"])


@router.post("/seed/reset", response_model=Envelope[dict])
def seed_reset(session: Session = Depends(get_session)):
    return {"data": reset_and_seed(session)}