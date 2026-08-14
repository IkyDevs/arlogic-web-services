import type { ReactNode } from "react";
import type { OwnerStats, TechnicianPerf } from "@/lib/owner/stats";

export interface BusinessSettings {
  id: string;
  branch_id: string | null;
  monthly_revenue_target: number;
  daily_target: number;
  sla_days: number;
  currency: string;
  business_start_hour: number;
  business_end_hour: number;
  dashboard_theme: string;
  updated_at: string;
}

export type InsightSeverity = "success" | "warning" | "critical";
export type HealthStatus = "excellent" | "warning" | "critical";

export interface BusinessInsight {
  type: InsightSeverity;
  title: string;
  description: string;
  priority: number;
}

export interface BusinessHealth {
  score: number;
  status: HealthStatus;
}

export interface KpiMetric {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  changePct: number;
  target: number | null;
  progress: number | null;
  spark: number[];
  tone: "default" | "positive" | "negative";
}

export interface BranchPerformanceEntry {
  branchId: string;
  name: string;
  rank: number;
  revenue: number;
  services: number;
  completed: number;
  pending: number;
  recall: number;
  qcDone: number;
  progress: number;
}

export type LeaderboardBadge =
  | "Top Performer"
  | "Most Productive"
  | "Fastest"
  | "Highest Revenue";

export interface LeaderboardEntry extends TechnicianPerf {
  pending: number;
  avgRepairDays: number;
  recall: number;
  avatarUrl: string | null;
  badge: LeaderboardBadge | null;
}

export interface LiveActivityItem {
  id: string;
  time: Date;
  message: string;
  tone: "info" | "success" | "warning" | "primary";
}

export interface QuickStats {
  serviceIn: number;
  serviceDone: number;
  pending: number;
  recall: number;
  warranty: number;
  qcPending: number;
  newCustomers: number;
  revenue: number;
  avgServiceTimeDays: number;
  avgRepairCost: number;
  avgQcTimeDays: number;
}

export interface RecentServiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  brand: string;
  technicianName: string;
  status: string;
  nominal: number;
  qcStatus: string | null;
  updatedAt: Date;
}

export interface TargetProgress {
  target: number;
  achieved: number;
  progressPct: number;
  remaining: number;
  etaDays: number;
}

export interface MiniAnalytics {
  topHours: { hour: number; count: number }[];
  topBrands: { brand: string; revenue: number }[];
  topSpareparts: { name: string; count: number }[];
  avgRepairDays: number;
  satisfaction: number | null;
  warrantyClaims: number;
  recallTrend: { label: string; count: number }[];
}

export type WidgetId =
  | "hero"
  | "kpis"
  | "health"
  | "insights"
  | "revenue"
  | "target"
  | "branches"
  | "leaderboard"
  | "activity"
  | "quickstats"
  | "recent"
  | "mini";

export type WidgetState = "loading" | "empty" | "error" | "success";

export interface WidgetContext {
  snapshot: DashboardSnapshot;
  dateRange: { start: Date; end: Date };
  refresh: () => void;
  updateSettings: (patch: Partial<Pick<BusinessSettings, "monthly_revenue_target" | "daily_target" | "sla_days">>) => Promise<void>;
}

export interface WidgetDef {
  id: WidgetId;
  title: string;
  render: (ctx: WidgetContext) => ReactNode;
}

export interface DashboardSnapshot {
  stats: OwnerStats;
  settings: BusinessSettings;
  health: BusinessHealth;
  insights: BusinessInsight[];
  kpis: KpiMetric[];
  target: TargetProgress;
  branches: BranchPerformanceEntry[];
  leaderboard: LeaderboardEntry[];
  quickStats: QuickStats;
  recentServices: RecentServiceRow[];
  activity: LiveActivityItem[];
  mini: MiniAnalytics;
  dailyRevenueSpark: number[];
  lastUpdated: Date;
  error: Partial<Record<WidgetId, string>>;
}