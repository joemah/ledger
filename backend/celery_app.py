"""Celery application instance and beat schedule for async/scheduled tasks."""
import os
from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery = Celery(
    "proinvoice",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["tasks"],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
)

celery.conf.beat_schedule = {
    # Mark sent invoices past their due_date as overdue + apply late fees
    "check-overdue-invoices": {
        "task": "tasks.check_overdue_invoices",
        "schedule": crontab(hour=6, minute=0),
    },
    # Generate new invoices from recurring templates whose next_invoice_date is due
    "generate-recurring-invoices": {
        "task": "tasks.generate_recurring_invoices",
        "schedule": crontab(hour=7, minute=0),
    },
    # Send reminder emails for overdue invoices (3-day cadence)
    "send-overdue-reminders": {
        "task": "tasks.send_overdue_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
}