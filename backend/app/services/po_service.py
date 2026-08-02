"""Mock Purchase Order generation service (Phase 4)."""

from __future__ import annotations

import math
import time

from app.services.inventory_service import calculate_reorder_point
from app.db.database import fetch_all


def generate_po_draft(sku_id: str) -> dict:
    """
    Build a purchase order draft for a SKU using reorder-point data
    and a simplified EOQ formula.

    Returns structured PO JSON ready for frontend display.
    """
    reorder = calculate_reorder_point(sku_id)

    # Fetch unit price
    sku_meta = fetch_all("skus", lambda q: q.eq("sku_id", sku_id))
    if not sku_meta:
        raise ValueError(f"SKU '{sku_id}' not found")

    unit_price = float(sku_meta[0]["unit_price"])
    product_name = sku_meta[0]["product_name"]
    category = sku_meta[0]["category"]

    # ── Simplified EOQ calculation ───────────────────────────────
    # Annual demand estimate = avg_daily_demand × 365
    avg_daily = reorder["avg_daily_demand"]
    annual_demand = avg_daily * 365

    # Sensible defaults for ordering cost and holding cost
    ordering_cost = 50.0   # ₹50 per order placed
    holding_cost_pct = 0.25  # 25% of unit price per year
    holding_cost = max(unit_price * holding_cost_pct, 1.0)

    if annual_demand > 0 and holding_cost > 0:
        eoq = math.sqrt(2 * annual_demand * ordering_cost / holding_cost)
        order_qty = max(round(eoq), math.ceil(reorder["reorder_quantity"]))
    else:
        order_qty = max(1, math.ceil(reorder["reorder_quantity"]))

    # ── PO number ────────────────────────────────────────────────
    po_number = f"PO-{int(time.time())}"

    # ── AI justification (sync call for simplicity) ──────────────
    justification = (
        f"Based on forecasted daily demand of {avg_daily:.1f} units and current "
        f"stock of {reorder['stock_on_hand']} units (below reorder point of "
        f"{reorder['reorder_point']:.0f}), ordering {order_qty} units ensures "
        f"coverage for the next {round(order_qty / max(avg_daily, 0.1)):.0f} days "
        f"at optimal ordering cost."
    )

    return {
        "po_number": po_number,
        "sku_id": sku_id,
        "product_name": product_name,
        "category": category,
        "supplier": "Default Supplier",
        "order_quantity": order_qty,
        "unit_price": unit_price,
        "total_cost": round(order_qty * unit_price, 2),
        "avg_daily_demand": avg_daily,
        "stock_on_hand": reorder["stock_on_hand"],
        "reorder_point": reorder["reorder_point"],
        "needs_reorder": reorder["needs_reorder"],
        "justification": justification,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
