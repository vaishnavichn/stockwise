"""Purchase Order generation endpoint (Phase 4)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.services.po_service import generate_po_draft

po_router = APIRouter(prefix="/po", tags=["purchase-orders"])


@po_router.get("/generate/{sku_id}")
def get_po_draft(sku_id: str) -> dict:
    """Generate a mock purchase order draft for a SKU."""
    try:
        return generate_po_draft(sku_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"PO generation error: {exc}",
        ) from exc
