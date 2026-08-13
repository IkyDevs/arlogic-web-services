"use client"

import { useState, useRef, useCallback } from "react"
import { AnimatePresence } from "framer-motion"
import { Calendar, ChevronDown, RotateCcw, Filter } from "lucide-react"
import { PeriodFilterDropdown } from "./PeriodFilterDropdown"
import { RangeFilterModal } from "./RangeFilterModal"
import {
  type PeriodValue,
  type PeriodFilterProps,
  DEFAULT_PERIOD,
  getPeriodDisplayLabel,
  getPeriodShortLabel,
} from "./types"

export { type PeriodValue, type PeriodFilterProps, DEFAULT_PERIOD }

export function PeriodFilter({
  value,
  onChange,
  className = "",
  showReset = true,
  disabled = false,
}: PeriodFilterProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isRangeModalOpen, setIsRangeModalOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const displayLabel = getPeriodDisplayLabel(value)
  const shortLabel = getPeriodShortLabel(value)

  const handleChange = useCallback(
    (newValue: PeriodValue) => {
      onChange(newValue)
      // Close dropdown for non-custom types
      if (newValue.type !== "custom") {
        setIsDropdownOpen(false)
      } else {
        // Open range modal for custom
        setIsDropdownOpen(false)
        setIsRangeModalOpen(true)
      }
    },
    [onChange]
  )

  const handleReset = useCallback(() => {
    onChange(DEFAULT_PERIOD)
  }, [onChange])

  const handleRangeApply = useCallback(
    (rangeValue: PeriodValue) => {
      onChange(rangeValue)
      setIsRangeModalOpen(false)
    },
    [onChange]
  )

  const handleRangeClose = useCallback(() => {
    setIsRangeModalOpen(false)
  }, [])

  const handleDropdownClose = useCallback(() => {
    setIsDropdownOpen(false)
  }, [])

  return (
    <div className={`relative inline-flex items-center gap-1 ${className}`}>
      {/* Main Dropdown Button */}
      <button
        ref={buttonRef}
        onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg 
          text-xs font-medium transition-all shadow-sm
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 hover:border-slate-300 cursor-pointer"}
          ${isDropdownOpen ? "ring-2 ring-slate-900/10 border-slate-300" : ""}
        `}
      >
        <Calendar className="w-3.5 h-3.5 text-slate-500" />
        <span className="hidden sm:inline max-w-[150px] truncate">
          {displayLabel}
        </span>
        <span className="sm:hidden max-w-[100px] truncate">
          {shortLabel}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isDropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Range Filter Button (separate) */}
      <button
        onClick={() => !disabled && setIsRangeModalOpen(true)}
        disabled={disabled}
        className={`
          flex items-center gap-1.5 px-2.5 py-2 bg-white border border-slate-200 rounded-lg 
          text-xs font-medium transition-all shadow-sm
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 hover:border-slate-300 cursor-pointer"}
          ${value.type === "custom" ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800" : "text-slate-600"}
        `}
        title="Range Tanggal"
      >
        <Filter className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Range</span>
      </button>

      {/* Reset Button */}
      {showReset && (
        <button
          onClick={handleReset}
          disabled={disabled}
          className={`
            p-2 bg-white border border-slate-200 rounded-lg text-slate-400
            transition-all shadow-sm
            ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-slate-50 hover:text-slate-600 cursor-pointer"}
          `}
          title="Reset ke Hari Ini"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Dropdown */}
      <AnimatePresence>
        {isDropdownOpen && (
          <PeriodFilterDropdown
            isOpen={isDropdownOpen}
            onClose={handleDropdownClose}
            value={value}
            onChange={handleChange}
            onReset={handleReset}
            anchorRef={buttonRef}
          />
        )}
      </AnimatePresence>

      {/* Range Modal */}
      <RangeFilterModal
        isOpen={isRangeModalOpen}
        onClose={handleRangeClose}
        onApply={handleRangeApply}
        initialRange={value.type === "custom" ? value.range : undefined}
      />
    </div>
  )
}

export default PeriodFilter
