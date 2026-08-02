"""
Populate Supabase database tables (stores, skus, sales) using cleaned real sales data.

Uses Supabase Python client with batched upserts / inserts.
Usage (from backend/):
    python -m app.db.seed_db
"""

from __future__ import annotations

import pandas as pd
from app.db.supabase_client import get_supabase_client
from app.db.prepare_real_data import prepare_real_data

# Fixed mapping from Product Name -> SKU001..SKU015 for frontend UI catalog compatibility
SKU_MAPPING = {
    "Masala Chips 50g": "SKU001",
    "Classic Namkeen 200g": "SKU002",
    "Dark Chocolate Bar": "SKU003",
    "Instant Noodles Pack": "SKU004",
    "Cola 750ml": "SKU005",
    "Mango Juice 1L": "SKU006",
    "Mineral Water 1L": "SKU007",
    "Green Tea Box": "SKU008",
    "Herbal Shampoo 180ml": "SKU009",
    "Face Wash 100ml": "SKU010",
    "Toothpaste 150g": "SKU011",
    "Hand Sanitizer 100ml": "SKU012",
    "Dish Wash Liquid 500ml": "SKU013",
    "Floor Cleaner 1L": "SKU014",
    "Laundry Detergent 1kg": "SKU015",
}

UNIT_PRICES = {
    "SKU001": 20.0,
    "SKU002": 40.0,
    "SKU003": 80.0,
    "SKU004": 15.0,
    "SKU005": 45.0,
    "SKU006": 85.0,
    "SKU007": 20.0,
    "SKU008": 150.0,
    "SKU009": 120.0,
    "SKU010": 95.0,
    "SKU011": 75.0,
    "SKU012": 50.0,
    "SKU013": 110.0,
    "SKU014": 140.0,
    "SKU015": 210.0,
}

REGION_STORE_MAP = {
    "Central": ("ST01", "Superstore Central", "Chicago, IL"),
    "East": ("ST02", "Superstore East", "New York, NY"),
    "South": ("ST03", "Superstore South", "Atlanta, GA"),
    "West": ("ST04", "Superstore West", "Los Angeles, CA"),
}


def seed() -> None:
    print("=" * 60)
    print(" 1. PREPARING REAL DATA & REMAPPING TO SUPABASE SCHEMA")
    print("=" * 60)

    daily_df = prepare_real_data()

    daily_df["sku_id"] = daily_df["Product Name"].map(SKU_MAPPING)
    daily_df = daily_df.dropna(subset=["sku_id"]).copy()
    daily_df["store_id"] = daily_df["Region"].map(lambda r: REGION_STORE_MAP.get(r, ("ST01", "", ""))[0])

    print("\nDeriving stock_on_hand_estimate proxy (10-day rolling demand estimate)...")
    daily_df = daily_df.sort_values(["sku_id", "store_id", "Order Date"])

    daily_df["rolling_avg"] = (
        daily_df.groupby(["sku_id", "store_id"])["units_sold"]
        .transform(lambda x: x.rolling(14, min_periods=1).mean())
    )

    daily_df["stock_on_hand_estimate"] = (daily_df["rolling_avg"] * 10).round(2)

    # Low-stock trigger for demo alert SKUs (SKU001 & SKU004)
    max_date = daily_df["Order Date"].max()
    recent_mask = (daily_df["Order Date"] > (max_date - pd.Timedelta(days=7))) & (daily_df["sku_id"].isin(["SKU001", "SKU004"]))
    daily_df.loc[recent_mask, "stock_on_hand_estimate"] = (daily_df.loc[recent_mask, "units_sold"] * 2).astype(float)

    # 1. Prepare stores data
    stores_data = [
        {"store_id": st_id, "store_name": name, "location": loc}
        for r, (st_id, name, loc) in REGION_STORE_MAP.items()
    ]

    # 2. Prepare SKUs data
    skus_data = []
    for prod_name, sku_id in SKU_MAPPING.items():
        cat = daily_df[daily_df["sku_id"] == sku_id]["Category"].iloc[0] if not daily_df[daily_df["sku_id"] == sku_id].empty else "Snacks"
        price = UNIT_PRICES[sku_id]
        skus_data.append({
            "sku_id": sku_id,
            "product_name": prod_name,
            "category": cat,
            "unit_price": price
        })

    # 3. Prepare sales payload
    sales_payload = [
        {
            "date": row["Order Date"].strftime("%Y-%m-%d"),
            "store_id": row["store_id"],
            "sku_id": row["sku_id"],
            "units_sold": int(row["units_sold"]),
            "stock_on_hand_estimate": float(row["stock_on_hand_estimate"])
        }
        for _, row in daily_df.iterrows()
    ]

    print("\n" + "=" * 60)
    print(" 2. INGESTING INTO SUPABASE VIA PYTHON CLIENT")
    print("=" * 60)

    client = get_supabase_client()

    try:
        print("Upserting stores...")
        client.table("stores").upsert(stores_data, on_conflict="store_id").execute()
        print("Successfully upserted stores.")

        print("Upserting SKUs...")
        client.table("skus").upsert(skus_data, on_conflict="sku_id").execute()
        print("Successfully upserted SKUs.")

        print(f"Ingesting {len(sales_payload):,} sales records in batches of 500...")
        chunk_size = 500
        for i in range(0, len(sales_payload), chunk_size):
            chunk = sales_payload[i : i + chunk_size]
            client.table("sales").upsert(chunk, on_conflict="date,store_id,sku_id").execute()
            if (i // chunk_size) % 5 == 0 or i + chunk_size >= len(sales_payload):
                print(f"   Batch {i // chunk_size + 1}: processed {min(i + chunk_size, len(sales_payload)):,}/{len(sales_payload):,} rows")

        print("\n" + "=" * 60)
        print(f" SUCCESS! Seeded {len(stores_data)} Stores, {len(skus_data)} SKUs, and {len(sales_payload):,} Sales Records into Supabase!")
        print("=" * 60)

    except Exception as exc:
        print("\nError during Supabase seeding:")
        print(exc)
        print("\nDid you run schema.sql in Supabase SQL Editor first? Check your SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.")


if __name__ == "__main__":
    seed()
