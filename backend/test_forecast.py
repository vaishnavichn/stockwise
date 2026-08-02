"""
Sanity-check Prophet forecasting for a few SKUs.

Run from backend/ (with .env configured and DB seeded):
    python test_forecast.py
"""

from __future__ import annotations

import json
import sys

from app.services.explain_service import explain_forecast
from app.services.forecast_service import generate_forecast
from app.services.inventory_service import calculate_reorder_point, detect_dead_stock

SAMPLE_SKUS = ["SKU001", "SKU005", "SKU013"]


def main() -> None:
    print("=" * 60)
    print("Smart Inventory Copilot — Forecast smoke test")
    print("=" * 60)

    for sku_id in SAMPLE_SKUS:
        print(f"\n--- {sku_id} (all stores, 14-day forecast) ---")
        try:
            result = generate_forecast(sku_id, periods=14)
            print(f"Method: {result['method']} | History days: {result['history_days']}")
            print("First 5 forecast days:")
            for row in result["forecast"][:5]:
                print(
                    f"  {row['date']}: {row['predicted_units']} "
                    f"[{row['lower_bound']}, {row['upper_bound']}]"
                )

            explanation = explain_forecast(sku_id, forecast_result=result)
            print(f"Explain: {json.dumps(explanation, indent=2)}")

            reorder = calculate_reorder_point(sku_id)
            print(
                f"Reorder: point={reorder['reorder_point']} "
                f"on_hand={reorder['stock_on_hand']} "
                f"needs_reorder={reorder['needs_reorder']}"
            )
        except Exception as exc:
            print(f"ERROR for {sku_id}: {exc}", file=sys.stderr)

    print("\n--- Dead stock scan ---")
    try:
        dead = detect_dead_stock()
        print(f"Flagged: {dead['count']} SKUs")
        for item in dead["flagged_skus"][:5]:
            print(f"  {item['sku_id']} ({item['product_name']}): {item['decline_pct']}% decline")
    except Exception as exc:
        print(f"Dead stock scan skipped: {exc}", file=sys.stderr)

    print("\nDone.")


if __name__ == "__main__":
    main()
