"use client";

// ─── Supervisor Dashboard Data Layer ───────────────────────────────
// Ekstraksi dari app/supervisor/page.tsx. Logika query existing
// dipertahankan (formula KPI identik), dikonsolidasi agar tidak ada
// duplicate fetching:
//   - 1 query `layanan` window ganda (periode aktif + periode sebelumnya)
//   - 1 query `service_orders` window ganda
//   - 1 query profiles (teknisi) — dipakai bersama workload & ranking
//   - 1 head-count customers
// Realtime channel tetap sama seperti implementasi lama.

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import {
  SERVICE_STATUS_META,
  TEKNISI_ACTIVE_STATUSES,
  OPEN_SERVICE_STATUSES,
  countStatus,
} from "@/lib/domain/serviceStatus";
import type { TrendBucket } from "@/lib/domain/shared/timeseries";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import type { StatusSlice } from "@/components/supervisor/ServiceStatusPanel";
import type { SupervisorAlert } from "@/components/supervisor/SupervisorAlerts";

export type SupervisorPeriod = "hari" | "minggu" | "bulan" | "tahun" | "custom";

export interface LayananRowLite {
  id: string;
  customer_name: string | null;
  jenis_layanan: string | null;
  nominal: number | null;
  metode_pembayaran: string | null;
  metode_pembayaran_1: string | null;
  metode_pembayaran_2: string | null;
  nominal_1: number | null;
  nominal_2: number | null;
  split_payment: boolean | null;
  status: string | null;
  branch_id: string | null;
  created_at: string | null;
}

export interface ServiceRowLite {
  id: string;
  invoice_number: string | null;
  customer_name: string | null;
  category: string | null;
  status: string | null;
  branch_id: string | null;
  assigned_teknisi_id: string | null;
  created_at: string | null;
  completed_at: string | null;
  done_date: string | null;
}

interface TeknisiProfileRow {
  id: string;
  full_name: string;
  branch_id: string | null;
}

export interface RecentTransaction extends LayananRowLite {
  branchName: string;
}

export interface RecentService extends ServiceRowLite {
  branchName: string;
  teknisiName: string;
}

export interface PaymentSlice {
  key: string;
  label: string;
  count: number;
  nominal: number;
  pct: number;
}

export interface TechnicianPerfRow {
  id: string;
  name: string;
  branchName: string;
  total: number;
  completed: number;
  active: number;
  completionRate: number;
}

export interface BranchPerfRow {
  branch: { id: string; name: string; code?: string };
  revenue: number;
  count: number;
  services: number;
  expenses: number;
  teknisiCount: number;
  activeLoad: number;
  contribution: number;
  pending: number;
  completed: number;
  completionRate: number;
}

