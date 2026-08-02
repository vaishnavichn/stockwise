"""
Model loader service with in-memory caching for trained Prophet models.
"""

from __future__ import annotations

import json
import pickle
from pathlib import Path
from typing import Any
from prophet import Prophet

MODELS_DIR = Path(__file__).resolve().parent / "models"

# In-memory model cache: sku_id -> Prophet instance
_LOADED_MODELS: dict[str, Prophet] = {}
_SUMMARY_CACHE: dict[str, Any] | None = None


def load_model(sku_id: str) -> Prophet:
    """
    Load pickled Prophet model for sku_id from disk with in-memory caching.
    """
    if sku_id in _LOADED_MODELS:
        return _LOADED_MODELS[sku_id]

    model_file = MODELS_DIR / f"{sku_id}.pkl"
    if not model_file.exists():
        raise FileNotFoundError(
            f"Model not trained for SKU '{sku_id}'. Run train_model.py first (python -m app.ml.train_model)."
        )

    try:
        with model_file.open("rb") as f:
            model: Prophet = pickle.load(f)
        _LOADED_MODELS[sku_id] = model
        return model
    except Exception as exc:
        raise RuntimeError(f"Failed to load model file for SKU '{sku_id}': {exc}") from exc


def get_model_accuracy(sku_id: str) -> dict[str, Any] | None:
    """
    Read training_summary.json and return MAPE, RMSE, cv_mape, cv_rmse & low_confidence flag for sku_id.
    """
    global _SUMMARY_CACHE

    summary_file = MODELS_DIR / "training_summary.json"
    if not summary_file.exists():
        return None

    if _SUMMARY_CACHE is None:
        try:
            with summary_file.open("r", encoding="utf-8") as f:
                _SUMMARY_CACHE = json.load(f)
        except Exception:
            _SUMMARY_CACHE = {}

    sku_info = (_SUMMARY_CACHE or {}).get(sku_id)
    if not sku_info:
        return None

    return {
        "mape": sku_info.get("mape", 0.0),
        "rmse": sku_info.get("rmse", 0.0),
        "cv_mape": sku_info.get("cv_mape", 0.0),
        "cv_rmse": sku_info.get("cv_rmse", 0.0),
        "low_confidence": sku_info.get("low_confidence", False),
    }


def clear_model_cache() -> None:
    """Clear in-memory caches after retraining."""
    global _SUMMARY_CACHE
    _LOADED_MODELS.clear()
    _SUMMARY_CACHE = None
