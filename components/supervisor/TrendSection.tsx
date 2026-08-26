"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { ReceiptText, Wrench } from "lucide-react";
import { useTheme } from "next-themes";
import { buildSeries, type TrendBucket, type SeriesPoint } from "@/lib/domain/shared/timeseries";

export interface TrendDataSource {
  range: { start: number; end: number };
  prevRange: { start: number; end: number };
  txCur: number[];
  txPrev: number[];
  svcInCur: number[];
  svcInPrev: number[];
  svcDoneCur: number[];
  svcDonePrev: number[];
  backlogCur: number[];
  defaultBucket: TrendBucket;
}

const BUCKETS: TrendBucket[] = ["harian", "mingguan", "bulanan"];
const BUCKET_LABELS: Record<TrendBucket, string> = {
  harian: "Harian",
  mingguan: "Mingguan",
  bulanan: "Bulanan",
};

function BucketToggle({
  value,
  onChange,
}: {
  value: TrendBucket;
  onChange: (b: TrendBucket) => void;
}) {
  return (
    <div
      className="flex gap-0.5 bg-gray-50 dark:bg-white/5 rounded-lg p-0.5"
      role="group"
      aria-label="Granularitas tren"
    >
      {BUCKETS.map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => onChange(b)}
          aria-pressed={value === b}
          className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            value === b
              ? "bg-slate-900 text-white dark:bg-slate-700"
              : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          }`}
        >
          {BUCKET_LABELS[b]}
        </button>
      ))}
    </div>
  );
}

function useChartTheme() {
  const { resolvedTheme: theme } = useTheme();
  const dark = theme === "dark";
  return {
    gridColor: dark ? "rgba(255,255,255,0.06)" : "#e2e8f0",
    axisColor: dark ? "#64748b" : "#94a3b8",
    tooltipBg: dark ? "#1c1c1c" : "#ffffff",
    textColor: dark ? "#e2e8f0" : "#0f172a",
    cursorFill: dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
  };
}

function mergeSeries(current: SeriesPoint[], previous: SeriesPoint[]) {
  const len = Math.max(current.length, previous.length);
  return Array.from({ length: len }, (_, i) => ({
    label: current[i]?.label ?? "",
    current: current[i]?.value ?? 0,
    previous: previous[i]?.value ?? 0,
  }));
}

function useTooltipStyle() {
  const theme = useChartTheme();
  return {
    ...theme,
    contentStyle: {
      backgroundColor: theme.tooltipBg,
      border: `1px solid ${theme.gridColor}`,
      borderRadius: 12,
      fontSize: 12,
      color: theme.textColor,
    },
    cursor: { fill: theme.cursorFill },
  };
}

function EmptyState() {
  return (
    <div className="h-56 flex flex-col items-center justify-center text-center">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Belum ada data</p>
      <p className="text-xs text-gray-400 mt-1">Belum ada aktivitas pada periode yang dipilih</p>
    </div>
  );
}

interface CardProps {
  data: TrendDataSource;
  loading: boolean;
}

export function TransactionTrendCard({ data, loading }: CardProps) {
  const [bucket, setBucket] = useState<TrendBucket>(data.defaultBucket);
  const tt = useTooltipStyle();
  const axisColor = tt.axisColor;

  const series = useMemo(() => {
    const cur = buildSeries(data.txCur, data.range, bucket);
    const prev = buildSeries(data.txPrev, data.prevRange, bucket);
    return mergeSeries(cur, prev);
  }, [data, bucket]);

  const hasData =
    data.txCur.length > 0 || data.txPrev.length > 0;

  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 flex flex-col min-w-0">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <ReceiptText className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Tren Transaksi</h3>
            <p className="text-[11px] text-gray-400">Periode aktif vs periode sebelumnya</p>
          </div>
        </div>
        <BucketToggle value={bucket} onChange={setBucket} />
      </div>
      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="h-56 animate-pulse bg-gray-100 dark:bg-white/5 rounded-xl" />
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={tt.gridColor} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={{ stroke: tt.gridColor }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip {...tt} />
                  <Area
                    type="monotone"
                    dataKey="previous"
                    name="Sebelumnya"
                    stroke="#94a3b8"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    fill="transparent"
                    dot={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="current"
                    name="Sekarang"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#txGrad)"
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-500 rounded-full" /> Sekarang
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-gray-400" /> Sebelumnya
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ServiceTrendCard({ data, loading }: CardProps) {
  const [bucket, setBucket] = useState<TrendBucket>(data.defaultBucket);
  const tt = useTooltipStyle();
  const axisColor = tt.axisColor;

  const series = useMemo(() => {
    const masuk = buildSeries(data.svcInCur, data.range, bucket);
    const selesai = buildSeries(data.svcDoneCur, data.range, bucket);
    const backlog = buildSeries(data.backlogCur, data.range, bucket);
    const len = Math.max(masuk.length, selesai.length, backlog.length);
    return Array.from({ length: len }, (_, i) => ({
      label: masuk[i]?.label ?? "",
      masuk: masuk[i]?.value ?? 0,
      selesai: selesai[i]?.value ?? 0,
      pending: backlog[i]?.value ?? 0,
    }));
  }, [data, bucket]);

  const hasData =
    data.svcInCur.length > 0 || data.svcDoneCur.length > 0 || data.backlogCur.length > 0;

  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 flex flex-col min-w-0">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Wrench className="w-4 h-4 text-violet-500 flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Tren Service</h3>
            <p className="text-[11px] text-gray-400">Masuk · selesai · masih terbuka</p>
          </div>
        </div>
        <BucketToggle value={bucket} onChange={setBucket} />
      </div>
      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="h-56 animate-pulse bg-gray-100 dark:bg-white/5 rounded-xl" />
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="svMasuk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="svDone" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={tt.gridColor} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={{ stroke: tt.gridColor }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: axisColor }}
                    tickLine={false}
                    axisLine={false}
                    width={32}
                    allowDecimals={false}
                  />
                  <Tooltip {...tt} />
                  <Area
                    type="monotone"
                    dataKey="masuk"
                    name="Masuk"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    fill="url(#svMasuk)"
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="selesai"
                    name="Selesai"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#svDone)"
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    name="Masih Terbuka"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="5 4"
                    fill="transparent"
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-violet-500 rounded-full" /> Masuk
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-500 rounded-full" /> Selesai
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 border-t border-dashed border-amber-500" /> Masih terbuka
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
