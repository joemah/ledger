"""Expense CRUD + aggregate routes for P&L reporting."""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Expense
from schemas import ExpenseBase, ExpenseOut
from utils import apply_filters, apply_sort
from auth import get_current_user

router = APIRouter(prefix="/api/expenses", tags=["expenses"], dependencies=[Depends(get_current_user)])


@router.get("")
def list_expenses(sort: str = "-created_date", limit: int = 200, filter: str = None, db: Session = Depends(get_db)):
    query = db.query(Expense)
    if filter:
        query = apply_filters(query, Expense, json.loads(filter))
    query = apply_sort(query, Expense, sort)
    return {"items": query.limit(limit).all()}


@router.get("/aggregate")
def aggregate_expenses(groupBy: str = None, sum: str = None, dateBucket: str = None, db: Session = Depends(get_db)):
    if groupBy == "category":
        rows = (
            db.query(
                Expense.category,
                func.count(Expense.id).label("count"),
                func.sum(Expense.amount).label("sum_amount"),
            )
            .group_by(Expense.category)
            .order_by(func.sum(Expense.amount).desc())
            .all()
        )
        return {"rows": [{"category": r.category, "count": r.count, "sum_amount": r.sum_amount or 0} for r in rows]}

    if dateBucket == "month":
        rows = (
            db.query(
                func.to_char(Expense.expense_date, 'YYYY-MM').label("month"),
                func.count(Expense.id).label("count"),
                func.sum(Expense.amount).label("sum_amount"),
            )
            .filter(Expense.expense_date != None)
            .group_by("month")
            .order_by("month")
            .all()
        )
        return {"rows": [{"month": r.month, "count": r.count, "sum_amount": r.sum_amount or 0} for r in rows]}

    return {"rows": []}


@router.get("/summary")
def expense_summary(db: Session = Depends(get_db)):
    """P&L summary: total income (paid invoices), total expenses, net profit, category breakdown."""
    from models import Invoice
    from datetime import date as date_cls

    today = date_cls.today()
    year_start = date_cls(today.year, 1, 1)
    month_start = date_cls(today.year, today.month, 1)

    # Total income from paid invoices
    income_total = db.query(func.sum(Invoice.total)).filter(Invoice.status == "paid").scalar() or 0
    income_this_year = (
        db.query(func.sum(Invoice.total))
        .filter(Invoice.status == "paid", Invoice.issue_date >= year_start)
        .scalar()
        or 0
    )
    income_this_month = (
        db.query(func.sum(Invoice.total))
        .filter(Invoice.status == "paid", Invoice.issue_date >= month_start)
        .scalar()
        or 0
    )

    # Total expenses
    expense_total = db.query(func.sum(Expense.amount)).scalar() or 0
    expense_this_year = (
        db.query(func.sum(Expense.amount)).filter(Expense.expense_date >= year_start).scalar() or 0
    )
    expense_this_month = (
        db.query(func.sum(Expense.amount)).filter(Expense.expense_date >= month_start).scalar() or 0
    )
    tax_deductible_total = (
        db.query(func.sum(Expense.amount)).filter(Expense.tax_deductible == True).scalar() or 0
    )

    # Category breakdown
    cat_rows = (
        db.query(
            Expense.category,
            func.sum(Expense.amount).label("sum_amount"),
            func.count(Expense.id).label("count"),
        )
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )
    categories = [
        {"category": r.category, "sum_amount": r.sum_amount or 0, "count": r.count}
        for r in cat_rows
    ]

    # Monthly comparison (last 12 months)
    monthly_rows = (
        db.query(
            func.to_char(Expense.expense_date, 'YYYY-MM').label("month"),
            func.sum(Expense.amount).label("expenses"),
        )
        .filter(Expense.expense_date != None)
        .group_by("month")
        .order_by("month")
        .limit(12)
        .all()
    )
    monthly_expenses = [{"month": r.month, "expenses": r.expenses or 0} for r in monthly_rows]

    income_monthly_rows = (
        db.query(
            func.to_char(Invoice.issue_date, 'YYYY-MM').label("month"),
            func.sum(Invoice.total).label("income"),
        )
        .filter(Invoice.status == "paid", Invoice.issue_date != None)
        .group_by("month")
        .order_by("month")
        .limit(12)
        .all()
    )
    monthly_income = [{"month": r.month, "income": r.income or 0} for r in income_monthly_rows]

    return {
        "income_total": income_total,
        "income_this_year": income_this_year,
        "income_this_month": income_this_month,
        "expense_total": expense_total,
        "expense_this_year": expense_this_year,
        "expense_this_month": expense_this_month,
        "tax_deductible_total": tax_deductible_total,
        "net_profit": income_total - expense_total,
        "net_profit_this_year": income_this_year - expense_this_year,
        "net_profit_this_month": income_this_month - expense_this_month,
        "categories": categories,
        "monthly_expenses": monthly_expenses,
        "monthly_income": monthly_income,
    }


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: str, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.post("", response_model=ExpenseOut)
def create_expense(expense: ExpenseBase, db: Session = Depends(get_db)):
    db_expense = Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: str, expense: ExpenseBase, db: Session = Depends(get_db)):
    db_expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not db_expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    for key, value in expense.model_dump().items():
        setattr(db_expense, key, value)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@router.delete("/{expense_id}")
def delete_expense(expense_id: str, db: Session = Depends(get_db)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"ok": True}