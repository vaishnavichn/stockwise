interface CategoryBarProps {
  label: string;
  value: number;
  gradientClass: "gradient-purple" | "gradient-blue" | "gradient-amber" | "gradient-pink";
  index?: number;
}

const glowMap: Record<string, string> = {
  "gradient-purple": "0 6px 20px rgba(99, 102, 241, 0.45)",
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
      className="flex flex-col items-center gap-2.5 min-w-[68px] max-w-[90px] flex-1 animate-fade-in-up"
      style={{ animationDelay: `${index * 0.1 + 0.2}s` }}
    >
      {/* Neumorphic Inset Well for the Category Blob */}
      <div className="neu-inset w-full h-36 sm:h-40 p-2.5 flex items-end rounded-2xl">
        <div className="relative w-full h-full rounded-xl overflow-hidden neu-inset-sm bg-slate-200/50">
          {/* Glowing bar fill emerging from the well */}
          <div
            className={`absolute bottom-0 left-0 right-0 rounded-xl ${gradientClass}`}
            style={{
              height: `${clamped}%`,
              boxShadow: glow,
              animation: `bar-rise 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.1 + 0.3}s both`,
              "--bar-target-height": `${clamped}%`,
            } as React.CSSProperties}
          />
        </div>
      </div>

      {/* Label + Percentage */}
      <div className="text-center">
        <p className="text-[11px] font-bold text-[var(--neu-text)] leading-tight truncate">
          {label}
        </p>
        <p className="text-sm font-extrabold text-[var(--primary-accent)] tabular-nums mt-0.5">
          {clamped}%
        </p>
      </div>
    </div>
  );
}
