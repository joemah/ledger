"""Invoice business logic: duplication, PDF generation, async email sending."""
from datetime import date

from models import Invoice, Client, Company
from services.pdf_service import generate_invoice_pdf


def duplicate_invoice(db, invoice_id):
    """Create a draft copy of an invoice with reset payment tracking."""
    original = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not original:
        return None

    clone = Invoice(
        invoice_number=f"COPY-{original.invoice_number}",
        status="draft",
        issue_date=date.today(),
        due_date=None,
        client_id=original.client_id,
        client_name=original.client_name,
        currency=original.currency,
        items=original.items,
        subtotal=original.subtotal,
        discount_type=original.discount_type,
        discount_value=original.discount_value,
        discount_amount=original.discount_amount,
        tax_rate=original.tax_rate,
        tax_amount=original.tax_amount,
        total=original.total,
        amount_paid=0,
        balance=original.total,
        notes=original.notes,
        payment_terms=original.payment_terms,
    )
    db.add(clone)
    db.commit()
    db.refresh(clone)
    return clone


def generate_pdf(db, invoice_id):
    """Generate a PDF for an invoice. Returns (filepath, invoice) or None."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return None
    company = db.query(Company).first()
    client = db.query(Client).filter(Client.id == invoice.client_id).first()
    filepath = generate_invoice_pdf(invoice, company, client)
    return filepath, invoice


def send_invoice(db, invoice_id, to=None, subject=None, message=None):
    """Queue an invoice email via Celery. Returns (result, error)."""
    from tasks import send_invoice_email

    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return None, "Invoice not found"

    client = db.query(Client).filter(Client.id == invoice.client_id).first()
    to_email = to or (client.email if client else None)
    if not to_email:
        return None, "No recipient email address"

    subject = subject or f"Invoice {invoice.invoice_number} from ProInvoice"
    body = message or f"""
        <h2>Invoice {invoice.invoice_number}</h2>
        <p>Dear {client.name if client else 'Client'},</p>
        <p>Please find your invoice attached. The total amount due is
        <strong>{invoice.currency} {invoice.balance or invoice.total:.2f}</strong>,
        due by <strong>{invoice.due_date or 'N/A'}</strong>.</p>
        <p>Thank you for your business.</p>
    """

    if invoice.status == "draft":
        invoice.status = "sent"
        db.commit()

    send_invoice_email.delay(invoice_id, to_email, subject, body)
    return {"ok": True, "sent_to": to_email}, None