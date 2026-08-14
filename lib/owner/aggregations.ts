import type {
  BranchPerformanceEntry,
  LeaderboardBadge,
  LeaderboardEntry,
  MiniAnalytics,
  QuickStats,
  RecentServiceRow,
} from "@/types/owner";
import {
  UNKNOWN_TECHNICIAN,
  RECENT_SERVICES_LIMIT,
} from "@/constants/owner";
import {
  isRevenueService,
  isRevenueLayanan,
  serviceRevenue,
  jakartaDateKey,
  type Layanan,
  type ServiceOrder,
} from "@/lib/owner/stats";

const isExpense = (t: Layanan) =>
  t.jenis_layanan === "pengeluaran" && t.status !== "cancelled";

const nominalOf = (t: Layanan) => Number(t.nominal) || 0;

export interface BranchNameMap {
  [branchId: string]: string;
}

export function computeBranchPerformance(
  services: ServiceOrder[],
  transactions: Layanan[],
  branchNameById: BranchNameMap,
): BranchPerformanceEntry[] {
  const map = new Map<string, BranchPerformanceEntry>();

  const ensure = (branchId: string) => {
    let entry = map.get(branchId);
    if (!entry) {
      entry = {
        branchId,
        name: branchNameById[branchId] || "Lainnya",
        rank: 0,
        revenue: 0,
        services: 0,
        completed: 0,
        pending: 0,
        recall: 0,
        qcDone: 0,
        progress: 0,
      };
      map.set(branchId, entry);
    }
    return entry;
  };

  services.forEach((s) => {
    if (!s.branch_id) return;
    const entry = ensure(s.branch_id);
    entry.services++;
    if (isRevenueService(s)) {
      entry.revenue += serviceRevenue(s);
      entry.completed++;
      entry.qcDone++;
    }
    if (s.status === "pending") entry.pending++;
    if (s.status === "rejected") entry.recall++;
  });

  transactions.forEach((t) => {
    if (!t.branch_id) return;
    const entry = ensure(t.branch_id);
    if (isRevenueLayanan(t)) entry.revenue += nominalOf(t);
    else if (isExpense(t)) entry.revenue -= nominalOf(t);
  });

  const ranked = [...map.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      progress:
        e.services > 0 ? Math.round((e.completed / e.services) * 100) : 0,
    }));

  return ranked.slice(0, 10);
}

interface TechAgg {
  completed: number;
  revenue: number;
  pending: number;
  repairDays: number[];
  recall: number;
}

export interface TechnicianProfileLike {
  id: string;
  full_name: string;
  avatar_url?: string | null;
}

const badgePriority: LeaderboardBadge[] = [
  "Highest Revenue",
  "Most Productive",
  "Fastest",
  "Top Performer",
];

