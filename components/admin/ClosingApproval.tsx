"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { CheckCircle, Clock, FileText, Send, DollarSign, ShoppingCart } from "lucide-react";
import toast from "react-hot-toast";

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function ClosingApproval() {
  const supabase = createClient();
  const [closings, setClosings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveNotes, setApproveNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

  const fetchClosings = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/closing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "list" }),
    }).then((r) => r.json());
    if (res.success) setClosings(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchClosings(); }, []);

  const handleApprove = async (closing: any) => {
    const notes = approveNotes[closing.id] || "";
    setSubmitting((s) => ({ ...s, [closing.id]: true }));

    try {
      // Approve via API (bypass RLS with service_role)
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
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting((s) => ({ ...s, [closing.id]: false }));
    }
  };

  const pendingClosings = closings.filter((c) => c.status === "pending");
  const approvedClosings = closings.filter((c) => c.status === "approved");

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Approval Closing Harian</h1>
          <p className="text-sm text-slate-500">Review dan setujui closing dari admin</p>
        </div>
      </motion.div>

      {/* Pending Closings */}
      {pendingClosings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-400" />
          <p className="text-sm font-medium text-gray-500">Semua closing sudah disetujui</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingClosings.map((closing, i) => {
            const detail = closing.detail || {};
            return (
              <motion.div key={closing.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <div>
                      <h3 className="font-bold text-slate-900">
                        Closing {new Date(closing.closing_date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {closing.total_transactions} transaksi &middot; Diajukan {new Date(closing.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-700 border border-amber-200">Pending</span>
                </div>

                <div className="p-5 space-y-3">
                  {/* Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-600 font-medium">Total Web</p>
                      <p className="text-sm font-bold text-blue-700">{fmtRupiah(closing.total_expected)}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-[10px] text-emerald-600 font-medium">Total Aktual</p>
                      <p className="text-sm font-bold text-emerald-700">{fmtRupiah(closing.total_actual)}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <p className="text-[10px] text-slate-500 font-medium">Selisih</p>
                      <p className={`text-sm font-bold ${closing.difference === 0 ? "text-green-600" : "text-red-600"}`}>
                        {closing.difference === 0 ? "✓ MATCH" : fmtRupiah(Math.abs(closing.difference))}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                      <p className="text-[10px] text-purple-600 font-medium">Transaksi</p>
                      <p className="text-sm font-bold text-purple-700">{closing.total_transactions}</p>
                    </div>
                  </div>

                  {/* Detail per method */}
                  <div className="space-y-1">
                    {Object.entries(detail).map(([method, d]: [string, any]) => (
                      <div key={method} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm">
                        <span className="font-medium text-gray-700 capitalize">{method}</span>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-blue-600">Web: {fmtRupiah(d.expected || 0)}</span>
                          <span className="text-emerald-600">Aktual: {fmtRupiah(d.actual || 0)}</span>
                          <span className={d.expected === d.actual ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                            {d.expected === d.actual ? "✓" : fmtRupiah(Math.abs(d.expected - d.actual))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {closing.notes && (
                    <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
                      <span className="font-medium text-gray-700">Catatan Admin: </span>{closing.notes}
                    </div>
                  )}

                  {/* Approve: notes + button */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <input type="text"
                      value={approveNotes[closing.id] || ""}
                      onChange={(e) => setApproveNotes((s) => ({ ...s, [closing.id]: e.target.value }))}
                      placeholder="Catatan approval (opsional)..."
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
                    <button onClick={() => handleApprove(closing)} disabled={submitting[closing.id]}
                      className="flex items-center justify-center gap-2 px-5 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 text-sm">
                      {submitting[closing.id] ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Setujui & Kirim ke Telegram
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Approved History */}
      {approvedClosings.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-sm font-bold text-slate-900">Riwayat Closing Disetujui</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Tanggal</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase">Web</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold text-slate-500 uppercase">Aktual</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvedClosings.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-sm text-slate-900">{new Date(c.closing_date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">{fmtRupiah(c.total_expected)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">{fmtRupiah(c.total_actual)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700 border border-green-200">
                        <CheckCircle className="w-3 h-3" /> Disetujui
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
