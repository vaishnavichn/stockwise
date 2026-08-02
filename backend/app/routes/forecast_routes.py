"""Forecasting and inventory optimization endpoints (Phase 2)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.services.explain_service import explain_forecast
from app.services.forecast_service import generate_forecast
from app.services.inventory_service import calculate_reorder_point, detect_dead_stock

forecast_router = APIRouter(prefix="/forecast", tags=["forecast"])
inventory_router = APIRouter(prefix="/inventory", tags=["inventory"])


@forecast_router.get("/{sku_id}/explain")
def get_forecast_explanation(
    sku_id: str,
    store_id: str | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=90),
) -> dict:
    try:
        forecast_result = generate_forecast(sku_id, store_id=store_id, periods=days)
        return explain_forecast(sku_id, forecast_result=forecast_result, store_id=store_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@forecast_router.get("/{sku_id}")
def get_forecast(
    sku_id: str,
    store_id: str | None = Query(default=None),
    days: int = Query(default=30, ge=1, le=90),
) -> dict:
    try:
        return generate_forecast(sku_id, store_id=store_id, periods=days)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@inventory_router.get("/reorder/{sku_id}")
def get_reorder_recommendation(
    sku_id: str,
    store_id: str | None = Query(default=None),
    lead_time_days: int = Query(default=3, ge=1, le=30),
    safety_stock_days: int = Query(default=2, ge=0, le=30),
) -> dict:
    try:
        return calculate_reorder_point(
            sku_id,
            store_id=store_id,
            lead_time_days=lead_time_days,
            safety_stock_days=safety_stock_days,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@inventory_router.get("/dead-stock")
def get_dead_stock(
    threshold_days: int = Query(default=14, ge=7, le=60),
    decline_pct: float = Query(default=30.0, ge=5.0, le=95.0),
) -> dict:
    return detect_dead_stock(threshold_days=threshold_days, decline_pct=decline_pct)
