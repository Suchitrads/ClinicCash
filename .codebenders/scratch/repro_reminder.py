import os, sys, traceback
os.environ["DATABASE_URL"] = "sqlite:///./verify_tmp.db"
sys.path.insert(0, os.getcwd())
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app, raise_server_exceptions=True)
try:
    r = c.post("/api/v1/reminders/generate", json={"invoiceId": "INV-001", "tone": "friendly", "language": "en"})
    print("STATUS", r.status_code)
    print("BODY", r.text[:300])
except Exception:
    traceback.print_exc()
