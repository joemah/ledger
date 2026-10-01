"""Email sending service — SMTP transport."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import base64 as b64mod

from config import settings


def send_email(to, subject, body=None, html=None, from_name=None, attachments=None):
    """Send an email via SMTP. Returns (success: bool, message: str)."""
    if not settings.SMTP_HOST:
        print(f"[email] SMTP not configured — skipping send to {to}")
        return False, "SMTP not configured"

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = f"{from_name or 'ProInvoice'} <{settings.SMTP_USER}>"
    msg["To"] = to
    if html:
        msg.attach(MIMEText(html, "html"))
    elif body:
        msg.attach(MIMEText(body, "plain"))

    if attachments:
        for att in attachments:
            filename = att.get("filename", "attachment")
            part = MIMEBase("application", "octet-stream")
            if att.get("content"):
                part.set_payload(b64mod.b64decode(att["content"]))
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", f'attachment; filename="{filename}"')
            msg.attach(part)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.send_message(msg)

    return True, "sent"