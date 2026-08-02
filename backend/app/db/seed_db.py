"""
Load seed_data.csv into Supabase/Postgres.

Prerequisites:
  1. Run schema.sql in the Supabase SQL editor.
  2. Set DATABASE_URL in backend/.env

Usage (from backend/):
    python -m app.db.seed_db
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd
from sqlalchemy import text

from app.db.database import get_engine

DB_DIR = Path(__file__).resolve().parent
SEED_CSV = DB_DIR / "seed_data.csv"


def seed() -> None:
    if not SEED_CSV.exists():
        raise FileNotFoundError(
            f"{SEED_CSV} not found. Run: python -m app.db.generate_seed_data"
        )

    df = pd.read_csv(SEED_CSV, parse_dates=["date"])
    engine = get_engine()

    stores = df[["store_id"]].drop_duplicates()
    # store_name/location are not in CSV — derive from generate_seed_data constants via join
    store_meta = {
        "ST01": ("FreshMart Koramangala", "Bengaluru"),
        "ST02": ("DailyNeeds Indiranagar", "Bengaluru"),
        "ST03": ("QuickShop Andheri", "Mumbai"),
        "ST04": ("ValueStore Bandra", "Mumbai"),
        "ST05": ("CityBazaar Connaught Place", "Delhi"),
    }

    skus = df[["sku_id", "product_name", "category", "price"]].drop_duplicates("sku_id")
    skus = skus.rename(columns={"price": "unit_price"})

    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE sales RESTART IDENTITY CASCADE"))
        conn.execute(text("TRUNCATE TABLE skus CASCADE"))
        conn.execute(text("TRUNCATE TABLE stores CASCADE"))

        for store_id in stores["store_id"]:
            name, location = store_meta[store_id]
            conn.execute(
                text(
                    "INSERT INTO stores (store_id, store_name, location) "
                    "VALUES (:store_id, :store_name, :location)"
                ),
                {"store_id": store_id, "store_name": name, "location": location},
            )

        for row in skus.itertuples(index=False):
            conn.execute(
                text(
                    "INSERT INTO skus (sku_id, product_name, category, unit_price) "
                    "VALUES (:sku_id, :product_name, :category, :unit_price)"
                ),
                {
                    "sku_id": row.sku_id,
                    "product_name": row.product_name,
                    "category": row.category,
                    "unit_price": float(row.unit_price),
                },
            )

        insert_sales = text(
            """
            INSERT INTO sales (date, store_id, sku_id, units_sold, stock_on_hand)
            VALUES (:date, :store_id, :sku_id, :units_sold, :stock_on_hand)
            """
        )
        sales_payload = [
            {
                "date": row.date.date() if hasattr(row.date, "date") else row.date,
                "store_id": row.store_id,
                "sku_id": row.sku_id,
                "units_sold": int(row.units_sold),
                "stock_on_hand": int(row.stock_on_hand),
            }
            for row in df[["date", "store_id", "sku_id", "units_sold", "stock_on_hand"]].itertuples(
                index=False
            )
        ]
        chunk_size = 500
        for i in range(0, len(sales_payload), chunk_size):
            conn.execute(insert_sales, sales_payload[i : i + chunk_size])

    print(f"Seeded {len(stores)} stores, {len(skus)} SKUs, {len(df):,} sales rows.")


if __name__ == "__main__":
    seed()
