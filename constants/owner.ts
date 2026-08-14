import type { WidgetId } from "@/types/owner";

export const WIDGET_ORDER: WidgetId[] = [
  "hero",
  "kpis",
  "health",
  "insights",
  "revenue",
  "target",
  "branches",
  "leaderboard",
  "activity",
  "quickstats",
  "recent",
  "mini",
];

export const ANIMATION = {
  hover: 180,
  lift: 4,
  shadow: 150,
  fade: 200,
} as const;

export const HEALTH_WEIGHTS = {
  revenueTrend: 0.3,
  completion: 0.25,
  pending: 0.2,
  recall: 0.15,
  rating: 0.1,
} as const;

export const HEALTH_THRESHOLD = {
  excellentMin: 80,
  warningMin: 60,
} as const;

export const LINE_COLORS = [
  "#2563eb",
  "#f59e0b",
  "#0d9488",
  "#8b5cf6",
  "#06b6d4",
  "#f43f5e",
  "#10b981",
] as const;

export const KPI_SPARK_POINTS = 12 as const;

export const SLA_OVERDUE_STATUSES: readonly string[] = [
  "completed",
  "done",
  "cancelled",
] as const;

export const RECENT_SERVICES_LIMIT = 8 as const;

export const ACTIVITY_MAX_ITEMS = 30 as const;

export const statusLabel: Record<string, string> = {
  pending: "Pending",
  in_progress: "Dikerjakan",
  qc_pending: "Menunggu QC",
  completed: "Selesai",
  done: "Diambil",
  cancelled: "Dibatalkan",
  rejected: "Ditolak",
};

export const statusTone: Record<string, "neutral" | "blue" | "amber" | "green" | "red"> = {
  pending: "amber",
  in_progress: "blue",
  qc_pending: "amber",
  completed: "green",
  done: "green",
  cancelled: "red",
  rejected: "red",
};

export const UNKNOWN_TECHNICIAN = "Unknown";