"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { DollarSign, CheckCircle, XCircle, Clock, Send, FileText, Wallet, Banknote, Phone, CreditCard, TrendingUp, ShoppingCart, UserCheck, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

const paymentLabels: Record<string, string> = {
  cash: "Cash / Kasir", qris: "QRIS", tf_bca: "TF BCA", tf_mandiri: "TF Mandiri",
  edc_bca: "EDC BCA", edc_mandiri: "EDC Mandiri", bri: "BRI", kudus: "Kudus",
};

const paymentIcons: Record<string, any> = {
  cash: Banknote, qris: Wallet, tf_bca: Phone, tf_mandiri: Phone,
  edc_bca: CreditCard, edc_mandiri: CreditCard, bri: Banknote, kudus: Wallet,
};

export default function ClosingDashboard() {
  const supabase = createClient();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actualAmounts, setActualAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [differenceNotes, setDifferenceNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingClosing, setExistingClosing] = useState<any>(null);
  const [closings, setClosings] = useState<any[]>([]);

  const fetchData = async () => {
    setLoading(true);
    const [txRes, apiRes] = await Promise.all([
      supabase.from("layanan").select("*").gte("created_at", date + "T00:00:00").lte("created_at", date + "T23:59:59").order("created_at"),
      fetch("/api/admin/closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      }).then((r) => r.json()),
    ]);
    if (txRes.data) setTransactions(txRes.data);
    if (apiRes.success) {
      const dayClosings = apiRes.data.filter((c: any) => c.closing_date === date);
      if (dayClosings.length > 0) setExistingClosing(dayClosings[0]);
      setClosings(apiRes.data);
    }
    setLoading(false);
  };

  const fetchClosings = async () => {
    const res = await fetch("/api/admin/closing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    }).then((r) => r.json());
    if (res.success) setClosings(res.data);
  };

  useEffect(() => { fetchData(); fetchClosings(); }, [date]);

  // Group by payment method
  const paymentGroups = useMemo(() => {
    const groups: Record<string, { expected: number; count: number; items: any[] }> = {};
    for (const tx of transactions) {
      const m = tx.metode_pembayaran || "unknown";
      if (!groups[m]) groups[m] = { expected: 0, count: 0, items: [] };
      groups[m].expected += tx.nominal || 0;
      groups[m].count++;
      groups[m].items.push(tx);
    }
    return groups;
  }, [transactions]);

  const totalExpected = useMemo(() =>
    Object.values(paymentGroups).reduce((s, g) => s + g.expected, 0),
  [paymentGroups]);

  const totalActual = useMemo(() =>
    Object.entries(actualAmounts).reduce((s, [k, v]) => s + (parseInt(v) || 0), 0),
  [actualAmounts]);

  const difference = totalExpected - totalActual;

  const isAllFilled = Object.keys(paymentGroups).every((m) => actualAmounts[m] && actualAmounts[m].trim() !== "");
  const isMatch = difference === 0;

  const handleSubmit = async () => {
    if (!isAllFilled) { toast.error("Isi semua jumlah aktual terlebih dahulu"); return; }
    setSubmitting(true);
    try {
      const detail: Record<string, { expected: number; actual: number }> = {};
      for (const [method, group] of Object.entries(paymentGroups)) {
        detail[method] = { expected: group.expected, actual: parseInt(actualAmounts[method]) || 0 };
      }

      const res = await fetch("/api/admin/closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: {
            closing_date: date,
            total_transactions: transactions.length,
            total_expected: totalExpected,
            total_actual: totalActual,
            difference: difference,
            detail: detail,
            notes: notes || null,
            difference_notes: differenceNotes || null,
            status: "pending",
            created_by: (await supabase.auth.getUser()).data.user?.id,
          },
        }),
      }).then((r) => r.json());

      if (!res.success) throw new Error(res.error);
      toast.success("Closing berhasil dikirim ke Owner untuk approval!");
      fetchData();
      fetchClosings();
      setNotes("");
      setDifferenceNotes("");
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; color: string; icon: any }> = {
      pending: { label: "Pending", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
      approved: { label: "Disetujui", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
      rejected: { label: "Ditolak", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
    };
    return map[status] || map.pending;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Closing Harian</h1>
            <p className="text-sm text-slate-500">Cross-check transaksi web dengan kasir</p>
          </div>
        </div>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total Transaksi</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{transactions.length}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total Web</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{fmtRupiah(totalExpected)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Total Aktual</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{fmtRupiah(totalActual)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className={`rounded-xl p-4 border shadow-sm ${difference === 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Selisih</p>
          <p className={`text-xl font-bold mt-1 ${difference === 0 ? "text-green-600" : "text-red-600"}`}>
            {difference === 0 ? "✓ MATCH" : fmtRupiah(Math.abs(difference)) + (difference > 0 ? " (Kurang)" : " (Lebih)")}
          </p>
        </motion.div>
      </div>

      {/* Payment Method Breakdown */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Rincian per Pembayaran</h3>
          <p className="text-xs text-slate-400 mt-0.5">Masukkan jumlah aktual sesuai kasir / merchant</p>
        </div>
        <div className="divide-y divide-slate-100">
          {Object.keys(paymentGroups).length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tidak ada transaksi pada tanggal ini</p>
            </div>
          ) : Object.entries(paymentGroups).sort(([, a], [, b]) => b.expected - a.expected).map(([method, group], i) => {
            const Icon = paymentIcons[method] || DollarSign;
            const expectedVal = group.expected;
            const actualVal = parseInt(actualAmounts[method]) || 0;
            const diff = expectedVal - actualVal;

            return (
              <motion.div key={method} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2.5 sm:w-48 flex-shrink-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-slate-100">
                    <Icon className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{paymentLabels[method] || method}</p>
                    <p className="text-xs text-slate-400">{group.count} transaksi</p>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <p className="text-[10px] text-blue-600 font-medium">Web</p>
                    <p className="text-sm font-bold text-blue-700">{fmtRupiah(expectedVal)}</p>
                  </div>
                  <div className={`p-2 rounded-lg border ${diff === 0 ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
                    <p className="text-[10px] text-slate-500 font-medium">Aktual</p>
                    <input type="number" value={actualAmounts[method] || ""} onChange={(e) => setActualAmounts({ ...actualAmounts, [method]: e.target.value })}
                      placeholder="0" className="w-full bg-transparent text-sm font-bold text-slate-900 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-[10px] text-slate-500 font-medium">Selisih</p>
                    <p className={`text-sm font-bold ${diff === 0 ? "text-green-600" : "text-red-600"}`}>
                      {actualAmounts[method] ? (diff === 0 ? "✓" : fmtRupiah(diff)) : "—"}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {Object.keys(paymentGroups).length > 0 && (
            <div className="px-5 py-4 bg-gray-50 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="sm:w-48 flex-shrink-0">
                <p className="text-sm font-bold text-slate-900">TOTAL</p>
                <p className="text-xs text-slate-400">{transactions.length} transaksi</p>
              </div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2 bg-blue-100 rounded-lg border border-blue-200">
                  <p className="text-sm font-bold text-blue-800">{fmtRupiah(totalExpected)}</p>
                </div>
                <div className={`p-2 rounded-lg border ${isMatch ? "bg-emerald-100 border-emerald-200" : "bg-amber-100 border-amber-200"}`}>
                  <p className="text-sm font-bold">{fmtRupiah(totalActual)}</p>
                </div>
                <div className="p-2 bg-slate-200 rounded-lg border border-slate-300">
                  <p className={`text-sm font-bold ${isMatch ? "text-green-700" : "text-red-700"}`}>
                    {isMatch ? "✓ MATCH" : fmtRupiah(Math.abs(difference)) + (difference > 0 ? " Kurang" : " Lebih")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Notes + Submit */}
      {Object.keys(paymentGroups).length > 0 && !existingClosing && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          {/* Difference notes — wajib jika ada selisih */}
          {!isMatch && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h4 className="text-sm font-bold text-red-700">Ada Selisih {fmtRupiah(Math.abs(difference))}</h4>
              </div>
              <p className="text-xs text-red-600 mb-2">Jelaskan penyebab selisih ini. Catatan ini akan dikirim ke Owner.</p>
              <textarea value={differenceNotes} onChange={(e) => setDifferenceNotes(e.target.value)}
                placeholder="Contoh: Rp 10.000 kurang karena ada biaya admin bank..."
                rows={2}
                className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none" />
              {!differenceNotes.trim() && (
                <p className="text-[10px] text-red-400 mt-1">*Wajib diisi sebelum kirim ke Owner</p>
              )}
            </div>
          )}

          <div className="mb-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Tambahan (opsional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan untuk owner..." rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
          </div>
          <button onClick={handleSubmit} disabled={submitting || !isAllFilled || (!isMatch && !differenceNotes.trim())}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 text-sm">
            {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            Kirim ke Owner untuk Approval
          </button>
        </motion.div>
      )}

      {/* Existing Closing Status */}
      {existingClosing && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl border p-5 shadow-sm ${existingClosing.status === "approved" ? "bg-green-50 border-green-200" : existingClosing.status === "rejected" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              {existingClosing.status === "approved" ? <CheckCircle className="w-5 h-5 text-green-600" /> : existingClosing.status === "rejected" ? <XCircle className="w-5 h-5 text-red-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
              <div>
                <p className="font-bold text-slate-900">
                  Closing {existingClosing.status === "approved" ? "Disetujui" : existingClosing.status === "rejected" ? "Ditolak" : "Menunggu Approval"}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(existingClosing.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
            <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${getStatusBadge(existingClosing.status).color}`}>
              {getStatusBadge(existingClosing.status).label}
            </span>
          </div>
          {existingClosing.admin_notes && <p className="text-sm text-slate-600 bg-white/50 rounded-lg p-2">Catatan: {existingClosing.admin_notes}</p>}
          {existingClosing.rejection_reason && <p className="text-sm text-red-600 bg-white/50 rounded-lg p-2 mt-1">Alasan ditolak: {existingClosing.rejection_reason}</p>}
        </motion.div>
      )}

      {/* Riwayat Closing */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Riwayat Closing</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Tanggal</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase">Web</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase">Aktual</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase">Selisih</th>
                <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {closings.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Belum ada riwayat closing</td></tr>
              ) : closings.map((c, i) => {
                const badge = getStatusBadge(c.status);
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-sm text-slate-900">{new Date(c.closing_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-900">{fmtRupiah(c.total_expected)}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium text-slate-900">{fmtRupiah(c.total_actual)}</td>
                    <td className={`px-4 py-2.5 text-right text-sm font-bold ${c.difference === 0 ? "text-green-600" : "text-red-600"}`}>{c.difference === 0 ? "✓" : fmtRupiah(Math.abs(c.difference))}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${badge.color}`}>
                        <badge.icon className="w-3 h-3" />{badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
