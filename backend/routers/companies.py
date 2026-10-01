"""Company CRUD routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Company
from schemas import CompanyBase, CompanyOut
from auth import get_current_user

router = APIRouter(prefix="/api/companies", tags=["companies"], dependencies=[Depends(get_current_user)])


@router.get("")
def list_companies(limit: int = 100, db: Session = Depends(get_db)):
    return {"items": db.query(Company).limit(limit).all()}


@router.post("", response_model=CompanyOut)
def create_company(company: CompanyBase, db: Session = Depends(get_db)):
    db_company = Company(**company.model_dump())
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company


@router.put("/{company_id}", response_model=CompanyOut)
def update_company(company_id: str, company: CompanyBase, db: Session = Depends(get_db)):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        raise HTTPException(status_code=404, detail="Company not found")
    for key, value in company.model_dump().items():
        setattr(db_company, key, value)
    db.commit()
    db.refresh(db_company)
    return db_company