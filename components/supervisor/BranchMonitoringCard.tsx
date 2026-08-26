"use client";

import { ShoppingCart, Wrench } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";

export interface BranchMonitoringStat {
  id: string;
  name: string;
  code?: string;
  transactions: number;
  revenue: number;
  services: number;
  pending: number;
  completed: number;
}

interface BranchMonitoringCardProps {
  stat: BranchMonitoringStat;
  compact?: boolean;
  onViewTransactions: () => void;
  onViewServices: () => void;
}

export default function BranchMonitoringCard({
  stat,
  compact = false,
  onViewTransactions,
  onViewServices,
}: BranchMonitoringCardProps) {
  const completion =
    stat.services > 0
      ? Math.round((stat.completed / stat.services) * 100)
      : null;

  return (
    <div
      className={`bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 p-4 flex flex-col gap-3 ${
        compact ? "" : "sm:p-5"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <h3
          className={`font-bold text-gray-900 dark:text-gray-100 truncate ${
            compact ? "text-base" : "text-sm sm:text-base"
          }`}
        >
          {stat.name}
        </h3>
        {stat.code && (
          <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500 flex-shrink-0">
            {stat.code}
          </span>
        )}
        {stat.pending > 0 && (
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 flex-shrink-0 whitespace-nowrap">
            {stat.pending} pending
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 py-2 px-1 min-w-0">
          <p className="text-sm sm:text-lg font-bold text-blue-600 dark:text-blue-400 tabular-nums truncate">
            {stat.transactions.toLocaleString("id-ID")}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Transaksi</p>
        </div>
        <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 py-2 px-1 min-w-0">
          <p className="text-sm sm:text-lg font-bold text-violet-600 dark:text-violet-400 tabular-nums truncate">
            {stat.services.toLocaleString("id-ID")}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Service</p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 py-2 px-1 min-w-0">
          <p className="text-sm sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
            {formatRupiah(stat.revenue)}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Pendapatan</p>
        </div>
        <div className="rounded-xl bg-gray-50 dark:bg-white/5 py-2 px-1 min-w-0">
          <p className="text-sm sm:text-lg font-bold text-gray-700 dark:text-gray-200 tabular-nums truncate">
            {completion !== null ? `${completion}%` : "—"}
          </p>
          <p className="text-[9px] sm:text-[10px] text-gray-500 mt-0.5">Selesai</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onViewTransactions}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-[#141414]"
          aria-label={`Lihat transaksi ${stat.name}`}
        >
          <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
          Transaksi
        </button>
        <button
          type="button"
          onClick={onViewServices}
          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-[#141414]"
          aria-label={`Lihat service ${stat.name}`}
        >
          <Wrench className="w-3.5 h-3.5" aria-hidden="true" />
          Service
        </button>
      </div>
    </div>
  );
}
