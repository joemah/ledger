"""Overdue detection, late fee calculation, and reminder sending."""
from datetime import date

from models import Invoice, Client
from services.email_service import send_email


def check_overdue(db):
    """Mark sent invoices past their due_date as overdue and apply late fees."""
    today = date.today()
    invoices = db.query(Invoice).filter(
        Invoice.status == "sent",
        Invoice.due_date < today,
    ).all()

    for inv in invoices:
        inv.status = "overdue"
        if inv.late_fee_type == "flat" and inv.late_fee_value > 0:
            inv.late_fee_amount = inv.late_fee_value
        elif inv.late_fee_type == "percent" and inv.late_fee_value > 0:
            inv.late_fee_amount = round(inv.total * (inv.late_fee_value / 100), 2)
        else:
            inv.late_fee_amount = 0
        inv.balance = round(inv.total + inv.late_fee_amount - inv.amount_paid, 2)

    db.commit()
    return len(invoices)


def send_reminders(db):
    """Send reminder emails for overdue invoices (every 3 days, up to 4 reminders)."""
    today = date.today()
    invoices = db.query(Invoice).filter(
        Invoice.status == "overdue",
        Invoice.balance > 0,
    ).all()

    sent = 0
    for inv in invoices:
        if inv.last_reminder_date and (today - inv.last_reminder_date).days < 3:
            continue
        if inv.reminder_count >= 4:
            continue

        client = db.query(Client).filter(Client.id == inv.client_id).first()
        if not client or not client.email:
            continue

        body = f"""
            <h2>Payment Reminder — {inv.invoice_number}</h2>
            <p>Dear {client.name},</p>
            <p>This is a friendly reminder that invoice <strong>{inv.invoice_number}</strong>
            was due on <strong>{inv.due_date}</strong> and has a remaining balance of
            <strong>{inv.currency} {inv.balance:.2f}</strong>.</p>
            <p>If you have already paid, please disregard this message.</p>
            <p>Thank you for your business.</p>
        """
        send_email(
            client.email,
            f"Reminder: Invoice {inv.invoice_number} is overdue",
            html=body,
        )
        inv.reminder_count = (inv.reminder_count or 0) + 1
        inv.last_reminder_date = today
        sent += 1

    db.commit()
    return sent