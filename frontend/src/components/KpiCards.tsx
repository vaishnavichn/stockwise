import { useEffect, useRef, useState } from "react";
import { TrendingUp, DollarSign, AlertTriangle, Package, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import type { KpiData } from "../api/types";

interface KpiCardsProps {
  kpis: KpiData | null | undefined;
  loading?: boolean;
}

interface KpiCardDef {
  key: keyof KpiData;
  label: string;
  icon: typeof TrendingUp;
  badgeText: string;
  badgePositive: boolean;
  iconBgGradient: string;
  sparklineColor: string;
  sparklineData: { val: number }[];
  format: (v: number) => string;
}

const KPI_DEFS: KpiCardDef[] = [
  {
    key: "total_predicted_demand",
    label: "PREDICTED DEMAND (30D)",
    icon: TrendingUp,
    badgeText: "+12.4%",
    badgePositive: true,
    iconBgGradient: "gradient-purple",
    sparklineColor: "#6366f1",
    sparklineData: [{ val: 40 }, { val: 45 }, { val: 42 }, { val: 55 }, { val: 52 }, { val: 68 }, { val: 75 }],
    format: (v) => v.toLocaleString("en-IN", { maximumFractionDigits: 0 }),
  },
  {
    key: "projected_revenue",
    label: "PROJECTED REVENUE",
    icon: DollarSign,
    badgeText: "+8.2%",
    badgePositive: true,
    iconBgGradient: "gradient-blue",
    sparklineColor: "#3b82f6",
    sparklineData: [{ val: 120 }, { val: 132 }, { val: 125 }, { val: 145 }, { val: 150 }, { val: 162 }, { val: 180 }],
    format: (v) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
  },
  {
    key: "stockout_risk_count",
    label: "STOCKOUT RISK SKUs",
    icon: AlertTriangle,
    badgeText: "-2 items",
    badgePositive: false,
    iconBgGradient: "gradient-amber",
    sparklineColor: "#f59e0b",
    sparklineData: [{ val: 8 }, { val: 7 }, { val: 6 }, { val: 5 }, { val: 4 }, { val: 3 }, { val: 2 }],
    format: (v) => v.toString(),
  },
  {
    key: "overstock_cost",
    label: "OVERSTOCK CAPITAL",
    icon: Package,
    badgeText: "-4.1%",
    badgePositive: true,
    iconBgGradient: "gradient-pink",
    sparklineColor: "#ec4899",
    sparklineData: [{ val: 95 }, { val: 90 }, { val: 88 }, { val: 82 }, { val: 78 }, { val: 75 }, { val: 70 }],
    format: (v) => `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
  },
];

function AnimatedNumber({ target, format }: { target: number; format: (v: number) => string }) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const duration = 1200;
    const start = performance.now();

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setCurrent(Math.round(target * eased * 100) / 100);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return <span>{format(current)}</span>;
}

export default function KpiCards({ kpis, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="neu-skeleton h-40" />
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {KPI_DEFS.map((def, i) => {
        const Icon = def.icon;
        const value = kpis[def.key];
        const TrendIcon = def.badgePositive ? ArrowUpRight : ArrowDownRight;

        return (
          <div
            key={def.key}
            className="neu-raised p-6 flex flex-col justify-between animate-fade-in-up neu-hover-lift"
            style={{ animationDelay: `${i * 0.08}s` }}
          >
            {/* Top Row: Neumorphic Icon Well + Trend Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${def.iconBgGradient}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2.5 py-1 rounded-full neu-inset-sm ${
                  def.badgePositive ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                <TrendIcon className="w-3.5 h-3.5" />
                {def.badgeText}
              </span>
            </div>

            {/* Middle & Bottom: Stat Callout & Inline Sparkline */}
            <div className="flex items-end justify-between gap-2 mt-1">
              <div>
                <p className="text-3xl font-black text-[var(--neu-text)] tracking-tight leading-none">
                  <AnimatedNumber target={value} format={def.format} />
                </p>
                <p className="text-[10px] font-bold tracking-widest text-[var(--neu-text-muted)] mt-2 uppercase">
                  {def.label}
                </p>
              </div>

              {/* Inline Sparkline */}
              <div className="w-20 h-10 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={def.sparklineData}>
                    <defs>
                      <linearGradient id={`spark-${def.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={def.sparklineColor} stopOpacity={0.4} />
                        <stop offset="100%" stopColor={def.sparklineColor} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="val"
                      stroke={def.sparklineColor}
                      strokeWidth={2}
                      fill={`url(#spark-${def.key})`}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
