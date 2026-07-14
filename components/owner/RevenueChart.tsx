'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area
} from 'recharts'
import { TrendingUp, Calendar } from 'lucide-react'
import { format, eachDayOfInterval, subDays } from 'date-fns'
import { id } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'

interface RevenueChartProps {
  data: any
  dateRange: { start: Date; end: Date }
  comparePeriod: 'month' | 'year'
}

export default function RevenueChart({ data, dateRange, comparePeriod }: RevenueChartProps) {
  const supabase = createClient()
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'daily' | 'cumulative'>('daily')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetchDailyRevenue()
  }, [dateRange])

  const fetchDailyRevenue = async () => {
    setLoading(true)
    try {
      const start = dateRange.start
      const end = dateRange.end
      // Ambil semua transaksi per hari (revenue - expense)
      const [layananRes, expenseRes] = await Promise.all([
        supabase.from("layanan").select("nominal, created_at").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()).neq("jenis_layanan", "pengeluaran"),
        supabase.from("layanan").select("nominal, created_at").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()).eq("jenis_layanan", "pengeluaran"),
      ])

      // Group by date
      const revenueByDate: Record<string, number> = {}
      const expenseByDate: Record<string, number> = {}

      for (const r of layananRes.data || []) {
        const d = format(new Date(r.created_at), "yyyy-MM-dd")
        revenueByDate[d] = (revenueByDate[d] || 0) + (r.nominal || 0)
      }
      for (const r of expenseRes.data || []) {
        const d = format(new Date(r.created_at), "yyyy-MM-dd")
        expenseByDate[d] = (expenseByDate[d] || 0) + (r.nominal || 0)
      }

      // Build array per hari
      const days = eachDayOfInterval({ start, end })
      let cumulative = 0
      const dataPoints = days.map((day) => {
        const key = format(day, "yyyy-MM-dd")
        const rev = revenueByDate[key] || 0
        const exp = expenseByDate[key] || 0
        const net = rev - exp
        cumulative += net
        return {
          date: format(day, "d MMM", { locale: id }),
          fullDate: format(day, "EEEE, d MMMM yyyy", { locale: id }),
          revenue: rev,
          expenses: exp,
          net,
          cumulative,
        }
      })

      setChartData(dataPoints)
    } catch (err) {
      console.error("Failed to fetch daily revenue:", err)
    } finally {
      setLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]?.payload
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4">
          <p className="font-semibold text-sm text-slate-900 mb-2">{item?.fullDate || label}</p>
          <p className="text-sm text-emerald-600">
            <span className="font-medium">Revenue:</span>{' '}
            <span className="font-semibold">Rp {(item?.revenue || 0).toLocaleString()}</span>
          </p>
          <p className="text-sm text-red-500">
            <span className="font-medium">Expenses:</span>{' '}
            <span className="font-semibold">Rp {(item?.expenses || 0).toLocaleString()}</span>
          </p>
          <p className="text-sm text-blue-600 mt-1">
            <span className="font-medium">Net:</span>{' '}
            <span className="font-semibold">Rp {(item?.net || 0).toLocaleString()}</span>
          </p>
          {viewMode === 'cumulative' && (
            <p className="text-sm text-slate-700 mt-1 border-t border-slate-100 pt-1">
              <span className="font-medium">Cumulative:</span>{' '}
              <span className="font-semibold">Rp {(item?.cumulative || 0).toLocaleString()}</span>
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const displayData = viewMode === 'cumulative' ? chartData : chartData
  const dataKey = viewMode === 'cumulative' ? 'cumulative' : 'net'

  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0)
  const totalExpenses = chartData.reduce((s, d) => s + d.expenses, 0)

  const formatRupiah = (v: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Revenue Harian</h3>
            <p className="text-xs text-slate-400">{chartData.length} hari data</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setViewMode('daily')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'daily' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Harian
          </button>
          <button onClick={() => setViewMode('cumulative')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'cumulative' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            Kumulatif
          </button>
        </div>
      </div>

      <div className="w-full h-[300px] sm:h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Memuat data grafik...</div>
        ) : displayData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Tidak ada data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" stroke="#6C757D" fontSize={isMobile ? 9 : 11}
                tick={{ fill: '#6C757D' }} axisLine={{ stroke: '#e2e8f0' }}
                interval={Math.max(Math.floor(displayData.length / 15), 1)} />
              <YAxis stroke="#6C757D" fontSize={isMobile ? 9 : 11}
                tick={{ fill: '#6C757D' }} axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => isMobile ? `${(v / 1000000).toFixed(1)}jt` : `Rp${(v / 1000000).toFixed(1)}jt`}
                domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={dataKey} stroke="none" fill="url(#colorNet)" />
              <Line type="monotone" dataKey={dataKey} stroke="#2563EB" strokeWidth={2}
                dot={false} activeDot={{ r: 5, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-slate-200">
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Revenue</p>
          <p className="text-sm sm:text-lg font-bold text-emerald-600 truncate">{formatRupiah(totalRevenue)}</p>
        </div>
        <div className="text-center p-3 bg-slate-50 rounded-lg">
          <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Expenses</p>
          <p className="text-sm sm:text-lg font-bold text-red-500 truncate">{formatRupiah(totalExpenses)}</p>
        </div>
      </div>
    </div>
  )
}
