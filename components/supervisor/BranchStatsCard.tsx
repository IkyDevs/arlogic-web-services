"use client";

import { Wallet } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import {
  SERVICE_STATUS_META as STATUS_META,
  countStatus,
  statusTotal,
} from "@/lib/domain/serviceStatus";

// Re-export: kontrak lama dipertahankan; definisi kanonis di lib/domain/serviceStatus.ts.
export { STATUS_META, countStatus, statusTotal };

interface BranchStatsCardProps {
  branch: { id: string; name: string; code?: string };
  revenue: number;
  count: number;
  expenses: number;
  serviceCount: number;
  status: Record<string, number>;
  teknisi: Array<{ name: string; active: number }>;
  dateLabel: string;
  onClick: () => void;
}

export default function BranchStatsCard({
  branch,
  revenue,
  count,
  expenses,
  serviceCount,
  status,
  teknisi,
  dateLabel,
  onClick,
}: BranchStatsCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#0a0a0a]"
    >
      <div className="flex items-center gap-2 min-w-0 mb-1">
        <Wallet className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <h3 className="font-bold text-gray-900 dark:text-gray-100 truncate">{branch.name}</h3>
        <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500 flex-shrink-0">
          {branch.code}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{dateLabel}</p>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2 text-center">
          <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 truncate">{formatRupiah(revenue)}</p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Pendapatan</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-center">
          <p className="text-sm sm:text-base font-bold text-blue-600 dark:text-blue-400">{count}</p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Transaksi</p>
        </div>
        <div className="bg-violet-50 dark:bg-violet-900/20 rounded-lg p-2 text-center">
          <p className="text-sm sm:text-base font-bold text-violet-600 dark:text-violet-400">{serviceCount}</p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Service</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-2 text-center">
          <p className="text-sm sm:text-base font-bold text-orange-600 dark:text-orange-400">{teknisi.length}</p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Teknisi</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mt-2">
        {STATUS_META.map((s) => {
          const n = countStatus(status, s.match);
          return (
            <span key={s.key} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.cls}`}>
              {s.label} {n}
            </span>
          );
        })}
      </div>

      {teknisi.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-white/5 space-y-1">
          {teknisi.map((t) => (
            <div key={t.name} className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-300 truncate">{t.name}</span>
              <span className={`font-semibold flex-shrink-0 ${t.active > 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-400"}`}>
                {t.active} aktif
              </span>
            </div>
          ))}
        </div>
      )}

      {expenses > 0 && (
        <p className="mt-2.5 text-[10px] text-red-500 dark:text-red-400">
          Pengeluaran: {formatRupiah(expenses)}
        </p>
      )}
    </button>
  );
}