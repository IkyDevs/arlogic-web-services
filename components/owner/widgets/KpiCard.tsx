"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { ANIMATION } from "@/constants/owner";
import type { KpiMetric } from "@/types/owner";
import { useCountUp } from "@/hooks/useCountUp";

const toneColor: Record<string, string> = {
  positive: "text-emerald-600",
  negative: "text-red-500",
  default: "text-slate-900",
};

function Sparkline({ data, tone }: { data: number[]; tone: KpiMetric["tone"] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 22 - ((v - min) / range) * 20;
      return `${x},${y}`;
    })
    .join(" ");
  const stroke = tone === "negative" ? "#ef4444" : "#10b981";
  return (
    <svg viewBox="0 0 100 24" className="w-full h-6" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function KpiCard({ metric }: { metric: KpiMetric }) {
  const animated = useCountUp(metric.value);
  const display =
    metric.displayValue.includes("Rp") || metric.displayValue.includes(".")
      ? metric.displayValue
      : String(Math.round(animated));

  return (
    <motion.div
      whileHover={{ y: -ANIMATION.lift }}
      transition={{ duration: ANIMATION.hover / 1000 }}
      className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/70 dark:border-white/5 shadow-sm p-4 hover:shadow-md hover:border-slate-300/80 transition-shadow"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
          {metric.label}
        </span>
        {metric.changePct !== 0 && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-semibold ${
              metric.changePct > 0 ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {metric.changePct > 0 ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : metric.changePct < 0 ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {metric.changePct > 0 ? "+" : ""}
            {metric.changePct.toFixed(1)}%
          </span>
        )}
      </div>

      <p
        className={`text-xl sm:text-2xl font-bold truncate ${toneColor[metric.tone]} dark:text-gray-100`}
      >
        {display}
      </p>

      {metric.spark && metric.spark.length > 0 && (
        <div className="mt-2">
          <Sparkline data={metric.spark} tone={metric.tone} />
        </div>
      )}

      {metric.progress !== null && (
        <div className="mt-3">
          <div
            className="h-1.5 rounded-full bg-slate-100 overflow-hidden"
            role="progressbar"
            aria-valuenow={metric.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Progress ${metric.label}`}
          >
            <motion.div
              className="h-full rounded-full bg-slate-900"
              initial={{ width: 0 }}
              animate={{ width: `${metric.progress}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <p className="mt-1 text-[10px] text-slate-400">
            {metric.progress}% dari target
          </p>
        </div>
      )}
    </motion.div>
  );
}