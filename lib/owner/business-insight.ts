import type {
  BranchPerformanceEntry,
  BusinessInsight,
  LeaderboardEntry,
} from "@/types/owner";
import type { OwnerStats } from "@/lib/owner/stats";
import { UNKNOWN_TECHNICIAN } from "@/constants/owner";

export interface InsightInput {
  stats: OwnerStats;
  previousRevenue: number;
  branchRanking: BranchPerformanceEntry[];
  leaderboard: LeaderboardEntry[];
  overdueCount: number;
  slaDays: number;
  recallCount: number;
  previousRecall: number;
  expenseGrowthPct: number;
  avgRating: number;
}

const rupiah = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(v);

export function generateBusinessInsight(input: InsightInput): BusinessInsight[] {
  const {
    stats,
    previousRevenue,
    branchRanking,
    leaderboard,
    overdueCount,
    slaDays,
    recallCount,
    previousRecall,
    expenseGrowthPct,
    avgRating,
  } = input;
  const insights: BusinessInsight[] = [];

  const growth =
    previousRevenue === 0
      ? 100
      : ((stats.revenue - previousRevenue) / previousRevenue) * 100;

  if (growth >= 5) {
    insights.push({
      type: "success",
      title: `Pendapatan naik ${growth.toFixed(0)}%`,
      description: `Total pendapatan ${rupiah(stats.revenue)} dibanding periode sebelumnya.`,
      priority: 1,
    });
  } else if (growth <= -5) {
    insights.push({
      type: "warning",
      title: `Pendapatan turun ${Math.abs(growth).toFixed(0)}%`,
      description: "Periksa aktivitas cabang dan layanan yang sedang berjalan.",
      priority: 1,
    });
  } else {
    insights.push({
      type: "success",
      title: "Pendapatan stabil",
      description: `Total pendapatan ${rupiah(stats.revenue)} dalam periode ini.`,
      priority: 3,
    });
  }

  const bestBranch = branchRanking[0];
  if (bestBranch) {
    insights.push({
      type: "success",
      title: `${bestBranch.name} cabang terbaik`,
      description: `${rupiah(bestBranch.revenue)} dengan ${bestBranch.completed} service selesai.`,
      priority: 2,
    });
  }

  if (overdueCount > 0) {
    insights.push({
      type: overdueCount >= 5 ? "critical" : "warning",
      title: `${overdueCount} service melewati SLA ${slaDays} hari`,
      description:
        overdueCount >= 5
          ? "Prioritaskan penyelesaian hari ini."
          : "Segera cek dan percepat penyelesaian.",
      priority: overdueCount >= 5 ? 1 : 2,
    });
  }

  const topTech = leaderboard[0];
  if (topTech && topTech.name !== UNKNOWN_TECHNICIAN) {
    insights.push({
      type: "success",
      title: `${topTech.name} performa terbaik`,
      description: `${topTech.completed} service selesai, ${rupiah(topTech.revenue)} pendapatan.`,
      priority: 4,
    });
  }

  if (expenseGrowthPct > 15) {
    insights.push({
      type: "warning",
      title: `Pengeluaran naik ${expenseGrowthPct.toFixed(0)}%`,
      description: "Tinjau biaya operasional dan penggunaan sparepart.",
      priority: 3,
    });
  }

  if (previousRecall !== recallCount) {
    const delta = recallCount - previousRecall;
    if (delta < 0) {
      insights.push({
        type: "success",
        title: `Recall turun ${Math.abs(delta)}`,
        description: "Kualitas pengerjaan membaik.",
        priority: 5,
      });
    } else {
      insights.push({
        type: "warning",
        title: `Recall naik ${delta}`,
        description: "Evaluasi ulang prosedur QC.",
        priority: 2,
      });
    }
  }

  if (avgRating > 0 && avgRating < 4) {
    insights.push({
      type: "warning",
      title: `Rating customer ${avgRating.toFixed(1)}/5`,
      description: "Perhatikan keluhan dan ulasan pelanggan.",
      priority: 4,
    });
  }

  return insights.sort((a, b) => a.priority - b.priority);
}