function getWindow(p: SupervisorPeriod, customStart: string, customEnd: string): { start: string; end: string } {
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

function defaultBucket(range: { start: string; end: string }): TrendBucket {
  const days =
    (new Date(range.end).getTime() - new Date(range.start).getTime()) / 86_400_000;
  if (days <= 2) return "harian";
  if (days <= 45) return "harian";
  if (days <= 120) return "mingguan";
  return "bulanan";
}

function pctChange(cur: number, prev: number): number | null {
  return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
}

function isExpenseRow(jenis: string | null): boolean {
  return jenis === "pengeluaran";
}

export function useSupervisorDashboard() {
  const { branches } = useBranch();
  const supabase = createClient();

  // ── Filter state (dipindah apa adanya dari page) ──
  const [period, setPeriod] = useState<SupervisorPeriod>("hari");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("");

  // ── Raw data state ──
  const [layananRows, setLayananRows] = useState<LayananRowLite[]>([]);
  const [serviceRows, setServiceRows] = useState<ServiceRowLite[]>([]);
  const [teknisiProfiles, setTeknisiProfiles] = useState<TeknisiProfileRow[]>([]);
  const [customersCount, setCustomersCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const range = getWindow(period, dateRangeStart, dateRangeEnd);
  const spanMs = new Date(range.end).getTime() - new Date(range.start).getTime();
  const prevRange = {
    start: new Date(new Date(range.start).getTime() - spanMs).toISOString(),
    end: new Date(new Date(range.start).getTime() - 1).toISOString(),
  };

  const clearCustomDates = useCallback(() => {
    setDateRangeStart("");
    setDateRangeEnd("");
  }, []);

  const fetchLayananRows = useCallback(async () => {
    const { start, end } = getWindow(period, dateRangeStart, dateRangeEnd);
    const pStart = new Date(
      new Date(start).getTime() -
        (new Date(end).getTime() - new Date(start).getTime()),
    ).toISOString();
    const { data } = await supabase
      .from("layanan")
      .select(
        "id, customer_name, jenis_layanan, nominal, metode_pembayaran, metode_pembayaran_1, metode_pembayaran_2, nominal_1, nominal_2, split_payment, status, branch_id, created_at",
      )
      .gte("created_at", pStart)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(20000);
    setLayananRows(data || []);
  }, [supabase, period, dateRangeStart, dateRangeEnd]);

  const fetchServiceRows = useCallback(async () => {
    const { start, end } = getWindow(period, dateRangeStart, dateRangeEnd);
    const pStart = new Date(
      new Date(start).getTime() -
        (new Date(end).getTime() - new Date(start).getTime()),
    ).toISOString();
    const { data } = await supabase
      .from("service_orders")
      .select(
        "id, invoice_number, customer_name, category, status, branch_id, assigned_teknisi_id, created_at, completed_at, done_date",
      )
      .gte("created_at", pStart)
      .lte("created_at", end)
      .order("created_at", { ascending: false })
      .limit(20000);
    setServiceRows(data || []);
  }, [supabase, period, dateRangeStart, dateRangeEnd]);

  const fetchTeknisiProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, branch_id")
      .eq("role", "teknisi");
    setTeknisiProfiles(data || []);
  }, [supabase]);

  const fetchCustomersCount = useCallback(async () => {
    let q = supabase
      .from("customers")
      .select("id", { count: "exact", head: true });
    if (selectedBranchFilter) q = q.eq("branch_id", selectedBranchFilter);
    const { count } = await q;
    setCustomersCount(count ?? null);
  }, [supabase, selectedBranchFilter]);

  const refreshAll = useCallback(async () => {
    if (branches.length === 0) {
      setLoading(false);
      return;
    }
    setRefreshing(true);
    try {
      await Promise.all([
        fetchLayananRows(),
        fetchServiceRows(),
        fetchTeknisiProfiles(),
        fetchCustomersCount(),
      ]);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [branches.length, fetchLayananRows, fetchServiceRows, fetchTeknisiProfiles, fetchCustomersCount]);

  useEffect(() => {
    const t = setTimeout(refreshAll, 0);
    return () => clearTimeout(t);
  }, [refreshAll]);

  useEffect(() => {
    const t = setTimeout(fetchCustomersCount, 0);
    return () => clearTimeout(t);
  }, [fetchCustomersCount]);

  useEffect(() => {
    const channel = supabase
      .channel("supervisor-stats")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "layanan" },
        () => {
          fetchLayananRows();
          fetchCustomersCount();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_orders" },
        () => {
          fetchServiceRows();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, fetchLayananRows, fetchServiceRows, fetchCustomersCount]);

  // ── Derived snapshot ──
  const snapshot = useMemo(() => {
    const startMs = new Date(range.start).getTime();
    const endMs = new Date(range.end).getTime();

    const ts = (v: string | null | undefined) =>
      v ? new Date(v).getTime() : NaN;

    const curTx = layananRows.filter((r) => {
      const t = ts(r.created_at);
      return !Number.isNaN(t) && t >= startMs && t <= endMs;
    });
    const prevTx = layananRows.filter((r) => {
      const t = ts(r.created_at);
      return !Number.isNaN(t) && t >= new Date(prevRange.start).getTime() && t <= new Date(prevRange.end).getTime();
    });
    const curSvc = serviceRows.filter((r) => {
      const t = ts(r.created_at);
      return !Number.isNaN(t) && t >= startMs && t <= endMs;
    });
    const prevSvc = serviceRows.filter((r) => {
      const t = ts(r.created_at);
      return !Number.isNaN(t) && t >= new Date(prevRange.start).getTime() && t <= new Date(prevRange.end).getTime();
    });

    const branchNameOf = (id: string | null) =>
      branches.find((b) => b.id === id)?.name || "-";

    // Formula identik dengan fetchStats lama:
    // expenses hanya jenis_layanan === "pengeluaran"; count = seluruh baris.
    const branchRevenueMap: Record<string, { revenue: number; count: number; expenses: number }> = {};
    for (const b of branches) branchRevenueMap[b.id] = { revenue: 0, count: 0, expenses: 0 };
    let totalRevenue = 0, totalCount = 0, totalExpenses = 0;
    for (const r of curTx) {
      const n = r.nominal || 0;
      if (r.branch_id && branchRevenueMap[r.branch_id]) {
        const cell = branchRevenueMap[r.branch_id];
        cell.count += 1;
        if (isExpenseRow(r.jenis_layanan)) cell.expenses += n;
        else cell.revenue += n;
      }
      if (isExpenseRow(r.jenis_layanan)) totalExpenses += n;
      else totalRevenue += n;
      totalCount += 1;
    }

    // prevTotals: TIDAK difilter cabang — mempertahankan perilaku lama.
    let prevRevenue = 0, prevCount = 0, prevExpenses = 0;
    for (const r of prevTx) {
      if (isExpenseRow(r.jenis_layanan)) prevExpenses += r.nominal || 0;
      else prevRevenue += r.nominal || 0;
      prevCount += 1;
    }

    const statusByBranch: Record<string, Record<string, number>> = {};
    for (const r of curSvc) {
      if (!r.branch_id) continue;
      const cell = (statusByBranch[r.branch_id] ||= {});
      cell[r.status || "unknown"] = (cell[r.status || "unknown"] || 0) + 1;
    }

    const servicesPerBranch: Record<string, number> = {};
    for (const r of curSvc) {
      if (!r.branch_id) continue;
      servicesPerBranch[r.branch_id] = (servicesPerBranch[r.branch_id] || 0) + 1;
    }
    const totalServices = Object.values(servicesPerBranch).reduce((a, b) => a + b, 0);
    const prevTotalServices = prevSvc.length;

    const teknisiPerBranch: Record<string, TeknisiProfileRow[]> = {};
    for (const t of teknisiProfiles) {
      if (!t.branch_id) continue;
      (teknisiPerBranch[t.branch_id] ||= []).push(t);
    }

    const displayedBranches = selectedBranchFilter
      ? branches.filter((b) => b.id === selectedBranchFilter)
      : branches;

    const statusTotals: Record<string, number> = {};
    for (const b of displayedBranches) {
      const st = statusByBranch[b.id] || {};
      for (const [k, v] of Object.entries(st)) statusTotals[k] = (statusTotals[k] || 0) + v;
    }

    const statusSlices: StatusSlice[] = SERVICE_STATUS_META.map((m) => ({
      key: m.key,
      label: m.label,
      value: countStatus(statusTotals, m.match),
      color: m.color,
    }));
    const statusTotalService = statusSlices.reduce((s, d) => s + d.value, 0);

    const pendingStageDefs = SERVICE_STATUS_META.filter((m) =>
      ["pending", "digarap", "nunggu", "qc"].includes(m.key),
    );
    const pendingStages = pendingStageDefs.map((m) => ({
      key: m.key,
      label: m.label,
      color: m.color,
      value: countStatus(statusTotals, m.match),
    }));
    const pendingTotal = pendingStages.reduce((s, d) => s + d.value, 0);

    const completedServices = countStatus(statusTotals, ["completed"]);
    const cancelledServices = countStatus(statusTotals, ["cancelled"]);
    const completionRate =
      statusTotalService > cancelledServices
        ? Math.round((completedServices / (statusTotalService - cancelledServices)) * 100)
        : 0;

    // ── Tren (bucket dari timestamp mentah, tanpa refetch) ──
    const bucketDefault = defaultBucket(range);
    const txTimestampsCur = curTx.map((r) => ts(r.created_at));
    const txTimestampsPrev = prevTx.map((r) => ts(r.created_at));
    const svcInCur = curSvc.map((r) => ts(r.created_at));
    const svcInPrev = prevSvc.map((r) => ts(r.created_at));

    // ── Tren: timestamp mentah untuk re-bucket di sisi komponen ──
    const openBacklog = curSvc.filter(
      (r) => (OPEN_SERVICE_STATUSES as readonly string[]).includes(r.status || ""),
    );
    const trendData = {
      range: { start: startMs, end: endMs },
      prevRange: {
        start: new Date(prevRange.start).getTime(),
        end: new Date(prevRange.end).getTime(),
      },
      txCur: txTimestampsCur,
      txPrev: txTimestampsPrev,
      svcInCur,
      svcInPrev,
      svcDoneCur: curSvc
        .map((r) => ts(r.completed_at || r.done_date))
        .filter((t) => !Number.isNaN(t)),
      svcDonePrev: prevSvc
        .map((r) => ts(r.completed_at || r.done_date))
        .filter((t) => !Number.isNaN(t)),
      backlogCur: openBacklog.map((r) => ts(r.created_at)),
      defaultBucket: bucketDefault,
    };

    // ── Metode pembayaran (baris pendapatan saja, split dipecah) ──
    const labelOfPayment = (key: string) =>
      ({
        cash: "Cash",
        qris: "QRIS",
        edc: "EDC",
        edc_mandiri: "EDC Mandiri",
        edc_bca: "EDC BCA",
        tf_bca: "Transfer BCA",
        tf_mandiri: "Transfer Mandiri",
        bri: "BRI",
        kudus: "Kudus",
        transfer: "Transfer",
      })[key] || key;
    const payAgg: Record<string, { count: number; nominal: number }> = {};
    let payNominalTotal = 0;
    for (const r of curTx) {
      if (isExpenseRow(r.jenis_layanan)) continue;
      if (r.split_payment && r.metode_pembayaran_1 && r.metode_pembayaran_2) {
        const n1 = r.nominal_1 || 0;
        const n2 = r.nominal_2 || 0;
        for (const [mk, n] of [
          [r.metode_pembayaran_1, n1],
          [r.metode_pembayaran_2, n2],
        ] as const) {
          payAgg[mk] ||= { count: 0, nominal: 0 };
          payAgg[mk].count += 1;
          payAgg[mk].nominal += n;
          payNominalTotal += n;
        }
        continue;
      }
      const mk = r.metode_pembayaran || "unknown";
      payAgg[mk] ||= { count: 0, nominal: 0 };
      payAgg[mk].count += 1;
      payAgg[mk].nominal += r.nominal || 0;
      payNominalTotal += r.nominal || 0;
    }
    const paymentBreakdown: PaymentSlice[] = Object.entries(payAgg)
      .map(([key, v]) => ({
        key,
        label: labelOfPayment(key),
        count: v.count,
        nominal: v.nominal,
        pct: payNominalTotal > 0 ? Math.round((v.nominal / payNominalTotal) * 100) : 0,
      }))
      .sort((a, b) => b.nominal - a.nominal);

    // ── Transaksi & service terbaru ──
    const recentTransactions: RecentTransaction[] = curTx
      .slice()
      .sort((a, b) => ts(b.created_at) - ts(a.created_at))
      .slice(0, 24)
      .map((r) => ({ ...r, branchName: branchNameOf(r.branch_id) }));

    const teknisiNameById = new Map(teknisiProfiles.map((t) => [t.id, t.full_name]));
    const recentServices: RecentService[] = curSvc
      .slice()
      .sort((a, b) => ts(b.created_at) - ts(a.created_at))
      .slice(0, 24)
      .map((r) => ({
        ...r,
        branchName: branchNameOf(r.branch_id),
        teknisiName: r.assigned_teknisi_id ? teknisiNameById.get(r.assigned_teknisi_id) || "-" : "-",
      }));

    // ── Performa teknisi (metrik turunan data existing) ──
    const techAgg: Record<string, { total: number; completed: number; active: number }> = {};
    for (const r of curSvc) {
      if (!r.assigned_teknisi_id) continue;
      const cell = (techAgg[r.assigned_teknisi_id] ||= { total: 0, completed: 0, active: 0 });
      cell.total += 1;
      if (r.status === "completed") cell.completed += 1;
      else if ((TEKNISI_ACTIVE_STATUSES as readonly string[]).includes(r.status || "")) cell.active += 1;
    }
    const technicianPerformance: TechnicianPerfRow[] = teknisiProfiles
      .map((t) => {
        const agg = techAgg[t.id];
        const total = agg?.total || 0;
        const completed = agg?.completed || 0;
        const active = agg?.active || 0;
        return {
          id: t.id,
          name: t.full_name,
          branchName: branchNameOf(t.branch_id),
          total,
          completed,
          active,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        };
      })
      .filter((t) => t.total > 0)
      .sort((a, b) => b.completed - a.completed || b.completionRate - a.completionRate || a.name.localeCompare(b.name))
      .slice(0, 10);

    // ── Performa cabang (shape kompatibel panel lama) ──
    const displayedRevenue = displayedBranches.reduce(
      (s, b) => s + (branchRevenueMap[b.id]?.revenue || 0),
      0,
    );
    const branchPerfRows: BranchPerfRow[] = displayedBranches
      .map((b) => {
        const st = branchRevenueMap[b.id] || { revenue: 0, count: 0, expenses: 0 };
        const stB = statusByBranch[b.id] || {};
        const svcTotal = servicesPerBranch[b.id] || 0;
        const svcCancelled = countStatus(stB, ["cancelled"]);
        const svcCompleted = countStatus(stB, ["completed"]);
        const teks = teknisiPerBranch[b.id] || [];
        const activeLoad = teks.reduce(
          (a, t) => a + (techAgg[t.id]?.active || 0),
          0,
        );
        return {
          branch: { id: b.id, name: b.name, code: b.code },
          revenue: st.revenue,
          count: st.count,
          services: svcTotal,
          expenses: st.expenses,
          teknisiCount: teks.length,
          activeLoad,
          contribution: displayedRevenue > 0 ? (st.revenue / displayedRevenue) * 100 : 0,
          pending: pendingStages.reduce((s, stage) => s + countStatus(stB, SERVICE_STATUS_META.find((m) => m.key === stage.key)!.match), 0),
          completed: svcCompleted,
          completionRate:
            svcTotal > svcCancelled ? Math.round((svcCompleted / (svcTotal - svcCancelled)) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    // Shape lama untuk RevenueChart & BranchComparisonTable (kontrak tak berubah)
    const chartData = displayedBranches.map((b) => ({
      name: b.name,
      pendapatan: branchRevenueMap[b.id]?.revenue || 0,
    }));
    const comparisonRows = displayedBranches.map((b) => ({
      branchName: b.name,
      revenue: branchRevenueMap[b.id]?.revenue || 0,
      transactions: branchRevenueMap[b.id]?.count || 0,
      services: servicesPerBranch[b.id] || 0,
      status: statusByBranch[b.id] || {},
      teknisiCount: (teknisiPerBranch[b.id] || []).length,
      activeLoad: (teknisiPerBranch[b.id] || []).reduce((a, t) => a + (techAgg[t.id]?.active || 0), 0),
      expenses: branchRevenueMap[b.id]?.expenses || 0,
    }));

    // ── Quick summary (semua turunan data nyata) ──
    const revenueRowCount = curTx.filter((r) => !isExpenseRow(r.jenis_layanan)).length;
    const avgTransaction = revenueRowCount > 0 ? Math.round(totalRevenue / revenueRowCount) : null;
    const doneDurationsH = curSvc
      .filter((r) => r.status === "completed" && r.completed_at && r.created_at)
      .map((r) => (ts(r.completed_at) - ts(r.created_at)) / 3_600_000)
      .filter((h) => Number.isFinite(h) && h >= 0);
    const avgServiceHours =
      doneDurationsH.length > 0
        ? doneDurationsH.reduce((a, b) => a + b, 0) / doneDurationsH.length
        : null;

    // ── Alerts: rule IDENTIK dengan implementasi lama ──
    const alerts: SupervisorAlert[] = (() => {
      const list: SupervisorAlert[] = [];
      if (statusTotalService > 0) {
        const pendingShare = statusSlices[0].value / statusTotalService;
        if (pendingShare >= 0.3) {
          list.push({
            severity: "warning",
            title: `${statusSlices[0].value} service masih pending`,
            detail: `${Math.round(pendingShare * 100)}% dari service dalam periode ini berada di status Pending.`,
          });
        }
        const digarapVal = statusSlices[1].value;
        if (digarapVal > 0 && digarapVal / statusTotalService >= 0.5) {
          list.push({
            severity: "info",
            title: `Aktivitas pengerjaan tinggi (${digarapVal} digarap)`,
            detail: "Mayoritas service sedang dalam proses pengerjaan.",
          });
        }
      }
      for (const b of displayedBranches) {
        const teks = teknisiPerBranch[b.id] || [];
        if (teks.length === 0 && servicesPerBranch[b.id]) {
          list.push({
            severity: "warning",
            title: `Cabang ${b.name} belum punya teknisi`,
            detail: "Cabang ini mencatat service tetapi tidak memiliki teknisi terdaftar.",
          });
        }
      }
      if (displayedRevenue > 0 && totalExpenses >= 0.5 * displayedRevenue) {
        list.push({
          severity: "warning",
          title: "Pengeluaran tinggi",
          detail: `Pengeluaran ${formatRupiah(totalExpenses)} mencapai ${Math.round((totalExpenses / displayedRevenue) * 100)}% dari pendapatan periode ini.`,
        });
      }
      if (displayedBranches.length > 1) {
        const withRev = branchPerfRows.filter((r) => r.revenue > 0);
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

    // Data mentah per-cabang untuk BranchDetailModal (shape kontrak lama)
    const branchDetailMaps = {
      revenue: branchRevenueMap,
      status: statusByBranch,
      teknisi: Object.fromEntries(
        Object.entries(teknisiPerBranch).map(([bid, teks]) => [
          bid,
          teks.map((t) => ({
            name: t.full_name,
            active: techAgg[t.id]?.active || 0,
          })),
        ]),
      ),
    };

    return {
      kpi: {
        totalRevenue,
        totalCount,
        totalExpenses,
        totalServices,
        pendingTotal,
        pendingPct: statusTotalService > 0 ? Math.round((pendingTotal / statusTotalService) * 100) : 0,
        completedServices,
        completionRate,
        trend: {
          revenue: pctChange(totalRevenue, prevRevenue),
          transactions: pctChange(totalCount, prevCount),
          services: pctChange(totalServices, prevTotalServices),
          expenses: pctChange(totalExpenses, prevExpenses),
        },
      },
      statusSlices,
      statusTotalService,
      pendingStages,
      pendingThresholdNote: "UNKNOWN" as const,
      trendData,
      paymentBreakdown,
      paymentNominalTotal: payNominalTotal,
      recentTransactions,
      recentServices,
      technicianPerformance,
      branchPerfRows,
      chartData,
      comparisonRows,
      branchDetailMaps,
      summary: {
        customersCount,
        avgTransaction,
        avgServiceHours,
        completionRate,
      },
      alerts,
      branchNameOf,
    };
  }, [
    layananRows,
    serviceRows,
    teknisiProfiles,
    customersCount,
    branches,
    selectedBranchFilter,
    range.start,
    range.end,
    prevRange.start,
    prevRange.end,
  ]);

  return {
    branches,
    period,
    setPeriod,
    dateRangeStart,
    setDateRangeStart,
    dateRangeEnd,
    setDateRangeEnd,
    clearCustomDates,
    selectedBranchFilter,
    setSelectedBranchFilter,
    loading,
    refreshing,
    refreshAll,
    ...snapshot,
  };
}
