"""LLM-powered stock assistant — grounded answers from forecast & inventory data.

Supports Google Gemini (primary) and Groq (fallback).  The assistant
answers ONLY from data retrieved via the Phase-2 services, never
hallucinating causes not present in the numbers.
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SKU catalog (mirrors frontend SKU_CATALOG for name→ID resolution)
# ---------------------------------------------------------------------------
_SKU_CATALOG: list[dict[str, str]] = [
    {"sku_id": "SKU001", "product_name": "Masala Chips 50g", "category": "Snacks"},
    {"sku_id": "SKU002", "product_name": "Classic Namkeen 200g", "category": "Snacks"},
    {"sku_id": "SKU003", "product_name": "Dark Chocolate Bar", "category": "Snacks"},
    {"sku_id": "SKU004", "product_name": "Instant Noodles Pack", "category": "Snacks"},
    {"sku_id": "SKU005", "product_name": "Cola 750ml", "category": "Beverages"},
    {"sku_id": "SKU006", "product_name": "Mango Juice 1L", "category": "Beverages"},
    {"sku_id": "SKU007", "product_name": "Mineral Water 1L", "category": "Beverages"},
    {"sku_id": "SKU008", "product_name": "Green Tea Box", "category": "Beverages"},
    {"sku_id": "SKU009", "product_name": "Herbal Shampoo 180ml", "category": "Personal Care"},
    {"sku_id": "SKU010", "product_name": "Face Wash 100ml", "category": "Personal Care"},
    {"sku_id": "SKU011", "product_name": "Toothpaste 150g", "category": "Personal Care"},
    {"sku_id": "SKU012", "product_name": "Hand Sanitizer 100ml", "category": "Personal Care"},
    {"sku_id": "SKU013", "product_name": "Dish Wash Liquid 500ml", "category": "Household"},
    {"sku_id": "SKU014", "product_name": "Floor Cleaner 1L", "category": "Household"},
    {"sku_id": "SKU015", "product_name": "Laundry Detergent 1kg", "category": "Household"},
]


def _resolve_sku_from_query(query: str) -> str | None:
    """Try to extract a SKU ID or product name from the user's query."""
    upper = query.upper()
    # Direct SKU ID match
    match = re.search(r"SKU\d{3}", upper)
    if match:
        return match.group(0)

    # Fuzzy product name match
    query_lower = query.lower()
    for sku in _SKU_CATALOG:
        # Check if significant part of product name is in query
        name_parts = sku["product_name"].lower().split()
        # Match if any keyword (>3 chars) from product name appears in query
        for part in name_parts:
            if len(part) > 3 and part in query_lower:
                return sku["sku_id"]

    return None


# ---------------------------------------------------------------------------
# Grounding data collection
# ---------------------------------------------------------------------------

def _gather_sku_context(sku_id: str) -> dict[str, Any]:
    """Pull forecast, explanation, and reorder status for a single SKU."""
    from app.services.explain_service import explain_forecast
    from app.services.forecast_service import generate_forecast
    from app.services.inventory_service import calculate_reorder_point

    context: dict[str, Any] = {"sku_id": sku_id}

    try:
        forecast = generate_forecast(sku_id, periods=30)
        context["forecast"] = {
            "method": forecast["method"],
            "history_days": forecast["history_days"],
            "next_30d_avg": round(
                sum(r["predicted_units"] for r in forecast["forecast"]) / max(len(forecast["forecast"]), 1), 2
            ),
            "next_30d_total": round(sum(r["predicted_units"] for r in forecast["forecast"]), 2),
        }
    except Exception as exc:
        context["forecast_error"] = str(exc)

    try:
        explanation = explain_forecast(sku_id)
        context["explanation"] = {
            "baseline_daily_avg": explanation["baseline_daily_avg"],
            "forecast_daily_avg": explanation["forecast_daily_avg"],
            "total_change_pct": explanation["total_change_pct"],
            "top_drivers": explanation["drivers"][:3],
        }
    except Exception as exc:
        context["explanation_error"] = str(exc)

    try:
        reorder = calculate_reorder_point(sku_id)
        context["reorder"] = {
            "product_name": reorder["product_name"],
            "stock_on_hand": reorder["stock_on_hand"],
            "reorder_point": reorder["reorder_point"],
            "needs_reorder": reorder["needs_reorder"],
            "reorder_quantity": reorder["reorder_quantity"],
            "avg_daily_demand": reorder["avg_daily_demand"],
        }
    except Exception as exc:
        context["reorder_error"] = str(exc)

    return context


