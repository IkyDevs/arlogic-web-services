"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import WidgetShell from "./WidgetShell";
import { ANIMATION } from "@/constants/owner";
import type { DashboardSnapshot, InsightSeverity } from "@/types/owner";

const severityMeta: Record<
  InsightSeverity,
  { icon: typeof CheckCircle2; color: string; bg: string }
> = {
  success: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
  warning: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
  critical: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
};

export default function InsightList({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const { insights } = snapshot;
  const error = snapshot.error.insights;
  if (error) {
    return <WidgetShell title="AI Business Insight" state="error" errorMessage={error} />;
  }
  if (insights.length === 0) {
    return (
      <WidgetShell
        title="AI Business Insight"
        state="empty"
        emptyMessage="Belum ada insight untuk periode ini."
      />
    );
  }
  return (
    <WidgetShell
      title="AI Business Insight"
      subtitle="Analisis otomatis dari data terkini"
      state="success"
    >
      <div className="space-y-2.5">
        {insights.slice(0, 5).map((insight) => {
          const meta = severityMeta[insight.type];
          const Icon = meta.icon;
          return (
            <motion.div
              key={insight.title}
              whileHover={{ y: -2 }}
              transition={{ duration: ANIMATION.hover / 1000 }}
              className={`flex items-start gap-3 rounded-xl border border-slate-100 p-3 ${meta.bg}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.color}`} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {insight.title}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {insight.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </WidgetShell>
  );
}