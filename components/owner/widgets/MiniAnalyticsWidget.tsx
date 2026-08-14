"use client";

import WidgetShell from "./WidgetShell";
import { formatCompactRupiah } from "@/lib/owner/format";
import type { DashboardSnapshot } from "@/types/owner";

export default function MiniAnalyticsWidget({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const { mini } = snapshot;
  const error = snapshot.error.mini;
  if (error) {
    return <WidgetShell title="Mini Analytics" state="error" errorMessage={error} />;
  }
  const hasAny = mini.topHours.length > 0 || mini.topBrands.length > 0;
  if (!hasAny) {
    return (
      <WidgetShell
        title="Mini Analytics"
        state="empty"
        emptyMessage="Belum ada data analitik pada periode ini."
      />
    );
  }
  return (
    <WidgetShell
      title="Mini Analytics"
      subtitle="Pola bisnis dari data periode ini"
      state="success"
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">
            Jam Terlaris
          </p>
          <div className="space-y-1">
            {mini.topHours.slice(0, 4).map((h) => (
              <div key={h.hour} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-16">
                  {h.hour.toString().padStart(2, "0")}:00
                </span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (h.count / Math.max(1, mini.topHours[0].count)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 w-5 text-right">
                  {h.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">
            Revenue per Brand
          </p>
          <div className="space-y-1">
            {mini.topBrands.slice(0, 4).map((b) => (
              <div key={b.brand} className="flex items-center justify-between">
                <span className="text-xs text-slate-600 truncate pr-2">
                  {b.brand}
                </span>
                <span className="text-xs font-semibold text-slate-900">
                  {formatCompactRupiah(b.revenue)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-2">
            Sparepart Terbanyak
          </p>
          <div className="space-y-1">
            {mini.topSpareparts.slice(0, 4).map((s) => (
              <div key={s.name} className="flex items-center justify-between">
                <span className="text-xs text-slate-600 truncate pr-2">
                  {s.name}
                </span>
                <span className="text-xs font-semibold text-slate-900">
                  {s.count}×
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-2 lg:col-span-3 pt-3 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-2">
          <span className="text-xs text-slate-500">
            Avg Repair Time:{" "}
            <strong className="text-slate-900">
              {mini.avgRepairDays > 0 ? `${mini.avgRepairDays.toFixed(1)} hari` : "—"}
            </strong>
          </span>
          <span className="text-xs text-slate-500">
            Customer Satisfaction:{" "}
            <strong className="text-slate-900">
              {mini.satisfaction !== null ? `${mini.satisfaction}/5` : "—"}
            </strong>
          </span>
          <span className="text-xs text-slate-500">
            Warranty Claim:{" "}
            <strong className="text-slate-900">
              {mini.warrantyClaims > 0 ? mini.warrantyClaims : "—"}
            </strong>
          </span>
          <span className="text-xs text-slate-500">
            Recall:{" "}
            <strong className="text-slate-900">
              {mini.recallTrend.length > 0
                ? `${mini.recallTrend[mini.recallTrend.length - 1].count} bulan ini`
                : "0"}
            </strong>
          </span>
        </div>
      </div>
    </WidgetShell>
  );
}