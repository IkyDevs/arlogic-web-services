"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { X, Loader2, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

interface PreviewRow {
  item_name: string;
  sku: string;
  price: number;
  buy_price: number;
  min_stock: number;
  stock: number;
  unit: string;
  category: string;
}

interface ImportBarangModalProps {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
}

export default function ImportBarangModal({ open, onClose, onImported }: ImportBarangModalProps) {
  const supabase = createClient();
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [doneCount, setDoneCount] = useState(0);

  if (!open) return null;

  const parseFile = async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Array<Record<string, unknown>>;

      // Mapping kolom Kasir Pintar → inventory
      const mapped: PreviewRow[] = rows
        .map((r) => ({
          item_name: String(r.nama_barang_edit || "").trim(),
          sku: String(r.kode_barang_edit !== undefined && r.kode_barang_edit !== "" ? r.kode_barang_edit : r.kode_barang || "").trim(),
          price: Number(r.harga_jual_edit || 0) || 0,
          buy_price: Number(r.harga_beli_edit || 0) || 0,
          min_stock: Number(r.minimum_stok || 0) || 0,
          stock: Number(r.stok_edit || 0) || 0,
          unit: String(r.berat_dan_satuan || "").trim(),
          category: String(r.kategori || "").trim(),
        }))
        .filter((r) => r.item_name && r.sku);

      setPreview(mapped);
      if (mapped.length === 0) toast.error("Tidak ada data valid. Cek format file.");
      else toast.success(`${mapped.length} barang terbaca`);
    } catch {
      toast.error("Gagal membaca file. Pastikan format .xls/.xlsx dari Kasir Pintar.");
    }
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);
    setDoneCount(0);
    try {
      // Batch 50 per request + ON CONFLICT (sku) upsert
      const BATCH = 50;
      for (let i = 0; i < preview.length; i += BATCH) {
        const batch = preview.slice(i, i + BATCH).map((r) => ({
          item_name: r.item_name,
          sku: r.sku,
          price: r.price,
          buy_price: r.buy_price,
          min_stock: r.min_stock,
          warehouse_stock: r.stock,
          unit: r.unit,
          category: r.category || null,
        }));
        const { error } = await supabase
          .from("inventory")
          .upsert(batch, { onConflict: "sku" });
        if (error) throw error;
        setDoneCount(i + batch.length);
      }
      toast.success(`Berhasil import ${preview.length} barang!`);
      setPreview([]);
      onImported?.();
      onClose();
    } catch (e: unknown) {
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
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Import Barang</h3>
            <p className="text-xs text-gray-500">Upload file export Kasir Pintar (.xls / .xlsx)</p>
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
              <p className="text-xs text-gray-400 mt-1">Format: DATA_BARANG_...xls (export Kasir Pintar)</p>
              <input
                type="file"
                accept=".xls,.xlsx"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) parseFile(e.target.files[0]); e.target.value = ""; }}
              />
            </label>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {preview.length} barang siap di-import
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
                        <th className="px-3 py-2">Nama</th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Harga</th>
                        <th className="px-3 py-2">Stok</th>
                        <th className="px-3 py-2">Kategori</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {preview.slice(0, 8).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-1.5 text-gray-900 dark:text-gray-100">{r.item_name}</td>
                          <td className="px-3 py-1.5 font-mono text-gray-500">{r.sku}</td>
                          <td className="px-3 py-1.5">Rp {r.price.toLocaleString("id-ID")}</td>
                          <td className="px-3 py-1.5">{r.stock}</td>
                          <td className="px-3 py-1.5 text-gray-500">{r.category || "-"}</td>
                        </tr>
                      ))}
                      {preview.length > 8 && (
                        <tr><td colSpan={5} className="px-3 py-2 text-center text-gray-400">... dan {preview.length - 8} lainnya</td></tr>
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
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Import {preview.length > 0 ? `${preview.length} barang` : ""}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
