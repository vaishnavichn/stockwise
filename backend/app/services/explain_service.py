"""Rule-based forecast explainability using Prophet component decomposition."""

from __future__ import annotations

import pandas as pd

from app.services.forecast_service import generate_forecast, get_cached_forecast_context

# Map Prophet holiday column names to user-friendly labels.
HOLIDAY_LABELS = {
    "New Year": "Festival (New Year)",
    "Holi": "Festival (Holi)",
    "Exam Season (Spring)": "Exam season",
    "Diwali": "Festival (Diwali)",
    "Pre-Diwali Shopping": "Festival (Pre-Diwali)",
    "Exam Season (Autumn)": "Exam season",
    "Year End": "Festival (Year End)",
}


def _recent_baseline(history_df: pd.DataFrame, window: int = 30) -> float:
    tail = history_df.tail(window)
    return float(tail["y"].mean()) if len(tail) else 0.0


def _component_columns(forecast_df: pd.DataFrame) -> dict[str, str]:
    """Return logical component -> dataframe column name."""
    mapping: dict[str, str] = {}
    if "trend" in forecast_df.columns:
        mapping["Trend"] = "trend"
    if "weekly" in forecast_df.columns:
        mapping["Weekly seasonality"] = "weekly"
    if "yearly" in forecast_df.columns:
        mapping["Yearly seasonality"] = "yearly"
    if "holidays" in forecast_df.columns:
        mapping["Festivals & events"] = "holidays"
    return mapping


def explain_forecast(
    sku_id: str,
    forecast_result: dict | None = None,
    store_id: str | None = None,
    baseline_window: int = 30,
) -> dict:
    """
    Compare forecast vs recent baseline and attribute change to Prophet components.

    Uses Prophet's trend / weekly / yearly / holidays outputs — not invented SHAP values.
    """
    if forecast_result is None:
        periods = 30
        forecast_result = generate_forecast(sku_id, store_id=store_id, periods=periods)
    else:
        periods = forecast_result.get("periods", 30)

    ctx = get_cached_forecast_context(sku_id, store_id)
    if ctx is None:
        generate_forecast(sku_id, store_id=store_id, periods=periods, use_cache=False)
        ctx = get_cached_forecast_context(sku_id, store_id)
    if ctx is None:
        raise ValueError(f"Unable to build explainability context for SKU '{sku_id}'")

    history_df: pd.DataFrame = ctx["history_df"]
    forecast_df: pd.DataFrame = ctx["forecast_df"]
    forecast_rows = ctx["forecast"]

    baseline = _recent_baseline(history_df, baseline_window)
    forecast_mean = float(
        pd.Series([row["predicted_units"] for row in forecast_rows]).mean()
    )

    if baseline > 0:
        total_change_pct = round((forecast_mean - baseline) / baseline * 100, 1)
    else:
        total_change_pct = 0.0 if forecast_mean == 0 else 100.0

    future_df = forecast_df.tail(periods).copy()
    components = _component_columns(future_df)

    raw_impacts: list[tuple[str, float]] = []
    for label, col in components.items():
        if col not in future_df.columns:
            continue
        # Component values are on Prophet's scaled scale; use mean absolute contribution.
        impact = float(future_df[col].mean())
        raw_impacts.append((label, impact))

    # Split combined holidays column into named events when Prophet exposes them individually.
    holiday_cols = [c for c in future_df.columns if c in HOLIDAY_LABELS]
    if holiday_cols:
        raw_impacts = [(l, v) for l, v in raw_impacts if l != "Festivals & events"]
        for col in holiday_cols:
            impact = float(future_df[col].mean())
            if abs(impact) > 1e-6:
                raw_impacts.append((HOLIDAY_LABELS[col], impact))

    total_abs = sum(abs(v) for _, v in raw_impacts) or 1.0
    drivers = []
    for factor, impact in sorted(raw_impacts, key=lambda x: abs(x[1]), reverse=True):
        share = abs(impact) / total_abs
        impact_pct = round(total_change_pct * share, 1)
        if impact_pct == 0.0 and abs(impact) > 1e-6:
            impact_pct = 0.1 if total_change_pct >= 0 else -0.1
        drivers.append({"factor": factor, "impact_pct": impact_pct})

    # Rename generic labels for demo readability.
    label_map = {
        "Weekly seasonality": "Weekend effect",
        "Trend": "Weekly trend",
        "Festivals & events": "Festival effect",
    }
    drivers = [{"factor": label_map.get(d["factor"], d["factor"]), "impact_pct": d["impact_pct"]} for d in drivers]

    return {
        "sku_id": sku_id,
        "store_id": store_id,
        "baseline_daily_avg": round(baseline, 2),
        "forecast_daily_avg": round(forecast_mean, 2),
        "total_change_pct": total_change_pct,
        "drivers": drivers[:5],
        "method": ctx["method"],
    }
