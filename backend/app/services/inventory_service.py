"""Reorder point and dead-stock detection helpers using Supabase queries with efficient caching."""

from __future__ import annotations

import pandas as pd
from app.db.database import fetch_all
from app.services.forecast_service import generate_forecast

_STOCK_CACHE: dict[str, int] = {}


def _latest_stock_on_hand(sku_id: str, store_id: str | None) -> int:
    cache_key = f"{sku_id}:{store_id or 'all'}"
    if cache_key in _STOCK_CACHE:
        return _STOCK_CACHE[cache_key]

    def builder(q):
        q = q.eq("sku_id", sku_id)
        if store_id:
            q = q.eq("store_id", store_id)
        return q.order("date", desc=True)

    rows = fetch_all("sales", builder)
    if not rows:
        _STOCK_CACHE[cache_key] = 0
        return 0

    if store_id:
        val = rows[0].get("stock_on_hand_estimate") or rows[0].get("stock_on_hand") or 0
        res = int(round(float(val)))
        _STOCK_CACHE[cache_key] = res
        return res

    latest_by_store: dict[str, float] = {}
    for r in rows:
        st = r["store_id"]
        if st not in latest_by_store:
            val = r.get("stock_on_hand_estimate") or r.get("stock_on_hand") or 0
            latest_by_store[st] = float(val)

    res = int(round(sum(latest_by_store.values())))
    _STOCK_CACHE[cache_key] = res
    return res


def calculate_reorder_point(
    sku_id: str,
    store_id: str | None = None,
    lead_time_days: int = 3,
    safety_stock_days: int = 2,
    forecast_days: int = 30,
) -> dict:
    """
    reorder_point = avg_daily_demand × (lead_time + safety_stock)
    Compare against latest stock_on_hand_estimate.
    """
    sku_meta = fetch_all("skus", lambda q: q.eq("sku_id", sku_id))
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


def detect_dead_stock(
    threshold_days: int = 14,
    decline_pct_threshold: float = 30.0,
) -> dict:
    """
    Flag SKUs whose recent daily sales dropped by > decline_pct_threshold %
    compared to their prior baseline.
    """
    skus = fetch_all("skus", lambda q: q.order("sku_id"))
    flagged: list[dict] = []

    for s in skus:
        sku_id = s["sku_id"]
        rows = fetch_all("sales", lambda q: q.eq("sku_id", sku_id).order("date"))
        if len(rows) < threshold_days * 2:
            continue

        df = pd.DataFrame(rows)
        df["ds"] = pd.to_datetime(df["date"])
        df["y"] = df["units_sold"].astype(float)
        df = df.groupby("ds", as_index=False)["y"].sum().sort_values("ds")

        recent = df.tail(threshold_days)["y"]
        prior = df.iloc[-2 * threshold_days : -threshold_days]["y"]

        recent_avg = float(recent.mean())
        prior_avg = float(prior.mean())

        if prior_avg <= 0:
            continue

        decline_pct = ((recent_avg - prior_avg) / prior_avg) * 100.0
        if decline_pct < -decline_pct_threshold:
            flagged.append(
                {
                    "sku_id": sku_id,
                    "product_name": s["product_name"],
                    "category": s["category"],
                    "recent_daily_avg": round(recent_avg, 2),
                    "prior_daily_avg": round(prior_avg, 2),
                    "decline_pct": round(decline_pct, 1),
                }
            )

    return {
        "threshold_days": threshold_days,
        "decline_pct_threshold": decline_pct_threshold,
        "count": len(flagged),
        "flagged_skus": flagged,
    }
