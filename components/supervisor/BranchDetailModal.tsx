"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Wrench, ClipboardCheck, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import { STATUS_META, countStatus } from "./BranchStatsCard";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  assigned: "Diambil",
  in_progress: "Digarap",
  waiting_sparepart: "Tunggu Sparepart",
  sparepart_ready: "Sparepart Siap",
  qc_pending: "QC Pending",
  revision_required: "Revisi",
  completed: "Selesai",
  cancelled: "Batal",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
  assigned: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400",
  waiting_sparepart: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  sparepart_ready: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  qc_pending: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  revision_required: "bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400",
  completed: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

interface BranchDetailModalProps {
  branch: { id: string; name: string; code?: string };
  revenue: number;
  transactions: number;
  expenses: number;
  status: Record<string, number>;
  teknisi: Array<{ name: string; active: number }>;
  onClose: () => void;
}

export default function BranchDetailModal({
  branch,
  revenue,
  transactions,
  expenses,
  status,
  teknisi,
  onClose,
}: BranchDetailModalProps) {
  const supabase = createClient();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchRecent = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("service_orders")
        .select("*, profiles:assigned_teknisi_id(full_name)")
        .eq("branch_id", branch.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled) {
        setServices(data || []);
        setLoading(false);
      }
    };
    fetchRecent();
    return () => {
      cancelled = true;
    };
  }, [branch.id, supabase]);

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="branchDetailTitle"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-white/10 max-h-[85vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-[#1c1c1c]">
            <div>
              <h3 id="branchDetailTitle" className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Detail {branch.name}{" "}
                {branch.code && (
                  <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500 align-middle">
                    {branch.code}
                  </span>
                )}
              </h3>
              <p className="text-xs text-gray-500">Monitor seluruh data cabang ini</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close details"
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">{formatRupiah(revenue)}</p>
                <p className="text-[10px] text-gray-500 mt-1">Pendapatan</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">{transactions}</p>
                <p className="text-[10px] text-gray-500 mt-1">Transaksi</p>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                <p className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 truncate">{formatRupiah(expenses)}</p>
                <p className="text-[10px] text-gray-500 mt-1">Pengeluaran</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Service per Status</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {STATUS_META.map((s) => {
                  const n = countStatus(status, s.match);
                  return (
                    <div key={s.key} className={`rounded-lg px-3 py-2 flex justify-between items-center ${s.cls}`}>
                      <span className="text-xs font-semibold">{s.label}</span>
                      <span className="text-sm font-bold">{n}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Wrench className="w-3.5 h-3.5" /> Beban Kerja Teknisi
              </p>
              {teknisi.length === 0 ? (
                <p className="text-sm text-gray-400">Belum ada teknisi di cabang ini</p>
              ) : (
                <div className="space-y-1.5">
                  {teknisi.map((t) => (
                    <div key={t.name} className="flex items-center justify-between text-sm bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-gray-700 dark:text-gray-200 truncate">{t.name}</span>
                      <span className={`font-semibold flex-shrink-0 ${t.active > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>
                        {t.active} service aktif
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ClipboardCheck className="w-3.5 h-3.5" /> Service Terbaru
              </p>
              {loading ? (
                <p className="text-sm text-gray-400 animate-pulse flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Memuat...
                </p>
              ) : services.length === 0 ? (
                <p className="text-sm text-gray-400">Belum ada service</p>
              ) : (
                <div className="space-y-1.5">
                  {services.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 text-sm bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-gray-500">{s.invoice_number}</p>
                        <p className="text-gray-700 dark:text-gray-200 truncate">{s.customer_name}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_BADGE[s.status] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABEL[s.status] || s.status}
                        </span>
                        <span className="text-[10px] text-gray-400">{s.profiles?.full_name || "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}