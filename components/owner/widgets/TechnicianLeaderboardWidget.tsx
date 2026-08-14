"use client";

import { motion } from "framer-motion";
import { Trophy, Zap, Crown, Medal } from "lucide-react";
import WidgetShell from "./WidgetShell";
import { ANIMATION } from "@/constants/owner";
import { formatCompactRupiah } from "@/lib/owner/format";
import { useCountUp } from "@/hooks/useCountUp";
import type { DashboardSnapshot, LeaderboardBadge } from "@/types/owner";

const badgeMeta: Record<LeaderboardBadge, { icon: typeof Trophy; label: string; cls: string }> = {
  "Top Performer": { icon: Crown, label: "Top Performer", cls: "bg-amber-50 text-amber-600 border-amber-200" },
  "Most Productive": { icon: Zap, label: "Most Productive", cls: "bg-blue-50 text-blue-600 border-blue-200" },
  Fastest: { icon: Medal, label: "Fastest", cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  "Highest Revenue": { icon: Trophy, label: "Highest Revenue", cls: "bg-violet-50 text-violet-600 border-violet-200" },
};

function RankNumber({ count }: { count: number }) {
  const animated = useCountUp(count);
  return <span>{Math.round(animated)}</span>;
}

export default function TechnicianLeaderboardWidget({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const { leaderboard } = snapshot;
  const error = snapshot.error.leaderboard;
  if (error) {
    return <WidgetShell title="Leaderboard Teknisi" state="error" errorMessage={error} />;
  }
  if (leaderboard.length === 0) {
    return (
      <WidgetShell
        title="Leaderboard Teknisi"
        state="empty"
        emptyMessage="Belum ada data teknisi pada periode ini."
      />
    );
  }
  return (
    <WidgetShell
      title="Leaderboard Teknisi"
      subtitle="Peringkat berdasarkan service selesai & revenue"
      state="success"
    >
      <div className="space-y-2.5">
        {leaderboard.slice(0, 5).map((tech, i) => {
          const BadgeIcon = tech.badge ? badgeMeta[tech.badge].icon : null;
          return (
            <motion.div
              key={tech.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: ANIMATION.fade / 1000 }}
              whileHover={{ y: -ANIMATION.lift / 2 }}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 hover:shadow-sm transition-shadow"
            >
              <span className="text-sm font-bold text-slate-400 w-5 text-center">
                {i + 1}
              </span>
              {tech.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tech.avatarUrl}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {tech.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {tech.name}
                  </p>
                  {tech.badge && BadgeIcon && (
                    <span
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-semibold ${badgeMeta[tech.badge].cls}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      {badgeMeta[tech.badge].label}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">
                  <RankNumber count={tech.completed} /> service selesai ·{" "}
                  {formatCompactRupiah(tech.revenue)} · {tech.pending} pending ·{" "}
                  {tech.avgRepairDays > 0
                    ? `${tech.avgRepairDays.toFixed(1)} hari/service`
                    : "—"}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </WidgetShell>
  );
}