def _gather_portfolio_context() -> dict[str, Any]:
    """Pull dead-stock and reorder data across all SKUs."""
    from app.services.inventory_service import calculate_reorder_point, detect_dead_stock

    context: dict[str, Any] = {}

    try:
        dead = detect_dead_stock()
        context["dead_stock"] = {
            "count": dead["count"],
            "flagged": [
                {
                    "sku_id": s["sku_id"],
                    "product_name": s["product_name"],
                    "decline_pct": s["decline_pct"],
                    "recent_daily_avg": s["recent_daily_avg"],
                }
                for s in dead["flagged_skus"][:5]
            ],
        }
    except Exception as exc:
        context["dead_stock_error"] = str(exc)

    reorder_alerts: list[dict] = []
    for sku in _SKU_CATALOG:
        try:
            r = calculate_reorder_point(sku["sku_id"])
            if r["needs_reorder"]:
                reorder_alerts.append({
                    "sku_id": r["sku_id"],
                    "product_name": r["product_name"],
                    "stock_on_hand": r["stock_on_hand"],
                    "reorder_point": r["reorder_point"],
                    "reorder_quantity": r["reorder_quantity"],
                })
        except Exception:
            continue

    context["reorder_alerts"] = {
        "count": len(reorder_alerts),
        "skus": reorder_alerts[:8],
    }

    return context


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a concise stock management assistant for a retail inventory system called "Smart Inventory Copilot".

RULES:
1. Answer ONLY using the grounding data provided below. Never invent data or causes not present.
2. Keep your answer to 2-4 sentences in plain, concise business English.
3. If the data supports it, end with ONE clear actionable recommendation (e.g. "Order 150 units of Masala Chips today to avoid a stockout by next week.").
4. Use specific numbers from the data. Don't be vague.
5. If you don't have enough data to answer confidently, say so briefly."""


def _build_prompt(user_query: str, context: dict[str, Any]) -> str:
    data_block = json.dumps(context, indent=2, default=str)
    return f"""{_SYSTEM_PROMPT}

--- GROUNDING DATA ---
{data_block}
--- END DATA ---

User question: {user_query}

Your answer:"""


# ---------------------------------------------------------------------------
# LLM API calls (Gemini primary, Groq fallback)
# ---------------------------------------------------------------------------

async def _call_gemini(prompt: str) -> str:
    """Call Google Gemini API using the official SDK."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    from google import genai

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    return response.text or "I couldn't generate a response. Please try again."


async def _call_groq(prompt: str) -> str:
    """Fallback: call Groq API via REST."""
    import httpx

    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "llama-3.3-70b-versatile",
                "messages": [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 300,
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _call_llm(prompt: str) -> str:
    """Try Gemini first, fall back to Groq."""
    # Try Gemini
    if os.getenv("GEMINI_API_KEY"):
        try:
            return await _call_gemini(prompt)
        except Exception as exc:
            log.warning("Gemini call failed: %s — trying Groq fallback", exc)

    # Try Groq
    if os.getenv("GROQ_API_KEY"):
        try:
            return await _call_groq(prompt)
        except Exception as exc:
            log.warning("Groq call failed: %s", exc)

    raise RuntimeError(
        "No LLM API key configured. Set GEMINI_API_KEY or GROQ_API_KEY in your .env file."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def ask_stock_assistant(user_query: str, sku_id: str | None = None) -> str:
    """
    Answer a user's inventory question using grounded LLM.

    If sku_id is given, gather single-SKU context.
    Otherwise, try to detect SKU from query text, or fall back to portfolio overview.
    """
    resolved_sku = sku_id or _resolve_sku_from_query(user_query)

    if resolved_sku:
        context = _gather_sku_context(resolved_sku)
    else:
        context = _gather_portfolio_context()

    prompt = _build_prompt(user_query, context)
    return await _call_llm(prompt)
