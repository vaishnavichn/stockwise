"""Sales history endpoints using Supabase queries."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.db.database import fetch_all

router = APIRouter(prefix="/sales", tags=["sales"])


@router.get("/{sku_id}")
def get_sales_history(
    sku_id: str,
    store_id: str | None = Query(default=None, description="Optional store filter"),
) -> dict:
    """Return historical sales for a SKU from Supabase."""
    sku_rows = fetch_all("skus", lambda q: q.eq("sku_id", sku_id))
    if not sku_rows:
        raise HTTPException(status_code=404, detail=f"SKU '{sku_id}' not found")

    sku = sku_rows[0]

    def builder(q):
        q = q.eq("sku_id", sku_id)
        if store_id:
            q = q.eq("store_id", store_id)
        return q.order("date").order("store_id")

    rows = fetch_all("sales", builder)
    if not rows:
        raise HTTPException(
            status_code=404,
            detail=f"No sales records found for SKU '{sku_id}'",
        )

    formatted_data = []
    for r in rows:
        formatted_data.append({
            "date": str(r["date"]),
            "store_id": r["store_id"],
            "sku_id": r["sku_id"],
            "product_name": sku["product_name"],
            "category": sku["category"],
            "units_sold": r["units_sold"],
            "price": float(sku["unit_price"]),
            "stock_on_hand": r.get("stock_on_hand_estimate") or r.get("stock_on_hand") or 0,
        })

    return {
        "sku_id": sku_id,
        "count": len(formatted_data),
        "data": formatted_data,
    }
