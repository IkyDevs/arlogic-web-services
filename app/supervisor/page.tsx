"use client";

import { useEffect, useState, useCallback } from "react";
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
  Wallet,
  Wrench,
  ReceiptText,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import ReportModal from "@/components/ui/ReportModal";
import UserAvatar from "@/components/ui/UserAvatar";
import BranchComparisonTable from "@/components/supervisor/BranchComparisonTable";
import BranchDetailModal from "@/components/supervisor/BranchDetailModal";
import BranchPerformancePanel from "@/components/supervisor/BranchPerformancePanel";
import RevenueChart from "@/components/supervisor/RevenueChart";
import ServiceStatusPanel, {
  type StatusSlice,
} from "@/components/supervisor/ServiceStatusPanel";
import SupervisorAlerts, {
  type SupervisorAlert,
} from "@/components/supervisor/SupervisorAlerts";
import { countStatus } from "@/components/supervisor/BranchStatsCard";
import { formatRupiah } from "@/lib/domain/shared/formatters";

type Tab = "overview" | "users";
type Period = "hari" | "minggu" | "bulan" | "tahun" | "custom";

interface BranchRevenue {
  revenue: number;
  count: number;
  expenses: number;
  serviceCount: number;
}

export default function SupervisorDashboard() {
  const { user, logout } = useAuthStore();
  const { branches } = useBranch();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [showReport, setShowReport] = useState(false);

  const [branchStats, setBranchStats] = useState<
    Record<string, { services: number; teknisi: number }>
  >({});
  const [serviceStatus, setServiceStatus] = useState<
    Record<string, Record<string, number>>
  >({});
  const [teknisiWorkload, setTeknisiWorkload] = useState<
    Record<string, Array<{ name: string; active: number }>>
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
  const [period, setPeriod] = useState<Period | "custom">("hari");
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("");
  const [branchRevenue, setBranchRevenue] = useState<
    Record<string, BranchRevenue>
  >({});
  const [prevTotals, setPrevTotals] = useState({
    revenue: 0,
    count: 0,
    expenses: 0,
    serviceCount: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const [detailBranch, setDetailBranch] = useState<{
    id: string;
    name: string;
    code?: string;
  } | null>(null);

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
      let end = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
      );

      if (p === "minggu") {
        start = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 6,
          0,
          0,
          0,
        );
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
        );
      } else if (p === "bulan") {
        // Last 30 days (same as Owner Dashboard)
        start = new Date(now);
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
        );
      } else if (p === "tahun") {
        // Last 365 days (same as Owner Dashboard)
        start = new Date(now);
        start.setDate(start.getDate() - 365);
        start.setHours(0, 0, 0, 0);
        end = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          23,
          59,
          59,
        );
      }

      return { start: start.toISOString(), end: end.toISOString() };
    },
    [],
  );

  const activeRange = useCallback((): { start: string; end: string } => {
    if (dateRangeStart) {
      const s = new Date(dateRangeStart);
      const e = dateRangeEnd ? new Date(dateRangeEnd) : new Date(dateRangeStart);
      return {
        start: s.toISOString(),
        end: new Date(e.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      };
    }
    return getDateRange(period);
  }, [dateRangeStart, dateRangeEnd, period, getDateRange]);

  const clearCustom = () => {
    setDateRangeStart("");
    setDateRangeEnd("");
  };

  const fetchStats = useCallback(async () => {
    if (branches.length === 0) {
      setLoadingStats(false);
      return;
    }
    setLoadingStats(true);
    const { start, end } = activeRange();
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

    // Periode sebelumnya untuk perbandingan KPI (window paralel sebelum rentang aktif)
    const spanMs = new Date(end).getTime() - new Date(start).getTime();
    const prevStart = new Date(new Date(start).getTime() - spanMs).toISOString();
    const prevEnd = new Date(new Date(start).getTime() - 1).toISOString();
    const { data: prevRows } = await supabase
      .from("layanan")
      .select("nominal, jenis_layanan")
      .gte("created_at", prevStart)
      .lte("created_at", prevEnd);
    let prevRevenue = 0,
      prevExpenses = 0;
    for (const r of prevRows || []) {
      if (r.jenis_layanan === "pengeluaran") prevExpenses += r.nominal || 0;
      else prevRevenue += r.nominal || 0;
    }
    const { count: prevSvc } = await supabase
      .from("service_orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", prevStart)
      .lte("created_at", prevEnd);
    setPrevTotals({
      revenue: prevRevenue,
      count: prevRows?.length || 0,
      expenses: prevExpenses,
      serviceCount: prevSvc || 0,
    });
    setLoadingStats(false);
  }, [branches, supabase, activeRange]);

  const fetchOverview = useCallback(async () => {
    if (branches.length === 0) return;
    const { start, end } = activeRange();
    const stats: Record<string, { services: number; teknisi: number }> = {};
    for (const b of branches) {
      const [{ count: svc }, { count: teks }] = await Promise.all([
        supabase
          .from("service_orders")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", b.id)
          .gte("created_at", start)
          .lte("created_at", end),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("branch_id", b.id)
          .eq("role", "teknisi"),
      ]);
      stats[b.id] = { services: svc || 0, teknisi: teks || 0 };
    }
    setBranchStats(stats);
  }, [branches, supabase, activeRange]);

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

  const fetchServiceStatus = useCallback(async () => {
    const { start, end } = activeRange();
    const { data } = await supabase
      .from("service_orders")
      .select("branch_id, status")
      .gte("created_at", start)
      .lte("created_at", end)
      .limit(10000);
    if (!data) return;
    const out: Record<string, Record<string, number>> = {};
    for (const r of data) {
      if (!out[r.branch_id]) out[r.branch_id] = {};
      out[r.branch_id][r.status] = (out[r.branch_id][r.status] || 0) + 1;
    }
    setServiceStatus(out);
  }, [supabase, activeRange]);

  const fetchTeknisiWorkload = useCallback(async () => {
    const { start, end } = activeRange();
    const { data: teks } = await supabase
      .from("profiles")
      .select("id, full_name, branch_id")
      .eq("role", "teknisi");
    if (!teks?.length) return;
    const ids = teks.map((t: any) => t.id);
    const { data: active } = await supabase
      .from("service_orders")
      .select("assigned_teknisi_id")
      .in("assigned_teknisi_id", ids)
      .in("status", [
        "assigned",
        "in_progress",
        "waiting_sparepart",
        "sparepart_ready",
        "qc_pending",
      ])
      .gte("created_at", start)
      .lte("created_at", end);
    const countMap: Record<string, number> = {};
    for (const r of active || []) {
      countMap[r.assigned_teknisi_id] = (countMap[r.assigned_teknisi_id] || 0) + 1;
    }
    const perBranch: Record<string, Array<{ name: string; active: number }>> = {};
    for (const t of teks) {
      if (!perBranch[t.branch_id]) perBranch[t.branch_id] = [];
      perBranch[t.branch_id].push({ name: t.full_name, active: countMap[t.id] || 0 });
    }
    setTeknisiWorkload(perBranch);
  }, [supabase, activeRange]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchServiceStatus();
      fetchTeknisiWorkload();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchServiceStatus, fetchTeknisiWorkload]);

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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_orders" },
        () => {
          fetchServiceStatus();
          fetchTeknisiWorkload();
          fetchOverview();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchStats, fetchServiceStatus, fetchTeknisiWorkload, fetchOverview]);

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

  // Calculate summary totals
  const calculateSummary = () => {
    const branchesToSum = selectedBranchFilter
      ? Object.entries(branchRevenue).filter(
          ([key]) => key === selectedBranchFilter,
        )
      : Object.entries(branchRevenue);

    let totalRevenue = 0,
      totalCount = 0,
      totalExpenses = 0,
      totalServices = 0;
    for (const [, st] of branchesToSum) {
      totalRevenue += st.revenue;
      totalCount += st.count;
      totalExpenses += st.expenses;
      totalServices += st.serviceCount;
    }
    return { totalRevenue, totalCount, totalExpenses, totalServices };
  };

  // Filter displayed branches
  const displayedBranches = selectedBranchFilter
    ? branches.filter((b) => b.id === selectedBranchFilter)
    : branches;

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

  // ── Derivasi dashboard (data nyata dari state fetch) ──
  const statusTotals: Record<string, number> = {};
  for (const b of displayedBranches) {
    const st = serviceStatus[b.id] || {};
    for (const [k, v] of Object.entries(st)) statusTotals[k] = (statusTotals[k] || 0) + v;
  }
  const statusDefs: StatusSlice[] = [
    { key: "pending", label: "Pending", value: countStatus(statusTotals, ["pending"]), color: "#94a3b8" },
    { key: "digarap", label: "Digarap", value: countStatus(statusTotals, ["assigned", "in_progress"]), color: "#3b82f6" },
    { key: "nunggu", label: "Nunggu", value: countStatus(statusTotals, ["waiting_sparepart", "sparepart_ready"]), color: "#f59e0b" },
    { key: "qc", label: "QC", value: countStatus(statusTotals, ["qc_pending", "revision_required"]), color: "#8b5cf6" },
    { key: "selesai", label: "Selesai", value: countStatus(statusTotals, ["completed"]), color: "#10b981" },
    { key: "batal", label: "Batal", value: countStatus(statusTotals, ["cancelled"]), color: "#ef4444" },
  ];
  const statusSlices = statusDefs;
  const statusTotalService = statusDefs.reduce((s, d) => s + d.value, 0);

  const displayedTotalRevenue = displayedBranches.reduce(
    (s, b) => s + (branchRevenue[b.id]?.revenue || 0),
    0,
  );
  const perfRows = displayedBranches
    .map((b) => {
      const st = branchRevenue[b.id] || { revenue: 0, count: 0, expenses: 0, serviceCount: 0 };
      const s = branchStats[b.id];
      const teks = teknisiWorkload[b.id] || [];
      return {
        branch: { id: b.id, name: b.name, code: b.code },
        revenue: st.revenue,
        count: st.count,
        services: s?.services || 0,
        expenses: st.expenses,
        teknisiCount: s?.teknisi || teks.length || 0,
        activeLoad: teks.reduce((a, t) => a + t.active, 0),
        contribution: displayedTotalRevenue > 0 ? (st.revenue / displayedTotalRevenue) * 100 : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const chartData = displayedBranches.map((b) => ({
    name: b.name,
    pendapatan: branchRevenue[b.id]?.revenue || 0,
  }));

  const alerts: SupervisorAlert[] = (() => {
    const list: SupervisorAlert[] = [];
    if (statusTotalService > 0) {
      const pendingShare = statusDefs[0].value / statusTotalService;
      if (pendingShare >= 0.3) {
        list.push({
          severity: "warning",
          title: `${statusDefs[0].value} service masih pending`,
          detail: `${Math.round(pendingShare * 100)}% dari service dalam periode ini berada di status Pending.`,
        });
      }
      const digarapVal = statusDefs[1].value;
      if (digarapVal > 0 && digarapVal / statusTotalService >= 0.5) {
        list.push({
          severity: "info",
          title: `Aktivitas pengerjaan tinggi (${digarapVal} digarap)`,
          detail: "Mayoritas service sedang dalam proses pengerjaan.",
        });
      }
    }
    for (const b of displayedBranches) {
      const teks = teknisiWorkload[b.id] || [];
      if (teks.length === 0 && branchStats[b.id]?.services) {
        list.push({
          severity: "warning",
          title: `Cabang ${b.name} belum punya teknisi`,
          detail: "Cabang ini mencatat service tetapi tidak memiliki teknisi terdaftar.",
        });
      }
    }
    const totalExp = displayedBranches.reduce((s, b) => s + (branchRevenue[b.id]?.expenses || 0), 0);
    if (displayedTotalRevenue > 0 && totalExp >= 0.5 * displayedTotalRevenue) {
      list.push({
        severity: "warning",
        title: "Pengeluaran tinggi",
        detail: `Pengeluaran ${formatRupiah(totalExp)} mencapai ${Math.round((totalExp / displayedTotalRevenue) * 100)}% dari pendapatan periode ini.`,
      });
    }
    if (displayedBranches.length > 1) {
      const withRev = perfRows.filter((r) => r.revenue > 0);
      if (withRev.length > 0) {
        const best = withRev[0];
        list.push({
          severity: "info",
          title: `Performa terbaik: ${best.branch.name}`,
          detail: `${formatRupiah(best.revenue)} pendapatan, ${best.contribution.toFixed(1)}% dari total.`,
        });
        if (withRev.length > 1) {
          const worst = withRev[withRev.length - 1];
          list.push({
            severity: "info",
            title: `Perlu perhatian: ${worst.branch.name}`,
            detail: `Pendapatan terendah ${formatRupiah(worst.revenue)} di antara cabang lain.`,
          });
        }
      }
    }
    return list.slice(0, 5);
  })();

  return (
    <div className="h-screen supports-[height:100dvh]:h-dvh overflow-hidden bg-[#eef4fa] dark:bg-[#0a0a0a] flex flex-col lg:flex-row">
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
      <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden p-4 md:p-6 lg:p-6 pb-20 lg:pb-0">
        <div className="flex-shrink-0 flex flex-col gap-3">
          {/* Header: greeting + actions/filters */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {tab === "overview"
                  ? `${(() => {
                      const h = new Date().getHours();
                      if (h < 11) return "Selamat pagi";
                      if (h < 15) return "Selamat siang";
                      if (h < 19) return "Selamat sore";
                      return "Selamat malam";
                    })()}, ${user?.full_name?.split(" ")[0] || "Supervisor"} 👋`
                  : "Kelola User"}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {tab === "overview"
                  ? "Ringkasan performa seluruh cabang untuk periode aktif."
                  : "Kelola user & rolling teknisi per cabang."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1 bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200/70 dark:border-white/10 p-1">
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
                    onClick={() => {
                      clearCustom();
                      setPeriod(p.id);
                    }}
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

              {dateRangeStart && (
                <button
                  onClick={() => {
                    setDateRangeStart("");
                    setDateRangeEnd("");
                  }}
                  aria-label="Reset date filter"
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 transition-all focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              )}

              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                aria-label="Filter by branch"
                className="px-3 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200/70 dark:border-white/10 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
              >
                <option value="">Semua Cabang</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>

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
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">

            {/* KPI Overview */}
            {(() => {
              const summary = calculateSummary();
              const pct = (cur: number, prev: number) =>
                prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
              const kpis = [
                {
                  key: "pendapatan",
                  label: "Total Pendapatan",
                  value: formatRupiah(summary.totalRevenue),
                  trend: pct(summary.totalRevenue, prevTotals.revenue),
                  Icon: Wallet,
                  accent: true,
                  sub: `${displayedBranches.length} cabang`,
                },
                {
                  key: "transaksi",
                  label: "Total Transaksi",
                  value: String(summary.totalCount),
                  trend: pct(summary.totalCount, prevTotals.count),
                  Icon: ReceiptText,
                  accent: false,
                  sub: "transaksi masuk",
                },
                {
                  key: "service",
                  label: "Total Service",
                  value: String(summary.totalServices),
                  trend: pct(summary.totalServices, prevTotals.serviceCount),
                  Icon: Wrench,
                  accent: false,
                  sub: "service order",
                },
                {
                  key: "pengeluaran",
                  label: "Total Pengeluaran",
                  value: formatRupiah(summary.totalExpenses),
                  trend: pct(summary.totalExpenses, prevTotals.expenses),
                  Icon: TrendingDown,
                  accent: false,
                  sub: "dalam periode",
                },
              ];
              return (
                <div className="flex-shrink-0 grid grid-cols-2 xl:grid-cols-4 gap-3">
                  {loadingStats
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-28 animate-pulse bg-gray-100 dark:bg-white/5 rounded-2xl"
                        />
                      ))
                    : kpis.map((k) => (
                        <div
                          key={k.key}
                          className={`rounded-2xl border p-4 bg-white dark:bg-[#1c1c1c] ${
                            k.accent
                              ? "border-blue-200/70 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-900/10"
                              : "border-gray-200/70 dark:border-white/10"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                k.accent
                                  ? "bg-blue-600 text-white"
                                  : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300"
                              }`}
                            >
                              <k.Icon className="w-4 h-4" aria-hidden="true" />
                            </span>
                            {k.trend !== null && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  k.trend >= 0
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {k.trend >= 0 ? "↑" : "↓"} {Math.abs(k.trend)}%
                              </span>
                            )}
                          </div>
                          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                            {k.value}
                          </p>
                          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {k.label}
                          </p>
                          <p className="text-[9px] text-gray-400 mt-0.5">{k.sub}</p>
                        </div>
                      ))}
                </div>
              );
            })()}

            {/* Supervisor Insight */}
            {alerts.length > 0 && (
              <div className="flex-shrink-0">
                <SupervisorAlerts alerts={alerts} />
              </div>
            )}

            {/* Performance & Insight */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
              <div className="xl:col-span-2">
                <BranchPerformancePanel
                  rows={perfRows}
                  loading={loadingStats}
                  onSelect={(branch) => setDetailBranch(branch)}
                />
              </div>
              <div className="order-first xl:order-none w-full">
                <ServiceStatusPanel
                  slices={statusSlices}
                  total={statusTotalService}
                  loading={loadingStats}
                />
              </div>
            </div>

            <RevenueChart data={chartData} loading={loadingStats} />

            <div className="flex-shrink-0 min-h-0">
            <BranchComparisonTable
              rows={displayedBranches.map((b) => {
                const st = branchRevenue[b.id];
                const s = branchStats[b.id];
                const status = serviceStatus[b.id] || {};
                const teks = teknisiWorkload[b.id] || [];
                return {
                  branchName: b.name,
                  revenue: st?.revenue || 0,
                  transactions: st?.count || 0,
                  services: s?.services || 0,
                  status,
                  teknisiCount: s?.teknisi || teks.length || 0,
                  activeLoad: teks.reduce((a, t) => a + t.active, 0),
                  expenses: st?.expenses || 0,
                };
              })}
            />
            </div>
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

      {detailBranch && (
        <BranchDetailModal
          branch={detailBranch}
          range={activeRange()}
          revenue={
            branchRevenue[detailBranch.id]?.revenue || 0
          }
          transactions={branchRevenue[detailBranch.id]?.count || 0}
          expenses={branchRevenue[detailBranch.id]?.expenses || 0}
          status={serviceStatus[detailBranch.id] || {}}
          teknisi={teknisiWorkload[detailBranch.id] || []}
          onClose={() => setDetailBranch(null)}
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
