"""Celery tasks — thin wrappers that delegate to the service layer.

Each task opens its own DB session (Celery workers run in a separate process),
calls the corresponding service function, and returns a summary dict.
"""
from celery_app import celery
from database import SessionLocal
from services.email_service import send_email
from services.overdue_service import check_overdue, send_reminders
from services.recurring_service import generate_recurring


@celery.task(name="tasks.send_invoice_email")
def send_invoice_email(invoice_id: str, to_email: str, subject: str, body: str):
    """Send an invoice email asynchronously through the Celery worker."""
    send_email(to_email, subject, html=body)
    return {"invoice_id": invoice_id, "sent_to": to_email}


@celery.task(name="tasks.check_overdue_invoices")
def check_overdue_invoices():
    """Mark sent invoices past their due_date as overdue and apply late fees."""
    db = SessionLocal()
    try:
        count = check_overdue(db)
        return {"overdue_marked": count}
    finally:
        db.close()


@celery.task(name="tasks.generate_recurring_invoices")
def generate_recurring_invoices():
    """Generate new invoices from recurring templates."""
    db = SessionLocal()
    try:
        count = generate_recurring(db)
        return {"recurring_generated": count}
    finally:
        db.close()


@celery.task(name="tasks.send_overdue_reminders")
def send_overdue_reminders():
    """Send reminder emails for overdue invoices."""
    db = SessionLocal()
    try:
        count = send_reminders(db)
        return {"reminders_sent": count}
    finally:
        db.close()