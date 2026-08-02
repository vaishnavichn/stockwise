interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  leftLabel?: string;
  rightLabel?: string;
}

export default function ToggleSwitch({
  checked,
  onChange,
  leftLabel = "Chart",
  rightLabel = "Table",
}: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`text-sm font-medium transition-colors duration-200 ${
          !checked ? "text-[var(--neu-text)]" : "text-[var(--neu-text-muted)]"
        }`}
      >
        {leftLabel}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
          checked ? "neu-raised-sm" : "neu-inset-sm"
        }`}
      >
        {/* Knob with spring bounce */}
        <span
          className="absolute top-1 left-1 w-6 h-6 rounded-full gradient-purple"
          style={{
            transform: checked ? "translateX(32px)" : "translateX(0px)",
            transition:
              "transform 0.4s cubic-bezier(0.68, -0.6, 0.32, 1.6)",
            boxShadow:
              "0 2px 6px rgba(91, 76, 219, 0.5), 0 1px 2px rgba(0,0,0,0.1)",
          }}
        />
      </button>
      <span
        className={`text-sm font-medium transition-colors duration-200 ${
          checked ? "text-[var(--neu-text)]" : "text-[var(--neu-text-muted)]"
        }`}
      >
        {rightLabel}
      </span>
    </div>
  );
}
