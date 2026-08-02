"""Prophet-based demand forecasting loading pre-trained models with fallback."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd
from prophet import Prophet

from app.db.database import fetch_all
from app.ml.model_loader import load_model, get_model_accuracy

logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

CALENDAR_PATH = Path(__file__).resolve().parent.parent / "db" / "festival_calendar.json"

# In-memory context cache: key -> {model, forecast_df, history_df, forecast, periods, history_days, method, model_accuracy}
_MODEL_CACHE: dict[str, dict] = {}


def _cache_key(sku_id: str, store_id: str | None) -> str:
    return f"{sku_id}:{store_id or 'all'}"


def _fetch_sales_history(sku_id: str, store_id: str | None) -> list[dict]:
    def builder(q):
        q = q.eq("sku_id", sku_id)
        if store_id:
            q = q.eq("store_id", store_id)
        return q.order("date")

    rows = fetch_all("sales", builder)
    if not rows:
        return []

    if store_id:
        return [{"date": r["date"], "units_sold": r["units_sold"]} for r in rows]

    # Aggregate by date across stores
    df = pd.DataFrame(rows)
    agg = df.groupby("date", as_index=False)["units_sold"].sum()
    return agg.to_dict("records")


def _to_prophet_frame(rows: list[dict]) -> pd.DataFrame:
    """Build a complete daily series; missing days are filled with 0."""
    if not rows:
        return pd.DataFrame(columns=["ds", "y"])

    df = pd.DataFrame(rows)
    df["ds"] = pd.to_datetime(df["date"])
    df["y"] = df["units_sold"].astype(float)
    df = df.groupby("ds", as_index=False)["y"].sum()

    full_range = pd.date_range(df["ds"].min(), df["ds"].max(), freq="D")
    complete = pd.DataFrame({"ds": full_range})
    merged = complete.merge(df[["ds", "y"]], on="ds", how="left")
    merged["y"] = merged["y"].fillna(0.0)
    return merged


def _simple_fallback_forecast(history: pd.DataFrame, periods: int) -> list[dict]:
    """Mean-based forecast when pre-trained model is missing or history is too sparse."""
    baseline = float(history["y"].mean()) if len(history) else 0.0
    last_date = history["ds"].max() if len(history) else pd.Timestamp.today()
    future_dates = pd.date_range(last_date + pd.Timedelta(days=1), periods=periods, freq="D")

    margin = max(1.0, baseline * 0.15)
    return [
        {
            "date": day.strftime("%Y-%m-%d"),
            "predicted_units": round(baseline, 2),
            "lower_bound": round(max(0.0, baseline - margin), 2),
            "upper_bound": round(baseline + margin, 2),
        }
        for day in future_dates
    ]


def _predict_with_model(model: Prophet, periods: int) -> tuple[pd.DataFrame, list[dict]]:
    future = model.make_future_dataframe(periods=periods, freq="D")
    
    # Add month_end regressor if model expects it
    future["month_end"] = future["ds"].dt.is_month_end | (future["ds"].dt.day >= (future["ds"].dt.days_in_month - 2))
    future["month_end"] = future["month_end"].astype(int)

    forecast_df = model.predict(future)

    # Inverse transform log predictions if log1p was used during training
    is_log = getattr(model, "is_log_transformed", False)
    if is_log:
        forecast_df["yhat"] = np.expm1(np.maximum(0.0, forecast_df["yhat"]))
        forecast_df["yhat_lower"] = np.expm1(np.maximum(0.0, forecast_df["yhat_lower"]))
        forecast_df["yhat_upper"] = np.expm1(np.maximum(0.0, forecast_df["yhat_upper"]))

    future_only = forecast_df.tail(periods).copy()
    rows = [
        {
            "date": row.ds.strftime("%Y-%m-%d"),
            "predicted_units": round(max(0.0, float(row.yhat)), 2),
            "lower_bound": round(max(0.0, float(row.yhat_lower)), 2),
            "upper_bound": round(max(0.0, float(row.yhat_upper)), 2),
        }
        for row in future_only.itertuples(index=False)
    ]
    return forecast_df, rows


def generate_forecast(
    sku_id: str,
    store_id: str | None = None,
    periods: int = 30,
    *,
    use_cache: bool = True,
) -> dict:
    """
    Generate forecast using pre-trained Prophet model loaded from disk.
    If pre-trained model is missing, falls back to mean-based forecast.
    """
    sku_rows = fetch_all("skus", lambda q: q.eq("sku_id", sku_id))
    if not sku_rows:
        raise ValueError(f"SKU '{sku_id}' not found")

    key = _cache_key(sku_id, store_id)
    if use_cache and key in _MODEL_CACHE:
        cached = _MODEL_CACHE[key]
        if cached["periods"] == periods:
            return {
                "sku_id": sku_id,
                "store_id": store_id,
                "periods": periods,
                "history_days": cached["history_days"],
                "method": cached["method"],
                "model_accuracy": cached.get("model_accuracy"),
                "forecast": cached["forecast"],
            }

    raw = _fetch_sales_history(sku_id, store_id)
    if not raw:
        raise ValueError(f"No sales history for SKU '{sku_id}'")

    history = _to_prophet_frame(raw)

    # Load pre-trained model
    model = None
    try:
        model = load_model(sku_id)
    except FileNotFoundError:
        logging.warning("No pre-trained model found for %s. Using mean_fallback.", sku_id)

    if model is not None:
        method = "pretrained_prophet"
        forecast_df, forecast_rows = _predict_with_model(model, periods)
        accuracy = get_model_accuracy(sku_id)
    else:
        method = "mean_fallback"
        forecast_df = pd.DataFrame()
        forecast_rows = _simple_fallback_forecast(history, periods)
        accuracy = None

    _MODEL_CACHE[key] = {
        "model": model,
        "forecast_df": forecast_df,
        "history_df": history,
        "forecast": forecast_rows,
        "periods": periods,
        "history_days": len(history),
        "method": method,
        "model_accuracy": accuracy,
        "sku_id": sku_id,
        "store_id": store_id,
    }

    return {
        "sku_id": sku_id,
        "store_id": store_id,
        "periods": periods,
        "history_days": len(history),
        "method": method,
        "model_accuracy": accuracy,
        "forecast": forecast_rows,
    }


def get_cached_forecast_context(sku_id: str, store_id: str | None = None) -> dict | None:
    return _MODEL_CACHE.get(_cache_key(sku_id, store_id))


def clear_forecast_cache() -> None:
    _MODEL_CACHE.clear()
