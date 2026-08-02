"""
Smart Inventory Copilot — FastAPI entrypoint.

Start locally (from backend/):
    uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import health_router, sales_router
from app.routes.forecast_routes import forecast_router, inventory_router

app = FastAPI(
    title="Smart Inventory Copilot API",
    description="Phase 2: Prophet forecasting, reorder logic, and dead-stock detection.",
    version="0.2.0",
)

# Allow local Vite dev server; tighten origins before production deploy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(sales_router)
app.include_router(forecast_router)
app.include_router(inventory_router)
