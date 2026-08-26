"use client";

import { Users } from "lucide-react";

interface TechnicianRow {
  id: string;
  name: string;
  branchName: string;
  total: number;
  completed: number;
  active: number;
  completionRate: number;
}

interface TechnicianPerformancePanelProps {
  rows: TechnicianRow[];
  loading: boolean;
}

function rankBadge(rank: number) {
  if (rank === 1) return "bg-amber-400 text-white";
  if (rank === 2) return "bg-slate-300 text-slate-700 dark:bg-slate-600 dark:text-slate-100";
  if (rank === 3) return "bg-orange-200 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
  return "bg-transparent text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/10";
}

export default function TechnicianPerformancePanel({
  rows,
  loading,
}: TechnicianPerformancePanelProps) {
  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 flex flex-col min-w-0">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center gap-2">
        <Users className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Performa Teknisi
          </h3>
          <p className="text-[11px] text-gray-400">
            Ranking berdasarkan service selesai periode aktif
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-2" aria-label="Loading">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse bg-gray-100 dark:bg-white/5 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-10 text-center px-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Belum ada aktivitas teknisi
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Teknisi dengan penugasan pada periode ini akan tampil di sini
          </p>
        </div>
      ) : (
        <div className="p-2 sm:p-3 grid grid-cols-1 lg:grid-cols-2 gap-1">
          {rows.map((t, idx) => (
            <div
              key={t.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <span
                className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${rankBadge(idx + 1)}`}
                aria-label={`Peringkat ${idx + 1}`}
              >
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {t.name}
                  </p>
                  <span className="text-[9px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500 flex-shrink-0">
                    {t.branchName}
                  </span>
                  <span className="ml-auto text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0 tabular-nums">
                    {t.completed} selesai
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(t.completionRate, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 tabular-nums">
                  {t.total} total · {t.active} aktif · completion rate{" "}
                  <span
                    className={
                      t.completionRate >= 70
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : t.completionRate < 40
                          ? "text-red-500 dark:text-red-400 font-semibold"
                          : "text-gray-500 dark:text-gray-400 font-semibold"
                    }
                  >
                    {t.completionRate}%
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
