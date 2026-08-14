"use client";

import WidgetShell from "./WidgetShell";
import HealthGauge from "./HealthGauge";
import type { DashboardSnapshot } from "@/types/owner";

export default function HealthGaugeWidget({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  return (
    <WidgetShell title="Business Health" state="success">
      <HealthGauge score={snapshot.health.score} status={snapshot.health.status} />
    </WidgetShell>
  );
}