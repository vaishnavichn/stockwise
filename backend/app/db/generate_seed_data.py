"""
Generate synthetic retail sales data for demand-forecasting demos.

Run once to create seed_data.csv:
    python -m app.db.generate_seed_data
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

DB_DIR = Path(__file__).resolve().parent
OUTPUT_PATH = DB_DIR / "seed_data.csv"
CALENDAR_PATH = DB_DIR / "festival_calendar.json"

STORES = [
    ("ST01", "FreshMart Koramangala", "Bengaluru"),
    ("ST02", "DailyNeeds Indiranagar", "Bengaluru"),
    ("ST03", "QuickShop Andheri", "Mumbai"),
    ("ST04", "ValueStore Bandra", "Mumbai"),
    ("ST05", "CityBazaar Connaught Place", "Delhi"),
]

SKUS = [
    ("SKU001", "Masala Chips 50g", "Snacks", 20.0),
    ("SKU002", "Classic Namkeen 200g", "Snacks", 45.0),
    ("SKU003", "Dark Chocolate Bar", "Snacks", 85.0),
    ("SKU004", "Instant Noodles Pack", "Snacks", 14.0),
    ("SKU005", "Cola 750ml", "Beverages", 40.0),
    ("SKU006", "Mango Juice 1L", "Beverages", 95.0),
    ("SKU007", "Mineral Water 1L", "Beverages", 20.0),
    ("SKU008", "Green Tea Box", "Beverages", 120.0),
    ("SKU009", "Herbal Shampoo 180ml", "Personal Care", 180.0),
    ("SKU010", "Face Wash 100ml", "Personal Care", 150.0),
    ("SKU011", "Toothpaste 150g", "Personal Care", 95.0),
    ("SKU012", "Hand Sanitizer 100ml", "Personal Care", 60.0),
    ("SKU013", "Dish Wash Liquid 500ml", "Household", 110.0),
    ("SKU014", "Floor Cleaner 1L", "Household", 130.0),
    ("SKU015", "Laundry Detergent 1kg", "Household", 220.0),
]

# Base daily demand by category (units per store per day)
BASE_DEMAND = {
    "Snacks": 28,
    "Beverages": 22,
    "Personal Care": 12,
    "Household": 10,
}


def _load_event_multipliers(dates: pd.DatetimeIndex) -> dict[pd.Timestamp, float]:
    """Map each date to the max festival multiplier from the calendar."""
    with CALENDAR_PATH.open(encoding="utf-8") as f:
        calendar = json.load(f)

    multipliers: dict[pd.Timestamp, float] = {}
    for event in calendar["events"]:
        start = pd.Timestamp(event["start_date"])
        end = pd.Timestamp(event["end_date"])
        impact = float(event["impact_multiplier"])
        for day in pd.date_range(start, end, freq="D"):
            if day in dates:
                multipliers[day] = max(multipliers.get(day, 1.0), impact)
    return multipliers


def generate_seed_data() -> pd.DataFrame:
    rng = np.random.default_rng(42)
    dates = pd.date_range("2024-01-01", "2024-12-31", freq="D")
    event_multipliers = _load_event_multipliers(dates)

    rows: list[dict] = []
    for store_id, _, _ in STORES:
        for sku_id, product_name, category, price in SKUS:
            base = BASE_DEMAND[category] * rng.uniform(0.85, 1.15)
            stock = int(rng.integers(80, 160))

            for date in dates:
                weekday = date.weekday()
                weekend_boost = 1.35 if weekday >= 5 else 1.0
                festival_boost = event_multipliers.get(date, 1.0)
                seasonal = 1.0 + 0.15 * np.sin(2 * np.pi * date.dayofyear / 365)
                noise = rng.normal(1.0, 0.12)

                expected = base * weekend_boost * festival_boost * seasonal * noise
                units_sold = max(0, int(round(expected)))

                # Simple inventory drift with occasional restock
                stock = max(0, stock - units_sold)
                if stock < 25 and rng.random() < 0.18:
                    stock += int(rng.integers(60, 120))

                rows.append(
                    {
                        "date": date.strftime("%Y-%m-%d"),
                        "store_id": store_id,
                        "sku_id": sku_id,
                        "product_name": product_name,
                        "category": category,
                        "units_sold": units_sold,
                        "price": price,
                        "stock_on_hand": stock,
                    }
                )

    return pd.DataFrame(rows)


def main() -> None:
    df = generate_seed_data()
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(df):,} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
