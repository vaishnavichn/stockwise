"""
Data Upload Routes for Smart Inventory Copilot.
Handles CSV, Excel, Manual Data Ingestion, Template Download, and Selective Prophet Model Retraining.
"""

from __future__ import annotations

import io
import json
import logging
from typing import Any

import numpy as np
import pandas as pd
from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.db.database import fetch_all, execute_query
from app.ml.train_model import _evaluate_model, _create_prophet_model, _load_holidays_df, MODELS_DIR
from app.ml.model_loader import clear_model_cache
from app.services.forecast_service import clear_forecast_cache

upload_router = APIRouter(prefix="/upload", tags=["upload"])

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB limit


class ManualRecordRequest(BaseModel):
    date: str
    store_id: str = "STR001"
    sku_id: str
    product_name: str | None = None
    category: str = "Uncategorized"
    units_sold: float = Field(..., ge=0)
    unit_price: float | None = None


def _retrain_skus_background(affected_skus: list[str]) -> None:
    """Retrain Prophet models only for SKUs that received new sales records."""
    if not affected_skus:
        return

    import pickle
    holidays = _load_holidays_df()

    for sku_id in affected_skus:
        try:
            rows = fetch_all("sales", lambda q: q.eq("sku_id", sku_id).order("date"))
            if not rows or len(rows) < 30:
                continue

            df = pd.DataFrame(rows)
            df["ds"] = pd.to_datetime(df["date"])
            df["y"] = df["units_sold"].astype(float)
            df = df.groupby("ds", as_index=False)["y"].sum()

            full_range = pd.date_range(df["ds"].min(), df["ds"].max(), freq="D")
            complete = pd.DataFrame({"ds": full_range})
            merged = complete.merge(df[["ds", "y"]], on="ds", how="left")
            merged["y"] = merged["y"].fillna(0.0)

            # Winsorization
            q1 = merged["y"].quantile(0.25)
            q3 = merged["y"].quantile(0.75)
            iqr = q3 - q1
            upper_bound = max(q3 + 1.5 * iqr, merged["y"].quantile(0.99))
            merged["y"] = merged["y"].clip(upper=upper_bound)

            merged["month_end"] = merged["ds"].dt.is_month_end | (merged["ds"].dt.day >= (merged["ds"].dt.days_in_month - 2))
            merged["month_end"] = merged["month_end"].astype(int)

            model = _create_prophet_model(holidays)
            model.fit(merged)

            model_file = MODELS_DIR / f"{sku_id}.pkl"
            with model_file.open("wb") as f:
                pickle.dump(model, f)

        except Exception as exc:
            logging.error("Failed selective retrain for %s: %s", sku_id, exc)

    clear_model_cache()
    clear_forecast_cache()


def _process_sales_dataframe(df: pd.DataFrame) -> dict[str, Any]:
    """Validate dataframe columns & types, upsert stores/skus, insert sales rows in batches."""
    # Standardize column headers
    df.columns = [str(c).strip().lower().replace(" ", "_") for c in df.columns]

    # Required mapping
    col_date = next((c for c in ["date", "order_date", "ship_date"] if c in df.columns), None)
    col_sku = next((c for c in ["sku_id", "product_name", "sku"] if c in df.columns), None)
    col_units = next((c for c in ["units_sold", "quantity", "units", "sales_units"] if c in df.columns), None)
    col_store = next((c for c in ["store_id", "store_name", "region", "city", "store"] if c in df.columns), "store_id")

    col_category = next((c for c in ["category", "sub_category"] if c in df.columns), None)
    col_price = next((c for c in ["unit_price", "price", "sales"] if c in df.columns), None)

    errors: list[str] = []
    if not col_date:
        errors.append("Missing required date column ('date' or 'order_date')")
    if not col_sku:
        errors.append("Missing required SKU/Product column ('sku_id' or 'product_name')")
    if not col_units:
        errors.append("Missing required units column ('units_sold' or 'quantity')")

    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    # Row-level validation
    valid_rows: list[dict] = []
    new_skus: set[str] = set()
    new_stores: set[str] = set()
    skipped_count = 0

    # Existing stores/skus for reference
    existing_skus_raw = fetch_all("skus", lambda q: q.order("sku_id"))
    existing_sku_ids = {s["sku_id"]: s for s in existing_skus_raw}

    existing_stores_raw = fetch_all("stores", lambda q: q.order("store_id"))
    existing_store_ids = {st["store_id"] for st in existing_stores_raw}

    for idx, row in df.iterrows():
        row_num = idx + 2
        # Parse date
        try:
            parsed_date = pd.to_datetime(row[col_date]).strftime("%Y-%m-%d")
        except Exception:
            errors.append(f"Row {row_num}: Invalid date format '{row[col_date]}'")
            skipped_count += 1
            continue

        # Parse units
        try:
            units = float(row[col_units])
            if units < 0:
                errors.append(f"Row {row_num}: units_sold must be >= 0 (got {units})")
                skipped_count += 1
                continue
        except Exception:
            errors.append(f"Row {row_num}: Non-numeric units_sold '{row[col_units]}'")
            skipped_count += 1
            continue

        # Extract SKU info
        raw_sku = str(row[col_sku]).strip()
        sku_id = raw_sku if raw_sku.startswith("SKU") else f"SKU_{raw_sku.replace(' ', '_')[:10]}"
        product_name = raw_sku
        category = str(row[col_category]).strip() if col_category and pd.notna(row[col_category]) else "General"

        # Check SKU auto-creation
        if sku_id not in existing_sku_ids:
            new_skus.add(sku_id)
            unit_price = float(row[col_price]) if col_price and pd.notna(row[col_price]) else 49.99
            # Upsert SKU to database
            execute_query("skus", lambda q: q.upsert({
                "sku_id": sku_id,
                "product_name": product_name,
                "category": category,
                "unit_price": unit_price,
            }))
            existing_sku_ids[sku_id] = {"sku_id": sku_id, "product_name": product_name}

        # Store ID
        store_id = str(row.get(col_store, "STR001")).strip()
        if not store_id.startswith("STR"):
            store_id = f"STR_{store_id.replace(' ', '_')[:6]}"
        if store_id not in existing_store_ids:
            new_stores.add(store_id)
            execute_query("stores", lambda q: q.upsert({
                "store_id": store_id,
                "store_name": f"Store {store_id}",
                "location": "Regional",
            }))
            existing_store_ids.add(store_id)

        valid_rows.append({
            "date": parsed_date,
            "sku_id": sku_id,
            "store_id": store_id,
            "units_sold": int(round(units)),
            "stock_on_hand_estimate": 150,
        })

    # Batch insert into sales table
    inserted_count = 0
    if valid_rows:
        batch_size = 500
        for i in range(0, len(valid_rows), batch_size):
            chunk = valid_rows[i : i + batch_size]
            execute_query("sales", lambda q: q.upsert(chunk, on_conflict="date,store_id,sku_id"))
            inserted_count += len(chunk)

    affected_skus = list({r["sku_id"] for r in valid_rows})

    return {
        "processed_rows": len(df),
        "inserted_rows": inserted_count,
        "skipped_rows": skipped_count,
        "new_skus_created": len(new_skus),
        "new_stores_created": len(new_stores),
        "affected_skus": affected_skus,
        "validation_warnings": errors[:10],
    }


