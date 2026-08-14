"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import WidgetShell from "./WidgetShell";
import { formatRupiah, formatDate } from "@/lib/owner/format";
import { statusLabel } from "@/constants/owner";
import type { DashboardSnapshot, RecentServiceRow } from "@/types/owner";

function statusBadge(status: string): string {
  const cls =
    status === "completed" || status === "done"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "cancelled" || status === "rejected"
        ? "bg-red-50 text-red-600 border-red-200"
        : status === "qc_pending"
          ? "bg-amber-50 text-amber-700 border-amber-200"
          : "bg-blue-50 text-blue-700 border-blue-200";
  return `px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cls}`;
}

export default function RecentServicesWidget({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const { recentServices: services } = snapshot;
  const error = snapshot.error.recent;
  const [selected, setSelected] = useState<RecentServiceRow | null>(null);

  if (error) {
    return <WidgetShell title="Service Terbaru" state="error" errorMessage={error} />;
  }
  if (services.length === 0) {
    return (
      <WidgetShell
        title="Service Terbaru"
        state="empty"
        emptyMessage="Belum ada service pada periode ini."
      />
    );
  }
  return (
    <WidgetShell
      title="Service Terbaru"
      subtitle={`${services.length} service terakhir diperbarui`}
      state="success"
    >
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left text-sm min-w-[640px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
              <th className="px-2 py-2 font-semibold">Invoice</th>
              <th className="px-2 py-2 font-semibold">Customer</th>
              <th className="px-2 py-2 font-semibold">Brand</th>
              <th className="px-2 py-2 font-semibold">Teknisi</th>
              <th className="px-2 py-2 font-semibold">Status</th>
              <th className="px-2 py-2 font-semibold text-right">Nominal</th>
              <th className="px-2 py-2 font-semibold text-right">Update</th>
            </tr>
          </thead>
          <tbody>
            {services.map((row) => (
              <tr
                key={row.id}
                onClick={() => setSelected(row)}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 cursor-pointer transition-colors"
              >
                <td className="px-2 py-2.5 font-mono text-xs text-slate-700">
                  {row.invoiceNumber}
                </td>
                <td className="px-2 py-2.5 text-slate-900 font-medium">
                  {row.customerName}
                </td>
                <td className="px-2 py-2.5 text-slate-600">{row.brand}</td>
                <td className="px-2 py-2.5 text-slate-600">
                  {row.technicianName}
                </td>
                <td className="px-2 py-2.5">
                  <span className={statusBadge(row.status)}>
                    {statusLabel[row.status] || row.status}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right font-semibold text-slate-900">
                  {row.nominal > 0 ? formatRupiah(row.nominal) : "—"}
                </td>
                <td className="px-2 py-2.5 text-right text-xs text-slate-400">
                  {formatDate(row.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-[80] flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Detail service ${selected.invoiceNumber}`}
            className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900">
                  {selected.invoiceNumber}
                </h3>
                <p className="text-xs text-slate-400">{selected.customerName}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
                aria-label="Tutup detail"
              >
                ✕
              </button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-400">Brand</dt>
                <dd className="font-medium text-slate-900">{selected.brand}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Teknisi</dt>
                <dd className="font-medium text-slate-900">
                  {selected.technicianName}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Status</dt>
                <dd>
                  <span className={statusBadge(selected.status)}>
                    {statusLabel[selected.status] || selected.status}
                  </span>
                </dd>
              </div>
              {selected.qcStatus && (
                <div className="flex justify-between">
                  <dt className="text-slate-400">QC</dt>
                  <dd className="font-medium text-amber-600">
                    {selected.qcStatus}
                  </dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-slate-400">Nominal</dt>
                <dd className="font-semibold text-slate-900">
                  {selected.nominal > 0 ? formatRupiah(selected.nominal) : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-400">Update terakhir</dt>
                <dd className="text-slate-900">{formatDate(selected.updatedAt)}</dd>
              </div>
            </dl>
            <motion.div className="mt-4 flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                Tutup
              </button>
            </motion.div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}