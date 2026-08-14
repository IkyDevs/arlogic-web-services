"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import { computeOwnerStats, computeDailySeries, type ServiceOrder, type Layanan, type Attendance } from "@/lib/owner/stats";
import {
  computeBranchPerformance,
  computeLeaderboard,
  computeQuickStats,
  computeRecentServices,
  computeMiniAnalytics,
  type FeedbackLike,
  type TechnicianProfileLike,
} from "@/lib/owner/aggregations";
import { computeBusinessHealth } from "@/lib/owner/business-health";
import { generateBusinessInsight } from "@/lib/owner/business-insight";
import { SLA_OVERDUE_STATUSES, ACTIVITY_MAX_ITEMS, KPI_SPARK_POINTS } from "@/constants/owner";
import type {
  BusinessInsight,
  BusinessSettings,
  DashboardSnapshot,
  KpiMetric,
  LiveActivityItem,
  TargetProgress,
} from "@/types/owner";

const EMPTY_SETTINGS: BusinessSettings = {
  id: "",
  branch_id: null,
  monthly_revenue_target: 150000000,
  daily_target: 5000000,
  sla_days: 7,
  currency: "IDR",
  business_start_hour: 9,
  business_end_hour: 21,
  dashboard_theme: "light",
  updated_at: "",
};

const DEFAULT_SETTINGS = EMPTY_SETTINGS;

const formatRupiah = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);

const DONE_STATUSES = ["completed", "done"];

function buildActivityFromRealtime(
  table: string,
  event: string,
  row: Record<string, unknown>,
): LiveActivityItem {
  const now = new Date();
  if (table === "layanan") {
    const jenis = String(row.jenis_layanan || "transaksi");
    const nominal = Number(row.nominal) || 0;
    const isExpense = jenis === "pengeluaran";
    return {
      id: `${event}-layanan-${row.id ?? now.getTime()}`,
      time: now,
      message: isExpense
        ? `Pengeluaran ${formatRupiah(nominal)} tercatat`
        : `Transaksi ${formatRupiah(nominal)} diterima`,
      tone: isExpense ? "warning" : "success",
    };
  }
  const customer = String(row.customer_name || "");
  const status = String(row.status || "");
  const customerPart = customer ? ` dari ${customer}` : "";
  let message = "";
  let tone: LiveActivityItem["tone"] = "info";
  if (event === "DELETE") {
    message = "Service dihapus";
    tone = "warning";
  } else if (status === "pending") {
    message = `Service masuk${customerPart}`;
    tone = "primary";
  } else if (status === "completed" || status === "done") {
    message = `Service ${status === "done" ? "diambil" : "selesai"}${customerPart}`;
    tone = "success";
  } else if (status === "qc_pending") {
    message = `Service masuk QC${customerPart}`;
    tone = "info";
  } else if (status === "rejected") {
    message = `Service di-recall${customerPart}`;
    tone = "warning";
  } else {
    message = `Service diperbarui${customerPart}`;
  }
  return {
    id: `${event}-${table}-${row.id ?? now.getTime()}`,
    time: now,
    message,
    tone,
  };
}

