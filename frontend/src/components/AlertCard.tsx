import type { DashboardAlert } from "../api/types";

const dotColors: Record<string, string> = {
  red: "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]",
  amber: "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]",
  green: "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]",
};

const typeBadge: Record<string, { label: string; classes: string }> = {
  reorder: {
    label: "Reorder",
    classes: "bg-amber-100 text-amber-700",
  },
  dead_stock: {
    label: "Dead Stock",
    classes: "bg-rose-100 text-rose-700",
  },
};

interface AlertCardProps {
  alerts: DashboardAlert[];
  loading?: boolean;
}

export default function AlertCard({ alerts, loading }: AlertCardProps) {
  if (loading) {
    return (
      <div className="neu-raised p-6">
        <div className="neu-skeleton h-6 w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="neu-skeleton h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="neu-raised p-6 animate-fade-in-up animate-delay-4">
      <h2 className="text-lg font-semibold text-[var(--neu-text)] mb-4">
        Inventory Alerts
      </h2>
      <ul className="space-y-3">
        {alerts.map((alert, i) => {
          const badge = typeBadge[alert.type];
          return (
            <li
              key={alert.id}
              className="neu-inset-sm px-4 py-3 flex items-start gap-3 neu-hover-lift animate-fade-in-up"
              style={{ animationDelay: `${i * 0.08 + 0.45}s` }}
            >
              {/* Status dot */}
              <span
                className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${dotColors[alert.severity]}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm text-[var(--neu-text)] truncate">
                    {alert.product_name}
                  </p>
                  {badge && (
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                  )}
                  <span className="text-[var(--neu-text-muted)] text-xs font-normal">
                    {alert.sku_id}
                  </span>
                </div>
                <p className="text-sm text-[var(--neu-text-muted)] mt-0.5">
                  {alert.message}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
