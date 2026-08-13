"use client"

import { useState, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Calendar, Filter } from "lucide-react"
import toast from "react-hot-toast"
import { RANGE_PRESETS, type PeriodValue } from "./types"

interface RangeFilterModalProps {
  isOpen: boolean
  onClose: () => void
  onApply: (value: PeriodValue) => void
  initialRange?: { start: string; end: string }
}

export function RangeFilterModal({ isOpen, onClose, onApply, initialRange }: RangeFilterModalProps) {
  const [range, setRange] = useState<{ start: string; end: string }>(
    initialRange || { start: "", end: "" }
  )
  const isAnimating = useRef(false)

  const handleApplyPreset = useCallback((days: number) => {
    if (isAnimating.current) return
    
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    
    const newRange = {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    }
    
    setRange(newRange)
    
    // Delay apply untuk menghindari kedip
    setTimeout(() => {
      onApply({
        type: "custom",
        range: newRange,
      })
    }, 150)
  }, [onApply])

  const handleManualChange = useCallback((field: "start" | "end", value: string) => {
    setRange((prev) => {
      const newRange = { ...prev, [field]: value }
      
      if (field === "end" && prev.start && value && value < prev.start) {
        toast.error("Tanggal akhir tidak boleh lebih awal dari tanggal mulai")
        return prev
      }
      
      return newRange
    })
  }, [])

  const handleApply = useCallback(() => {
    if (!range.start || !range.end) {
      toast.error("Pilih tanggal mulai dan akhir")
      return
    }
    
    onApply({
      type: "custom",
      range,
    })
  }, [range, onApply])

  const getRangeDays = useCallback(() => {
    if (!range.start || !range.end) return 0
    const start = new Date(range.start)
    const end = new Date(range.end)
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }, [range])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isAnimating.current) {
              onClose()
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onAnimationStart={() => { isAnimating.current = true }}
            onAnimationComplete={() => { isAnimating.current = false }}
            className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
                  <Filter className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Range Tanggal</h2>
                  <p className="text-xs text-slate-500">Pilih periode custom</p>
                </div>
              </div>
              <button
                onClick={() => !isAnimating.current && onClose()}
                className="p-2 sm:p-1.5 hover:bg-slate-100 rounded-lg transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4 text-slate-400" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {/* Quick Presets */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Preset Cepat
                </p>
                <div className="grid grid-cols-3 gap-3 sm:gap-2">
                  {RANGE_PRESETS.map((preset) => (
                    <button
                      key={preset.days}
                      onClick={() => handleApplyPreset(preset.days)}
                      className="px-4 py-3 sm:px-3 sm:py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-sm sm:text-xs font-medium text-slate-700 transition-all active:scale-95 min-h-[44px] sm:min-h-0"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Inputs */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Atau Pilih Manual
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-3">
                  <div>
                    <label className="block text-sm sm:text-xs font-medium text-slate-500 mb-1.5 sm:mb-1">
                      Dari Tanggal
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 sm:left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-400" />
                      <input
                        type="date"
                        value={range.start}
                        onChange={(e) => handleManualChange("start", e.target.value)}
                        className="w-full pl-10 sm:pl-8 pr-4 sm:pr-3 py-3 sm:py-2 border border-slate-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 min-h-[44px]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm sm:text-xs font-medium text-slate-500 mb-1.5 sm:mb-1">
                      Sampai Tanggal
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 sm:left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-3.5 sm:h-3.5 text-slate-400" />
                      <input
                        type="date"
                        value={range.end}
                        min={range.start}
                        onChange={(e) => handleManualChange("end", e.target.value)}
                        className="w-full pl-10 sm:pl-8 pr-4 sm:pr-3 py-3 sm:py-2 border border-slate-200 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Range Display */}
              {range.start && range.end && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="p-3 bg-blue-50 border border-blue-200 rounded-xl"
                >
                  <p className="text-xs text-blue-600 font-medium">
                    {new Date(range.start).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}{" "}
                    -{" "}
                    {new Date(range.end).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    {getRangeDays()} hari
                  </p>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 sticky bottom-0">
              <button
                onClick={handleApply}
                disabled={!range.start || !range.end}
                className="w-full py-3 sm:py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-700 transition-all text-base sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                Terapkan Filter
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
