"use client";

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  LineChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Brush,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import {
  computeBranchSeries,
  UNASSIGNED_BRANCH,
  type Granularity,
  type BranchBucket,
} from "@/lib/owner/stats";
import { LINE_COLORS } from "@/constants/owner";

interface RevenueChartProps {
  dateRange: { start: Date; end: Date };
}

interface ChartRow {
  label: string;
  fullLabel: string;
  revenue: number;
  expenses: number;
  [branchName: string]: string | number;
}

const META_KEYS = ["label", "fullLabel", "revenue", "expenses"];

function useVisibility<T extends HTMLElement>(ref: React.RefObject<T | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
}

function RevenueChart({ dateRange }: RevenueChartProps) {
  const supabase = createClient();
  const { activeBranchId, branches } = useBranch();
  const gradId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const visible = useVisibility(containerRef);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [override, setOverride] = useState<Granularity | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const rangeDays =
    (dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000);

  const granularity: Granularity =
    override ?? (rangeDays <= 8 ? "day" : rangeDays <= 45 ? "week" : rangeDays <= 200 ? "month" : "year");

  const selectGranularity = (g: Granularity) => {
    setOverride(g === granularity ? null : g);
  };

  const branchMatch = useMemo(
    () => (activeBranchId ? { branch_id: activeBranchId } : {}),
    [activeBranchId],
  );
  const branchNameOf = useCallback(
    (id: string) => branches.find((b) => b.id === id)?.name || "Cabang lain",
    [branches],
  );

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    const start = dateRange.start;
    const end = dateRange.end;
    Promise.all([
      supabase.from("service_orders").select("id, branch_id, created_at, status, service_items(price, quantity)")
        .match(branchMatch).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
      supabase.from("layanan").select("id, branch_id, nominal, jenis_layanan, status, created_at")
        .match(branchMatch).gte("created_at", start.toISOString()).lte("created_at", end.toISOString())
        .neq("jenis_layanan", "pengeluaran"),
      supabase.from("layanan").select("id, branch_id, nominal, jenis_layanan, status, created_at")
        .match(branchMatch).gte("created_at", start.toISOString()).lte("created_at", end.toISOString())
        .eq("jenis_layanan", "pengeluaran"),
    ])
      .then(([servicesRes, layananRes, expenseRes]) => {
        if (cancelled) return;
        const series: BranchBucket[] = computeBranchSeries(
          servicesRes.data || [],
          [...(layananRes.data || []), ...(expenseRes.data || [])],
          { start, end, granularity },
        );

        const branchesWithData = new Set<string>();
        series.forEach((b) => Object.keys(b.byBranch).forEach((k) => branchesWithData.add(k)));
        branchesWithData.delete(UNASSIGNED_BRANCH);
        const visibleBranches = activeBranchId
          ? [activeBranchId]
          : [...branchesWithData];

        setChartData(
          series.map((bucket) => {
            const row: ChartRow = {
              label: bucket.label,
              fullLabel: bucket.fullLabel,
              revenue: bucket.revenue,
              expenses: bucket.expenses,
            };
            visibleBranches.forEach((bid) => {
              row[branchNameOf(bid)] = bucket.byBranch[bid]?.revenue ?? 0;
            });
            return row;
          }),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) console.error("Gagal memuat seri revenue:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, dateRange, activeBranchId, granularity, supabase, branchMatch, branchNameOf]);

  const branchKeys = chartData.length > 0
    ? Object.keys(chartData[0]).filter((k) => !META_KEYS.includes(k))
    : [];

  const granularityLabel =
    granularity === "day" ? "Harian" : granularity === "week" ? "Mingguan" : granularity === "month" ? "Bulanan" : "Tahunan";

  return (
    <div className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/70 dark:border-white/5 shadow-sm p-4 sm:p-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-gray-100 text-sm sm:text-base">
              Revenue Overview
            </h3>
            <p className="text-xs text-slate-400">Pendapatan per cabang · {granularityLabel}</p>
          </div>
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Granularity grafik">
          {(["day", "week", "month", "year"] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => selectGranularity(g)}
              aria-pressed={granularity === g}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                granularity === g
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {g === "day" ? "Day" : g === "week" ? "Week" : g === "month" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-[300px] sm:h-[400px] rounded-lg"
        style={{ background: "linear-gradient(to bottom, #f8fafc, #ffffff)" }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Memuat data grafik...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            Tidak ada data pada periode ini
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#6C757D" fontSize={isMobile ? 9 : 11}
                tick={{ fill: "#6C757D" }} axisLine={{ stroke: "#e2e8f0" }}
                interval={Math.max(Math.floor(chartData.length / 15), 1)} />
              <YAxis stroke="#6C757D" fontSize={isMobile ? 9 : 11}
                tick={{ fill: "#6C757D" }} axisLine={{ stroke: "#e2e8f0" }}
                tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`}
                domain={["auto", "auto"]} />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                {branchKeys.map((branchName, i) => (
                  <linearGradient key={branchName} id={`${gradId}-area-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0.04} />
                  </linearGradient>
                ))}
              </defs>
              {branchKeys.map((branchName, i) => (
                <Area key={`area-${branchName}`} type="monotone" dataKey={branchName}
                  stroke="none" fill={`url(#${gradId}-area-${i})`} animationDuration={600} />
              ))}
              {branchKeys.map((branchName, i) => (
                <Line key={branchName} type="monotone" dataKey={branchName}
                  stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2.5}
                  dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                  animationDuration={600} />
              ))}
              {chartData.length > 1 && (
                <Brush dataKey="label" height={28} travellerWidth={8}
                  stroke="#2563eb" fill="#f8fafc" />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {branchKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-slate-100">
          {branchKeys.map((branchName, i) => (
            <span key={branchName} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ background: LINE_COLORS[i % LINE_COLORS.length] }}
              />
              {branchName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

interface TooltipEntry {
  dataKey: string;
  value: number;
  color: string;
  payload: ChartRow;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const seen = new Set<string>();
  const entries = payload.filter((entry) => {
    if (seen.has(entry.dataKey)) return false;
    seen.add(entry.dataKey);
    return true;
  });
  if (entries.length === 0) return null;
  const fullLabel = payload[0].payload?.fullLabel || label;
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4 min-w-[180px]">
      <p className="font-semibold text-sm text-slate-900 mb-2">{fullLabel}</p>
      {entries.map((entry) => (
        <p key={entry.dataKey} className="text-sm flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full inline-block"
            style={{ background: entry.color }}
          />
          <span className="font-medium">{entry.dataKey}:</span>{" "}
          <span className="font-semibold">Rp {(entry.value || 0).toLocaleString("id-ID")}</span>
        </p>
      ))}
    </div>
  );
}

export default memo(RevenueChart);