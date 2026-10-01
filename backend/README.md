# ProInvoice API — FastAPI + PostgreSQL

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # edit with your PostgreSQL URL + secret key
```

## Create the database

```sql
CREATE DATABASE proinvoice;
```

Tables are created automatically on first run (`Base.metadata.create_all`).

## Run

```bash
uvicorn main:app --reload --port 8000
```

API docs at `http://localhost:8000/docs`.

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | JWT signing secret (change in production!) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `UPLOAD_DIR` | Where uploaded files are stored |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Email server for sending invoices |

## Endpoints

- `POST /api/auth/register` — register, returns JWT
- `POST /api/auth/login` — login, returns JWT
- `GET /api/auth/me` — current user
- `POST /api/auth/reset-request` — request password reset
- `POST /api/auth/reset` — reset password with token
- `GET/POST/PUT /api/companies` — company CRUD
- `GET/POST/PUT/DELETE /api/clients` — client CRUD
- `GET/POST/PUT/DELETE /api/invoices` — invoice CRUD
- `GET /api/invoices/count` — count with optional filter
- `GET /api/invoices/aggregate` — groupBy + sum aggregation
- `POST /api/upload` — file upload (returns public URL)
- `POST /api/email` — send email with optional attachments