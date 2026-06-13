import { useState, useEffect, useRef, useCallback } from 'react'

interface UseVirtualScrollProps {
  itemHeight: number
  itemsLength: number
  containerHeight: number
  overscan?: number
}

export function useVirtualScroll({
  itemHeight,
  itemsLength,
  containerHeight,
  overscan = 3
}: UseVirtualScrollProps) {
  const [scrollTop, setScrollTop] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const totalHeight = itemsLength * itemHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex = Math.min(
    itemsLength,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )
  const visibleItems = endIndex - startIndex
  const offsetY = startIndex * itemHeight

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  return {
    containerRef,
    handleScroll,
    startIndex,
    endIndex,
    visibleItems,
    offsetY,
    totalHeight
  }
}
