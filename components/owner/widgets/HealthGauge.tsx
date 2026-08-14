"use client";

import { motion } from "framer-motion";
import type { HealthStatus } from "@/types/owner";

const statusMeta: Record<HealthStatus, { label: string; color: string }> = {
  excellent: { label: "Excellent", color: "#10b981" },
  warning: { label: "Warning", color: "#f59e0b" },
  critical: { label: "Critical", color: "#ef4444" },
};

export default function HealthGauge({
  score,
  status,
}: {
  score: number;
  status: HealthStatus;
}) {
  const meta = statusMeta[status];
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div
      className="flex items-center gap-4"
      role="img"
      aria-label={`Business Health Score ${score} dari 100, status ${meta.label}`}
    >
      <div className="relative w-32 h-32 flex-shrink-0">
        <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="10"
          />
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={meta.color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - filled }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-slate-900">{score}</span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">
            Health
          </span>
        </div>
      </div>
      <div>
        <p className="text-[10px] text-slate-400 uppercase tracking-wide">
          Business Health
        </p>
        <p className="text-lg font-bold" style={{ color: meta.color }}>
          {meta.label}
        </p>
        <p className="text-xs text-slate-400 max-w-[140px]">
          Komposit revenue, completion, pending, recall & rating
        </p>
      </div>
    </div>
  );
}