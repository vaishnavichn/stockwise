-- Smart Inventory Copilot — Postgres schema (run in Supabase SQL editor)
-- Phase 1: core reference + transactional sales data

CREATE TABLE IF NOT EXISTS stores (
    store_id   VARCHAR(10) PRIMARY KEY,
    store_name VARCHAR(100) NOT NULL,
    location   VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS skus (
    sku_id       VARCHAR(10) PRIMARY KEY,
    product_name VARCHAR(150) NOT NULL,
    category     VARCHAR(50)  NOT NULL,
    unit_price   NUMERIC(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS sales (
    id             SERIAL PRIMARY KEY,
    date           DATE NOT NULL,
    store_id       VARCHAR(10) NOT NULL REFERENCES stores (store_id),
    sku_id         VARCHAR(10) NOT NULL REFERENCES skus (sku_id),
    units_sold     INTEGER NOT NULL CHECK (units_sold >= 0),
    stock_on_hand  INTEGER NOT NULL CHECK (stock_on_hand >= 0),
    UNIQUE (date, store_id, sku_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_sku_date ON sales (sku_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales (store_id, date);
