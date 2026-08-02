interface CategoryBarProps {
  label: string;
  value: number;
  gradientClass: "gradient-purple" | "gradient-blue" | "gradient-amber" | "gradient-pink";
  /** Index in the row, used for staggered entrance delay */
  index?: number;
}

const glowMap: Record<string, string> = {
  "gradient-purple": "0 6px 20px rgba(91, 76, 219, 0.45)",
  "gradient-blue": "0 6px 20px rgba(59, 130, 246, 0.4)",
  "gradient-amber": "0 6px 20px rgba(245, 158, 11, 0.4)",
  "gradient-pink": "0 6px 20px rgba(236, 72, 153, 0.4)",
};

export default function CategoryBar({
  label,
  value,
  gradientClass,
  index = 0,
}: CategoryBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const glow = glowMap[gradientClass] ?? "none";

  return (
    <div
      className="flex flex-col items-center gap-3 min-w-[72px] flex-1 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.1 + 0.2}s` }}
    >
      {/* Pill container */}
      <div className="neu-inset w-full h-36 sm:h-44 p-3 flex items-end rounded-[28px]">
        <div className="relative w-full h-full rounded-full overflow-hidden neu-inset-sm">
          {/* Colored fill with glow aura */}
          <div
            className={`absolute bottom-0 left-0 right-0 rounded-full ${gradientClass}`}
            style={{
              height: `${clamped}%`,
              boxShadow: glow,
              animation: `bar-rise 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.1 + 0.3}s both`,
              /* CSS custom property for the keyframe target */
              "--bar-target-height": `${clamped}%`,
            } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Label + percentage */}
      <div className="text-center">
        <p className="text-xs sm:text-sm font-semibold text-[var(--neu-text)] leading-tight">
          {label}
        </p>
        <p className="text-lg font-bold text-[var(--neu-text)] tabular-nums">{clamped}%</p>
      </div>
    </div>
  );
}
