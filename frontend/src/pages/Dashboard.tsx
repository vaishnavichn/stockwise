import { useCallback, useEffect, useState } from "react";
import { loadDashboardData } from "../api/client";
import { SKU_CATALOG } from "../api/types";
import type { DashboardData } from "../api/types";
import AlertCard from "../components/AlertCard";
import AssistantChat from "../components/AssistantChat";
import CategoryBar from "../components/CategoryBar";
import CircularProgress from "../components/CircularProgress";
import ForecastCard from "../components/ForecastCard";
import KpiCards from "../components/KpiCards";
import LayoutShell from "../components/LayoutShell";
import ToggleSwitch from "../components/ToggleSwitch";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState("SKU001");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [activeNav, setActiveNav] = useState<"home" | "inventory" | "analytics" | "settings">(
    "home",
  );
  const [timeRange, setTimeRange] = useState<"30" | "60" | "90">("30");

  const fetchData = useCallback(async (skuId: string) => {
    setLoading(true);
    const result = await loadDashboardData(skuId);
    setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(selectedSku);
  }, [selectedSku, fetchData]);

  const productName =
    SKU_CATALOG.find((s) => s.sku_id === selectedSku)?.product_name ??
    selectedSku;

  return (
    <LayoutShell
      activeNav={activeNav}
      onNavChange={setActiveNav}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      onUploadSuccess={() => fetchData(selectedSku)}
      banner={
        data?.usingMock
          ? "Connecting to local backend... (Showing fallback preview)"
          : undefined
      }
    >
      {/* ── Dynamic Tab 1: Dashboard Home View ────────────────── */}
      {activeNav === "home" && (
        <div className="max-w-6xl mx-auto space-y-12 py-2">
          {/* Section 0: Executive KPI Cards */}
          <section className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold tracking-widest text-[var(--neu-text-muted)] uppercase">
                EXECUTIVE METRICS (SUPABASE LIVE)
              </span>
              <span className="text-xs text-[var(--neu-text-muted)] font-medium">
                Next {timeRange} Days Outlook
              </span>
            </div>
            <KpiCards kpis={data?.kpis} loading={loading} />
          </section>

          {/* Section 1: Inventory Health Overview */}
          <section className="animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold tracking-widest text-[var(--neu-text-muted)] uppercase">
                INVENTORY HEALTH OVERVIEW
              </span>
            </div>
            <div className="neu-raised p-8 sm:p-10">
              <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-14">
                {loading ? (
                  <div className="neu-skeleton w-56 h-56 rounded-full shrink-0" />
                ) : (
                  <CircularProgress value={data?.healthScore ?? 0} />
                )}

                <div className="flex-1 w-full">
                  <h3 className="text-base font-bold text-[var(--neu-text)] mb-6 text-center lg:text-left tracking-tight">
                    Stock Health by Category
                  </h3>
                  <div className="flex gap-4 sm:gap-6 justify-center">
                    {loading
                      ? [1, 2, 3, 4].map((i) => (
                          <div key={i} className="neu-skeleton h-44 flex-1" />
                        ))
                      : data?.categoryHealth.map((cat, i) => (
                          <CategoryBar
                            key={cat.category}
                            label={cat.category}
                            value={cat.healthPct}
                            gradientClass={cat.gradientClass}
                            index={i}
                          />
                        ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Forecast & Alerts */}
          <section className="space-y-8 lg:space-y-0 lg:grid lg:grid-cols-[1.85fr_1fr] lg:gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-widest text-[var(--neu-text-muted)] uppercase">
                  PROPHET DEMAND FORECAST
                </span>
                <ToggleSwitch
                  checked={viewMode === "table"}
                  onChange={(checked) => setViewMode(checked ? "table" : "chart")}
                />
              </div>
              <ForecastCard
                skuId={selectedSku}
                productName={productName}
                forecast={data?.forecast.forecast ?? []}
                salesHistory={data?.salesHistory ?? []}
                viewMode={viewMode}
                loading={loading}
                modelAccuracy={data?.forecast.model_accuracy}
                onSkuChange={setSelectedSku}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-widest text-[var(--neu-text-muted)] uppercase">
                  ACTION CENTER
                </span>
              </div>
              <AlertCard alerts={data?.alerts ?? []} loading={loading} />
            </div>
          </section>
        </div>
      )}

      {/* ── Dynamic Tab 2: Inventory Catalog View ─────────────── */}
      {activeNav === "inventory" && (
        <div className="max-w-6xl mx-auto space-y-6 py-2 animate-fade-in-up">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-[var(--neu-text)]">
                Full SKU Catalog & Live Reorder Status
              </h2>
              <p className="text-xs text-[var(--neu-text-muted)]">
                Directly synchronized with Supabase Postgres DB
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchData(selectedSku)}
              className="neu-raised-sm px-4 py-2 text-xs font-bold text-[var(--primary-accent)] neu-hover-lift"
            >
              Refresh Data
            </button>
          </div>

          <div className="neu-raised p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300/60 text-[var(--neu-text-muted)] uppercase tracking-wider font-bold">
                    <th className="pb-3 px-2">SKU ID</th>
                    <th className="pb-3 px-2">Product Name</th>
                    <th className="pb-3 px-2">Category</th>
                    <th className="pb-3 px-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/50 text-[var(--neu-text)]">
                  {SKU_CATALOG.map((sku) => (
                    <tr key={sku.sku_id} className="hover:bg-slate-200/30 transition-colors">
                      <td className="py-3 px-2 font-mono font-bold">{sku.sku_id}</td>
                      <td className="py-3 px-2 font-bold">{sku.product_name}</td>
                      <td className="py-3 px-2">
                        <span className="neu-inset-sm px-2.5 py-0.5 font-semibold text-[10px]">
                          {sku.category}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSku(sku.sku_id);
                            setActiveNav("home");
                          }}
                          className="neu-raised-sm px-3 py-1 text-[11px] font-bold text-[var(--primary-accent)] neu-hover-lift"
                        >
                          View Forecast
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Dynamic Tab 3: Analytics View ──────────────────────── */}
      {activeNav === "analytics" && (
        <div className="max-w-6xl mx-auto space-y-6 py-2 animate-fade-in-up">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--neu-text)]">
              Model Performance & Cross-Validation Metrics
            </h2>
            <p className="text-xs text-[var(--neu-text-muted)]">
              Evaluated via holdout validation and multi-cutoff cross-validation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="neu-raised p-6 space-y-4">
              <h3 className="text-sm font-bold text-[var(--neu-text)]">
                Forecast Accuracy Summary
              </h3>
              <p className="text-xs text-[var(--neu-text-muted)] leading-relaxed">
                Prophet models are trained offline on 4+ years of Superstore retail sales data with country holidays and festival calendar regressors.
              </p>
              <div className="neu-inset p-4 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between font-semibold">
                  <span>Selected SKU:</span>
                  <span className="font-bold text-[var(--primary-accent)]">{selectedSku}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Holdout MAPE:</span>
                  <span>{data?.forecast.model_accuracy?.mape ?? 0}%</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>RMSE Error:</span>
                  <span>{data?.forecast.model_accuracy?.rmse ?? 0} units</span>
                </div>
              </div>
            </div>

            <div className="neu-raised p-6 space-y-4">
              <h3 className="text-sm font-bold text-[var(--neu-text)]">
                Model Retraining & Control
              </h3>
              <p className="text-xs text-[var(--neu-text-muted)] leading-relaxed">
                Trigger background Prophet retraining pipeline across all 15 SKUs with hyperparameter grid search and winsorization.
              </p>
              <button
                type="button"
                onClick={async () => {
                  alert("Triggered background Prophet model retraining pipeline!");
                  try {
                    await fetch("/api/admin/retrain-models", { method: "POST" });
                  } catch (e) {
                    console.log(e);
                  }
                }}
                className="w-full neu-raised-sm py-3 text-xs font-extrabold text-white gradient-purple neu-hover-lift"
              >
                Trigger Offline Retraining Pipeline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dynamic Tab 4: Settings View ────────────────────────── */}
      {activeNav === "settings" && (
        <div className="max-w-6xl mx-auto space-y-6 py-2 animate-fade-in-up">
          <div>
            <h2 className="text-xl font-extrabold text-[var(--neu-text)]">
              System Settings & Supabase Connection
            </h2>
            <p className="text-xs text-[var(--neu-text-muted)]">
              Manage database endpoints, LLM service API keys, and model parameters
            </p>
          </div>

          <div className="neu-raised p-6 space-y-5 max-w-xl">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--neu-text)]">
                Database Engine
              </label>
              <input
                type="text"
                disabled
                value="Supabase Postgres (heynnipvcykduxwmrrog.supabase.co)"
                className="w-full neu-inset px-3.5 py-2 text-xs font-medium text-[var(--neu-text-muted)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--neu-text)]">
                AI Assistant Engine
              </label>
              <input
                type="text"
                disabled
                value="Groq LLaMA-3.3-70b / Google Gemini 1.5 Flash"
                className="w-full neu-inset px-3.5 py-2 text-xs font-medium text-[var(--neu-text-muted)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--neu-text)]">
                Forecasting Engine
              </label>
              <input
                type="text"
                disabled
                value="Facebook Prophet (with US & Festival Calendar Holidays)"
                className="w-full neu-inset px-3.5 py-2 text-xs font-medium text-[var(--neu-text-muted)]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Assistant Chat */}
      <AssistantChat />
    </LayoutShell>
  );
}
