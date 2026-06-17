'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Star, Search, TrendingUp, MessageSquare, User, Calendar, Filter, X, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

interface Feedback {
  id: string
  service_order_id: string
  customer_name: string
  rating: number
  comment: string | null
  created_at: string
  service_orders?: {
    invoice_number: string
    watch_brand: string
  }
  profiles?: {
    full_name: string
  }
}

export default function FeedbackList() {
  const supabase = createClient()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterRating, setFilterRating] = useState<number | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [stats, setStats] = useState({ avg: 0, total: 0, distribution: [0, 0, 0, 0, 0] })

  useEffect(() => {
    fetchFeedbacks()
  }, [])

  const fetchFeedbacks = async () => {
    setLoading(true)
    setError(null)

    try {
      // Check if table exists first
      const { error: tableCheckError } = await supabase
        .from('feedbacks')
        .select('id')
        .limit(1)

      // If table doesn't exist, show appropriate message
      if (tableCheckError && tableCheckError.code === '42P01') {
        setError('Feedback table not found. Please contact administrator.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('feedbacks')
        .select(`
          *,
          service_orders(invoice_number, watch_brand)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching feedbacks:', error)
        setError(error.message)
        setLoading(false)
        return
      }

      const fb = data || []
      setFeedbacks(fb as any)

      // Calculate stats
      if (fb.length > 0) {
        const avg = fb.reduce((sum, f) => sum + f.rating, 0) / fb.length
        const dist = [0, 0, 0, 0, 0]
        fb.forEach(f => {
          if (f.rating >= 1 && f.rating <= 5) {
            dist[f.rating - 1]++
          }
        })
        setStats({
          avg: Math.round(avg * 10) / 10,
          total: fb.length,
          distribution: dist
        })
      }
    } catch (err: any) {
      console.error('Unexpected error:', err)
      setError(err.message || 'Failed to load feedback')
    } finally {
      setLoading(false)
    }
  }

  const filtered = feedbacks.filter(f => {
    const matchSearch = !search ||
      f.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
      (f.comment || '').toLowerCase().includes(search.toLowerCase())
    const matchRating = filterRating === null || f.rating === filterRating
    return matchSearch && matchRating
  })

  const StarDisplay = ({ rating, size = 16 }: { rating: number; size?: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <Star
          key={star}
          size={size}
          className={star <= rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-gray-200'}
        />
      ))}
    </div>
  )

  const ratingColor = (r: number) => {
    if (r >= 4) return 'bg-[#2ECC71]/10 text-[#2ECC71] border-[#2ECC71]/30'
    if (r === 3) return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
    return 'bg-[#E94560]/10 text-[#E94560] border-[#E94560]/30'
  }

  const ratingLabel = (r: number) => {
    if (r >= 4) return 'Excellent'
    if (r === 3) return 'Good'
    return 'Needs Improvement'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E9ECEF] p-8 text-center shadow-sm">
        <div className="inline-block w-8 h-8 border-3 border-[#E94560] border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-gray-400 font-medium">Loading feedback...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-[#E9ECEF] p-8 text-center shadow-sm">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-[#E94560]" />
        <p className="text-gray-600 font-medium">Unable to load feedback</p>
        <p className="text-sm text-gray-400 mt-1">{error}</p>
        <button
          onClick={fetchFeedbacks}
          className="mt-4 px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2D2D44] transition-all text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ==================== HEADER ==================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1A1A2E] rounded-lg flex items-center justify-center">
            <Star className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1A1A2E]">Customer Feedback</h2>
            <p className="text-xs text-gray-400">{stats.total} total reviews</p>
          </div>
        </div>
        {stats.total > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <TrendingUp className="w-4 h-4 text-[#2ECC71]" />
            <span>Average: {stats.avg}/5</span>
          </div>
        )}
      </div>

      {/* ==================== STATS OVERVIEW ==================== */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Average Rating */}
          <div className="bg-white rounded-xl border border-[#E9ECEF] p-5 shadow-sm">
            <div className="flex items-end gap-4 mb-2">
              <span className="text-4xl sm:text-5xl font-bold text-[#1A1A2E]">{stats.avg}</span>
              <div>
                <StarDisplay rating={Math.round(stats.avg)} size={20} />
                <p className="text-sm text-gray-500 mt-1">{stats.total} reviews</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Average Rating</p>
          </div>

          {/* Rating Distribution */}
          <div className="bg-white rounded-xl border border-[#E9ECEF] p-5 shadow-sm">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Rating Distribution</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map(star => {
                const count = stats.distribution[star - 1]
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={star} className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 w-10">
                      <Star size={10} className="text-[#F59E0B] fill-[#F59E0B]" />
                      <span className="text-xs font-medium text-gray-500">{star}</span>
                    </div>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#E94560] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-400 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SEARCH & FILTER ==================== */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customer or comment..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-sm font-medium text-[#1A1A2E]"
        >
          <Filter className="w-4 h-4" />
          Filters
          {filterRating && <span className="w-2 h-2 bg-[#E94560] rounded-full" />}
        </button>

        {filterRating && (
          <button
            onClick={() => setFilterRating(null)}
            className="flex items-center gap-1 px-3 py-2.5 bg-[#E94560]/10 text-[#E94560] rounded-lg hover:bg-[#E94560]/20 transition-all text-sm font-medium"
          >
            <X className="w-3 h-3" />
            Clear filter
          </button>
        )}
      </div>

      {/* Filter Chips */}
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-xl border border-[#E9ECEF] p-4 shadow-sm"
        >
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Filter by Rating</p>
          <div className="flex gap-2 flex-wrap">
            {[5, 4, 3, 2, 1].map(r => (
              <button
                key={r}
                onClick={() => setFilterRating(filterRating === r ? null : r)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filterRating === r
                    ? 'bg-[#1A1A2E] text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Star size={12} className={filterRating === r ? 'text-white' : 'text-[#F59E0B] fill-[#F59E0B]'} />
                {r}
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* ==================== FEEDBACK LIST ==================== */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E9ECEF] p-12 text-center shadow-sm">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400 font-medium">No feedback yet</p>
          <p className="text-sm text-gray-400 mt-1">Customer ratings will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((fb, i) => (
            <motion.div
              key={fb.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-white rounded-xl border border-[#E9ECEF] p-4 sm:p-5 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 bg-[#1A1A2E] rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-[#1A1A2E] text-sm">{fb.customer_name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ratingColor(fb.rating)}`}>
                      {fb.rating}.0 ★ {ratingLabel(fb.rating)}
                    </span>
                  </div>

                  {/* Stars */}
                  <StarDisplay rating={fb.rating} size={14} />

                  {/* Comment */}
                  {fb.comment && (
                    <p className="text-sm text-gray-600 mt-2 italic">"{fb.comment}"</p>
                  )}

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {(fb as any).service_orders?.invoice_number && (
                      <span className="text-xs font-mono text-gray-400 bg-[#FAFAFA] px-2 py-0.5 rounded border border-[#E9ECEF]">
                        {(fb as any).service_orders.invoice_number}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Calendar size={12} />
                      {format(new Date(fb.created_at), 'dd MMM yyyy', { locale: id })}
                    </span>
                  </div>
                </div>

                {/* Rating badge for mobile */}
                <div className="sm:hidden flex items-center gap-2">
                  <span className="text-sm font-bold text-[#1A1A2E]">{fb.rating}</span>
                  <Star size={14} className="text-[#F59E0B] fill-[#F59E0B]" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ==================== FOOTER ==================== */}
      {filtered.length > 0 && (
        <div className="text-center text-xs text-gray-400 pt-2">
          Showing {filtered.length} of {feedbacks.length} reviews
        </div>
      )}
    </div>
  )
}
