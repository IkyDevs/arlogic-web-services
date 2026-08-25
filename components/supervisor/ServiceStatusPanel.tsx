"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { useTheme } from "next-themes";

export interface StatusSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface ServiceStatusPanelProps {
  slices: StatusSlice[];
  total: number;
  loading: boolean;
}

const legendDot = (color: string) => (
  <span
    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
    style={{ backgroundColor: color }}
  />
);

export default function ServiceStatusPanel({
  slices,
  total,
  loading,
}: ServiceStatusPanelProps) {
  const { resolvedTheme: theme } = useTheme();
  const tooltipBg = theme === "dark" ? "#1c1c1c" : "#ffffff";
  const gridColor = theme === "dark" ? "rgba(255,255,255,0.06)" : "#e2e8f0";

  const majority = total > 0
    ? slices.reduce((best, s) => (s.value > best.value ? s : best), slices[0])
    : null;

  return (
    <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200/70 dark:border-white/10 flex flex-col">
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200/70 dark:border-white/10 flex items-center gap-2">
        <PieIcon className="w-4 h-4 text-blue-500" />
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
            Status Service
          </h3>
          <p className="text-[11px] text-gray-400">Distribusi service dalam periode</p>
        </div>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="h-52 animate-pulse bg-gray-100 dark:bg-white/5 rounded-xl" />
        ) : total === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Belum ada data service
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Belum ada aktivitas service pada periode yang dipilih
            </p>
          </div>
        ) : (
          <>
            <div className="relative h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices.filter((s) => s.value > 0)}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {slices
                      .filter((s) => s.value > 0)
                      .map((s) => (
                        <Cell key={s.key} fill={s.color} />
                      ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} service`, name]}
                    contentStyle={{
                      backgroundColor: tooltipBg,
                      border: `1px solid ${gridColor}`,
                      borderRadius: 12,
                      fontSize: 12,
                      color: theme === "dark" ? "#e2e8f0" : "#0f172a",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {total}
                </p>
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                  Total
                </p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {slices.map((s) => (
                <div key={s.key} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 min-w-0">
                    {legendDot(s.color)}
                    <span className="truncate">{s.label}</span>
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>

            {majority && (
              <p className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 text-xs text-gray-500 dark:text-gray-400">
                Mayoritas service{" "}
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {majority.label.toLowerCase()}
                </span>{" "}
                ({majority.value} dari {total} service).
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}