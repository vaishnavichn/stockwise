import { X, Download, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import type { PoDraft } from "../api/types";

interface PoModalProps {
  po: PoDraft;
  onClose: () => void;
}

export default function PoModal({ po, onClose }: PoModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = [
      `Purchase Order: ${po.po_number}`,
      `Date: ${po.created_at}`,
      `Supplier: ${po.supplier}`,
      ``,
      `SKU: ${po.sku_id} — ${po.product_name}`,
      `Category: ${po.category}`,
      `Order Quantity: ${po.order_quantity} units`,
      `Unit Price: ₹${po.unit_price}`,
      `Total Cost: ₹${po.total_cost.toLocaleString("en-IN")}`,
      ``,
      `Current Stock: ${po.stock_on_hand} units`,
      `Reorder Point: ${po.reorder_point}`,
      `Avg Daily Demand: ${po.avg_daily_demand}`,
      ``,
      `Justification: ${po.justification}`,
    ].join("\n");

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = () => {
    // Use browser print-to-PDF as a simple fallback
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${po.po_number}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #333; }
            h1 { color: #5b4cdb; margin-bottom: 4px; }
            .meta { color: #6b7280; font-size: 14px; margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; }
            th { background: #f3f4f6; font-weight: 600; font-size: 13px; text-transform: uppercase; color: #6b7280; }
            td { font-size: 14px; }
            .total-row td { font-weight: 700; border-top: 2px solid #5b4cdb; }
            .justification { background: #f9fafb; border-left: 3px solid #5b4cdb; padding: 14px 18px; margin-top: 20px; border-radius: 6px; font-size: 14px; }
            .footer { margin-top: 40px; color: #9ca3af; font-size: 12px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>${po.po_number}</h1>
          <p class="meta">Generated: ${po.created_at} · Supplier: ${po.supplier}</p>
          
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>SKU</td><td>${po.sku_id} — ${po.product_name}</td></tr>
              <tr><td>Category</td><td>${po.category}</td></tr>
              <tr><td>Order Quantity</td><td>${po.order_quantity} units</td></tr>
              <tr><td>Unit Price</td><td>₹${po.unit_price}</td></tr>
              <tr class="total-row"><td>Total Cost</td><td>₹${po.total_cost.toLocaleString("en-IN")}</td></tr>
              <tr><td>Current Stock</td><td>${po.stock_on_hand} units</td></tr>
              <tr><td>Reorder Point</td><td>${po.reorder_point}</td></tr>
              <tr><td>Avg Daily Demand</td><td>${po.avg_daily_demand} units/day</td></tr>
            </tbody>
          </table>

          <div class="justification">
            <strong>AI Justification:</strong> ${po.justification}
          </div>

          <p class="footer">Smart Inventory Copilot · Auto-generated Purchase Order</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="po-modal-overlay" onClick={onClose}>
      <div
        className="po-modal neu-raised"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-[var(--neu-text)]">
              {po.po_number}
            </h3>
            <p className="text-xs text-[var(--neu-text-muted)]">
              {po.created_at} · {po.supplier}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-icon-btn !w-8 !h-8"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Details */}
        <div className="neu-inset-sm p-4 space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--neu-text-muted)]">Product</span>
            <span className="font-medium text-[var(--neu-text)]">
              {po.product_name} ({po.sku_id})
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--neu-text-muted)]">Category</span>
            <span className="text-[var(--neu-text)]">{po.category}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--neu-text-muted)]">Order Qty</span>
            <span className="font-bold text-[var(--neu-text)]">
              {po.order_quantity} units
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--neu-text-muted)]">Unit Price</span>
            <span className="text-[var(--neu-text)]">₹{po.unit_price}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-[#d1d9e6]/60">
            <span className="font-semibold text-[var(--neu-text)]">
              Total Cost
            </span>
            <span className="font-bold text-[#5b4cdb]">
              ₹{po.total_cost.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Stock info */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="neu-inset-sm p-3 text-center">
            <p className="text-lg font-bold text-[var(--neu-text)]">
              {po.stock_on_hand}
            </p>
            <p className="text-[10px] text-[var(--neu-text-muted)]">On Hand</p>
          </div>
          <div className="neu-inset-sm p-3 text-center">
            <p className="text-lg font-bold text-[var(--neu-text)]">
              {po.reorder_point}
            </p>
            <p className="text-[10px] text-[var(--neu-text-muted)]">
              Reorder Pt
            </p>
          </div>
          <div className="neu-inset-sm p-3 text-center">
            <p className="text-lg font-bold text-[var(--neu-text)]">
              {po.avg_daily_demand}
            </p>
            <p className="text-[10px] text-[var(--neu-text-muted)]">
              Daily Demand
            </p>
          </div>
        </div>

        {/* Justification */}
        <div className="neu-inset-sm p-4 mb-5">
          <p className="text-xs font-semibold text-[var(--neu-text-muted)] uppercase tracking-wider mb-1">
            AI Justification
          </p>
          <p className="text-sm text-[var(--neu-text)] leading-relaxed">
            {po.justification}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex-1 neu-raised-sm py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-semibold text-white gradient-purple rounded-2xl neu-hover-lift"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 neu-raised-sm py-2.5 px-4 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--neu-text)] rounded-2xl neu-hover-lift"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
