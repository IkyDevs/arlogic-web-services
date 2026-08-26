"use client";

import { useState } from "react";
import { Wrench, ChevronDown, Clock } from "lucide-react";
import {
  SERVICE_STATUS_DETAIL_LABELS,
  SERVICE_STATUS_META,
} from "@/lib/domain/serviceStatus";
import type { RecentService } from "@/hooks/useSupervisorDashboard";

interface RecentServicesCardProps {
  rows: RecentService[];
  loading: boolean;
}

const COLLAPSED_COUNT = 8;

function statusBadge(status: string | null) {
  const meta = SERVICE_STATUS_META.find((m) => m.match.includes(status || ""));
  const label =
    (status && SERVICE_STATUS_DETAIL_LABELS[status]) || status || "-";
  return { label, cls: meta?.cls || "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300" };
}

function timeLabel(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function RecentServicesCard({
  rows,
  loading,
}: RecentServicesCardProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_COUNT);
  const canExpand = rows.length > COLLAPSED_COUNT;

  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 overflow-hidden flex flex-col min-w-0">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center gap-2">
        <Wrench className="w-4 h-4 text-violet-500 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Service Terbaru
          </h3>
          <p className="text-[11px] text-gray-400">Status terkini tiap service order</p>
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
            Belum ada service
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Service order pada periode terpilih akan tampil di sini
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                  <th className="px-3 sm:px-4 py-2.5 text-left font-semibold">Waktu</th>
                  <th className="px-3 py-2.5 text-left font-semibold">No. Service</th>
                  <th className="px-3 py-2.5 text-left font-semibold hidden lg:table-cell">Cabang</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Pelanggan</th>
                  <th className="px-3 py-2.5 text-left font-semibold hidden xl:table-cell">Jenis</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Status</th>
                  <th className="px-3 sm:px-4 py-2.5 text-right font-semibold hidden md:table-cell">Teknisi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {visible.map((s) => {
                  const badge = statusBadge(s.status);
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-3 sm:px-4 py-2.5 text-gray-500 dark:text-gray-400">
                        {timeLabel(s.created_at)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-gray-500 dark:text-gray-400">
                        {s.invoice_number || `#${s.id.slice(0, 8)}`}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hidden lg:table-cell max-w-[8rem] truncate">
                        {s.branchName}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100 max-w-[10rem] truncate">
                        {s.customer_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 hidden xl:table-cell max-w-[8rem] truncate">
                        {s.category || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-right text-gray-500 dark:text-gray-400 hidden md:table-cell max-w-[8rem] truncate">
                        {s.teknisiName !== "-" ? s.teknisiName : "Belum ditugaskan"}
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
              className="w-full py-2.5 border-t border-gray-100 dark:border-white/5 text-xs font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-500"
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
