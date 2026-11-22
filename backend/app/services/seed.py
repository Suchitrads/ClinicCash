from datetime import date, timedelta

from sqlmodel import Session, delete

from app.config import settings
from app.models.entities import (Bill, ClinicSettings, Invoice, PaymentHistory, PaymentPlan,
                                 Payer, Reminder)

PAYERS = [
    ("INS-1", "Star Health TPA", "INSURER"),
    ("INS-2", "Care Plus TPA", "INSURER"),
    ("COR-1", "Infosoft Employee Plan", "CORPORATE"),
    ("COR-2", "BrightWorks Pvt Ltd", "CORPORATE"),
    ("PAT-1", "Meera S.", "PATIENT"),
    ("PAT-2", "Arjun P.", "PATIENT"),
    ("PAT-3", "Kavya R.", "PATIENT"),
    ("PAT-4", "Rohan D.", "PATIENT"),
    ("PAT-5", "Sana M.", "PATIENT"),
    ("PAT-6", "Nila V.", "PATIENT"),
]

# id, payer, label, amount, due offset in days from today (negative = overdue), claim stage
INVOICES = [
    ("INV-001", "INS-1", "Claim batch", 68000, -8, "QUERY_RAISED"),
    ("INV-002", "INS-2", "Claim batch", 42000, 5, "SUBMITTED"),
    ("INV-003", "COR-1", "Monthly billing", 36000, -10, None),
    ("INV-004", "COR-2", "Monthly billing", 24000, 10, None),
    ("INV-005", "PAT-1", "Braces, installment 3 of 6", 8000, -6, None),
    ("INV-006", "PAT-2", "Implant, installment 2 of 4", 15000, -3, None),
    ("INV-007", "PAT-3", "Aligners, installment 5 of 10", 6000, 4, None),
    ("INV-008", "PAT-4", "Root canal balance", 4500, -14, None),
    ("INV-009", "PAT-5", "Crown, installment 1 of 3", 9000, 12, None),
    ("INV-010", "PAT-6", "Whitening balance", 3000, -21, None),
]

# id, name, amount, first due offset, repeat days, deferrable, defer days
BILLS = [
    ("BILL-1", "Rent", 45000, 7, 30, False, 0),
    ("BILL-2", "Staff salaries", 110000, 9, 30, False, 0),
    ("BILL-3", "Dental lab", 28000, 12, 30, True, 7),
    ("BILL-4", "Consumables", 18000, 15, 30, True, 7),
    ("BILL-5", "Equipment EMI", 12000, 20, 30, False, 0),
]

# Past payment delays (days after due date), 6 payments per payer.
HISTORY_DELAYS = {
    "INS-1": [30, 36, 41, 33, 45, 38],
    "INS-2": [28, 31, 34, 30, 35, 32],
    "COR-1": [18, 22, 25, 20, 28, 24],
    "COR-2": [10, 12, 9, 14, 11, 13],
    "PAT-1": [2, 4, 0, 6, 3, 8],
    "PAT-2": [5, 7, 3, 9, 6, 4],
    "PAT-3": [0, 1, 0, 2, 1, 0],
    "PAT-4": [10, 14, 12, 9, 15, 11],
    "PAT-5": [3, 5, 2, 4, 6, 3],
    "PAT-6": [15, 20, 18, 22, 17, 19],
}
HISTORY_AMOUNT = {"INSURER": 40000, "CORPORATE": 30000, "PATIENT": 6000}


def demo_today() -> date:
    return date.fromisoformat(settings.demo_today)


def reset_and_seed(session: Session) -> dict:
    today = demo_today()
    for model in (Reminder, PaymentPlan, PaymentHistory, Invoice, Bill, Payer, ClinicSettings):
        session.exec(delete(model))
    session.commit()

    payer_type = {}
    for pid, name, ptype in PAYERS:
        session.add(Payer(id=pid, name=name, type=ptype))
        payer_type[pid] = ptype

    patient_map = {
        "INV-001": "Ravi Kumar", "INV-002": "Asha Menon", "INV-003": "Vikram Seth",
        "INV-004": "Sunita Rao", "INV-005": "Meera S.", "INV-006": "Arjun P.",
        "INV-007": "Kavya R.", "INV-008": "Rohan D.", "INV-009": "Sana M.", "INV-010": "Nila V."
    }

    for iid, pid, label, amount, offset, stage in INVOICES:
        due = today + timedelta(days=offset)
        session.add(Invoice(id=iid, payer_id=pid, patient_name=patient_map.get(iid), item_label=label, amount=amount,
                            due_date=due, claim_stage=stage,
                            created_at=due - timedelta(days=30)))

    history_rows = 0
    for pid, delays in HISTORY_DELAYS.items():
        for i, delay in enumerate(delays):
            due = today - timedelta(days=50 + 30 * i)
            session.add(PaymentHistory(payer_id=pid, amount=HISTORY_AMOUNT[payer_type[pid]],
                                       due_date=due, paid_date=due + timedelta(days=delay)))
            history_rows += 1

    for bid, name, amount, offset, repeat, deferrable, defer_days in BILLS:
        session.add(Bill(id=bid, name=name, amount=amount,
                         first_due_date=today + timedelta(days=offset),
                         repeats_every_days=repeat, is_deferrable=deferrable,
                         defer_days=defer_days))

    session.add(ClinicSettings(id=1, opening_cash=90000, weekly_walk_in_collections=30000,
                               safety_buffer=45000, due_soon_days=3, chase_threshold_days=7,
                               final_notice_days=21, earliest_expected_payment_days=3,
                               timezone="Asia/Kolkata", demo_today=today))
    session.commit()
    return {"payers": len(PAYERS), "invoices": len(INVOICES),
            "payment_history": history_rows, "bills": len(BILLS)}


def seed_if_empty(session: Session) -> bool:
    """Seeds default clinic settings and sample data if ClinicSettings table is empty."""
    from sqlmodel import select
    if session.exec(select(ClinicSettings)).first() is not None:
        return False
    reset_and_seed(session)
    return True