"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { DollarSign, Search } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";

interface CatalogItem {
  name: string;
  price: number;
}

// Cache katalog per session (5 menit) — hindari fetch ulang tiap buka form
let catalogCache: { items: CatalogItem[]; at: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000;

interface ServiceCatalogPickerProps {
  skuValue: string;
  nominalValue: number | string;
  onChange: (sku: string, nominal: number) => void;
}

export default function ServiceCatalogPicker({
  skuValue,
  nominalValue,
  onChange,
}: ServiceCatalogPickerProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = catalogCache;
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setItems(cached.items);
      return;
    }
    createClient()
      .from("service_items")
      .select("name, price")
      .eq("item_type", "jasa")
      .is("service_order_id", null)
      .order("name")
      .then(({ data }) => {
        const rows = (data || []) as CatalogItem[];
        catalogCache = { items: rows, at: Date.now() };
        setItems(rows);
      });
  }, []);

  // Tutup dropdown kalau klik di luar
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
    if (!q) return items.slice(0, 20);
    return items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 20);
  }, [items, skuValue]);

  return (
    <div
      className="flex flex-col md:flex-row items-start md:items-center gap-2 w-full"
      ref={wrapRef}
    >
      <div className="relative w-full md:flex-1">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="text"
          value={skuValue}
          onChange={(e) => {
            onChange(e.target.value, Number(nominalValue) || 0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Cari jasa di katalog..."
          className="w-full pl-7 pr-2 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
        {open && (
          <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl max-h-56 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">
                Tidak ditemukan di katalog — ketik manual
              </p>
            ) : (
              matches.map((m) => (
                <button
                  key={m.name + "-" + m.price}
                  type="button"
                  onClick={() => {
                    onChange(m.name, m.price);
                    setOpen(false);
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                    {m.name}
                  </span>
                  <span className="text-xs font-semibold text-gray-500 flex-shrink-0">
                    {formatRupiah(m.price)}
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
            )
          }
          placeholder="Nominal"
          className="w-full pl-7 pr-2 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
        />
      </div>
    </div>
  );
}
