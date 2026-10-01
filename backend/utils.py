"""Shared utility functions for query building."""
from sqlalchemy import desc, asc


def apply_filters(query, model, filter_dict):
    """Apply MongoDB-style filters ($gte, $lt, $gt, $lte, $ne, $in) to a SQLAlchemy query."""
    if not filter_dict:
        return query
    for field, cond in filter_dict.items():
        col = getattr(model, field, None)
        if col is None:
            continue
        if isinstance(cond, dict):
            if "$gte" in cond:
                query = query.filter(col >= cond["$gte"])
            if "$lt" in cond:
                query = query.filter(col < cond["$lt"])
            if "$gt" in cond:
                query = query.filter(col > cond["$gt"])
            if "$lte" in cond:
                query = query.filter(col <= cond["$lte"])
            if "$ne" in cond:
                query = query.filter(col != cond["$ne"])
            if "$in" in cond:
                query = query.filter(col.in_(cond["$in"]))
        else:
            query = query.filter(col == cond)
    return query


def apply_sort(query, model, sort):
    """Apply sort to a SQLAlchemy query. Prefix with - for descending."""
    if sort.startswith("-"):
        return query.order_by(desc(getattr(model, sort[1:])))
    return query.order_by(asc(getattr(model, sort)))