export function computeLeaderboard(
  services: ServiceOrder[],
  profiles: TechnicianProfileLike[],
): LeaderboardEntry[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const agg = (techId: string): TechAgg => {
    const entry: TechAgg = {
      completed: 0,
      revenue: 0,
      pending: 0,
      repairDays: [],
      recall: 0,
    };
    services.forEach((s) => {
      if (s.assigned_teknisi_id !== techId) return;
      if (s.status === "pending" || s.status === "in_progress") entry.pending++;
      if (s.status === "rejected") entry.recall++;
      if (!isRevenueService(s)) return;
      entry.completed++;
      entry.revenue += serviceRevenue(s);
      if (s.completed_at && s.created_at) {
        const created = new Date(s.created_at);
        const completed = new Date(s.completed_at);
        entry.repairDays.push(
          (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
        );
      }
    });
    return entry;
  };

  const techIds = new Set<string>();
  services.forEach((s) => {
    if (s.assigned_teknisi_id) techIds.add(s.assigned_teknisi_id);
  });

  const entries: LeaderboardEntry[] = [...techIds].map((techId) => {
    const a = agg(techId);
    const profile = profileById.get(techId);
    return {
      id: techId,
      name: profile?.full_name || UNKNOWN_TECHNICIAN,
      avatarUrl: profile?.avatar_url || null,
      completed: a.completed,
      revenue: a.revenue,
      pending: a.pending,
      recall: a.recall,
      avgRepairDays:
        a.repairDays.length > 0
          ? a.repairDays.reduce((x, y) => x + y, 0) / a.repairDays.length
          : 0,
      badge: null,
    };
  });

  const finished = entries.filter((e) => e.completed > 0);
  if (finished.length === 0) return entries;

  const computeRank = (
    key: (e: LeaderboardEntry) => number,
    asc = false,
  ): Map<string, number> => {
    const sorted = [...finished].sort((a, b) =>
      asc ? key(a) - key(b) : key(b) - key(a),
    );
    return new Map(sorted.map((e, i) => [e.id, i]));
  };

  const rankRevenue = computeRank((e) => e.revenue);
  const rankProductive = computeRank((e) => e.completed);
  const rankFastest = computeRank((e) => e.avgRepairDays, true);
  const fastest = [...finished].filter((e) => e.avgRepairDays > 0);
  const rankComposite = computeRank(
    (e) => e.completed * 2 + e.revenue / 100000,
  );

  const bestOf = (rank: Map<string, number>) =>
    rank.size > 0 ? [...rank.entries()].sort((a, b) => a[1] - b[1])[0]?.[0] : null;

  const badgeByCategory: Record<LeaderboardBadge, string | null> = {
    "Highest Revenue": bestOf(rankRevenue),
    "Most Productive": bestOf(rankProductive),
    Fastest: fastest.length > 0 ? bestOf(rankFastest) : null,
    "Top Performer": bestOf(rankComposite),
  };

  entries.forEach((e) => {
    for (const badge of badgePriority) {
      if (badgeByCategory[badge] === e.id) {
        e.badge = badge;
        break;
      }
    }
  });

  return entries.sort((a, b) => b.completed - a.completed || b.revenue - a.revenue);
}

export function computeQuickStats(
  services: ServiceOrder[],
  transactions: Layanan[],
): QuickStats {
  const completed = services.filter(
    (s) => s.status === "completed" || s.status === "done",
  );
  const revenueTx = transactions.filter(isRevenueLayanan);

  const repairDays: number[] = [];
  services.forEach((s) => {
    if (
      (s.status === "completed" || s.status === "done") &&
      s.completed_at &&
      s.created_at
    ) {
      const created = new Date(s.created_at);
      const completedAt = new Date(s.completed_at);
      repairDays.push(
        (completedAt.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
  });

  const serviceRev = completed.reduce(
    (sum, s) => sum + serviceRevenue(s),
    0,
  );
  const transactionRevenue = revenueTx.reduce(
    (sum, t) => sum + nominalOf(t),
    0,
  );

  return {
    serviceIn: services.length,
    serviceDone: completed.length,
    pending: services.filter((s) => s.status === "pending").length,
    recall: services.filter((s) => s.status === "rejected").length,
    warranty: 0,
    qcPending: services.filter((s) => s.status === "qc_pending").length,
    newCustomers: new Set(
      services.map((s) => s.customer_name).filter(Boolean),
    ).size,
    revenue: serviceRev + transactionRevenue,
    avgServiceTimeDays:
      repairDays.length > 0
        ? repairDays.reduce((a, b) => a + b, 0) / repairDays.length
        : 0,
    avgRepairCost: completed.length > 0 ? serviceRev / completed.length : 0,
    avgQcTimeDays: 0,
  };
}

export interface TechnicianProfileForRecent extends TechnicianProfileLike {
  role?: string | null;
}

export function computeRecentServices(
  services: ServiceOrder[],
  profiles: TechnicianProfileLike[],
  limit: number = RECENT_SERVICES_LIMIT,
): RecentServiceRow[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  return [...services]
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime(),
    )
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      invoiceNumber: s.invoice_number || "-",
      customerName: s.customer_name || "-",
      brand: s.watch_brand || "-",
      technicianName: s.assigned_teknisi_id
        ? profileById.get(s.assigned_teknisi_id)?.full_name ||
          UNKNOWN_TECHNICIAN
        : "-",
      status: s.status,
      nominal: isRevenueService(s) ? serviceRevenue(s) : 0,
      qcStatus: s.status === "qc_pending" ? "Menunggu QC" : null,
      updatedAt: new Date(s.updated_at || s.created_at),
    }));
}

export interface FeedbackLike {
  rating: number;
  created_at: string;
}

export function computeMiniAnalytics(
  services: ServiceOrder[],
  transactions: Layanan[],
  feedbacks: FeedbackLike[],
): MiniAnalytics {
  const hourCount = new Map<number, number>();
  services.forEach((s) => {
    const hour = new Date(s.created_at).getUTCHours() + 7; // Jakarta
    const key = hour >= 24 ? hour - 24 : hour;
    hourCount.set(key, (hourCount.get(key) || 0) + 1);
  });

  const brandRevenue = new Map<string, number>();
  const spareCount = new Map<string, number>();
  services.forEach((s) => {
    if (s.watch_brand) {
      brandRevenue.set(
        s.watch_brand,
        (brandRevenue.get(s.watch_brand) || 0) +
          (isRevenueService(s) ? serviceRevenue(s) : 0),
      );
    }
    s.service_items?.forEach((item) => {
      const name = String(item.name || "").trim();
      if (name) spareCount.set(name, (spareCount.get(name) || 0) + 1);
    });
  });

  const recallByMonth = new Map<string, number>();
  services.forEach((s) => {
    if (s.status === "rejected") {
      const key = jakartaDateKey(new Date(s.created_at)).slice(0, 7);
      recallByMonth.set(key, (recallByMonth.get(key) || 0) + 1);
    }
  });

  const repairDays: number[] = [];
  services.forEach((s) => {
    if (
      (s.status === "completed" || s.status === "done") &&
      s.completed_at &&
      s.created_at
    ) {
      const created = new Date(s.created_at);
      const completedAt = new Date(s.completed_at);
      repairDays.push(
        (completedAt.getTime() - created.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
  });

  return {
    topHours: [...hourCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([hour, count]) => ({ hour, count })),
    topBrands: [...brandRevenue.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([brand, revenue]) => ({ brand, revenue })),
    topSpareparts: [...spareCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count })),
    avgRepairDays:
      repairDays.length > 0
        ? repairDays.reduce((a, b) => a + b, 0) / repairDays.length
        : 0,
    satisfaction:
      feedbacks.length > 0
        ? Math.round(
            (feedbacks.reduce((sum, f) => sum + f.rating, 0) /
              feedbacks.length) *
              10,
          ) / 10
        : null,
    warrantyClaims: 0,
    recallTrend: [...recallByMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({
        label: month.slice(5) + "/" + month.slice(2, 4),
        count,
      })),
  };
}