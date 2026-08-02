from fastapi import APIRouter
from app.db.database import fetch_all

router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict:
    try:
        # Lightweight Supabase query (fetch SKUs to verify database connectivity)
        skus = fetch_all("skus", lambda q: q.limit(1))
        return {
            "status": "ok",
            "database": "connected",
            "skus_count_sample": len(skus),
        }
    except Exception as exc:
        return {
            "status": "degraded",
            "database": f"error: {exc}",
        }
