"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import { useTheme } from "@/components/ThemeProvider";

interface RevenueChartProps {
  data: Array<{ name: string; pendapatan: number }>;
  loading: boolean;
}

export default function RevenueChart({ data, loading }: RevenueChartProps) {
  const { theme } = useTheme();
  const axisColor = theme === "dark" ? "#64748b" : "#94a3b8";
  const gridColor = theme === "dark" ? "rgba(255,255,255,0.06)" : "#e2e8f0";
  const tooltipBg = theme === "dark" ? "#1c1c1c" : "#ffffff";

  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 flex flex-col">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-blue-500" />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Pendapatan per Cabang
          </h3>
          <p className="text-[11px] text-gray-400">Periode & filter aktif</p>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="h-56 animate-pulse bg-gray-100 dark:bg-white/5 rounded-xl" />
        ) : data.length === 0 || data.every((d) => d.pendapatan === 0) ? (
          <div className="h-56 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Belum ada data pendapatan
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Belum ada transaksi pada periode yang dipilih
            </p>
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: axisColor }}
                  tickFormatter={(v: string) => (v.length > 10 ? `${v.slice(0, 10)}…` : v)}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: axisColor }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${Math.round(v / 1000)}rb` : `${v}`
                  }
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(value) => [formatRupiah(Number(value)), "Pendapatan"]}
                  contentStyle={{
                    backgroundColor: tooltipBg,
                    border: `1px solid ${gridColor}`,
                    borderRadius: 12,
                    fontSize: 12,
                    color: theme === "dark" ? "#e2e8f0" : "#0f172a",
                  }}
                  cursor={{ fill: theme === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" }}
                />
                <Bar dataKey="pendapatan" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}