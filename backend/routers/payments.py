"""Payment routes: list, create, delete — mounted under /api/invoices."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database import get_db
from models import Payment
from schemas import PaymentBase, PaymentOut
from services.payment_service import record_payment, delete_payment
from auth import get_current_user

router = APIRouter(prefix="/api/invoices", tags=["payments"], dependencies=[Depends(get_current_user)])


@router.get("/{invoice_id}/payments")
def list_payments(invoice_id: str, db: Session = Depends(get_db)):
    payments = (
        db.query(Payment)
        .filter(Payment.invoice_id == invoice_id)
        .order_by(desc(Payment.created_date))
        .all()
    )
    return {"items": payments}


@router.post("/{invoice_id}/payments", response_model=PaymentOut)
def create_payment(invoice_id: str, payment: PaymentBase, db: Session = Depends(get_db)):
    result, error = record_payment(db, invoice_id, payment)
    if error:
        raise HTTPException(status_code=404, detail=error)
    return result


@router.delete("/{invoice_id}/payments/{payment_id}")
def remove_payment(invoice_id: str, payment_id: str, db: Session = Depends(get_db)):
    success, error = delete_payment(db, invoice_id, payment_id)
    if not success:
        raise HTTPException(status_code=404, detail=error)
    return {"ok": True}