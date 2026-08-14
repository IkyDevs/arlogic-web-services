"use client";

import { memo } from "react";
import WidgetShell from "./WidgetShell";
import KpiCard from "./KpiCard";
import type { DashboardSnapshot } from "@/types/owner";

function KpiGridWidget({ snapshot }: { snapshot: DashboardSnapshot }) {
  if (snapshot.error.kpis) {
    return (
      <WidgetShell
        title="KPI Utama"
        state="error"
        errorMessage={snapshot.error.kpis}
      />
    );
  }
  if (snapshot.kpis.length === 0) {
    return (
      <WidgetShell
        title="KPI Utama"
        state="empty"
        emptyMessage="Belum ada data KPI pada periode ini."
      />
    );
  }
  return (
    <WidgetShell title="KPI Utama" subtitle="Ringkasan performa bisnis" state="success">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {snapshot.kpis.map((kpi) => (
          <KpiCard key={kpi.key} metric={kpi} />
        ))}
      </div>
    </WidgetShell>
  );
}

export default memo(KpiGridWidget);