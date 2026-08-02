"""Prophet-based demand forecasting with festival holidays and in-memory model cache."""

from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd
from prophet import Prophet

from app.db.database import fetch_all

logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

CALENDAR_PATH = Path(__file__).resolve().parent.parent / "db" / "festival_calendar.json"

# In-memory cache: key -> {model, full_predict_df, history_df, forecast_rows, meta}
_MODEL_CACHE: dict[str, dict] = {}


def _cache_key(sku_id: str, store_id: str | None) -> str:
    return f"{sku_id}:{store_id or 'all'}"


def _load_holidays_df() -> pd.DataFrame:
    with CALENDAR_PATH.open(encoding="utf-8") as f:
        calendar = json.load(f)

    rows: list[dict] = []
    for event in calendar["events"]:
        for day in pd.date_range(event["start_date"], event["end_date"], freq="D"):
            rows.append(
                {
                    "holiday": event["name"],
                    "ds": pd.Timestamp(day),
                    "lower_window": 0,
                    "upper_window": 0,
                }
            )
    return pd.DataFrame(rows)


def _fetch_sales_history(sku_id: str, store_id: str | None) -> list[dict]:
    if store_id:
        query = """
            SELECT date, units_sold
            FROM sales
            WHERE sku_id = :sku_id AND store_id = :store_id
            ORDER BY date ASC
        """
        params = {"sku_id": sku_id, "store_id": store_id}
    else:
        query = """
            SELECT date, SUM(units_sold) AS units_sold
            FROM sales
            WHERE sku_id = :sku_id
            GROUP BY date
            ORDER BY date ASC
        """
        params = {"sku_id": sku_id}

    return fetch_all(query, params)


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
    """Mean-based forecast when history is too sparse for Prophet."""
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


def _train_and_predict(history: pd.DataFrame, periods: int) -> tuple[Prophet | None, pd.DataFrame, list[dict]]:
    if len(history) < 14:
        return None, history.copy(), _simple_fallback_forecast(history, periods)

    holidays = _load_holidays_df()
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        holidays=holidays,
        interval_width=0.8,
    )
    model.fit(history)

    future = model.make_future_dataframe(periods=periods, freq="D")
    forecast_df = model.predict(future)

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
    return model, forecast_df, rows


def generate_forecast(
    sku_id: str,
    store_id: str | None = None,
    periods: int = 30,
    *,
    use_cache: bool = True,
) -> dict:
    """
    Train Prophet (or fallback) and forecast the next `periods` days.

    Returns forecast rows plus metadata. Full Prophet output is stored in cache
    for explainability and inventory calculations.
    """
    sku_rows = fetch_all(
        "SELECT sku_id FROM skus WHERE sku_id = :sku_id",
        {"sku_id": sku_id},
    )
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
                "forecast": cached["forecast"],
            }

    raw = _fetch_sales_history(sku_id, store_id)
    if not raw:
        raise ValueError(f"No sales history for SKU '{sku_id}'")

    history = _to_prophet_frame(raw)
    model, forecast_df, forecast_rows = _train_and_predict(history, periods)
    method = "prophet" if model is not None else "mean_fallback"

    _MODEL_CACHE[key] = {
        "model": model,
        "forecast_df": forecast_df,
        "history_df": history,
        "forecast": forecast_rows,
        "periods": periods,
        "history_days": len(history),
        "method": method,
        "sku_id": sku_id,
        "store_id": store_id,
    }

    return {
        "sku_id": sku_id,
        "store_id": store_id,
        "periods": periods,
        "history_days": len(history),
        "method": method,
        "forecast": forecast_rows,
    }


def get_cached_forecast_context(sku_id: str, store_id: str | None = None) -> dict | None:
    return _MODEL_CACHE.get(_cache_key(sku_id, store_id))
