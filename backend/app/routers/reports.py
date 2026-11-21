from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlmodel import Session

from app.db import get_session
from app.services.reports import build_report, report_to_csv

router = APIRouter(tags=["reports"])


@router.get("/reports/{report_type}")
def get_report(
    report_type: str,
    format_: Optional[Literal["csv"]] = Query(default=None, alias="format"),
    session: Session = Depends(get_session),
):
    report = build_report(session, report_type)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    if format_ == "csv":
        return Response(content=report_to_csv(report), media_type="text/csv")
    return {"data": report}
