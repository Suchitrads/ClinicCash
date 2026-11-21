from datetime import date, datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class Payer(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    type: str  # PATIENT | CORPORATE | INSURER


class Invoice(SQLModel, table=True):
    id: str = Field(primary_key=True)
    payer_id: str = Field(foreign_key="payer.id", index=True)
    patient_name: Optional[str] = Field(default=None)
    item_label: str
    amount: float
    due_date: date
    paid_amount: float = 0.0
    paid_at: Optional[date] = None
    promise_to_pay_date: Optional[date] = None
    claim_stage: Optional[str] = None
    created_at: date


class PaymentHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    payer_id: str = Field(foreign_key="payer.id", index=True)
    invoice_id: Optional[str] = Field(default=None, foreign_key="invoice.id", index=True)
    amount: float
    due_date: date
    paid_date: date
    method: Optional[str] = None


class PaymentPlan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: str = Field(foreign_key="invoice.id", index=True)
    installments: int
    amount_per_installment: float
    start_date: date
    status: str = "active"
    frequency: str = "monthly"  # weekly | biweekly | monthly


class Reminder(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    invoice_id: str = Field(foreign_key="invoice.id", index=True)
    tone: str
    language: str
    message: str
    upi_link: Optional[str] = None
    whatsapp_link: Optional[str] = None
    created_at: datetime


class Bill(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    amount: float
    first_due_date: date
    repeats_every_days: Optional[int] = None
    is_deferrable: bool = False
    defer_days: int = 0
    paid_at: Optional[date] = None  # set when the bill is marked paid; drives status


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
    reminder_threshold_days: int = 7


class User(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    email: str = Field(index=True, unique=True)
    password_hash: Optional[str] = None  # "salt$hex" (pbkdf2_sha256); None for Google-only accounts
    google_sub: Optional[str] = None
    created_at: datetime
    trial_ends_at: datetime
    plan: Optional[str] = None  # 'pro' | 'free' | None (still on trial)


class AuthSession(SQLModel, table=True):
    __tablename__ = "session"
    token: str = Field(primary_key=True)
    user_id: str = Field(foreign_key="user.id", index=True)
    created_at: datetime