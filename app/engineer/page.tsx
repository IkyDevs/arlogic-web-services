"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Megaphone, FileWarning, ScrollText, LogOut,
  MapPin, Send, Loader2,
  type LucideIcon,
} from "lucide-react";

type Tab = "overview" | "announcements" | "reports" | "logs";

export default function EngineerDashboard() {
  const { user, logout } = useAuthStore();
  const { branches } = useBranch();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [branchStats, setBranchStats] = useState<Record<string, { services: number; transactions: number }>>({});
  const [announcements, setAnnouncements] = useState<Array<{ id: string; title: string; message: string; target_branch_id: string | null; created_at: string }>>([]);
  const [reports, setReports] = useState<Array<{ id: string; report_type: string; title: string; description: string; branch_id: string | null; priority: string; status: string; created_at: string }>>([]);
  const [logs, setLogs] = useState<Array<{ id: string; action: string; details: unknown; created_at: string }>>([]);
  const [loading, setLoading] = useState(false);

  // ── Announcement form ──
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annBranch, setAnnBranch] = useState("all");

  const fetchOverview = useCallback(async () => {
    if (branches.length === 0) return;
    const stats: Record<string, { services: number; transactions: number }> = {};
    for (const b of branches) {
      const [{ count: svc }, { count: tx }] = await Promise.all([
        supabase.from("service_orders").select("id", { count: "exact", head: true }).eq("branch_id", b.id),
        supabase.from("layanan").select("id", { count: "exact", head: true }).eq("branch_id", b.id),
      ]);
      stats[b.id] = { services: svc || 0, transactions: tx || 0 };
    }
    setBranchStats(stats);
  }, [branches, supabase]);

  const fetchAnnouncements = useCallback(async () => {
    const { data } = await supabase.from("announcements").select("*").order("created_at", { ascending: false }).limit(20);
    setAnnouncements(data || []);
  }, [supabase]);

  const fetchReports = useCallback(async () => {
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(50);
    setReports(data || []);
  }, [supabase]);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(50);
    setLogs(data || []);
  }, [supabase]);

  useEffect(() => { const t = setTimeout(fetchOverview, 0); return () => clearTimeout(t); }, [fetchOverview]);
  useEffect(() => { const t = setTimeout(fetchAnnouncements, 0); return () => clearTimeout(t); }, [fetchAnnouncements]);
  useEffect(() => { const t = setTimeout(fetchReports, 0); return () => clearTimeout(t); }, [fetchReports]);
  useEffect(() => { const t = setTimeout(fetchLogs, 0); return () => clearTimeout(t); }, [fetchLogs]);

  const submitAnnouncement = async () => {
    if (!annTitle.trim() || !annMessage.trim()) {
      toast.error("Judul dan pesan wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const targetBranch = annBranch === "all" ? null : annBranch;
      await supabase.from("announcements").insert({
        title: annTitle.trim(),
        message: annMessage.trim(),
        target_branch_id: targetBranch,
        created_by: user?.id,
      });
      toast.success("Pengumuman terkirim!");
      setAnnTitle("");
      setAnnMessage("");
      setAnnBranch("all");
      fetchAnnouncements();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setLoading(false);
    }
  };

  const updateReportStatus = async (id: string, status: string) => {
    await supabase.from("reports").update({ status }).eq("id", id);
    fetchReports();
  };

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name || "Semua Cabang";

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0a0a0a] flex">
      {/* ── Sidebar ── */}
      <aside className="w-60 bg-white dark:bg-[#1c1c1c] border-r border-gray-200 dark:border-white/10 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-white/10">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Engineer Panel</h1>
          <p className="text-xs text-gray-500">Monitoring & Testing</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {([
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "announcements", label: "Pengumuman", icon: Megaphone },
            { id: "reports", label: "Laporan Bug", icon: FileWarning },
            { id: "logs", label: "Log Perubahan", icon: ScrollText },
          ] as Array<{ id: Tab; label: string; icon: LucideIcon }>).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                tab === item.id
                  ? "bg-slate-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-white/10 space-y-2">
          {user?.role === "teknisi" && (
            <a href="/teknisi" className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5">
              ← Dashboard Teknisi
            </a>
          )}
          <p className="text-xs text-gray-500 truncate">{user?.full_name}</p>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Overview Semua Cabang</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b) => {
                const s = branchStats[b.id] || { services: 0, transactions: 0 };
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <h3 className="font-bold text-gray-900 dark:text-gray-100">{b.name}</h3>
                      <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500">{b.code}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-blue-600">{s.services}</p>
                        <p className="text-[10px] text-gray-500">Service</p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                        <p className="text-xl font-bold text-emerald-600">{s.transactions}</p>
                        <p className="text-[10px] text-gray-500">Transaksi</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Announcements */}
        {tab === "announcements" && (
          <div className="space-y-6 max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Buat Pengumuman</h2>
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5 space-y-3">
              <input
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="Judul pengumuman"
                className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm"
              />
              <textarea
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Isi pengumuman..."
                rows={4}
                className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm resize-none"
              />
              <div className="flex items-center gap-2">
                <select
                  value={annBranch}
                  onChange={(e) => setAnnBranch(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm"
                >
                  <option value="all">Semua Cabang</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <button
                  onClick={submitAnnouncement}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Kirim
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {announcements.map((a) => (
                <div key={a.id} className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">{a.title}</h4>
                    <span className="text-[10px] text-gray-400">{branchName(a.target_branch_id)}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{a.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reports */}
        {tab === "reports" && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Laporan Bug & Request</h2>
            {reports.map((r) => (
              <div key={r.id} className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500 uppercase">{r.report_type}</span>
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mt-1">{r.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">{r.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {branchName(r.branch_id)} · {r.priority} · {new Date(r.created_at).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <select
                    value={r.status}
                    onChange={(e) => updateReportStatus(r.id, e.target.value)}
                    className="px-2 py-1 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-lg text-xs"
                  >
                    <option value="new">Baru</option>
                    <option value="in_progress">Diproses</option>
                    <option value="done">Selesai</option>
                    <option value="rejected">Ditolak</option>
                  </select>
                </div>
              </div>
            ))}
            {reports.length === 0 && <p className="text-gray-400 text-sm">Belum ada laporan.</p>}
          </div>
        )}

        {/* Logs */}
        {tab === "logs" && (
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Log Perubahan</h2>
            {logs.map((l) => (
              <div key={l.id} className="bg-white dark:bg-[#1c1c1c] rounded-lg border border-gray-200 dark:border-white/10 px-4 py-2.5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono text-gray-500">{l.action}</span>
                  <p className="text-[10px] text-gray-400">{JSON.stringify(l.details || {}).slice(0, 80)}</p>
                </div>
                <span className="text-[10px] text-gray-400">{new Date(l.created_at).toLocaleString("id-ID")}</span>
              </div>
            ))}
            {logs.length === 0 && <p className="text-gray-400 text-sm">Belum ada log.</p>}
          </div>
        )}
      </main>
    </div>
  );
}
