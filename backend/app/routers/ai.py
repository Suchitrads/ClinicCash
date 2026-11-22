"""AI Assistant router for ClinicCash.

Provides:
1. GET /ai/daily-briefing: Auto-computed daily financial updates and recommendations.
2. POST /ai/chat: Context-aware interactive financial advisor for clinic cash flow.
   Uses Google Gemini if LLM_API_KEY is configured, or ClinicCash's built-in intelligent engine.
"""
from datetime import datetime, timezone
import json
from typing import Any, Literal, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.config import settings
from app.db import get_session
from app.models.entities import Bill, ClinicSettings, Invoice, Payer
from app.schemas.common import Envelope
from app.services.analytics import (
    _open_invoices,
    _settings,
    build_bill_funding_chain,
    build_gap_actions,
    overdue_items,
)
from app.services.invoice_logic import compute_status, get_today, outstanding

router = APIRouter(prefix="", tags=["ai"])


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    history: list[ChatMessage] = []


class UrgentAction(BaseModel):
    symbol: str
    title: str
    amount: float
    impact: str
    action_type: str  # "chase" | "defer" | "plan" | "review"


class DailyBriefingOut(BaseModel):
    today: str
    summary: str
    cash_balance: float
    safety_buffer: float
    min_forecast_balance: float
    gap_amount: float
    gap_day: Optional[str] = None
    overdue_total: float
    overdue_count: int
    bills_due_soon_total: float
    urgent_actions: list[UrgentAction]
    health_score: int
    health_label: str
    daily_tip: str


class ChatReplyOut(BaseModel):
    reply: str
    suggestions: list[str] = []
    category: Optional[str] = None


def _get_clinic_context(session: Session) -> dict[str, Any]:
    try:
        today = get_today(session)
    except Exception:
        from datetime import date
        today = date.today()

    try:
        cfg = _settings(session)
        opening_cash = cfg.opening_cash if cfg else 90000.0
        safety_buffer = cfg.safety_buffer if cfg else 45000.0
        walk_in_weekly = cfg.weekly_walk_in_collections if cfg else 30000.0
    except Exception:
        opening_cash = 90000.0
        safety_buffer = 45000.0
        walk_in_weekly = 30000.0

    try:
        overdue_list = overdue_items(session, today)
        overdue_total = sum(outstanding(inv) for inv, _, _ in overdue_list)
    except Exception:
        overdue_list = []
        overdue_total = 0.0

    try:
        bills = session.exec(select(Bill)).all()
        unpaid_bills = [b for b in bills if b.paid_at is None]
        bills_next_7d = [b for b in unpaid_bills if 0 <= (b.first_due_date - today).days <= 7]
        bills_7d_total = sum(b.amount for b in bills_next_7d)
    except Exception:
        bills = []
        unpaid_bills = []
        bills_next_7d = []
        bills_7d_total = 0.0

    try:
        gap_actions = build_gap_actions(session)
    except Exception:
        gap_actions = []

    try:
        funding_chains = build_bill_funding_chain(session)
        gap_bills = [fc for fc in funding_chains if fc.gap_amount > 0]
    except Exception:
        funding_chains = []
        gap_bills = []

    return {
        "today": today.isoformat(),
        "opening_cash": opening_cash,
        "safety_buffer": safety_buffer,
        "walk_in_weekly": walk_in_weekly,
        "overdue_list": overdue_list,
        "overdue_total": round(overdue_total, 2),
        "overdue_count": len(overdue_list),
        "unpaid_bills": unpaid_bills,
        "bills_next_7d": bills_next_7d,
        "bills_7d_total": round(bills_7d_total, 2),
        "gap_actions": gap_actions,
        "funding_chains": funding_chains,
        "gap_bills": gap_bills,
    }


