"""
Admin endpoint for triggering model retraining via API (Phase 4 / Demo).
"""

from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException
from app.ml.train_model import train_all_models
from app.ml.model_loader import clear_model_cache
from app.services.forecast_service import clear_forecast_cache

admin_router = APIRouter(prefix="/admin", tags=["admin"])


def _run_retraining_task() -> None:
    try:
        train_all_models()
        clear_model_cache()
        clear_forecast_cache()
    except Exception as exc:
        print(f"Error during background retraining task: {exc}")


@admin_router.post("/retrain-models")
def trigger_model_retraining(background_tasks: BackgroundTasks) -> dict:
    """
    Trigger model retraining pipeline in the background.
    """
    try:
        background_tasks.add_task(_run_retraining_task)
        return {
            "status": "accepted",
            "message": "Model retraining pipeline triggered in background. In-memory caches will clear upon completion.",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to trigger model retraining: {exc}",
        ) from exc
