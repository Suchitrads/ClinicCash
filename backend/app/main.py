from fastapi import FastAPI, HTTPException
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.routers import health
from app.db import init_db
from app.routers import admin, alerts, auth, bills, clinic_settings, dashboard, forecast, gap_closer, invoices, payment_plans, reminders, reports
app = FastAPI(title="ClinicCash API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.exception_handler(HTTPException)
async def http_error(request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc.detail),
                 "error": {"code": f"http_{exc.status_code}", "message": str(exc.detail)}},
    )
@app.exception_handler(RequestValidationError)
async def validation_error(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "validation_error", "message": "Invalid request",
                           "details": jsonable_encoder(exc.errors())}},
    )
@app.get("/")
def root():
    return {
        "name": "ClinicCash API",
        "status": "online",
        "health": "/health",
        "docs": "/docs",
        "api_prefix": settings.api_prefix,
    }


app.include_router(health.router)
init_db()

routers_to_mount = [
    admin.router,
    invoices.router,
    dashboard.router,
    payment_plans.router,
    reminders.router,
    auth.router,
    bills.router,
    clinic_settings.router,
    forecast.router,
    gap_closer.router,
    alerts.router,
    reports.router,
]

for r in routers_to_mount:
    # Mount at /api/v1 (standard)
    app.include_router(r, prefix=settings.api_prefix)
    # Also mount at root so requests missing /api/v1 never 404
    app.include_router(r)