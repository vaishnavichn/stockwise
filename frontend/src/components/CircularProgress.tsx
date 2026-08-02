import { useEffect, useRef, useState } from "react";

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  supportingText?: string;
}

export default function CircularProgress({
  value,
  size = 200,
  strokeWidth = 16,
  label = "Inventory Health",
  supportingText = "12 of 15 SKUs Healthy",
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  const [offset, setOffset] = useState(circumference);
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOffset(targetOffset));
    return () => cancelAnimationFrame(id);
  }, [targetOffset]);

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const from = 0;
    const to = clamped;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [clamped]);

  return (
    <div className="flex flex-col items-center gap-3 animate-fade-in-up">
      {/* Neumorphic Inset Well for the Progress Ring */}
      <div
        className="relative neu-inset flex items-center justify-center p-3"
        style={{ width: size + 28, height: size + 28, borderRadius: "50%" }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#4f46e5" />
              <stop offset="100%" stopColor="#3730a3" />
            </linearGradient>
            <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background track with subtle inset feel */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.6}
          />

          {/* Active glowing ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            filter="url(#ringGlow)"
            style={{
              transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-extrabold text-[var(--neu-text)] leading-none tabular-nums">
            {displayValue}%
          </span>
          <span className="text-[11px] font-semibold text-[var(--neu-text-muted)] mt-1.5 uppercase tracking-wider">
            {label}
          </span>
        </div>
      </div>

      {/* Supporting Stat Line */}
      <span className="text-xs font-semibold text-emerald-600 neu-inset-sm px-3 py-1">
        ● {supportingText}
      </span>
    </div>
  );
}
