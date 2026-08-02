"""
Smart Inventory Copilot — FastAPI entrypoint.

Start locally (from backend/):
    uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import health_router, sales_router
from app.routes.forecast_routes import forecast_router, inventory_router
from app.routes.assistant_routes import assistant_router
from app.routes.dashboard_routes import dashboard_router
from app.routes.po_routes import po_router
from app.routes.admin_routes import admin_router
from app.routes.upload_routes import upload_router

app = FastAPI(
    title="Smart Inventory Copilot API",
    description="Phase 4: AI assistant, executive KPIs, model transparency, pre-trained Prophet models, PO generation, and data upload ingestion.",
    version="0.6.0",
)

# Allow local Vite dev server; tighten origins before production deploy.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(sales_router, prefix="/api")
app.include_router(forecast_router, prefix="/api")
app.include_router(inventory_router, prefix="/api")
app.include_router(assistant_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(po_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(upload_router, prefix="/api")
