"""PDF generation service — ReportLab-based professional invoice PDFs."""
import os
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from config import settings

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

CURRENCY_SYMBOLS = {"EUR": "€", "USD": "$", "GBP": "£", "CHF": "CHF"}


def _money(amount, currency="EUR"):
    symbol = CURRENCY_SYMBOLS.get(currency, currency)
    return f"{symbol}{amount:,.2f}"


def generate_invoice_pdf(invoice, company=None, client=None):
    """Generate a PDF for an invoice and return the file path."""
    filename = f"invoice_{invoice.id}.pdf"
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=20 * mm, bottomMargin=20 * mm,
    )
    styles = getSampleStyleSheet()
    elements = []

    title_style = ParagraphStyle("Title", parent=styles["Title"], fontSize=28, spaceAfter=4)
    normal_style = styles["Normal"]

    # ─── Header ───────────────────────────────────────────────────────
    company_name = company.name if company else "ProInvoice"
    elements.append(Paragraph(company_name, title_style))
    if company and company.tagline:
        elements.append(Paragraph(company.tagline, ParagraphStyle("Tag", parent=normal_style, textColor=colors.grey, fontSize=10)))
    elements.append(Spacer(1, 20))

    # ─── Invoice meta + parties ───────────────────────────────────────
    header_data = [
        [Paragraph("INVOICE", ParagraphStyle("InvLabel", parent=normal_style, fontSize=16, textColor=colors.black)),
         Paragraph(f"<b>{invoice.invoice_number}</b>", normal_style)],
        [Paragraph("", normal_style),
         Paragraph(f"Status: <b>{invoice.status.upper()}</b>", normal_style)],
        [Paragraph("", normal_style),
         Paragraph(f"Issue Date: {invoice.issue_date}", normal_style)],
        [Paragraph("", normal_style),
         Paragraph(f"Due Date: {invoice.due_date}", normal_style)],
    ]
    if client:
        header_data[0][0] = Paragraph(
            f"<b>Bill To:</b><br/>{client.name}<br/>{client.address or ''}<br/>"
            f"{client.city or ''} {client.postal_code or ''}<br/>{client.country or ''}",
            normal_style,
        )

    header_table = Table(header_data, colWidths=[90 * mm, 70 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 20))

    # ─── Line items ───────────────────────────────────────────────────
    items = invoice.items or []
    item_rows = [["Description", "Qty", "Unit Price", "Total"]]
    for item in items:
        item_rows.append([
            item.get("description", ""),
            str(item.get("quantity", 1)),
            _money(item.get("unit_price", 0), invoice.currency),
            _money(item.get("total", 0), invoice.currency),
        ])

    items_table = Table(item_rows, colWidths=[80 * mm, 25 * mm, 30 * mm, 30 * mm])
    items_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.black),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5f5")]),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 16))

    # ─── Totals ───────────────────────────────────────────────────────
    totals = [["Subtotal", _money(invoice.subtotal or 0, invoice.currency)]]
    if invoice.discount_amount and invoice.discount_amount > 0:
        totals.append(["Discount", f"-{_money(invoice.discount_amount, invoice.currency)}"])
    if invoice.tax_amount and invoice.tax_amount > 0:
        totals.append([f"Tax ({invoice.tax_rate or 0}%)", _money(invoice.tax_amount, invoice.currency)])
    if invoice.late_fee_amount and invoice.late_fee_amount > 0:
        totals.append(["Late Fee", _money(invoice.late_fee_amount, invoice.currency)])
    totals.append(["TOTAL", _money(invoice.total or 0, invoice.currency)])
    if invoice.amount_paid and invoice.amount_paid > 0:
        totals.append(["Amount Paid", f"-{_money(invoice.amount_paid, invoice.currency)}"])
        totals.append(["BALANCE DUE", _money(invoice.balance or 0, invoice.currency)])

    totals_table = Table(totals, colWidths=[100 * mm, 65 * mm])
    totals_table.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("LINEBELOW", (0, -2), (-1, -2), 0.5, colors.grey),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(totals_table)

    # ─── Notes & payment info ─────────────────────────────────────────
    if invoice.notes:
        elements.append(Spacer(1, 20))
        elements.append(Paragraph("<b>Notes</b>", normal_style))
        elements.append(Paragraph(invoice.notes, normal_style))

    if company and company.iban:
        elements.append(Spacer(1, 12))
        pay_info = f"<b>Payment:</b> {company.bank_name or ''} — IBAN: {company.iban} — BIC: {company.bic or ''}"
        elements.append(Paragraph(pay_info, ParagraphStyle("Pay", parent=normal_style, fontSize=9, textColor=colors.grey)))

    doc.build(elements)
    buffer.seek(0)
    with open(filepath, "wb") as f:
        f.write(buffer.read())
    return filepath