from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.db import get_session
from app.models.entities import ClinicSettings
from app.schemas.api import SettingsOut, SettingsUpdate
from app.schemas.common import Envelope
from app.services.invoice_logic import get_today

router = APIRouter(tags=["settings"])


def _get_or_create(session: Session) -> ClinicSettings:
    row = session.get(ClinicSettings, 1)
    if row is None:
        # defaults match the seed values where the seed sets them
        row = ClinicSettings(
            id=1,
            opening_cash=0.0,
            weekly_walk_in_collections=0.0,
            safety_buffer=0.0,
            due_soon_days=7,
            chase_threshold_days=7,
            final_notice_days=21,
            earliest_expected_payment_days=3,
            timezone="Asia/Kolkata",
            demo_today=get_today(session),
            reminder_threshold_days=7,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
    return row


def to_settings_out(row: ClinicSettings) -> SettingsOut:
    return SettingsOut(
        opening_cash=row.opening_cash,
        weekly_walk_in_collections=row.weekly_walk_in_collections,
        safety_buffer=row.safety_buffer,
        due_soon_days=row.due_soon_days,
        reminder_threshold_days=row.reminder_threshold_days,
        timezone=row.timezone,
    )


@router.get("/settings", response_model=Envelope[SettingsOut])
def get_settings(session: Session = Depends(get_session)):
    return {"data": to_settings_out(_get_or_create(session))}


@router.put("/settings", response_model=Envelope[SettingsOut])
def update_settings(body: SettingsUpdate, session: Session = Depends(get_session)):
    row = _get_or_create(session)
    for field in body.model_fields_set:
        value = getattr(body, field)
        if value is not None:
            setattr(row, field, value)
    session.add(row)
    session.commit()
    session.refresh(row)
    return {"data": to_settings_out(row)}
