// ─── Import CSV/XLSX Stock Toko (pure, deterministic) ──────────────
export type SystemField = "sku" | "name" | "quantity";

export const FIELD_LABELS: Record<SystemField, string> = {
  sku: "SKU",
  name: "Nama",
  quantity: "Quantity",
};

const ALIASES: Record<SystemField, string[]> = {
  sku: ["sku", "produksku", "productsku", "kode"],
  name: ["nama", "namaproduk", "name", "productname", "item_name", "namasparepart"],
  quantity: ["quantity", "jumlahstock", "jumlah", "qty", "stock", "stok"],
};

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string | number>[];
}

export function autoMapColumns(headers: string[]): Record<string, SystemField | "ignore"> {
  const map: Record<string, SystemField | "ignore"> = {};
  const used = new Set<SystemField>();
  for (const h of headers) {
    const norm = h.toLowerCase().replace(/[\s_-]/g, "");
    let target: SystemField | undefined;
    for (const [field, aliases] of Object.entries(ALIASES)) {
      if (!used.has(field as SystemField) && (aliases.includes(norm) || norm === field)) {
        target = field as SystemField;
        break;
      }
    }
    if (target) {
      map[h] = target;
      used.add(target);
    } else {
      map[h] = "ignore";
    }
  }
  return map;
}

export interface ValidatedRow {
  rowNumber: number;
  /** SKU asli dari file — kunci matching ke inventory (BUKAN nama item) */
  sku: string;
  name?: string;
  quantity: number;
}
export interface RowError {
  rowNumber: number;
  sku: string;
  error: string;
  /** Nilai mentah cell penyebab error — ditampilkan di UI agar jelas */
  raw?: {
    sku?: string;
    name?: string;
    quantity?: string;
  };
  /** true = baris instruksi template (mis. export Kasir Pintar), bukan data barang */
  isTemplateRow?: boolean;
}
export interface ValidationResult {
  valid: ValidatedRow[];
  errors: RowError[];
  duplicateCount: number;
  /** Baris benar-benar kosong (semua kolom dipetakan kosong) — diabaikan */
  skippedEmpty: number;
}

const normalizeKey = (s: string) => s.trim().toUpperCase();

/** Teks panjang non-numerik di kolom SKU/Quantity = instruksi template, bukan data */
const TEMPLATE_TEXT_MIN_LENGTH = 30;
function looksLikeInstructionText(value: unknown): boolean {
  const s = String(value ?? "").trim();
  return s.length >= TEMPLATE_TEXT_MIN_LENGTH && Number.isNaN(Number(s));
}

/** Quantity wajib bilangan bulat polos. "1.000" dsb. DITOLAK, bukan dikonversi
 *  diam-diam (Number("1.000")===1 = korupsi data senyap). */
function parseQuantity(raw: unknown): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === "" || raw === null || raw === undefined) {
    return { ok: false, message: "Quantity kosong" };
  }
  if (typeof raw === "number") return { ok: true, value: raw };
  const s = String(raw).trim();
  if (s === "") return { ok: false, message: "Quantity kosong" };
  if (/^-?\d+$/.test(s)) return { ok: true, value: Number(s) };
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    return {
      ok: false,
      message: `Quantity berformat ambigu ("${s}"). Gunakan angka bulat tanpa pemisah ribuan/desimal, contoh: 1000`,
    };
  }
  return { ok: false, message: "Quantity bukan angka" };
}

export function validateRows(
  table: ParsedTable,
  mapping: Record<string, SystemField | "ignore">,
): ValidationResult {
  const colFor = (f: SystemField) =>
    Object.entries(mapping).find(([, v]) => v === f)?.[0];
  const skuCol = colFor("sku");
  const nameCol = colFor("name");
  const qtyCol = colFor("quantity");

  const errors: RowError[] = [];
  const valid: ValidatedRow[] = [];
  const seenSku = new Set<string>();
  let duplicateCount = 0;
  let skippedEmpty = 0;

  if (!skuCol) return { valid, errors: [{ rowNumber: 0, sku: "-", error: "Mapping SKU wajib dipilih" }], duplicateCount, skippedEmpty };
  if (!qtyCol) return { valid, errors: [{ rowNumber: 0, sku: "-", error: "Mapping Quantity wajib dipilih" }], duplicateCount, skippedEmpty };

  table.rows.forEach((row, i) => {
    const rowNumber = i + 2; // +1 header, +1 base-1
    const rawSkuCell = row[skuCol];
    const rawSku = String(rawSkuCell ?? "").trim();
    const rawName = nameCol ? String(row[nameCol] ?? "").trim() : "";
    const rawQty = row[qtyCol];

    // Baris kosong total = pemisah/format, diabaikan (bukan error)
    if (!rawSku && !rawName && (rawQty === "" || rawQty === null || rawQty === undefined)) {
      skippedEmpty++;
      return;
    }

    const raw = {
      sku: rawSku || undefined,
      name: rawName || undefined,
      quantity:
        rawQty === "" || rawQty === null || rawQty === undefined
          ? undefined
          : String(rawQty),
    };
    const isTemplate =
      looksLikeInstructionText(rawSkuCell) || looksLikeInstructionText(rawQty);
    const pushError = (error: string) =>
      errors.push({
        rowNumber,
        sku: rawSku || rawName || "-",
        error: isTemplate
          ? "Baris instruksi template terdeteksi — dilewati, bukan data barang"
          : error,
        raw,
        ...(isTemplate ? { isTemplateRow: true } : {}),
      });

    if (!rawSku) {
      pushError("SKU kosong");
      return;
    }
    const qty = parseQuantity(rawQty);
    if (!qty.ok) {
      pushError(qty.message);
      return;
    }
    if (!Number.isInteger(qty.value) || qty.value < 0) {
      pushError("Quantity harus bilangan >= 0");
      return;
    }
    // Satu SKU = satu target adjust; duplikat bikin delta ambigu → ditolak
    const key = normalizeKey(rawSku);
    if (seenSku.has(key)) {
      duplicateCount++;
      pushError("SKU duplikat dalam file");
      return;
    }
    seenSku.add(key);
    valid.push({
      rowNumber,
      sku: rawSku,
      name: rawName || undefined,
      quantity: qty.value,
    });
  });

  return { valid, errors, duplicateCount, skippedEmpty };
}

