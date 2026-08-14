"use client";

import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import WidgetShell from "./WidgetShell";
import { ANIMATION } from "@/constants/owner";
import { formatCompactRupiah } from "@/lib/owner/format";
import type { DashboardSnapshot } from "@/types/owner";

const medal = ["🥇", "🥈", "🥉"];

export default function BranchPerformanceWidget({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const { branches } = snapshot;
  const error = snapshot.error.branches;
  if (error) {
    return <WidgetShell title="Performa Cabang" state="error" errorMessage={error} />;
  }
  if (branches.length === 0) {
    return (
      <WidgetShell
        title="Performa Cabang"
        state="empty"
        emptyMessage="Belum ada data cabang pada periode ini."
      />
    );
  }
  return (
    <WidgetShell
      title="Performa Cabang"
      subtitle="Peringkat otomatis berdasarkan revenue"
      state="success"
    >
      <div className="space-y-2.5">
        {branches.slice(0, 5).map((branch) => (
          <motion.div
            key={branch.branchId}
            whileHover={{ y: -ANIMATION.lift / 2 }}
            transition={{ duration: ANIMATION.hover / 1000 }}
            className="rounded-xl border border-slate-100 p-3 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg w-6 text-center">
                {medal[branch.rank - 1] || <Building2 className="w-4 h-4 mx-auto text-slate-300" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {branch.name}
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {formatCompactRupiah(branch.revenue)}
                  </p>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${branch.progress}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 w-8 text-right">
                    {branch.progress}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  {branch.completed} selesai · {branch.pending} pending ·{" "}
                  {branch.recall} recall
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </WidgetShell>
  );
}