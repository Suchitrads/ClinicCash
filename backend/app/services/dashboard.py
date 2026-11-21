from sqlmodel import Session, select

from app.models.entities import ClinicSettings, Invoice, Payer

BUCKET_ORDER = ["NOT_DUE", "1_30", "31_60", "60_PLUS"]


def aging_bucket(days_overdue: int) -> str:
    if days_overdue <= 0:
        return "NOT_DUE"
    if days_overdue <= 30:
        return "1_30"
    if days_overdue <= 60:
        return "31_60"
    return "60_PLUS"


def next_action(days_overdue: int, days_to_due: int, s: ClinicSettings) -> str:
    if days_overdue >= s.final_notice_days:
        return "SEND_FINAL_NOTICE"
    if days_overdue >= s.chase_threshold_days:
        return "CHASE_TODAY"
    if days_overdue > 0:
        return "SEND_REMINDER"
    if days_to_due <= s.due_soon_days:
        return "SEND_FRIENDLY_NUDGE"
    return "NONE"


def build_dashboard(session: Session) -> dict:
    s = session.get(ClinicSettings, 1)
    today = s.demo_today

    rows = session.exec(
        select(Invoice, Payer)
        .join(Payer, Invoice.payer_id == Payer.id)
        .where(Invoice.paid_at == None)  # noqa: E711
    ).all()

    items = []
    for inv, payer in rows:
        days_overdue = max(0, (today - inv.due_date).days)
        days_to_due = (inv.due_date - today).days
        items.append({
            "invoice_id": inv.id,
            "payer_name": payer.name,
            "payer_type": payer.type,
            "item_label": inv.item_label,
            "amount": inv.amount,
            "due_date": inv.due_date.isoformat(),
            "days_overdue": days_overdue,
            "aging_bucket": aging_bucket(days_overdue),
            "priority": round(inv.amount * days_overdue, 2),
            "next_action": next_action(days_overdue, days_to_due, s),
        })

    outstanding = sum(i["amount"] for i in items)
    overdue_items = [i for i in items if i["days_overdue"] > 0]
    overdue_total = sum(i["amount"] for i in overdue_items)

    buckets = []
    for name in BUCKET_ORDER:
        in_bucket = [i for i in items if i["aging_bucket"] == name]
        buckets.append({
            "bucket": name,
            "count": len(in_bucket),
            "amount": sum(i["amount"] for i in in_bucket),
        })

    top_actions = sorted(overdue_items, key=lambda i: i["priority"], reverse=True)[:5]

    return {
        "as_of": today.isoformat(),
        "outstanding_total": outstanding,
        "overdue_total": overdue_total,
        "overdue_count": len(overdue_items),
        "overdue_share_pct": round(100 * overdue_total / outstanding, 1) if outstanding else 0,
        "aging_buckets": buckets,
        "top_actions": top_actions,
    }