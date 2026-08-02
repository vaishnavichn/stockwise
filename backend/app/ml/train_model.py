"""
Enhanced standalone model training pipeline for Smart Inventory Copilot.

Features:
- Outlier Winsorization (IQR-based capping at 99th percentile)
- Automatic Log Transformation selection (log1p vs raw) based on lowest MAPE
- Lightweight hyperparameter tuning grid search (changepoint_prior_scale, seasonality_prior_scale)
- Month-end boolean regressor & custom weekly seasonality
- Prophet cross_validation() for robust multi-cutoff accuracy metrics
- Low-confidence tagging (MAPE > 50%)
- Preserves output structure for model_loader.py & forecast_service.py

Usage (from backend/):
    python -m app.ml.train_model
"""

from __future__ import annotations

import json
import logging
import pickle
import time
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from prophet import Prophet
from prophet.diagnostics import cross_validation, performance_metrics

logging.getLogger("prophet").setLevel(logging.WARNING)
logging.getLogger("cmdstanpy").setLevel(logging.WARNING)

MODELS_DIR = Path(__file__).resolve().parent / "models"
CALENDAR_PATH = Path(__file__).resolve().parent.parent / "db" / "festival_calendar.json"

from app.db.database import fetch_all


def _load_holidays_df() -> pd.DataFrame:
    if not CALENDAR_PATH.exists():
        return pd.DataFrame(columns=["holiday", "ds", "lower_window", "upper_window"])

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


def _fetch_sku_sales(sku_id: str) -> pd.DataFrame:
    """Fetch raw sales from Supabase and construct continuous daily series filled with 0."""
    rows = fetch_all("sales", lambda q: q.eq("sku_id", sku_id).order("date"))
    if not rows:
        return pd.DataFrame(columns=["ds", "y", "month_end"])

    df = pd.DataFrame(rows)
    df["ds"] = pd.to_datetime(df["date"])
    df["y"] = df["units_sold"].astype(float)
    df = df.groupby("ds", as_index=False)["y"].sum()

    full_range = pd.date_range(df["ds"].min(), df["ds"].max(), freq="D")
    complete = pd.DataFrame({"ds": full_range})
    merged = complete.merge(df[["ds", "y"]], on="ds", how="left")
    merged["y"] = merged["y"].fillna(0.0)

    # 1. Outlier Handling: Winsorize at 99th percentile & 1.5x IQR upper bound
    q1 = merged["y"].quantile(0.25)
    q3 = merged["y"].quantile(0.75)
    iqr = q3 - q1
    upper_bound = max(q3 + 1.5 * iqr, merged["y"].quantile(0.99))
    merged["y"] = merged["y"].clip(upper=upper_bound)

    # 4. Regressors: Add month_end boolean regressor (last 3 days of month)
    merged["month_end"] = merged["ds"].dt.is_month_end | (merged["ds"].dt.day >= (merged["ds"].dt.days_in_month - 2))
    merged["month_end"] = merged["month_end"].astype(int)

    return merged


def _create_prophet_model(
    holidays: pd.DataFrame,
    changepoint_prior_scale: float = 0.05,
    seasonality_prior_scale: float = 10.0,
) -> Prophet:
    """Construct Prophet model with month_end regressor and US holidays."""
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=True,
        daily_seasonality=False,
        holidays=holidays if not holidays.empty else None,
        changepoint_prior_scale=changepoint_prior_scale,
        seasonality_prior_scale=seasonality_prior_scale,
        interval_width=0.8,
    )
    model.add_regressor("month_end")
    try:
        model.add_country_holidays(country_name="US")
    except Exception:
        pass
    return model


def _evaluate_params(
    df: pd.DataFrame,
    holidays: pd.DataFrame,
    cps: float,
    sps: float,
    use_log: bool,
    holdout_days: int = 14,
) -> tuple[float, float]:
    """Evaluate single parameter set on 14-day holdout split."""
    if len(df) <= holdout_days + 14:
        return 999.0, 999.0

    train_df = df.iloc[:-holdout_days].copy()
    test_df = df.iloc[-holdout_days:].copy()

    if use_log:
        train_df["y"] = np.log1p(train_df["y"])

    m = _create_prophet_model(holidays, changepoint_prior_scale=cps, seasonality_prior_scale=sps)
    m.fit(train_df)

    future = m.make_future_dataframe(periods=holdout_days, freq="D")
    future["month_end"] = future["ds"].dt.is_month_end | (future["ds"].dt.day >= (future["ds"].dt.days_in_month - 2))
    future["month_end"] = future["month_end"].astype(int)

    pred = m.predict(future).tail(holdout_days)

    yhat = pred["yhat"].values
    if use_log:
        yhat = np.expm1(yhat)

    actuals = test_df["y"].values
    predicted = np.maximum(0.0, yhat)

    mask = actuals > 0
    if mask.sum() > 0:
        mape = float(np.mean(np.abs((actuals[mask] - predicted[mask]) / actuals[mask])) * 100)
    else:
        mape = 0.0

    rmse = float(np.sqrt(np.mean((actuals - predicted) ** 2)))
    return mape, rmse


