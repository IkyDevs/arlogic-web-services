"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Minus,
  TrendingDown,
  TrendingUp,
  Upload,
  X,
} from "lucide-react";
import {
  SYSTEM_FIELDS,
  autoMapColumns,
  buildMappedRows,
  calculateImpact,
  columnMapToFieldMapping,
  normalizeSkuKey,
  validateFieldMapping,
  type FieldKey,
  type FieldMapping,
  type ImpactSummary,
  type ParsedTable,
  type ValidationResult,
} from "@/lib/domain/inventory/import";
import {
  detectFormat,
  parseStockFile,
  type SupportedFormat,
} from "@/lib/domain/inventory/importFile";
import {
  applyStoreStockImport,
  type StoreStockImportLine,
  type StoreStockImportResult,
} from "@/lib/domain/inventory/service";

type Step = "upload" | "map" | "review" | "applying" | "result";

interface CurrentStockEntry {
  id: string;
  itemName: string;
  quantity: number;
}

interface StockImportModalProps {
  open: boolean;
  onClose: () => void;
  /** Dipanggil saat modal ditutup dari step hasil — refresh/revalidate Stock Toko */
  onImported?: () => void;
  /** Cabang aktif Admin Toko — import SELALU terkunci ke cabang ini */
  branchId: string;
}

const STEP_LABELS: Record<Step, string> = {
  upload: "Upload File",
  map: "Column Mapping",
  review: "Pratinjau & Konfirmasi",
  applying: "Menerapkan Perubahan",
  result: "Hasil Import",
};

const MAX_ERROR_ROWS_SHOWN = 5;
const MAX_IMPACT_ROWS_SHOWN = 50;
const MAX_NOTFOUND_SHOWN = 8;
const SKU_FETCH_CHUNK = 100;
/** Guard D: >=80% SKU valid tak cocok →peringatan "isi katalog via Import Barang" */
const NOTFOUND_RATIO_GUARD = 0.8;

