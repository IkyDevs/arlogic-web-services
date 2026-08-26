"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
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
  RefreshCw,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import ReportModal from "@/components/ui/ReportModal";
import UserAvatar from "@/components/ui/UserAvatar";
import TransactionDetailModal from "@/components/ui/TransactionDetailModal";
import BranchComparisonTable from "@/components/supervisor/BranchComparisonTable";
import BranchDetailModal from "@/components/supervisor/BranchDetailModal";
import BranchPerformancePanel from "@/components/supervisor/BranchPerformancePanel";
import RevenueChart from "@/components/supervisor/RevenueChart";
import ServiceStatusPanel from "@/components/supervisor/ServiceStatusPanel";
import SupervisorAlerts from "@/components/supervisor/SupervisorAlerts";
import KPIStrip from "@/components/supervisor/KPIStrip";
import {
  TransactionTrendCard,
  ServiceTrendCard,
} from "@/components/supervisor/TrendSection";
import PendingServiceMonitor from "@/components/supervisor/PendingServiceMonitor";
import RecentTransactionsCard from "@/components/supervisor/RecentTransactionsCard";
import RecentServicesCard from "@/components/supervisor/RecentServicesCard";
import TechnicianPerformancePanel from "@/components/supervisor/TechnicianPerformancePanel";
import PaymentBreakdownCard from "@/components/supervisor/PaymentBreakdownCard";
import QuickSummaryStrip from "@/components/supervisor/QuickSummaryStrip";
import { useSupervisorDashboard } from "@/hooks/useSupervisorDashboard";
import { buildSeries } from "@/lib/domain/shared/timeseries";
import { fetchTransactionById } from "@/lib/domain/transaction/service";
import type { TransactionData } from "@/lib/domain/transaction/types";
import type { RecentTransaction } from "@/hooks/useSupervisorDashboard";

type Tab = "overview" | "users";

