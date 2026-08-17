"use client";

import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  caption?: string;
  icon: LucideIcon;
  accent?: boolean;
  valueClassName?: string;
}

export default function KpiCard({
  label,
  value,
  caption,
  icon: Icon,
  accent,
  valueClassName,
}: KpiCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3.5 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          {label}
        </span>
        <span
          className={`flex flex-shrink-0 items-center justify-center rounded-[10px] w-8 h-8 ${
            accent
              ? "bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)]"
              : "bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
          }`}
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
        </span>
      </div>
      <div className="min-w-0">
        <p
          className={`text-[22px] leading-none font-bold tracking-tight sm:text-2xl lg:text-[26px] ${
            accent ? "text-[var(--color-accent-teal)]" : "text-[var(--color-text)]"
          } ${valueClassName || ""}`}
        >
          {value}
        </p>
        {caption && (
          <p className="mt-1.5 truncate text-[11px] text-[var(--color-text-tertiary)]">
            {caption}
          </p>
        )}
      </div>
    </div>
  );
}