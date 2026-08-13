"use client"

import { Check } from "lucide-react"
import { MONTH_NAMES } from "./types"

interface MonthSelectorProps {
  selectedMonth: string // YYYY-MM
  onChange: (month: string) => void
  year: number
}

export function MonthSelector({ selectedMonth, onChange, year }: MonthSelectorProps) {
  const currentMonth = new Date().toISOString().slice(0, 7)

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-1.5 p-2">
      {MONTH_NAMES.map((monthName, index) => {
        const monthValue = String(index + 1).padStart(2, "0")
        const fullMonth = `${year}-${monthValue}`
        const isSelected = selectedMonth === fullMonth
        const isCurrentMonth = fullMonth === currentMonth

        return (
          <button
            key={monthValue}
            onClick={() => onChange(fullMonth)}
            className={`
              relative px-3 py-3 sm:px-2 sm:py-2.5 rounded-lg text-sm sm:text-xs font-medium transition-all
              ${
                isSelected
                  ? "bg-slate-900 text-white shadow-sm"
                  : isCurrentMonth
                    ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                    : "hover:bg-slate-50 text-slate-700"
              }
            `}
          >
            <span className="block truncate">{monthName}</span>
            {isSelected && (
              <Check className="w-3 h-3 absolute top-0.5 right-0.5" />
            )}
          </button>
        )
      })}
    </div>
  )
}
