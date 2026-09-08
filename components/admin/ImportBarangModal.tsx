"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import { adjustStock } from "@/lib/domain/inventory/service";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  X,
} from "lucide-react";
import {
  CATALOG_FIELDS,
  autoMapCatalogColumns,
  validateCatalogMapping,
  validateCatalogRows,
  type FieldKey,
  type CatalogImportRow,
  type CatalogValidationResult,
} from "@/lib/domain/inventory/import";
import { detectFormat, parseStockFile, type SupportedFormat } from "@/lib/domain/inventory/importFile";

type Step = "upload" | "map" | "review" | "applying" | "result";

interface ImportBarangModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

type CatalogFieldMapping = Partial<Record<FieldKey, string>>;

interface ApplyResult {
  status: "success" | "failed" | "partial";
  createdCount: number;
  stockSetCount: number;
  skippedCount: number;
  errors: Array<{ sku: string; message: string }>;
}

export default function ImportBarangModal({ open, onClose, onImported }: ImportBarangModalProps) {
  const supabase = createClient();
  const { branches } = useBranch();
  const warehouse = branches.find((b) => b.is_central === true);
  const warehouseLocationId = warehouse?.id ?? "";

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<SupportedFormat | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string | number>[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [mapping, setMapping] = useState<CatalogFieldMapping>({});
  const [parsing, setParsing] = useState(false);
  const [validation, setValidation] = useState<CatalogValidationResult | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ApplyResult | null>(null);

  const resetAll = () => {
    setStep("upload");
    setFile(null);
    setFormat(null);
    setHeaders([]);
    setRows([]);
    setSheetNames([]);
    setActiveSheet("");
    setMapping({});
    setValidation(null);
    setProgress({ done: 0, total: 0 });
    setResult(null);
  };

  useEffect(() => {
    if (open) resetAll();
  }, [open]);

  const mappingStatus = useMemo<{ ok: boolean; error?: string }>(() => {
    if (headers.length === 0) return { ok: false };
    return validateCatalogMapping({ headers, rows }, mapping);
  }, [headers, rows, mapping]);

  const setColumnForField = (field: FieldKey, column: string) => {
    setMapping((prev) => {
      const next: CatalogFieldMapping = { ...prev };
      for (const [key, col] of Object.entries(next)) {
        if (col === column && key !== field) delete next[key as FieldKey];
      }
      if (column) next[field] = column;
      else delete next[field];
      return next;
    });
  };

  const handleSelectFile = async (selected: File) => {
    const fmt = detectFormat(selected.name, selected.type);
    if (!fmt) {
      toast.error("Format tidak didukung. Gunakan CSV, XLSX, atau XLS.");
      return;
    }
    setParsing(true);
    try {
      const { table, sheetNames: sheets } = await parseStockFile(selected, fmt);
      if (table.headers.length === 0) {
        toast.error("File tidak memiliki header.");
        return;
      }
      setFile(selected);
      setFormat(fmt);
      setHeaders(table.headers);
      setRows(table.rows);
      setSheetNames(sheets);
      setActiveSheet(sheets[0] ?? "");
      setMapping(columnMapToFieldMapping(autoMapCatalogColumns(table.headers)));
      setStep("map");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal membaca file");
    } finally {
      setParsing(false);
    }
  };

  const changeSheet = async (name: string) => {
    if (!file || !format) return;
    try {
      const { table } = await parseStockFile(file, format, name);
      if (table.headers.length === 0) {
        toast.error("Sheet kosong.");
        return;
      }
      setHeaders(table.headers);
      setRows(table.rows);
      setMapping(columnMapToFieldMapping(autoMapCatalogColumns(table.headers)));
      setActiveSheet(name);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal membaca sheet");
    }
  };

  const goReview = () => {
    if (headers.length === 0 || !mappingStatus.ok) return;
    const v = validateCatalogRows({ headers, rows }, mapping);
    setValidation(v);
    setStep("review");
  };

  const confirmApply = async () => {
    if (!validation || validation.valid.length === 0) return;
    if (!warehouseLocationId) {
      toast.error("Lokasi gudang tidak ditemukan");
      return;
    }
    setStep("applying");
    setProgress({ done: 0, total: validation.valid.length });

    const created: string[] = [];
    const errors: ApplyResult["errors"] = [];
    let stockSetCount = 0;

    for (let i = 0; i < validation.valid.length; i++) {
      const row = validation.valid[i];
      try {
        const { data: existing } = await supabase
          .from("stock_items")
          .select("id")
          .eq("sku", row.sku)
          .maybeSingle();

        let itemId: string;
        if (existing) {
          itemId = existing.id;
        } else {
          itemId = crypto.randomUUID();
          const { error: insertErr } = await supabase.from("stock_items").insert({
            id: itemId,
            name: row.name,
            sku: row.sku,
            item_class: row.item_class,
            unit: row.unit,
            category: row.category,
            default_minimum_stock: row.default_minimum_stock,
            sell_price: row.sell_price,
            buy_price: row.buy_price,
          });
          if (insertErr) throw insertErr;
          created.push(row.sku);
        }

        if (row.stock > 0) {
          await adjustStock(supabase, {
            stockItemId: itemId,
            locationId: warehouseLocationId,
            delta: row.stock,
            source: "import",
            reason: "Import barang",
            refType: "catalog_import",
            refId: itemId,
          });
          stockSetCount++;
        }
      } catch (err: unknown) {
        errors.push({
          sku: row.sku,
          message: err instanceof Error ? err.message : "Gagal memproses",
        });
      }
      setProgress({ done: i + 1, total: validation.valid.length });
    }

    setResult({
      status: errors.length === 0 ? "success" : created.length > 0 ? "partial" : "failed",
      createdCount: created.length,
      stockSetCount,
      skippedCount: validation.valid.length - created.length - stockSetCount,
      errors,
    });
    setStep("result");
  };

  const finish = () => {
    onClose();
    onImported?.();
  };

  if (!open) return null;

  const shell = (body: React.ReactNode, footer?: React.ReactNode) => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4" onClick={step === "applying" ? undefined : onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Import Barang</h3>
            <p className="text-xs text-gray-500">
              {step === "upload" && "Upload file CSV/XLSX/XLS"}
              {step === "map" && "Pemetaan kolom file ke field katalog"}
              {step === "review" && "Pratinjau data sebelum import"}
              {step === "applying" && "Memproses import..."}
              {step === "result" && "Hasil import"}
            </p>
          </div>
          <button onClick={onClose} disabled={step === "applying"}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg disabled:opacity-40">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">{body}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex gap-3 items-center">{footer}</div>
        )}
      </motion.div>
    </div>
  );

  if (!warehouseLocationId) {
    return shell(
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700 dark:text-amber-300">
          Lokasi gudang pusat tidak ditemukan. Pastikan ada branch dengan is_central = true.
        </div>
      </div>,
      <button onClick={onClose} className="ml-auto px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl text-sm">Tutup</button>,
    );
  }

  if (step === "upload") {
    return shell(
      <>
        <label className="block border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 transition-all">
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-blue-500" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Klik untuk pilih file</p>
          <p className="text-xs text-gray-400 mt-1">Format: CSV · XLSX · XLS</p>
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" disabled={parsing}
            onChange={(e) => { if (e.target.files?.[0]) void handleSelectFile(e.target.files[0]); e.target.value = ""; }} />
        </label>
        {parsing && (
          <p className="text-xs text-blue-600 flex items-center gap-2 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Membaca file...
          </p>
        )}
        <p className="text-xs text-gray-400 text-center">
          Kolom yang tidak dipetakan akan diabaikan.
        </p>
      </>,
    );
  }

  if (step === "map" && headers.length > 0) {
    const multiSheet = sheetNames.length > 1 && format !== "csv";
    return shell(
      <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-gray-200 dark:border-white/10 p-3">
          <div className="col-span-2 sm:col-span-1 min-w-0">
            <p className="text-[10px] uppercase text-gray-400">File</p>
            <p className="text-xs font-semibold truncate" title={file?.name}>{file?.name}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-400">Format</p>
            <span className="inline-block mt-0.5 text-[10px] font-bold uppercase bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full">{format}</span>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-400">Baris</p>
            <p className="text-xs font-semibold">{rows.length}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-400">Kolom</p>
            <p className="text-xs font-semibold">{headers.length}</p>
          </div>
        </div>

        {multiSheet && (
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Sheet</label>
            <select value={activeSheet} onChange={(e) => void changeSheet(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500">
              {sheetNames.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 dark:bg-[#2c2c2c] grid grid-cols-[minmax(0,8rem)_1fr] gap-2 text-[10px] uppercase text-gray-400 font-bold">
            <span>Field Katalog</span>
            <span>Kolom File</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {CATALOG_FIELDS.map((f) => (
              <div key={f.key} className="px-3 py-2 grid grid-cols-[minmax(0,8rem)_1fr] gap-2 items-center">
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {f.label}{f.required && <span className="text-red-500"> *</span>}
                </label>
                <select value={mapping[f.key] ?? ""} disabled={f.key === "supplier"}
                  onChange={(e) => setColumnForField(f.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-white/5 disabled:text-gray-400">
                  <option value="">Tidak dipilih</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-400 -mt-2">
          Pemetaan otomatis hanyalah saran — silakan ubah. Kolom yang tidak dipetakan diabaikan.
        </p>

        {!mappingStatus.ok && mappingStatus.error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-3 text-sm text-red-600 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {mappingStatus.error}
          </div>
        )}
      </>,
      <>
        <button onClick={() => setStep("upload")}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl text-sm">
          <ArrowLeft className="w-4 h-4" /> Ganti File
        </button>
        <button onClick={goReview} disabled={!mappingStatus.ok}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
          <CheckCircle2 className="w-4 h-4" /> Validasi &amp; Pratinjau
        </button>
      </>,
    );
  }

  if (step === "review" && validation) {
    const shownErrors = validation.errors.slice(0, 10);
    return shell(
      <>
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">Ringkasan</h4>
          <div className="grid grid-cols-3 gap-2">
            {[{ label: "Valid", value: validation.valid.length }, { label: "Invalid", value: validation.errors.length }, { label: "Kosong", value: validation.skippedEmpty }].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 dark:border-white/10 p-3 text-center">
                <p className="text-[10px] uppercase text-gray-400">{s.label}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {validation.errors.length > 0 && (
          <div className="rounded-xl border border-red-200 dark:border-red-500/30 overflow-hidden">
            <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 text-xs font-bold text-red-600 dark:text-red-300">
              Baris Bermasalah ({validation.errors.length})
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#2c2c2c]">
                <tr className="text-left text-[10px] uppercase text-gray-400">
                  <th className="px-3 py-1.5">Baris</th>
                  <th className="px-3 py-1.5">SKU</th>
                  <th className="px-3 py-1.5">Masalah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {shownErrors.map((err, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 text-gray-400">{err.rowNumber}</td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-gray-300">{err.sku}</td>
                    <td className="px-3 py-1.5 text-red-600 dark:text-red-300">{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validation.errors.length > 10 && (
              <p className="px-3 py-1.5 text-[11px] text-gray-400">... dan {validation.errors.length - 10} lainnya</p>
            )}
          </div>
        )}

        {validation.valid.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">Preview Data ({validation.valid.length} barang)</h4>
            <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden max-h-48">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#2c2c2c]">
                  <tr className="text-left text-[10px] uppercase text-gray-400">
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Nama</th>
                    <th className="px-3 py-2 text-right">Stok</th>
                    <th className="px-3 py-2 text-right">Harga Jual</th>
                    <th className="px-3 py-2">Kategori</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {validation.valid.slice(0, 20).map((r, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5 font-mono text-gray-900 dark:text-gray-100">{r.sku}</td>
                      <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{r.name}</td>
                      <td className="px-3 py-1.5 text-right">{r.stock}</td>
                      <td className="px-3 py-1.5 text-right">{r.sell_price > 0 ? `Rp ${r.sell_price.toLocaleString("id-ID")}` : "-"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{r.category || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {validation.valid.length > 20 && (
              <p className="text-[11px] text-gray-400 mt-1">... dan {validation.valid.length - 20} lainnya</p>
            )}
          </div>
        )}

        <p className="text-[11px] text-gray-400">
          Item baru akan dibuat di katalog. Stok gudang diatur via RPC terpusat (tercatat di riwayat).
          SKU yang sudah ada akan di-skip dari pembuatan katalog, namun stok tetap diatur.
        </p>
      </>,
      <>
        <button onClick={() => setStep("map")}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl text-sm">
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <button onClick={confirmApply} disabled={validation.valid.length === 0}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
          <CheckCircle2 className="w-4 h-4" /> Konfirmasi Import ({validation.valid.length} barang)
        </button>
      </>,
    );
  }

  if (step === "applying") {
    const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
    return shell(
      <div className="py-6 space-y-4">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          Memproses... {progress.done}/{progress.total}
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
          <div className="h-full bg-emerald-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-center text-gray-400">Jangan tutup halaman ini.</p>
      </div>,
    );
  }

  if (step === "result" && result) {
    const ok = result.status === "success";
    return shell(
      <>
        <div className={`flex items-start gap-3 rounded-xl border p-4 ${
          ok ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
              : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
        }`}>
          {ok ? <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />}
          <div>
            <p className={`font-bold ${ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
              {ok ? "Import selesai!" : "Import selesai dengan error"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ label: "Baru dibuat", value: result.createdCount }, { label: "Stok diatur", value: result.stockSetCount }, { label: "Error", value: result.errors.length }].map((s) => (
            <div key={s.label} className="rounded-xl border border-gray-200 dark:border-white/10 p-3 text-center">
              <p className="text-[10px] uppercase text-gray-400">{s.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{s.value}</p>
            </div>
          ))}
        </div>
        {result.errors.length > 0 && (
          <div className="rounded-xl border border-red-200 dark:border-red-500/30 p-3 text-xs text-red-600 dark:text-red-300 space-y-1">
            {result.errors.slice(0, 5).map((e, i) => <p key={i}><b>{e.sku}:</b> {e.message}</p>)}
            {result.errors.length > 5 && <p>... dan {result.errors.length - 5} lainnya</p>}
          </div>
        )}
      </>,
      <button onClick={finish}
        className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white dark:text-gray-900 text-white font-semibold rounded-xl text-sm">
        <CheckCircle2 className="w-4 h-4" /> Selesai
      </button>,
    );
  }

  return null;
}

function columnMapToFieldMapping(colMap: Record<string, FieldKey | "ignore">): CatalogFieldMapping {
  const out: CatalogFieldMapping = {};
  for (const [col, field] of Object.entries(colMap)) {
    if (field !== "ignore" && !out[field]) out[field] = col;
  }
  return out;
}
