"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Search,
  Upload,
  FileSpreadsheet,
  Loader2,
  Wrench,
} from "lucide-react";
import * as XLSX from "xlsx";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import { validateServiceItem } from "@/lib/domain/shared/validation";

interface CatalogRow {
  id: string;
  name: string;
  price: number;
}

interface ImportRow {
  name: string;
  price: number;
}

export default function ServiceCatalogManager() {
  const supabase = createClient();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState(0);

  const [saving, setSaving] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_items")
      .select("id, name, price")
      .eq("item_type", "jasa")
      .is("service_order_id", null)
      .order("name");
    setRows((data || []) as CatalogRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const filtered = useMemo(
    () =>
      rows.filter((r) =>
        r.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [rows, search],
  );

  const handleAdd = async () => {
    const errors = validateServiceItem({
      name: newName,
      price: newPrice,
      quantity: 1,
      item_type: "jasa",
    });
    if (errors.length > 0) return toast.error(errors[0].message);
    setSaving(true);
    try {
      const { error } = await supabase.from("service_items").insert({
        service_order_id: null,
        item_type: "jasa",
        name: newName.trim(),
        quantity: 1,
        price: newPrice,
        is_final: true,
      });
      if (error) throw error;
      toast.success("Jasa ditambahkan ke katalog");
      setNewName("");
      setNewPrice(0);
      setShowAdd(false);
      fetchRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menambah jasa");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    const errors = validateServiceItem({
      name: editName,
      price: editPrice,
      quantity: 1,
      item_type: "jasa",
    });
    if (errors.length > 0) return toast.error(errors[0].message);
    setSaving(true);
    try {
      const { error } = await supabase
        .from("service_items")
        .update({ name: editName.trim(), price: editPrice })
        .eq("id", id);
      if (error) throw error;
      toast.success("Jasa diupdate");
      setEditingId(null);
      fetchRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal update jasa");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Hapus "${name}" dari katalog?`)) return;
    try {
      const { error } = await supabase.from("service_items").delete().eq("id", id);
      if (error) throw error;
      toast.success("Jasa dihapus dari katalog");
      fetchRows();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal hapus jasa");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="w-5 h-5" /> Katalog Jasa
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Master data jasa — dipakai otomatis di form transaksi (Service Langsung)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all text-sm shadow-lg shadow-blue-100"
          >
            <Upload className="w-4 h-4" /> Import CSV/XLS
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all text-sm shadow-lg shadow-slate-200"
          >
            <Plus className="w-4 h-4" /> Tambah Jasa
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama jasa..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all"
          />
        </div>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Tambah Jasa Baru</p>
              <button onClick={() => setShowAdd(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-4 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nama jasa (mis. Service mesin)"
                className="flex-1 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              <input
                type="text"
                value={newPrice || ""}
                onChange={(e) => setNewPrice(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
                placeholder="Harga (Rp)"
                className="w-full sm:w-40 px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newName.trim()}
                className="px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Simpan
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Nama Jasa</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Harga</th>
                <th className="px-4 py-3 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={3} className="text-center py-12 text-slate-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={3} className="text-center py-12">
                  <p className="text-slate-400">{rows.length === 0 ? "Katalog kosong. Tambah atau import jasa." : "Tidak ada hasil."}</p>
                </td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      {editingId === r.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                      ) : (
                        <span className="font-medium text-slate-900">{r.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === r.id ? (
                        <input
                          type="text"
                          value={editPrice || ""}
                          onChange={(e) => setEditPrice(parseInt(e.target.value.replace(/\D/g, "")) || 0)}
                          className="w-32 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                        />
                      ) : (
                        <span className="text-slate-700">{formatRupiah(r.price)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {editingId === r.id ? (
                          <>
                            <button
                              onClick={() => handleUpdate(r.id)}
                              disabled={saving}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditingId(r.id); setEditName(r.name); setEditPrice(r.price); }}
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(r.id, r.name)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            {filtered.length} jasa{search ? ` (dari ${rows.length})` : ""}
          </div>
        )}
      </div>

      {/* Import Modal */}
      <ImportModal
        open={showImport}
        existing={rows}
        onClose={() => setShowImport(false)}
        onImported={fetchRows}
      />
    </div>
  );
}

// ─── Import CSV/XLS ────────────────────────────────────────────────
function ImportModal({
  open,
  existing,
  onClose,
  onImported,
}: {
  open: boolean;
  existing: CatalogRow[];
  onClose: () => void;
  onImported: () => void;
}) {
  const supabase = createClient();
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  if (!open) return null;

  const parseFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Array<Record<string, unknown>>;
      if (raw.length === 0) {
        toast.error("File kosong");
        return;
      }

      // Deteksi kolom: nama & harga (case-insensitive)
      const headers = Object.keys(raw[0]);
      const nameKey = headers.find((h) => /nama|jasa|name|service/i.test(h)) || headers[0];
      const priceKey = headers.find((h) => /harga|price|nominal/i.test(h));

      const existingNames = new Set(existing.map((r) => r.name.trim().toLowerCase()));
      const seen = new Set<string>();
      const mapped: ImportRow[] = [];
      for (const r of raw) {
        const name = String(r[nameKey] ?? "").trim();
        const price = priceKey ? Number(r[priceKey]) || 0 : 0;
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key) || existingNames.has(key)) continue; // skip duplikat & yang sudah ada
        seen.add(key);
        mapped.push({ name, price });
      }

      setPreview(mapped);
      if (mapped.length === 0) toast.error("Tidak ada data baru. Semua sudah ada / format salah.");
      else toast.success(`${mapped.length} jasa baru siap di-import`);
    } catch {
      toast.error("Gagal membaca file. Pastikan format .csv / .xls / .xlsx");
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    setDoneCount(0);
    try {
      const BATCH = 50;
      for (let i = 0; i < preview.length; i += BATCH) {
        const batch = preview.slice(i, i + BATCH).map((r) => ({
          service_order_id: null,
          item_type: "jasa",
          name: r.name,
          quantity: 1,
          price: r.price,
          is_final: true,
        }));
        const { error } = await supabase.from("service_items").insert(batch);
        if (error) throw error;
        setDoneCount(i + batch.length);
      }
      toast.success(`Berhasil import ${preview.length} jasa!`);
      setPreview([]);
      onImported();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal import");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Import Katalog Jasa</h3>
            <p className="text-xs text-gray-500">Upload .csv / .xls / .xlsx — kolom nama jasa &amp; harga dideteksi otomatis</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {preview.length === 0 ? (
            <label className="block border-2 border-dashed border-gray-300 dark:border-white/10 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 transition-all">
              <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-blue-500" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Klik untuk pilih file</p>
              <p className="text-xs text-gray-400 mt-1">Nama jasa yang sudah ada di katalog otomatis dilewati</p>
              <input
                type="file"
                accept=".csv,.xls,.xlsx"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); e.target.value = ""; }}
              />
            </label>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {preview.length} jasa siap di-import
                </p>
                <button onClick={() => setPreview([])} className="text-xs text-red-500 hover:underline">
                  Batal pilih
                </button>
              </div>
              <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-[#2c2c2c]">
                      <tr className="text-left text-[10px] text-gray-500 uppercase">
                        <th className="px-3 py-2">Nama Jasa</th>
                        <th className="px-3 py-2">Harga</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {preview.slice(0, 8).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{r.name}</td>
                          <td className="px-3 py-1.5">{formatRupiah(r.price)}</td>
                        </tr>
                      ))}
                      {preview.length > 8 && (
                        <tr><td colSpan={2} className="px-3 py-2 text-center text-gray-400">... dan {preview.length - 8} lainnya</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex gap-3 items-center">
          {importing && (
            <p className="text-xs text-blue-600 flex items-center gap-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Importing {doneCount}/{preview.length}...
            </p>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl text-sm">
            Tutup
          </button>
          <button
            onClick={handleImport}
            disabled={preview.length === 0 || importing}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
          >
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Import {preview.length > 0 ? `${preview.length} jasa` : ""}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
