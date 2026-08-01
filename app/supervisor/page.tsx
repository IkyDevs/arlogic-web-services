"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, LogOut, MapPin, ArrowRightLeft,
  CheckCircle2, Loader2, Plus, Wallet, X,
  type LucideIcon,
} from "lucide-react";
import ReportModal from "@/components/ui/ReportModal";
import UserAvatar from "@/components/ui/UserAvatar";
import { formatRupiah } from "@/lib/domain/shared/formatters";

type Tab = "overview" | "users";
type Period = "hari" | "minggu" | "bulan" | "tahun";

interface BranchRevenue {
  revenue: number;
  count: number;
  expenses: number;
  serviceCount: number;
}

interface StatDetail {
  branchId: string;
  branchName: string;
  revenue: number;
  count: number;
  expenses: number;
  byMetode: Record<string, number>;
  byJenis: Record<string, number>;
  recent: Array<{ id: string; customer_name: string; nominal: number; metode_pembayaran: string; jenis_layanan: string; created_at: string }>;
}

export default function SupervisorDashboard() {
  const { user, logout } = useAuthStore();
  const { branches } = useBranch();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [showReport, setShowReport] = useState(false);

  const [branchStats, setBranchStats] = useState<Record<string, { services: number; teknisi: number }>>({});
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string; role: string; branch_id: string | null; home_branch_id: string | null; is_stock_approver: boolean | null }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form tambah user
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("teknisi");
  const [newBranch, setNewBranch] = useState("");
  const [creating, setCreating] = useState(false);

  // Rolling teknisi
  const [rollingUserId, setRollingUserId] = useState("");
  const [rollingBranch, setRollingBranch] = useState("");
  const [rollingReason, setRollingReason] = useState("");
  const [rolling, setRolling] = useState(false);

  // ── Statistik per cabang ──
  const [period, setPeriod] = useState<Period>("hari");
  const [branchRevenue, setBranchRevenue] = useState<Record<string, BranchRevenue>>({});
  const [statDetail, setStatDetail] = useState<StatDetail | null>(null);
  const [showStatModal, setShowStatModal] = useState(false);

  const getDateRange = useCallback((p: Period): { start: string; end: string } => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    if (p === "minggu") start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
    else if (p === "bulan") start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    else if (p === "tahun") start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    return { start: start.toISOString(), end: now.toISOString() };
  }, []);

  const fetchStats = useCallback(async () => {
    if (branches.length === 0) return;
    const { start, end } = getDateRange(period);
    const out: Record<string, BranchRevenue> = {};
    for (const b of branches) {
      const { data } = await supabase
        .from("layanan")
        .select("nominal, jenis_layanan")
        .eq("branch_id", b.id)
        .gte("created_at", start)
        .lte("created_at", end);
      const rows = data || [];
      let revenue = 0, expenses = 0;
      for (const r of rows) {
        if (r.jenis_layanan === "pengeluaran") expenses += r.nominal || 0;
        else revenue += r.nominal || 0;
      }
      const { count: svc } = await supabase
        .from("service_orders")
        .select("id", { count: "exact", head: true })
        .eq("branch_id", b.id)
        .gte("created_at", start)
        .lte("created_at", end);
      out[b.id] = { revenue, count: rows.length, expenses, serviceCount: svc || 0 };
    }
    setBranchRevenue(out);
  }, [branches, supabase, period, getDateRange]);

  const openStatDetail = async (b: { id: string; name: string }) => {
    const { start, end } = getDateRange(period);
    const { data } = await supabase
      .from("layanan")
      .select("id, customer_name, nominal, metode_pembayaran, jenis_layanan, created_at")
      .eq("branch_id", b.id)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = data || [];
    const byMetode: Record<string, number> = {};
    const byJenis: Record<string, number> = {};
    let revenue = 0, expenses = 0;
    for (const r of rows) {
      const isExp = r.jenis_layanan === "pengeluaran";
      byMetode[r.metode_pembayaran || "unknown"] = (byMetode[r.metode_pembayaran || "unknown"] || 0) + (r.nominal || 0);
      byJenis[r.jenis_layanan || "lainnya"] = (byJenis[r.jenis_layanan || "lainnya"] || 0) + (r.nominal || 0);
      if (isExp) expenses += r.nominal || 0;
      else revenue += r.nominal || 0;
    }
    setStatDetail({
      branchId: b.id, branchName: b.name,
      revenue, count: rows.length, expenses,
      byMetode, byJenis, recent: rows,
    });
    setShowStatModal(true);
  };

  // Realtime: auto-refresh tanpa reload
  useEffect(() => {
    const channel = supabase
      .channel("supervisor-stats")
      .on("postgres_changes", { event: "*", schema: "public", table: "layanan" }, () => { fetchStats(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchStats]);

  const fetchOverview = useCallback(async () => {
    if (branches.length === 0) return;
    const stats: Record<string, { services: number; teknisi: number }> = {};
    for (const b of branches) {
      const [{ count: svc }, { count: teks }] = await Promise.all([
        supabase.from("service_orders").select("id", { count: "exact", head: true }).eq("branch_id", b.id),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("branch_id", b.id).eq("role", "teknisi"),
      ]);
      stats[b.id] = { services: svc || 0, teknisi: teks || 0 };
    }
    setBranchStats(stats);
  }, [branches, supabase]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, branch_id, home_branch_id, is_stock_approver")
      .in("role", ["teknisi", "admin", "qc", "supervisor", "engineer", "owner"])
      .order("full_name");
    setUsers(data || []);
    setLoadingUsers(false);
  }, [supabase]);

  useEffect(() => { const t = setTimeout(fetchOverview, 0); return () => clearTimeout(t); }, [fetchOverview]);
  useEffect(() => { const t = setTimeout(fetchStats, 0); return () => clearTimeout(t); }, [fetchStats]);
  useEffect(() => { if (tab !== "users") return; const t = setTimeout(fetchUsers, 0); return () => clearTimeout(t); }, [tab, fetchUsers]);
  useEffect(() => { if (branches.length > 0 && !newBranch) { const t = setTimeout(() => setNewBranch(branches[0].id), 0); return () => clearTimeout(t); } }, [branches, newBranch]);

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name || "-";
  const roleLabel: Record<string, string> = {
    teknisi: "Teknisi", admin: "Admin", qc: "QC", supervisor: "Supervisor", engineer: "Engineer", owner: "Owner",
  };

  const createUser = async () => {
    if (!newEmail.trim() || !newName.trim()) { toast.error("Email & nama wajib diisi"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), full_name: newName.trim(), password: newPassword, role: newRole, branch_id: newBranch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat user");
      toast.success("User berhasil dibuat!");
      setNewEmail(""); setNewName(""); setNewPassword("");
      fetchUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setCreating(false);
    }
  };

  const doRolling = async () => {
    if (!rollingUserId || !rollingBranch) { toast.error("Pilih teknisi & cabang tujuan"); return; }
    setRolling(true);
    try {
      const target = users.find((u) => u.id === rollingUserId);
      if (!target) throw new Error("User tidak ditemukan");
      // Catat riwayat rolling
      await supabase.from("branch_assignments").insert({
        profile_id: rollingUserId,
        branch_id: target.branch_id,
        end_date: new Date().toISOString(),
        reason: `Rolling dari ${branchName(target.branch_id)} ke ${branchName(rollingBranch)} - ${rollingReason || "penugasan"}`,
        created_by: user?.id,
      });
      // Update cabang aktif + simpan cabang asal jika belum ada
      const home = target.home_branch_id || target.branch_id;
      await supabase.from("profiles").update({ branch_id: rollingBranch, home_branch_id: home }).eq("id", rollingUserId);
      toast.success("Teknisi berhasil di-rolling!");
      setRollingUserId(""); setRollingBranch(""); setRollingReason("");
      fetchUsers();
      fetchOverview();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0a0a0a] flex">
      <aside className="w-60 bg-white dark:bg-[#1c1c1c] border-r border-gray-200 dark:border-white/10 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-white/10">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Supervisor Panel</h1>
          <p className="text-xs text-gray-500">Monitor Semua Cabang</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {([
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "users", label: "Kelola User", icon: Users },
          ] as Array<{ id: Tab; label: string; icon: LucideIcon }>).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                tab === item.id ? "bg-slate-900 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
          <a
            href="/qc"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <CheckCircle2 className="w-4 h-4" />
            QC Panel
          </a>
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-white/10 space-y-2">
          <p className="text-xs text-gray-500 truncate">{user?.full_name}</p>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {tab === "overview" ? "Monitoring Semua Cabang" : "Kelola User"}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-all text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Lapor
            </button>
            <UserAvatar user={user} />
          </div>
        </div>

        {tab === "overview" && (
          <div className="space-y-6">
            {/* Periode */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-1 w-fit">
              {([
                { id: "hari", label: "Hari Ini" },
                { id: "minggu", label: "Mingguan" },
                { id: "bulan", label: "Bulanan" },
                { id: "tahun", label: "Tahunan" },
              ] as Array<{ id: Period; label: string }>).map((p) => (
                <button key={p.id} onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${period === p.id ? "bg-slate-900 text-white" : "text-gray-500 hover:text-gray-900"}`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Card pendapatan per cabang (klik → detail) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {branches.map((b) => {
                const st = branchRevenue[b.id] || { revenue: 0, count: 0, expenses: 0, serviceCount: 0 };
                return (
                  <button key={b.id} onClick={() => openStatDetail(b)}
                    className="text-left bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5 hover:border-blue-400 transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-blue-500" />
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">{b.name}</h3>
                        <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500">{b.code}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">Klik → detail</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-emerald-600">{formatRupiah(st.revenue)}</p>
                        <p className="text-[10px] text-gray-500">Pendapatan</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                        <p className="text-lg font-bold text-blue-600">{st.count} / {st.serviceCount}</p>
                        <p className="text-[10px] text-gray-500">Transaksi / Service</p>
                      </div>
                    </div>
                    {st.expenses > 0 && (
                      <p className="mt-2 text-[11px] text-red-500">Pengeluaran: {formatRupiah(st.expenses)}</p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Card per cabang (service & teknisi) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b) => {
                const s = branchStats[b.id] || { services: 0, teknisi: 0 };
                return (
                  <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5">
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
                        <p className="text-xl font-bold text-emerald-600">{s.teknisi}</p>
                        <p className="text-[10px] text-gray-500">Teknisi</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-6">
            {/* Form tambah user */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Tambah User Per Cabang</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama lengkap"
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm" />
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email"
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm" />
                <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password"
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm" />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm">
                  <option value="teknisi">Teknisi</option>
                  <option value="admin">Admin</option>
                  <option value="qc">QC</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="engineer">Engineer</option>
                </select>
                <select value={newBranch} onChange={(e) => setNewBranch(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm">
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button onClick={createUser} disabled={creating}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Tambah
                </button>
              </div>
            </div>

            {/* Rolling teknisi */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Rolling Teknisi ke Cabang Lain</h3>
              <p className="text-xs text-gray-500 mb-3">Teknisi tetap punya cabang asal (home_branch_id), bisa ditarik kembali kapan saja.</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select value={rollingUserId} onChange={(e) => setRollingUserId(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm">
                  <option value="">Pilih teknisi</option>
                  {users.filter((u) => u.role === "teknisi").map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({branchName(u.branch_id)})</option>
                  ))}
                </select>
                <select value={rollingBranch} onChange={(e) => setRollingBranch(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm">
                  <option value="">Cabang tujuan</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input value={rollingReason} onChange={(e) => setRollingReason(e.target.value)} placeholder="Alasan (opsional)"
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm" />
                <button onClick={doRolling} disabled={rolling}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {rolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  Rolling
                </button>
              </div>
            </div>

            {/* Daftar user */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Daftar Staff ({users.length})</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {loadingUsers && <p className="p-4 text-sm text-gray-400">Memuat...</p>}
                {users.map((u) => (
                  <div key={u.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.full_name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500">{roleLabel[u.role] || u.role}</span>
                      <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-600">
                        {branchName(u.branch_id)}
                        {u.branch_id !== u.home_branch_id && u.home_branch_id && " (rolling)"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Popup detail statistik per cabang */}
      {showStatModal && statDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4" onClick={() => setShowStatModal(false)}>
          <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-white/10 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between sticky top-0 bg-white dark:bg-[#1c1c1c]">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Statistik {statDetail.branchName}</h3>
                <p className="text-xs text-gray-500">
                  {period === "hari" ? "Hari Ini" : period === "minggu" ? "Mingguan" : period === "bulan" ? "Bulanan" : "Tahunan"}
                </p>
              </div>
              <button onClick={() => setShowStatModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Ringkasan */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                  <p className="text-lg font-bold text-emerald-600">{formatRupiah(statDetail.revenue)}</p>
                  <p className="text-[10px] text-gray-500">Pendapatan</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                  <p className="text-lg font-bold text-blue-600">{statDetail.count}</p>
                  <p className="text-[10px] text-gray-500">Transaksi</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                  <p className="text-lg font-bold text-red-600">{formatRupiah(statDetail.expenses)}</p>
                  <p className="text-[10px] text-gray-500">Pengeluaran</p>
                </div>
              </div>

              {/* Per metode pembayaran */}
              {Object.keys(statDetail.byMetode).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Per Metode Pembayaran</p>
                  <div className="space-y-1.5">
                    {Object.entries(statDetail.byMetode).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{k}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per jenis layanan */}
              {Object.keys(statDetail.byJenis).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Per Jenis Layanan</p>
                  <div className="space-y-1.5">
                    {Object.entries(statDetail.byJenis).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{k}</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaksi terbaru */}
              {statDetail.recent.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Transaksi Terbaru</p>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {statDetail.recent.slice(0, 20).map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-xs border-b border-gray-100 dark:border-white/5 pb-1.5">
                        <span className="text-gray-600 dark:text-gray-300">{r.customer_name} <span className="text-gray-400">({r.jenis_layanan})</span></span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(r.nominal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ReportModal open={showReport} onClose={() => setShowReport(false)} currentModule="Supervisor Panel" />
    </div>
  );
}
