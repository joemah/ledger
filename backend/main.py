"""ProInvoice API — application entry point.

Thin app that registers routers and middleware. All business logic lives
in the service layer (services/) and all endpoints live in routers/.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import engine, Base, SessionLocal
from config import settings
from routers import auth, companies, clients, invoices, payments, files, email_router, tasks, expenses, time_entries, item_templates, assistant

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="ProInvoice API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)


def seed_item_templates():
    """Pre-load creative consultancy line-item templates on first run."""
    from models import ItemTemplate

    defaults = [
        {
            "name": "Monthly Retainer",
            "items": [
                {"description": "Strategic advisory (monthly retainer)", "quantity": 1, "unit_price": 5000},
                {"description": "Priority email & phone support", "quantity": 1, "unit_price": 1500},
                {"description": "Monthly progress review meeting", "quantity": 1, "unit_price": 500},
            ],
        },
        {
            "name": "Discovery & Audit",
            "items": [
                {"description": "Discovery workshop (half-day)", "quantity": 1, "unit_price": 1200},
                {"description": "Stakeholder interviews", "quantity": 4, "unit_price": 250},
                {"description": "Current-state audit & report", "quantity": 1, "unit_price": 2000},
                {"description": "Findings presentation", "quantity": 1, "unit_price": 800},
            ],
        },
        {
            "name": "Implementation Sprint",
            "items": [
                {"description": "Solution architecture design", "quantity": 1, "unit_price": 2500},
                {"description": "Development sprint (2 weeks)", "quantity": 1, "unit_price": 6000},
                {"description": "QA & testing", "quantity": 1, "unit_price": 1200},
                {"description": "Deployment & handover", "quantity": 1, "unit_price": 800},
            ],
        },
        {
            "name": "Strategy Workshop",
            "items": [
                {"description": "Facilitated strategy workshop (full day)", "quantity": 1, "unit_price": 3000},
                {"description": "Pre-read preparation", "quantity": 1, "unit_price": 600},
                {"description": "Strategy summary & roadmap", "quantity": 1, "unit_price": 1200},
            ],
        },
        {
            "name": "Technical Assessment",
            "items": [
                {"description": "Architecture review", "quantity": 1, "unit_price": 1800},
                {"description": "Code quality audit", "quantity": 1, "unit_price": 1500},
                {"description": "Security & compliance check", "quantity": 1, "unit_price": 1200},
                {"description": "Recommendations report", "quantity": 1, "unit_price": 900},
            ],
        },
        {
            "name": "Ongoing Support (Hourly)",
            "items": [
                {"description": "Senior consultant (per hour)", "quantity": 1, "unit_price": 180},
                {"description": "Associate consultant (per hour)", "quantity": 1, "unit_price": 120},
            ],
        },
    ]

    db = SessionLocal()
    try:
        if db.query(ItemTemplate).count() == 0:
            db.add_all([ItemTemplate(name=d["name"], items=d["items"]) for d in defaults])
            db.commit()
    finally:
        db.close()


seed_item_templates()

app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# ─── Register routers ─────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(clients.router)
app.include_router(invoices.router)
app.include_router(payments.router)
app.include_router(files.router)
app.include_router(email_router.router)
app.include_router(tasks.router)
app.include_router(expenses.router)
app.include_router(time_entries.router)
app.include_router(item_templates.router)
app.include_router(assistant.router)