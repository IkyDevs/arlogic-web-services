"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Search, Eye, ArrowRight, ExternalLink } from "lucide-react";

export default function TrackingVisits() {
  const supabase = createClient();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tracking_logs")
      .select("*, service_orders!inner(customer_name, invoice_number, token)")
      .order("visited_at", { ascending: false })
      .limit(100);
    if (data) setLogs(data);
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
          <Eye className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-gray-100">Tracking Visits</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400">Riwayat kunjungan halaman tracking</p>
        </div>
        <button onClick={fetchLogs}
          className="ml-auto flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 transition-all text-slate-600">
          Refresh
        </button>
      </div>

      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Waktu</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Invoice</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-12 text-slate-400">Memuat...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-slate-400">
                  <Eye className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Belum ada kunjungan</p>
                </td></tr>
              ) : logs.map((log, i) => (
                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(log.visited_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-gray-100">{log.service_orders?.customer_name || "-"}</td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-700 dark:text-gray-300">{log.service_orders?.invoice_number || "-"}</td>
                  <td className="px-4 py-3 text-center">
                    <a href={"/tracking/" + log.token} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs">
                      Buka <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && logs.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            Total {logs.length} kunjungan
          </div>
        )}
      </div>
    </div>
  );
}
