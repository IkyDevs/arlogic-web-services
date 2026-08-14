import { HEALTH_WEIGHTS, HEALTH_THRESHOLD } from "@/constants/owner";
import type { BusinessHealth, HealthStatus } from "@/types/owner";

export interface HealthInput {
  revenueGrowthPct: number;
  completionRate: number;
  pendingRatio: number;
  recallCount: number;
  avgRating: number;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export function computeBusinessHealth(input: HealthInput): BusinessHealth {
  const revenueScore = clamp(75 + input.revenueGrowthPct * 1.25, 0, 100);
  const completionScore = clamp(input.completionRate, 0, 100);
  const pendingScore = 100 * (1 - clamp(input.pendingRatio, 0, 1));
  const recallScore = clamp(100 - input.recallCount * 20, 0, 100);
  const ratingScore = clamp((input.avgRating / 5) * 100, 0, 100);

  const score = Math.round(
    revenueScore * HEALTH_WEIGHTS.revenueTrend +
      completionScore * HEALTH_WEIGHTS.completion +
      pendingScore * HEALTH_WEIGHTS.pending +
      recallScore * HEALTH_WEIGHTS.recall +
      ratingScore * HEALTH_WEIGHTS.rating,
  );

  let status: HealthStatus = "critical";
  if (score >= HEALTH_THRESHOLD.excellentMin) status = "excellent";
  else if (score >= HEALTH_THRESHOLD.warningMin) status = "warning";

  return { score, status };
}