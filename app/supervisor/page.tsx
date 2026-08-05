"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  LogOut,
  MapPin,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Plus,
  Wallet,
  X,
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
  recent: Array<{
    id: string;
    customer_name: string;
    nominal: number;
    metode_pembayaran: string;
    jenis_layanan: string;
    created_at: string;
  }>;
}

export default function SupervisorDashboard() {
  const { user, logout } = useAuthStore();
  const { branches } = useBranch();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [showReport, setShowReport] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);

  const [branchStats, setBranchStats] = useState<
    Record<string, { services: number; teknisi: number }>
  >({});
  const [users, setUsers] = useState<
    Array<{
      id: string;
      full_name: string;
      email: string;
      role: string;
      branch_id: string | null;
      home_branch_id: string | null;
      is_stock_approver: boolean | null;
    }>
  >([]);
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
  const [branchRevenue, setBranchRevenue] = useState<
    Record<string, BranchRevenue>
  >({});
  const [statDetail, setStatDetail] = useState<StatDetail | null>(null);
  const [showStatModal, setShowStatModal] = useState(false);

  const getDateRange = useCallback(
    (p: Period): { start: string; end: string } => {
      const now = new Date();
      let start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
      );
      if (p === "minggu")
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 6,
          0,
          0,
          0,
        );
      else if (p === "bulan")
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      else if (p === "tahun")
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      return { start: start.toISOString(), end: now.toISOString() };
    },
    [],
  );

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
      let revenue = 0,
        expenses = 0;
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
      out[b.id] = {
        revenue,
        count: rows.length,
        expenses,
        serviceCount: svc || 0,
      };
    }
    setBranchRevenue(out);
  }, [branches, supabase, period, getDateRange]);

  const openStatDetail = async (b: { id: string; name: string }) => {
    const { start, end } = getDateRange(period);
    const { data } = await supabase
      .from("layanan")
      .select(
        "id, customer_name, nominal, metode_pembayaran, jenis_layanan, created_at",
      )
      .eq("branch_id", b.id)
      .gte("created_at", start)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = data || [];
    const byMetode: Record<string, number> = {};
    const byJenis: Record<string, number> = {};
    let revenue = 0,
      expenses = 0;
    for (const r of rows) {
      const isExp = r.jenis_layanan === "pengeluaran";
      byMetode[r.metode_pembayaran || "unknown"] =
        (byMetode[r.metode_pembayaran || "unknown"] || 0) + (r.nominal || 0);
      byJenis[r.jenis_layanan || "lainnya"] =
        (byJenis[r.jenis_layanan || "lainnya"] || 0) + (r.nominal || 0);
      if (isExp) expenses += r.nominal || 0;
      else revenue += r.nominal || 0;
    }
    setStatDetail({
      branchId: b.id,
      branchName: b.name,
      revenue,
      count: rows.length,
      expenses,
      byMetode,
      byJenis,
      recent: rows,
    });
    setShowStatModal(true);
  };

  // Realtime: auto-refresh tanpa reload
  useEffect(() => {
    const channel = supabase
      .channel("supervisor-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "layanan" },
        () => {
          fetchStats();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchStats]);

  const fetchOverview = useCallback(async () => {
    if (branches.length === 0) return;
    const stats: Record<string, { services: number; teknisi: number }> = {};
    for (const b of branches) {
      const [{ count: svc }, { count: teks }] = await Promise.all([
        supabase
          .from("service_orders")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", b.id),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", b.id)
          .eq("role", "teknisi"),
      ]);
      stats[b.id] = { services: svc || 0, teknisi: teks || 0 };
    }
    setBranchStats(stats);
  }, [branches, supabase]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, role, branch_id, home_branch_id, is_stock_approver",
      )
      .in("role", ["teknisi", "admin", "qc", "supervisor", "engineer", "owner"])
      .order("full_name");
    setUsers(data || []);
    setLoadingUsers(false);
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(fetchOverview, 0);
    return () => clearTimeout(t);
  }, [fetchOverview]);
  useEffect(() => {
    const t = setTimeout(fetchStats, 0);
    return () => clearTimeout(t);
  }, [fetchStats]);
  useEffect(() => {
    if (tab !== "users") return;
    const t = setTimeout(fetchUsers, 0);
    return () => clearTimeout(t);
  }, [tab, fetchUsers]);
  useEffect(() => {
    if (branches.length > 0 && !newBranch) {
      const t = setTimeout(() => setNewBranch(branches[0].id), 0);
      return () => clearTimeout(t);
    }
  }, [branches, newBranch]);

  const branchName = (id: string | null) =>
    branches.find((b) => b.id === id)?.name || "-";
  const roleLabel: Record<string, string> = {
    teknisi: "Teknisi",
    admin: "Admin",
    qc: "QC",
    supervisor: "Supervisor",
    engineer: "Engineer",
    owner: "Owner",
  };

  const createUser = async () => {
    if (!newEmail.trim() || !newName.trim()) {
      toast.error("Email & nama wajib diisi");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail.trim(),
          full_name: newName.trim(),
          password: newPassword,
          role: newRole,
          branch_id: newBranch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat user");
      toast.success("User berhasil dibuat!");
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      fetchUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setCreating(false);
    }
  };

  const doRolling = async () => {
    if (!rollingUserId || !rollingBranch) {
      toast.error("Pilih teknisi & cabang tujuan");
      return;
    }
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
      await supabase
        .from("profiles")
        .update({ branch_id: rollingBranch, home_branch_id: home })
        .eq("id", rollingUserId);
      toast.success("Teknisi berhasil di-rolling!");
      setRollingUserId("");
      setRollingBranch("");
      setRollingReason("");
      fetchUsers();
      fetchOverview();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0a0a0a] flex flex-col lg:flex-row pb-20 lg:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-white dark:bg-[#1c1c1c] border-r border-gray-200 dark:border-white/10 flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-white/10">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Supervisor Panel
          </h1>
          <p className="text-xs text-gray-500">Monitor Semua Cabang</p>
        </div>
        <nav
          className="flex-1 p-3 space-y-1"
          role="navigation"
          aria-label="Main navigation"
        >
          {(
            [
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "users", label: "Kelola User", icon: Users },
            ] as Array<{ id: Tab; label: string; icon: LucideIcon }>
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 dark:focus:ring-offset-[#1c1c1c] ${
                tab === item.id
                  ? "bg-slate-900 text-white"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              }`}
            >
              <item.icon className="w-4 h-4" aria-hidden="true" />
              {item.label}
            </button>
          ))}
          <a
            href="/qc"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 dark:focus:ring-offset-[#1c1c1c]"
            aria-label="Go to QC Panel"
          >
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            QC Panel
          </a>
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-white/10 space-y-2">
          <p className="text-xs text-gray-500 truncate">{user?.full_name}</p>
          <button
            onClick={logout}
            aria-label={`Logout as ${user?.full_name}`}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-[#1c1c1c]"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-6"
        ref={mainContentRef}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
              {tab === "overview" ? "Monitoring Semua Cabang" : "Kelola User"}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 lg:hidden">
              {user?.full_name}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowReport(true)}
              aria-label="Report an issue or bug"
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" /> Lapor
            </button>
            <div className="hidden sm:block">
              <UserAvatar user={user} />
            </div>
          </div>
        </div>

        {tab === "overview" && (
          <div className="space-y-6">
            {/* Periode Selection */}
            <div className="flex flex-wrap gap-1 bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-1 w-fit">
              {(
                [
                  { id: "hari", label: "Hari Ini" },
                  { id: "minggu", label: "Mingguan" },
                  { id: "bulan", label: "Bulanan" },
                  { id: "tahun", label: "Tahunan" },
                ] as Array<{ id: Period; label: string }>
              ).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  aria-pressed={period === p.id}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 dark:focus:ring-offset-[#0a0a0a] ${period === p.id ? "bg-slate-900 text-white" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Revenue Cards per Branch - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {branches.map((b) => {
                const st = branchRevenue[b.id] || {
                  revenue: 0,
                  count: 0,
                  expenses: 0,
                  serviceCount: 0,
                };
                return (
                  <button
                    key={b.id}
                    onClick={() => openStatDetail(b)}
                    className="text-left bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 sm:p-5 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Wallet
                          className="w-4 h-4 text-blue-500 flex-shrink-0"
                          aria-hidden="true"
                        />
                        <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                          {b.name}
                        </h3>
                        <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500 flex-shrink-0">
                          {b.code}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 hidden sm:inline">
                        Klik → detail
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                        <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
                          {formatRupiah(st.revenue)}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          Pendapatan
                        </p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                        <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                          {st.count} / {st.serviceCount}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          Transaksi / Service
                        </p>
                      </div>
                    </div>
                    {st.expenses > 0 && (
                      <p className="mt-2 text-[11px] text-red-500 dark:text-red-400">
                        Pengeluaran: {formatRupiah(st.expenses)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Branch Stats Grid - Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {branches.map((b) => {
                const s = branchStats[b.id] || { services: 0, teknisi: 0 };
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 sm:p-5"
                  >
                    <div className="flex items-center gap-2 mb-3 min-w-0">
                      <MapPin
                        className="w-4 h-4 text-blue-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                      <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">
                        {b.name}
                      </h3>
                      <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500 flex-shrink-0">
                        {b.code}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                        <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">
                          {s.services}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          Service
                        </p>
                      </div>
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                        <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
                          {s.teknisi}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          Teknisi
                        </p>
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
            {/* Form Tambah User */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 sm:p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Tambah User Per Cabang
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                <div className="sm:col-span-1">
                  <label htmlFor="newName" className="sr-only">
                    Nama lengkap
                  </label>
                  <input
                    id="newName"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nama lengkap"
                    aria-label="Full name"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a] transition-all"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="newEmail" className="sr-only">
                    Email
                  </label>
                  <input
                    id="newEmail"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Email"
                    type="email"
                    aria-label="Email address"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a] transition-all"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="newPassword" className="sr-only">
                    Password
                  </label>
                  <input
                    id="newPassword"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Password"
                    type="password"
                    aria-label="Password"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a] transition-all"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="newRole" className="sr-only">
                    Role
                  </label>
                  <select
                    id="newRole"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    aria-label="User role"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a] transition-all"
                  >
                    <option value="teknisi">Teknisi</option>
                    <option value="admin">Admin</option>
                    <option value="qc">QC</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="engineer">Engineer</option>
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="newBranch" className="sr-only">
                    Branch
                  </label>
                  <select
                    id="newBranch"
                    value={newBranch}
                    onChange={(e) => setNewBranch(e.target.value)}
                    aria-label="Branch assignment"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a] transition-all"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={createUser}
                  disabled={creating}
                  aria-busy={creating}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
                >
                  {creating ? (
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">Tambah</span>
                </button>
              </div>
            </div>

            {/* Form Rolling Teknisi */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 sm:p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Rolling Teknisi ke Cabang Lain
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Teknisi tetap punya cabang asal (home_branch_id), bisa ditarik
                kembali kapan saja.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="sm:col-span-1">
                  <label htmlFor="rollingUserId" className="sr-only">
                    Select technician
                  </label>
                  <select
                    id="rollingUserId"
                    value={rollingUserId}
                    onChange={(e) => setRollingUserId(e.target.value)}
                    aria-label="Select technician for transfer"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a] transition-all"
                  >
                    <option value="">Pilih teknisi</option>
                    {users
                      .filter((u) => u.role === "teknisi")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} ({branchName(u.branch_id)})
                        </option>
                      ))}
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="rollingBranch" className="sr-only">
                    Target branch
                  </label>
                  <select
                    id="rollingBranch"
                    value={rollingBranch}
                    onChange={(e) => setRollingBranch(e.target.value)}
                    aria-label="Select destination branch"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a] transition-all"
                  >
                    <option value="">Cabang tujuan</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="rollingReason" className="sr-only">
                    Reason
                  </label>
                  <input
                    id="rollingReason"
                    value={rollingReason}
                    onChange={(e) => setRollingReason(e.target.value)}
                    placeholder="Alasan (opsional)"
                    aria-label="Reason for transfer (optional)"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a] transition-all"
                  />
                </div>
                <button
                  onClick={doRolling}
                  disabled={rolling}
                  aria-busy={rolling}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 dark:bg-blue-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
                >
                  {rolling ? (
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRightLeft className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">Rolling</span>
                </button>
              </div>
            </div>

            {/* Staff List */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-white/10">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Daftar Staff ({users.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/5 max-h-96 overflow-y-auto">
                {loadingUsers && (
                  <p className="p-4 text-sm text-gray-400">Memuat...</p>
                )}
                {users.length === 0 && !loadingUsers && (
                  <p className="p-4 text-sm text-gray-400">Tidak ada staff</p>
                )}
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {u.full_name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {u.email}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {roleLabel[u.role] || u.role}
                      </span>
                      <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-600 dark:text-blue-400 whitespace-nowrap">
                        {branchName(u.branch_id)}
                        {u.branch_id !== u.home_branch_id &&
                          u.home_branch_id &&
                          " (rolling)"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Popup Detail Statistik per Cabang */}
      <AnimatePresence>
        {showStatModal && statDetail && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4"
            onClick={() => setShowStatModal(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="statModalTitle"
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
                  <h3
                    id="statModalTitle"
                    className="text-lg font-bold text-gray-900 dark:text-gray-100"
                  >
                    Statistik {statDetail.branchName}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {period === "hari"
                      ? "Hari Ini"
                      : period === "minggu"
                        ? "Mingguan"
                        : period === "bulan"
                          ? "Bulanan"
                          : "Tahunan"}
                  </p>
                </div>
                <button
                  onClick={() => setShowStatModal(false)}
                  aria-label="Close details"
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600"
                >
                  <X className="w-4 h-4 text-gray-400" aria-hidden="true" />
                </button>
              </div>

              <div className="p-4 sm:p-6 space-y-5">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
                    <p className="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 truncate">
                      {formatRupiah(statDetail.revenue)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">Pendapatan</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
                    <p className="text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400">
                      {statDetail.count}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">Transaksi</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 text-center">
                    <p className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 truncate">
                      {formatRupiah(statDetail.expenses)}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      Pengeluaran
                    </p>
                  </div>
                </div>

                {/* By Payment Method */}
                {Object.keys(statDetail.byMetode).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Per Metode Pembayaran
                    </p>
                    <div className="space-y-1.5">
                      {Object.entries(statDetail.byMetode).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between text-xs sm:text-sm"
                        >
                          <span className="text-gray-600 dark:text-gray-300 truncate">
                            {k}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">
                            {formatRupiah(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* By Service Type */}
                {Object.keys(statDetail.byJenis).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Per Jenis Layanan
                    </p>
                    <div className="space-y-1.5">
                      {Object.entries(statDetail.byJenis).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between text-xs sm:text-sm"
                        >
                          <span className="text-gray-600 dark:text-gray-300 truncate">
                            {k}
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">
                            {formatRupiah(v)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Transactions */}
                {statDetail.recent.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Transaksi Terbaru
                    </p>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {statDetail.recent.slice(0, 20).map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between text-xs border-b border-gray-100 dark:border-white/5 pb-1.5"
                        >
                          <span className="text-gray-600 dark:text-gray-300 truncate">
                            {r.customer_name}{" "}
                            <span className="text-gray-400">
                              ({r.jenis_layanan})
                            </span>
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">
                            {formatRupiah(r.nominal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation Bar for Mobile/Tablet */}
      <nav
        className="fixed bottom-0 left-0 right-0 lg:hidden bg-white dark:bg-[#1c1c1c] border-t border-gray-200 dark:border-white/10 z-50"
        role="navigation"
        aria-label="Mobile navigation"
      >
        <div className="flex items-center justify-around h-20">
          <button
            onClick={() => setTab("overview")}
            aria-current={tab === "overview" ? "page" : undefined}
            aria-label="Overview tab"
            className={`flex flex-col items-center justify-center w-full h-full gap-1 px-2 py-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
              tab === "overview"
                ? "text-slate-900 dark:text-white bg-slate-50 dark:bg-white/5"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <LayoutDashboard className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] sm:text-xs">Overview</span>
          </button>
          <button
            onClick={() => setTab("users")}
            aria-current={tab === "users" ? "page" : undefined}
            aria-label="Users management tab"
            className={`flex flex-col items-center justify-center w-full h-full gap-1 px-2 py-2 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
              tab === "users"
                ? "text-slate-900 dark:text-white bg-slate-50 dark:bg-white/5"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            <Users className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] sm:text-xs">Users</span>
          </button>
          <a
            href="/qc"
            aria-label="Go to QC Panel"
            className="flex flex-col items-center justify-center w-full h-full gap-1 px-2 py-2 font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          >
            <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] sm:text-xs">QC</span>
          </a>
          <button
            onClick={logout}
            aria-label={`Logout as ${user?.full_name}`}
            className="flex flex-col items-center justify-center w-full h-full gap-1 px-2 py-2 font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500"
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] sm:text-xs">Logout</span>
          </button>
        </div>
      </nav>

      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        currentModule="Supervisor Panel"
      />
    </div>
  );
}
