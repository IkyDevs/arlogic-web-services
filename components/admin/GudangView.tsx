"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { adjustStock, adjustStoreStock } from "@/lib/domain/inventory/service";
import { useBranch } from "@/lib/context/BranchContext";
import { Search, Warehouse, AlertTriangle, Minus, Plus, FileSpreadsheet, Loader2, X } from "lucide-react";
import ImportBarangModal from "@/components/admin/ImportBarangModal";
import toast from "react-hot-toast";

interface WarehouseItem {
  id: string;
  name: string;
  sku: string;
  warehouse_stock: number;
  default_minimum_stock: number;
  sell_price: number | null;
  buy_price: number | null;
  unit: string;
  category: string | null;
  item_class: string;
}

interface AddItemForm {
  name: string;
  sku: string;
  item_class: string;
  category: string;
  unit: string;
  default_minimum_stock: string;
  sell_price: string;
  buy_price: string;
  initial_stock: string;
}

const EMPTY_FORM: AddItemForm = {
  name: "",
  sku: "",
  item_class: "sparepart",
  category: "",
  unit: "pcs",
  default_minimum_stock: "0",
  sell_price: "0",
  buy_price: "0",
  initial_stock: "0",
};

export default function GudangView() {
  const supabase = createClient();
  const { branches } = useBranch();
  const warehouse = branches.find((b) => b.is_central === true);
  const warehouseLocationId = warehouse?.id ?? "";
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<AddItemForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("stock_items")
        .select(`
          id, name, sku, item_class, unit, category,
          default_minimum_stock, sell_price, buy_price,
          stock_balances!inner(physical_quantity, location_id)
        `)
        .eq("stock_balances.location_id", warehouseLocationId)
        .order("name");
      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        warehouse_stock: row.stock_balances?.[0]?.physical_quantity ?? 0,
        default_minimum_stock: row.default_minimum_stock ?? 0,
        sell_price: row.sell_price,
        buy_price: row.buy_price,
        unit: row.unit,
        category: row.category,
        item_class: row.item_class,
      }));
      setItems(mapped);
    } finally {
      setLoading(false);
    }
  }, [supabase, warehouseLocationId]);

  useEffect(() => { const t = setTimeout(fetchStock, 0); return () => clearTimeout(t); }, [fetchStock]);

  // ── Google Spreadsheet: settings + pull adjustment + push snapshot ──
  interface SheetSettings {
    id?: string;
    enabled: boolean;
    apps_script_url: string | null;
    secret_token: string | null;
    spreadsheet_id: string | null;
    auto_sync: boolean;
    last_pull_at: string | null;
    last_push_at: string | null;
    last_result: string | null;
  }
  const [sheets, setSheets] = useState<SheetSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const runSyncRef = useRef<() => void>(() => {});

  const loadSheets = useCallback(async () => {
    const { data } = await supabase
      .from("inventory_sheets_settings")
      .select("*")
      .limit(1);
    setSheets(
      (data?.[0] as SheetSettings) ?? {
        enabled: false,
        apps_script_url: "",
        secret_token: "",
        spreadsheet_id: "",
        auto_sync: false,
        last_pull_at: null,
        last_push_at: null,
        last_result: null,
      },
    );
  }, []);

  useEffect(() => { loadSheets(); }, [loadSheets]);

  const saveSheets = async () => {
    if (!sheets) return;
    setSavingSettings(true);
    try {
      const payload = {
        enabled: sheets.enabled,
        apps_script_url: sheets.apps_script_url || null,
        secret_token: sheets.secret_token || null,
        spreadsheet_id: sheets.spreadsheet_id || null,
        auto_sync: sheets.auto_sync,
        updated_at: new Date().toISOString(),
      };
      const { error } = sheets.id
        ? await supabase.from("inventory_sheets_settings").update(payload).eq("id", sheets.id)
        : await supabase.from("inventory_sheets_settings").insert(payload);
      if (error) throw error;
      toast.success("Pengaturan spreadsheet tersimpan");
      loadSheets();
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan pengaturan");
    } finally {
      setSavingSettings(false);
    }
  };

  const runSync = async () => {
    if (!sheets?.enabled || !sheets.apps_script_url || !sheets.secret_token) {
      toast.error("Enable integrasi & lengkapi URL Apps Script + token");
      return;
    }
    setSyncing(true);
    setSyncMsg("Menjalankan sinkronisasi...");
    try {
      // PULL: baris Adjustment dari sheet -> validasi -> RPC terpusat
      const pullRes = await fetch(
        `${sheets.apps_script_url}?token=${encodeURIComponent(sheets.secret_token)}&action=pending`,
      );
      const pullJson = await pullRes.json();
      const rows: any[] = Array.isArray(pullJson?.rows) ? pullJson.rows : [];
      let appliedCount = 0;
      const errors: string[] = [];
      for (const r of rows) {
        try {
          if (!r.sku || !r.branch_id || !r.adjustment)
            throw new Error("baris tidak lengkap");
          const { data: inv } = await supabase
            .from("inventory")
            .select("id")
            .eq("sku", r.sku)
            .maybeSingle();
          if (!inv) throw new Error(`SKU ${r.sku} tidak ditemukan`);
          await adjustStoreStock(supabase, {
            inventoryId: inv.id,
            branchId: r.branch_id,
            delta: Number(r.adjustment),
            source: "google_sheets",
            reason: r.reason || "Adjustment sheet",
          });
          appliedCount++;
          fetch(`${sheets.apps_script_url}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: sheets.secret_token,
              action: "mark",
              row_id: r.row_id,
              status: "OK",
            }),
          }).catch(() => {});
        } catch (err: any) {
          errors.push(`${r.sku ?? "?"}: ${err.message}`);
        }
      }

      // PUSH: snapshot stok toko saat ini
      const { data: snapData } = await supabase
        .from("inventory")
        .select("sku, item_name, item_class, stock_toko(branch_id, quantity)");
      const snapRows: any[] = [];
      for (const it of snapData || []) {
        for (const t of (it as any).stock_toko || []) {
          snapRows.push({
            sku: it.sku,
            item_name: it.item_name,
            item_class: it.item_class,
            branch_id: t.branch_id,
            quantity: t.quantity ?? 0,
          });
        }
      }
      await fetch(sheets.apps_script_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: sheets.secret_token,
          action: "snapshot",
          rows: snapRows,
        }),
      });

      const nowIso = new Date().toISOString();
      const resultMsg = `applied=${appliedCount}, errors=${errors.length}, pushed=${snapRows.length}`;
      if (sheets.id) {
        await supabase
          .from("inventory_sheets_settings")
          .update({ last_pull_at: nowIso, last_push_at: nowIso, last_result: resultMsg })
          .eq("id", sheets.id);
      }
      setSyncMsg(
        `Sinkron selesai — ${appliedCount} adjustment diterapkan, ${snapRows.length} baris snapshot terpush.` +
          (errors.length ? `\nError:\n- ${errors.join("\n- ")}` : ""),
      );
      loadSheets();
      fetchStock();
    } catch (e: any) {
      setSyncMsg("Gagal sinkron: " + (e.message || e));
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => { runSyncRef.current = runSync; });

  // Near-real-time: poll tiap 60 detik selama halaman terbuka & auto_sync aktif
  useEffect(() => {
    if (!(sheets?.enabled && sheets.auto_sync && sheets.apps_script_url)) return;
    const iv = setInterval(() => runSyncRef.current(), 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheets?.enabled, sheets?.auto_sync, sheets?.apps_script_url]);

  // V1 Gudang: lihat + tambah/kurangi stock gudang (tanpa transfer)
  const handleAdjust = async (item: WarehouseItem, delta: number) => {
    if (delta < 0 && item.warehouse_stock <= 0) {
      toast.error("Stock gudang sudah 0");
      return;
    }
    if (!warehouseLocationId) {
      toast.error("Lokasi gudang tidak ditemukan");
      return;
    }
    setAdjustingId(item.id);
    try {
      await adjustStock(supabase, {
        stockItemId: item.id,
        locationId: warehouseLocationId,
        delta,
        source: "adjustment",
        reason: "Adjust manual gudang",
        refType: "manual_adjustment",
        refId: item.id,
      });
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, warehouse_stock: Math.max(0, it.warehouse_stock + delta) }
            : it,
        ),
      );
      toast.success(`Stock ${item.name} ${delta > 0 ? "+" : ""}${delta}`);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah stock gudang");
      fetchStock();
    } finally {
      setAdjustingId(null);
    }
  };

  const handleAddItem = async () => {
    if (!addForm.name.trim() || !addForm.sku.trim()) {
      toast.error("Nama item dan SKU wajib diisi");
      return;
    }
    if (!warehouseLocationId) {
      toast.error("Lokasi gudang tidak ditemukan");
      return;
    }
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from("stock_items")
        .select("id")
        .eq("sku", addForm.sku.trim())
        .maybeSingle();
      if (existing) {
        toast.error("SKU sudah ada di katalog");
        return;
      }

      const itemId = crypto.randomUUID();
      const { error: insertErr } = await supabase.from("stock_items").insert({
        id: itemId,
        name: addForm.name.trim(),
        sku: addForm.sku.trim(),
        item_class: addForm.item_class === "jam" ? "jam" : "sparepart",
        category: addForm.category.trim() || null,
        unit: addForm.unit.trim() || "pcs",
        default_minimum_stock: Math.max(0, parseInt(addForm.default_minimum_stock) || 0),
        sell_price: Math.max(0, parseInt(addForm.sell_price) || 0),
        buy_price: Math.max(0, parseInt(addForm.buy_price) || 0),
      });
      if (insertErr) throw insertErr;

      const stockQty = Math.max(0, parseInt(addForm.initial_stock) || 0);
      if (stockQty > 0) {
        await adjustStock(supabase, {
          stockItemId: itemId,
          locationId: warehouseLocationId,
          delta: stockQty,
          source: "adjustment",
          reason: "Stok awal",
          refType: "new_item",
          refId: itemId,
        });
      }

      toast.success("Barang berhasil ditambahkan!");
      setShowAddForm(false);
      setAddForm(EMPTY_FORM);
      fetchStock();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambahkan barang");
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter((it) =>
    it.name.toLowerCase().includes(search.toLowerCase()) ||
    (it.sku || "").toLowerCase().includes(search.toLowerCase()) ||
    (it.category || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            <Warehouse className="w-4 h-4 inline mr-1 text-blue-500" />
            Management Gudang
          </h3>
          <p className="text-xs text-gray-500">Stock Gudang — barang masuk &amp; keluar gudang</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari barang gudang..."
              className="pl-9 pr-4 py-2 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm w-48 sm:w-64"
            />
          </div>
          <button
            onClick={() => { setAddForm(EMPTY_FORM); setShowAddForm(true); }}
            className="px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800"
          >
            + Tambah Barang
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700"
          >
            + Import Barang
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-400 text-sm">Memuat...</p>}

      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-white/10 text-left text-[10px] text-gray-500 uppercase tracking-wider">
                <th className="px-4 py-2.5">Nama</th>
                <th className="px-4 py-2.5">SKU</th>
                <th className="px-4 py-2.5">Stok Gudang</th>
                <th className="px-4 py-2.5">Min</th>
                <th className="px-4 py-2.5">Harga Beli</th>
                <th className="px-4 py-2.5">Harga Jual</th>
                <th className="px-4 py-2.5">Kategori</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filtered.map((it) => {
                const low = it.warehouse_stock <= it.default_minimum_stock;
                return (
                  <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{it.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{it.sku}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${low ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                          {low && <AlertTriangle className="w-3 h-3" />}
                          {it.warehouse_stock} {it.unit}
                        </span>
                        <button
                          onClick={() => handleAdjust(it, -1)}
                          disabled={adjustingId === it.id}
                          title="Kurangi stock gudang"
                          className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-white/10 rounded text-slate-700 dark:text-gray-200 hover:bg-slate-200 disabled:opacity-50"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleAdjust(it, 1)}
                          disabled={adjustingId === it.id}
                          title="Tambah stock gudang"
                          className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-white/10 rounded text-slate-700 dark:text-gray-200 hover:bg-slate-200 disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{it.default_minimum_stock}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{it.buy_price ? `Rp ${Number(it.buy_price).toLocaleString("id-ID")}` : "-"}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{it.sell_price ? `Rp ${Number(it.sell_price).toLocaleString("id-ID")}` : "-"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{it.category || "-"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {search ? "Tidak ada hasil" : "Belum ada barang di gudang"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4" onClick={() => setShowAddForm(false)}>
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-white/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Tambah Barang Baru</h3>
              <button onClick={() => setShowAddForm(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Nama Item <span className="text-red-500">*</span></label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">SKU <span className="text-red-500">*</span></label>
                <input type="text" value={addForm.sku} onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Jenis</label>
                  <select value={addForm.item_class} onChange={(e) => setAddForm({ ...addForm, item_class: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500">
                    <option value="sparepart">Sparepart</option>
                    <option value="jam">Jam</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Satuan</label>
                  <input type="text" value={addForm.unit} onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })} placeholder="pcs"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Kategori</label>
                <input type="text" value={addForm.category} onChange={(e) => setAddForm({ ...addForm, category: e.target.value })} placeholder="Opsional"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Harga Beli (Rp)</label>
                  <input type="number" min={0} value={addForm.buy_price} onChange={(e) => setAddForm({ ...addForm, buy_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Harga Jual (Rp)</label>
                  <input type="number" min={0} value={addForm.sell_price} onChange={(e) => setAddForm({ ...addForm, sell_price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Min Stok</label>
                  <input type="number" min={0} value={addForm.default_minimum_stock} onChange={(e) => setAddForm({ ...addForm, default_minimum_stock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">Stok Gudang Awal</label>
                  <input type="number" min={0} value={addForm.initial_stock} onChange={(e) => setAddForm({ ...addForm, initial_stock: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#2c2c2c] text-gray-900 dark:text-gray-100 focus:outline-none focus:border-blue-500" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex gap-3">
              <button onClick={() => setShowAddForm(false)}
                className="px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl text-sm">
                Batal
              </button>
              <button onClick={handleAddItem} disabled={saving}
                className="ml-auto flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Simpan Barang
              </button>
            </div>
          </div>
        </div>
      )}

      <ImportBarangModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => fetchStock()}
      />

      {/* ── Integrasi Google Spreadsheet (OPTIONAL) ── */}
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Integrasi Google Spreadsheet (Opsional)
            </h3>
            <p className="text-[11px] text-gray-400">
              Database tetap source of truth. Sheet dipakai untuk bulk adjustment & monitoring.
            </p>
          </div>
        </div>

        {!sheets ? (
          <p className="text-xs text-gray-400">Memuat pengaturan...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={sheets.apps_script_url ?? ""}
                onChange={(e) => setSheets({ ...sheets, apps_script_url: e.target.value })}
                placeholder="URL Web App Apps Script"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-900"
              />
              <input
                value={sheets.secret_token ?? ""}
                onChange={(e) => setSheets({ ...sheets, secret_token: e.target.value })}
                placeholder="Secret token"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-900"
              />
              <input
                value={sheets.spreadsheet_id ?? ""}
                onChange={(e) => setSheets({ ...sheets, spreadsheet_id: e.target.value })}
                placeholder="Spreadsheet ID (opsional)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-900"
              />
              <div className="flex items-center gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={sheets.enabled}
                    onChange={(e) => setSheets({ ...sheets, enabled: e.target.checked })}
                  />
                  Enable
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={sheets.auto_sync}
                    onChange={(e) => setSheets({ ...sheets, auto_sync: e.target.checked })}
                  />
                  Auto sync (±60 dtk)
                </label>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={saveSheets}
                disabled={savingSettings}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-all"
              >
                Simpan Pengaturan
              </button>
              <button
                onClick={() => runSyncRef.current()}
                disabled={syncing || !sheets.enabled}
                aria-busy={syncing}
                className="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {syncing && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Sync Sekarang
              </button>
              {(sheets.last_pull_at || sheets.last_push_at) && (
                <span className="text-[11px] text-gray-400">
                  Pull: {sheets.last_pull_at ? new Date(sheets.last_pull_at).toLocaleString("id-ID") : "-"} ·
                  Push: {sheets.last_push_at ? new Date(sheets.last_push_at).toLocaleString("id-ID") : "-"}
                </span>
              )}
            </div>
            {syncMsg && (
              <p className="text-xs text-gray-500 dark:text-gray-300 whitespace-pre-wrap">{syncMsg}</p>
            )}
            {sheets.last_result && !syncMsg && (
              <p className="text-[11px] text-gray-400">Hasil terakhir: {sheets.last_result}</p>
            )}
            <p className="text-[11px] text-gray-400">
              Setup sheet & kode Apps Script: lihat <code>docs/google-sheets-setup.md</code>.
              Model = <b>adjustment</b> (+/- dengan alasan), bukan overwrite stok.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
