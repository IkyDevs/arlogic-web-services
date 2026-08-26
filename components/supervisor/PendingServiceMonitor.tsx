"use client";

import { Hourglass } from "lucide-react";

interface PendingStage {
  key: string;
  label: string;
  color: string;
  value: number;
}

interface PendingServiceMonitorProps {
  stages: PendingStage[];
  totalServices: number;
  loading: boolean;
}

export default function PendingServiceMonitor({
  stages,
  totalServices,
  loading,
}: PendingServiceMonitorProps) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  const busiest = stages.reduce(
    (best, s) => (s.value > best.value ? s : best),
    stages[0],
  );

  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 flex flex-col min-w-0">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center gap-2">
        <Hourglass className="w-4 h-4 text-amber-500 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Service Pending
          </h3>
          <p className="text-[11px] text-gray-400">Antrean per tahap pengerjaan</p>
        </div>
      </div>

      <div className="p-4 flex-1">
        {loading ? (
          <div className="space-y-3" aria-label="Loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-gray-100 dark:bg-white/5 rounded-lg" />
            ))}
          </div>
        ) : stages.every((s) => s.value === 0) ? (
          <div className="h-40 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Tidak ada pending
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Semua service dalam periode ini sudah final
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3" role="list" aria-label="Pending per tahap">
              {stages.map((s) => {
                const share =
                  totalServices > 0
                    ? Math.round((s.value / totalServices) * 100)
                    : 0;
                return (
                  <div key={s.key} role="listitem">
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 min-w-0 truncate">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s.color }}
                          aria-hidden="true"
                        />
                        {s.label}
                        {busiest && s.key === busiest.key && s.value > 0 && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            Terbanyak
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0 tabular-nums">
                        {s.value.toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max((s.value / max) * 100, s.value > 0 ? 3 : 0)}%`,
                          backgroundColor: s.color,
                        }}
                      />
                    </div>
                    <p className="text-[9px] text-gray-400 mt-0.5">{share}% dari total service</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 text-[10px] text-gray-400">
              Threshold peringatan belum ditetapkan sistem (UNKNOWN).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
