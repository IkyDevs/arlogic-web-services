"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Clock,
  FileText,
  Send,
  DollarSign,
  ShoppingCart,
  MapPin,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

const paymentLabels: Record<string, string> = {
  cash: "Cash / Kasir",
  qris: "QRIS",
  edc: "EDC",
  tf_bca: "TF BCA",
  tf_mandiri: "TF Mandiri",
  edc_bca: "EDC BCA",
  edc_mandiri: "EDC Mandiri",
  bri: "BRI",
  kudus: "Kudus",
};

export default function ClosingApproval() {
  const supabase = createClient();
  const { branches, activeBranchId } = useBranch();
  const [closings, setClosings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveNotes, setApproveNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState("");
  const [filterMonth, setFilterMonth] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterWeek, setFilterWeek] = useState<string>("");

  const jemberBranch = branches.find(
    (b) =>
      b.name.toLowerCase().includes("jember") ||
      b.code?.toLowerCase().includes("jember")
  );
  const kudusBranch = branches.find(
    (b) =>
      b.name.toLowerCase().includes("kudus") ||
      b.code?.toLowerCase().includes("kudus")
  );
  const leftBranch = jemberBranch || branches[0];
  const rightBranch = kudusBranch || branches[1];

  const fetchClosings = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/closing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "list",
        branch_id: activeBranchId || undefined,
      }),
    }).then((r) => r.json());
    if (res.success) setClosings(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchClosings();
  }, [activeBranchId]);

  const handleApprove = async (closing: any) => {
    const notes = approveNotes[closing.id] || "";
    setSubmitting((s) => ({ ...s, [closing.id]: true }));

    try {
      const res = await fetch("/api/admin/closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          id: closing.id,
          admin_notes: notes || null,
        }),
      }).then((r) => r.json());

      if (!res.success) throw new Error(res.error);

      toast.success("Closing disetujui! Notifikasi terkirim ke Telegram.");
      fetchClosings();
      setApproveNotes((s) => ({ ...s, [closing.id]: "" }));
      setConfirmApprove(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting((s) => ({ ...s, [closing.id]: false }));
    }
  };

  const pendingClosings = closings.filter((c) => c.status === "pending");
  const approvedClosings = closings.filter((c) => c.status === "approved");

  const toggleHistoryExpand = (id: string) => {
    setExpandedHistory(expandedHistory === id ? null : id);
  };

  const filterHistoryBySearch = (closing: any) => {
    const d = new Date(closing.closing_date);

    if (filterMonth && String(d.getMonth() + 1) !== filterMonth) return false;
    if (filterYear && String(d.getFullYear()) !== filterYear) return false;
    if (filterWeek) {
      const weekNum = Math.ceil(d.getDate() / 7);
      if (String(weekNum) !== filterWeek) return false;
    }

    if (!historySearch.trim()) return true;
    const q = historySearch.toLowerCase().trim();
    const dayNames = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];
    const monthNames = ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember"];
    const dayName = dayNames[d.getDay()];
    const dateNum = d.getDate();
    const monthName = monthNames[d.getMonth()];
    const year = d.getFullYear();

    const parts = q.split(/\s+/);
    if (parts.length === 2) {
      const dayPart = parts[0];
      const numPart = parseInt(parts[1]);
      const dayMatch = dayNames.includes(dayPart) && dayPart === dayName;
      const numMatch = !isNaN(numPart) && numPart === dateNum;
      return dayMatch && numMatch;
    }
    if (dayNames.includes(q)) {
      return q === dayName;
    }
    if (/^\d{1,2}$/.test(q)) {
      return parseInt(q) === dateNum;
    }
    if (monthNames.includes(q)) {
      return q === monthName;
    }
    if (/^\d{4}$/.test(q)) {
      return parseInt(q) === year;
    }
    if (/\d{1,2}\/\d{1,2}\/\d{4}/.test(q)) {
      const [m, dy, y] = q.split("/").map(Number);
      return d.getDate() === dy && d.getMonth() + 1 === m && d.getFullYear() === y;
    }
    const dateStr = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }).toLowerCase();
    const noteMatch = (closing.notes || "").toLowerCase().includes(q);
    return dateStr.includes(q) || noteMatch;
  };

  const filteredApproved = approvedClosings.filter(filterHistoryBySearch);

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">
            Approval Closing Harian
          </h1>
          <p className="text-sm text-slate-500">
            Review dan setujui closing dari admin
          </p>
        </div>
      </motion.div>

      {pendingClosings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
          <p className="text-sm font-medium text-gray-500">
            Semua closing sudah disetujui
          </p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-200 gap-0">
          {[leftBranch, rightBranch].map((b) => {
            if (!b) return null;
            const branchClosings = pendingClosings.filter(
              (c) => c.branch_id === b.id
            );
            return (
              <div key={b.id} className="flex-1 min-w-0 p-3">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-gray-200 shadow-sm mb-3">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    {b.name}
                  </h3>
                  <span className="ml-auto text-xs text-slate-400">
                    {branchClosings.length} pending
                  </span>
                </div>

                {branchClosings.length === 0 ? (
                  <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
                    <CheckCircle className="w-8 h-8 mx-auto mb-1 text-green-300" />
                    <p className="text-sm text-gray-400">Tidak ada pending</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {branchClosings.map((closing, i) => {
                      const detail = closing.detail || {};
                      return (
                        <motion.div
                          key={closing.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                        >
                          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-amber-500" />
                              <div>
                                <h3 className="font-bold text-slate-900 text-sm">
                                  {new Date(
                                    closing.closing_date
                                  ).toLocaleDateString("id-ID", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                  {closing.total_transactions} transaksi &middot;{" "}
                                  {new Date(
                                    closing.created_at
                                  ).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              Pending
                            </span>
                          </div>

                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                                <p className="text-[9px] text-blue-600 font-medium">
                                  Web
                                </p>
                                <p className="text-xs font-bold text-blue-700">
                                  {fmtRupiah(closing.total_expected)}
                                </p>
                              </div>
                              <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                <p className="text-[9px] text-emerald-600 font-medium">
                                  Aktual
                                </p>
                                <p className="text-xs font-bold text-emerald-700">
                                  {fmtRupiah(closing.total_actual)}
                                </p>
                              </div>
                              <div
                                className={`p-2 rounded-lg border ${
                                  closing.difference === 0
                                    ? "bg-green-50 border-green-100"
                                    : "bg-red-50 border-red-100"
                                }`}
                              >
                                <p className="text-[9px] text-slate-500 font-medium">
                                  Selisih
                                </p>
                                <p
                                  className={`text-xs font-bold ${
                                    closing.difference === 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {closing.difference === 0
                                    ? "✓"
                                    : fmtRupiah(
                                        Math.abs(closing.difference)
                                      )}
                                </p>
                              </div>
                            </div>

                            {Object.entries(detail).length > 0 && (
                              <div className="space-y-1">
                                {Object.entries(detail).map(
                                  ([method, d]: [string, any]) => (
                                    <div
                                      key={method}
                                      className="flex items-center justify-between p-1.5 bg-gray-50 rounded-lg border border-gray-200 text-[11px]"
                                    >
                                      <span className="font-medium text-gray-700 capitalize">
                                        {paymentLabels[method] || method}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-blue-600">
                                          {fmtRupiah(d.expected || 0)}
                                        </span>
                                        <span className="text-emerald-600">
                                          {fmtRupiah(d.actual || 0)}
                                        </span>
                                        <span
                                          className={
                                            d.expected === d.actual
                                              ? "text-green-600"
                                              : "text-red-600 font-semibold"
                                          }
                                        >
                                          {d.expected === d.actual
                                            ? "✓"
                                            : fmtRupiah(
                                                Math.abs(
                                                  d.expected - d.actual
                                                )
                                              )}
                                        </span>
                                      </div>
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                            {closing.notes && (
                              <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-[11px] text-gray-600">
                                <span className="font-medium text-gray-700">
                                  Catatan:{" "}
                                </span>
                                {closing.notes}
                              </div>
                            )}

                            <div className="flex gap-2 pt-1">
                              <input
                                type="text"
                                value={approveNotes[closing.id] || ""}
                                onChange={(e) =>
                                  setApproveNotes((s) => ({
                                    ...s,
                                    [closing.id]: e.target.value,
                                  }))
                                }
                                placeholder="Catatan..."
                                className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-gray-900/10"
                              />
                              <button
                                onClick={() => setConfirmApprove(closing.id)}
                                disabled={submitting[closing.id]}
                                className="flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-600 text-white font-semibold rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50 text-xs"
                              >
                                {submitting[closing.id] ? (
                                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3 h-3" />
                                )}
                                Setujui
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {approvedClosings.length > 0 && (() => {
        const uniqueYears = [...new Set(approvedClosings.map((c) => new Date(c.closing_date).getFullYear()))].sort((a, b) => b - a);
        return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Riwayat Closing</h3>
              {(filterMonth || filterYear || filterWeek || historySearch) && (
                <button
                  onClick={() => { setFilterMonth(""); setFilterYear(""); setFilterWeek(""); setHistorySearch(""); }}
                  className="text-[10px] text-slate-400 hover:text-slate-700 underline"
                >
                  Reset filter
                </button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Cari: sabtu, 19, maret..."
                  className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-900"
                />
                {historySearch && (
                  <button onClick={() => setHistorySearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3 h-3 text-slate-400" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-900"
                >
                  <option value="">Semua Bulan</option>
                  <option value="1">Januari</option>
                  <option value="2">Februari</option>
                  <option value="3">Maret</option>
                  <option value="4">April</option>
                  <option value="5">Mei</option>
                  <option value="6">Juni</option>
                  <option value="7">Juli</option>
                  <option value="8">Agustus</option>
                  <option value="9">September</option>
                  <option value="10">Oktober</option>
                  <option value="11">November</option>
                  <option value="12">Desember</option>
                </select>
                <select
                  value={filterWeek}
                  onChange={(e) => setFilterWeek(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-900"
                >
                  <option value="">Semua Minggu</option>
                  <option value="1">Minggu 1</option>
                  <option value="2">Minggu 2</option>
                  <option value="3">Minggu 3</option>
                  <option value="4">Minggu 4</option>
                  <option value="5">Minggu 5</option>
                </select>
                <select
                  value={filterYear}
                  onChange={(e) => setFilterYear(e.target.value)}
                  className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-slate-900"
                >
                  <option value="">Semua Tahun</option>
                  {uniqueYears.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
            {[leftBranch, rightBranch].map((b) => {
              if (!b) return null;
              const branchApproved = filteredApproved.filter(
                (c) => c.branch_id === b.id
              );
              return (
                <div key={b.id} className="flex-1 min-w-0 p-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 mb-3">
                    <MapPin className="w-4 h-4 text-green-500" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      {b.name}
                    </h3>
                    <span className="ml-auto text-xs text-slate-400">
                      {branchApproved.length} riwayat
                    </span>
                  </div>

                <div className="divide-y divide-slate-100 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {branchApproved.map((c) => {
                    const detail = c.detail || {};
                    const isExpanded = expandedHistory === c.id;
                    return (
                      <div key={c.id}>
                        <button
                          onClick={() => toggleHistoryExpand(c.id)}
                          className="w-full px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.15 }}
                            >
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            </motion.div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-900">
                                  {new Date(c.closing_date).toLocaleDateString(
                                    "id-ID",
                                    {
                                      weekday: "long",
                                      day: "numeric",
                                      month: "long",
                                      year: "numeric",
                                    }
                                  )}
                                </span>
                                <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                              </div>
                              <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                                <div className="text-center p-1 bg-blue-50 rounded border border-blue-100">
                                  <p className="text-[8px] text-blue-500 uppercase">Web</p>
                                  <p className="text-[10px] font-bold text-blue-700">
                                    {fmtRupiah(c.total_expected)}
                                  </p>
                                </div>
                                <div className="text-center p-1 bg-emerald-50 rounded border border-emerald-100">
                                  <p className="text-[8px] text-emerald-500 uppercase">Aktual</p>
                                  <p className="text-[10px] font-bold text-emerald-700">
                                    {fmtRupiah(c.total_actual)}
                                  </p>
                                </div>
                                <div className={`text-center p-1 rounded border ${
                                  c.difference === 0
                                    ? "bg-green-50 border-green-100"
                                    : "bg-red-50 border-red-100"
                                }`}>
                                  <p className="text-[8px] text-slate-500 uppercase">Selisih</p>
                                  <p className={`text-[10px] font-bold ${
                                    c.difference === 0 ? "text-green-600" : "text-red-600"
                                  }`}>
                                    {c.difference === 0 ? "✓" : fmtRupiah(Math.abs(c.difference))}
                                  </p>
                                </div>
                              </div>
                              {c.notes && (
                                <p className="text-[10px] text-slate-500 mt-1.5 truncate">
                                  💬 {c.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-4 pb-3 pt-1 bg-slate-50 border-t border-slate-100">
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                                    <p className="text-[9px] text-blue-600 font-medium">
                                      Web
                                    </p>
                                    <p className="text-xs font-bold text-blue-700">
                                      {fmtRupiah(c.total_expected)}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-white rounded-lg border border-emerald-100">
                                    <p className="text-[9px] text-emerald-600 font-medium">
                                      Aktual
                                    </p>
                                    <p className="text-xs font-bold text-emerald-700">
                                      {fmtRupiah(c.total_actual)}
                                    </p>
                                  </div>
                                  <div
                                    className={`p-2 rounded-lg border ${
                                      c.difference === 0
                                        ? "bg-green-50 border-green-100"
                                        : "bg-red-50 border-red-100"
                                    }`}
                                  >
                                    <p className="text-[9px] text-slate-500 font-medium">
                                      Selisih
                                    </p>
                                    <p
                                      className={`text-xs font-bold ${
                                        c.difference === 0
                                          ? "text-green-600"
                                          : "text-red-600"
                                      }`}
                                    >
                                      {c.difference === 0
                                        ? "✓"
                                        : fmtRupiah(Math.abs(c.difference))}
                                    </p>
                                  </div>
                                </div>

                                {Object.keys(detail).length > 0 && (
                                  <div className="space-y-1 mb-2">
                                    {Object.entries(detail).map(
                                      ([method, d]: [string, any]) => (
                                        <div
                                          key={method}
                                          className="flex items-center justify-between p-1.5 bg-white rounded-lg border border-slate-200 text-[10px]"
                                        >
                                          <span className="font-medium text-gray-700 capitalize">
                                            {paymentLabels[method] || method}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-blue-600">
                                              {fmtRupiah(d.expected || 0)}
                                            </span>
                                            <span className="text-emerald-600">
                                              {fmtRupiah(d.actual || 0)}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                )}

                                {c.notes && (
                                  <div className="p-1.5 bg-white rounded-lg border border-slate-200 text-[10px] text-gray-600 mb-1">
                                    <span className="font-medium">Catatan: </span>
                                    {c.notes}
                                  </div>
                                )}

                                {c.difference_notes && (
                                  <div className="p-1.5 bg-red-50 rounded-lg border border-red-200 text-[10px] text-red-600 mb-1">
                                    <span className="font-medium">Catatan Selisih: </span>
                                    {c.difference_notes}
                                  </div>
                                )}

                                <div className="text-[9px] text-slate-400 mt-1">
                                  Disetujui{" "}
                                  {c.approved_at
                                    ? new Date(c.approved_at).toLocaleDateString(
                                        "id-ID",
                                        {
                                          day: "2-digit",
                                          month: "short",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        }
                                      )
                                    : "-"}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        </div>
        );
      })()}

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {confirmApprove && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
              onClick={() => setConfirmApprove(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center z-[81] p-4"
            >
              <div
                className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">
                      Konfirmasi Approval
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pastikan data sudah benar
                    </p>
                  </div>
                </div>

                <p className="text-sm text-slate-600 mb-4">
                  Anda akan menyetujui closing ini. Notifikasi akan dikirim ke
                  Telegram admin.
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirmApprove(null)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      const closing = closings.find(
                        (c) => c.id === confirmApprove
                      );
                      if (closing) handleApprove(closing);
                    }}
                    disabled={submitting[confirmApprove]}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting[confirmApprove] ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    Ya, Setujui
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
