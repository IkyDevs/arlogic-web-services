import { describe, it, expect } from "vitest";
import {
  computeOwnerStats,
  computeDailySeries,
  computeBranchSeries,
  jakartaDateKey,
  isRevenueLayanan,
  isRevenueService,
  serviceRevenue,
} from "@/lib/owner/stats";

const svc = (over: Partial<Parameters<typeof serviceRevenue>[0]> & { status: string; created_at: string }) => ({
  id: "s1",
  assigned_teknisi_id: null,
  service_items: [],
  completed_at: null,
  ...over,
});

const tx = (over: { created_at: string } & Partial<{ nominal: number; jenis_layanan: string; status: string; id: string; branch_id: string }>) => ({
  id: "t1",
  nominal: 0,
  jenis_layanan: "jasa",
  status: "completed",
  ...over,
});

const att = (over: Partial<{ id: string; teknisi_id: string; check_out: string }>) => ({
  id: "a1",
  teknisi_id: "u1",
  check_out: null,
  ...over,
});

describe("isRevenueLayanan", () => {
  it("excludes pengeluaran rows", () => {
    expect(isRevenueLayanan(tx({ created_at: "2026-08-01T00:00:00Z", jenis_layanan: "pengeluaran" }))).toBe(false);
  });
  it("excludes cancelled rows", () => {
    expect(isRevenueLayanan(tx({ created_at: "2026-08-01T00:00:00Z", status: "cancelled" }))).toBe(false);
  });
  it("includes regular income rows", () => {
    expect(isRevenueLayanan(tx({ created_at: "2026-08-01T00:00:00Z" }))).toBe(true);
  });
});

describe("isRevenueService / serviceRevenue", () => {
  it("counts only completed and done orders", () => {
    expect(isRevenueService(svc({ status: "completed", created_at: "2026-08-01T00:00:00Z" }))).toBe(true);
    expect(isRevenueService(svc({ status: "done", created_at: "2026-08-01T00:00:00Z" }))).toBe(true);
    expect(isRevenueService(svc({ status: "pending", created_at: "2026-08-01T00:00:00Z" }))).toBe(false);
    expect(isRevenueService(svc({ status: "in_progress", created_at: "2026-08-01T00:00:00Z" }))).toBe(false);
    expect(isRevenueService(svc({ status: "cancelled", created_at: "2026-08-01T00:00:00Z" }))).toBe(false);
  });

  it("multiplies price by quantity and treats null price as 0", () => {
    const s = svc({
      status: "completed",
      created_at: "2026-08-01T00:00:00Z",
      service_items: [
        { price: 10000, quantity: 2 },
        { price: null, quantity: 5 },
        { price: 2500 },
      ],
    });
    expect(serviceRevenue(s)).toBe(22500);
  });
});

describe("jakartaDateKey", () => {
  it("shifts UTC to Asia/Jakarta (UTC+7)", () => {
    // 17:30 UTC = 00:30 WIB hari berikutnya
    expect(jakartaDateKey(new Date("2026-08-13T17:30:00.000Z"))).toBe("2026-08-14");
  });
});

