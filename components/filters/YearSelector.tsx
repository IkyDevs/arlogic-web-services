"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

interface YearSelectorProps {
  year: number
  onChange: (year: number) => void
  minYear?: number
  maxYear?: number
}

export function YearSelector({
  year,
  onChange,
  minYear = 2000,
  maxYear = new Date().getFullYear() + 1,
}: YearSelectorProps) {
  const canGoBack = year > minYear
  const canGoForward = year < maxYear

  return (
    <div className="flex items-center justify-between px-2 py-2">
      <button
        onClick={() => canGoBack && onChange(year - 1)}
        disabled={!canGoBack}
        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronLeft className="w-4 h-4 text-slate-600" />
      </button>

      <span className="text-sm font-semibold text-slate-900 min-w-[80px] text-center">
        {year}
      </span>

      <button
        onClick={() => canGoForward && onChange(year + 1)}
        disabled={!canGoForward}
        className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
      >
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </button>
    </div>
  )
}
