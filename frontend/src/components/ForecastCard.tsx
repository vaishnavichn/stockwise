import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint, ModelAccuracy, SalesPoint } from "../api/types";
import { SKU_CATALOG } from "../api/types";

interface ForecastCardProps {
  skuId: string;
  productName: string;
  forecast: ForecastPoint[];
  salesHistory: SalesPoint[];
  viewMode: "chart" | "table";
  loading?: boolean;
  modelAccuracy?: ModelAccuracy | null;
  onSkuChange: (skuId: string) => void;
}

function mergeChartData(forecast: ForecastPoint[], sales: SalesPoint[]) {
  const salesMap = new Map(sales.map((s) => [s.date, s.units_sold]));
  const historyRows = sales.map((s) => ({
    date: s.date.slice(5),
    actual: s.units_sold,
    predicted: null as number | null,
  }));
  const forecastRows = forecast.map((f) => ({
    date: f.date.slice(5),
    actual: salesMap.get(f.date) ?? null,
    predicted: f.predicted_units,
  }));
  return [...historyRows, ...forecastRows];
}

export default function ForecastCard({
  skuId,
  productName,
  forecast,
  salesHistory,
  viewMode,
  loading,
  modelAccuracy,
  onSkuChange,
}: ForecastCardProps) {
  if (loading) {
    return (
      <div className="neu-raised p-6">
        <div className="neu-skeleton h-6 w-48 mb-4" />
        <div className="neu-skeleton h-64 w-full" />
      </div>
    );
  }

  const chartData = mergeChartData(forecast, salesHistory);

  return (
    <div className="neu-raised p-6 animate-fade-in-up animate-delay-3">
      {/* Header: title + SKU picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--neu-text)]">
            Demand Forecast
          </h2>
          <p className="text-sm text-[var(--neu-text-muted)]">{productName}</p>
        </div>
        <select
          value={skuId}
          onChange={(e) => onSkuChange(e.target.value)}
          className="neu-inset-sm px-4 py-2 text-sm font-medium text-[var(--neu-text)] bg-transparent border-none outline-none cursor-pointer appearance-none"
        >
          {SKU_CATALOG.map((item) => (
            <option key={item.sku_id} value={item.sku_id}>
              {item.product_name} ({item.sku_id})
            </option>
          ))}
        </select>
      </div>

      {/* Chart or Table */}
      {viewMode === "chart" ? (
        <div className="neu-inset-sm p-3 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="predictedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7c6cf0" stopOpacity={0.4} />
                  <stop offset="50%" stopColor="#5b4cdb" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#4338ca" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke="#cfd8e6"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#e8ecf1",
                  border: "none",
                  borderRadius: 16,
                  boxShadow:
                    "-4px -4px 8px rgba(255,255,255,0.9), 4px 4px 8px rgba(163,177,198,0.45)",
                  padding: "10px 14px",
                }}
                itemStyle={{ color: "#3d4852", fontSize: 12 }}
                labelStyle={{ color: "#6b7280", fontSize: 11, marginBottom: 4 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, color: "#6b7280", paddingTop: 8 }}
              />
              <Area
                type="monotone"
                dataKey="predicted"
                name="Predicted"
                stroke="#5b4cdb"
                strokeWidth={2.5}
                fill="url(#predictedFill)"
                connectNulls
                animationDuration={1200}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Actual"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                connectNulls
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="neu-inset-sm overflow-auto max-h-72">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[var(--neu-text-muted)]">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Actual</th>
                <th className="p-3 font-medium">Predicted</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((row) => (
                <tr
                  key={row.date}
                  className="border-t border-[#d1d9e6]/60 text-[var(--neu-text)] hover:bg-[rgba(91,76,219,0.04)] transition-colors"
                >
                  <td className="p-3">{row.date}</td>
                  <td className="p-3">{row.actual ?? "—"}</td>
                  <td className="p-3">{row.predicted ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Model accuracy (Phase 4) */}
      {modelAccuracy && (
        <p className="mt-3 text-xs text-[var(--neu-text-muted)] text-center">
          Model accuracy: {modelAccuracy.mape.toFixed(1)}% MAPE · RMSE: {modelAccuracy.rmse.toFixed(1)}
        </p>
      )}
    </div>
  );
}
