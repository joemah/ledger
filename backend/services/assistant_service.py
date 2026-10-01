"""Invoice assistant orchestration: system prompt + MCP-style tool registry.

Builds the tool registry that lets the LLM read unbilled time entries, read
clients, create draft invoices, and mark time entries as invoiced — all
executed against the database through the service layer.
"""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from models import TimeEntry, Client, Invoice, Company
from services.llm_service import ToolRegistry, run_agent_loop


SYSTEM_PROMPT = """You are an invoice drafting assistant for a freelance consultant's invoice management app.

Your job is to help the user draft new invoices from tracked time entries. Follow this workflow:

1. When the user asks to draft an invoice (for a specific client, date range, or all unbilled work), call the `list_unbilled_time` tool to find billable, not-yet-invoiced time entries. Optionally narrow by client_id.

2. Call `list_clients` to resolve client names and details for the selected entries.

3. Group the selected time entries by client. For each client, build invoice line items: one line item per time entry (or grouped by project) with description = the time entry description (plus project if present), quantity = hours (duration_minutes / 60, rounded to 2 decimals), and unit_price = the time entry's hourly_rate.

4. Present a clear summary to the user: which time entries are being included, grouped by client, with the computed line items, subtotal, and total. Ask the user to confirm before creating the invoice.

5. Once the user confirms, call `create_invoice` for each client with the computed items, currency (default EUR), issue_date (today), due_date (today + 30 days). Then call `mark_time_invoiced` for the included time entry ids so they aren't double-billed later.

6. Report back the created invoice(s) with their invoice numbers and ids, and tell the user they can open them from the Invoices page.

Rules:
- Always confirm with the user before creating invoices.
- Never include non-billable or already-invoiced time entries.
- If no unbilled time entries exist, tell the user clearly.
- Keep amounts precise; round only for display.
- Be concise and professional."""


def build_registry(db: Session) -> ToolRegistry:
    """Construct the tool registry with handlers bound to the given DB session."""
    registry = ToolRegistry()

    registry.register(
        name="list_unbilled_time",
        description="List billable time entries that have not yet been invoiced. Optionally filter by client_id.",
        parameters={
            "type": "object",
            "properties": {
                "client_id": {"type": "string", "description": "Optional client id to filter by."},
            },
        },
        handler=lambda args: _list_unbilled_time(db, args.get("client_id")),
    )

    registry.register(
        name="list_clients",
        description="List all clients with their id, name, and contact details.",
        parameters={"type": "object", "properties": {}},
        handler=lambda _args: _list_clients(db),
    )

    registry.register(
        name="create_invoice",
        description="Create a draft invoice for a client from computed line items.",
        parameters={
            "type": "object",
            "properties": {
                "client_id": {"type": "string"},
                "currency": {"type": "string", "default": "EUR"},
                "issue_date": {"type": "string", "format": "date"},
                "due_date": {"type": "string", "format": "date"},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "description": {"type": "string"},
                            "quantity": {"type": "number"},
                            "unit_price": {"type": "number"},
                        },
                        "required": ["description", "quantity", "unit_price"],
                    },
                },
            },
            "required": ["client_id", "items"],
        },
        handler=lambda args: _create_invoice(db, args),
    )

    registry.register(
        name="mark_time_invoiced",
        description="Mark a list of time entry ids as invoiced and link them to the created invoice.",
        parameters={
            "type": "object",
            "properties": {
                "time_entry_ids": {"type": "array", "items": {"type": "string"}},
                "invoice_id": {"type": "string"},
            },
            "required": ["time_entry_ids", "invoice_id"],
        },
        handler=lambda args: _mark_time_invoiced(db, args.get("time_entry_ids", []), args.get("invoice_id")),
    )

    return registry


def _list_unbilled_time(db, client_id=None):
    query = db.query(TimeEntry).filter(
        TimeEntry.billable == True,  # noqa: E712
        TimeEntry.invoiced == False,  # noqa: E712
        TimeEntry.end_time != None,  # noqa: E711
    )
    if client_id:
        query = query.filter(TimeEntry.client_id == client_id)
    entries = query.all()
    return [
        {
            "id": e.id,
            "description": e.description,
            "client_id": e.client_id,
            "client_name": e.client_name,
            "project": e.project,
            "duration_minutes": e.duration_minutes,
            "hourly_rate": e.hourly_rate,
        }
        for e in entries
    ]


def _list_clients(db):
    clients = db.query(Client).order_by(Client.name).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "contact_person": c.contact_person,
            "email": c.email,
        }
        for c in clients
    ]


def _create_invoice(db, args):
    client_id = args.get("client_id")
    items = args.get("items") or []
    if not client_id or not items:
        return {"error": "client_id and items are required"}

    client = db.query(Client).filter(Client.id == client_id).first()
    computed = []
    for it in items:
        qty = float(it.get("quantity") or 0)
        price = float(it.get("unit_price") or 0)
        computed.append({
            "description": it.get("description", ""),
            "quantity": qty,
            "unit_price": price,
            "total": round(qty * price, 2),
        })
    subtotal = round(sum(i["total"] for i in computed), 2)

    company = db.query(Company).first()
    prefix = (company.invoice_prefix if company and company.invoice_prefix else None) or "INV"
    year = date.today().year
    count = db.query(Invoice).filter(Invoice.issue_date >= date(year, 1, 1)).count()
    invoice_number = f"{prefix}-{year}-{count + 1:04d}"

    issue = _parse_date(args.get("issue_date")) or date.today()
    due = _parse_date(args.get("due_date")) or (issue + timedelta(days=30))

    invoice = Invoice(
        invoice_number=invoice_number,
        status="draft",
        issue_date=issue,
        due_date=due,
        client_id=client_id,
        client_name=client.name if client else "",
        currency=args.get("currency") or "EUR",
        items=computed,
        subtotal=subtotal,
        total=subtotal,
        balance=subtotal,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return {"id": invoice.id, "invoice_number": invoice.invoice_number, "total": invoice.total, "currency": invoice.currency}


def _mark_time_invoiced(db, time_entry_ids, invoice_id):
    if not time_entry_ids or not invoice_id:
        return {"error": "time_entry_ids and invoice_id are required"}
    entries = db.query(TimeEntry).filter(TimeEntry.id.in_(time_entry_ids)).all()
    for e in entries:
        e.invoiced = True
        e.invoice_id = invoice_id
    db.commit()
    return {"updated": len(entries)}


def _parse_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def run_assistant(db: Session, history: list[dict], user_message: str):
    """Run one assistant turn: append the user message, run the tool loop, persist."""
    registry = build_registry(db)
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history + [{"role": "user", "content": user_message}]
    transcript = run_agent_loop(messages, registry)
    # Return only the new messages (drop the system prompt + the history we passed in)
    new_count = len(history) + 1  # +1 for the system prompt
    return transcript[new_count:]