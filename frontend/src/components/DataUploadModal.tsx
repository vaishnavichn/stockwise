import { useState } from "react";
import { X, UploadCloud, FileSpreadsheet, FileText, Plus, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import Papa from "papaparse";
import { SKU_CATALOG } from "../api/types";

interface DataUploadModalProps {
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function DataUploadModal({ onClose, onSuccess }: DataUploadModalProps) {
  const [activeTab, setActiveTab] = useState<"csv" | "excel" | "manual">("csv");
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Manual Form State
  const [manualForm, setManualForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    store_id: "STR001",
    sku_id: "SKU001",
    product_name: "",
    category: "Snacks",
    units_sold: "",
    unit_price: "",
  });

  // Handle CSV Selection & Preview
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setSummary(null);
    setErrorMsg(null);

    if (activeTab === "csv") {
      Papa.parse(selected, {
        header: true,
        preview: 5,
        complete: (results) => {
          setPreviewData(results.data);
        },
      });
    }
  };

  // Upload CSV/Excel
  const handleUploadSubmit = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const endpoint = activeTab === "csv" ? "/api/upload/csv" : `/api/upload/excel${selectedSheet ? `?sheet_name=${selectedSheet}` : ""}`;
      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail?.errors?.join(", ") || data.detail || "Upload failed");
      }

      setSummary(data.summary);
      if (data.summary?.available_sheets) {
        setSheetNames(data.summary.available_sheets);
      }
      onSuccess(data.summary?.inserted_rows || 0);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Submit Manual Entry
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/upload/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: manualForm.date,
          store_id: manualForm.store_id,
          sku_id: manualForm.sku_id,
          product_name: manualForm.product_name || undefined,
          category: manualForm.category,
          units_sold: Number(manualForm.units_sold),
          unit_price: manualForm.unit_price ? Number(manualForm.unit_price) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Manual record creation failed");

      setSummary({ inserted_rows: 1, message: data.message });
      onSuccess(1);
      setManualForm((prev) => ({ ...prev, units_sold: "" }));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="po-modal-overlay">
      <div className="po-modal neu-raised max-w-xl w-full p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-[var(--neu-text)] tracking-tight">
              Ingest & Upload Sales Data
            </h2>
            <p className="text-xs text-[var(--neu-text-muted)]">
              Import CSV/Excel files or record manual sales entries directly into Supabase
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="neu-icon-btn text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex neu-inset p-1.5 rounded-xl gap-2">
          {(["csv", "excel", "manual"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setFile(null);
                setSummary(null);
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === tab
                  ? "neu-raised text-[var(--primary-accent)]"
                  : "text-[var(--neu-text-muted)] hover:text-[var(--neu-text)]"
              }`}
            >
              {tab === "csv" ? "Upload CSV" : tab === "excel" ? "Upload Excel" : "Manual Entry"}
            </button>
          ))}
        </div>

        {/* Tab 1: CSV Upload */}
        {activeTab === "csv" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--neu-text-muted)]">Select CSV File</span>
              <a
                href="/api/upload/template"
                download
                className="text-xs font-bold text-[var(--primary-accent)] hover:underline inline-flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Download Template
              </a>
            </div>

            <div className="neu-inset p-6 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300/50 hover:border-[var(--primary-accent)] transition-colors cursor-pointer text-center relative">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <UploadCloud className="w-8 h-8 text-[var(--primary-accent)] mb-2" />
              <p className="text-xs font-bold text-[var(--neu-text)]">
                {file ? file.name : "Drag & drop CSV file here or click to browse"}
              </p>
              <span className="text-[10px] text-[var(--neu-text-muted)] mt-1">Maximum size: 5MB</span>
            </div>

            {/* Preview Table */}
            {previewData.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[var(--neu-text-muted)]">PREVIEW (FIRST 5 ROWS)</span>
                <div className="neu-inset p-2 rounded-xl overflow-x-auto max-h-36 text-[10px]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-slate-300/40 text-[var(--neu-text-muted)]">
                        {Object.keys(previewData[0] || {}).map((k) => (
                          <th key={k} className="p-1 font-bold">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, i) => (
                        <tr key={i} className="border-b border-slate-200/30">
                          {Object.values(row).map((v: any, j) => (
                            <td key={j} className="p-1 truncate max-w-[100px]">{String(v)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!file || loading}
              onClick={handleUploadSubmit}
              className="w-full neu-raised-sm py-3 text-xs font-extrabold text-white gradient-purple neu-hover-lift disabled:opacity-50"
            >
              {loading ? "Processing Sales Data..." : "Confirm & Ingest CSV"}
            </button>
          </div>
        )}

        {/* Tab 2: Excel Upload */}
        {activeTab === "excel" && (
          <div className="space-y-4">
            <div className="neu-inset p-6 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-300/50 hover:border-[var(--primary-accent)] transition-colors cursor-pointer text-center relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileSpreadsheet className="w-8 h-8 text-[var(--primary-accent)] mb-2" />
              <p className="text-xs font-bold text-[var(--neu-text)]">
                {file ? file.name : "Drag & drop .xlsx Excel file here"}
              </p>
              <span className="text-[10px] text-[var(--neu-text-muted)] mt-1">Accepts multiple worksheets</span>
            </div>

            {sheetNames.length > 1 && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--neu-text)]">Select Sheet WorkSheet</label>
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="w-full neu-inset px-3 py-2 text-xs font-semibold"
                >
                  {sheetNames.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              disabled={!file || loading}
              onClick={handleUploadSubmit}
              className="w-full neu-raised-sm py-3 text-xs font-extrabold text-white gradient-purple neu-hover-lift disabled:opacity-50"
            >
              {loading ? "Parsing Excel Workbook..." : "Confirm & Ingest Excel Sheet"}
            </button>
          </div>
        )}

        {/* Tab 3: Manual Entry Form */}
        {activeTab === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--neu-text)]">Date</label>
                <input
                  type="date"
                  required
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  className="w-full neu-inset px-3 py-2 text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--neu-text)]">Store ID</label>
                <input
                  type="text"
                  required
                  value={manualForm.store_id}
                  onChange={(e) => setManualForm({ ...manualForm, store_id: e.target.value })}
                  className="w-full neu-inset px-3 py-2 text-xs font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--neu-text)]">Select SKU</label>
                <select
                  value={manualForm.sku_id}
                  onChange={(e) => {
                    const sel = SKU_CATALOG.find((s) => s.sku_id === e.target.value);
                    setManualForm({
                      ...manualForm,
                      sku_id: e.target.value,
                      product_name: sel?.product_name || "",
                      category: sel?.category || "General",
                    });
                  }}
                  className="w-full neu-inset px-3 py-2 text-xs font-semibold"
                >
                  {SKU_CATALOG.map((s) => (
                    <option key={s.sku_id} value={s.sku_id}>{s.sku_id} - {s.product_name}</option>
                  ))}
                  <option value="NEW_SKU">+ Add New Custom SKU</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--neu-text)]">Category</label>
                <input
                  type="text"
                  value={manualForm.category}
                  onChange={(e) => setManualForm({ ...manualForm, category: e.target.value })}
                  className="w-full neu-inset px-3 py-2 text-xs font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--neu-text)]">Units Sold</label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 45"
                  value={manualForm.units_sold}
                  onChange={(e) => setManualForm({ ...manualForm, units_sold: e.target.value })}
                  className="w-full neu-inset px-3 py-2 text-xs font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[var(--neu-text)]">Unit Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Optional"
                  value={manualForm.unit_price}
                  onChange={(e) => setManualForm({ ...manualForm, unit_price: e.target.value })}
                  className="w-full neu-inset px-3 py-2 text-xs font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full neu-raised-sm py-3 text-xs font-extrabold text-white gradient-purple neu-hover-lift mt-2"
            >
              {loading ? "Recording Sales Entry..." : "Submit Manual Record"}
            </button>
          </form>
        )}

        {/* Error Feedback */}
        {errorMsg && (
          <div className="neu-inset p-3.5 text-xs text-rose-700 bg-rose-50/50 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Result Summary Card */}
        {summary && (
          <div className="neu-inset p-4 text-xs text-emerald-800 bg-emerald-50/50 rounded-xl space-y-2">
            <div className="flex items-center gap-2 font-bold text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Data Ingestion & Selective Prophet Retrain Complete</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200/60">
              <div>Records Ingested: <strong>{summary.inserted_rows}</strong></div>
              <div>Skipped Rows: <strong>{summary.skipped_rows || 0}</strong></div>
              <div>New SKUs Created: <strong>{summary.new_skus_created || 0}</strong></div>
              <div>New Stores Created: <strong>{summary.new_stores_created || 0}</strong></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
