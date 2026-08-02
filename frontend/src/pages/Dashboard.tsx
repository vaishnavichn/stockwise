import { useCallback, useEffect, useState } from "react";
import { loadDashboardData } from "../api/client";
import { SKU_CATALOG } from "../api/types";
import type { DashboardData } from "../api/types";
import AlertCard from "../components/AlertCard";
import CategoryBar from "../components/CategoryBar";
import CircularProgress from "../components/CircularProgress";
import ForecastCard from "../components/ForecastCard";
import LayoutShell from "../components/LayoutShell";
import ToggleSwitch from "../components/ToggleSwitch";

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSku, setSelectedSku] = useState("SKU001");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [activeNav, setActiveNav] = useState<"home" | "inventory" | "analytics">(
    "home",
  );

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
      banner={
        data?.usingMock
          ? "Showing demo data — start the backend at :8000 for live forecasts"
          : undefined
      }
    >
      <div className="max-w-6xl mx-auto space-y-8">
        {/* ── Section 1: Inventory Health Overview ─────── */}
        <section className="neu-raised p-6 sm:p-8 animate-fade-in-up">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            {/* Circular progress ring */}
            {loading ? (
              <div className="neu-skeleton w-56 h-56 rounded-full shrink-0" />
            ) : (
              <CircularProgress value={data?.healthScore ?? 0} />
            )}

            {/* Category bars */}
            <div className="flex-1 w-full">
              <h2 className="text-lg font-semibold text-[var(--neu-text)] mb-5 text-center lg:text-left">
                Stock Health by Category
              </h2>
              <div className="flex gap-3 sm:gap-5 justify-center">
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
        </section>

        {/* ── Section 2: Forecast + Alerts (desktop grid) ─ */}
        <section className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[2fr_1fr] lg:gap-6">
          {/* Forecast card with toggle */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider animate-fade-in-up animate-delay-2">
                Forecast
              </h2>
              <ToggleSwitch
                checked={viewMode === "table"}
                onChange={(checked) =>
                  setViewMode(checked ? "table" : "chart")
                }
              />
            </div>
            <ForecastCard
              skuId={selectedSku}
              productName={productName}
              forecast={data?.forecast.forecast ?? []}
              salesHistory={data?.salesHistory ?? []}
              viewMode={viewMode}
              loading={loading}
              onSkuChange={setSelectedSku}
            />
          </div>

          {/* Alerts card */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider animate-fade-in-up animate-delay-3">
              Alerts
            </h2>
            <AlertCard alerts={data?.alerts ?? []} loading={loading} />
          </div>
        </section>
      </div>
    </LayoutShell>
  );
}
