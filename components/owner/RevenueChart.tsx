'use client'

import { useState, useEffect, useId } from 'react'
import {
  LineChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Brush
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useBranch } from '@/lib/context/BranchContext'
import { computeBranchSeries, UNASSIGNED_BRANCH, type Granularity } from '@/lib/owner/stats'

interface RevenueChartProps {
  dateRange: { start: Date; end: Date }
}

const LINE_COLORS = ['#2563eb', '#f59e0b', '#0d9488', '#8b5cf6', '#06b6d4', '#f43f5e', '#10b981']

export default function RevenueChart({ dateRange }: RevenueChartProps) {
  const supabase = createClient()
  const { activeBranchId, branches } = useBranch()
  const gradId = useId()
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const rangeDays =
    (dateRange.end.getTime() - dateRange.start.getTime()) / (24 * 60 * 60 * 1000)

  useEffect(() => {
    setGranularity(rangeDays <= 8 ? 'day' : rangeDays <= 45 ? 'week' : 'month')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange])

  useEffect(() => {
    fetchSeries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, activeBranchId, granularity])

  const branchMatch = activeBranchId ? { branch_id: activeBranchId } : {}

  const branchNameOf = (id: string) =>
    branches.find((b) => b.id === id)?.name || (id === 'unassigned' ? 'Tanpa Cabang' : 'Cabang lain')

  const fetchSeries = async () => {
    setLoading(true)
    try {
      const start = dateRange.start
      const end = dateRange.end
      const [servicesRes, layananRes, expenseRes] = await Promise.all([
        supabase.from("service_orders").select("id, branch_id, created_at, status, service_items(price, quantity)")
          .match(branchMatch).gte("created_at", start.toISOString()).lte("created_at", end.toISOString()),
        supabase.from("layanan").select("id, branch_id, nominal, jenis_layanan, status, created_at")
          .match(branchMatch).gte("created_at", start.toISOString()).lte("created_at", end.toISOString())
          .neq("jenis_layanan", "pengeluaran"),
        supabase.from("layanan").select("id, branch_id, nominal, jenis_layanan, status, created_at")
          .match(branchMatch).gte("created_at", start.toISOString()).lte("created_at", end.toISOString())
          .eq("jenis_layanan", "pengeluaran"),
      ])

      const series = computeBranchSeries(
        servicesRes.data || [],
        [...(layananRes.data || []), ...(expenseRes.data || [])],
        { start, end, granularity },
      )

      const branchesWithData = new Set<string>()
      series.forEach((b) => Object.keys(b.byBranch).forEach((k) => branchesWithData.add(k)))
      branchesWithData.delete(UNASSIGNED_BRANCH)
      const visibleBranches = activeBranchId
        ? [activeBranchId]
        : [...branchesWithData]

      setChartData(
        series.map((bucket) => {
          const row: Record<string, any> = {
            label: bucket.label,
            fullLabel: bucket.fullLabel,
            revenue: bucket.revenue,
            expenses: bucket.expenses,
          }
          visibleBranches.forEach((bid) => {
            row[branchNameOf(bid)] = bucket.byBranch[bid]?.revenue ?? 0
          })
          return row
        }),
      )
    } catch (err) {
      console.error("Failed to fetch revenue series:", err)
    } finally {
      setLoading(false)
    }
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]?.payload
      const branchKeys = Object.keys(chartData[0] || {}).filter(
        (k) => !['label', 'fullLabel', 'revenue', 'expenses'].includes(k),
      )
      const seen = new Set<string>()
      const branchEntries = payload.filter((entry: any) => {
        if (entry.dataKey === 'revenue' || entry.dataKey === 'expenses' || seen.has(entry.dataKey)) return false
        seen.add(entry.dataKey)
        return true
      })
      if (branchEntries.length === 0) return null
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4">
          <p className="font-semibold text-sm text-slate-900 mb-2">{item?.fullLabel || label}</p>
          {branchEntries.map((entry: any) => (
            <p key={entry.dataKey} className="text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full inline-block"
                style={{ background: LINE_COLORS[branchKeys.indexOf(entry.dataKey) % LINE_COLORS.length] }} />
              <span className="font-medium">{entry.dataKey}:</span>{' '}
              <span className="font-semibold">Rp {(entry.value || 0).toLocaleString()}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  const granularityLabel = granularity === 'day' ? 'Harian' : granularity === 'week' ? 'Mingguan' : 'Bulanan'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Revenue Overview</h3>
            <p className="text-xs text-slate-400">Pendapatan per cabang · {granularityLabel}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {(['day', 'week', 'month'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                granularity === g
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {g === 'day' ? 'Day' : g === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-[300px] sm:h-[400px] rounded-lg"
        style={{ background: 'linear-gradient(to bottom, #f8fafc, #ffffff)' }}>
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Memuat data grafik...</div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">Tidak ada data</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" stroke="#6C757D" fontSize={isMobile ? 9 : 11}
                tick={{ fill: '#6C757D' }} axisLine={{ stroke: '#e2e8f0' }}
                interval={Math.max(Math.floor(chartData.length / 15), 1)} />
              <YAxis stroke="#6C757D" fontSize={isMobile ? 9 : 11}
                tick={{ fill: '#6C757D' }} axisLine={{ stroke: '#e2e8f0' }}
                tickFormatter={(v) => isMobile ? `${(v / 1000000).toFixed(1)}jt` : `Rp${(v / 1000000).toFixed(1)}jt`}
                domain={['auto', 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                {Object.keys(chartData[0] || {})
                  .filter((k) => !['label', 'fullLabel', 'revenue', 'expenses'].includes(k))
                  .map((branchName, i) => (
                    <linearGradient key={branchName} id={`${gradId}-area-${i}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={LINE_COLORS[i % LINE_COLORS.length]} stopOpacity={0.04} />
                    </linearGradient>
                  ))}
              </defs>
              {Object.keys(chartData[0] || {})
                .filter((k) => !['label', 'fullLabel', 'revenue', 'expenses'].includes(k))
                .map((branchName, i) => (
                  <Area key={`area-${branchName}`} type="monotone" dataKey={branchName}
                    stroke="none" fill={`url(#${gradId}-area-${i})`} />
                ))}
              {Object.keys(chartData[0] || {})
                .filter((k) => !['label', 'fullLabel', 'revenue', 'expenses'].includes(k))
                .map((branchName, i) => (
                  <Line key={branchName} type="monotone" dataKey={branchName}
                    stroke={LINE_COLORS[i % LINE_COLORS.length]} strokeWidth={2.5}
                    dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
                ))}
              <Brush dataKey="label" height={28} travellerWidth={8}
                stroke="#2563eb" fill="#f8fafc" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {!loading && chartData.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-slate-100">
          {Object.keys(chartData[0])
            .filter((k) => !['label', 'fullLabel', 'revenue', 'expenses'].includes(k))
            .map((branchName, i) => (
              <span key={branchName} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-2 h-2 rounded-full inline-block"
                  style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                {branchName}
              </span>
            ))}
        </div>
      )}
    </div>
  )
}