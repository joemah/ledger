import uuid
from datetime import datetime
from sqlalchemy import Column, String, Date, Float, Text, DateTime, JSON, Boolean, Integer

from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="admin")
    created_date = Column(DateTime, default=datetime.utcnow)


class Company(Base):
    __tablename__ = "companies"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    logo = Column(Text)
    tagline = Column(String)
    invoice_prefix = Column(String)
    location_label = Column(String)
    address = Column(Text)
    city = Column(String)
    postal_code = Column(String)
    country = Column(String)
    email = Column(String)
    phone = Column(String)
    website = Column(String)
    vat_number = Column(String)
    iban = Column(String)
    bic = Column(String)
    bank_name = Column(String)
    social_linkedin = Column(String)
    social_twitter = Column(String)
    social_instagram = Column(String)
    social_facebook = Column(String)
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Client(Base):
    __tablename__ = "clients"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    contact_person = Column(String)
    address = Column(Text)
    city = Column(String)
    postal_code = Column(String)
    country = Column(String)
    email = Column(String)
    phone = Column(String)
    vat_number = Column(String)
    website = Column(String)
    social_linkedin = Column(String)
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Invoice(Base):
    __tablename__ = "invoices"
    id = Column(String, primary_key=True, default=gen_uuid)
    invoice_number = Column(String, nullable=False)
    status = Column(String, default="draft")
    issue_date = Column(Date)
    due_date = Column(Date)
    client_id = Column(String)
    client_name = Column(String)
    currency = Column(String, default="EUR")
    items = Column(JSON, default=list)
    subtotal = Column(Float, default=0)
    discount_type = Column(String, default="none")
    discount_value = Column(Float, default=0)
    discount_amount = Column(Float, default=0)
    tax_rate = Column(Float, default=0)
    tax_amount = Column(Float, default=0)
    total = Column(Float, default=0)
    amount_paid = Column(Float, default=0)
    balance = Column(Float, default=0)
    notes = Column(Text)
    payment_terms = Column(Text)

    # Recurring invoice support
    is_recurring = Column(Boolean, default=False)
    recurring_frequency = Column(String, default="none")  # none, weekly, monthly, yearly
    recurring_interval = Column(Integer, default=1)
    next_invoice_date = Column(Date)
    recurring_end_date = Column(Date)
    parent_invoice_id = Column(String)  # template this recurring invoice was generated from

    # Late fee support
    late_fee_type = Column(String, default="none")  # none, flat, percent
    late_fee_value = Column(Float, default=0)
    late_fee_amount = Column(Float, default=0)

    # Reminder tracking
    reminder_count = Column(Integer, default=0)
    last_reminder_date = Column(Date)

    # Payment link
    payment_link = Column(Text)
    payment_link_id = Column(String)
    payment_link_provider = Column(String)  # 'wise' or 'revolut'

    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True, default=gen_uuid)
    invoice_id = Column(String, nullable=False, index=True)
    amount = Column(Float, nullable=False)
    payment_date = Column(Date)
    payment_method = Column(String, default="bank_transfer")  # bank_transfer, cash, check, card, other
    reference = Column(String)
    notes = Column(Text)
    created_date = Column(DateTime, default=datetime.utcnow)


class Expense(Base):
    __tablename__ = "expenses"
    id = Column(String, primary_key=True, default=gen_uuid)
    description = Column(String, nullable=False)
    category = Column(String, default="other")  # software, hardware, travel, meals, office, professional_services, marketing, utilities, rent, other
    amount = Column(Float, nullable=False, default=0)
    currency = Column(String, default="EUR")
    expense_date = Column(Date)
    vendor = Column(String)
    payment_method = Column(String, default="card")  # card, bank_transfer, cash, check, other
    receipt_uri = Column(Text)  # private file URI for uploaded receipt
    tax_deductible = Column(Boolean, default=True)
    notes = Column(Text)
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TimeEntry(Base):
    __tablename__ = "time_entries"
    id = Column(String, primary_key=True, default=gen_uuid)
    description = Column(String, nullable=False)
    client_id = Column(String)
    client_name = Column(String)
    project = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    duration_minutes = Column(Float, default=0)
    hourly_rate = Column(Float, default=0)
    billable = Column(Boolean, default=True)
    invoiced = Column(Boolean, default=False)
    invoice_id = Column(String)
    notes = Column(Text)
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AssistantConversation(Base):
    __tablename__ = "assistant_conversations"
    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, default="New conversation")
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"
    id = Column(String, primary_key=True, default=gen_uuid)
    conversation_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)  # user, assistant, tool
    content = Column(Text)
    tool_calls = Column(JSON)  # assistant messages that requested tool calls
    tool_name = Column(String)  # tool result messages
    tool_call_id = Column(String)
    created_date = Column(DateTime, default=datetime.utcnow)


class ItemTemplate(Base):
    __tablename__ = "item_templates"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    items = Column(JSON, default=list)  # list of {description, quantity, unit_price}
    created_date = Column(DateTime, default=datetime.utcnow)
    updated_date = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)