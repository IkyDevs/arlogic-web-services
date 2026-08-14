import { describe, it, expect } from "vitest";
import { computeBusinessHealth } from "@/lib/owner/business-health";
import { generateBusinessInsight } from "@/lib/owner/business-insight";
import {
  computeBranchPerformance,
  computeLeaderboard,
  computeQuickStats,
  computeRecentServices,
  computeMiniAnalytics,
} from "@/lib/owner/aggregations";
import type { OwnerStats, ServiceOrder, Layanan } from "@/lib/owner/stats";

const svc = (over: Partial<ServiceOrder> & { status: string; created_at: string }): ServiceOrder => ({
  id: "s1",
  assigned_teknisi_id: null,
  service_items: [],
  completed_at: null,
  ...over,
});

const tx = (over: { created_at: string } & Partial<Layanan>): Layanan => ({
  id: "t1",
  nominal: 0,
  jenis_layanan: "jasa",
  status: "completed",
  ...over,
});

const stats = (over: Partial<OwnerStats> = {}): OwnerStats => ({
  revenue: 1000000,
  totalExpenses: 200000,
  profit: 800000,
  todayRevenue: 500000,
  todayExpenses: 100000,
  monthExpenses: 200000,
  completedServices: 10,
  totalServices: 15,
  activeServices: 4,
  activeTechnicians: 3,
  averageCompletionTime: 2,
  technicianPerformance: [],
  ...over,
});

describe("computeBusinessHealth", () => {
  it("scores healthy business as excellent", () => {
    const h = computeBusinessHealth({
      revenueGrowthPct: 20,
      completionRate: 90,
      pendingRatio: 0.05,
      recallCount: 0,
      avgRating: 4.8,
    });
    expect(h.status).toBe("excellent");
    expect(h.score).toBeGreaterThanOrEqual(80);
  });

  it("scores bad business as critical", () => {
    const h = computeBusinessHealth({
      revenueGrowthPct: -40,
      completionRate: 30,
      pendingRatio: 0.8,
      recallCount: 4,
      avgRating: 2.5,
    });
    expect(h.status).toBe("critical");
    expect(h.score).toBeLessThan(60);
  });

  it("respects weights: rating floor prevents 100", () => {
    const h = computeBusinessHealth({
      revenueGrowthPct: 100,
      completionRate: 100,
      pendingRatio: 0,
      recallCount: 0,
      avgRating: 3,
    });
    expect(h.score).toBeLessThan(100);
  });
});

describe("generateBusinessInsight", () => {
  it("flags revenue growth and top branch", () => {
    const insights = generateBusinessInsight({
      stats: stats(),
      previousRevenue: 800000,
      branchRanking: [
        {
          branchId: "b1", name: "Kudus", rank: 1, revenue: 600000,
          services: 8, completed: 7, pending: 1, recall: 0, qcDone: 7, progress: 88,
        },
      ],
      leaderboard: [],
      overdueCount: 0,
      slaDays: 7,
      recallCount: 0,
      previousRecall: 0,
      expenseGrowthPct: 5,
      avgRating: 4.5,
    });
    expect(insights[0].title).toContain("naik");
    expect(insights.some((i) => i.title.includes("Kudus"))).toBe(true);
  });

  it("escalates many overdue services to critical", () => {
    const insights = generateBusinessInsight({
      stats: stats(),
      previousRevenue: 1000000,
      branchRanking: [],
      leaderboard: [],
      overdueCount: 6,
      slaDays: 7,
      recallCount: 0,
      previousRecall: 0,
      expenseGrowthPct: 0,
      avgRating: 0,
    });
    const sla = insights.find((i) => i.title.includes("SLA"));
    expect(sla?.type).toBe("critical");
    expect(sla?.priority).toBe(1);
  });

  it("warns on expense spike and low rating", () => {
    const insights = generateBusinessInsight({
      stats: stats(),
      previousRevenue: 1000000,
      branchRanking: [],
      leaderboard: [],
      overdueCount: 0,
      slaDays: 7,
      recallCount: 0,
      previousRecall: 0,
      expenseGrowthPct: 30,
      avgRating: 3.2,
    });
    expect(insights.some((i) => i.title.includes("Pengeluaran"))).toBe(true);
    expect(insights.some((i) => i.title.includes("Rating"))).toBe(true);
  });
});

describe("computeBranchPerformance", () => {
  it("ranks branches by revenue and subtracts expenses", () => {
    const result = computeBranchPerformance(
      [
        svc({ id: "a", status: "done", branch_id: "b1", created_at: "2026-08-01T00:00:00Z", service_items: [{ price: 10000, quantity: 1 }] }),
        svc({ id: "b", status: "completed", branch_id: "b2", created_at: "2026-08-01T00:00:00Z", service_items: [{ price: 30000, quantity: 1 }] }),
        svc({ id: "c", status: "pending", branch_id: "b2", created_at: "2026-08-01T00:00:00Z" }),
      ],
      [
        tx({ nominal: 5000, branch_id: "b1", jenis_layanan: "pengeluaran", created_at: "2026-08-01T00:00:00Z" }),
      ],
      { b1: "Kudus", b2: "Jepara" },
    );
    expect(result[0].branchId).toBe("b2");
    expect(result[0].revenue).toBe(30000);
    expect(result[0].pending).toBe(1);
    expect(result[1].branchId).toBe("b1");
    expect(result[1].revenue).toBe(5000); // 10000 - 5000
    expect(result[1].progress).toBe(100);
  });
});

