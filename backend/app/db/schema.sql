-- Smart Inventory Copilot — Supabase Schema SQL
-- Copy and paste this script into your Supabase Dashboard -> SQL Editor and click RUN.

-- 1. STORES TABLE
CREATE TABLE IF NOT EXISTS stores (
    store_id   TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    location   TEXT NOT NULL
);

-- 2. SKUS TABLE
CREATE TABLE IF NOT EXISTS skus (
    sku_id       TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    category     TEXT NOT NULL,
    unit_price   NUMERIC(10, 2) NOT NULL
);

-- 3. SALES TABLE
CREATE TABLE IF NOT EXISTS sales (
    id                     BIGSERIAL PRIMARY KEY,
    date                   DATE NOT NULL,
    store_id               TEXT NOT NULL REFERENCES stores (store_id) ON DELETE CASCADE,
    sku_id                 TEXT NOT NULL REFERENCES skus (sku_id) ON DELETE CASCADE,
    units_sold             INTEGER NOT NULL CHECK (units_sold >= 0),
    stock_on_hand_estimate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    CONSTRAINT unique_sales_date_store_sku UNIQUE (date, store_id, sku_id)
);

-- 4. INDEXES (Optimized for forecast & sales history queries)
CREATE INDEX IF NOT EXISTS idx_sales_sku_date ON sales (sku_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales (store_id, date);

-- ROW LEVEL SECURITY (RLS) NOTE FOR DEMO:
-- Since the FastAPI backend connects using the Supabase SECRET KEY (or service key),
-- all server-side operations bypass RLS automatically.
-- For a fast & safe hackathon demo, you can leave RLS disabled, or enable it with a read-permissive policy:
-- ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read" ON stores FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON skus FOR SELECT USING (true);
-- CREATE POLICY "Allow public read" ON sales FOR SELECT USING (true);
