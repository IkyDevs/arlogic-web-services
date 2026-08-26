"use client";

import { Users, Percent, Timer, Receipt } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";

interface QuickSummaryData {
  customersCount: number | null;
  avgTransaction: number | null;
  avgServiceHours: number | null;
  completionRate: number;
}

function avgServiceLabel(hours: number | null): string {
  if (hours === null) return "-";
  if (hours < 48) return `${hours.toFixed(1)} jam`;
  return `${(hours / 24).toFixed(1)} hari`;
}

export default function QuickSummaryStrip({ summary }: { summary: QuickSummaryData }) {
  const items: Array<{ icon: typeof Users; label: string; value: string }> = [
    {
      icon: Users,
      label: "Total Customer",
      value:
        summary.customersCount !== null
          ? summary.customersCount.toLocaleString("id-ID")
          : "UNKNOWN",
    },
    {
      icon: Percent,
      label: "Completion Rate",
      value: `${summary.completionRate}%`,
    },
    {
      icon: Timer,
      label: "Rata-rata Waktu Service",
      value: avgServiceLabel(summary.avgServiceHours),
    },
    {
      icon: Receipt,
      label: "Rata-rata Transaksi",
      value:
        summary.avgTransaction !== null ? formatRupiah(summary.avgTransaction) : "-",
    },
  ];

  return (
    <div
      className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 px-4 sm:px-5 py-3 grid grid-cols-2 lg:grid-cols-4 gap-3"
      role="list"
      aria-label="Ringkasan tambahan"
    >
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} role="listitem" className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-gray-500 dark:text-gray-300" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
              {value}
            </p>
            <p className="text-[10px] text-gray-400 truncate">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
