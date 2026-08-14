"use client";

import { Suspense, lazy } from "react";
import type { WidgetContext, WidgetDef, WidgetId } from "@/types/owner";

const HeroDashboard = lazy(() => import("./widgets/HeroDashboard"));
const KpiGridWidget = lazy(() => import("./widgets/KpiGridWidget"));
const HealthGaugeWidget = lazy(() => import("./widgets/HealthGaugeWidget"));
const InsightList = lazy(() => import("./widgets/InsightList"));
const RevenueChart = lazy(() => import("./RevenueChart"));
const TargetProgressWidget = lazy(() => import("./widgets/TargetProgressWidget"));
const BranchPerformanceWidget = lazy(() => import("./widgets/BranchPerformanceWidget"));
const TechnicianLeaderboardWidget = lazy(() => import("./widgets/TechnicianLeaderboardWidget"));
const LiveActivityWidget = lazy(() => import("./widgets/LiveActivityWidget"));
const QuickStatisticsWidget = lazy(() => import("./widgets/QuickStatisticsWidget"));
const RecentServicesWidget = lazy(() => import("./widgets/RecentServicesWidget"));
const MiniAnalyticsWidget = lazy(() => import("./widgets/MiniAnalyticsWidget"));

export const widgetRegistry: Record<WidgetId, WidgetDef> = {
  hero: { id: "hero", title: "Ringkasan Bisnis", render: (ctx) => <HeroDashboard snapshot={ctx.snapshot} /> },
  kpis: { id: "kpis", title: "KPI Utama", render: (ctx) => <KpiGridWidget snapshot={ctx.snapshot} /> },
  health: { id: "health", title: "Business Health", render: (ctx) => <HealthGaugeWidget snapshot={ctx.snapshot} /> },
  insights: { id: "insights", title: "AI Business Insight", render: (ctx) => <InsightList snapshot={ctx.snapshot} /> },
  revenue: { id: "revenue", title: "Revenue Overview", render: (ctx) => <RevenueChart dateRange={ctx.dateRange} /> },
  target: { id: "target", title: "Target Revenue", render: (ctx) => <TargetProgressWidget snapshot={ctx.snapshot} updateSettings={ctx.updateSettings} /> },
  branches: { id: "branches", title: "Performa Cabang", render: (ctx) => <BranchPerformanceWidget snapshot={ctx.snapshot} /> },
  leaderboard: { id: "leaderboard", title: "Leaderboard Teknisi", render: (ctx) => <TechnicianLeaderboardWidget snapshot={ctx.snapshot} /> },
  activity: { id: "activity", title: "Live Activity", render: (ctx) => <LiveActivityWidget snapshot={ctx.snapshot} /> },
  quickstats: { id: "quickstats", title: "Statistik Cepat", render: (ctx) => <QuickStatisticsWidget snapshot={ctx.snapshot} /> },
  recent: { id: "recent", title: "Service Terbaru", render: (ctx) => <RecentServicesWidget snapshot={ctx.snapshot} /> },
  mini: { id: "mini", title: "Mini Analytics", render: (ctx) => <MiniAnalyticsWidget snapshot={ctx.snapshot} /> },
};

function WidgetSkeleton() {
  return (
    <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/70 dark:border-white/5 shadow-sm p-5">
      <div className="h-3.5 w-1/3 rounded-full bg-slate-200 animate-pulse mb-3" />
      <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
    </div>
  );
}

export default function WidgetRenderer({
  id,
  ctx,
}: {
  id: WidgetId;
  ctx: WidgetContext;
}) {
  const def = widgetRegistry[id];
  return <Suspense fallback={<WidgetSkeleton />}>{def.render(ctx)}</Suspense>;
}