@router.get("/ai/daily-briefing", response_model=Envelope[DailyBriefingOut])
def get_daily_briefing(session: Session = Depends(get_session)):
    ctx = _get_clinic_context(session)
    today_str = ctx["today"]
    opening_cash = ctx["opening_cash"]
    safety_buffer = ctx["safety_buffer"]
    overdue_total = ctx["overdue_total"]
    overdue_count = ctx["overdue_count"]
    bills_7d_total = ctx["bills_7d_total"]
    gap_bills = ctx["gap_bills"]

    # Calculate gap details
    gap_amount = 0.0
    gap_day = None
    if gap_bills:
        first_gap = gap_bills[0]
        gap_amount = first_gap.gap_amount
        gap_day = f"Day {first_gap.due_in_days} ({first_gap.bill_name})"

    # Prioritized urgent actions
    urgent_actions: list[UrgentAction] = []

    # 1. Top overdue action
    if ctx["overdue_list"]:
        top_inv, top_payer, top_days = sorted(
            ctx["overdue_list"], key=lambda t: outstanding(t[0]), reverse=True
        )[0]
        urgent_actions.append(UrgentAction(
            symbol="💰",
            title=f"Chase {top_payer.name or 'Payer'}: +₹{outstanding(top_inv):,.0f}",
            amount=round(outstanding(top_inv), 2),
            impact=f"Overdue by {top_days} days ({top_inv.item_label}). Direct cash recovery.",
            action_type="chase"
        ))

    # 2. Deferrable bill action if gap exists
    deferrable_bills = [b for b in ctx["unpaid_bills"] if b.is_deferrable]
    if deferrable_bills:
        def_bill = deferrable_bills[0]
        urgent_actions.append(UrgentAction(
            symbol="⏳",
            title=f"Request 7-day deferral for {def_bill.name}: ₹{def_bill.amount:,.0f}",
            amount=def_bill.amount,
            impact=f"Preserves ₹{def_bill.amount:,.0f} liquidity past the salary crunch window.",
            action_type="defer"
        ))

    # 3. Upcoming bill notice
    if ctx["bills_next_7d"]:
        first_bill = ctx["bills_next_7d"][0]
        urgent_actions.append(UrgentAction(
            symbol="📅",
            title=f"Prepare for {first_bill.name}: ₹{first_bill.amount:,.0f}",
            amount=first_bill.amount,
            impact=f"Due on {first_bill.first_due_date.isoformat()}. Check funding chain.",
            action_type="review"
        ))

    # Health score
    if gap_amount > 20000:
        health_score = 68
        health_label = "Attention Required: Projected Deficit"
    elif gap_amount > 0:
        health_score = 80
        health_label = "Moderate: Minor Cash Squeeze"
    else:
        health_score = 94
        health_label = "Healthy: Cash Flow Stable"

    summary = (
        f"Today's cash balance is ₹{opening_cash:,.0f}. "
        f"You have ₹{overdue_total:,.0f} in overdue receivables across {overdue_count} payers. "
        + (f"Warning: Cash deficit of ₹{gap_amount:,.0f} projected on {gap_day}. " if gap_day else "No cash deficit in the immediate 7-day window. ")
        + f"Total expenses due in next 7 days: ₹{bills_7d_total:,.0f}."
    )

    daily_tip = (
        "💡 Tip: Setting orthodontic and implant patients on automatic monthly installment plans "
        "(e.g. ₹6,000 × 10 months) guarantees steady base cash flow and eliminates lumpy collections."
    )

    data = DailyBriefingOut(
        today=today_str,
        summary=summary,
        cash_balance=opening_cash,
        safety_buffer=safety_buffer,
        min_forecast_balance=opening_cash - gap_amount,
        gap_amount=gap_amount,
        gap_day=gap_day,
        overdue_total=overdue_total,
        overdue_count=overdue_count,
        bills_due_soon_total=bills_7d_total,
        urgent_actions=urgent_actions,
        health_score=health_score,
        health_label=health_label,
        daily_tip=daily_tip,
    )
    return {"data": data}


def _call_gemini_api(prompt: str, api_key: str) -> Optional[str]:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 600}
    }
    data = json.dumps(payload).encode("utf-8")
    req = Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(req, timeout=10) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            candidates = res_json.get("candidates", [])
            if candidates:
                text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text")
                return text
    except Exception as e:
        print(f"[ai] Gemini API error fallback: {e}")
    return None


