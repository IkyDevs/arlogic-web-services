// Pure owner-dashboard statistics. No react/supabase imports — unit-testable.

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface ServiceItem {
  price: number | string | null;
  quantity?: number | null;
}

export interface ServiceOrder {
  id: string;
  status: string;
  created_at: string;
  completed_at?: string | null;
  assigned_teknisi_id?: string | null;
  branch_id?: string | null;
  service_items?: ServiceItem[] | null;
}

export interface Layanan {
  id: string;
  nominal?: number | string | null;
  jenis_layanan?: string | null;
  status?: string | null;
  created_at: string;
  branch_id?: string | null;
}

export interface Attendance {
  id: string;
  teknisi_id: string;
  check_out?: string | null;
  branch_id?: string | null;
}

export interface TechnicianProfile {
  id: string;
  full_name: string;
}

export interface TechnicianPerf {
  id: string;
  name: string;
  completed: number;
  revenue: number;
}

export interface OwnerStats {
  revenue: number;
  totalExpenses: number;
  profit: number;
  todayRevenue: number;
  todayExpenses: number;
  monthExpenses: number;
  completedServices: number;
  totalServices: number;
  activeServices: number;
  activeTechnicians: number;
  averageCompletionTime: number;
  technicianPerformance: TechnicianPerf[];
}

