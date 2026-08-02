import type {
  Category,
  DashboardAlert,
  DashboardData,
  DeadStockResponse,
  ForecastResponse,
  ReorderResponse,
  SalesPoint,
} from "./types";
import { API_BASE, CATEGORIES, SKU_CATALOG } from "./types";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function generateMockForecast(skuId: string, days = 30): ForecastResponse {
  const base = 20 + (skuId.charCodeAt(3) % 10) * 3;
  const today = new Date();
  const forecast = Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i + 1);
    const seasonal = 1 + 0.12 * Math.sin((i / days) * Math.PI * 2);
    const predicted = Math.round(base * seasonal + (i % 5));
    return {
      date: d.toISOString().slice(0, 10),
      predicted_units: predicted,
      lower_bound: Math.max(0, predicted - 6),
      upper_bound: predicted + 8,
    };
  });

  return {
    sku_id: skuId,
    store_id: null,
    periods: days,
    history_days: 366,
    method: "prophet",
    forecast,
  };
}

function generateMockSales(days = 30): SalesPoint[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (days - i));
    return {
      date: d.toISOString().slice(0, 10),
      units_sold: 18 + Math.round(8 * Math.sin(i / 4) + (i % 3)),
    };
  });
}

function generateMockDeadStock(): DeadStockResponse {
  return {
    threshold_days: 14,
    decline_pct_threshold: 30,
    count: 2,
    flagged_skus: [
      {
        sku_id: "SKU003",
        product_name: "Dark Chocolate Bar",
        category: "Snacks",
        recent_daily_avg: 8.2,
        prior_daily_avg: 14.5,
        decline_pct: -43.4,
      },
      {
        sku_id: "SKU011",
        product_name: "Toothpaste 150g",
        category: "Personal Care",
        recent_daily_avg: 5.1,
        prior_daily_avg: 8.0,
        decline_pct: -36.2,
      },
    ],
  };
}

function generateMockReorder(skuId: string): ReorderResponse {
  const meta = SKU_CATALOG.find((s) => s.sku_id === skuId)!;
  const needs = skuId.endsWith("1") || skuId.endsWith("4");
  return {
    sku_id: skuId,
    product_name: meta.product_name,
    store_id: null,
    avg_daily_demand: 22.5,
    lead_time_days: 3,
    safety_stock_days: 2,
    reorder_point: 112.5,
    stock_on_hand: needs ? 45 : 180,
    needs_reorder: needs,
    reorder_quantity: needs ? 67.5 : 0,
  };
}

function buildAlerts(
  reorders: ReorderResponse[],
  deadStock: DeadStockResponse,
): DashboardAlert[] {
  const alerts: DashboardAlert[] = [];

  for (const r of reorders.filter((x) => x.needs_reorder)) {
    alerts.push({
      id: `reorder-${r.sku_id}`,
      type: "reorder",
      sku_id: r.sku_id,
      product_name: r.product_name,
      message: `Reorder ${Math.ceil(r.reorder_quantity)} units — stock below safety level`,
      severity: "amber",
    });
  }

  for (const d of deadStock.flagged_skus) {
    alerts.push({
      id: `dead-${d.sku_id}`,
      type: "dead_stock",
      sku_id: d.sku_id,
      product_name: d.product_name,
      message: `Sales down ${Math.abs(d.decline_pct).toFixed(0)}% vs prior period`,
      severity: "red",
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      id: "all-clear",
      type: "reorder",
      sku_id: "—",
      product_name: "All SKUs",
      message: "Inventory levels look healthy across categories",
      severity: "green",
    });
  }

  return alerts;
}

function computeCategoryHealth(
  reorders: ReorderResponse[],
): DashboardData["categoryHealth"] {
  const gradientMap: Record<
    Category,
    "gradient-purple" | "gradient-blue" | "gradient-amber" | "gradient-pink"
  > = {
    Snacks: "gradient-purple",
    Beverages: "gradient-blue",
    "Personal Care": "gradient-amber",
    Household: "gradient-pink",
  };

  return CATEGORIES.map((category) => {
    const skusInCat = reorders.filter(
      (r) => SKU_CATALOG.find((s) => s.sku_id === r.sku_id)?.category === category,
    );
    const healthy = skusInCat.filter((r) => !r.needs_reorder).length;
    const healthPct =
      skusInCat.length === 0
        ? 0
        : Math.round((healthy / skusInCat.length) * 100);

    return {
      category,
      healthPct,
      gradientClass: gradientMap[category],
    };
  });
}

function computeHealthScore(reorders: ReorderResponse[]): number {
  if (reorders.length === 0) return 0;
  const healthy = reorders.filter((r) => !r.needs_reorder).length;
  return Math.round((healthy / reorders.length) * 100);
}

export async function loadDashboardData(
  selectedSkuId = "SKU001",
): Promise<DashboardData> {
  let usingMock = false;

  try {
    const [forecast, salesRaw, deadStock, ...reorders] = await Promise.all([
      fetchJson<ForecastResponse>(`/forecast/${selectedSkuId}?days=30`),
      fetchJson<{ data: { date: string; units_sold: number }[] }>(
        `/sales/${selectedSkuId}`,
      ),
      fetchJson<DeadStockResponse>("/inventory/dead-stock"),
      ...SKU_CATALOG.map((s) =>
        fetchJson<ReorderResponse>(`/inventory/reorder/${s.sku_id}`),
      ),
    ]);

    const salesHistory: SalesPoint[] = salesRaw.data
      .slice(-30)
      .map((row) => ({
        date: row.date,
        units_sold: row.units_sold,
      }));

    return {
      healthScore: computeHealthScore(reorders),
      categoryHealth: computeCategoryHealth(reorders),
      forecast,
      salesHistory,
      alerts: buildAlerts(reorders, deadStock),
      selectedSkuId,
      usingMock: false,
    };
  } catch {
    usingMock = true;
    const reorders = SKU_CATALOG.map((s) => generateMockReorder(s.sku_id));
    const deadStock = generateMockDeadStock();
    const forecast = generateMockForecast(selectedSkuId);
    const salesHistory = generateMockSales(30);

    return {
      healthScore: computeHealthScore(reorders),
      categoryHealth: computeCategoryHealth(reorders),
      forecast,
      salesHistory,
      alerts: buildAlerts(reorders, deadStock),
      selectedSkuId,
      usingMock,
    };
  }
}
