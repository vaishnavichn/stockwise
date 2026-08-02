"""
Data Exploration & Cleaning script for Superstore Sales dataset.

Loads real_sales_data.csv, prints a data profile, cleans and aggregates
individual order transactions into daily time-series per product and region.
"""

from __future__ import annotations

import sys
from pathlib import Path
import pandas as pd

DATA_PATH = Path(__file__).resolve().parent / "real_sales_data.csv"


def prepare_real_data() -> pd.DataFrame:
    if not DATA_PATH.exists():
        print(f"Error: {DATA_PATH} not found.")
        sys.exit(1)

    print("=" * 60)
    print(" 1. LOADING & PROFILING REAL SALES DATASET")
    print("=" * 60)

    df = pd.read_csv(DATA_PATH)

    # 1. Profile raw data
    print(f"Total Rows: {len(df)}")
    print(f"Columns: {list(df.columns)}")
    print(f"Missing Values:\n{df.isnull().sum()}")

    # Parse Order Date
    df["Order Date"] = pd.to_datetime(df["Order Date"])
    print(f"Date Range: {df['Order Date'].min().strftime('%Y-%m-%d')} to {df['Order Date'].max().strftime('%Y-%m-%d')}")
    print(f"Unique Products: {df['Product Name'].nunique()}")
    print(f"Unique Categories: {df['Category'].nunique()}")
    print(f"Unique Regions: {df['Region'].nunique()}")

    # 2. Cleaning
    # Drop rows with missing critical values
    df = df.dropna(subset=["Order Date", "Sales", "Quantity", "Product Name"])

    # Filter/Clean invalid sales or quantity
    df = df[(df["Sales"] > 0) & (df["Quantity"] > 0)].copy()

    print("\n" + "=" * 60)
    print(" 2. AGGREGATING ORDER LINES TO DAILY SERIES")
    print("=" * 60)
    # Group by (Order Date, Product Name, Category, Region)
    # Sum Quantity (units_sold) and Sales (revenue)
    daily_aggregated = (
        df.groupby(["Order Date", "Product Name", "Category", "Region"], as_index=False)
        .agg(
            units_sold=("Quantity", "sum"),
            revenue=("Sales", "sum"),
            orders_count=("Sales", "count")
        )
    )

    print(f"Aggregated Daily Rows: {len(daily_aggregated)}")
    print("\nSample Cleaned Daily Data:")
    print(daily_aggregated.head(10).to_string(index=False))

    return daily_aggregated


if __name__ == "__main__":
    prepare_real_data()
