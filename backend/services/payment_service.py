"""Payment recording service — tracks partial payments and updates invoice balances."""
from datetime import date

from models import Invoice, Payment


def record_payment(db, invoice_id, payment_data):
    """Record a payment against an invoice and recalculate the balance."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return None, "Invoice not found"

    payment = Payment(invoice_id=invoice_id, **payment_data.model_dump())
    if not payment.payment_date:
        payment.payment_date = date.today()
    db.add(payment)

    invoice.amount_paid = (invoice.amount_paid or 0) + payment.amount
    invoice.balance = round(
        (invoice.total or 0) + (invoice.late_fee_amount or 0) - invoice.amount_paid, 2
    )
    if invoice.balance <= 0:
        invoice.status = "paid"
        invoice.balance = 0

    db.commit()
    db.refresh(payment)
    return payment, None


def delete_payment(db, invoice_id, payment_id):
    """Remove a payment and recalculate the invoice balance."""
    payment = db.query(Payment).filter(
        Payment.id == payment_id, Payment.invoice_id == invoice_id
    ).first()
    if not payment:
        return False, "Payment not found"

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if invoice:
        invoice.amount_paid = (invoice.amount_paid or 0) - payment.amount
        invoice.balance = round(
            (invoice.total or 0) + (invoice.late_fee_amount or 0) - invoice.amount_paid, 2
        )
        if invoice.balance > 0 and invoice.status == "paid":
            invoice.status = "sent"

    db.delete(payment)
    db.commit()
    return True, None