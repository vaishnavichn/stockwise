import { BarChart3, Home, Package, User } from "lucide-react";
import type { ReactNode } from "react";

type NavItem = "home" | "inventory" | "analytics";

interface LayoutShellProps {
  children: ReactNode;
  activeNav?: NavItem;
  onNavChange?: (item: NavItem) => void;
  banner?: string;
}

const navItems: { id: NavItem; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function LayoutShell({
  children,
  activeNav = "home",
  onNavChange,
  banner,
}: LayoutShellProps) {
  return (
    <div className="min-h-dvh bg-[var(--neu-bg)] flex flex-col lg:flex-row">
      {/* ── Desktop side nav ──────────────────────────── */}
      <aside className="hidden lg:flex flex-col items-center gap-8 py-8 px-4 w-24 shrink-0">
        {/* Logo mark */}
        <div className="neu-raised-sm w-12 h-12 flex items-center justify-center">
          <Package className="w-6 h-6 text-[#5b4cdb]" />
        </div>

        {/* Separator */}
        <div className="w-10 h-px bg-[#d1d9e6]/70" />

        {/* Nav icons */}
        <nav className="flex flex-col gap-5">
          {navItems.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={id}
              onClick={() => onNavChange?.(id)}
              className={`neu-icon-btn ${activeNav === id ? "active" : ""}`}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top bar ─────────────────────────────────── */}
        <header className="flex items-center justify-between px-5 sm:px-8 py-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--neu-text)]">
              Smart Inventory Copilot
            </h1>
            <p className="text-xs sm:text-sm text-[var(--neu-text-muted)]">
              Demand forecasting &amp; stock health
            </p>
          </div>
          <button type="button" className="neu-icon-btn" aria-label="Profile">
            <User className="w-5 h-5" />
          </button>
        </header>

        {/* ── Mock data banner ────────────────────────── */}
        {banner && (
          <div className="mx-5 sm:mx-8 mb-4 neu-inset-sm px-4 py-2 text-xs text-[var(--neu-text-muted)] text-center animate-fade-in-up">
            {banner}
          </div>
        )}

        {/* ── Main content ────────────────────────────── */}
        <main className="flex-1 px-5 sm:px-8 pb-28 lg:pb-8">{children}</main>

        {/* ── Mobile bottom nav (glassmorphism) ────────── */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 px-6 pb-6 pt-2 z-50">
          <div className="glass-panel neu-raised flex items-center justify-around py-3 px-4 max-w-md mx-auto">
            {navItems.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-label={id}
                onClick={() => onNavChange?.(id)}
                className={`neu-icon-btn ${activeNav === id ? "active" : ""}`}
              >
                <Icon className="w-5 h-5" />
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
