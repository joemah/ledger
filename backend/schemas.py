from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import date, datetime


class InvoiceItem(BaseModel):
    description: str = ""
    quantity: float = 1
    unit_price: float = 0
    total: float = 0


class CompanyBase(BaseModel):
    name: str
    logo: Optional[str] = None
    tagline: Optional[str] = None
    invoice_prefix: Optional[str] = None
    location_label: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    vat_number: Optional[str] = None
    iban: Optional[str] = None
    bic: Optional[str] = None
    bank_name: Optional[str] = None
    social_linkedin: Optional[str] = None
    social_twitter: Optional[str] = None
    social_instagram: Optional[str] = None
    social_facebook: Optional[str] = None


class CompanyOut(CompanyBase):
    id: str
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class ClientBase(BaseModel):
    name: str
    contact_person: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    vat_number: Optional[str] = None
    website: Optional[str] = None
    social_linkedin: Optional[str] = None


class ClientOut(ClientBase):
    id: str
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class InvoiceBase(BaseModel):
    # HTML date inputs submit "" for cleared fields; treat those as null.
    @field_validator("issue_date", "due_date", "next_invoice_date", "recurring_end_date", mode="before")
    @classmethod
    def _blank_date_to_none(cls, value):
        if isinstance(value, str) and not value.strip():
            return None
        return value

    invoice_number: str
    status: Optional[str] = "draft"
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    client_id: str
    client_name: Optional[str] = None
    currency: Optional[str] = "EUR"
    items: Optional[List[InvoiceItem]] = []
    subtotal: Optional[float] = 0
    discount_type: Optional[str] = "none"
    discount_value: Optional[float] = 0
    discount_amount: Optional[float] = 0
    tax_rate: Optional[float] = 0
    tax_amount: Optional[float] = 0
    total: Optional[float] = 0
    amount_paid: Optional[float] = 0
    balance: Optional[float] = 0
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    # Recurring
    is_recurring: Optional[bool] = False
    recurring_frequency: Optional[str] = "none"
    recurring_interval: Optional[int] = 1
    next_invoice_date: Optional[date] = None
    recurring_end_date: Optional[date] = None
    parent_invoice_id: Optional[str] = None
    # Late fees
    late_fee_type: Optional[str] = "none"
    late_fee_value: Optional[float] = 0
    late_fee_amount: Optional[float] = 0
    # Reminders
    reminder_count: Optional[int] = 0
    last_reminder_date: Optional[date] = None
    # Payment link
    payment_link: Optional[str] = None
    payment_link_id: Optional[str] = None
    payment_link_provider: Optional[str] = None


class InvoiceOut(InvoiceBase):
    id: str
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class PaymentBase(BaseModel):
    amount: float
    payment_date: Optional[date] = None
    payment_method: Optional[str] = "bank_transfer"
    reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentOut(PaymentBase):
    id: str
    invoice_id: str
    created_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExpenseBase(BaseModel):
    description: str
    category: Optional[str] = "other"
    amount: float
    currency: Optional[str] = "EUR"
    expense_date: Optional[date] = None
    vendor: Optional[str] = None
    payment_method: Optional[str] = "card"
    receipt_uri: Optional[str] = None
    tax_deductible: Optional[bool] = True
    notes: Optional[str] = None


class ExpenseOut(ExpenseBase):
    id: str
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class TimerStart(BaseModel):
    description: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    project: Optional[str] = None
    hourly_rate: Optional[float] = 0


class TimeEntryBase(BaseModel):
    description: str
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    project: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    duration_minutes: Optional[float] = 0
    hourly_rate: Optional[float] = 0
    billable: Optional[bool] = True
    invoiced: Optional[bool] = False
    invoice_id: Optional[str] = None
    notes: Optional[str] = None


class TimeEntryOut(TimeEntryBase):
    id: str
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    role: Optional[str] = "admin"

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ResetRequest(BaseModel):
    email: str


class ResetPassword(BaseModel):
    reset_token: str
    new_password: str


class EmailRequest(BaseModel):
    to: str
    subject: str
    body: Optional[str] = None
    html: Optional[str] = None
    from_name: Optional[str] = None
    attachments: Optional[List[dict]] = None


class SendInvoiceRequest(BaseModel):
    to: Optional[str] = None
    subject: Optional[str] = None
    message: Optional[str] = None


class TemplateItem(BaseModel):
    description: str = ""
    quantity: float = 1
    unit_price: float = 0


class ItemTemplateBase(BaseModel):
    name: str
    items: Optional[List[TemplateItem]] = []


class ItemTemplateOut(ItemTemplateBase):
    id: str
    created_date: Optional[datetime] = None
    updated_date: Optional[datetime] = None

    class Config:
        from_attributes = True