describe("computeLeaderboard", () => {
  it("awards badges without fabricating data", () => {
    const result = computeLeaderboard(
      [
        svc({ id: "a", status: "completed", assigned_teknisi_id: "u1", created_at: "2026-08-01T00:00:00Z", completed_at: "2026-08-02T00:00:00Z", service_items: [{ price: 100000, quantity: 1 }] }),
        svc({ id: "b", status: "done", assigned_teknisi_id: "u1", created_at: "2026-08-01T00:00:00Z", completed_at: "2026-08-02T00:00:00Z", service_items: [{ price: 50000, quantity: 1 }] }),
        svc({ id: "c", status: "completed", assigned_teknisi_id: "u2", created_at: "2026-08-01T00:00:00Z", completed_at: "2026-08-05T00:00:00Z", service_items: [{ price: 80000, quantity: 1 }] }),
        svc({ id: "d", status: "pending", assigned_teknisi_id: "u2", created_at: "2026-08-03T00:00:00Z" }),
      ],
      [
        { id: "u1", full_name: "Agus" },
        { id: "u2", full_name: "Budi" },
      ],
    );
    const agus = result.find((e) => e.id === "u1");
    const budi = result.find((e) => e.id === "u2");
    expect(agus?.completed).toBe(2);
    expect(agus?.avgRepairDays).toBe(1);
    expect(budi?.pending).toBe(1);
    expect(agus?.badge).toBe("Highest Revenue"); // badge prioritas: revenue > produktif
  });

  it("returns empty list when no technicians", () => {
    expect(computeLeaderboard([], [])).toEqual([]);
  });
});

describe("computeQuickStats", () => {
  it("computes aggregates without warranty/QC fabrication", () => {
    const q = computeQuickStats(
      [
        svc({ id: "a", status: "done", customer_name: "Andi", created_at: "2026-08-01T00:00:00Z", completed_at: "2026-08-03T00:00:00Z", service_items: [{ price: 10000, quantity: 2 }] }),
        svc({ id: "b", status: "pending", customer_name: "Andi", created_at: "2026-08-02T00:00:00Z" }),
        svc({ id: "c", status: "qc_pending", customer_name: "Budi", created_at: "2026-08-02T00:00:00Z" }),
      ],
      [tx({ nominal: 5000, created_at: "2026-08-01T00:00:00Z" })],
    );
    expect(q.serviceIn).toBe(3);
    expect(q.serviceDone).toBe(1);
    expect(q.pending).toBe(1);
    expect(q.qcPending).toBe(1);
    expect(q.newCustomers).toBe(2);
    expect(q.revenue).toBe(25000);
    expect(q.avgServiceTimeDays).toBe(2);
    expect(q.avgRepairCost).toBe(20000);
    expect(q.warranty).toBe(0);
    expect(q.avgQcTimeDays).toBe(0);
  });
});

describe("computeRecentServices", () => {
  it("sorts by updated_at and maps names", () => {
    const rows = computeRecentServices(
      [
        svc({ id: "old", status: "pending", customer_name: "Lama", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z" }),
        svc({ id: "new", status: "done", invoice_number: "INV-2", customer_name: "Baru", watch_brand: "Seiko", assigned_teknisi_id: "u1", created_at: "2026-08-02T00:00:00Z", updated_at: "2026-08-03T00:00:00Z", service_items: [{ price: 5000, quantity: 1 }] }),
      ],
      [{ id: "u1", full_name: "Agus" }],
      10,
    );
    expect(rows[0].id).toBe("new");
    expect(rows[0].invoiceNumber).toBe("INV-2");
    expect(rows[0].technicianName).toBe("Agus");
    expect(rows[0].nominal).toBe(5000);
  });
});

describe("computeMiniAnalytics", () => {
  it("aggregates brands, spareparts, hours and recall trend", () => {
    const m = computeMiniAnalytics(
      [
        svc({ id: "a", status: "done", watch_brand: "Rolex", created_at: "2026-08-01T02:00:00.000Z", service_items: [{ name: "Battery", price: 10000, quantity: 1 }] }),
        svc({ id: "b", status: "rejected", watch_brand: "Seiko", created_at: "2026-07-05T02:00:00.000Z", service_items: [{ name: "Battery", price: 5000, quantity: 1 }] }),
      ],
      [],
      [{ rating: 5, created_at: "2026-08-01T00:00:00Z" }],
    );
    expect(m.topBrands[0].brand).toBe("Rolex");
    expect(m.topSpareparts[0].name).toBe("Battery");
    expect(m.topSpareparts[0].count).toBe(2);
    expect(m.topHours[0].hour).toBe(9); // 02:00 UTC = 09:00 WIB
    expect(m.satisfaction).toBe(5);
    expect(m.warrantyClaims).toBe(0);
    expect(m.recallTrend.some((r) => r.count === 1)).toBe(true);
  });
});