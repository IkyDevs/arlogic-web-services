'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Star, Search, TrendingUp, MessageSquare, User, Calendar, Filter, X, AlertCircle, Watch, Clock, CheckCircle, Wrench, Package } from 'lucide-react'
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
  const [showServiceDetail, setShowServiceDetail] = useState(false)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [serviceLoading, setServiceLoading] = useState(false)
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

  const openServiceDetail = async (fb: Feedback) => {
    setShowServiceDetail(true);
    setServiceLoading(true);
    try {
      const { data } = await supabase
        .from("service_orders")
        .select("*, items:service_items(*), feedbacks!inner(*)")
        .eq("id", fb.service_order_id)
        .single();
      setSelectedService(data);
    } catch (e) {
      console.error("Failed to fetch service detail:", e);
      setSelectedService(null);
    } finally {
      setServiceLoading(false);
    }
  };

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
          className={star <= rating ? 'text-[#F59E0B] fill-[#F59E0B]' : 'text-slate-200'}
        />
      ))}
    </div>
  )

  const ratingColor = (r: number) => {
    if (r >= 4) return 'bg-[#2ECC71]/10 text-[#2ECC71] border-[#2ECC71]/30'
    if (r === 3) return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
    return 'bg-blue-600/10 text-blue-600 border-blue-600/30'
  }

  const ratingLabel = (r: number) => {
    if (r >= 4) return 'Excellent'
    if (r === 3) return 'Good'
    return 'Needs Improvement'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="inline-block w-8 h-8 border border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-slate-400 font-medium">Loading feedback...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-blue-600" />
        <p className="text-slate-600 font-medium">Unable to load feedback</p>
        <p className="text-sm text-slate-400 mt-1">{error}</p>
        <button
          onClick={fetchFeedbacks}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
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
          <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
            <Star className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Customer Feedback</h2>
            <p className="text-xs text-slate-400">{stats.total} total reviews</p>
          </div>
        </div>
        {stats.total > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <TrendingUp className="w-4 h-4 text-[#2ECC71]" />
            <span>Average: {stats.avg}/5</span>
          </div>
        )}
      </div>

      {/* ==================== STATS OVERVIEW ==================== */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Average Rating */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-end gap-4 mb-2">
              <span className="text-4xl sm:text-5xl font-bold text-slate-900">{stats.avg}</span>
              <div>
                <StarDisplay rating={Math.round(stats.avg)} size={20} />
                <p className="text-sm text-slate-500 mt-1">{stats.total} reviews</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 uppercase tracking-wider">Average Rating</p>
          </div>

          {/* Rating Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Rating Distribution</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map(star => {
                const count = stats.distribution[star - 1]
                const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                return (
                  <div key={star} className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5 w-10">
                      <Star size={10} className="text-[#F59E0B] fill-[#F59E0B]" />
                      <span className="text-xs font-medium text-slate-500">{star}</span>
                    </div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-400 w-6 text-right">{count}</span>
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer or comment..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
          />
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium text-slate-900"
        >
          <Filter className="w-4 h-4" />
          Filters
          {filterRating && <span className="w-2 h-2 bg-blue-600 rounded-full" />}
        </button>

        {filterRating && (
          <button
            onClick={() => setFilterRating(null)}
            className="flex items-center gap-1 px-3 py-2.5 bg-blue-600/10 text-blue-600 rounded-lg hover:bg-blue-600/20 transition-all text-sm font-medium"
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
          className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm"
        >
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Filter by Rating</p>
          <div className="flex gap-2 flex-wrap">
            {[5, 4, 3, 2, 1].map(r => (
              <button
                key={r}
                onClick={() => setFilterRating(filterRating === r ? null : r)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filterRating === r
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
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
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-sm">
          <MessageSquare className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-slate-400 font-medium">No feedback yet</p>
          <p className="text-sm text-slate-400 mt-1">Customer ratings will appear here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((fb, i) => (
            <motion.div
              key={fb.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer"
              onClick={() => openServiceDetail(fb)}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900 text-sm">{fb.customer_name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${ratingColor(fb.rating)}`}>
                      {fb.rating}.0 ★ {ratingLabel(fb.rating)}
                    </span>
                  </div>

                  {/* Stars */}
                  <StarDisplay rating={fb.rating} size={14} />

                  {/* Comment */}
                  {fb.comment && (
                    <p className="text-sm text-slate-600 mt-2 italic">"{fb.comment}"</p>
                  )}

                  {/* Meta info */}
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {(fb as any).service_orders?.invoice_number && (
                      <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {(fb as any).service_orders.invoice_number}
                      </span>
                    )}
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Calendar size={12} />
                      {format(new Date(fb.created_at), 'dd MMM yyyy', { locale: id })}
                    </span>
                  </div>
                </div>

                {/* Rating badge for mobile */}
                <div className="sm:hidden flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">{fb.rating}</span>
                  <Star size={14} className="text-[#F59E0B] fill-[#F59E0B]" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ==================== FOOTER ==================== */}
      {filtered.length > 0 && (
        <div className="text-center text-xs text-slate-400 pt-2">
          Showing {filtered.length} of {feedbacks.length} reviews
        </div>
      )}

      {/* Service Detail Modal */}
      {showServiceDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowServiceDetail(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-200"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-900 rounded-xl flex items-center justify-center">
                  <Watch className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Detail Service</h2>
                  <p className="text-xs text-gray-500">{selectedService?.invoice_number || "Loading..."}</p>
                </div>
              </div>
              <button onClick={() => setShowServiceDetail(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {serviceLoading ? (
                <div className="text-center py-8 text-slate-400">Memuat...</div>
              ) : selectedService ? (
                <>
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Customer</p>
                      <p className="font-semibold text-gray-900">{selectedService.customer_name}</p>
                      <p className="text-sm text-gray-600">{selectedService.customer_phone}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Brand</p>
                      <p className="font-semibold text-gray-900 text-sm">{selectedService.watch_brand || "-"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Model</p>
                      <p className="font-semibold text-gray-900 text-sm">{selectedService.watch_model || "-"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Estimasi</p>
                      <p className="font-semibold text-gray-900 text-sm">{selectedService.estimated_cost ? `Rp ${Number(selectedService.estimated_cost).toLocaleString()}` : "-"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-emerald-100">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Down Payment</p>
                      <p className="font-semibold text-emerald-600 text-sm">{selectedService.down_payment ? `Rp ${Number(selectedService.down_payment).toLocaleString()}` : "-"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Status</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {selectedService.status}
                      </span>
                    </div>
                  </div>

                  {selectedService.items?.length > 0 && (
                    <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Items Service</p>
                      <div className="space-y-1.5">
                        {selectedService.items.map((item: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-1"><Package className="w-3 h-3 text-gray-400" />{item.name} x{item.quantity}</span>
                            <span className="font-semibold">Rp {Number(item.price).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Feedback</p>
                    <p className="text-sm text-gray-700">{selectedService.feedbacks?.[0]?.comment || "Tidak ada komentar"}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star key={s} size={14}
                          className={s <= (selectedService.feedbacks?.[0]?.rating || 0) ? "text-[#F59E0B] fill-[#F59E0B]" : "text-gray-300"} />
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Waktu</p>
                    <p className="text-sm text-gray-700">{new Date(selectedService.created_at).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-400">Gagal memuat detail service</div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
