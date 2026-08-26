"use client";

import { useState } from "react";
import { ReceiptText, ChevronDown, Clock } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import {
  metodePembayaranLabels,
} from "@/lib/domain/transaction/enums";
import type { RecentTransaction } from "@/hooks/useSupervisorDashboard";

interface RecentTransactionsCardProps {
  rows: RecentTransaction[];
  loading: boolean;
  onSelect: (tx: RecentTransaction) => void;
}

const TX_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: {
    label: "Aktif",
    cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  completed: {
    label: "Selesai",
    cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  cancelled: {
    label: "Batal",
    cls: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  },
};

const COLLAPSED_COUNT = 8;

function timeLabel(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentLabel(tx: RecentTransaction): string {
  const l = (m: string | null) =>
    (m && metodePembayaranLabels[m]) || m || "-";
  if (tx.split_payment && tx.metode_pembayaran_1 && tx.metode_pembayaran_2) {
    return `${l(tx.metode_pembayaran_1)} + ${l(tx.metode_pembayaran_2)}`;
  }
  return l(tx.metode_pembayaran);
}

export default function RecentTransactionsCard({
  rows,
  loading,
  onSelect,
}: RecentTransactionsCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);
  const canExpand = rows.length > COLLAPSED_COUNT;

  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 overflow-hidden flex flex-col min-w-0">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center gap-2">
        <ReceiptText className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Transaksi Terbaru
          </h3>
          <p className="text-[11px] text-gray-400">Klik baris untuk detail transaksi</p>
        </div>
      </div>

      {loading ? (
        <div className="p-4 space-y-2" aria-label="Loading">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse bg-gray-100 dark:bg-white/5 rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center px-4">
          <Clock className="w-6 h-6 text-gray-300 dark:text-gray-600 mb-2" aria-hidden="true" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Belum ada transaksi
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Transaksi pada periode terpilih akan tampil di sini
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                  <th className="px-3 sm:px-4 py-2.5 text-left font-semibold">Waktu</th>
                  <th className="px-3 py-2.5 text-left font-semibold hidden md:table-cell">Ref</th>
                  <th className="px-3 py-2.5 text-left font-semibold hidden lg:table-cell">Cabang</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Pelanggan</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-3 py-2.5 text-left font-semibold hidden xl:table-cell">Metode</th>
                  <th className="px-3 sm:px-4 py-2.5 text-right font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {visible.map((tx) => {
                  const badge = TX_STATUS_BADGE[tx.status || ""] || {
                    label: tx.status || "-",
                    cls: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
                  };
                  return (
                    <tr
                      key={tx.id}
                      onClick={() => onSelect(tx)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") onSelect(tx);
                      }}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                      aria-label={`Transaksi ${tx.customer_name}, ${formatRupiah(tx.nominal || 0)}`}
                    >
                      <td className="px-3 sm:px-4 py-2.5 text-gray-500 dark:text-gray-400">
                        {timeLabel(tx.created_at)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-gray-400 hidden md:table-cell">
                        #{tx.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell max-w-[8rem] truncate">
                        {tx.branchName}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 max-w-[10rem] truncate">
                        {tx.customer_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(tx.nominal || 0)}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hidden xl:table-cell">
                        {paymentLabel(tx)}
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="w-full py-2.5 border-t border-gray-100 dark:border-white/5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <span className="inline-flex items-center gap-1">
                {expanded ? "Tampilkan Lebih Sedikit" : `Lihat Semua (${rows.length})`}
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
