"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import toast from "react-hot-toast";
import {
  LayoutDashboard,
  Users,
  LogOut,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  Calendar,
  Columns2,
  ShoppingCart,
  Wrench,
  Hourglass,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import ReportModal from "@/components/ui/ReportModal";
import UserAvatar from "@/components/ui/UserAvatar";
import BranchMonitoringCard, {
  type BranchMonitoringStat,
} from "@/components/supervisor/BranchMonitoringCard";
import {
  SupervisorTransactionsModal,
  SupervisorServicesModal,
} from "@/components/supervisor/MonitoringModals";

type Tab = "overview" | "users";
type Period = "hari" | "minggu" | "bulan" | "tahun";

const OPEN_SERVICE_STATUSES = [
  "pending",
  "assigned",
  "in_progress",
  "waiting_sparepart",
  "sparepart_ready",
  "qc_pending",
  "revision_required",
];

function getWindow(p: Period, customStart: string, customEnd: string) {
  if (customStart) {
    const s = new Date(customStart);
    const e = customEnd ? new Date(customEnd) : new Date(customStart);
    return {
      start: s.toISOString(),
      end: new Date(e.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  if (p === "minggu") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0);
  } else if (p === "bulan") {
    start = new Date(now);
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  } else if (p === "tahun") {
    start = new Date(now);
    start.setDate(start.getDate() - 365);
    start.setHours(0, 0, 0, 0);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export default function SupervisorDashboard() {
  const { user, logout } = useAuthStore();
  const { branches } = useBranch();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [showReport, setShowReport] = useState(false);

  // ── Monitoring overview ──
  const [period, setPeriod] = useState<Period>("hari");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [stats, setStats] = useState<BranchMonitoringStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [modal, setModal] = useState<{
    type: "tx" | "svc";
    branch: { id: string | null; name: string };
  } | null>(null);

  const fetchOverview = useCallback(async () => {
    if (branches.length === 0) {
      setLoadingStats(false);
      return;
    }
    const { start, end } = getWindow(period, dateRangeStart, dateRangeEnd);
    try {
      const [txRes, svcRes] = await Promise.all([
        supabase
          .from("layanan")
          .select("nominal, jenis_layanan, branch_id")
          .gte("created_at", start)
          .lte("created_at", end)
          .limit(20000),
        supabase
          .from("service_orders")
          .select("status, branch_id")
          .gte("created_at", start)
          .lte("created_at", end)
          .limit(20000),
      ]);
      const map = new Map<string, BranchMonitoringStat>();
      for (const b of branches) {
        map.set(b.id, {
          id: b.id,
          name: b.name,
          code: b.code,
          transactions: 0,
          revenue: 0,
          services: 0,
          pending: 0,
          completed: 0,
        });
      }
      for (const r of txRes.data || []) {
        const cell = r.branch_id ? map.get(r.branch_id) : undefined;
        if (!cell) continue;
        cell.transactions += 1;
        if (r.jenis_layanan !== "pengeluaran") cell.revenue += r.nominal || 0;
      }
      for (const r of svcRes.data || []) {
        const cell = r.branch_id ? map.get(r.branch_id) : undefined;
        if (!cell) continue;
        cell.services += 1;
        if (r.status === "completed") cell.completed += 1;
        else if ((OPEN_SERVICE_STATUSES as string[]).includes(r.status || ""))
          cell.pending += 1;
      }
      setStats(Array.from(map.values()));
    } catch (e) {
      console.error("Gagal memuat monitoring supervisor:", e);
      toast.error("Gagal memuat data monitoring");
    } finally {
      setLoadingStats(false);
    }
  }, [branches, supabase, period, dateRangeStart, dateRangeEnd]);

  useEffect(() => {
    const t = setTimeout(fetchOverview, 0);
    return () => clearTimeout(t);
  }, [fetchOverview]);

  useEffect(() => {
    const channel = supabase
      .channel("supervisor-overview")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "layanan" },
        () => fetchOverview(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_orders" },
        () => fetchOverview(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchOverview]);

  useEffect(() => {
    if (branches.length >= 2 && (!compareA || !compareB)) {
      setCompareA((v) => v || branches[0].id);
      setCompareB((v) => v || branches[1].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches]);

  const summary = useMemo(
    () =>
      stats.reduce(
        (acc, s) => ({
          transactions: acc.transactions + s.transactions,
          services: acc.services + s.services,
          pending: acc.pending + s.pending,
          revenue: acc.revenue + s.revenue,
        }),
        { transactions: 0, services: 0, pending: 0, revenue: 0 },
      ),
    [stats],
  );

  const ALL_BRANCH: { id: string | null; name: string } = {
    id: null,
    name: "Semua Cabang",
  };

  const summaryChips: Array<{
    key: string;
    label: string;
    value: string;
    Icon: LucideIcon;
    iconCls: string;
    modalType: "tx" | "svc";
  }> = [
    {
      key: "tx",
      label: "Total Transaksi",
      value: summary.transactions.toLocaleString("id-ID"),
      Icon: ShoppingCart,
      iconCls: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
      modalType: "tx",
    },
    {
      key: "svc",
      label: "Total Service",
      value: summary.services.toLocaleString("id-ID"),
      Icon: Wrench,
      iconCls:
        "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400",
      modalType: "svc",
    },
    {
      key: "pending",
      label: "Service Pending",
      value: summary.pending.toLocaleString("id-ID"),
      Icon: Hourglass,
      iconCls: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
      modalType: "svc",
    },
    {
      key: "rev",
      label: "Total Pendapatan",
      value: `Rp ${new Intl.NumberFormat("id-ID").format(summary.revenue)}`,
      Icon: Wallet,
      iconCls: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
      modalType: "tx",
    },
  ];

  const statById = (id: string) => stats.find((s) => s.id === id);

  // ── Kelola User (logika tab users — tidak diubah) ──
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

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("teknisi");
  const [newBranch, setNewBranch] = useState("");
  const [creating, setCreating] = useState(false);

  const [rollingUserId, setRollingUserId] = useState("");
  const [rollingBranch, setRollingBranch] = useState("");
  const [rollingReason, setRollingReason] = useState("");
  const [rolling, setRolling] = useState(false);

  const fetchUsers = async () => {
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
  };

  useEffect(() => {
    if (tab !== "users") return;
    const t = setTimeout(fetchUsers, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (branches.length > 0 && !newBranch) {
      const t = setTimeout(() => setNewBranch(branches[0].id), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, newBranch]);

  const branchName = (id: string | null) =>
    branches.find((b) => b.id === id)?.name || "-";

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
      await supabase.from("branch_assignments").insert({
        profile_id: rollingUserId,
        branch_id: target.branch_id,
        end_date: new Date().toISOString(),
        reason: `Rolling dari ${branchName(target.branch_id)} ke ${branchName(rollingBranch)} - ${rollingReason || "penugasan"}`,
        created_by: user?.id,
      });
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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Gagal");
    } finally {
      setRolling(false);
    }
  };

  const roleLabel: Record<string, string> = {
    teknisi: "Teknisi",
    admin: "Admin",
    qc: "QC",
    supervisor: "Supervisor",
    engineer: "Engineer",
    owner: "Owner",
  };

  const compareCards: BranchMonitoringStat[] =
    compareMode && compareA && compareB
      ? ([statById(compareA), statById(compareB)].filter(
          Boolean,
        ) as BranchMonitoringStat[])
      : [];

  return (
    <div className="h-screen supports-[height:100dvh]:h-dvh overflow-hidden bg-[#eef4fa] dark:bg-[#0a0a0a] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-white dark:bg-[#1c1c1c] border-r border-gray-200 dark:border-white/10 flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-white/10">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Dashboard Supervisor
          </h1>
          <p className="text-xs text-gray-500">Monitoring Semua Cabang</p>
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
      <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden p-4 md:p-6 lg:p-6 pb-20 lg:pb-0">
        {/* Header + Filter */}
        <div className="flex-shrink-0 mb-4 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {tab === "overview" ? "Dashboard Supervisor" : "Kelola User"}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {tab === "overview"
                  ? "Pantau transaksi dan service seluruh cabang secara real-time."
                  : "Kelola user & rolling teknisi per cabang."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCompareMode((v) => !v)}
                aria-pressed={compareMode}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-[#0a0a0a] ${
                  compareMode
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white dark:bg-[#1c1c1c] border-gray-200/70 dark:border-white/10 text-gray-600 hover:text-blue-600 dark:text-gray-300"
                }`}
                title="Bandingkan dua cabang berdampingan"
              >
                <Columns2 className="w-4 h-4" aria-hidden="true" />
                Bandingkan
              </button>

              <div className="flex flex-wrap gap-1 bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200/70 dark:border-white/10 p-1">
                {(
                  [
                    { id: "hari", label: "Hari Ini" },
                    { id: "minggu", label: "Mingguan" },
                    { id: "bulan", label: "Bulanan" },
                    { id: "tahun", label: "Tahunan" },
                  ] as const
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

              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                Dari
                <input
                  type="date"
                  value={dateRangeStart}
                  onChange={(e) => setDateRangeStart(e.target.value)}
                  aria-label="Dari tanggal"
                  className="bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                />
              </label>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                Sampai
                <input
                  type="date"
                  value={dateRangeEnd}
                  min={dateRangeStart || undefined}
                  onChange={(e) => setDateRangeEnd(e.target.value)}
                  aria-label="Sampai tanggal"
                  className="bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                />
              </label>

              {(dateRangeStart || dateRangeEnd) && (
                <button
                  onClick={() => {
                    setDateRangeStart("");
                    setDateRangeEnd("");
                  }}
                  aria-label="Reset filter tanggal"
                  className="flex items-center justify-center w-8 h-8 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-gray-500 hover:text-red-600 hover:border-red-300 transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}

              <button
                onClick={() => setShowReport(true)}
                aria-label="Report an issue or bug"
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
              >
                <Plus className="w-4 h-4" aria-hidden="true" /> Lapor
              </button>

              <div className="hidden sm:block">
                <UserAvatar user={user} />
              </div>
            </div>
          </div>
        </div>

        {tab === "overview" && (
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pb-4">
            {/* Ringkasan gabungan — klik untuk buka pop-up */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {loadingStats
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-20 animate-pulse bg-gray-100 dark:bg-white/5 rounded-2xl"
                    />
                  ))
                : summaryChips.map(({ key, label, value, Icon, iconCls, modalType }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setModal({
                          type: modalType,
                          branch: ALL_BRANCH,
                        })
                      }
                      className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white dark:bg-[#1c1c1c] p-4 text-left hover:border-blue-400 dark:hover:border-blue-600 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
                      aria-label={`${label}, buka pop-up`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconCls}`}>
                          <Icon className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-base sm:text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums truncate">
                            {value}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-400 truncate">{label}</p>
                        </div>
                      </div>
                    </button>
                  ))}
            </div>

            {/* Bar bandingkan */}
            {compareMode && (
              <div className="flex-shrink-0 flex flex-wrap items-center gap-3 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-2xl px-4 py-3">
                <span className="text-xs font-semibold text-gray-500">Bandingkan:</span>
                <select
                  value={compareA}
                  onChange={(e) => setCompareA(e.target.value)}
                  aria-label="Cabang A"
                  className="px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <ArrowRightLeft className="w-4 h-4 text-gray-400" aria-hidden="true" />
                <select
                  value={compareB}
                  onChange={(e) => setCompareB(e.target.value)}
                  aria-label="Cabang B"
                  className="px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Kartu monitoring cabang */}
            {loadingStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {Array.from({ length: Math.max(branches.length, 3) }).map((_, i) => (
                  <div
                    key={i}
                    className="h-44 animate-pulse bg-gray-100 dark:bg-white/5 rounded-2xl"
                  />
                ))}
              </div>
            ) : compareMode ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {compareCards.map((s) => (
                  <BranchMonitoringCard
                    key={s.id}
                    stat={s}
                    onViewTransactions={() =>
                      setModal({ type: "tx", branch: { id: s.id, name: s.name } })
                    }
                    onViewServices={() =>
                      setModal({ type: "svc", branch: { id: s.id, name: s.name } })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {stats.map((s) => (
                  <BranchMonitoringCard
                    key={s.id}
                    stat={s}
                    onViewTransactions={() =>
                      setModal({ type: "tx", branch: { id: s.id, name: s.name } })
                    }
                    onViewServices={() =>
                      setModal({ type: "svc", branch: { id: s.id, name: s.name } })
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "users" && (
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
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

      {/* Pop-up Transaksi / Service */}
      <SupervisorTransactionsModal
        open={modal?.type === "tx"}
        branch={modal?.branch ?? ALL_BRANCH}
        onClose={() => setModal(null)}
      />
      <SupervisorServicesModal
        open={modal?.type === "svc"}
        branch={modal?.branch ?? ALL_BRANCH}
        onClose={() => setModal(null)}
      />

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