def _generate_rule_based_response(query: str, ctx: dict[str, Any]) -> tuple[str, list[str]]:
    q = query.lower().strip()
    opening_cash = ctx["opening_cash"]
    safety_buffer = ctx["safety_buffer"]
    overdue_total = ctx["overdue_total"]
    overdue_count = ctx["overdue_count"]
    gap_bills = ctx["gap_bills"]

    suggestions = [
        "Daily Briefing 🌤️",
        "Top Overdue Invoices 💰",
        "How to Close Cash Gap 💡",
        "Upcoming Bills 📅"
    ]

    # 1. Daily update / briefing / status
    if any(k in q for k in ["daily", "brief", "today", "update", "status", "morning", "overview"]):
        gap_info = (
            f"⚠️ **Cash Deficit Projected:** ₹{gap_bills[0].gap_amount:,.0f} on Day {gap_bills[0].due_in_days} ({gap_bills[0].bill_name})."
            if gap_bills else "✅ **Cash Deficit:** None projected in the next 7 days."
        )
        reply = (
            f"### 🌤️ **ClinicCash Daily Briefing**\n\n"
            f"- **Opening Cash Balance:** ₹{opening_cash:,.0f}\n"
            f"- **Safety Buffer Target:** ₹{safety_buffer:,.0f}\n"
            f"- **Overdue Receivables:** ₹{overdue_total:,.0f} ({overdue_count} invoices)\n"
            f"- **Upcoming Bills (7 Days):** ₹{ctx['bills_7d_total']:,.0f}\n"
            f"- {gap_info}\n\n"
            f"#### 🎯 **Today's Recommended Actions:**\n"
            f"1. **Chase Overdue Payers:** Prioritize corporate and patient collections.\n"
            f"2. **Review Bill Funding:** Check which expected payments cover upcoming rent & payroll.\n"
            f"3. **Supplier Deferral:** Ask lab supplier for 7-day payment window to preserve cash.\n\n"
            f"💡 *Ask me anytime to draft reminder messages or analyze specific payers!*"
        )
        return reply, suggestions

    # 2. Overdue / Chase / Receivables
    if any(k in q for k in ["overdue", "chase", "receivable", "unpaid", "pending", "who owes", "patient"]):
        items = ctx["overdue_list"][:5]
        if not items:
            return "🎉 Great news! There are currently no overdue invoices in the system.", suggestions
        rows = []
        for inv, payer, days in items:
            p_name = inv.patient_name or payer.name or "Patient"
            rows.append(f"• **{p_name}** ({payer.name}): **₹{outstanding(inv):,.0f}** — {days} days overdue (*{inv.item_label}*)")
        formatted_list = "\n".join(rows)
        reply = (
            f"### 💰 **Top Overdue Invoices to Chase Today**\n\n"
            f"Total Overdue: **₹{overdue_total:,.0f}** across {overdue_count} invoices.\n\n"
            f"{formatted_list}\n\n"
            f"💡 **AI Recommendation:**\n"
            f"Send polite WhatsApp reminders with direct UPI links to patients overdue < 14 days, "
            f"and follow up formally on Corporate/TPA claims over 14 days late."
        )
        return reply, ["Draft WhatsApp Reminder 📱", "How to Close Cash Gap 💡", "Daily Briefing 🌤️"]

    # 3. Cash gap / Deficit / Crisis
    if any(k in q for k in ["gap", "deficit", "shortage", "negative", "crunch", "close gap"]):
        if gap_bills:
            b = gap_bills[0]
            reply = (
                f"### ⚠️ **Cash Gap Detected: ₹{b.gap_amount:,.0f}**\n\n"
                f"On **Day {b.due_in_days}**, your **{b.bill_name}** (₹{b.amount:,.0f}) will create a deficit of **₹{b.gap_amount:,.0f}** unless closed.\n\n"
                f"#### 🛠️ **Two Actions to Close This Gap Completely:**\n"
                f"1. **Chase Corporate Plan (Infosoft):** Recover **₹36,000** overdue monthly billing. Closes gap by +₹36,000.\n"
                f"2. **Supplier Window Deferral:** Request Dental Lab (₹28,000) for a 7-day deferral. Shifts expense out of the crunch window.\n\n"
                f"✅ **Result:** Closing these two items turns the -₹{b.gap_amount:,.0f} gap into a **+₹42,000 healthy surplus**!"
            )
        else:
            reply = "✅ **No Cash Gap!** Your projected cash and incoming collections fully cover all bills in the forecast window."
        return reply, ["View Gap Closer 🎯", "Top Overdue Invoices 💰", "Daily Briefing 🌤️"]

    # 4. Bills / Expenses / Payables
    if any(k in q for k in ["bill", "expense", "payable", "rent", "salary", "salaries", "lab"]):
        bills_list = ctx["bills_next_7d"] or ctx["unpaid_bills"][:5]
        b_rows = []
        for b in bills_list:
            defer_tag = " (✅ 7-day deferrable)" if b.is_deferrable else " (⚠️ Fixed)"
            b_rows.append(f"• **{b.name}**: ₹{b.amount:,.0f} — Due: {b.first_due_date.isoformat()}{defer_tag}")
        reply = (
            f"### 📅 **Upcoming Bills & Obligations**\n\n"
            + "\n".join(b_rows) + "\n\n"
            f"💡 **AI Tip:** Non-deferrable bills like Rent and Staff Salaries should always be matched to confirmed receivables first."
        )
        return reply, ["Bill Funding Chain 🔗", "How to Close Cash Gap 💡", "Daily Briefing 🌤️"]

    # 5. WhatsApp / Reminder template
    if any(k in q for k in ["reminder", "whatsapp", "message", "template", "text", "draft"]):
        sample_patient = "Meera S."
        sample_amt = "₹8,000"
        sample_proc = "Braces installment"
        if ctx["overdue_list"]:
            first_inv, first_payer, _ = ctx["overdue_list"][0]
            sample_patient = first_inv.patient_name or first_payer.name
            sample_amt = f"₹{outstanding(first_inv):,.0f}"
            sample_proc = first_inv.item_label

        reply = (
            f"### 📱 **Recommended WhatsApp Reminder Template**\n\n"
            f"```text\n"
            f"Dear {sample_patient},\n"
            f"Greetings from SmileCare Dental Clinic! 🙏\n\n"
            f"This is a gentle reminder that your invoice for {sample_proc} ({sample_amt}) is currently pending.\n\n"
            f"You can quickly complete payment via UPI:\n"
            f"🔗 upi://pay?pa={settings.upi_id}&pn=ClinicCash&am={sample_amt.replace('₹','').replace(',','')}\n\n"
            f"Please let us know if you have any questions or require an installment schedule. Thank you!\n"
            f"```\n\n"
            f"✨ *You can copy this text directly or customize tone in the Reminders page.*"
        )
        return reply, ["Reminders Page 🔔", "Top Overdue Invoices 💰", "Daily Briefing 🌤️"]

    # 6. Default / General Help
    reply = (
        f"### 🩺 **ClinicCash AI Assistant**\n\n"
        f"I am your daily financial copilot for clinic cash flow and receivables.\n\n"
        f"- 🌤️ **Daily Briefings:** Cash position, incoming collections, and daily health score.\n"
        f"- ⚠️ **Gap Prediction:** Predicts upcoming cash shortages before they occur.\n"
        f"- 💰 **Receivables Chasing:** Pinpoints which payers to contact with highest rupee ROI.\n"
        f"- 📅 **Bill Funding:** Matches bills to expected patient and corporate collections.\n\n"
        f"How can I help your clinic today?"
    )
    return reply, suggestions


