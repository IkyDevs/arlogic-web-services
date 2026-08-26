import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Inventory Domain Service (Single Source of Truth) ─────────────
// Semua perubahan stok WAJIB lewat sini -> RPC Postgres atomik
// (adjust_store_stock / adjust_warehouse_stock). RPC menegakkan
// otorisasi role/cabang, anti-minus, dual-write kolom legacy, dan
// mencatat stock_movements.

export type StockSource =
  | "web_app"
  | "service_transaction"
  | "technician"
  | "qc"
  | "gudang"
  | "adjustment"
  | "google_sheets";

export interface StockAdjust {
  inventoryId: string;
  /** null hanya untuk warehouse */
  branchId?: string | null;
  /** +n = tambah stok (restore/restock), -n = pakai stok */
  delta: number;
  source: StockSource;
  reason?: string;
  refType?: string;
  refId?: string;
}

/** Potong/tambah stok toko cabang. Melempar Error dengan kode dari RPC:
 *  FORBIDDEN_BRANCH | INSUFFICIENT_STOCK | DELTA_INVALID | BRANCH_REQUIRED */
export async function adjustStoreStock(
  supabase: SupabaseClient,
  a: StockAdjust,
): Promise<number> {
  const { data, error } = await supabase.rpc("adjust_store_stock", {
    p_inventory_id: a.inventoryId,
    p_branch_id: a.branchId ?? null,
    p_delta: a.delta,
    p_source: a.source,
    p_reason: a.reason ?? null,
    p_ref_type: a.refType ?? null,
    p_ref_id: a.refId ?? null,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Adjust stok gudang pusat (khusus admin_gudang/owner). */
export async function adjustWarehouseStock(
  supabase: SupabaseClient,
  a: Omit<StockAdjust, "branchId">,
): Promise<number> {
  const { data, error } = await supabase.rpc("adjust_warehouse_stock", {
    p_inventory_id: a.inventoryId,
    p_delta: a.delta,
    p_source: a.source,
    p_reason: a.reason ?? null,
    p_ref_type: a.refType ?? null,
    p_ref_id: a.refId ?? null,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

// ─── Search stok cabang (picker Sparepart / Jam) ───────────────────

export interface StoreStockOption {
  id: string;
  item_name: string;
  sku: string | null;
  price: number | null;
  buy_price: number | null;
  quantity: number;
}

export async function searchStoreStock(
  supabase: SupabaseClient,
  opts: { branchId: string; itemClass: "sparepart" | "jam"; query?: string; limit?: number },
): Promise<StoreStockOption[]> {
  let q = supabase
    .from("inventory")
    .select(
      "id, item_name, sku, price, buy_price, stock_toko!inner(quantity)",
    )
    .eq("item_class", opts.itemClass)
    .eq("stock_toko.branch_id", opts.branchId)
    .gt("stock_toko.quantity", 0)
    .order("item_name")
    .limit(opts.limit ?? 50);
  if (opts.query && opts.query.trim()) {
    const term = `%${opts.query.trim()}%`;
    q = q.or(`item_name.ilike.${term},sku.ilike.${term}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data as unknown as Array<Omit<StoreStockOption, "quantity"> & { stock_toko: { quantity: number }[] }>) || [])
    .map((r) => ({
      id: r.id,
      item_name: r.item_name,
      sku: r.sku,
      price: r.price,
      buy_price: r.buy_price,
      quantity: (r.stock_toko || []).reduce((s, x) => s + (x.quantity ?? 0), 0),
    }))
    .filter((r) => r.quantity > 0);
}

// ─── Import Stok Toko: apply delta berurutan + kompensasi aman ─────

export interface StoreStockImportLine {
  inventoryId: string;
  sku: string;
  /** imported - current; 0 tidak boleh masuk daftar ini */
  delta: number;
}

export interface StoreStockImportFailure {
  sku: string;
  message: string;
}

export interface StoreStockImportResult {
  /** success = semua delta terpasang; failed = rollback bersih;
   *  partial = gagal + sebagian kompensasi ikut gagal (perlu perbaikan manual) */
  status: "success" | "failed" | "partial";
  appliedCount: number;
  compensatedCount: number;
  compensationFailed: StoreStockImportFailure[];
  failure?: StoreStockImportFailure;
}

/**
 * Terapkan hasil import stok toko SATU PER SATU lewat adjustStoreStock
 * (RPC atomik: otorisasi cabang, anti-minus, ledger).
 *
 * Safety partial-failure: bila satu baris gagal, penerapan BERHENTI dan
 * seluruh baris yang sudah terpasang DIKOMPENSASI (delta dibalik) agar stok
 * tidak tertinggal setengah ter-update. Kompensasi yang juga gagal dilaporkan
 * eksplisit (status "partial") — tidak pernah silent.
 */
export async function applyStoreStockImport(
  supabase: SupabaseClient,
  lines: StoreStockImportLine[],
  opts: {
    branchId: string;
    source?: StockSource;
    reason?: string;
    onProgress?: (appliedCount: number, total: number) => void;
  },
): Promise<StoreStockImportResult> {
  const applied: StoreStockImportLine[] = [];
  const source = opts.source ?? "adjustment";
  const reason = opts.reason ?? "Import stok toko";

  for (const line of lines) {
    if (line.delta === 0) continue;
    try {
      await adjustStoreStock(supabase, {
        inventoryId: line.inventoryId,
        branchId: opts.branchId,
        delta: line.delta,
        source,
        reason,
      });
    } catch (e: unknown) {
      const failure = {
        sku: line.sku,
        message: e instanceof Error ? e.message : "Gagal menerapkan delta stok",
      };
      // Kompensasi terbalik (LIFO) hanya atas baris yang SUDAH berhasil.
      let compensatedCount = 0;
      const compensationFailed: StoreStockImportFailure[] = [];
      for (const done of [...applied].reverse()) {
        try {
          await adjustStoreStock(supabase, {
            inventoryId: done.inventoryId,
            branchId: opts.branchId,
            delta: -done.delta,
            source,
            reason: "Kompensasi import stok gagal",
          });
          compensatedCount++;
        } catch (compErr: unknown) {
          compensationFailed.push({
            sku: done.sku,
            message:
              compErr instanceof Error
                ? compErr.message
                : "Kompensasi gagal",
          });
        }
      }
      return {
        status: compensationFailed.length > 0 ? "partial" : "failed",
        appliedCount: applied.length,
        compensatedCount,
        compensationFailed,
        failure,
      };
    }
    applied.push(line);
    opts.onProgress?.(applied.length, lines.length);
  }

  return {
    status: "success",
    appliedCount: applied.length,
    compensatedCount: 0,
    compensationFailed: [],
  };
}

// ─── Rollback helpers (dipakai transaksi service) ──────────────────

export interface AppliedStockChange {
  inventoryId: string;
  /** Delta stok yang SUDAH diterapkan (− = stok berkurang) */
  appliedDelta: number;
}

/**
 * Terapkan delta pemakaian tanpa kompensasi otomatis — pemanggil yang
 * mengelola kompensasi agar urutan konsisten dengan operasi DB lain.
 */
export async function applyUsageDeltas(
  supabase: SupabaseClient,
  deltas: Array<{ inventoryId: string; usageDelta: number }>,
  opts: { branchId: string | null | undefined; source: StockSource; reason: string },
): Promise<AppliedStockChange[]> {
  const applied: AppliedStockChange[] = [];
  for (const d of deltas) {
    const stockDelta = -d.usageDelta;
    await adjustStoreStock(supabase, {
      inventoryId: d.inventoryId,
      branchId: opts.branchId ?? null,
      delta: stockDelta,
      source: opts.source,
      reason: opts.reason,
    });
    applied.push({ inventoryId: d.inventoryId, appliedDelta: stockDelta });
  }
  return applied;
}

/** Best-effort inverse dari daftar applied (untuk jalur gagal). */
export async function compensateUsageDeltas(
  supabase: SupabaseClient,
  applied: AppliedStockChange[],
  opts: { branchId: string | null | undefined; source?: StockSource },
): Promise<void> {
  for (const a of applied) {
    await adjustStoreStock(supabase, {
      inventoryId: a.inventoryId,
      branchId: opts.branchId ?? null,
      delta: -a.appliedDelta,
      source: opts.source ?? "web_app",
      reason: "Kompensasi otomatis",
    }).catch(() => {});
  }
}

// ─── Pure helpers (unit-testable) ───────────────────────────────────

export interface InventoryRefLine {
  inventory_id?: string | null;
  quantity?: number;
}

/**
 * Hitung delta pemakaian stok antara daftar lama & baru.
 * Return: net pemakaian per inventoryId (positif = bertambah pakai → stok −delta).
 * Baris tanpa inventory_id (jasa/data legacy) diabaikan.
 */
export function computeStockDeltas(
  prev: InventoryRefLine[],
  next: InventoryRefLine[],
): Array<{ inventoryId: string; usageDelta: number }> {
  const count = (rows: InventoryRefLine[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!r.inventory_id) continue;
      const qty = Math.max(1, r.quantity ?? 1);
      m.set(r.inventory_id, (m.get(r.inventory_id) || 0) + qty);
    }
    return m;
  };
  const a = count(prev);
  const b = count(next);
  const ids = new Set([...a.keys(), ...b.keys()]);
  const out: Array<{ inventoryId: string; usageDelta: number }> = [];
  for (const id of ids) {
    const d = (b.get(id) || 0) - (a.get(id) || 0);
    if (d !== 0) out.push({ inventoryId: id, usageDelta: d });
  }
  return out;
}
