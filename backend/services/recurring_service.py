"""Recurring invoice generation service."""
from datetime import date, timedelta

from models import Invoice


def _compute_next_date(current: date, frequency: str, interval: int) -> date:
    if frequency == "weekly":
        return current + timedelta(weeks=interval)
    elif frequency == "monthly":
        return current + timedelta(days=30 * interval)
    elif frequency == "yearly":
        return current + timedelta(days=365 * interval)
    return current


def generate_recurring(db):
    """Generate new invoices from recurring templates whose next_invoice_date is due."""
    today = date.today()
    templates = db.query(Invoice).filter(
        Invoice.is_recurring == True,
        Invoice.recurring_frequency != "none",
        Invoice.next_invoice_date <= today,
    ).all()

    generated = 0
    for tpl in templates:
        if tpl.recurring_end_date and tpl.next_invoice_date > tpl.recurring_end_date:
            continue

        new_inv = Invoice(
            invoice_number=f"{tpl.invoice_number}-R{generated + 1}",
            status="draft",
            issue_date=today,
            due_date=today + timedelta(days=30),
            client_id=tpl.client_id,
            client_name=tpl.client_name,
            currency=tpl.currency,
            items=tpl.items,
            subtotal=tpl.subtotal,
            discount_type=tpl.discount_type,
            discount_value=tpl.discount_value,
            discount_amount=tpl.discount_amount,
            tax_rate=tpl.tax_rate,
            tax_amount=tpl.tax_amount,
            total=tpl.total,
            amount_paid=0,
            balance=tpl.total,
            notes=tpl.notes,
            payment_terms=tpl.payment_terms,
            parent_invoice_id=tpl.id,
        )
        db.add(new_inv)

        tpl.next_invoice_date = _compute_next_date(
            tpl.next_invoice_date, tpl.recurring_frequency, tpl.recurring_interval
        )
        generated += 1

    db.commit()
    return generated