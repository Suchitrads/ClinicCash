from fastapi import APIRouter
from app.schemas.common import Envelope
router = APIRouter(tags=["health"])
@router.get("/health", response_model=Envelope[dict])
def health():
    return {"data": {"status": "ok"}}
