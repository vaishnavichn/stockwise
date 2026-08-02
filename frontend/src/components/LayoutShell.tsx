import { useState } from "react";
import {
  BarChart3,
  Bell,
  Calendar,
  ChevronRight,
  Home,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  UploadCloud,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import DataUploadModal from "./DataUploadModal";

type NavItem = "home" | "inventory" | "analytics" | "settings";

interface LayoutShellProps {
  children: ReactNode;
  activeNav?: NavItem;
  onNavChange?: (item: NavItem) => void;
  timeRange?: "30" | "60" | "90";
  onTimeRangeChange?: (range: "30" | "60" | "90") => void;
  banner?: string;
  onUploadSuccess?: () => void;
}

const navItems: { id: NavItem; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Dashboard", icon: Home },
  { id: "inventory", label: "Inventory", icon: Package },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function LayoutShell({
  children,
  activeNav = "home",
  onNavChange,
  timeRange = "30",
  onTimeRangeChange,
  banner,
  onUploadSuccess,
}: LayoutShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleUploadDone = (count: number) => {
    setToastMessage(`Data Ingested Successfully! ${count} records processed.`);
    onUploadSuccess?.();
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="min-h-dvh bg-[var(--neu-bg)] flex flex-col lg:flex-row font-sans text-[var(--neu-text)] relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[3000] neu-raised p-4 max-w-sm border-l-4 border-[var(--primary-accent)] animate-fade-in-up flex items-center justify-between gap-3 text-xs font-bold text-[var(--neu-text)]">
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="text-[var(--neu-text-muted)]">✕</button>
        </div>
      )}

      {/* ── Structured Neumorphic Sidebar ──────────────── */}
      <aside
        className={`hidden lg:flex flex-col justify-between py-6 px-4 shrink-0 neu-transition ${
          collapsed ? "w-20" : "w-60"
        }`}
      >
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3">
              <div className="neu-raised-sm w-10 h-10 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-[var(--primary-accent)]" />
              </div>
              {!collapsed && (
                <div>
                  <h2 className="font-extrabold text-sm tracking-tight text-[var(--neu-text)] leading-tight">
                    StockWise
                  </h2>
                  <span className="text-[10px] font-semibold text-[var(--neu-text-muted)] tracking-wider uppercase">
                    Copilot v0.6
                  </span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="neu-raised-sm w-7 h-7 flex items-center justify-center text-[var(--neu-text-muted)] hover:text-[var(--neu-text)] transition-transform"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform duration-300 ${
                  collapsed ? "" : "rotate-180"
                }`}
              />
            </button>
          </div>

          <div className="w-full h-px bg-slate-300/40" />

          {/* Grouped Navigation */}
          <div className="space-y-2">
            {!collapsed && (
              <span className="text-[10px] font-bold tracking-widest text-[var(--neu-text-muted)] uppercase px-2">
                MENU
              </span>
            )}
            <nav className="flex flex-col gap-3">
              {navItems.map(({ id, label, icon: Icon }) => {
                const isActive = activeNav === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onNavChange?.(id)}
                    className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${
                      isActive
                        ? "neu-inset text-[var(--primary-accent)]"
                        : "neu-raised text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isActive ? "bg-indigo-50 text-[var(--primary-accent)]" : ""
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    {!collapsed && <span>{label}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Bottom Section: System Status & User Profile */}
        <div className="space-y-4 pt-4 border-t border-slate-300/40">
          {!collapsed && (
            <div className="neu-inset-sm p-3 flex items-center gap-2.5 text-xs text-[var(--neu-text-muted)]">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="text-[11px] font-medium leading-tight">
                Prophet Engine Online
              </span>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="neu-raised-sm w-10 h-10 flex items-center justify-center shrink-0 text-[var(--neu-text)]"
              aria-label="User Profile"
            >
              <User className="w-5 h-5" />
            </button>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[var(--neu-text)] truncate">
                  Store Ops Lead
                </p>
                <p className="text-[10px] text-[var(--neu-text-muted)] truncate">
                  preet@stockwise.ai
                </p>
              </div>
            )}
            {!collapsed && (
              <button
                type="button"
                className="text-[var(--neu-text-muted)] hover:text-rose-600 p-1"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Structured Top Header Bar ────────────────── */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between px-6 sm:px-10 py-6 gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[var(--neu-text)]">
              Smart Inventory Copilot
            </h1>
            <p className="text-xs text-[var(--neu-text-muted)] mt-0.5 font-medium">
              Real-time Prophet Demand Forecasting & Autonomous PO Generation
            </p>
          </div>

          {/* Right Header Toolbar Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Demo Data Banner Pill */}
            {banner && (
              <div className="neu-inset-sm px-3.5 py-1.5 text-[11px] font-semibold text-[var(--primary-accent)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>{banner}</span>
              </div>
            )}

            {/* Upload Data Button Pill */}
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="neu-raised-sm px-3.5 py-2 text-xs font-extrabold text-[var(--primary-accent)] flex items-center gap-2 neu-hover-lift"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Data</span>
            </button>

            {/* Interactive Date Range Selector Pill */}
            <div className="neu-raised-sm px-3 py-1.5 text-xs font-bold text-[var(--neu-text)] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--primary-accent)]" />
              <select
                value={timeRange}
                onChange={(e) => onTimeRangeChange?.(e.target.value as "30" | "60" | "90")}
                className="bg-transparent border-none outline-none font-bold text-xs cursor-pointer text-[var(--neu-text)]"
              >
                <option value="30">Next 30 Days</option>
                <option value="60">Next 60 Days</option>
                <option value="90">Next 90 Days</option>
              </select>
            </div>

            {/* Notification Bell Icon */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="neu-raised-sm w-10 h-10 flex items-center justify-center relative text-[var(--neu-text-muted)] hover:text-[var(--neu-text)] neu-hover-lift"
                aria-label="Notifications"
              >
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-rose-500" />
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-72 neu-raised p-4 z-50 animate-fade-in-up space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-300/40">
                    <span className="text-xs font-bold text-[var(--neu-text)]">System Alerts</span>
                    <span className="text-[10px] text-[var(--primary-accent)] font-semibold">2 New</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="neu-inset-sm p-2 rounded-lg">
                      <p className="font-bold text-[11px]">Prophet Models Retrained</p>
                      <p className="text-[10px] text-[var(--neu-text-muted)]">15 models optimized with log transform.</p>
                    </div>
                    <div className="neu-inset-sm p-2 rounded-lg">
                      <p className="font-bold text-[11px]">SKU001 Safety Level Alert</p>
                      <p className="text-[10px] text-[var(--neu-text-muted)]">Reorder draft generated for Masala Chips.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 px-6 sm:px-10 pb-28 lg:pb-10">{children}</main>

        {/* Mobile Navigation */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 px-6 pb-6 pt-2 z-50">
          <div className="glass-panel neu-raised flex items-center justify-around py-3 px-4 max-w-md mx-auto rounded-2xl">
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

      {/* Upload Modal */}
      {showUploadModal && (
        <DataUploadModal
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadDone}
        />
      )}
    </div>
  );
}
