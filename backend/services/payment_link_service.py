"""Payment link generation service — creates secure payment links via Wise or Revolut."""
import requests

from models import Invoice
from config import settings


def _get_balance(invoice):
    """Calculate outstanding balance for an invoice."""
    return (invoice.total or 0) + (invoice.late_fee_amount or 0) - (invoice.amount_paid or 0)


def create_wise_payment_link(invoice):
    """Create a payment link via Wise Business API.

    Requires WISE_API_TOKEN and WISE_PROFILE_ID environment variables.
    Docs: https://docs.wise.com/api-reference
    """
    if not settings.WISE_API_TOKEN or not settings.WISE_PROFILE_ID:
        raise ValueError(
            "Wise API credentials not configured. Set WISE_API_TOKEN and WISE_PROFILE_ID."
        )

    amount = _get_balance(invoice)
    url = f"{settings.WISE_API_BASE}/v3/profiles/{settings.WISE_PROFILE_ID}/payment-requests"
    headers = {
        "Authorization": f"Bearer {settings.WISE_API_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "sourceAmount": amount,
        "sourceCurrency": invoice.currency,
        "description": f"Invoice {invoice.invoice_number} — {invoice.client_name or ''}",
        "reference": invoice.invoice_number,
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    link = data.get("paymentLink") or data.get("url") or data.get("link", "")
    link_id = str(data.get("id", ""))

    if not link:
        raise ValueError("Wise API did not return a payment link URL")

    return {
        "payment_link": link,
        "payment_link_id": link_id,
        "payment_link_provider": "wise",
    }


def create_revolut_payment_link(invoice):
    """Create a payout link via Revolut Business API.

    Requires REVOLUT_API_TOKEN and REVOLUT_ACCOUNT_ID environment variables.
    Docs: https://developer.revolut.com/docs/api/business
    """
    if not settings.REVOLUT_API_TOKEN or not settings.REVOLUT_ACCOUNT_ID:
        raise ValueError(
            "Revolut API credentials not configured. Set REVOLUT_API_TOKEN and REVOLUT_ACCOUNT_ID."
        )

    amount = _get_balance(invoice)
    url = f"{settings.REVOLUT_API_BASE}/payout-links"
    headers = {
        "Authorization": f"Bearer {settings.REVOLUT_API_TOKEN}",
        "Content-Type": "application/json",
    }
    payload = {
        "account_id": settings.REVOLUT_ACCOUNT_ID,
        "amount": amount,
        "currency": invoice.currency,
        "counterparty_name": invoice.client_name or "Client",
        "reference": invoice.invoice_number,
        "request_id": invoice.id,
        "expiry_period": "P30D",
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    link = data.get("url", "")
    link_id = data.get("id", "")

    if not link:
        raise ValueError("Revolut API did not return a payment link URL")

    return {
        "payment_link": link,
        "payment_link_id": link_id,
        "payment_link_provider": "revolut",
    }


def generate_payment_link(db, invoice_id, provider):
    """Generate a payment link for an invoice via the specified provider."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        return None

    amount = _get_balance(invoice)
    if amount <= 0:
        raise ValueError("Invoice has no outstanding balance")

    if provider == "wise":
        result = create_wise_payment_link(invoice)
    elif provider == "revolut":
        result = create_revolut_payment_link(invoice)
    else:
        raise ValueError(f"Unknown payment provider: {provider}")

    invoice.payment_link = result["payment_link"]
    invoice.payment_link_id = result["payment_link_id"]
    invoice.payment_link_provider = result["payment_link_provider"]
    db.commit()
    db.refresh(invoice)
    return invoice