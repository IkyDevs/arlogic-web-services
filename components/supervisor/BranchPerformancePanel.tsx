"use client";

import { Trophy } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";

export interface BranchPerformanceRow {
  branch: { id: string; name: string; code?: string };
  revenue: number;
  count: number;
  services: number;
  expenses: number;
  teknisiCount: number;
  activeLoad: number;
  contribution: number;
  /** Opsional — disediakan revisi UI untuk highlight monitoring */
  pending?: number;
  completed?: number;
  completionRate?: number;
}

interface BranchPerformancePanelProps {
  rows: BranchPerformanceRow[];
  loading: boolean;
  onSelect: (branch: { id: string; name: string; code?: string }) => void;
}

const rankBadge = (rank: number) => {
  if (rank === 1)
    return "bg-blue-600 text-white";
  if (rank === 2 || rank === 3)
    return "bg-slate-200 text-slate-700 dark:bg-white/15 dark:text-slate-200";
  return "bg-transparent text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/10";
};

export default function BranchPerformancePanel({
  rows,
  loading,
  onSelect,
}: BranchPerformancePanelProps) {
  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 flex flex-col min-h-0">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-blue-500" />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Performa Cabang
          </h3>
          <p className="text-[11px] text-gray-400">Ranking berdasarkan pendapatan</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {loading ? (
          <div className="p-4 space-y-3" aria-label="Loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse bg-gray-100 dark:bg-white/5 rounded-xl"
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Belum ada data cabang
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Belum ada aktivitas pada periode yang dipilih
            </p>
          </div>
        ) : (
          <div className="p-2 sm:p-3 space-y-1">
            {rows.map((r, idx) => (
              <button
                key={r.branch.id}
                type="button"
                onClick={() => onSelect(r.branch)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${rankBadge(idx + 1)}`}
                  >
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {r.branch.name}
                      </p>
                      {r.branch.code && (
                        <span className="text-[9px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500 flex-shrink-0">
                          {r.branch.code}
                        </span>
                      )}
                      <span className="ml-auto text-sm font-bold text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                        {formatRupiah(r.revenue)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{
                          width: `${Math.min(r.contribution, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 flex flex-wrap items-center gap-x-1">
                      <span>
                        {r.contribution.toFixed(1)}% dari total · {r.count} transaksi ·{" "}
                        {r.services} service · {r.teknisiCount} teknisi
                      </span>
                      {(r.pending ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 font-semibold">
                          {r.pending} pending
                        </span>
                      )}
                      {r.completionRate !== undefined && (
                        <span
                          className={`font-semibold ${
                            r.completionRate >= 70
                              ? "text-emerald-600 dark:text-emerald-400"
                              : r.completionRate < 40
                                ? "text-red-500 dark:text-red-400"
                                : "text-gray-400"
                          }`}
                        >
                          · selesai {r.completed ?? 0} ({r.completionRate}%)
                        </span>
                      )}
                      {r.activeLoad > 0 && <span>· {r.activeLoad} beban aktif</span>}
                      {r.expenses > 0 && <span>· pengeluaran {formatRupiah(r.expenses)}</span>}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}