export interface ImpactLine {
  sku: string;
  current: number;
  imported: number;
  delta: number;
}
export interface ImpactSummary {
  lines: ImpactLine[];
  notFound: Array<{ sku: string; quantity: number }>;
  increase: number;
  decrease: number;
  noChange: number;
}

/** Kunci matching SKU antara file ↔ katalog: trim + case-insensitive */
export function normalizeSkuKey(s: string): string {
  return s.trim().toUpperCase();
}

/** currentBySku: qty stok toko cabang aktif per SKU (normalisasi otomatis). */
export function calculateImpact(
  valid: ValidatedRow[],
  currentBySku: Map<string, number>,
): ImpactSummary {
  const normCurrent = new Map(
    [...currentBySku.entries()].map(([k, v]) => [normalizeSkuKey(k), v] as const),
  );
  const lines: ImpactLine[] = [];
  const notFound: Array<{ sku: string; quantity: number }> = [];
  let increase = 0, decrease = 0, noChange = 0;
  for (const r of valid) {
    const cur = normCurrent.get(normalizeSkuKey(r.sku));
    if (cur === undefined) {
      notFound.push({ sku: r.sku, quantity: r.quantity });
      continue;
    }
    const delta = r.quantity - cur;
    lines.push({ sku: r.sku, current: cur, imported: r.quantity, delta });
    if (delta > 0) increase++;
    else if (delta < 0) decrease++;
    else noChange++;
  }
  return { lines, notFound, increase, decrease, noChange };
}

// ─── Mapping model baru: System Field ← Imported File Column ───────
export type FieldKey = SystemField | "price" | "supplier";
export const SYSTEM_FIELDS: Array<{
  key: FieldKey;
  label: string;
  required: boolean;
  /** opsi 1: supplier ditampilkan tapi selalu ignored (tanpa kolom DB) */
  storable: boolean;
}> = [
  { key: "sku", label: "SKU", required: true, storable: true },
  { key: "name", label: "Nama Produk", required: false, storable: true },
  { key: "quantity", label: "Quantity", required: true, storable: true },
  { key: "price", label: "Harga", required: false, storable: false },
  { key: "supplier", label: "Supplier", required: false, storable: false },
];

export type FieldMapping = Partial<Record<FieldKey, string>>;

/** Validasi model baru: field wajib wajib terpetakan; satu kolom file
 *  tidak boleh dipakai dua system field berbeda. */
export function validateFieldMapping(
  table: ParsedTable,
  mapping: FieldMapping,
): { ok: boolean; error?: string } {
  for (const f of SYSTEM_FIELDS) {
    if (!f.required) continue;
    if (!mapping[f.key]) return { ok: false, error: `${f.label} wajib dipetakan.` };
  }
  const seen = new Map<string, FieldKey>();
  for (const [fk, col] of Object.entries(mapping)) {
    if (!col || col === "ignore") continue;
    if (!table.headers.includes(col))
      return { ok: false, error: `Kolom "${col}" tidak ada di file` };
    const prev = seen.get(col);
    if (prev && prev !== fk)
      return { ok: false, error: `Kolom "${col}" tidak boleh dipetakan ke dua field` };
    seen.set(col, fk as FieldKey);
  }
  return { ok: true };
}

/** Bangun baris ternormalisasi hanya dari kolom yang DIPETAKAN & storable. */
export function buildMappedRows(
  table: ParsedTable,
  mapping: FieldMapping,
): ValidationResult {
  return validateRows(table, fieldMappingToColumnMap(mapping));
}

/** FieldMapping (per system field) → column-keyed map untuk validateRows.
 *  Kolom file yang tidak dipetakan otomatis diabaikan (tidak masuk payload). */
export function fieldMappingToColumnMap(
  mapping: FieldMapping,
): Record<string, SystemField | "ignore"> {
  const out: Record<string, SystemField | "ignore"> = {};
  for (const [fieldKey, col] of Object.entries(mapping)) {
    if (!col || col === "ignore") continue;
    if (fieldKey === "sku" || fieldKey === "name" || fieldKey === "quantity") {
      out[col] = fieldKey;
    }
  }
  return out;
}

/** autoMapColumns (keyed by column) → FieldMapping (keyed by field).
 *  Hasilnya hanya SUGGESTION — admin boleh override via UI. */
export function columnMapToFieldMapping(
  colMap: Record<string, SystemField | "ignore">,
): FieldMapping {
  const out: FieldMapping = {};
  for (const [col, field] of Object.entries(colMap)) {
    if (field !== "ignore" && !out[field]) out[field] = col;
  }
  return out;
}
