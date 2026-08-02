# Smart Inventory Copilot

AI-powered retail demand forecasting and inventory optimization — built for a 2-day hackathon.

**Phase 1 (this repo state):** project skeleton, synthetic sales data, Supabase/Postgres schema, and a minimal FastAPI backend. Forecasting (Prophet) and the dashboard UI come in later phases.

## Project structure

```
smart-inventory-copilot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint
│   │   ├── db/
│   │   │   ├── schema.sql       # Postgres tables
│   │   │   ├── seed_data.csv    # 12 months synthetic sales
│   │   │   ├── seed_db.py       # Load CSV → Supabase
│   │   │   ├── generate_seed_data.py
│   │   │   └── festival_calendar.json
│   │   ├── routes/              # API routes
│   │   ├── models/              # Pydantic models (Phase 2+)
│   │   └── services/            # Business logic (Phase 2+)
│   ├── requirements.txt
│   └── .env.example
├── frontend/                    # Vite + React + Tailwind scaffold
└── README.md
```

## Prerequisites

- Python 3.11+
- Node.js 18+ (frontend scaffold only in Phase 1)
- Free [Supabase](https://supabase.com) project (Postgres)

## 1. Backend setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Copy environment variables:

```powershell
copy .env.example .env
```

Edit `.env` and set `DATABASE_URL` from **Supabase → Project Settings → Database → Connection string (URI)**. Replace `[YOUR-PASSWORD]` with your database password.

## 2. Create database tables

In the Supabase SQL editor, run the contents of:

```
backend/app/db/schema.sql
```

## 3. Seed the database

The CSV is already generated (`seed_data.csv`). To regenerate it:

```powershell
python -m app.db.generate_seed_data
```

Load data into Supabase:

```powershell
python -m app.db.seed_db
```

Expected output: **5 stores**, **15 SKUs**, **~27,450 sales rows** (5 stores × 15 SKUs × 366 days).

## 4. Start the API

From `backend/` with the virtualenv active:

```powershell
uvicorn app.main:app --reload
```

API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Verify endpoints

**Health check**

```powershell
curl http://127.0.0.1:8000/health
```

Expected: `{"status":"ok"}`

**Sales history (for Prophet in Phase 2)**

```powershell
curl http://127.0.0.1:8000/sales/SKU001
```

Optional store filter:

```powershell
curl "http://127.0.0.1:8000/sales/SKU001?store_id=ST01"
```

## 5. Frontend scaffold (optional in Phase 1)

```powershell
cd frontend
npm install
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173). UI work starts in Phase 3.

## Dataset notes

- **Stores:** 5 locations across Bengaluru, Mumbai, Delhi  
- **SKUs:** 15 products across Snacks, Beverages, Personal Care, Household  
- **Period:** 2024-01-01 → 2024-12-31 (daily)  
- **Patterns:** weekend spikes, Diwali/Holi/New Year/exam-season lifts, noise  
- **Festival calendar:** `backend/app/db/festival_calendar.json` — use as Prophet regressors in Phase 2

## What's next

| Phase | Focus |
|-------|--------|
| **2** | Prophet forecasting, reorder points, `/forecast` endpoints |
| **3** | React dashboard, what-if simulator, AI copilot chat |

## Free-tier tips

- Supabase free tier: 500 MB database, sufficient for this dataset  
- Run backend locally; deploy later with Render/Railway free tiers if needed  
- Prophet is installed now to avoid setup friction in Phase 2
