"""Expense business logic: P&L calculations and reporting helpers."""
from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Expense, Invoice


def get_profit_loss(db: Session, start_date: date = None, end_date: date = None):
    """Compute profit & loss for an optional date range.

    Returns dict with income, expenses, net_profit, and category breakdown.
    """
    inv_q = db.query(Invoice).filter(Invoice.status == "paid")
    exp_q = db.query(Expense)

    if start_date:
        inv_q = inv_q.filter(Invoice.issue_date >= start_date)
        exp_q = exp_q.filter(Expense.expense_date >= start_date)
    if end_date:
        inv_q = inv_q.filter(Invoice.issue_date <= end_date)
        exp_q = exp_q.filter(Expense.expense_date <= end_date)

    income = inv_q.with_entities(func.sum(Invoice.total)).scalar() or 0
    expenses = exp_q.with_entities(func.sum(Expense.amount)).scalar() or 0

    cat_rows = (
        db.query(
            Expense.category,
            func.sum(Expense.amount).label("sum_amount"),
        )
        .group_by(Expense.category)
        .order_by(func.sum(Expense.amount).desc())
        .all()
    )
    categories = [
        {"category": r.category, "sum_amount": r.sum_amount or 0}
        for r in cat_rows
    ]

    return {
        "income": income,
        "expenses": expenses,
        "net_profit": income - expenses,
        "categories": categories,
    }