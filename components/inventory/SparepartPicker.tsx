"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search } from "lucide-react";
import {
  searchStoreStock,
  type StoreStockOption,
} from "@/lib/domain/inventory/service";

interface SparepartPickerProps {
  branchId: string | null | undefined;
  /** 'sparepart' utk picker sparepart, 'jam' utk stock jam */
  itemClass?: "sparepart" | "jam";
  value: string | null;
  onSelect: (option: StoreStockOption | null) => void;
  placeholder?: string;
  className?: string;
  accentCls?: string;
}

/** Pencari sparepart dari stok cabang (hasil = qty > 0).
 *  onSelect(null) saat query berubah agar baris invalid tidak lolos validasi. */
export default function SparepartPicker({
  branchId,
  itemClass = "sparepart",
  value,
  onSelect,
  placeholder = "Cari sparepart (nama / SKU)...",
  className = "",
  accentCls = "",
}: SparepartPickerProps) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<StoreStockOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!branchId) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchStoreStock(supabase, {
          branchId,
          itemClass,
          query,
        });
        if (alive) setOptions(rows);
      } catch (e) {
        console.error("[inventory] gagal memuat stok cabang", e);
        if (alive) setOptions([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, query]);

  const selected = options.find((o) => o.id === value) ?? null;

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2 border rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 ${
            accentCls ||
            "border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500/20"
          }`}
        />
      </div>
      {loading ? (
        <p className="text-xs text-gray-400 px-1">Memuat stok...</p>
      ) : options.length === 0 ? (
        <p className="text-xs text-gray-400 px-1">
          Tidak ada stok sparepart tersedia di cabang ini.
        </p>
      ) : (
        <div className="max-h-44 overflow-y-auto rounded-lg border border-gray-200 dark:border-white/10 divide-y divide-gray-100 dark:divide-white/5">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelect(o)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-2 ${
                value === o.id ? "bg-emerald-50 dark:bg-emerald-900/20 font-semibold" : ""
              }`}
            >
              <span className="truncate">{o.item_name}</span>
              <span className="flex-shrink-0 text-xs text-gray-400 tabular-nums">
                stok {o.quantity}
              </span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 px-1">
          Dipilih: {selected.item_name} · Rp{" "}
          {(selected.price || selected.buy_price || 0).toLocaleString("id-ID")}{" "}
          · stok {selected.quantity}
        </p>
      )}
    </div>
  );
}