@upload_router.get("/template")
def download_template() -> Response:
    """Return downloadable sample CSV template."""
    csv_content = (
        "date,store_id,sku_id,product_name,category,units_sold,unit_price\n"
        "2026-08-01,STR001,SKU001,Masala Chips 50g,Snacks,45,20.00\n"
        "2026-08-01,STR001,SKU005,Cola 750ml,Beverages,30,40.00\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="smart_copilot_sales_template.csv"'},
    )


@upload_router.post("/csv")
async def upload_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> dict:
    """Accept and process CSV sales data file."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a .csv file.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds maximum size limit of 5MB.")

    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV file: {exc}")

    result = _process_sales_dataframe(df)
    background_tasks.add_task(_retrain_skus_background, result["affected_skus"])

    return {
        "status": "success",
        "message": f"Successfully ingested {result['inserted_rows']} sales records.",
        "summary": result,
    }


@upload_router.post("/excel")
async def upload_excel(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    sheet_name: str | None = Query(None),
) -> dict:
    """Accept and process Excel (.xlsx) sales data file."""
    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an .xlsx Excel file.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds maximum size limit of 5MB.")

    try:
        xl = pd.ExcelFile(io.BytesIO(content))
        available_sheets = xl.sheet_names
        chosen_sheet = sheet_name if (sheet_name and sheet_name in available_sheets) else available_sheets[0]
        df = pd.read_excel(xl, sheet_name=chosen_sheet)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to parse Excel file: {exc}")

    result = _process_sales_dataframe(df)
    result["available_sheets"] = available_sheets
    result["processed_sheet"] = chosen_sheet

    background_tasks.add_task(_retrain_skus_background, result["affected_skus"])

    return {
        "status": "success",
        "message": f"Successfully ingested {result['inserted_rows']} sales records from sheet '{chosen_sheet}'.",
        "summary": result,
    }


@upload_router.post("/manual")
def create_manual_record(
    req: ManualRecordRequest,
    background_tasks: BackgroundTasks,
) -> dict:
    """Insert single manual sales record and trigger background retraining."""
    # Ensure SKU exists
    existing_skus = fetch_all("skus", lambda q: q.eq("sku_id", req.sku_id))
    if not existing_skus:
        product_name = req.product_name or req.sku_id
        unit_price = req.unit_price or 49.99
        execute_query("skus", lambda q: q.upsert({
            "sku_id": req.sku_id,
            "product_name": product_name,
            "category": req.category,
            "unit_price": unit_price,
        }))

    # Ensure Store exists
    existing_stores = fetch_all("stores", lambda q: q.eq("store_id", req.store_id))
    if not existing_stores:
        execute_query("stores", lambda q: q.upsert({
            "store_id": req.store_id,
            "store_name": f"Store {req.store_id}",
            "location": "Regional",
        }))

    sales_record = {
        "date": req.date,
        "sku_id": req.sku_id,
        "store_id": req.store_id,
        "units_sold": int(round(req.units_sold)),
        "stock_on_hand_estimate": 150,
    }
    execute_query("sales", lambda q: q.upsert([sales_record], on_conflict="date,store_id,sku_id"))

    background_tasks.add_task(_retrain_skus_background, [req.sku_id])

    return {
        "status": "success",
        "message": f"Record inserted for SKU '{req.sku_id}' on {req.date}.",
        "record": sales_record,
    }
