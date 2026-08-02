"""Reorder point and dead-stock detection helpers."""

from __future__ import annotations

import pandas as pd

from app.db.database import fetch_all
from app.services.forecast_service import generate_forecast


def _latest_stock_on_hand(sku_id: str, store_id: str | None) -> int:
    if store_id:
        rows = fetch_all(
            """
            SELECT stock_on_hand
            FROM sales
            WHERE sku_id = :sku_id AND store_id = :store_id
            ORDER BY date DESC
            LIMIT 1
            """,
            {"sku_id": sku_id, "store_id": store_id},
        )
    else:
        rows = fetch_all(
            """
            SELECT SUM(stock_on_hand) AS stock_on_hand
            FROM (
                SELECT DISTINCT ON (store_id) store_id, stock_on_hand
                FROM sales
                WHERE sku_id = :sku_id
                ORDER BY store_id, date DESC
            ) latest_by_store
            """,
            {"sku_id": sku_id},
        )

    if not rows:
        return 0
    return int(rows[0]["stock_on_hand"] or 0)


def calculate_reorder_point(
    sku_id: str,
    store_id: str | None = None,
    lead_time_days: int = 3,
    safety_stock_days: int = 2,
    forecast_days: int = 30,
) -> dict:
    """
    reorder_point = avg_daily_demand × (lead_time + safety_stock)
    Compare against latest stock_on_hand.
    """
    sku_meta = fetch_all(
        "SELECT sku_id, product_name, category, unit_price FROM skus WHERE sku_id = :sku_id",
        {"sku_id": sku_id},
    )
    if not sku_meta:
        raise ValueError(f"SKU '{sku_id}' not found")

    forecast = generate_forecast(sku_id, store_id=store_id, periods=forecast_days)
    predicted = pd.Series([row["predicted_units"] for row in forecast["forecast"]])
    avg_daily_demand = float(predicted.mean())

    coverage_days = lead_time_days + safety_stock_days
    reorder_point = round(avg_daily_demand * coverage_days, 2)
    stock_on_hand = _latest_stock_on_hand(sku_id, store_id)
    needs_reorder = stock_on_hand < reorder_point
    reorder_qty = round(max(0.0, reorder_point - stock_on_hand), 2)

    return {
        "sku_id": sku_id,
        "product_name": sku_meta[0]["product_name"],
        "store_id": store_id,
        "avg_daily_demand": round(avg_daily_demand, 2),
        "lead_time_days": lead_time_days,
        "safety_stock_days": safety_stock_days,
        "reorder_point": reorder_point,
        "stock_on_hand": stock_on_hand,
        "needs_reorder": needs_reorder,
        "reorder_quantity": reorder_qty,
    }


def detect_dead_stock(threshold_days: int = 14, decline_pct: float = 30.0) -> dict:
    """
    Flag SKUs whose recent sales velocity dropped vs the prior period.
    """
    skus = fetch_all("SELECT sku_id, product_name, category FROM skus ORDER BY sku_id")
    flagged: list[dict] = []

    for sku in skus:
        rows = fetch_all(
            """
            SELECT date, SUM(units_sold) AS units_sold
            FROM sales
            WHERE sku_id = :sku_id
            GROUP BY date
            ORDER BY date ASC
            """,
            {"sku_id": sku["sku_id"]},
        )
        if len(rows) < threshold_days * 2:
            continue

        series = pd.DataFrame(rows)
        series["date"] = pd.to_datetime(series["date"])
        series["units_sold"] = series["units_sold"].astype(float)

        recent = series.tail(threshold_days)["units_sold"].mean()
        prior = series.iloc[-threshold_days * 2 : -threshold_days]["units_sold"].mean()

        if prior <= 0:
            continue

        change_pct = (recent - prior) / prior * 100
        if change_pct <= -decline_pct:
            flagged.append(
                {
                    "sku_id": sku["sku_id"],
                    "product_name": sku["product_name"],
                    "category": sku["category"],
                    "recent_daily_avg": round(float(recent), 2),
                    "prior_daily_avg": round(float(prior), 2),
                    "decline_pct": round(float(change_pct), 1),
                }
            )

    flagged.sort(key=lambda x: x["decline_pct"])
    return {
        "threshold_days": threshold_days,
        "decline_pct_threshold": decline_pct,
        "count": len(flagged),
        "flagged_skus": flagged,
    }
