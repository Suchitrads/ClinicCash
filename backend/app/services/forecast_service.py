from collections import defaultdict
from typing import Optional

from sqlmodel import Session, select

from app.models.entities import Bill, ClinicSettings, Invoice, Payer, PaymentHistory
from app.services.forecast_engine import BillIn, InvoiceIn, Scenario, compute_delay, forecast

ESTIMATE_NOTE = "Estimate based on entered data and past payment behaviour."


def build_forecast(session: Session, horizon_days: int = 90, scenario: Optional[Scenario] = None) -> dict:
    s = session.get(ClinicSettings, 1)
    today = s.demo_today

    payers = session.exec(select(Payer)).all()
    history = defaultdict(list)
    for h in session.exec(select(PaymentHistory)).all():
        history[h.payer_id].append((h.paid_date - h.due_date).days)

    delays = {p.id: compute_delay(p.type, history[p.id]) for p in payers}
    payer_type = {p.id: p.type for p in payers}

    unpaid = session.exec(select(Invoice).where(Invoice.paid_at == None)).all()  # noqa: E711
    invoices = [
        InvoiceIn(id=i.id, payer_id=i.payer_id, payer_type=payer_type[i.payer_id],
                  amount=i.amount, due_date=i.due_date, promise_date=i.promise_to_pay_date)
        for i in unpaid
    ]
    bills = [
        BillIn(id=b.id, name=b.name, amount=b.amount, first_due_date=b.first_due_date,
               repeats_every_days=b.repeats_every_days, is_deferrable=b.is_deferrable,
               defer_days=b.defer_days)
        for b in session.exec(select(Bill)).all()
    ]

    result = forecast(
        today=today, invoices=invoices, bills=bills, delays=delays,
        opening_cash=s.opening_cash, weekly_walk_in=s.weekly_walk_in_collections,
        safety_buffer=s.safety_buffer, earliest_days=s.earliest_expected_payment_days,
        scenario=scenario, horizon=horizon_days,
    )

    pts, summ = result["points"], result["summary"]
    delta = {
        "lowest_balance_change": round(summ["what_if"]["lowest_balance"] - summ["likely"]["lowest_balance"], 2),
        "end_balance_change": round(pts[-1]["what_if_balance"] - pts[-1]["likely_balance"], 2),
    }

    sc = scenario or Scenario()
    return {
        "as_of": today.isoformat(),
        "horizon_days": horizon_days,
        "points": pts,
        "summary": summ,
        "delta": delta,
        "scenario": {
            "scenario_payer_id": sc.payer_id, "late_days": sc.late_days,
            "insurer_rejection_pct": sc.insurer_rejection_pct,
            "defer_bill_id": sc.defer_bill_id, "defer_days": sc.defer_days,
        },
        "payer_delays": [
            {"payer_id": p.id, "payer_name": p.name, "payer_type": p.type,
             "avg_delay_days": delays[p.id].avg, "p80_delay_days": delays[p.id].p80,
             "delay_source": "learned" if delays[p.id].learned else "assumed_default"}
            for p in payers
        ],
        "assumptions": [
            "Walk-in collections are spread evenly across the days of the week.",
            "Payers with fewer than 3 past payments use type-level default delays (marked assumed_default).",
            "An open promise-to-pay date replaces the expected payment date.",
        ],
        "note": ESTIMATE_NOTE,
    }