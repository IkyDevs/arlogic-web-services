"use client";

import {
  ReceiptText,
  Wrench,
  Hourglass,
  CheckCircle2,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  type LucideIcon,
} from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import type { SeriesPoint } from "@/lib/domain/shared/timeseries";

interface KpiData {
  totalRevenue: number;
  totalCount: number;
  totalExpenses: number;
  totalServices: number;
  pendingTotal: number;
  pendingPct: number;
  completedServices: number;
  completionRate: number;
  trend: {
    revenue: number | null;
    transactions: number | null;
    services: number | null;
    expenses: number | null;
  };
}

interface KPIStripProps {
  kpi: KpiData;
  txSpark: SeriesPoint[];
  svcSpark: SeriesPoint[];
  loading: boolean;
}

function Sparkline({ points, color }: { points: SeriesPoint[]; color: string }) {
  const vals = points.map((p) => p.value);
  if (vals.length < 2) return null;
  const max = Math.max(...vals, 1);
  const w = 76;
  const h = 26;
  const step = w / (vals.length - 1);
  const path = vals
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / max) * (h - 4)).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
        up
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
      }`}
      title="Dibanding periode sebelumnya"
    >
      {up ? <ArrowUpRight className="w-3 h-3" aria-hidden="true" /> : <ArrowDownRight className="w-3 h-3" aria-hidden="true" />}
      {Math.abs(value)}%
    </span>
  );
}

function CardShell({
  Icon,
  iconCls,
  badge,
  children,
  accent,
}: {
  Icon: LucideIcon;
  iconCls: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 bg-white dark:bg-[#1c1c1c] ${
        accent
          ? "border-blue-200/70 dark:border-blue-800/40 bg-blue-50/40 dark:bg-blue-900/10"
          : "border-gray-200/70 dark:border-white/10"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconCls}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
        {badge}
      </div>
      {children}
    </div>
  );
}

export default function KPIStrip({ kpi, txSpark, svcSpark, loading }: KPIStripProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse bg-gray-100 dark:bg-white/5 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" role="list" aria-label="Ringkasan KPI">
      <div role="listitem">
        <CardShell
          Icon={ReceiptText}
          iconCls="bg-blue-600 text-white"
          badge={<TrendBadge value={kpi.trend.transactions} />}
        >
          <div className="flex items-end justify-between gap-2">
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {kpi.totalCount.toLocaleString("id-ID")}
            </p>
            <Sparkline points={txSpark} color="#3b82f6" />
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Transaksi</p>
          <p className="text-[9px] text-gray-400 mt-0.5">vs periode sebelumnya</p>
        </CardShell>
      </div>

      <div role="listitem">
        <CardShell
          Icon={Wrench}
          iconCls="bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
          badge={<TrendBadge value={kpi.trend.services} />}
        >
          <div className="flex items-end justify-between gap-2">
            <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {kpi.totalServices.toLocaleString("id-ID")}
            </p>
            <Sparkline points={svcSpark} color="#8b5cf6" />
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Service</p>
          <p className="text-[9px] text-gray-400 mt-0.5">vs periode sebelumnya</p>
        </CardShell>
      </div>

      <div role="listitem">
        <CardShell
          Icon={Hourglass}
          iconCls={
            kpi.pendingPct >= 30
              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
              : "bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-300"
          }
          badge={
            kpi.pendingPct >= 30 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                ⚠ Perlu cek
              </span>
            ) : undefined
          }
        >
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {kpi.pendingTotal.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">Service Pending</p>
          <p className="text-[9px] text-gray-400 mt-0.5">{kpi.pendingPct}% dari total service</p>
        </CardShell>
      </div>

      <div role="listitem">
        <CardShell
          Icon={CheckCircle2}
          iconCls="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
        >
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {kpi.completedServices.toLocaleString("id-ID")}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">Service Selesai</p>
          <p className="text-[9px] text-gray-400 mt-0.5">Completion rate {kpi.completionRate}%</p>
        </CardShell>
      </div>

      <div role="listitem">
        <CardShell
          Icon={Wallet}
          iconCls="bg-blue-600 text-white"
          badge={<TrendBadge value={kpi.trend.revenue} />}
          accent
        >
          <p className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
            {formatRupiah(kpi.totalRevenue)}
          </p>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total Pendapatan</p>
          <p className="text-[9px] text-gray-400 mt-0.5">vs periode sebelumnya</p>
        </CardShell>
      </div>
    </div>
  );
}
