import json, urllib.request, urllib.error, secrets

BASE = "http://127.0.0.1:8001"
API = "/api/v1"
ORIGIN = {"Origin": "http://localhost:5173"}
rows = []

def req(method, path, body=None, token=None, expect=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = dict(ORIGIN)
    if data is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    r = urllib.request.Request(BASE + API + path, data=data, method=method, headers=headers)
    try:
        resp = urllib.request.urlopen(r, timeout=20)
        status, raw = resp.status, resp.read()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read()
    text = raw.decode("utf-8", "replace")
    try:
        parsed = json.loads(text)
    except Exception:
        parsed = None
    ok = (200 <= status < 300) if expect is None else status == expect
    rows.append((method, path, status, expect, ok, text.replace("\n", " ")[:150]))
    return status, parsed

def data_of(parsed):
    return parsed.get("data") if isinstance(parsed, dict) else None

def find_token(parsed):
    if not isinstance(parsed, dict):
        return None
    d = parsed.get("data") if isinstance(parsed.get("data"), dict) else parsed
    for k in ("token", "accessToken", "access_token"):
        if isinstance(d, dict) and isinstance(d.get(k), str):
            return d[k]
    return None

def first_id(parsed):
    d = data_of(parsed)
    if isinstance(d, list) and d and isinstance(d[0], dict):
        return d[0].get("id")
    return None

email = "verify-" + secrets.token_hex(4) + "@example.com"
creds = {"name": "Verify", "email": email, "password": "password123"}
req("POST", "/seed/reset")
req("POST", "/auth/signup", creds)
_, sp = req("POST", "/auth/signin", {"email": email, "password": "password123"})
token = find_token(sp)
print("TOKEN_FOUND=", token is not None)
req("GET", "/auth/me", token=token)
req("POST", "/auth/plan", {"plan": "pro"}, token=token)
req("GET", "/dashboard/summary")
_, inv = req("GET", "/invoices")
fid = first_id(inv)
print("FIRST_INVOICE_ID=", fid)
req("GET", "/invoices?search=a&sortBy=amount&sortDir=desc")
req("GET", "/invoices/" + str(fid))
_, created = req("POST", "/invoices", {
    "payer": {"id": "INS-1", "name": "Star Health TPA"},
    "itemLabel": "Verify item", "amount": 1000, "paidAmount": 0,
    "dueDate": "2026-12-01", "claimStage": "Billed"})
nid = (data_of(created) or {}).get("id") if isinstance(data_of(created), dict) else None
print("NEW_INVOICE_ID=", nid)
if nid:
    req("PUT", "/invoices/" + nid, {"amount": 1200})
    req("POST", "/invoices/" + nid + "/payments", {"amount": 100, "method": "upi"})
    req("POST", "/invoices/" + nid + "/promise-to-pay", {"promiseDate": "2026-12-10"})
    req("POST", "/invoices/" + nid + "/mark-paid")
    req("POST", "/invoices/" + nid + "/payment-plans", {"installmentAmount": 200, "frequency": "monthly", "startDate": "2026-12-15"})
req("GET", "/payment-plans")
req("POST", "/reminders/generate", {"invoiceId": str(fid), "tone": "friendly", "language": "en"})
req("GET", "/reminders")
req("GET", "/bills")
_, bc = req("POST", "/bills", {"name": "Verify Bill", "amount": 500, "dueDate": "2026-12-05", "recurrence": "monthly", "deferrable": True, "status": "due"})
bid = (data_of(bc) or {}).get("id") if isinstance(data_of(bc), dict) else None
print("NEW_BILL_ID=", bid)
if bid:
    req("PUT", "/bills/" + bid, {"amount": 550})
req("GET", "/settings")
req("PUT", "/settings", {"dueSoonDays": 5})
req("GET", "/forecast?horizon=30")
req("GET", "/forecast?horizon=5", expect=422)
req("POST", "/forecast/scenario", {"extraDelayDays": 3, "rejectionPct": 5, "billToDeferId": bid, "deferralDays": 7})
_, acts = req("GET", "/gap-closer/actions")
aid = first_id(acts)
print("FIRST_ACTION_ID=", aid)
if aid:
    req("POST", "/gap-closer/actions/" + aid + "/execute")
req("GET", "/alerts")
req("GET", "/reports/collections")
req("GET", "/reports/collections?format=csv")
req("GET", "/reports/outstanding")
req("GET", "/reports/delays")
req("GET", "/reports/payer-reliability")
req("GET", "/reports/monthly-cashflow")
req("GET", "/reports/unknown", expect=404)
if nid:
    req("DELETE", "/invoices/" + nid)
req("GET", "/invoices/does-not-exist", expect=404)

print()
print("| # | Method | Path | Status | Expected | PASS/FAIL | Body (first 150) |")
print("|---|---|---|---|---|---|---|")
for i, (m, p, s, e, ok, snip) in enumerate(rows, 1):
    print("| %d | %s | %s | %s | %s | %s | %s |" % (i, m, p, s, e or "2xx", "PASS" if ok else "FAIL", snip))
print("TOTAL=%d PASS=%d FAIL=%d" % (len(rows), sum(1 for r in rows if r[4]), sum(1 for r in rows if not r[4])))