function buildKpis(
  stats: ReturnType<typeof computeOwnerStats>,
  settings: BusinessSettings,
  growthPct: number,
  dailyRevenue: number[],
): KpiMetric[] {
  const revenueTarget = settings.monthly_revenue_target || 1;
  const dailyTarget = settings.daily_target || 1;
  const spark = dailyRevenue.slice(-KPI_SPARK_POINTS);

  return [
    {
      key: "revenue",
      label: "Revenue",
      value: stats.revenue,
      displayValue: formatRupiah(stats.revenue),
      changePct: growthPct,
      target: settings.monthly_revenue_target,
      progress: Math.min(100, Math.round((stats.revenue / revenueTarget) * 100)),
      spark,
      tone: growthPct >= 0 ? "positive" : "negative",
    },
    {
      key: "today",
      label: "Revenue Hari Ini",
      value: stats.todayRevenue,
      displayValue: formatRupiah(stats.todayRevenue),
      changePct: 0,
      target: settings.daily_target,
      progress: Math.min(100, Math.round((stats.todayRevenue / dailyTarget) * 100)),
      spark: spark.slice(-2),
      tone: "positive",
    },
    {
      key: "services",
      label: "Total Service",
      value: stats.totalServices,
      displayValue: String(stats.totalServices),
      changePct: 0,
      target: null,
      progress: null,
      spark: [],
      tone: "default",
    },
    {
      key: "active",
      label: "Service Aktif",
      value: stats.activeServices,
      displayValue: String(stats.activeServices),
      changePct: 0,
      target: null,
      progress: null,
      spark: [],
      tone: "default",
    },
    {
      key: "expense",
      label: "Pengeluaran",
      value: stats.monthExpenses,
      displayValue: formatRupiah(stats.monthExpenses),
      changePct: 0,
      target: null,
      progress: null,
      spark: [],
      tone: "negative",
    },
    {
      key: "techs",
      label: "Teknisi Aktif",
      value: stats.activeTechnicians,
      displayValue: String(stats.activeTechnicians),
      changePct: 0,
      target: null,
      progress: null,
      spark: [],
      tone: "default",
    },
  ];
}

function buildTarget(
  stats: ReturnType<typeof computeOwnerStats>,
  settings: BusinessSettings,
  rangeDays: number,
): TargetProgress {
  const target = settings.monthly_revenue_target || 1;
  const achieved = stats.revenue;
  const progressPct = Math.min(100, Math.round((achieved / target) * 100));
  const remaining = Math.max(0, target - achieved);
  const avgDaily = rangeDays > 0 ? achieved / rangeDays : 0;
  const etaDays = avgDaily > 0 ? Math.ceil(remaining / avgDaily) : 0;
  return { target, achieved, progressPct, remaining, etaDays };
}

export interface OwnerDashboardOptions {
  dateRange: { start: Date; end: Date };
}