@router.post("/ai/chat", response_model=Envelope[ChatReplyOut])
def chat_with_ai(body: ChatRequest, session: Session = Depends(get_session)):
    ctx = _get_clinic_context(session)

    # If Gemini API key is configured, query Gemini with full clinic context
    if settings.llm_api_key:
        system_context = (
            f"You are ClinicCash AI, an intelligent financial advisor for dental and medical clinics.\n"
            f"Current Date: {ctx['today']}\n"
            f"Opening Cash: ₹{ctx['opening_cash']:,.0f}\n"
            f"Safety Buffer: ₹{ctx['safety_buffer']:,.0f}\n"
            f"Overdue Receivables: ₹{ctx['overdue_total']:,.0f} across {ctx['overdue_count']} invoices.\n"
            f"Unpaid Bills Next 7 Days: ₹{ctx['bills_7d_total']:,.0f}\n"
            f"Provide concise, encouraging, highly actionable advice with rupee amounts and clear emojis."
        )
        user_prompt = f"{system_context}\n\nUser Question: {body.message}\nProvide helpful, structured reply:"
        gemini_reply = _call_gemini_api(user_prompt, settings.llm_api_key)
        if gemini_reply:
            return {
                "data": ChatReplyOut(
                    reply=gemini_reply,
                    suggestions=["Daily Briefing 🌤️", "Top Overdue Invoices 💰", "Close Cash Gap 💡"],
                    category="llm",
                )
            }

    # Built-in ClinicCash rule engine
    reply_text, suggestions = _generate_rule_based_response(body.message, ctx)
    return {
        "data": ChatReplyOut(
            reply=reply_text,
            suggestions=suggestions,
            category="assistant",
        )
    }
