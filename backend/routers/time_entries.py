"""Time tracking routes: CRUD, live timer, unbilled aggregation, invoice creation."""
import json
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import TimeEntry, Invoice, Client, Company
from schemas import TimeEntryBase, TimeEntryOut, TimerStart, InvoiceOut
from utils import apply_filters, apply_sort
from auth import get_current_user

router = APIRouter(prefix="/api/time-entries", tags=["time-entries"], dependencies=[Depends(get_current_user)])


@router.get("")
def list_entries(sort: str = "-created_date", limit: int = 200, filter: str = None, db: Session = Depends(get_db)):
    query = db.query(TimeEntry)
    if filter:
        query = apply_filters(query, TimeEntry, json.loads(filter))
    query = apply_sort(query, TimeEntry, sort)
    return {"items": query.limit(limit).all()}


@router.get("/running")
def get_running(db: Session = Depends(get_db)):
    entry = db.query(TimeEntry).filter(TimeEntry.end_time == None).first()
    return entry


@router.get("/unbilled")
def unbilled_summary(db: Session = Depends(get_db)):
    entries = db.query(TimeEntry).filter(
        TimeEntry.billable == True,
        TimeEntry.invoiced == False,
        TimeEntry.end_time != None,
    ).all()

    by_client = {}
    for e in entries:
        key = e.client_id or "no-client"
        name = e.client_name or "No Client"
        if key not in by_client:
            by_client[key] = {"client_id": e.client_id, "client_name": name, "hours": 0, "value": 0, "entries": 0}
        hours = (e.duration_minutes or 0) / 60
        by_client[key]["hours"] += hours
        by_client[key]["value"] += hours * (e.hourly_rate or 0)
        by_client[key]["entries"] += 1

    clients = list(by_client.values())
    return {
        "total_hours": sum(c["hours"] for c in clients),
        "total_value": sum(c["value"] for c in clients),
        "total_entries": sum(c["entries"] for c in clients),
        "clients": clients,
    }


@router.post("/start", response_model=TimeEntryOut)
def start_timer(timer: TimerStart, db: Session = Depends(get_db)):
    # Stop any running entry first
    running = db.query(TimeEntry).filter(TimeEntry.end_time == None).first()
    if running:
        running.end_time = datetime.utcnow()
        running.duration_minutes = (running.end_time - running.start_time).total_seconds() / 60
        db.commit()

    entry = TimeEntry(
        description=timer.description,
        client_id=timer.client_id,
        client_name=timer.client_name,
        project=timer.project,
        hourly_rate=timer.hourly_rate or 0,
        start_time=datetime.utcnow(),
        billable=True,
        invoiced=False,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/invoice", response_model=InvoiceOut)
def create_invoice_from_time(body: dict, db: Session = Depends(get_db)):
    client_id = body.get("client_id")
    if not client_id:
        raise HTTPException(status_code=400, detail="client_id required")

    entries = db.query(TimeEntry).filter(
        TimeEntry.client_id == client_id,
        TimeEntry.billable == True,
        TimeEntry.invoiced == False,
        TimeEntry.end_time != None,
    ).all()

    if not entries:
        raise HTTPException(status_code=400, detail="No unbilled time entries for this client")

    items = []
    for e in entries:
        hours = round((e.duration_minutes or 0) / 60, 2)
        rate = e.hourly_rate or 0
        items.append({
            "description": e.description,
            "quantity": hours,
            "unit_price": rate,
            "total": round(hours * rate, 2),
        })

    subtotal = round(sum(i["total"] for i in items), 2)

    company = db.query(Company).first()
    prefix = (company.invoice_prefix if company else None) or "INV"
    count = db.query(Invoice).count()
    invoice_number = f"{prefix}-{date.today().year}-{count + 1:04d}"

    client = db.query(Client).filter(Client.id == client_id).first()

    invoice = Invoice(
        invoice_number=invoice_number,
        status="draft",
        issue_date=date.today(),
        client_id=client_id,
        client_name=client.name if client else "",
        currency="EUR",
        items=items,
        subtotal=subtotal,
        total=subtotal,
        balance=subtotal,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    for e in entries:
        e.invoiced = True
        e.invoice_id = invoice.id
    db.commit()

    return invoice


@router.get("/{entry_id}", response_model=TimeEntryOut)
def get_entry(entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    return entry


@router.post("", response_model=TimeEntryOut)
def create_entry(entry: TimeEntryBase, db: Session = Depends(get_db)):
    db_entry = TimeEntry(**entry.model_dump())
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.post("/{entry_id}/stop", response_model=TimeEntryOut)
def stop_timer(entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    entry.end_time = datetime.utcnow()
    if entry.start_time:
        entry.duration_minutes = (entry.end_time - entry.start_time).total_seconds() / 60
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=TimeEntryOut)
def update_entry(entry_id: str, entry: TimeEntryBase, db: Session = Depends(get_db)):
    db_entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not db_entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    for key, value in entry.model_dump().items():
        setattr(db_entry, key, value)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@router.delete("/{entry_id}")
def delete_entry(entry_id: str, db: Session = Depends(get_db)):
    entry = db.query(TimeEntry).filter(TimeEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}