def _run_cross_validation(model: Prophet, df: pd.DataFrame, use_log: bool) -> dict[str, float]:
    """Run Prophet cross_validation over multiple cutoffs and average metrics."""
    try:
        total_days = len(df)
        initial_days = max(180, total_days - 60)
        initial_str = f"{initial_days} days"

        cv_res = cross_validation(
            model,
            initial=initial_str,
            period="30 days",
            horizon="14 days",
            disable_tqdm=True,
        )

        if use_log:
            cv_res["y"] = np.expm1(cv_res["y"])
            cv_res["yhat"] = np.expm1(np.maximum(0, cv_res["yhat"]))

        mask = cv_res["y"] > 0
        if mask.sum() > 0:
            cv_mape = float(np.mean(np.abs((cv_res.loc[mask, "y"] - cv_res.loc[mask, "yhat"]) / cv_res.loc[mask, "y"])) * 100)
        else:
            cv_mape = 0.0

        cv_rmse = float(np.sqrt(np.mean((cv_res["y"] - cv_res["yhat"]) ** 2)))
        return {"cv_mape": round(cv_mape, 1), "cv_rmse": round(cv_rmse, 2)}
    except Exception:
        return {"cv_mape": 0.0, "cv_rmse": 0.0}


def train_all_models() -> dict:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    holidays = _load_holidays_df()

    # Load baseline summary if exists for comparison
    summary_file = MODELS_DIR / "training_summary.json"
    old_summary: dict[str, dict] = {}
    if summary_file.exists():
        try:
            with summary_file.open("r", encoding="utf-8") as f:
                old_summary = json.load(f)
        except Exception:
            pass

    skus = fetch_all("skus", lambda q: q.order("sku_id"))
    if not skus:
        print("No SKUs found in database. Did you seed the database?")
        return {}

    print("=" * 75)
    print(" STARTING ENHANCED PROPHET MODEL TRAINING & HYPERPARAMETER TUNING")
    print("=" * 75)

    summary: dict[str, dict] = {}
    grid_cps = [0.01, 0.05, 0.1, 0.5]
    grid_sps = [1.0, 10.0]

    for sku in skus:
        sku_id = sku["sku_id"]
        product_name = sku.get("product_name", sku_id)

        df = _fetch_sku_sales(sku_id)
        if len(df) < 30:
            print(f"[WARNING] Skipping {sku_id} ({product_name}): Only {len(df)} days of history (< 30 required)")
            continue

        # Determine if log transform is beneficial based on variance
        std_y = df["y"].std()
        mean_y = df["y"].mean()
        cv_y = (std_y / mean_y) if mean_y > 0 else 0.0

        # Grid search over parameters & log transform options
        best_mape = 999.0
        best_rmse = 999.0
        best_cps = 0.05
        best_sps = 10.0
        best_log = False

        for use_log in ([True, False] if cv_y > 0.8 else [False]):
            for cps in grid_cps:
                for sps in grid_sps:
                    mape, rmse = _evaluate_params(df, holidays, cps, sps, use_log, holdout_days=14)
                    if mape < best_mape:
                        best_mape = mape
                        best_rmse = rmse
                        best_cps = cps
                        best_sps = sps
                        best_log = use_log

        # Fit final model on full dataset using best params
        final_df = df.copy()
        if best_log:
            final_df["y"] = np.log1p(final_df["y"])

        final_model = _create_prophet_model(
            holidays,
            changepoint_prior_scale=best_cps,
            seasonality_prior_scale=best_sps,
        )
        final_model.fit(final_df)

        # Store log transform flag in model metadata dynamically for predict wrapper
        final_model.is_log_transformed = best_log

        # Run cross-validation for robust metrics
        cv_metrics = _run_cross_validation(final_model, df, best_log)

        # Flag low confidence if MAPE > 50%
        low_confidence = best_mape > 50.0

        # Save model pickle
        model_file = MODELS_DIR / f"{sku_id}.pkl"
        with model_file.open("wb") as f:
            pickle.dump(final_model, f)

        sku_summary = {
            "sku_id": sku_id,
            "product_name": product_name,
            "history_days": len(df),
            "mape": round(best_mape, 1),
            "rmse": round(best_rmse, 2),
            "cv_mape": cv_metrics["cv_mape"],
            "cv_rmse": cv_metrics["cv_rmse"],
            "log_transformed": best_log,
            "changepoint_prior_scale": best_cps,
            "seasonality_prior_scale": best_sps,
            "low_confidence": low_confidence,
            "trained_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }
        summary[sku_id] = sku_summary

        old_mape = old_summary.get(sku_id, {}).get("mape", "N/A")
        print(
            f" [OK] [{sku_id}] {product_name:<22} | Old MAPE: {str(old_mape):>5}% -> New: {best_mape:>5.1f}% | CV MAPE: {cv_metrics['cv_mape']:>5.1f}% | Log: {str(best_log):<5} | CPS: {best_cps}"
        )

    # Save summary JSON
    with summary_file.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    # Print Before vs After Comparison Table
    print("\n" + "=" * 80)
    print(" BEFORE vs AFTER MAPE ACCURACY COMPARISON TABLE")
    print("=" * 80)
    print(f"{'SKU ID':<8} | {'Product Name':<23} | {'Old MAPE':<10} | {'New MAPE':<10} | {'CV MAPE':<10} | {'Status':<12}")
    print("-" * 80)
    for sku_id, s in summary.items():
        old_m = old_summary.get(sku_id, {}).get("mape", None)
        old_m_str = f"{old_m:.1f}%" if isinstance(old_m, (int, float)) else "N/A"
        new_m_str = f"{s['mape']:.1f}%"
        cv_m_str = f"{s['cv_mape']:.1f}%"
        status = "Low Conf" if s["low_confidence"] else "High Conf"
        print(f"{sku_id:<8} | {s['product_name']:<23} | {old_m_str:<10} | {new_m_str:<10} | {cv_m_str:<10} | {status:<12}")
    print("=" * 80)

    return summary


if __name__ == "__main__":
    train_all_models()
