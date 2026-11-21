from datetime import date
from typing import Optional

from sqlmodel import Field, SQLModel


class Payer(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    type: str  # PATIENT | CORPORATE | INSURER


class Invoice(SQLModel, table=True):
    id: str = Field(primary_key=True)
    payer_id: str = Field(foreign_key="payer.id", index=True)
    item_label: str
    amount: float
    due_date: date
    paid_at: Optional[date] = None
    promise_to_pay_date: Optional[date] = None
    claim_stage: Optional[str] = None
    created_at: date


class PaymentHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    payer_id: str = Field(foreign_key="payer.id", index=True)
    amount: float
    due_date: date
    paid_date: date


class Bill(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    amount: float
    first_due_date: date
    repeats_every_days: Optional[int] = None
    is_deferrable: bool = False
    defer_days: int = 0


class ClinicSettings(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    opening_cash: float
    weekly_walk_in_collections: float
    safety_buffer: float
    due_soon_days: int
    chase_threshold_days: int
    final_notice_days: int
    earliest_expected_payment_days: int
    timezone: str
    demo_today: date