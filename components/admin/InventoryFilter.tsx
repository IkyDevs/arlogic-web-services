'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, Filter, X } from 'lucide-react'

interface InventoryFilterProps {
  onFilter: (filters: { category: string; search: string }) => void
}

export default function InventoryFilter({ onFilter }: InventoryFilterProps) {
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('name')
      .order('name')
    if (data) {
      setCategories(data.map(c => c.name))
    }
  }

  const applyFilter = () => {
    onFilter({ category: selectedCategory, search: searchQuery })
  }

  const resetFilter = () => {
    setSelectedCategory('')
    setSearchQuery('')
    onFilter({ category: '', search: '' })
  }

  useEffect(() => {
    // Debounce search
    const timer = setTimeout(() => {
      applyFilter()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, selectedCategory])

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
      <div className="relative flex-1 w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari item..."
          className="w-full pl-9 pr-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560] transition-all"
        />
      </div>

      <div className="flex gap-2 w-full sm:w-auto">
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="flex-1 sm:flex-none px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560] bg-white"
        >
          <option value="">Semua Kategori</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {(selectedCategory || searchQuery) && (
          <button
            onClick={resetFilter}
            className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-all flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            <span className="text-sm hidden sm:inline">Reset</span>
          </button>
        )}
      </div>
    </div>
  )
}