describe("computeOwnerStats", () => {
  const now = new Date("2026-08-14T10:00:00.000Z"); // 17:00 WIB, 14 Agustus 2026

  it("excludes expense from revenue and cancelled from both", () => {
    const stats = computeOwnerStats(
      {
        services: [],
        transactions: [
          tx({ id: "inc", nominal: 100000, created_at: "2026-08-13T17:30:00.000Z" }), // 14 Agu WIB
          tx({ id: "exp", nominal: 40000, jenis_layanan: "pengeluaran", created_at: "2026-08-14T01:00:00.000Z" }),
          tx({ id: "canc", nominal: 50000, status: "cancelled", created_at: "2026-08-14T01:00:00.000Z" }),
        ],
        attendances: [],
        techProfiles: [],
      },
      { now },
    );
    expect(stats.revenue).toBe(100000);
    expect(stats.totalExpenses).toBe(40000);
    expect(stats.profit).toBe(60000);
    // 00:30 WIB masuk bucket "hari ini" (14 Agu)
    expect(stats.todayRevenue).toBe(100000);
  });

  it("counts service revenue only from completed/done orders", () => {
    const stats = computeOwnerStats(
      {
        services: [
          svc({ status: "done", created_at: "2026-08-10T00:00:00Z", service_items: [{ price: 50000, quantity: 1 }] }),
          svc({ status: "pending", created_at: "2026-08-11T00:00:00Z", service_items: [{ price: 999999, quantity: 1 }] }),
          svc({ status: "cancelled", created_at: "2026-08-12T00:00:00Z", service_items: [{ price: 999999, quantity: 1 }] }),
        ],
        transactions: [],
        attendances: [],
        techProfiles: [],
      },
      { now },
    );
    expect(stats.revenue).toBe(50000);
    expect(stats.completedServices).toBe(0); // "done" bukan "completed" utk counter
    expect(stats.totalServices).toBe(3);
    expect(stats.activeServices).toBe(1); // hanya pending
  });

  it("buckets today/month expenses with Jakarta timezone", () => {
    const stats = computeOwnerStats(
      {
        services: [],
        transactions: [
          tx({ id: "e1", nominal: 1000, jenis_layanan: "pengeluaran", created_at: "2026-08-13T17:30:00.000Z" }), // 14 Agu WIB
          tx({ id: "e2", nominal: 2000, jenis_layanan: "pengeluaran", created_at: "2026-08-02T00:00:00.000Z" }), // 2 Agu
          tx({ id: "e3", nominal: 3000, jenis_layanan: "pengeluaran", created_at: "2026-07-31T17:30:00.000Z" }), // 1 Agu WIB
        ],
        attendances: [],
        techProfiles: [],
      },
      { now },
    );
    expect(stats.todayExpenses).toBe(1000);
    expect(stats.monthExpenses).toBe(6000); // e1+e2+e3 semuanya bulan Agustus WIB
  });

  it("computes average completion time in days", () => {
    const stats = computeOwnerStats(
      {
        services: [
          svc({ status: "completed", created_at: "2026-08-01T00:00:00Z", completed_at: "2026-08-03T00:00:00Z" }),
        ],
        transactions: [],
        attendances: [],
        techProfiles: [],
      },
      { now },
    );
    expect(stats.averageCompletionTime).toBe(2);
  });

  it("counts distinct active technicians without check_out", () => {
    const stats = computeOwnerStats(
      {
        services: [],
        transactions: [],
        attendances: [
          att({ teknisi_id: "u1" }),
          att({ teknisi_id: "u1" }),
          att({ teknisi_id: "u2", check_out: "2026-08-14T02:00:00Z" }),
          att({ teknisi_id: "u3" }),
        ],
        techProfiles: [],
      },
      { now },
    );
    expect(stats.activeTechnicians).toBe(2);
  });

  it("builds technician performance from finished orders only", () => {
    const stats = computeOwnerStats(
      {
        services: [
          svc({ id: "s1", status: "completed", assigned_teknisi_id: "u1", created_at: "2026-08-01T00:00:00Z", service_items: [{ price: 10000, quantity: 1 }] }),
          svc({ id: "s2", status: "done", assigned_teknisi_id: "u1", created_at: "2026-08-02T00:00:00Z", service_items: [{ price: 20000, quantity: 1 }] }),
          svc({ id: "s3", status: "pending", assigned_teknisi_id: "u1", created_at: "2026-08-03T00:00:00Z", service_items: [{ price: 99999, quantity: 1 }] }),
        ],
        transactions: [],
        attendances: [],
        techProfiles: [{ id: "u1", full_name: "Budi" }],
      },
      { now },
    );
    expect(stats.technicianPerformance).toEqual([
      { id: "u1", name: "Budi", completed: 2, revenue: 30000 },
    ]);
  });
});

describe("computeDailySeries", () => {
  it("zero-fills days and runs cumulative across the window", () => {
    const series = computeDailySeries(
      [
        svc({ status: "done", created_at: "2026-08-10T00:00:00Z", service_items: [{ price: 10000, quantity: 1 }] }),
      ],
      [
        tx({ nominal: 5000, created_at: "2026-08-11T00:00:00Z" }),
        tx({ nominal: 2000, jenis_layanan: "pengeluaran", created_at: "2026-08-11T00:00:00Z" }),
      ],
      { start: new Date("2026-08-10T00:00:00Z"), end: new Date("2026-08-12T00:00:00Z") },
    );

    expect(series).toHaveLength(3);
    expect(series[0]).toMatchObject({ revenue: 10000, expenses: 0, net: 10000, cumulative: 10000 });
    expect(series[1]).toMatchObject({ revenue: 5000, expenses: 2000, net: 3000, cumulative: 13000 });
    expect(series[2]).toMatchObject({ revenue: 0, expenses: 0, net: 0, cumulative: 13000 });
    expect(series[0].fullDate).toMatch(/2026/);
  });
});

