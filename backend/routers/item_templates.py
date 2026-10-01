"""Line item template CRUD — reusable groups of invoice line items."""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import ItemTemplate
from schemas import ItemTemplateBase, ItemTemplateOut
from utils import apply_filters, apply_sort
from auth import get_current_user

router = APIRouter(prefix="/api/item-templates", tags=["item-templates"], dependencies=[Depends(get_current_user)])


@router.get("")
def list_templates(sort: str = "-created_date", limit: int = 200, filter: str = None, db: Session = Depends(get_db)):
    query = db.query(ItemTemplate)
    if filter:
        query = apply_filters(query, ItemTemplate, json.loads(filter))
    query = apply_sort(query, ItemTemplate, sort)
    return {"items": query.limit(limit).all()}


@router.get("/{template_id}", response_model=ItemTemplateOut)
def get_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(ItemTemplate).filter(ItemTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.post("", response_model=ItemTemplateOut)
def create_template(template: ItemTemplateBase, db: Session = Depends(get_db)):
    db_template = ItemTemplate(**template.model_dump())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


@router.put("/{template_id}", response_model=ItemTemplateOut)
def update_template(template_id: str, template: ItemTemplateBase, db: Session = Depends(get_db)):
    db_template = db.query(ItemTemplate).filter(ItemTemplate.id == template_id).first()
    if not db_template:
        raise HTTPException(status_code=404, detail="Template not found")
    for key, value in template.model_dump().items():
        setattr(db_template, key, value)
    db.commit()
    db.refresh(db_template)
    return db_template


@router.delete("/{template_id}")
def delete_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(ItemTemplate).filter(ItemTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(template)
    db.commit()
    return {"ok": True}