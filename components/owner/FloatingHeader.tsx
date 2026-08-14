"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { ANIMATION } from "@/constants/owner";
import { formatCompactRupiah } from "@/lib/owner/format";
import NotificationBell from "@/components/ui/NotificationBell";
import BranchSelector from "@/components/ui/BranchSelector";
import UserAvatar from "@/components/ui/UserAvatar";
import ExportButton from "@/components/owner/ExportButton";
import type { DashboardSnapshot } from "@/types/owner";
import type { Profile } from "@/types";

export default function FloatingHeader({
  snapshot,
  user,
  refreshing,
  dateRange,
  onRefresh,
  onToggleNotifications,
  notificationsOpen,
}: {
  snapshot: DashboardSnapshot;
  user: Profile | null;
  refreshing: boolean;
  dateRange: { start: Date; end: Date };
  onRefresh: () => void;
  onToggleNotifications: () => void;
  notificationsOpen: boolean;
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md border-b border-slate-200/70">
      <motion.div
        animate={{ height: compact ? 48 : 64 }}
        transition={{ duration: ANIMATION.shadow / 1000 }}
        className="flex items-center gap-3 px-4 sm:px-6 overflow-hidden"
      >
        <div className="min-w-0 flex-1">
          <p
            className={`font-bold text-slate-900 dark:text-gray-100 truncate ${
              compact ? "text-sm" : "text-base"
            }`}
          >
            Owner Dashboard
          </p>
          <p className="text-[11px] text-slate-400 truncate">
            Hari ini{" "}
            <span className="font-semibold text-slate-600 dark:text-gray-300">
              {formatCompactRupiah(snapshot.stats.todayRevenue)}
            </span>{" "}
            · Health{" "}
            <span
              className={`font-semibold ${
                snapshot.health.score >= 80
                  ? "text-emerald-600"
                  : snapshot.health.score >= 60
                    ? "text-amber-600"
                    : "text-red-500"
              }`}
            >
              {snapshot.health.score}
            </span>{" "}
            · {snapshot.stats.activeServices} service aktif
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh data"
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <div className="relative" onClick={onToggleNotifications}>
            <NotificationBell open={notificationsOpen} setOpen={onToggleNotifications} />
          </div>
          <BranchSelector />
          <ExportButton data={snapshot.stats} dateRange={dateRange} />
          <UserAvatar user={user} />
        </div>
      </motion.div>
    </header>
  );
}