describe("computeBranchSeries", () => {
  const start = new Date("2026-08-10T00:00:00Z");
  const end = new Date("2026-08-12T00:00:00Z");

  it("splits revenue per branch and keeps expenses separate", () => {
    const series = computeBranchSeries(
      [
        svc({ id: "s1", status: "done", branch_id: "b1", created_at: "2026-08-10T00:00:00Z", service_items: [{ price: 10000, quantity: 1 }] }),
        svc({ id: "s2", status: "completed", branch_id: "b2", created_at: "2026-08-11T00:00:00Z", service_items: [{ price: 20000, quantity: 1 }] }),
      ],
      [
        tx({ id: "t1", nominal: 5000, branch_id: "b1", created_at: "2026-08-11T00:00:00Z" }),
        tx({ id: "t2", nominal: 3000, branch_id: "b2", jenis_layanan: "pengeluaran", created_at: "2026-08-11T00:00:00Z" }),
        tx({ id: "t3", nominal: 4000, created_at: "2026-08-11T00:00:00Z" }), // no branch → unassigned
      ],
      { start, end, granularity: "day" },
    );

    expect(series).toHaveLength(3);
    expect(series[0].byBranch.b1).toEqual({ revenue: 10000, expenses: 0 });
    expect(series[1].byBranch.b1).toEqual({ revenue: 5000, expenses: 0 });
    expect(series[1].byBranch.b2).toEqual({ revenue: 20000, expenses: 3000 });
    expect(series[1].byBranch.unassigned).toEqual({ revenue: 4000, expenses: 0 });
    expect(series[1].revenue).toBe(29000);
    expect(series[1].expenses).toBe(3000);
  });

  it("buckets by week (Monday start) and month", () => {
    const weekSeries = computeBranchSeries(
      [
        svc({ id: "s1", status: "completed", branch_id: "b1", created_at: "2026-08-13T00:00:00Z", service_items: [{ price: 100, quantity: 1 }] }), // Kamis
      ],
      [],
      { start: new Date("2026-08-10T00:00:00Z"), end: new Date("2026-08-16T00:00:00Z"), granularity: "week" }, // Senin..Minggu
    );
    // Semua dalam 1 minggu (10-16 Agu) → 1 bucket dimulai Senin 10 Agu
    expect(weekSeries).toHaveLength(1);
    expect(weekSeries[0].byBranch.b1.revenue).toBe(100);

    const monthSeries = computeBranchSeries(
      [
        svc({ id: "s2", status: "completed", branch_id: "b1", created_at: "2026-08-31T00:00:00Z", service_items: [{ price: 200, quantity: 1 }] }),
        svc({ id: "s3", status: "completed", branch_id: "b1", created_at: "2026-09-01T00:00:00Z", service_items: [{ price: 300, quantity: 1 }] }),
      ],
      [],
      { start: new Date("2026-08-31T00:00:00Z"), end: new Date("2026-09-02T00:00:00Z"), granularity: "month" },
    );
    expect(monthSeries).toHaveLength(2);
    expect(monthSeries[0].label).toBe("Agu");
    expect(monthSeries[0].byBranch.b1.revenue).toBe(200);
    expect(monthSeries[1].byBranch.b1.revenue).toBe(300);
  });

  it("excludes pending services and cancelled transactions", () => {
    const series = computeBranchSeries(
      [
        svc({ id: "s1", status: "pending", branch_id: "b1", created_at: "2026-08-10T00:00:00Z", service_items: [{ price: 99999, quantity: 1 }] }),
      ],
      [
        tx({ id: "t1", nominal: 99999, branch_id: "b1", status: "cancelled", created_at: "2026-08-10T00:00:00Z" }),
      ],
      { start, end, granularity: "day" },
    );
    expect(series[0].revenue).toBe(0);
    expect(series[0].expenses).toBe(0);
  });
});
