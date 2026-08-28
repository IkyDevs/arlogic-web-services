"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, DollarSign } from "lucide-react";
import {
  searchStoreStock,
  type StoreStockOption,
} from "@/lib/domain/inventory/service";

interface SparepartPickerProps {
  branchId: string | null | undefined;
  itemClass?: "sparepart" | "jam";
  skuValue: string;
  nominalValue: number | string;
  onChange: (sku: string, nominal: number, inventoryId: string | null) => void;
  placeholder?: string;
  className?: string;
  accentCls?: string;
}

export default function SparepartPicker({
  branchId,
  itemClass = "sparepart",
  skuValue,
  nominalValue,
  onChange,
  placeholder = "Cari sparepart (nama / SKU)...",
  className = "",
  accentCls = "",
}: SparepartPickerProps) {
  const supabase = createClient();
  const [options, setOptions] = useState<StoreStockOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!branchId) return;
    let alive = true;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchStoreStock(supabase, {
          branchId,
          itemClass,
          query: skuValue,
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
  }, [branchId, skuValue]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const matches = useMemo(() => {
    const q = skuValue.trim().toLowerCase();
    if (!q) return options.slice(0, 20);
    return options.filter((o) =>
      o.item_name.toLowerCase().includes(q) ||
      (o.sku && o.sku.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [options, skuValue]);

  return (
    <div
      className={`flex flex-col md:flex-row items-start md:items-center gap-2 w-full ${className}`}
      ref={wrapRef}
    >
      <div className="relative w-full md:flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={skuValue}
          onChange={(e) => {
            onChange(e.target.value, Number(nominalValue) || 0, null);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={`w-full pl-7 pr-2 py-2 border rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 ${
            accentCls ||
            "border-emerald-200 dark:border-emerald-800 focus:ring-emerald-500/20"
          }`}
        />
        {open && (
          <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl max-h-56 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-2 text-xs text-gray-400">Memuat stok...</p>
            ) : matches.length === 0 ? null : (
              matches.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => {
                    onChange(o.sku || o.item_name, o.price || o.buy_price || 0, o.id);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {o.item_name}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 flex-shrink-0">
                    stok {o.quantity}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <div className="relative w-full md:w-32">
        <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={nominalValue || ""}
          onChange={(e) =>
            onChange(
              skuValue,
              parseInt(e.target.value.replace(/\D/g, "")) || 0,
              null
            )
          }
          placeholder="Nominal"
          className="w-full pl-7 pr-2 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>
    </div>
  );
}
