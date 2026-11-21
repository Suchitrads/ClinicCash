"""Request/response models. Frontend keeps camelCase: aliases are generated with to_camel.

Responses are wrapped in Envelope (app.schemas.common) as {"data": ...}.
"""
from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

Status = Literal["paid", "pending", "overdue", "promise_to_pay"]
Frequency = Literal["weekly", "biweekly", "monthly"]
Tone = Literal["friendly", "firm", "final"]
Language = Literal["en", "hi", "ta", "te", "bn", "mr"]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class PayerRef(CamelModel):
    id: Optional[str] = None
    name: Optional[str] = ""


class InvoiceOut(CamelModel):
    id: str
    payer: PayerRef
    patient_name: Optional[str] = None
    item_label: Optional[str] = None
    amount: float
    paid_amount: float
    due_date: date
    claim_stage: str
    status: Status
    promise_date: Optional[date] = None
    overdue_days: int
    next_action: str


class InvoiceIn(CamelModel):
    payer: Optional[PayerRef] = None
    payer_id: Optional[str] = None
    patient_name: Optional[str] = None
    item_label: Optional[str] = ""
    amount: float = Field(gt=0)
    paid_amount: float = Field(default=0, ge=0)
    due_date: date
    claim_stage: Optional[str] = None
    promise_date: Optional[date] = None
    is_installment_plan: bool = False
    plan_months: Optional[int] = 10


class InvoiceUpdate(CamelModel):
    payer: Optional[PayerRef] = None
    patient_name: Optional[str] = None
    item_label: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    paid_amount: Optional[float] = Field(default=None, ge=0)
    due_date: Optional[date] = None
    claim_stage: Optional[str] = None
    promise_date: Optional[date] = None


class PaymentIn(CamelModel):
    amount: float = Field(gt=0)
    method: str = "cash"
    paid_on: Optional[date] = None


class PaymentOut(CamelModel):
    id: str
    invoice_id: str
    amount: float
    paid_on: date
    method: str


class PromiseIn(CamelModel):
    promise_date: date


class InstallmentPlanIn(CamelModel):
    installment_amount: float = Field(gt=0)
    frequency: Frequency
    start_date: date


class PaymentPlanOut(CamelModel):
    id: str
    name: str
    total_amount: float
    paid_amount: float
    remaining_amount: float
    installment_amount: float
    frequency: Frequency
    next_payment_date: date


class ReminderIn(CamelModel):
    invoice_id: str
    tone: Tone
    language: Language


class ReminderOut(CamelModel):
    id: str
    invoice_id: str
    tone: Tone
    language: Language
    message: str
    upi_link: Optional[str] = None
    whatsapp_link: Optional[str] = None


class DashboardSummaryOut(CamelModel):
    opening_cash: float
    total_outstanding: float
    overdue_amount: float
    expected_collections: float
    cash_runway_days: int
    financial_health_score: int


BillRecurrenceIn = Literal["none", "weekly", "monthly", "quarterly", "yearly", "custom"]
BillRecurrenceOut = Literal["none", "weekly", "monthly", "quarterly", "yearly", "custom"]
BillStatusIn = Literal["paid", "due", "pending", "overdue"]
BillStatusOut = Literal["paid", "pending", "overdue"]


class BillOut(CamelModel):
    id: str
    name: str
    amount: float
    due_date: date
    recurrence: BillRecurrenceOut
    deferrable: bool
    status: BillStatusOut


class BillIn(CamelModel):
    name: str
    amount: float = Field(gt=0)
    due_date: date
    recurrence: BillRecurrenceIn = "none"
    deferrable: bool = False
    status: Optional[BillStatusIn] = None


class BillUpdate(CamelModel):
    name: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    due_date: Optional[date] = None
    recurrence: Optional[BillRecurrenceIn] = None
    deferrable: Optional[bool] = None
    status: Optional[BillStatusIn] = None


class BillFundingSourceOut(CamelModel):
    name: str
    amount: float
    source_type: str


class BillFundingChainOut(CamelModel):
    bill_id: str
    bill_name: str
    amount: float
    due_date: date
    due_in_days: int
    sources: list[BillFundingSourceOut]
    funded_amount: float
    gap_amount: float
    status: Literal["fully_covered", "partially_covered", "gap"]
    narrative: str
    recommendation: Optional[str] = None


class SettingsOut(CamelModel):
    opening_cash: float
    weekly_walk_in_collections: float
    safety_buffer: float
    due_soon_days: int
    reminder_threshold_days: int
    timezone: str


class SettingsUpdate(CamelModel):
    opening_cash: Optional[float] = None
    weekly_walk_in_collections: Optional[float] = None
    safety_buffer: Optional[float] = None
    due_soon_days: Optional[int] = None
    reminder_threshold_days: Optional[int] = None
    timezone: Optional[str] = None


class ForecastPointOut(CamelModel):
    date: date
    likely: float
    cautious: float
    what_if: float
    safety_buffer: float
    zero_line: float


class ShortageWarningOut(CamelModel):
    date: date
    projected_balance: float
    message: str


class ForecastResponseOut(CamelModel):
    horizon_days: int
    points: list[ForecastPointOut]
    shortage_warnings: list[ShortageWarningOut]
    expected_collections: float
    upcoming_expenses: float


class ForecastScenarioIn(CamelModel):
    payer_id: Optional[str] = None
    extra_delay_days: int = Field(default=0, ge=0)
    rejection_pct: float = Field(default=0, ge=0, le=100)
    bill_to_defer_id: Optional[str] = None
    deferral_days: int = Field(default=0, ge=0)


class GapActionOut(CamelModel):
    id: str
    title: str
    estimated_amount: float
    impact: str
    effort: Literal["low", "medium", "high"]
    explanation: str


class AlertOut(CamelModel):
    id: str
    severity: Literal["critical", "warning", "info"]
    type: str
    message: str
    created_at: str