export function useOwnerDashboard({ dateRange }: OwnerDashboardOptions) {
  const supabase = useMemo(() => createClient(), []);
  const { activeBranchId, branches } = useBranch();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const branchMatch = useMemo(
    () => (activeBranchId ? { branch_id: activeBranchId } : {}),
    [activeBranchId],
  );
  const rangeDays =
    (dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000);

  const fetchAll = useCallback(async () => {
    const start = dateRange.start;
    const end = dateRange.end;
    const previousStart = new Date(start.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(start.getTime());

    const servicesQuery = supabase
      .from("service_orders")
      .select(
        "*, service_items(*), profiles:assigned_teknisi_id(full_name, avatar_url)",
      )
      .match(branchMatch)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const previousServicesQuery = supabase
      .from("service_orders")
      .select("*, service_items(*)")
      .match(branchMatch)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    const transactionsQuery = supabase
      .from("layanan")
      .select("*")
      .match(branchMatch)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const previousTransactionsQuery = supabase
      .from("layanan")
      .select("*")
      .match(branchMatch)
      .gte("created_at", previousStart.toISOString())
      .lte("created_at", previousEnd.toISOString());

    const attendancesQuery = supabase
      .from("attendances")
      .select("*")
      .match(branchMatch)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const [servicesRes, prevServicesRes, transactionsRes, prevTxRes, attendancesRes, profilesRes, settingsRes, feedbacksRes, branchesRes] =
      await Promise.all([
        servicesQuery,
        previousServicesQuery,
        transactionsQuery,
        previousTransactionsQuery,
        attendancesQuery,
        supabase.from("profiles").select("id, full_name, avatar_url"),
        supabase.from("business_settings").select("*").limit(20),
        supabase.from("feedbacks").select("rating, created_at"),
        branches.length > 0
          ? Promise.resolve({ data: branches, error: null })
          : supabase.from("branches").select("id, name"),
      ]);

    if (servicesRes.error || transactionsRes.error) {
      throw new Error("Gagal memuat data dashboard");
    }

    const services = (servicesRes.data || []) as ServiceOrder[];
    const transactions = (transactionsRes.data || []) as Layanan[];
    const attendances = (attendancesRes.data || []) as Attendance[];
    const profiles = (profilesRes.data || []) as TechnicianProfileLike[];
    const allSettings = (settingsRes.data || []) as BusinessSettings[];
    const settings =
      (activeBranchId
        ? allSettings.find((s) => s.branch_id === activeBranchId)
        : allSettings.find((s) => s.branch_id === null)) ||
      allSettings.find((s) => s.branch_id === null) ||
      DEFAULT_SETTINGS;
    const feedbacks = (feedbacksRes.data || []) as FeedbackLike[];
    const branchNameById = Object.fromEntries(
      ((branchesRes.data || []) as { id: string; name: string }[]).map((b) => [
        b.id,
        b.name,
      ]),
    );

    const stats = computeOwnerStats(
      { services, transactions, attendances, techProfiles: profiles },
      { now: new Date() },
    );

    const previousStats = computeOwnerStats(
      {
        services: (prevServicesRes.data || []) as ServiceOrder[],
        transactions: (prevTxRes.data || []) as Layanan[],
        attendances: [],
        techProfiles: [],
      },
      { now: new Date() },
    );

    const growthPct =
      previousStats.revenue === 0
        ? 0
        : ((stats.revenue - previousStats.revenue) / previousStats.revenue) * 100;

    const dailyRevenue = computeDailySeries(services, transactions, {
      start,
      end,
    }).map((d) => d.revenue);

    const branchRanking = computeBranchPerformance(
      services,
      transactions,
      branchNameById,
    );
    const leaderboard = computeLeaderboard(services, profiles);
    const quickStats = computeQuickStats(services, transactions);
    const recentServices = computeRecentServices(services, profiles);
    const mini = computeMiniAnalytics(services, transactions, feedbacks);

    const avgRating =
      feedbacks.length > 0
        ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
        : 0;

    const completedCount = services.filter((s) =>
      DONE_STATUSES.includes(s.status),
    ).length;
    const pendingCount = services.filter((s) => s.status === "pending").length;
    const recallCount = services.filter((s) => s.status === "rejected").length;
    const overdueCount = services.filter((s) => {
      if (SLA_OVERDUE_STATUSES.includes(s.status)) return false;
      const created = new Date(s.created_at);
      return (
        Date.now() - created.getTime() > settings.sla_days * 24 * 60 * 60 * 1000
      );
    }).length;

    const health = computeBusinessHealth({
      revenueGrowthPct: growthPct,
      completionRate:
        stats.totalServices > 0
          ? (completedCount / stats.totalServices) * 100
          : 0,
      pendingRatio: stats.totalServices > 0 ? pendingCount / stats.totalServices : 0,
      recallCount,
      avgRating,
    });

    const prevMonthExpenses =
      previousStats.monthExpenses > 0 ? previousStats.monthExpenses : 1;
    const expenseGrowthPct =
      ((stats.monthExpenses - prevMonthExpenses) / prevMonthExpenses) * 100;

    const insights: BusinessInsight[] = generateBusinessInsight({
      stats,
      previousRevenue: previousStats.revenue,
      branchRanking,
      leaderboard,
      overdueCount,
      slaDays: settings.sla_days,
      recallCount,
      previousRecall: 0,
      expenseGrowthPct,
      avgRating,
    });

    const seedActivity: LiveActivityItem[] = [...recentServices]
      .slice(0, 5)
      .map((r) => {
        const tone: LiveActivityItem["tone"] =
          r.status === "done" || r.status === "completed" ? "success" : "primary";
        return {
          id: `seed-${r.id}`,
          time: r.updatedAt,
          message:
            r.status === "pending"
              ? `Service masuk dari ${r.customerName}`
              : r.status === "done"
                ? `Service diambil pelanggan (${r.invoiceNumber})`
                : r.status === "completed"
                  ? `Service selesai (${r.invoiceNumber})`
                  : `Service diperbarui (${r.invoiceNumber})`,
          tone,
        };
      })
      .reverse();

    const target = buildTarget(stats, settings, rangeDays);

    setSnapshot({
      stats,
      settings,
      health,
      insights,
      kpis: buildKpis(stats, settings, growthPct, dailyRevenue),
      target,
      branches: branchRanking,
      leaderboard,
      quickStats,
      recentServices,
      activity: seedActivity,
      mini,
      dailyRevenueSpark: dailyRevenue,
      lastUpdated: new Date(),
      error: {},
    });
    setLoading(false);
    setError(null);
  }, [dateRange, rangeDays, branches, branchMatch, supabase, activeBranchId]);

  const scheduleRefresh = useCallback(
    (debounceMs = 1500) => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        fetchAll().catch((err: unknown) => {
          console.error("Refresh dashboard gagal:", err);
          setError(
            err instanceof Error ? err.message : "Gagal memuat data dashboard",
          );
          setLoading(false);
        });
      }, debounceMs);
    },
    [fetchAll],
  );

  const pushActivity = useCallback((item: LiveActivityItem) => {
    setSnapshot((prev) => {
      if (!prev) return prev;
      const activity = [item, ...prev.activity].slice(0, ACTIVITY_MAX_ITEMS);
      return { ...prev, activity, lastUpdated: new Date() };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAll()
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Dashboard fetch gagal:", err);
        setError(
          err instanceof Error ? err.message : "Gagal memuat data dashboard",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  useEffect(() => {
    const channel = supabase
      .channel("owner-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_orders" },
        (payload: { eventType: string; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) => {
          pushActivity(
            buildActivityFromRealtime(
              "service_orders",
              payload.eventType,
              (payload.new || payload.old || {}) as Record<string, unknown>,
            ),
          );
          scheduleRefresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "layanan" },
        (payload: { eventType: string; new: Record<string, unknown> | null; old: Record<string, unknown> | null }) => {
          pushActivity(
            buildActivityFromRealtime(
              "layanan",
              payload.eventType,
              (payload.new || payload.old || {}) as Record<string, unknown>,
            ),
          );
          scheduleRefresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [supabase, pushActivity, scheduleRefresh]);

  return {
    snapshot,
    loading,
    error,
    refresh: () => {
      fetchAll().catch((err: unknown) => {
        console.error("Refresh gagal:", err);
        setError(
          err instanceof Error ? err.message : "Gagal memuat data dashboard",
        );
      });
    },
    updateSettings: async (
      patch: Partial<
        Pick<BusinessSettings, "monthly_revenue_target" | "daily_target" | "sla_days">
      >,
    ) => {
      const current = snapshot;
      if (!current) throw new Error("Dashboard belum siap");

      const nextSettings: BusinessSettings = { ...current.settings, ...patch };
      const nextTarget = buildTarget(current.stats, nextSettings, rangeDays);
      setSnapshot({
        ...current,
        settings: nextSettings,
        target: nextTarget,
        kpis: current.kpis.map((kpi) => {
          if (kpi.key === "revenue") {
            const t = nextSettings.monthly_revenue_target || 1;
            return { ...kpi, target: t, progress: Math.min(100, Math.round((current.stats.revenue / t) * 100)) };
          }
          if (kpi.key === "today") {
            const t = nextSettings.daily_target || 1;
            return { ...kpi, target: t, progress: Math.min(100, Math.round((current.stats.todayRevenue / t) * 100)) };
          }
          return kpi;
        }),
      });

      const payload = {
        monthly_revenue_target: nextSettings.monthly_revenue_target,
        daily_target: nextSettings.daily_target,
        sla_days: nextSettings.sla_days,
        updated_at: new Date().toISOString(),
      };

      if (current.settings.id) {
        const { error: updateError } = await supabase
          .from("business_settings")
          .update(payload)
          .eq("id", current.settings.id);
        if (updateError) throw updateError;
      } else {
        const { data, error: insertError } = await supabase
          .from("business_settings")
          .insert({
            ...payload,
            branch_id: activeBranchId,
          })
          .select("*")
          .single();
        if (insertError) throw insertError;
        if (data) {
          setSnapshot((prev) =>
            prev ? { ...prev, settings: data as BusinessSettings } : prev,
          );
        }
      }
    },
  };
}