export default function SupervisorDashboard() {
  const { user, logout } = useAuthStore();
  const supabase = createClient();
  const dash = useSupervisorDashboard();
  const [tab, setTab] = useState<Tab>("overview");
  const [showReport, setShowReport] = useState(false);

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
    if (dash.branches.length > 0 && !newBranch) {
      const t = setTimeout(() => setNewBranch(dash.branches[0].id), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dash.branches, newBranch]);

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
        reason: `Rolling dari ${dash.branchNameOf(target.branch_id)} ke ${dash.branchNameOf(rollingBranch)} - ${rollingReason || "penugasan"}`,
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

  // ── Detail cabang & transaksi ──
  const [detailBranch, setDetailBranch] = useState<{
    id: string;
    name: string;
    code?: string;
  } | null>(null);

  const [txDetail, setTxDetail] = useState<TransactionData | null>(null);
  const [txLoadingId, setTxLoadingId] = useState<string | null>(null);
  const openTransaction = async (tx: RecentTransaction) => {
    setTxLoadingId(tx.id);
    try {
      const full = await fetchTransactionById(tx.id);
      if (full) setTxDetail(full);
      else toast.error("Transaksi tidak ditemukan");
    } catch {
      toast.error("Gagal memuat detail transaksi");
    } finally {
      setTxLoadingId(null);
    }
  };

  const sparkTx = useMemo(
    () =>
      buildSeries(
        dash.trendData.txCur,
        dash.trendData.range,
        dash.trendData.defaultBucket,
      ).slice(-14),
    [dash.trendData],
  );
  const sparkSvc = useMemo(
    () =>
      buildSeries(
        dash.trendData.svcInCur,
        dash.trendData.range,
        dash.trendData.defaultBucket,
      ).slice(-14),
    [dash.trendData],
  );

  const roleLabel: Record<string, string> = {
    teknisi: "Teknisi",
    admin: "Admin",
    qc: "QC",
    supervisor: "Supervisor",
    engineer: "Engineer",
    owner: "Owner",
  };

  return (
    <div className="h-screen supports-[height:100dvh]:h-dvh overflow-hidden bg-[#eef4fa] dark:bg-[#0a0a0a] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 bg-white dark:bg-[#1c1c1c] border-r border-gray-200 dark:border-white/10 flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-white/10">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Dashboard Supervisor
          </h1>
          <p className="text-xs text-gray-500">Monitoring Command Center</p>
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
        {/* Header */}
        <div className="flex-shrink-0 flex flex-col gap-3 mb-4">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {tab === "overview"
                  ? "Dashboard Supervisor"
                  : "Kelola User"}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {tab === "overview"
                  ? "Pantau transaksi dan service seluruh cabang secara real-time."
                  : "Kelola user & rolling teknisi per cabang."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Periode */}
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
                    onClick={() => {
                      dash.clearCustomDates();
                      dash.setPeriod(p.id);
                    }}
                    aria-pressed={dash.period === p.id}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 dark:focus:ring-offset-[#0a0a0a] ${dash.period === p.id ? "bg-slate-900 text-white" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Custom range */}
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                Dari
                <input
                  type="date"
                  value={dash.dateRangeStart}
                  onChange={(e) => dash.setDateRangeStart(e.target.value)}
                  aria-label="Dari tanggal"
                  className="bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                />
              </label>
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300">
                Sampai
                <input
                  type="date"
                  value={dash.dateRangeEnd}
                  min={dash.dateRangeStart || undefined}
                  onChange={(e) => dash.setDateRangeEnd(e.target.value)}
                  aria-label="Sampai tanggal"
                  className="bg-transparent text-xs font-semibold text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer"
                />
              </label>

              {dash.dateRangeStart && (
                <button
                  onClick={dash.clearCustomDates}
                  aria-label="Reset date filter"
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}

              {/* Cabang */}
              <select
                value={dash.selectedBranchFilter}
                onChange={(e) => dash.setSelectedBranchFilter(e.target.value)}
                aria-label="Filter by branch"
                className="px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
              >
                <option value="">Semua Cabang</option>
                {dash.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

              {/* Refresh */}
              <button
                onClick={() => dash.refreshAll()}
                disabled={dash.refreshing}
                aria-label="Refresh data"
                aria-busy={dash.refreshing}
                title="Refresh data"
                className="flex items-center justify-center w-8 h-8 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-gray-500 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-700 disabled:opacity-50 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
              >
                <RefreshCw
                  className={`w-4 h-4 ${dash.refreshing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
              </button>

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
            {/* CORE KPI */}
            <KPIStrip
              kpi={dash.kpi}
              txSpark={sparkTx}
              svcSpark={sparkSvc}
              loading={dash.loading}
            />

            {/* TREND TRANSAKSI + SERVICE */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <TransactionTrendCard data={dash.trendData} loading={dash.loading} />
              <ServiceTrendCard data={dash.trendData} loading={dash.loading} />
            </div>

            {/* STATUS SERVICE + PENDING */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <ServiceStatusPanel
                slices={dash.statusSlices}
                total={dash.statusTotalService}
                loading={dash.loading}
              />
              <PendingServiceMonitor
                stages={dash.pendingStages}
                totalServices={dash.statusTotalService}
                loading={dash.loading}
              />
            </div>

            {/* PERLU PERHATIAN */}
            {dash.alerts.length > 0 && (
              <section aria-label="Perlu perhatian" className="flex-shrink-0">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                  Perlu Perhatian
                </h3>
                <SupervisorAlerts alerts={dash.alerts} />
              </section>
            )}

            {/* TRANSAKSI TERBARU + SERVICE TERBARU */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <RecentTransactionsCard
                rows={dash.recentTransactions}
                loading={dash.loading}
                onSelect={openTransaction}
              />
              <RecentServicesCard rows={dash.recentServices} loading={dash.loading} />
            </div>

            {/* PERFORMA CABANG */}
            <section aria-label="Performa cabang" className="flex flex-col gap-4">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                <div className="xl:col-span-2 min-w-0">
                  <BranchPerformancePanel
                    rows={dash.branchPerfRows}
                    loading={dash.loading}
                    onSelect={(branch) => setDetailBranch(branch)}
                  />
                </div>
                <div className="min-w-0">
                  <RevenueChart data={dash.chartData} loading={dash.loading} />
                </div>
              </div>
              <BranchComparisonTable rows={dash.comparisonRows} />
            </section>

            {/* PERFORMA TEKNISI */}
            <TechnicianPerformancePanel
              rows={dash.technicianPerformance}
              loading={dash.loading}
            />

            {/* PAYMENT INSIGHT + QUICK SUMMARY */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
              <PaymentBreakdownCard
                slices={dash.paymentBreakdown}
                totalNominal={dash.paymentNominalTotal}
                loading={dash.loading}
              />
              <div className="lg:col-span-2 flex">
                <QuickSummaryStrip summary={dash.summary} />
              </div>
            </div>
          </div>
        )}

        {txLoadingId && (
          <div
            className="fixed inset-0 z-[95] flex items-center justify-center bg-black/30"
            role="status"
            aria-label="Memuat detail transaksi"
          >
            <Loader2 className="w-6 h-6 animate-spin text-white" aria-hidden="true" />
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
                    {dash.branches.map((b) => (
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
                          {u.full_name} ({dash.branchNameOf(u.branch_id)})
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
                    {dash.branches.map((b) => (
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
                        {dash.branchNameOf(u.branch_id)}
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

      {detailBranch && (
        <BranchDetailModal
          branch={detailBranch}
          range={{
            start: dash.trendData.range.start
              ? new Date(dash.trendData.range.start).toISOString()
              : "",
            end: dash.trendData.range.end
              ? new Date(dash.trendData.range.end).toISOString()
              : "",
          }}
          revenue={
            (detailBranch &&
              dash.branchDetailMaps.revenue[detailBranch.id]?.revenue) ||
            0
          }
          transactions={
            (detailBranch &&
              dash.branchDetailMaps.revenue[detailBranch.id]?.count) ||
            0
          }
          expenses={
            (detailBranch &&
              dash.branchDetailMaps.revenue[detailBranch.id]?.expenses) ||
            0
          }
          status={
            (detailBranch && dash.branchDetailMaps.status[detailBranch.id]) || {}
          }
          teknisi={
            (detailBranch && dash.branchDetailMaps.teknisi[detailBranch.id]) || []
          }
          onClose={() => setDetailBranch(null)}
        />
      )}

      {txDetail && (
        <TransactionDetailModal
          isOpen
          onClose={() => setTxDetail(null)}
          transaction={txDetail}
        />
      )}

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