export default function StockImportModal({
  open,
  onClose,
  onImported,
  branchId,
}: StockImportModalProps) {
  const supabase = createClient();
  const { branches } = useBranch();

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<SupportedFormat | null>(null);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState("");
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [parsing, setParsing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [currentStock, setCurrentStock] = useState<
    Map<string, CurrentStockEntry> | null
  >(null);
  const [catalogDuplicates, setCatalogDuplicates] = useState<string[]>([]);
  const [impact, setImpact] = useState<ImpactSummary | null>(null);
  const [progress, setProgress] = useState({ applied: 0, total: 0 });
  const [result, setResult] = useState<StoreStockImportResult | null>(null);

  const branchName =
    branches.find((b) => b.id === branchId)?.name ?? "Cabang aktif";

  const resetAll = () => {
    setStep("upload");
    setFile(null);
    setFormat(null);
    setTable(null);
    setSheetNames([]);
    setActiveSheet("");
    setMapping({});
    setValidation(null);
    setCurrentStock(null);
    setCatalogDuplicates([]);
    setImpact(null);
    setProgress({ applied: 0, total: 0 });
    setResult(null);
  };

  useEffect(() => {
    if (open) resetAll();
  }, [open]);

  const mappingStatus = useMemo<{ ok: boolean; error?: string }>(() => {
    if (!table) return { ok: false };
    return validateFieldMapping(table, mapping);
  }, [table, mapping]);

  const mappedFields = useMemo(
    () =>
      SYSTEM_FIELDS.filter((f) => f.storable && mapping[f.key]).map((f) => ({
        label: f.label,
        column: mapping[f.key] as string,
      })),
    [mapping],
  );

  const ignoredColumns = useMemo(() => {
    if (!table) return [] as string[];
    const used = new Set(Object.values(mapping).filter(Boolean) as string[]);
    return table.headers.filter((h) => !used.has(h));
  }, [table, mapping]);

  /** Baris delta≠0 siap apply (inventoryId sudah resolved dari stok current) */
  const applyLines = useMemo<StoreStockImportLine[]>(() => {
    if (!impact || !currentStock) return [];
    const out: StoreStockImportLine[] = [];
    for (const line of impact.lines) {
      if (line.delta === 0) continue;
      const entry = currentStock.get(normalizeSkuKey(line.sku));
      if (entry) out.push({ inventoryId: entry.id, sku: line.sku, delta: line.delta });
    }
    return out;
  }, [impact, currentStock]);

  const handleSelectFile = async (selected: File) => {
    const fmt = detectFormat(selected.name, selected.type);
    if (!fmt) {
      toast.error("Format tidak didukung. Gunakan file CSV, XLSX, atau XLS.");
      return;
    }
    setParsing(true);
    try {
      const { table: parsed, sheetNames: sheets } = await parseStockFile(
        selected,
        fmt,
      );
      if (parsed.headers.length === 0) {
        toast.error("File tidak memiliki baris header yang terbaca.");
        return;
      }
      setFile(selected);
      setFormat(fmt);
      setTable(parsed);
      setSheetNames(sheets);
      setActiveSheet(sheets[0] ?? "");
      setMapping(columnMapToFieldMapping(autoMapColumns(parsed.headers)));
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
      const { table: parsed } = await parseStockFile(file, format, name);
      if (parsed.headers.length === 0) {
        toast.error("Sheet tersebut kosong / tanpa header.");
        return;
      }
      setTable(parsed);
      setMapping(columnMapToFieldMapping(autoMapColumns(parsed.headers)));
      setActiveSheet(name);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal membaca sheet");
    }
  };

  const setColumnForField = (field: FieldKey, column: string) => {
    setMapping((prev) => {
      const next: FieldMapping = { ...prev };
      // Satu kolom file hanya boleh untuk satu system field:
      // pilih kolom milik field lain → kolom dilepas dari field lama.
      for (const [key, col] of Object.entries(next)) {
        if (col === column && key !== field) delete next[key as FieldKey];
      }
      if (column) next[field] = column;
      else delete next[field];
      return next;
    });
  };

  const fetchCurrentStock = async (
    skus: string[],
  ): Promise<{
    map: Map<string, CurrentStockEntry>;
    duplicates: string[];
  }> => {
    const map = new Map<string, CurrentStockEntry>();
    const duplicates: string[] = [];
    for (let i = 0; i < skus.length; i += SKU_FETCH_CHUNK) {
      const chunk = skus
        .slice(i, i + SKU_FETCH_CHUNK)
        .map((s) => s.trim())
        .filter(Boolean);
      if (chunk.length === 0) continue;
      const { data, error } = await supabase
        .from("inventory")
        .select("id, item_name, sku, stock_toko(branch_id, quantity)")
        .in("sku", chunk);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) {
        const skuRaw = typeof row.sku === "string" ? row.sku : "";
        if (!skuRaw) continue;
        const key = normalizeSkuKey(skuRaw);
        const quantity = ((row.stock_toko ?? []) as Array<{
          branch_id: string;
          quantity: number | null;
        }>)
          .filter((s) => s.branch_id === branchId)
          .reduce((sum, s) => sum + (s.quantity ?? 0), 0);
        if (map.has(key)) {
          if (!duplicates.includes(key)) duplicates.push(key);
          continue;
        }
        map.set(key, {
          id: String(row.id),
          itemName: String(row.item_name ?? ""),
          quantity,
        });
      }
    }
    return { map, duplicates };
  };

  const goReview = async () => {
    if (!table || !mappingStatus.ok) return;
    setPreparing(true);
    try {
      const rows = buildMappedRows(table, mapping);
      const skus = [...new Set(rows.valid.map((r) => r.sku))];
      const stock = await fetchCurrentStock(skus);
      const qtyMap = new Map<string, number>(
        [...stock.map.entries()].map(([k, e]) => [k, e.quantity]),
      );
      setValidation(rows);
      setCurrentStock(stock.map);
      setCatalogDuplicates(stock.duplicates);
      setImpact(calculateImpact(rows.valid, qtyMap));
      setStep("review");
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : "Gagal memuat stok cabang saat ini",
      );
    } finally {
      setPreparing(false);
    }
  };

  const confirmApply = async () => {
    setProgress({ applied: 0, total: applyLines.length });
    setStep("applying");
    try {
      const res = await applyStoreStockImport(supabase, applyLines, {
        branchId,
        source: "adjustment",
        reason: "Import stok toko",
        onProgress: (applied, total) => setProgress({ applied, total }),
      });
      setResult(res);
    } catch (e: unknown) {
      setResult({
        status: "failed",
        appliedCount: 0,
        compensatedCount: 0,
        compensationFailed: [],
        failure: {
          sku: "-",
          message:
            e instanceof Error ? e.message : "Kesalahan tak terduga saat import",
        },
      });
    } finally {
      setStep("result");
    }
  };

  const finish = () => {
    onClose();
    onImported?.();
  };

  if (!open) return null;

  const shell = (body: React.ReactNode, footer?: React.ReactNode) => (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4"
      onClick={step === "applying" ? undefined : onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Import Stok Toko
            </h3>
            <p className="text-xs text-gray-500">
              {STEP_LABELS[step]} · Cabang:{" "}
              <span className="font-semibold">{branchName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={step === "applying"}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg disabled:opacity-40"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">{body}</div>

        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex gap-3 items-center">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  );

  // ── Guard: tanpa cabang aktif tidak ada import sama sekali ──
  if (!branchId) {
    return shell(
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-4">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-700 dark:text-amber-300">
          Cabang aktif tidak ditemukan. Pilih cabang terlebih dahulu sebelum
          melakukan import stok toko.
        </div>
      </div>,
      <button
        onClick={onClose}
        className="ml-auto px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl text-sm"
      >
        Tutup
      </button>,
    );
  }

  // ─────────────────────────── UPLOAD ───────────────────────────
  if (step === "upload") {
    return shell(
      <>
        <label className="block border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 transition-all">
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-blue-500" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Klik untuk pilih file stok
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Format: CSV · XLSX · XLS — butuh kolom SKU &amp; Quantity
          </p>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            disabled={parsing}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) void handleSelectFile(selected);
              e.target.value = "";
            }}
          />
        </label>
        {parsing && (
          <p className="text-xs text-blue-600 flex items-center gap-2 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Membaca file...
          </p>
        )}
        <p className="text-xs text-gray-400 text-center">
          Tidak ada perubahan database sebelum Anda konfirmasi di langkah
          pratinjau.
        </p>
      </>,
    );
  }

  // ─────────────────────────── MAPPING ──────────────────────────
  if (step === "map" && table) {
    const multiSheet = sheetNames.length > 1 && format !== "csv";
    return shell(
      <>
        {/* File Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border border-gray-200 dark:border-white/10 p-3">
          <div className="col-span-2 sm:col-span-1 min-w-0">
            <p className="text-[10px] uppercase text-gray-400">File</p>
            <p className="text-xs font-semibold truncate" title={file?.name}>
              {file?.name}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-400">Format</p>
            <span className="inline-block mt-0.5 text-[10px] font-bold uppercase bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
              {format}
            </span>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-400">Total Baris</p>
            <p className="text-xs font-semibold">{table.rows.length}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-gray-400">Total Kolom</p>
            <p className="text-xs font-semibold">{table.headers.length}</p>
          </div>
        </div>

        {multiSheet && (
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
              Sheet
            </label>
            <select
              value={activeSheet}
              onChange={(e) => void changeSheet(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500"
            >
              {sheetNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Column Mapping: System Field ← Kolom File */}
        <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 dark:bg-[#2c2c2c] grid grid-cols-[minmax(0,8rem)_1fr] gap-2 text-[10px] uppercase text-gray-400 font-bold">
            <span>Field Sistem</span>
            <span>Kolom File</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-white/5">
            {SYSTEM_FIELDS.map((f) => (
              <div
                key={f.key}
                className="px-3 py-2 grid grid-cols-[minmax(0,8rem)_1fr] gap-2 items-center"
              >
                <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </label>
                <select
                  value={mapping[f.key] ?? ""}
                  disabled={f.key === "supplier"}
                  onChange={(e) => setColumnForField(f.key, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-white/5 disabled:text-gray-400"
                >
                  <option value="">Tidak dipilih</option>
                  {table.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-gray-400 -mt-2">
          Pemetaan otomatis hanyalah saran — silakan ubah. Kolom yang tidak
          dipetakan diabaikan dan tidak masuk database. Harga &amp; Supplier
          belum disimpan pada tahap ini (Supplier selalu diabaikan).
        </p>

        {!mappingStatus.ok && mappingStatus.error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 p-3 text-sm text-red-600 dark:text-red-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {mappingStatus.error}
          </div>
        )}
      </>,
      <>
        <button
          onClick={() => setStep("upload")}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Ganti File
        </button>
        <button
          onClick={() => void goReview()}
          disabled={!mappingStatus.ok || preparing}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
        >
          {preparing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Validasi &amp; Pratinjau
        </button>
      </>,
    );
  }

  // ─────────────────────── REVIEW (summary + impact) ───────────────────────
  if (step === "review" && table && validation && impact) {
    const templateRows = validation.errors.filter((e) => e.isTemplateRow);
    const invalidRows = validation.errors.filter((e) => !e.isTemplateRow);
    const shownErrors = validation.errors.slice(0, MAX_ERROR_ROWS_SHOWN);
    const shownImpact = impact.lines.slice(0, MAX_IMPACT_ROWS_SHOWN);
    const notFoundRatio =
      validation.valid.length > 0
        ? impact.notFound.length / validation.valid.length
        : 0;
    const catalogEmpty =
      currentStock !== null && currentStock.size === 0 && validation.valid.length > 0;
    return shell(
      <>
        {/* Guard: katalog kosong / hampir semua SKU tak cocok */}
        {(catalogEmpty || notFoundRatio >= NOTFOUND_RATIO_GUARD) && (
          <div
            className={`flex items-start gap-3 rounded-xl border p-4 ${
              catalogEmpty
                ? "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
                : "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30"
            }`}
          >
            <AlertTriangle
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                catalogEmpty ? "text-red-500" : "text-amber-500"
              }`}
            />
            <div className="text-sm space-y-1">
              <p
                className={`font-bold ${
                  catalogEmpty
                    ? "text-red-600 dark:text-red-300"
                    : "text-amber-700 dark:text-amber-300"
                }`}
              >
                {catalogEmpty
                  ? "Tidak ada SKU yang cocok dengan katalog inventory."
                  : `${impact.notFound.length} dari ${validation.valid.length} SKU tidak cocok dengan katalog.`}
              </p>
              <p className="text-gray-600 dark:text-gray-300">
                Import Stok Toko hanya mengatur QTY barang yang{" "}
                <b>sudah ada</b> di katalog — tidak membuat item baru. Buat
                katalog terlebih dahulu melalui tombol{" "}
                <b>&quot;Import Barang&quot;</b> di halaman ini (mendukung file
                export Kasir Pintar), lalu ulangi Import Stok Toko.
              </p>
            </div>
          </div>
        )}

        {/* Import Summary */}
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
            Ringkasan Import
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Total Baris", value: table.rows.length },
              { label: "Baris Valid", value: validation.valid.length },
              { label: "Baris Invalid", value: invalidRows.length },
              { label: "Instruksi Template", value: templateRows.length },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-gray-200 dark:border-white/10 p-3 text-center"
              >
                <p className="text-[10px] uppercase text-gray-400">
                  {s.label}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
            {mappedFields.map((m) => (
              <span
                key={m.label}
                className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full"
              >
                {m.label} ← {m.column}
              </span>
            ))}
            {ignoredColumns.length > 0 && (
              <span className="bg-gray-100 dark:bg-white/5 text-gray-500 px-2 py-0.5 rounded-full">
                Diabaikan: {ignoredColumns.join(", ")}
              </span>
            )}
            {validation.skippedEmpty > 0 && (
              <span className="bg-gray-100 dark:bg-white/5 text-gray-500 px-2 py-0.5 rounded-full">
                Baris kosong dilewati: {validation.skippedEmpty}
              </span>
            )}
          </div>
        </div>

        {/* Error rows — tampilkan nilai mentah penyebab error */}
        {validation.errors.length > 0 && (
          <div className="rounded-xl border border-red-200 dark:border-red-500/30 overflow-hidden">
            <div className="px-3 py-2 bg-red-50 dark:bg-red-500/10 text-xs font-bold text-red-600 dark:text-red-300">
              Baris Bermasalah ({validation.errors.length}
              {templateRows.length > 0 &&
                ` — termasuk ${templateRows.length} instruksi template`}
              )
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#2c2c2c]">
                <tr className="text-left text-[10px] uppercase text-gray-400">
                  <th className="px-3 py-1.5">Baris</th>
                  <th className="px-3 py-1.5">SKU</th>
                  <th className="px-3 py-1.5">Quantity</th>
                  <th className="px-3 py-1.5">Masalah</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {shownErrors.map((err) => (
                  <tr
                    key={`${err.rowNumber}-${err.error}`}
                    className={
                      err.isTemplateRow
                        ? "bg-slate-50 dark:bg-white/5"
                        : undefined
                    }
                  >
                    <td className="px-3 py-1.5 text-gray-400">
                      {err.rowNumber}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-gray-300 max-w-[10rem] truncate" title={err.raw?.sku ?? err.sku}>
                      {err.raw?.sku ?? err.sku}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-600 dark:text-gray-300 max-w-[8rem] truncate" title={err.raw?.quantity ?? ""}>
                      {err.isTemplateRow
                        ? "—"
                        : err.raw?.quantity !== undefined
                          ? `"${err.raw.quantity}"`
                          : "—"}
                    </td>
                    <td
                      className={`px-3 py-1.5 ${
                        err.isTemplateRow
                          ? "text-slate-500 dark:text-gray-400"
                          : "text-red-600 dark:text-red-300"
                      }`}
                    >
                      {err.isTemplateRow && (
                        <span className="inline-block mr-1 text-[9px] uppercase font-bold bg-slate-200 dark:bg-white/10 text-slate-500 px-1 py-0.5 rounded align-middle">
                          Template
                        </span>
                      )}
                      {err.error}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {validation.errors.length > shownErrors.length && (
              <p className="px-3 py-1.5 text-[11px] text-gray-400">
                ... dan {validation.errors.length - shownErrors.length} baris
                bermasalah lainnya
              </p>
            )}
          </div>
        )}

        {/* Impact Summary */}
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
            Dampak ke Stok ({branchName})
          </h4>
          <div className="rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-[#2c2c2c]">
                <tr className="text-left text-[10px] uppercase text-gray-500">
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2 text-right">Saat Ini</th>
                  <th className="px-3 py-2 text-right">Import</th>
                  <th className="px-3 py-2 text-right">Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {shownImpact.map((l) => (
                  <tr key={l.sku}>
                    <td className="px-3 py-1.5 font-mono text-gray-900 dark:text-gray-100">
                      {l.sku}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-600 dark:text-gray-300">
                      {l.current}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-900 dark:text-gray-100 font-semibold">
                      {l.imported}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right font-bold ${
                        l.delta > 0
                          ? "text-green-600 dark:text-green-400"
                          : l.delta < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-400"
                      }`}
                    >
                      {l.delta > 0 ? `+${l.delta}` : l.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {impact.lines.length > shownImpact.length && (
              <p className="px-3 py-1.5 text-[11px] text-gray-400">
                ... dan {impact.lines.length - shownImpact.length} baris lainnya
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-gray-500">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-500" /> Naik:{" "}
              {impact.increase}
            </span>
            <span className="flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-red-500" /> Turun:{" "}
              {impact.decrease}
            </span>
            <span className="flex items-center gap-1">
              <Minus className="w-3.5 h-3.5 text-gray-400" /> Tetap:{" "}
              {impact.noChange}
            </span>
          </div>
        </div>

        {/* Peringatan */}
        {catalogDuplicates.length > 0 && (
          <WarningBox>
            SKU ganda ditemukan di katalog untuk:{" "}
            <b>{catalogDuplicates.join(", ")}</b> — dilewati agar tidak ambigu.
          </WarningBox>
        )}
        {impact.notFound.length > 0 && (
          <WarningBox>
            {impact.notFound.length} SKU tidak ditemukan di katalog cabang ini
            dan TIDAK akan diubah:{" "}
            <b>
              {impact.notFound
                .slice(0, MAX_NOTFOUND_SHOWN)
                .map((n) => n.sku)
                .join(", ")}
              {impact.notFound.length > MAX_NOTFOUND_SHOWN
                ? `, +${impact.notFound.length - MAX_NOTFOUND_SHOWN} lainnya`
                : ""}
            </b>
          </WarningBox>
        )}
        <p className="text-[11px] text-gray-400">
          Perubahan diterapkan sebagai penyesuaian delta melalui RPC stok
          terpusat (anti-minus, tercatat di riwayat pergerakan stok). Tidak ada
          penghapusan &amp; insert ulang stok.
        </p>
      </>,
      <>
        <button
          onClick={() => setStep("map")}
          disabled={preparing}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </button>
        <button
          onClick={() => void confirmApply()}
          disabled={applyLines.length === 0 || preparing}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          Konfirmasi Import
          {applyLines.length > 0 && ` (${applyLines.length} perubahan)`}
        </button>
      </>,
    );
  }

  // ─────────────────────────── APPLYING ─────────────────────────
  if (step === "applying") {
    const pct =
      progress.total > 0
        ? Math.round((progress.applied / progress.total) * 100)
        : 0;
    return shell(
      <div className="py-6 space-y-4">
        <div className="flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          Menerapkan perubahan stok... {progress.applied}/{progress.total}
        </div>
        <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-center text-gray-400">
          Jangan tutup halaman ini. Setiap baris dicatat sebagai penyesuaian
          resmi di riwayat stok.
        </p>
      </div>,
    );
  }

  // ─────────────────────────── RESULT ───────────────────────────
  if (step === "result" && result) {
    const ok = result.status === "success";
    return shell(
      <>
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 ${
            ok
              ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30"
              : "bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30"
          }`}
        >
          {ok ? (
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
          )}
          <div>
            <p
              className={`font-bold ${
                ok
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-red-600 dark:text-red-300"
              }`}
            >
              {ok
                ? "Import selesai!"
                : result.status === "failed"
                  ? "Import gagal — stok dikembalikan utuh"
                  : "Import gagal — sebagian perubahan perlu dicek manual"}
            </p>
            {result.failure && (
              <p className="text-xs mt-1 text-gray-600 dark:text-gray-300">
                {result.failure.sku !== "-" && (
                  <>Gagal di SKU {result.failure.sku}: </>
                )}
                {result.failure.message}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Diterapkan", value: result.appliedCount },
            { label: "Dikompensasi", value: result.compensatedCount },
            { label: "Tanpa Perubahan", value: impact?.noChange ?? 0 },
            {
              label: "Tidak Ditemukan",
              value: impact?.notFound.length ?? 0,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-gray-200 dark:border-white/10 p-3 text-center"
            >
              <p className="text-[10px] uppercase text-gray-400">{s.label}</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {result.status !== "success" && (
          <div className="text-xs text-gray-500 space-y-1">
            <p>
              Mekanisme aman: penerapan berhenti pada baris pertama yang gagal,
              lalu seluruh perubahan yang sudah masuk dikembalikan lewat jalur
              RPC yang sama.
            </p>
            {result.compensationFailed.length > 0 && (
              <p className="text-red-600 dark:text-red-300 font-semibold">
                Kompensasi gagal untuk SKU:{" "}
                {result.compensationFailed.map((f) => f.sku).join(", ")} —
                periksa dan sesuaikan manual melalui menu Stock Toko.
              </p>
            )}
          </div>
        )}

        {validation &&
          validation.errors.some((e) => !e.isTemplateRow) && (
            <p className="text-[11px] text-gray-400">
              Catatan:{" "}
              {validation.errors.filter((e) => !e.isTemplateRow).length} baris
              invalid dari file dilewati tanpa diproses.
            </p>
          )}
      </>,
      <button
        onClick={finish}
        className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white dark:text-gray-900 text-white font-semibold rounded-xl text-sm"
      >
        <CheckCircle2 className="w-4 h-4" /> Selesai
      </button>,
    );
  }

  return null;
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-xs text-amber-700 dark:text-amber-300">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}
