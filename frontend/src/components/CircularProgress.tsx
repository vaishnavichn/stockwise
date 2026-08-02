import { useEffect, useRef, useState } from "react";

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export default function CircularProgress({
  value,
  size = 220,
  strokeWidth = 18,
  label = "Inventory Health",
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  /* Animate ring fill on mount / value change */
  const [offset, setOffset] = useState(circumference);
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    /* Trigger ring animation after a paint frame */
    const id = requestAnimationFrame(() => setOffset(targetOffset));
    return () => cancelAnimationFrame(id);
  }, [targetOffset]);

  /* Count-up animation for the number */
  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const from = 0;
    const to = clamped;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      /* Ease-out cubic */
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(from + (to - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [clamped]);

  return (
    <div className="flex flex-col items-center gap-3 animate-fade-in-up">
      <div
        className="relative neu-raised flex items-center justify-center"
        style={{ width: size + 32, height: size + 32, borderRadius: "50%" }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7c6cf0" />
              <stop offset="50%" stopColor="#5b4cdb" />
              <stop offset="100%" stopColor="#4338ca" />
            </linearGradient>
            {/* Standard glow */}
            <filter id="ringGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            {/* Stronger glow for pulse peak */}
            <filter id="ringGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background track with subtle inset */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#d1d9e6"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            opacity={0.7}
          />

          {/* Active ring */}
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
          <span className="text-5xl font-bold text-[var(--neu-text)] leading-none tabular-nums">
            {displayValue}
          </span>
          <span className="text-sm text-[var(--neu-text-muted)] mt-1">%</span>
        </div>
      </div>
      <p className="text-sm font-medium text-[var(--neu-text-muted)]">{label}</p>
    </div>
  );
}
