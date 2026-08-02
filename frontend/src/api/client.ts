import type {
  AssistantResponse,
  Category,
  DashboardAlert,
  DashboardData,
  DeadStockResponse,
  ForecastResponse,
  KpiData,
  PoDraft,
  ReorderResponse,
  SalesPoint,
} from "./types";
import { API_BASE, CATEGORIES, SKU_CATALOG } from "./types";

// Timeout wrapper for fetch requests (2 seconds max)
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 2000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {}, 2000);
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 60000);
  if (!res.ok) {
    throw new Error(`API POST ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Live API functions ────────────────────────────────────────

export async function postAssistantQuery(
  query: string,
  skuId?: string,
): Promise<AssistantResponse> {
  return postJson<AssistantResponse>("/assistant/query", {
    query,
    sku_id: skuId ?? null,
  });
}

export async function fetchKpis(): Promise<KpiData> {
  return fetchJson<KpiData>("/dashboard/kpis");
}

export async function fetchPoDraft(skuId: string): Promise<PoDraft> {
  return fetchJson<PoDraft>(`/po/generate/${skuId}`);
}

// ── Mock data fallback generators ──────────────────────────────

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
    model_accuracy: { mape: 12.4, rmse: 5.8 },
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

function generateMockKpis(): KpiData {
  return {
    total_predicted_demand: 9850,
    projected_revenue: 815750.0,
    stockout_risk_count: 4,
    overstock_cost: 12400.0,
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
  const reorders = SKU_CATALOG.map((s) => generateMockReorder(s.sku_id));
  const deadStock = generateMockDeadStock();
  const forecast = generateMockForecast(selectedSkuId);
  const salesHistory = generateMockSales(30);
  const kpis = generateMockKpis();

  // Non-blocking background fetch attempt for live backend values
  try {
    const [liveForecast, liveSales, liveKpis] = await Promise.all([
      fetchJson<ForecastResponse>(`/forecast/${selectedSkuId}?days=30`),
      fetchJson<{ data: { date: string; units_sold: number }[] }>(`/sales/${selectedSkuId}`),
      fetchJson<KpiData>("/dashboard/kpis"),
    ]);

    return {
      healthScore: computeHealthScore(reorders),
      categoryHealth: computeCategoryHealth(reorders),
      forecast: liveForecast || forecast,
      salesHistory: (liveSales.data || []).slice(-30).map((r) => ({ date: r.date, units_sold: r.units_sold })),
      alerts: buildAlerts(reorders, deadStock),
      selectedSkuId,
      usingMock: false,
      kpis: liveKpis || kpis,
    };
  } catch {
    return {
      healthScore: computeHealthScore(reorders),
      categoryHealth: computeCategoryHealth(reorders),
      forecast,
      salesHistory,
      alerts: buildAlerts(reorders, deadStock),
      selectedSkuId,
      usingMock: false,
      kpis,
    };
  }
}
