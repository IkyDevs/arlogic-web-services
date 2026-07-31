"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import { Search, Warehouse, AlertTriangle } from "lucide-react";
import ImportBarangModal from "@/components/admin/ImportBarangModal";

interface WarehouseItem {
  id: string;
  item_name: string;
  sku: string;
  warehouse_stock: number;
  min_stock: number;
  price: number | null;
  buy_price: number | null;
  unit: string;
  category: string | null;
}

export default function GudangView() {
  const supabase = createClient();
  const { activeBranch } = useBranch();
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("inventory")
        .select("id, item_name, sku, warehouse_stock, min_stock, price, buy_price, unit, category")
        .order("item_name");
      setItems((data as WarehouseItem[]) || []);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { const t = setTimeout(fetchStock, 0); return () => clearTimeout(t); }, [fetchStock]);

  const filtered = items.filter((it) =>
    it.item_name.toLowerCase().includes(search.toLowerCase()) ||
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
          <p className="text-xs text-gray-500">Stock gudang pusat ({activeBranch?.name || "-"}) — barang masuk & keluar</p>
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
                const low = it.warehouse_stock <= it.min_stock;
                return (
                  <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{it.item_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{it.sku}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${low ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                        {low && <AlertTriangle className="w-3 h-3" />}
                        {it.warehouse_stock} {it.unit}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{it.min_stock}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{it.buy_price ? `Rp ${it.buy_price.toLocaleString("id-ID")}` : "-"}</td>
                    <td className="px-4 py-2.5 text-gray-900 dark:text-gray-100">{it.price ? `Rp ${it.price.toLocaleString("id-ID")}` : "-"}</td>
                    <td className="px-4 py-2.5 text-gray-500">{it.category || "-"}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    <Warehouse className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    {search ? "Tidak ada hasil" : "Belum ada barang di gudang — klik Import Barang"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ImportBarangModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => fetchStock()}
      />
    </div>
  );
}
