'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onSelect?: (item: any) => void
  items?: any[]
  renderItem?: (item: any) => React.ReactNode
  loading?: boolean
  className?: string
}

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Cari...',
  onSelect,
  items = [],
  renderItem,
  loading = false,
  className = ''
}: SearchInputProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (item: any) => {
    if (onSelect) onSelect(item)
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all duration-200"
        />
        {value && (
          <button
            onClick={() => {
              onChange('')
              setIsOpen(false)
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full transition-all"
          >
            <X className="w-3 h-3 text-slate-400" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && value && items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-sm max-h-48 overflow-y-auto"
          >
            {items.map((item, index) => (
              <div
                key={index}
                onClick={() => handleSelect(item)}
                className="cursor-pointer hover:bg-slate-50 transition-all last:border-0"
              >
                {renderItem ? renderItem(item) : (
                  <div className="px-3 py-2 text-sm">{item}</div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
