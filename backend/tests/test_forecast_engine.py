from datetime import date, timedelta

from app.services.forecast_engine import (
    BillIn, InvoiceIn, PayerDelay, Scenario, compute_delay, expected_date, forecast,
)

TODAY = date(2026, 11, 21)


def d(n: int) -> date:
    return TODAY + timedelta(days=n)


def run(invoices=(), bills=(), delays=None, opening=1000, weekly=0, scenario=None):
    return forecast(today=TODAY, invoices=list(invoices), bills=list(bills),
                    delays=delays or {}, opening_cash=opening, weekly_walk_in=weekly,
                    safety_buffer=500, earliest_days=3, scenario=scenario)["points"]


def test_delay_learned():
    r = compute_delay("INSURER", [10, 20, 30, 40, 50])
    assert r.learned is True and r.avg == 30.0 and r.p80 == 40.0


def test_delay_fallback_is_marked_as_assumption():
    r = compute_delay("INSURER", [5, 6])
    assert r.learned is False and (r.avg, r.p80) == (35.0, 45.0)


def test_expected_date_adds_delay():
    assert expected_date(d(-8), 35, TODAY, 3) == d(27)


def test_expected_date_floor_for_overdue():
    assert expected_date(d(-30), 5, TODAY, 3) == d(3)


def test_open_promise_overrides():
    assert expected_date(d(-8), 35, TODAY, 3, promise=d(2)) == d(2)


def test_broken_promise_adds_seven_days():
    assert expected_date(d(-8), 10, TODAY, 3, promise=d(-1), broken_basis_days=45) == d(44)


def test_forecast_has_91_points():
    pts = run(weekly=700)
    assert len(pts) == 91
    assert pts[0]["date"] == "2026-11-21"
    assert pts[0]["likely_balance"] == 1100
    assert pts[90]["likely_balance"] == 10100


def test_bills_repeat_every_30_days():
    bill = BillIn("B1", "Rent", 500, d(7), 30)
    pts = run(bills=[bill], opening=10000)
    assert pts[6]["likely_balance"] == 10000
    assert pts[7]["likely_balance"] == 9500
    assert pts[37]["likely_balance"] == 9000
    assert pts[67]["likely_balance"] == 8500
    assert pts[90]["likely_balance"] == 8500


def test_insurer_rejection_only_in_what_if():
    inv = InvoiceIn("I1", "INS-1", "INSURER", 10000, d(10))
    pts = run([inv], delays={"INS-1": PayerDelay(0, 0, True)},
              scenario=Scenario(insurer_rejection_pct=10))
    assert pts[10]["likely_inflow"] == 10000
    assert pts[10]["what_if_inflow"] == 9000


def test_payer_late_shift():
    inv = InvoiceIn("I1", "PAT-1", "PATIENT", 1000, d(10))
    pts = run([inv], delays={"PAT-1": PayerDelay(0, 0, True)},
              scenario=Scenario(payer_id="PAT-1", late_days=5))
    assert pts[10]["likely_inflow"] == 1000 and pts[10]["what_if_inflow"] == 0
    assert pts[15]["what_if_inflow"] == 1000


def test_bill_deferral():
    bill = BillIn("B1", "Dental lab", 300, d(5), None, True, 7)
    pts = run(bills=[bill], scenario=Scenario(defer_bill_id="B1"))
    assert pts[5]["likely_balance"] == 700 and pts[5]["what_if_balance"] == 1000
    assert pts[12]["what_if_balance"] == 700


def test_cautious_is_later_than_likely():
    inv = InvoiceIn("I1", "INS-1", "INSURER", 5000, d(0))
    pts = run([inv], delays={"INS-1": PayerDelay(10, 40, True)})
    assert pts[10]["likely_inflow"] == 5000
    assert pts[40]["cautious_inflow"] == 5000