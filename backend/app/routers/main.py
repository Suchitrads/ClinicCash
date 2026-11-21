"""Re-export app from app.main so both app.main:app and app.routers.main:app work identically."""
from app.main import app  # noqa: F401
