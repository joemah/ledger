"""Celery task trigger routes + health check."""
from fastapi import APIRouter

from tasks import check_overdue_invoices, generate_recurring_invoices, send_overdue_reminders

router = APIRouter(prefix="/api", tags=["tasks"])


@router.post("/tasks/check-overdue")
def trigger_check_overdue():
    task = check_overdue_invoices.delay()
    return {"task_id": task.id, "status": "queued"}


@router.post("/tasks/generate-recurring")
def trigger_generate_recurring():
    task = generate_recurring_invoices.delay()
    return {"task_id": task.id, "status": "queued"}


@router.post("/tasks/send-reminders")
def trigger_send_reminders():
    task = send_overdue_reminders.delay()
    return {"task_id": task.id, "status": "queued"}


@router.get("/health")
def health():
    return {"status": "ok"}