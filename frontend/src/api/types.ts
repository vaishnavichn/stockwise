export const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "/api";

export const SKU_CATALOG = [
  { sku_id: "SKU001", product_name: "Masala Chips 50g", category: "Snacks" },
  { sku_id: "SKU002", product_name: "Classic Namkeen 200g", category: "Snacks" },
  { sku_id: "SKU003", product_name: "Dark Chocolate Bar", category: "Snacks" },
  { sku_id: "SKU004", product_name: "Instant Noodles Pack", category: "Snacks" },
  { sku_id: "SKU005", product_name: "Cola 750ml", category: "Beverages" },
  { sku_id: "SKU006", product_name: "Mango Juice 1L", category: "Beverages" },
  { sku_id: "SKU007", product_name: "Mineral Water 1L", category: "Beverages" },
  { sku_id: "SKU008", product_name: "Green Tea Box", category: "Beverages" },
  { sku_id: "SKU009", product_name: "Herbal Shampoo 180ml", category: "Personal Care" },
  { sku_id: "SKU010", product_name: "Face Wash 100ml", category: "Personal Care" },
  { sku_id: "SKU011", product_name: "Toothpaste 150g", category: "Personal Care" },
  { sku_id: "SKU012", product_name: "Hand Sanitizer 100ml", category: "Personal Care" },
  { sku_id: "SKU013", product_name: "Dish Wash Liquid 500ml", category: "Household" },
  { sku_id: "SKU014", product_name: "Floor Cleaner 1L", category: "Household" },
  { sku_id: "SKU015", product_name: "Laundry Detergent 1kg", category: "Household" },
] as const;

export const CATEGORIES = [
  "Snacks",
  "Beverages",
  "Personal Care",
  "Household",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface ForecastPoint {
  date: string;
  predicted_units: number;
  lower_bound: number;
  upper_bound: number;
}

export interface ModelAccuracy {
  mape: number;
  rmse: number;
}

export interface ForecastResponse {
  sku_id: string;
  store_id: string | null;
  periods: number;
  history_days: number;
  method: string;
  model_accuracy?: ModelAccuracy | null;
  forecast: ForecastPoint[];
}

export interface SalesPoint {
  date: string;
  units_sold: number;
}

export interface ReorderResponse {
  sku_id: string;
  product_name: string;
  store_id: string | null;
  avg_daily_demand: number;
  lead_time_days: number;
  safety_stock_days: number;
  reorder_point: number;
  stock_on_hand: number;
  needs_reorder: boolean;
  reorder_quantity: number;
}

export interface DeadStockItem {
  sku_id: string;
  product_name: string;
  category: string;
  recent_daily_avg: number;
  prior_daily_avg: number;
  decline_pct: number;
}

export interface DeadStockResponse {
  threshold_days: number;
  decline_pct_threshold: number;
  count: number;
  flagged_skus: DeadStockItem[];
}

export interface CategoryHealth {
  category: Category;
  healthPct: number;
  gradientClass: "gradient-purple" | "gradient-blue" | "gradient-amber" | "gradient-pink";
}

export interface DashboardAlert {
  id: string;
  type: "reorder" | "dead_stock";
  sku_id: string;
  product_name: string;
  message: string;
  severity: "red" | "amber" | "green";
}

// Phase 4 types

export interface KpiData {
  total_predicted_demand: number;
  projected_revenue: number;
  stockout_risk_count: number;
  overstock_cost: number;
}

export interface AssistantResponse {
  answer: string;
}

export interface PoDraft {
  po_number: string;
  sku_id: string;
  product_name: string;
  category: string;
  supplier: string;
  order_quantity: number;
  unit_price: number;
  total_cost: number;
  avg_daily_demand: number;
  stock_on_hand: number;
  reorder_point: number;
  needs_reorder: boolean;
  justification: string;
  created_at: string;
}

export interface DashboardData {
  healthScore: number;
  categoryHealth: CategoryHealth[];
  forecast: ForecastResponse;
  salesHistory: SalesPoint[];
  alerts: DashboardAlert[];
  selectedSkuId: string;
  usingMock: boolean;
  kpis?: KpiData | null;
}
