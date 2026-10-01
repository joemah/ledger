# ProInvoice — Standalone Setup (Docker + FastAPI + PostgreSQL + Celery)

This app can run in two modes:

1. **Base44 mode** (default) — uses the Base44 platform's built-in backend.
2. **Standalone mode** — uses a FastAPI + PostgreSQL backend with Celery for async tasks.

---

## Quick Start with Docker (recommended)

```bash
# 1. Build and start all services
docker compose up -d --build

# 2. The app is available at:
#    Frontend:  http://localhost:3000
#    API docs:  http://localhost:8000/docs
```

Services started by `docker-compose.yml`:

| Service   | Port | Description |
|-----------|------|-------------|
| db        | 5432 | PostgreSQL database |
| redis     | 6379 | Redis broker for Celery |
| backend   | 8000 | FastAPI REST API |
| worker    | —    | Celery worker (async email, PDF, payments) |
| beat      | —    | Celery beat scheduler (overdue checks, recurring invoices, reminders) |
| frontend  | 3000 | Nginx-served React SPA |

To stop: `docker compose down` (add `-v` to also remove the database volume).

---

## Local Development (without Docker)

### 1. Start PostgreSQL + Redis

```bash
# Using Docker just for infra:
docker compose up -d db redis

# Or install natively and create the database:
createdb proinvoice
```

### 2. Start the backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edit DATABASE_URL + SECRET_KEY
uvicorn main:app --reload --port 8000
```

### 3. Start the Celery worker + beat (for async tasks)

```bash
cd backend
source venv/bin/activate
# Terminal 1 — worker:
celery -A celery_app.celery worker --loglevel=info
# Terminal 2 — beat scheduler:
celery -A celery_app.celery beat --loglevel=info
```

### 4. Configure + start the frontend

```bash
cp .env.standalone.example .env
# .env should contain:
#   VITE_STANDALONE=true
#   VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

---

## How the dual-mode switch works

- `src/api/base44Client.js` checks `VITE_STANDALONE`:
  - `false` (default) → uses the Base44 SDK
  - `true` → uses `src/api/apiClient.js` (the standalone client that calls FastAPI)
- `src/lib/app-params.js` reads the JWT from `localStorage` in standalone mode.
- Auth is JWT-based (register → auto-login, no OTP in standalone mode).

---

## Advanced Invoicing Features

### Recurring Invoices
Set `is_recurring=true`, `recurring_frequency` (weekly/monthly/yearly), `recurring_interval`, and `next_invoice_date` on an invoice. Celery beat generates a new draft invoice clone on each scheduled date and advances the template's next date automatically.

### Automated Overdue Detection
Celery beat runs daily at 06:00 UTC — marks `sent` invoices past their `due_date` as `overdue` and applies late fees if configured (`late_fee_type`: flat or percent, `late_fee_value`).

### Overdue Email Reminders
Celery beat runs daily at 08:00 UTC — sends reminder emails to clients with overdue invoices every 3 days, up to 4 reminders. Tracks `reminder_count` and `last_reminder_date`.

### Payment Recording
`POST /api/invoices/{id}/payments` records a partial or full payment, automatically updates `amount_paid`, recalculates `balance`, and marks the invoice as `paid` when the balance reaches zero.

### Backend PDF Generation
`GET /api/invoices/{id}/pdf` generates a professional black-and-white A4 PDF using ReportLab and returns it as a file download.

### Invoice Duplication
`POST /api/invoices/{id}/duplicate` creates a draft copy of any invoice with reset payment tracking.

### Async Email Sending
`POST /api/invoices/{id}/send` queues the invoice email through the Celery worker (non-blocking) and marks the invoice as `sent`.

### Manual Task Triggers
```
POST /api/tasks/check-overdue       — run overdue detection now
POST /api/tasks/generate-recurring  — generate recurring invoices now
POST /api/tasks/send-reminders      — send overdue reminders now
```

---

## Email setup (optional)

Configure SMTP in `backend/.env` or `docker-compose.yml`:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

Without SMTP, email tasks log a skip message but don't fail.

---

## Backend structure

```
backend/
  main.py            FastAPI app (all REST endpoints)
  models.py          SQLAlchemy models (User, Company, Client, Invoice, Payment)
  schemas.py         Pydantic schemas
  auth.py            JWT + password hashing
  database.py        PostgreSQL connection
  celery_app.py      Celery instance + beat schedule
  tasks.py           Celery tasks (email, overdue, recurring, reminders)
  pdf_generator.py   ReportLab PDF generation
  requirements.txt   Python dependencies
  Dockerfile         Backend container
  .env.example       Environment template
``