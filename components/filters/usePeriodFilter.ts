"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { type PeriodValue, DEFAULT_PERIOD } from "./types"

interface UsePeriodFilterOptions {
  initialValue?: PeriodValue
  onChange?: (value: PeriodValue) => void
  debounceMs?: number
}

interface UsePeriodFilterReturn {
  value: PeriodValue
  setValue: (value: PeriodValue) => void
  reset: () => void
  isChanging: boolean
}

export function usePeriodFilter({
  initialValue = DEFAULT_PERIOD,
  onChange,
  debounceMs = 300,
}: UsePeriodFilterOptions = {}): UsePeriodFilterReturn {
  const [value, setValueState] = useState<PeriodValue>(initialValue)
  const [isChanging, setIsChanging] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout>()
  const onChangeRef = useRef(onChange)

  // Keep onChange ref up to date
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const setValue = useCallback(
    (newValue: PeriodValue) => {
      setIsChanging(true)
      setValueState(newValue)

      // Debounce the onChange callback
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        onChangeRef.current?.(newValue)
        setIsChanging(false)
      }, debounceMs)
    },
    [debounceMs]
  )

  const reset = useCallback(() => {
    setValue(DEFAULT_PERIOD)
  }, [setValue])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return {
    value,
    setValue,
    reset,
    isChanging,
  }
}

export default usePeriodFilter
