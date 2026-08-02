import { useState } from "react";
import { FileText, AlertTriangle, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react";
import type { DashboardAlert, PoDraft } from "../api/types";
import { fetchPoDraft } from "../api/client";
import PoModal from "./PoModal";

const typeBadge: Record<string, { label: string; classes: string }> = {
  reorder: {
    label: "Reorder Required",
    classes: "bg-amber-100/70 text-amber-800",
  },
  dead_stock: {
    label: "Slow Moving",
    classes: "bg-rose-100/70 text-rose-800",
  },
};

interface AlertCardProps {
  alerts: DashboardAlert[];
  loading?: boolean;
}

export default function AlertCard({ alerts, loading }: AlertCardProps) {
  const [poData, setPoData] = useState<PoDraft | null>(null);
  const [poLoading, setPoLoading] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const handleGeneratePo = async (skuId: string) => {
    setPoLoading(skuId);
    try {
      const draft = await fetchPoDraft(skuId);
      setPoData(draft);
    } catch (err) {
      console.error("PO generation failed:", err);
    } finally {
      setPoLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="neu-raised p-6">
        <div className="neu-skeleton h-6 w-40 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="neu-skeleton h-20 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const displayedAlerts = showAll ? alerts : alerts.slice(0, 4);

  return (
    <>
      <div className="neu-raised p-6 flex flex-col justify-between h-full animate-fade-in-up">
        <div>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-extrabold text-[var(--neu-text)] tracking-tight">
              Action Center
            </h3>
            <span className="text-[11px] font-bold text-[var(--primary-accent)] neu-inset-sm px-2.5 py-1">
              {alerts.length} Active
            </span>
          </div>

          {/* Scrollable list container with fade clue */}
          <div className="relative">
            <ul className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {displayedAlerts.map((alert, i) => {
                const badge = typeBadge[alert.type];
                const isRed = alert.severity === "red";
                const isGreen = alert.severity === "green";
                const Icon = isGreen ? CheckCircle2 : isRed ? AlertCircle : AlertTriangle;
                const iconBg = isGreen
                  ? "bg-emerald-50 text-emerald-600"
                  : isRed
                  ? "bg-rose-50 text-rose-600"
                  : "bg-amber-50 text-amber-600";

                return (
                  <li
                    key={alert.id}
                    className="neu-inset-sm p-3.5 flex items-start gap-3.5 neu-hover-lift animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.08 + 0.15}s` }}
                  >
                    {/* Neumorphic Raised Icon Circle */}
                    <div className={`w-8 h-8 rounded-xl neu-raised-sm flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content Block */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="font-bold text-xs text-[var(--neu-text)] tracking-tight">
                          {alert.product_name}
                        </h4>
                        {badge && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badge.classes}`}>
                            {badge.label}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[var(--neu-text-muted)] leading-relaxed">
                        {alert.message}
                      </p>
                    </div>

                    {/* Generate PO button */}
                    {alert.type === "reorder" && alert.severity !== "green" && (
                      <button
                        type="button"
                        onClick={() => handleGeneratePo(alert.sku_id)}
                        disabled={poLoading === alert.sku_id}
                        className="shrink-0 neu-raised-sm px-3 py-1.5 flex items-center gap-1.5 text-[11px] font-extrabold text-[var(--primary-accent)] rounded-lg neu-hover-lift disabled:opacity-50"
                        title="Generate Purchase Order"
                      >
                        <FileText className="w-3 h-3" />
                        {poLoading === alert.sku_id ? "..." : "PO"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* View All / Expand Footer Link */}
        {alerts.length > 4 && (
          <div className="pt-4 mt-2 border-t border-slate-300/40 text-center">
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-xs font-bold text-[var(--primary-accent)] hover:underline inline-flex items-center gap-1"
            >
              <span>{showAll ? "Show less" : `View all ${alerts.length} alerts`}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? "rotate-180" : ""}`} />
            </button>
          </div>
        )}
      </div>

      {/* PO Modal */}
      {poData && <PoModal po={poData} onClose={() => setPoData(null)} />}
    </>
  );
}
