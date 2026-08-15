"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Search, X, Wrench, Package, CheckCircle, Check } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";

export interface ServicePickupResult {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  watch_brand?: string;
  watch_model?: string;
  final_cost: number;
  discount?: number;
  down_payment?: number;
  final_jasa_total?: number;
  final_sparepart_total?: number;
  items: Array<{ name: string; item_type: string; quantity: number; price: number }>;
}

interface Props {
  open: boolean;
  branchId?: string | null;
  alreadyLinkedIds?: string[];
  onClose: () => void;
  onSelect: (services: ServicePickupResult[]) => void;
}

export default function ServicePickupPicker({
  open,
  branchId,
  alreadyLinkedIds,
  onClose,
  onSelect,
}: Props) {
  const supabase = createClient();
  const [q, setQ] = useState("");
  const [services, setServices] = useState<ServicePickupResult[]>([]);
  const [takenIds, setTakenIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setSelected(new Set(alreadyLinkedIds || []));

    const fetchTaken = async () => {
      const { data } = await supabase
        .from("layanan")
        .select("linked_service_order_ids, linked_service_order_id")
        .eq("jenis_layanan", "ambil_jam_service");
      const ids = new Set<string>();
      for (const r of data || []) {
        if (Array.isArray((r as any).linked_service_order_ids)) {
          for (const id of (r as any).linked_service_order_ids) ids.add(id);
        }
        if ((r as any).linked_service_order_id) ids.add((r as any).linked_service_order_id);
      }
      setTakenIds(ids);
    };
    fetchTaken();

    const fetchServices = async () => {
      setLoading(true);
      let query = supabase
        .from("service_orders")
        .select("*, service_items(*)")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(50);
      if (branchId) query = query.eq("branch_id", branchId);
      const { data } = await query;
      if (data) {
        setServices(
          data.map((s: any): ServicePickupResult => ({
            id: s.id,
            invoice_number: s.invoice_number,
            customer_name: s.customer_name,
            customer_phone: s.customer_phone,
            watch_brand: s.watch_brand || s.device_brand,
            watch_model: s.watch_model || s.device_model,
            final_cost: s.final_cost || 0,
            discount: s.discount,
            down_payment: s.down_payment || 0,
            final_jasa_total: s.final_jasa_total,
            final_sparepart_total: s.final_sparepart_total,
            items: (s.service_items || [])
              .filter((i: any) => i.is_final)
              .map((i: any) => ({
                name: i.name,
                item_type: i.item_type,
                quantity: i.quantity || 1,
                price: i.price || 0,
              })),
          })),
        );
      }
      setLoading(false);
    };
    fetchServices();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, branchId, supabase]);

  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (q.trim().length < 2) return;
      setLoading(true);
      let query = supabase
        .from("service_orders")
        .select("*, service_items(*)")
        .eq("status", "completed")
        .or(`customer_name.ilike.%${q.trim()}%,customer_phone.ilike.%${q.trim()}%`)
        .order("completed_at", { ascending: false })
        .limit(50);
      if (branchId) query = query.eq("branch_id", branchId);
      const { data } = await query;
      if (data) {
        setServices(
          data.map((s: any): ServicePickupResult => ({
            id: s.id,
            invoice_number: s.invoice_number,
            customer_name: s.customer_name,
            customer_phone: s.customer_phone,
            watch_brand: s.watch_brand || s.device_brand,
            watch_model: s.watch_model || s.device_model,
            final_cost: s.final_cost || 0,
            discount: s.discount,
            down_payment: s.down_payment || 0,
            final_jasa_total: s.final_jasa_total,
            final_sparepart_total: s.final_sparepart_total,
            items: (s.service_items || [])
              .filter((i: any) => i.is_final)
              .map((i: any) => ({
                name: i.name,
                item_type: i.item_type,
                quantity: i.quantity || 1,
                price: i.price || 0,
              })),
          })),
        );
      }
      setLoading(false);
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open, branchId, supabase]);

  const results = useMemo(
    () => services.filter((s) => !takenIds.has(s.id)),
    [services, takenIds],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const confirm = () => {
    const picked = results.filter((s) => selected.has(s.id));
    if (picked.length === 0) return;
    onSelect(picked);
    setSelected(new Set());
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-3 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pickupPickerTitle"
    >
      <div
        className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-white/10 max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 id="pickupPickerTitle" className="text-base font-bold text-gray-900 dark:text-gray-100">
              Pilih Service Selesai
            </h3>
            <p className="text-xs text-gray-500">
              Bisa pilih 1 atau banyak service (centang)
            </p>
          </div>
          <button onClick={onClose} aria-label="Tutup" className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama / no. HP customer..."
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
          {loading && results.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Memuat...</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {q.trim().length >= 2 ? "Tidak ada service yang cocok" : "Belum ada service selesai"}
            </p>
          ) : (
            results.map((s) => {
              const jasaTotal = s.final_jasa_total || 0;
              const spTotal = s.final_sparepart_total || 0;
              const isSelected = selected.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className={`w-full text-left bg-gray-50 dark:bg-white/5 border rounded-xl p-3.5 transition-all ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-500/20"
                      : "border-gray-200 dark:border-white/10 hover:border-blue-400"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">
                          {s.invoice_number}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Selesai QC
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1.5">
                        {s.customer_name || "-"}
                        {s.customer_phone && (
                          <span className="text-xs font-normal text-gray-400 ml-2">{s.customer_phone}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {s.watch_brand || "-"}
                        {s.watch_model ? ` ${s.watch_model}` : ""}
                      </p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                        isSelected ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-white/30"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </div>
                  </div>

                  {s.items.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {s.items.map((it, i) => (
                        <p key={i} className="text-[11px] text-gray-600 dark:text-gray-300 flex justify-between">
                          <span className="flex items-center gap-1 truncate">
                            {it.item_type === "sparepart" ? (
                              <Package className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            ) : (
                              <Wrench className="w-3 h-3 text-blue-500 flex-shrink-0" />
                            )}
                            <span className="truncate">
                              {it.name} {it.quantity > 1 ? `×${it.quantity}` : ""}
                            </span>
                          </span>
                          <span className="flex-shrink-0">{formatRupiah((it.price || 0) * it.quantity)}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-white/10 flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      Jasa {formatRupiah(jasaTotal)} · Sparepart {formatRupiah(spTotal)}
                      {s.discount ? ` · Diskon ${formatRupiah(s.discount)}` : ""}
                    </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {formatRupiah(s.final_cost)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 sm:px-5 py-2.5 border-t border-gray-200 dark:border-white/10 flex items-center justify-between gap-3">
          <p className="text-[10px] text-gray-400">
            {results.length} tersedia · sudah diambil tersembunyi
          </p>
          <button
            onClick={confirm}
            disabled={selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            Pilih ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
