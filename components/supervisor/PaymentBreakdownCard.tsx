"use client";

import { CreditCard } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";

interface PaymentSlice {
  key: string;
  label: string;
  count: number;
  nominal: number;
  pct: number;
}

interface PaymentBreakdownCardProps {
  slices: PaymentSlice[];
  totalNominal: number;
  loading: boolean;
}

const PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
  "#84cc16",
  "#ef4444",
];

export default function PaymentBreakdownCard({
  slices,
  totalNominal,
  loading,
}: PaymentBreakdownCardProps) {
  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 flex flex-col min-w-0">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center gap-2">
        <CreditCard className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Metode Pembayaran
          </h3>
          <p className="text-[11px] text-gray-400">
            Pendapatan periode aktif{totalNominal > 0 && ` · ${formatRupiah(totalNominal)}`}
          </p>
        </div>
      </div>

      <div className="p-4 flex-1">
        {loading ? (
          <div className="space-y-3" aria-label="Loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse bg-gray-100 dark:bg-white/5 rounded-lg" />
            ))}
          </div>
        ) : slices.length === 0 ? (
          <div className="h-32 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Belum ada data pembayaran
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Belum ada transaksi pendapatan pada periode ini
            </p>
          </div>
        ) : (
          <div className="space-y-2.5" role="list" aria-label="Rincian metode pembayaran">
            {slices.map((s, i) => {
              const color = PALETTE[i % PALETTE.length];
              return (
                <div key={s.key} role="listitem">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="font-medium text-gray-700 dark:text-gray-200 truncate">
                        {s.label}
                      </span>
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        · {s.count} tx
                      </span>
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0 tabular-nums">
                      {formatRupiah(s.nominal)}
                      <span className="ml-1.5 text-[10px] text-gray-400">{s.pct}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(s.pct, s.nominal > 0 ? 2 : 0)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="pt-2 text-[10px] text-gray-400">
              Termasuk split payment (dihitung per metode).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
