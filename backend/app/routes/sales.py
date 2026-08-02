"""Sales history endpoints — consumed by forecasting in Phase 2."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.db.database import fetch_all

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("/{sku_id}")
def get_sales_history(
    sku_id: str,
    store_id: str | None = Query(default=None, description="Optional store filter"),
) -> dict:
    """
    Return raw historical sales for a SKU.
    Phase 2 will aggregate this series for Prophet training.
    """
    sku_rows = fetch_all(
        "SELECT sku_id, product_name, category, unit_price FROM skus WHERE sku_id = :sku_id",
        {"sku_id": sku_id},
    )
    if not sku_rows:
        raise HTTPException(status_code=404, detail=f"SKU '{sku_id}' not found")

    query = """
        SELECT s.date, s.store_id, st.store_name, s.sku_id, sk.product_name,
               sk.category, s.units_sold, sk.unit_price AS price, s.stock_on_hand
        FROM sales s
        JOIN stores st ON st.store_id = s.store_id
        JOIN skus sk ON sk.sku_id = s.sku_id
        WHERE s.sku_id = :sku_id
    """
    params: dict = {"sku_id": sku_id}

    if store_id:
        query += " AND s.store_id = :store_id"
        params["store_id"] = store_id

    query += " ORDER BY s.date ASC, s.store_id ASC"

    rows = fetch_all(query, params)
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No sales records found for SKU '{sku_id}'",
        )

    for row in rows:
        row["date"] = row["date"].isoformat()
        row["price"] = float(row["price"])

    return {
        "sku_id": sku_id,
        "count": len(rows),
        "data": rows,
    }
