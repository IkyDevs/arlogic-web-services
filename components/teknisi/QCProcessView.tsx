"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useBranch } from "@/lib/context/BranchContext";
import { motion } from "framer-motion";
import {
  ClipboardCheck, RefreshCw, User, Phone, Clock, CheckCircle2,
  XCircle, Undo2, Wallet, Wrench, Plus, Trash2,
} from "lucide-react";

interface QcTimeline {
  service_order_id: string;
  status: string;
  message: string | null;
  created_at: string;
}

interface ServiceItem {
  id: string;
  service_order_id: string;
  item_type: string;
  name: string;
  quantity: number;
  price: number;
  is_final: boolean | null;
}

interface QcService {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  watch_brand: string;
  watch_model: string;
  final_cost: number;
  estimated_cost: number;
  qc_submit_notes: string | null;
  created_at: string;
  timeline?: QcTimeline[];
  items?: ServiceItem[];
}

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n || 0);
}

function fmtTime(d: string) {
  return new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const QC_EVENTS = ["qc_pending", "completed", "revision_required", "qc_pulled_back", "item_updated", "item_added", "item_deleted"];

export default function QCProcessView() {
  const { user } = useAuthStore();
  const { activeBranch } = useBranch();
  const supabase = createClient();
  const [services, setServices] = useState<QcService[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      // Service teknisi yang pernah masuk QC
      let q = supabase
        .from("service_orders")
        .select("*")
        .eq("assigned_teknisi_id", user.id)
        .in("status", ["qc_pending", "revision_required", "completed"])
        .order("created_at", { ascending: false });
      if ((activeBranch)?.id) q = q.eq("branch_id", activeBranch?.id);
      const { data } = await q.limit(100);

      const rows = (data as QcService[]) || [];

      // Ambil timeline QC + item untuk tiap service
      if (rows.length > 0) {
        const ids = rows.map((s) => s.id);
        const [timelineRes, itemsRes] = await Promise.all([
          supabase
            .from("service_timeline")
            .select("service_order_id, status, message, created_at")
            .in("service_order_id", ids)
            .in("status", QC_EVENTS)
            .order("created_at", { ascending: false }),
          supabase
            .from("service_items")
            .select("id, service_order_id, item_type, name, quantity, price, is_final")
            .in("service_order_id", ids),
        ]);

        const timelineMap: Record<string, QcTimeline[]> = {};
        for (const t of (timelineRes.data as QcTimeline[]) || []) {
          const key = t.service_order_id;
          if (!timelineMap[key]) timelineMap[key] = [];
          timelineMap[key].push(t);
        }

        const itemsMap: Record<string, ServiceItem[]> = {};
        for (const it of (itemsRes.data as ServiceItem[]) || []) {
          const key = it.service_order_id;
          if (!itemsMap[key]) itemsMap[key] = [];
          itemsMap[key].push(it);
        }

        setServices(rows.map((s) => ({ ...s, timeline: timelineMap[s.id] || [], items: itemsMap[s.id] || [] })));
      } else {
        setServices([]);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase, activeBranch]);

  useEffect(() => { const t = setTimeout(fetchData, 0); return () => clearTimeout(t); }, [fetchData]);

  const statusBadge = (s: string) => {
    if (s === "qc_pending") return { label: "QC Process", cls: "bg-purple-100 text-purple-700 border-purple-300", icon: <Clock className="w-3 h-3" /> };
    if (s === "revision_required") return { label: "Revisi", cls: "bg-red-100 text-red-700 border-red-300", icon: <XCircle className="w-3 h-3" /> };
    if (s === "completed") return { label: "Approved", cls: "bg-emerald-100 text-emerald-700 border-emerald-300", icon: <CheckCircle2 className="w-3 h-3" /> };
    return { label: s, cls: "bg-gray-100 text-gray-600 border-gray-300", icon: <Clock className="w-3 h-3" /> };
  };

  const timelineLabel = (s: string) => {
    if (s === "qc_pending") return { text: "Submit QC", icon: <ClipboardCheck className="w-3 h-3 text-purple-500" /> };
    if (s === "completed") return { text: "Approved QC", icon: <CheckCircle2 className="w-3 h-3 text-emerald-500" /> };
    if (s === "revision_required") return { text: "Rejected / Revisi", icon: <XCircle className="w-3 h-3 text-red-500" /> };
    if (s === "qc_pulled_back") return { text: "Tarik Kembali", icon: <Undo2 className="w-3 h-3 text-orange-500" /> };
    return { text: s, icon: <Clock className="w-3 h-3 text-gray-400" /> };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">QC Process</h3>
          <p className="text-xs text-gray-500">Pantau hasil submit QC service Anda</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-600 hover:text-gray-900"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Memuat...</p>}

      {!loading && services.length === 0 && (
        <div className="text-center py-14 text-gray-400">
          <ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
          Belum ada service yang masuk QC
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {services.map((svc, i) => {
          const badge = statusBadge(svc.status);
          return (
            <motion.div
              key={svc.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                    {svc.invoice_number || "No Invoice"}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
                    <Wrench className="w-3 h-3" />
                    <span>{svc.watch_brand || "-"} {svc.watch_model || ""}</span>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${badge.cls}`}>
                  {badge.icon} {badge.label}
                </span>
              </div>

              {/* Customer */}
              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex items-center gap-1.5">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="font-medium">{svc.customer_name}</span>
                </div>
                {svc.customer_phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-gray-400" />
                    <span>{svc.customer_phone}</span>
                  </div>
                )}
              </div>

              {/* Riwayat QC */}
              {svc.timeline && svc.timeline.length > 0 && (
                <div className="border-t border-gray-100 dark:border-white/5 pt-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Riwayat QC</p>
                  <div className="space-y-1">
                    {svc.timeline.slice(0, 4).map((t, ti) => {
                      const tl = timelineLabel(t.status);
                      return (
                        <div key={ti} className="flex items-center gap-1.5 text-[11px]">
                          {tl.icon}
                          <span className="text-gray-600 dark:text-gray-300">{tl.text}</span>
                          <span className="ml-auto text-[10px] text-gray-400">{fmtTime(t.created_at)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Catatan submit */}
              {svc.qc_submit_notes && (
                <p className="text-[11px] text-gray-500 bg-gray-50 dark:bg-white/5 rounded-lg p-2">
                  {svc.qc_submit_notes}
                </p>
              )}

              {/* Rincian Item */}
              {svc.items && svc.items.length > 0 && (
                <div className="border-t border-gray-100 dark:border-white/5 pt-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Rincian Item</p>
                  <div className="space-y-1.5">
                    {(["jasa", "sparepart"] as const).map((type) => {
                      const typeItems = svc.items!.filter((it) => it.item_type === type);
                      if (typeItems.length === 0) return null;
                      return (
                        <div key={type}>
                          <p className="text-[10px] text-gray-400 mb-0.5 uppercase">{type === "jasa" ? "Jasa" : "Sparepart"}</p>
                          {typeItems.map((it) => (
                            <div key={it.id} className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-gray-700 dark:text-gray-200 truncate">{it.name}</span>
                                <span className="text-gray-400">x{it.quantity}</span>
                                {it.is_final === true && (
                                  <span className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[8px] font-semibold bg-emerald-50 text-emerald-600 border border-emerald-200 flex-shrink-0">
                                    <CheckCircle2 className="w-2 h-2" /> QC
                                  </span>
                                )}
                              </div>
                              <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">{fmtRupiah(it.price * it.quantity)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Revisi QC */}
              {svc.timeline && svc.timeline.some((t) => t.status.startsWith("item_")) && (
                <div className="border-t border-gray-100 dark:border-white/5 pt-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Revisi QC</p>
                  <div className="space-y-1">
                    {svc.timeline
                      .filter((t) => t.status.startsWith("item_"))
                      .slice(0, 4)
                      .map((t, ti) => {
                        const icon = t.status === "item_added"
                          ? <Plus className="w-3 h-3 text-blue-500" />
                          : t.status === "item_deleted"
                            ? <Trash2 className="w-3 h-3 text-red-500" />
                            : <RefreshCw className="w-3 h-3 text-amber-500" />;
                        const text = t.status === "item_added" ? "Item ditambah QC" : t.status === "item_deleted" ? "Item dihapus QC" : "Item diubah QC";
                        return (
                          <div key={ti} className="flex items-start gap-1.5 text-[11px]">
                            <span className="mt-0.5 flex-shrink-0">{icon}</span>
                            <span className="text-gray-600 dark:text-gray-300 min-w-0">
                              <span className="font-medium">{text}</span>
                              {t.message && <span className="text-gray-400 block truncate">{t.message}</span>}
                            </span>
                            <span className="ml-auto text-[10px] text-gray-400 flex-shrink-0">{fmtTime(t.created_at)}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                  {svc.status === "completed" ? "Total (Approved QC)" : "Total Estimasi"}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1">
                  <Wallet className="w-3.5 h-3.5 text-gray-400" />
                  {fmtRupiah(svc.status === "completed" ? svc.final_cost || 0 : svc.estimated_cost || 0)}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
