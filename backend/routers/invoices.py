"""Invoice routes: CRUD, aggregate, duplicate, PDF generation, async send."""
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Invoice
from schemas import InvoiceBase, InvoiceOut, SendInvoiceRequest
from utils import apply_filters, apply_sort
from services.invoice_service import duplicate_invoice, generate_pdf, send_invoice
from auth import get_current_user

router = APIRouter(prefix="/api/invoices", tags=["invoices"], dependencies=[Depends(get_current_user)])


@router.get("")
def list_invoices(sort: str = "-created_date", limit: int = 50, filter: str = None, db: Session = Depends(get_db)):
    query = db.query(Invoice)
    if filter:
        query = apply_filters(query, Invoice, json.loads(filter))
    query = apply_sort(query, Invoice, sort)
    return {"items": query.limit(limit).all()}


@router.get("/count")
def count_invoices(filter: str = None, db: Session = Depends(get_db)):
    query = db.query(Invoice)
    if filter:
        query = apply_filters(query, Invoice, json.loads(filter))
    return query.count()


@router.get("/aggregate")
def aggregate_invoices(groupBy: str = None, sum: str = None, dateBucket: str = None, db: Session = Depends(get_db)):
    if groupBy == "status":
        rows = db.query(
            Invoice.status,
            func.count(Invoice.id).label("count"),
            func.sum(Invoice.total).label("sum_total"),
            func.sum(Invoice.balance).label("sum_balance"),
        ).group_by(Invoice.status).all()
        return {"rows": [{"status": r.status, "count": r.count, "sum_total": r.sum_total or 0, "sum_balance": r.sum_balance or 0} for r in rows]}

    if groupBy == "client_name":
        rows = (
            db.query(
                Invoice.client_name,
                func.count(Invoice.id).label("count"),
                func.sum(Invoice.total).label("sum_total"),
            )
            .filter(Invoice.client_name != None, Invoice.client_name != "")
            .group_by(Invoice.client_name)
            .order_by(func.sum(Invoice.total).desc())
            .limit(10)
            .all()
        )
        return {"rows": [{"client_name": r.client_name, "count": r.count, "sum_total": r.sum_total or 0} for r in rows]}

    if dateBucket == "month":
        rows = (
            db.query(
                func.to_char(Invoice.issue_date, 'YYYY-MM').label("month"),
                func.count(Invoice.id).label("count"),
                func.sum(Invoice.total).label("sum_total"),
            )
            .filter(Invoice.issue_date != None)
            .group_by("month")
            .order_by("month")
            .all()
        )
        return {"rows": [{"month": r.month, "count": r.count, "sum_total": r.sum_total or 0} for r in rows]}

    return {"rows": []}


@router.get("/aging")
def aging_report(db: Session = Depends(get_db)):
    from datetime import date as date_cls
    today = date_cls.today()
    brackets = [
        {"key": "current", "label": "Current", "count": 0, "amount": 0},
        {"key": "1-30", "label": "1-30 days", "count": 0, "amount": 0},
        {"key": "31-60", "label": "31-60 days", "count": 0, "amount": 0},
        {"key": "61-90", "label": "61-90 days", "count": 0, "amount": 0},
        {"key": "90+", "label": "90+ days", "count": 0, "amount": 0},
    ]
    invoices = db.query(Invoice).filter(Invoice.status.in_(["sent", "overdue"])).all()
    for inv in invoices:
        if not inv.due_date:
            continue
        balance = (inv.total or 0) + (inv.late_fee_amount or 0) - (inv.amount_paid or 0)
        if balance <= 0:
            continue
        days_overdue = (today - inv.due_date).days
        if days_overdue <= 0:
            idx = 0
        elif days_overdue <= 30:
            idx = 1
        elif days_overdue <= 60:
            idx = 2
        elif days_overdue <= 90:
            idx = 3
        else:
            idx = 4
        brackets[idx]["count"] += 1
        brackets[idx]["amount"] += balance
    return {"brackets": brackets}


@router.get("/{invoice_id}", response_model=InvoiceOut)
def get_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("", response_model=InvoiceOut)
def create_invoice(invoice: InvoiceBase, db: Session = Depends(get_db)):
    db_invoice = Invoice(**invoice.model_dump())
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)
    return db_invoice


@router.put("/{invoice_id}", response_model=InvoiceOut)
def update_invoice(invoice_id: str, invoice: InvoiceBase, db: Session = Depends(get_db)):
    db_invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    for key, value in invoice.model_dump().items():
        setattr(db_invoice, key, value)
    db.commit()
    db.refresh(db_invoice)
    return db_invoice


@router.delete("/{invoice_id}")
def delete_invoice(invoice_id: str, db: Session = Depends(get_db)):
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    db.delete(invoice)
    db.commit()
    return {"ok": True}


@router.post("/{invoice_id}/duplicate", response_model=InvoiceOut)
def duplicate(invoice_id: str, db: Session = Depends(get_db)):
    clone = duplicate_invoice(db, invoice_id)
    if not clone:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return clone


@router.get("/{invoice_id}/pdf")
def pdf(invoice_id: str, db: Session = Depends(get_db)):
    result = generate_pdf(db, invoice_id)
    if not result:
        raise HTTPException(status_code=404, detail="Invoice not found")
    filepath, invoice = result
    return FileResponse(filepath, media_type="application/pdf", filename=f"{invoice.invoice_number}.pdf")


@router.post("/{invoice_id}/send")
def send(invoice_id: str, req: SendInvoiceRequest, db: Session = Depends(get_db)):
    result, error = send_invoice(db, invoice_id, req.to, req.subject, req.message)
    if error:
        raise HTTPException(status_code=400, detail=error)
    return result


@router.post("/{invoice_id}/payment-link")
def create_payment_link(invoice_id: str, body: dict, db: Session = Depends(get_db)):
    provider = body.get("provider", "wise")
    from services.payment_link_service import generate_payment_link
    try:
        invoice = generate_payment_link(db, invoice_id, provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return {
        "payment_link": invoice.payment_link,
        "payment_link_provider": invoice.payment_link_provider,
        "payment_link_id": invoice.payment_link_id,
    }