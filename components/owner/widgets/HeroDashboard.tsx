"use client";

import { useAuthStore } from "@/stores/authStore";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import WidgetShell from "./WidgetShell";
import HealthGauge from "./HealthGauge";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import type { DashboardSnapshot } from "@/types/owner";

export default function HeroDashboard({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const { user } = useAuthStore();
  const firstName = user?.full_name?.split(" ")[0] || "Owner";
  const { stats, health } = snapshot;
  const growth = snapshot.kpis.find((k) => k.key === "revenue")?.changePct || 0;
  const greeting =
    new Date().getHours() < 12
      ? "Selamat pagi"
      : new Date().getHours() < 18
        ? "Selamat siang"
        : "Selamat malam";

  return (
    <WidgetShell title="Ringkasan Bisnis" state="success">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 via-white to-blue-50/40 p-5 sm:p-7">
        <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1">
            <p className="text-sm text-slate-500">
              {greeting},{" "}
              <span className="font-semibold text-slate-900">{firstName}</span>{" "}
              👋
            </p>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">
              Ringkasan performa bisnis hari ini
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {format(new Date(), "EEEE, dd MMMM yyyy", { locale: id })}
            </p>

            <div className="mt-5 flex items-end gap-3 flex-wrap">
              <div>
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                  Revenue Hari Ini
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {stats.todayRevenue.toLocaleString("id-ID")}
                </p>
              </div>
              <span
                className={`flex items-center gap-1 text-xs font-semibold mb-1 ${
                  growth >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {growth >= 0 ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {growth >= 0 ? "+" : ""}
                {growth.toFixed(1)}%
                <span className="text-slate-400 font-normal">
                  dibanding periode lalu
                </span>
              </span>
            </div>
          </div>

          <HealthGauge score={health.score} status={health.status} />
        </div>
      </div>
    </WidgetShell>
  );
}