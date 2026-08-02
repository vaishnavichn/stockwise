"""AI Assistant endpoint — natural-language stock questions (Phase 4)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.llm_service import ask_stock_assistant

assistant_router = APIRouter(prefix="/assistant", tags=["assistant"])


class AssistantQuery(BaseModel):
    query: str
    sku_id: str | None = None


class AssistantResponse(BaseModel):
    answer: str


@assistant_router.post("/query", response_model=AssistantResponse)
async def post_assistant_query(body: AssistantQuery) -> dict:
    """Answer an inventory question using grounded LLM."""
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty")

    try:
        answer = await ask_stock_assistant(body.query, sku_id=body.sku_id)
        return {"answer": answer}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Assistant error: {exc}",
        ) from exc
