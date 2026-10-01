"""Email sending route (synchronous, backwards-compatible)."""
from fastapi import APIRouter, Depends

from schemas import EmailRequest
from services.email_service import send_email
from auth import get_current_user

router = APIRouter(prefix="/api", tags=["email"], dependencies=[Depends(get_current_user)])


@router.post("/email")
def email(req: EmailRequest):
    success, message = send_email(
        req.to,
        req.subject,
        body=req.body,
        html=req.html,
        from_name=req.from_name,
        attachments=req.attachments,
    )
    return {"ok": success, "message": message}