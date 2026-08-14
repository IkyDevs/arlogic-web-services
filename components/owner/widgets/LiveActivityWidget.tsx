"use client";

import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import WidgetShell from "./WidgetShell";
import { ANIMATION } from "@/constants/owner";
import { formatTime } from "@/lib/owner/format";
import type { DashboardSnapshot, LiveActivityItem } from "@/types/owner";

const toneColor: Record<LiveActivityItem["tone"], string> = {
  info: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  primary: "bg-slate-800",
};

export default function LiveActivityWidget({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const { activity } = snapshot;
  const error = snapshot.error.activity;
  if (error) {
    return <WidgetShell title="Aktivitas Langsung" state="error" errorMessage={error} />;
  }
  const isEmpty = activity.length === 0;
  return (
    <WidgetShell
      title="Live Activity"
      subtitle="Realtime dari seluruh cabang"
      state="success"
    >
      <div
        role="log"
        aria-live="polite"
        aria-label="Aktivitas realtime terbaru"
        className="space-y-1 max-h-72 overflow-y-auto pr-1"
      >
        {isEmpty ? (
          <p className="text-sm text-slate-400 py-6 text-center">
            Belum ada aktivitas. Ayo mulai menerima service!
          </p>
        ) : (
          activity.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: ANIMATION.fade / 1000 }}
              className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0"
            >
              <span className="relative mt-1 flex-shrink-0">
                <span
                  className={`w-2 h-2 rounded-full inline-block ${toneColor[item.tone]} ${
                    i === 0 ? "animate-pulse" : ""
                  }`}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700 break-words">
                  {item.message}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formatTime(item.time)}
                </p>
              </div>
              {i === 0 && (
                <Activity className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              )}
            </motion.div>
          ))
        )}
      </div>
    </WidgetShell>
  );
}