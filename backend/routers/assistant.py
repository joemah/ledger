"""Invoice assistant conversation endpoints.

Self-hosted assistant runtime. Conversations and messages are persisted in
PostgreSQL; the LLM tool-calling loop runs through services/llm_service.py +
services/assistant_service.py.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import AssistantConversation, AssistantMessage
from services.assistant_service import run_assistant
from auth import get_current_user

router = APIRouter(prefix="/api/assistant", tags=["assistant"], dependencies=[Depends(get_current_user)])


class ConversationCreate(BaseModel):
    title: str | None = "New conversation"


class MessageCreate(BaseModel):
    content: str


def _serialize_conversation(c: AssistantConversation):
    return {
        "id": c.id,
        "title": c.title,
        "created_date": c.created_date.isoformat() if c.created_date else None,
        "updated_date": c.updated_date.isoformat() if c.updated_date else None,
    }


def _serialize_message(m: AssistantMessage):
    return {
        "id": m.id,
        "conversation_id": m.conversation_id,
        "role": m.role,
        "content": m.content,
        "tool_calls": m.tool_calls,
        "tool_name": m.tool_name,
        "tool_call_id": m.tool_call_id,
        "created_date": m.created_date.isoformat() if m.created_date else None,
    }


def _history_from_messages(messages: list[AssistantMessage]) -> list[dict]:
    """Reconstruct the LLM transcript (including tool messages) for the next turn."""
    import json

    history = []
    for m in messages:
        if m.role == "user":
            history.append({"role": "user", "content": m.content})
        elif m.role == "assistant":
            entry = {"role": "assistant", "content": m.content}
            if m.tool_calls:
                entry["tool_calls"] = m.tool_calls
            history.append(entry)
        elif m.role == "tool":
            content = m.content
            if isinstance(content, str):
                try:
                    content = json.loads(content)
                except (ValueError, TypeError):
                    pass
            history.append({
                "role": "tool",
                "tool_call_id": m.tool_call_id,
                "name": m.tool_name,
                "content": content,
            })
    return history


@router.get("/conversations")
def list_conversations(db: Session = Depends(get_db)):
    convos = db.query(AssistantConversation).order_by(AssistantConversation.updated_date.desc()).all()
    return {"items": [_serialize_conversation(c) for c in convos]}


@router.post("/conversations")
def create_conversation(body: ConversationCreate, db: Session = Depends(get_db)):
    convo = AssistantConversation(title=body.title or "New conversation")
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return _serialize_conversation(convo)


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    convo = db.query(AssistantConversation).filter(AssistantConversation.id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.query(AssistantMessage).filter(AssistantMessage.conversation_id == conversation_id).delete()
    db.delete(convo)
    db.commit()
    return {"ok": True}


@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: str, db: Session = Depends(get_db)):
    messages = (
        db.query(AssistantMessage)
        .filter(AssistantMessage.conversation_id == conversation_id)
        .order_by(AssistantMessage.created_date.asc())
        .all()
    )
    return {"items": [_serialize_message(m) for m in messages]}


@router.post("/conversations/{conversation_id}/messages")
def send_message(conversation_id: str, body: MessageCreate, db: Session = Depends(get_db)):
    convo = db.query(AssistantConversation).filter(AssistantConversation.id == conversation_id).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if not body.content or not body.content.strip():
        raise HTTPException(status_code=400, detail="Message content is required")

    existing = (
        db.query(AssistantMessage)
        .filter(AssistantMessage.conversation_id == conversation_id)
        .order_by(AssistantMessage.created_date.asc())
        .all()
    )
    history = _history_from_messages(existing)

    # Persist the user message
    user_msg = AssistantMessage(conversation_id=conversation_id, role="user", content=body.content)
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    try:
        new_messages = run_assistant(db, history, body.content)
    except Exception as exc:  # noqa: BLE001 - surface LLM/provider errors to the client
        db.rollback()
        raise HTTPException(status_code=502, detail=f"Assistant error: {exc}") from exc

    import json as _json

    saved = [_serialize_message(user_msg)]
    for msg in new_messages:
        content = msg.get("content")
        if msg["role"] == "tool" and content is not None and not isinstance(content, str):
            content = _json.dumps(content)
        record = AssistantMessage(
            conversation_id=conversation_id,
            role=msg["role"],
            content=content,
            tool_calls=msg.get("tool_calls"),
            tool_name=msg.get("name"),
            tool_call_id=msg.get("tool_call_id"),
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        saved.append(_serialize_message(record))

    convo.updated_date = datetime.utcnow()
    db.commit()

    return {"items": saved}