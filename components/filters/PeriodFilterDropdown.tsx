"use client"

import { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"
import { Calendar, CalendarDays, CalendarRange, Filter, RotateCcw } from "lucide-react"
import { YearSelector } from "./YearSelector"
import { MonthSelector } from "./MonthSelector"
import { type PeriodValue, DEFAULT_PERIOD } from "./types"

interface PeriodFilterDropdownProps {
  isOpen: boolean
  onClose: () => void
  value: PeriodValue
  onChange: (value: PeriodValue) => void
  onReset: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

export function PeriodFilterDropdown({
  isOpen,
  onClose,
  value,
  onChange,
  onReset,
  anchorRef,
}: PeriodFilterDropdownProps) {
  const [activeTab, setActiveTab] = useState<PeriodValue["type"]>(value.type)
  const [selectedYear, setSelectedYear] = useState(() => {
    if (value.type === "bulan" && value.month) {
      return Number(value.month.split("-")[0])
    }
    return new Date().getFullYear()
  })
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, onClose, anchorRef])

  // Update active tab when value changes
  useEffect(() => {
    setActiveTab(value.type)
  }, [value.type])

  const tabs = [
    { id: "hari" as const, label: "Harian", icon: Calendar },
    { id: "bulan" as const, label: "Bulanan", icon: CalendarDays },
    { id: "tahun" as const, label: "Tahunan", icon: CalendarRange },
  ]

  const handleTabChange = (tab: PeriodValue["type"]) => {
    setActiveTab(tab)

    // Auto-apply default for tab
    if (tab === "hari") {
      onChange({
        type: "hari",
        date: new Date().toISOString().split("T")[0],
      })
    } else if (tab === "bulan") {
      const currentMonth = new Date().toISOString().slice(0, 7)
      onChange({
        type: "bulan",
        month: currentMonth,
      })
    } else if (tab === "tahun") {
      onChange({
        type: "tahun",
        year: String(new Date().getFullYear()),
      })
    }
  }

  const handleDateChange = (date: string) => {
    onChange({ type: "hari", date })
  }

  const handleMonthChange = (month: string) => {
    onChange({ type: "bulan", month })
  }

  const handleYearChange = (year: number) => {
    setSelectedYear(year)
    if (activeTab === "tahun") {
      onChange({ type: "tahun", year: String(year) })
    }
  }

  if (!isOpen) return null

  return (
    <motion.div
      ref={dropdownRef}
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="fixed sm:absolute inset-x-4 sm:inset-x-auto top-20 sm:top-full sm:right-0 sm:mt-2 bg-white rounded-xl border border-slate-200 shadow-2xl sm:shadow-xl z-[100] sm:z-50 w-auto sm:w-[320px] overflow-hidden max-h-[80vh] sm:max-h-none overflow-y-auto"
    >
      {/* Tabs */}
      <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`
                flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-3 py-3 sm:py-2.5 text-xs font-medium transition-all
                ${isActive ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-600"}
              `}
            >
              <Icon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-3">
        {activeTab === "hari" && (
          <div className="space-y-4 sm:space-y-3">
            <label className="block text-sm sm:text-xs font-medium text-slate-500">
              Pilih Tanggal
            </label>
            <input
              type="date"
              value={value.date || new Date().toISOString().split("T")[0]}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-4 py-3 sm:px-3 sm:py-2 border border-slate-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 min-h-[44px]"
            />
            <div className="flex gap-3 sm:gap-2">
              <button
                onClick={() => handleDateChange(new Date().toISOString().split("T")[0])}
                className="flex-1 px-4 py-3 sm:px-2 sm:py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-sm sm:text-xs text-slate-600 transition-all min-h-[44px] sm:min-h-0"
              >
                Hari Ini
              </button>
              <button
                onClick={() => {
                  const yesterday = new Date()
                  yesterday.setDate(yesterday.getDate() - 1)
                  handleDateChange(yesterday.toISOString().split("T")[0])
                }}
                className="flex-1 px-4 py-3 sm:px-2 sm:py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md text-sm sm:text-xs text-slate-600 transition-all min-h-[44px] sm:min-h-0"
              >
                Kemarin
              </button>
            </div>
          </div>
        )}

        {activeTab === "bulan" && (
          <div className="space-y-3 sm:space-y-2">
            <YearSelector
              year={selectedYear}
              onChange={handleYearChange}
            />
            <MonthSelector
              selectedMonth={value.month || new Date().toISOString().slice(0, 7)}
              onChange={handleMonthChange}
              year={selectedYear}
            />
          </div>
        )}

        {activeTab === "tahun" && (
          <div className="space-y-4 sm:space-y-3">
            <YearSelector
              year={selectedYear}
              onChange={handleYearChange}
            />
            <div className="grid grid-cols-3 gap-3 sm:gap-2 p-2">
              {Array.from({ length: 10 }, (_, i) => {
                const year = selectedYear - 5 + i
                const yearStr = String(year)
                const isSelected = value.year === yearStr
                const isCurrentYear = year === new Date().getFullYear()

                return (
                  <button
                    key={year}
                    onClick={() => onChange({ type: "tahun", year: yearStr })}
                    className={`
                      px-3 py-3 sm:px-2 sm:py-2 rounded-lg text-sm sm:text-xs font-medium transition-all
                      ${
                        isSelected
                          ? "bg-slate-900 text-white"
                          : isCurrentYear
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "hover:bg-slate-50 text-slate-700"
                      }
                    `}
                  >
                    {year}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === "custom" && (
          <div className="p-2 text-center">
            <p className="text-xs text-slate-500 mb-3">
              Gunakan tombol "Range Tanggal" untuk memilih periode custom
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-all"
            >
              Buka Range Filter
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 p-3 sm:p-2">
        <button
          onClick={() => {
            onReset()
            onClose()
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 sm:px-3 sm:py-2 text-sm sm:text-xs font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-all min-h-[44px] sm:min-h-0"
        >
          <RotateCcw className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          Reset ke Hari Ini
        </button>
      </div>
    </motion.div>
  )
}
