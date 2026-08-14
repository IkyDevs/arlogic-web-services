"use client";

import WidgetShell from "./WidgetShell";
import { formatCompactRupiah } from "@/lib/owner/format";
import type { DashboardSnapshot } from "@/types/owner";

interface RowProps {
  label: string;
  value: string;
}

function Row({ label, value }: RowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-900">{value}</span>
    </div>
  );
}

export default function QuickStatisticsWidget({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const { quickStats } = snapshot;
  const error = snapshot.error.quickstats;
  if (error) {
    return <WidgetShell title="Statistik Cepat" state="error" errorMessage={error} />;
  }
  const hasAny =
    quickStats.serviceIn > 0 ||
    quickStats.serviceDone > 0 ||
    quickStats.pending > 0 ||
    quickStats.revenue > 0;
  if (!hasAny) {
    return (
      <WidgetShell
        title="Statistik Cepat"
        state="empty"
        emptyMessage="Belum ada transaksi hari ini. Ayo mulai menerima service."
      />
    );
  }
  return (
    <WidgetShell title="Statistik Cepat" subtitle="Hari ini" state="success">
      <div className="grid grid-cols-2 gap-x-6">
        <div>
          <Row label="Service Masuk" value={String(quickStats.serviceIn)} />
          <Row label="Service Selesai" value={String(quickStats.serviceDone)} />
          <Row label="Pending" value={String(quickStats.pending)} />
          <Row label="Recall" value={String(quickStats.recall)} />
          <Row label="Garansi" value={String(quickStats.warranty)} />
          <Row label="QC Pending" value={String(quickStats.qcPending)} />
        </div>
        <div>
          <Row label="Customer Baru" value={String(quickStats.newCustomers)} />
          <Row label="Revenue" value={formatCompactRupiah(quickStats.revenue)} />
          <Row
            label="Avg Service Time"
            value={
              quickStats.avgServiceTimeDays > 0
                ? `${quickStats.avgServiceTimeDays.toFixed(1)} hari`
                : "—"
            }
          />
          <Row
            label="Avg Repair Cost"
            value={
              quickStats.avgRepairCost > 0
                ? formatCompactRupiah(quickStats.avgRepairCost)
                : "—"
            }
          />
          <Row
            label="Avg QC Time"
            value={
              quickStats.avgQcTimeDays > 0
                ? `${quickStats.avgQcTimeDays.toFixed(1)} hari`
                : "—"
            }
          />
        </div>
      </div>
    </WidgetShell>
  );
}