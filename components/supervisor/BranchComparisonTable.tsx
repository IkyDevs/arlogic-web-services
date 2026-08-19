"use client";

import { Table2 } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import { STATUS_META, countStatus, statusTotal } from "./BranchStatsCard";

interface Row {
  branchName: string;
  revenue: number;
  transactions: number;
  services: number;
  status: Record<string, number>;
  teknisiCount: number;
  activeLoad: number;
  expenses: number;
}

const STATUS_TEXT: Record<string, string> = {
  pending: "text-slate-600 dark:text-slate-300",
  digarap: "text-blue-600 dark:text-blue-400",
  nunggu: "text-amber-600 dark:text-amber-400",
  qc: "text-violet-600 dark:text-violet-400",
  selesai: "text-emerald-600 dark:text-emerald-400",
  batal: "text-red-600 dark:text-red-400",
};

export default function BranchComparisonTable({ rows }: { rows: Row[] }) {
  const hasData = rows.some((r) => r.services > 0 || r.transactions > 0);
  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 overflow-hidden">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center gap-2">
        <Table2 className="w-4 h-4 text-blue-500" />
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
          Komparasi Semua Cabang
        </h3>
      </div>
      <div className="overflow-auto max-h-64">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 sticky top-0 z-10">
              <th className="px-3 py-2.5 text-left font-semibold sticky left-0 top-0 z-20 bg-gray-50 dark:bg-[#242424]">Cabang</th>
              <th className="px-3 py-2.5 text-right font-semibold">Pendapatan</th>
              <th className="px-3 py-2.5 text-right font-semibold">Transaksi</th>
              <th className="px-3 py-2.5 text-right font-semibold">Total Service</th>
              {STATUS_META.map((s) => (
                <th key={s.key} className="px-3 py-2.5 text-right font-semibold">
                  {s.label}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-semibold">Teknisi</th>
              <th className="px-3 py-2.5 text-right font-semibold">Beban Aktif</th>
              <th className="px-3 py-2.5 text-right font-semibold">Pengeluaran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/5">
            {(rows.length > 0 ? rows : [{ branchName: "Belum ada data", revenue: 0, transactions: 0, services: 0, status: {}, teknisiCount: 0, activeLoad: 0, expenses: 0 }]).map(
              (r, idx) => {
                const isPlaceholder = r.branchName === "Belum ada data";
                return (
                  <tr key={idx} className={isPlaceholder ? "" : "hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"}>
                    <td className="px-3 py-2 font-semibold text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-[#1c1c1c]">
                      {r.branchName}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatRupiah(r.revenue)}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">{r.transactions}</td>
                    <td className="px-3 py-2 text-right text-violet-600 dark:text-violet-400">{r.services}</td>
                    {STATUS_META.map((s) => (
                      <td key={s.key} className={`px-3 py-2 text-right ${STATUS_TEXT[s.key]}`}>
                        {countStatus(r.status, s.match)}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-300">{r.teknisiCount}</td>
                    <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">{r.activeLoad}</td>
                    <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">
                      {r.expenses > 0 ? formatRupiah(r.expenses) : "-"}
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
          {hasData && rows.length > 1 && (
            <tfoot>
              <tr className="bg-gray-50 dark:bg-white/5 font-semibold text-gray-700 dark:text-gray-200">
                <td className="px-3 py-2 sticky left-0 bg-gray-50 dark:bg-[#242424]">Total</td>
                <td className="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(rows.reduce((a, r) => a + r.revenue, 0))}
                </td>
                <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">
                  {rows.reduce((a, r) => a + r.transactions, 0)}
                </td>
                <td className="px-3 py-2 text-right text-violet-600 dark:text-violet-400">
                  {rows.reduce((a, r) => a + r.services, 0)}
                </td>
                {STATUS_META.map((s) => (
                  <td key={s.key} className={`px-3 py-2 text-right ${STATUS_TEXT[s.key]}`}>
                    {rows.reduce((a, r) => a + countStatus(r.status, s.match), 0)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">{rows.reduce((a, r) => a + r.teknisiCount, 0)}</td>
                <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">
                  {rows.reduce((a, r) => a + r.activeLoad, 0)}
                </td>
                <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">
                  {formatRupiah(rows.reduce((a, r) => a + r.expenses, 0))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {hasData && (
        <p className="px-4 sm:px-5 py-2 text-[10px] text-gray-400 border-t border-gray-100 dark:border-white/5">
          Seluruh angka mengikuti periode & filter cabang aktif. Status = service yang dibuat dalam periode. Total service ={" "}
          {rows.reduce((a, r) => a + statusTotal(r.status), 0)}.
        </p>
      )}
    </div>
  );
}