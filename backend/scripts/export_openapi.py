import json
from pathlib import Path
from app.main import app
out = Path(__file__).resolve().parents[2] / "contracts" / "openapi.json"
out.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
print(f"Wrote {out}")