/** "YYYY-MM-DD" in Asia/Jakarta (UTC+7) regardless of server timezone. */
export function jakartaDateKey(d: Date): string {
  return new Date(d.getTime() + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Layanan counted as income: not an expense and not cancelled. */
export function isRevenueLayanan(t: Layanan): boolean {
  return t.jenis_layanan !== "pengeluaran" && t.status !== "cancelled";
}

/** Order considered finished/sold: both statuses are "selesai" in this codebase. */
export function isRevenueService(s: ServiceOrder): boolean {
  return s.status === "completed" || s.status === "done";
}

export function serviceRevenue(s: ServiceOrder): number {
  return (
    s.service_items?.reduce((sum, item) => {
      return sum + (Number(item.price) * (item.quantity || 1) || 0);
    }, 0) || 0
  );
}

const isExpense = (t: Layanan) =>
  t.jenis_layanan === "pengeluaran" && t.status !== "cancelled";

const nominalOf = (t: Layanan) => Number(t.nominal) || 0;

export function computeOwnerStats(
  input: {
    services: ServiceOrder[];
    transactions: Layanan[];
    attendances: Attendance[];
    techProfiles: TechnicianProfile[];
  },
  opts: { now: Date },
): OwnerStats {
  const { services, transactions, attendances, techProfiles } = input;
  const now = opts.now;
  const todayKey = jakartaDateKey(now);
  const monthKey = todayKey.slice(0, 7);

  const revenueServices = services.filter(isRevenueService);
  const serviceTotal = revenueServices.reduce(
    (sum, s) => sum + serviceRevenue(s),
    0,
  );
  const revenueTx = transactions.filter(isRevenueLayanan);
  const expenseTx = transactions.filter(isExpense);

  const revenue =
    serviceTotal + revenueTx.reduce((sum, t) => sum + nominalOf(t), 0);
  const totalExpenses = expenseTx.reduce((sum, t) => sum + nominalOf(t), 0);

  const inToday = (t: Layanan) => jakartaDateKey(new Date(t.created_at)) === todayKey;

  const todayRevenue =
    revenueTx.filter(inToday).reduce((sum, t) => sum + nominalOf(t), 0) +
    revenueServices
      .filter((s) => jakartaDateKey(new Date(s.created_at)) === todayKey)
      .reduce((sum, s) => sum + serviceRevenue(s), 0);
  const todayExpenses = expenseTx
    .filter(inToday)
    .reduce((sum, t) => sum + nominalOf(t), 0);
  const monthExpenses = expenseTx
    .filter((t) => jakartaDateKey(new Date(t.created_at)).startsWith(monthKey))
    .reduce((sum, t) => sum + nominalOf(t), 0);

  const completedServices = services.filter(
    (s) => s.status === "completed",
  ).length;
  const totalServices = services.length;
  const activeServices = services.filter(
    (s) =>
      s.status !== "completed" && s.status !== "done" && s.status !== "cancelled",
  ).length;
  const activeTechnicians = new Set(
    attendances.filter((a) => !a.check_out).map((a) => a.teknisi_id),
  ).size;

  const completionTimes = revenueServices
    .filter((s) => s.completed_at && s.created_at)
    .map((s) => {
      const created = new Date(s.created_at);
      const completed = new Date(s.completed_at as string);
      return (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    });
  const averageCompletionTime =
    completionTimes.length > 0
      ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
      : 0;

  const techMap = new Map<string, TechnicianPerf>();
  revenueServices.forEach((s) => {
    if (!s.assigned_teknisi_id) return;
    const techId = s.assigned_teknisi_id;
    let entry = techMap.get(techId);
    if (!entry) {
      entry = {
        id: techId,
        name:
          techProfiles.find((t) => t.id === techId)?.full_name || "Unknown",
        completed: 0,
        revenue: 0,
      };
      techMap.set(techId, entry);
    }
    entry.completed++;
    entry.revenue += serviceRevenue(s);
  });

  return {
    revenue,
    totalExpenses,
    profit: revenue - totalExpenses,
    todayRevenue,
    todayExpenses,
    monthExpenses,
    completedServices,
    totalServices,
    activeServices,
    activeTechnicians,
    averageCompletionTime,
    technicianPerformance: [...techMap.values()],
  };
}

export interface DailyPoint {
  date: string;
  fullDate: string;
  revenue: number;
  expenses: number;
  net: number;
  cumulative: number;
}

/** Per-day series between start and end (both UTC-aware instances, zero-filled days). */
export function computeDailySeries(
  services: ServiceOrder[],
  transactions: Layanan[],
  opts: { start: Date; end: Date },
): DailyPoint[] {
  const { start, end } = opts;
  const dayCount = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );

  const svcByDay = new Map<string, number>();
  services.filter(isRevenueService).forEach((s) => {
    const key = jakartaDateKey(new Date(s.created_at));
    svcByDay.set(key, (svcByDay.get(key) || 0) + serviceRevenue(s));
  });

  const revByDay = new Map<string, number>();
  const expByDay = new Map<string, number>();
  transactions.forEach((t) => {
    const key = jakartaDateKey(new Date(t.created_at));
    if (isRevenueLayanan(t)) {
      revByDay.set(key, (revByDay.get(key) || 0) + nominalOf(t));
    } else if (isExpense(t)) {
      expByDay.set(key, (expByDay.get(key) || 0) + nominalOf(t));
    }
  });

  const points: DailyPoint[] = [];
  let cumulative = 0;
  for (let i = 0; i < dayCount; i++) {
    const day = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = jakartaDateKey(day);
    const revenue = (svcByDay.get(key) || 0) + (revByDay.get(key) || 0);
    const expenses = expByDay.get(key) || 0;
    const net = revenue - expenses;
    cumulative += net;
    points.push({
      date: day.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      fullDate: day.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      revenue,
      expenses,
      net,
      cumulative,
    });
  }
  return points;
}

export type Granularity = "day" | "week" | "month";

export interface BranchBucket {
  key: string;
  label: string;
  fullLabel: string;
  revenue: number;
  expenses: number;
  byBranch: Record<string, { revenue: number; expenses: number }>;
}

const UNASSIGNED_BRANCH = "unassigned";

/** Jakarta date string of the Monday starting this date's ISO week. */
function weekKey(d: Date): string {
  const day = new Date(d.getTime() + JAKARTA_OFFSET_MS);
  const jsDay = day.getUTCDay();
  const diff = (jsDay + 6) % 7;
  day.setUTCDate(day.getUTCDate() - diff);
  return day.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return jakartaDateKey(d).slice(0, 7);
}

/** Per-branch revenue/expense series bucketed by granularity (zero-filled). */
export function computeBranchSeries(
  services: ServiceOrder[],
  transactions: Layanan[],
  opts: { start: Date; end: Date; granularity: Granularity },
): BranchBucket[] {
  const { start, end, granularity } = opts;

  const bucketKeyOf = (d: Date): string => {
    if (granularity === "day") return jakartaDateKey(d);
    if (granularity === "week") return weekKey(d);
    return monthKey(d);
  };

  const bucketDays: Date[] = [];
  const seen = new Set<string>();
  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = bucketKeyOf(d);
    if (!seen.has(key)) {
      seen.add(key);
      bucketDays.push(d);
    }
  }

  const svcByBucket = new Map<string, Map<string, number>>();
  const revByBucket = new Map<string, Map<string, number>>();
  const expByBucket = new Map<string, Map<string, number>>();

  const add = (
    map: Map<string, Map<string, number>>,
    bucket: string,
    branch: string,
    value: number,
  ) => {
    let m = map.get(bucket);
    if (!m) {
      m = new Map();
      map.set(bucket, m);
    }
    m.set(branch, (m.get(branch) || 0) + value);
  };

  services.filter(isRevenueService).forEach((s) => {
    const bucket = bucketKeyOf(new Date(s.created_at));
    const branch = s.branch_id || UNASSIGNED_BRANCH;
    add(svcByBucket, bucket, branch, serviceRevenue(s));
  });
  transactions.forEach((t) => {
    const bucket = bucketKeyOf(new Date(t.created_at));
    const branch = t.branch_id || UNASSIGNED_BRANCH;
    if (isRevenueLayanan(t)) add(revByBucket, bucket, branch, nominalOf(t));
    else if (isExpense(t)) add(expByBucket, bucket, branch, nominalOf(t));
  });

  return bucketDays.map((d) => {
    const key = bucketKeyOf(d);
    const allBranches = new Set([
      ...(svcByBucket.get(key)?.keys() || []),
      ...(revByBucket.get(key)?.keys() || []),
      ...(expByBucket.get(key)?.keys() || []),
    ]);
    const byBranch: Record<string, { revenue: number; expenses: number }> = {};
    let revenue = 0;
    let expenses = 0;
    allBranches.forEach((branch) => {
      const rev =
        (svcByBucket.get(key)?.get(branch) || 0) +
        (revByBucket.get(key)?.get(branch) || 0);
      const exp = expByBucket.get(key)?.get(branch) || 0;
      byBranch[branch] = { revenue: rev, expenses: exp };
      revenue += rev;
      expenses += exp;
    });

    let label: string;
    let fullLabel: string;
    if (granularity === "day") {
      label = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      fullLabel = d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } else if (granularity === "week") {
      label = d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
      fullLabel = `Minggu ${d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`;
    } else {
      label = d.toLocaleDateString("id-ID", { month: "short" });
      fullLabel = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    }

    return { key, label, fullLabel, revenue, expenses, byBranch };
  });
}