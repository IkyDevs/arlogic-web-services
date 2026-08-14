"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { ANIMATION } from "@/constants/owner";
import type { WidgetState } from "@/types/owner";

interface WidgetShellProps {
  title: string;
  subtitle?: string;
  state: WidgetState;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  children?: ReactNode;
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-3.5 w-1/3 rounded-full bg-slate-200 animate-pulse" />
      <div className="h-3 w-1/2 rounded-full bg-slate-100 animate-pulse" />
      <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
    </div>
  );
}

export default function WidgetShell({
  title,
  subtitle,
  state,
  emptyMessage,
  errorMessage,
  onRetry,
  children,
}: WidgetShellProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ANIMATION.fade / 1000 }}
      className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/70 dark:border-white/5 shadow-sm p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100">
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {state === "loading" && <Skeleton />}
      {state === "error" && (
        <div
          role="alert"
          className="text-center py-8 border border-dashed border-red-200 rounded-xl"
        >
          <p className="text-sm text-slate-500">{errorMessage}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-4 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              Coba lagi
            </button>
          )}
        </div>
      )}
      {state === "empty" && (
        <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm text-slate-400">{emptyMessage}</p>
        </div>
      )}
      {state === "success" && children}
    </motion.section>
  );
}