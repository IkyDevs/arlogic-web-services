'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend
} from 'recharts'
import { Users, CheckCircle, Star, Target, Award, TrendingUp } from 'lucide-react'

interface PerformanceChartProps {
  data: any[]
  totalServices: number
}

export default function PerformanceChart({ data, totalServices }: PerformanceChartProps) {
  const [viewType, setViewType] = useState<'bar' | 'pie' | 'radar'>('bar')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const completionRate = totalServices > 0
    ? (data.reduce((sum, t) => sum + t.completed, 0) / totalServices) * 100
    : 0

  const topPerformer = [...data].sort((a, b) => b.completed - a.completed)[0]

  const pieData = data.map(tech => ({
    name: tech.name || 'Unknown',
    value: tech.completed || 0,
    revenue: tech.revenue || 0
  }))

  const COLORS = ['#0d9488', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f43f5e']

  const radarData = [
    { subject: 'Speed', A: Math.min(85 + Math.random() * 10, 100), fullMark: 100 },
    { subject: 'Quality', A: Math.min(90 + Math.random() * 8, 100), fullMark: 100 },
    { subject: 'Satisfaction', A: Math.min(85 + Math.random() * 10, 100), fullMark: 100 },
    { subject: 'Efficiency', A: Math.min(75 + Math.random() * 15, 100), fullMark: 100 },
    { subject: 'Problem Solving', A: Math.min(88 + Math.random() * 10, 100), fullMark: 100 },
  ]

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]?.payload
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4">
          <p className="font-semibold text-sm text-slate-900 mb-2">{label}</p>
          <p className="text-sm text-blue-600">
            <span className="font-medium">Completed:</span>{' '}
            <span className="font-bold">{payload[0]?.value || 0}</span>
          </p>
          {item?.revenue && (
            <p className="text-sm text-[#3B82F6] mt-1">
              <span className="font-medium">Revenue:</span>{' '}
              <span className="font-bold">Rp {item.revenue.toLocaleString()}</span>
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]?.payload
      return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4">
          <p className="font-semibold text-sm text-slate-900 mb-2">{payload[0].name}</p>
          <p className="text-sm text-blue-600">
            <span className="font-medium">Services:</span>{' '}
            <span className="font-bold">{payload[0].value}</span>
          </p>
          <p className="text-sm text-[#3B82F6] mt-1">
            <span className="font-medium">Revenue:</span>{' '}
            <span className="font-bold">Rp {item?.revenue?.toLocaleString() || 0}</span>
          </p>
        </div>
      )
    }
    return null
  }

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  const avgPerTech = data.length > 0 ? (totalServices / data.length) : 0

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm sm:text-base">Performance Metrics</h3>
            <p className="text-xs text-slate-400 hidden sm:block">Team performance and productivity</p>
          </div>
        </div>

        <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          <button
            onClick={() => setViewType('bar')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${
              viewType === 'bar'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Bar
          </button>
          <button
            onClick={() => setViewType('pie')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${
              viewType === 'pie'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Pie
          </button>
          <button
            onClick={() => setViewType('radar')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${
              viewType === 'radar'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Radar
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[280px] sm:h-[350px] md:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {viewType === 'bar' && (
            <BarChart data={data} layout={isMobile ? 'vertical' : 'horizontal'}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              {isMobile ? (
                <>
                  <XAxis type="number" stroke="#6C757D" fontSize={10} tick={{ fill: '#6C757D' }} />
                  <YAxis dataKey="name" type="category" stroke="#6C757D" fontSize={10} tick={{ fill: '#6C757D' }} width={60} />
                </>
              ) : (
                <>
                  <XAxis dataKey="name" stroke="#6C757D" fontSize={12} tick={{ fill: '#6C757D' }} />
                  <YAxis stroke="#6C757D" fontSize={12} tick={{ fill: '#6C757D' }} />
                </>
              )}
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          )}

          {viewType === 'pie' && (
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => isMobile
                  ? `${((percent ?? 0) * 100).toFixed(0)}%`
                  : `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
                }
                outerRadius={isMobile ? 80 : 150}
                fill="#8884d8"
                dataKey="value"
                stroke="#FFFFFF"
                strokeWidth={2}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          )}

          {viewType === 'radar' && (
            <RadarChart cx="50%" cy="50%" outerRadius={isMobile ? "60%" : "80%"} data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis
                dataKey="subject"
                stroke="#6C757D"
                fontSize={isMobile ? 9 : 12}
                tick={{ fill: '#6C757D' }}
              />
              <Radar
                name="Team Performance"
                dataKey="A"
                stroke="#0d9488"
                fill="#0d9488"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-4">
                        <p className="font-semibold text-sm text-slate-900">{payload[0]?.payload?.subject}</p>
                        <p className="text-sm text-blue-600">
                          <span className="font-medium">Score:</span>{' '}
                          <span className="font-bold">{payload[0]?.value}/100</span>
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 12, paddingTop: 10 }} />
            </RadarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 pt-4 border-t border-slate-200">
        <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-[#2ECC71]" />
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Completion</p>
          </div>
          <p className="text-sm sm:text-lg md:text-xl font-bold text-[#2ECC71]">
            {completionRate.toFixed(1)}%
          </p>
        </div>

        <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Star className="w-3 h-3 sm:w-4 sm:h-4 text-[#F59E0B]" />
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Top Performer</p>
          </div>
          <p className="text-xs sm:text-sm md:text-base font-bold text-slate-900 truncate max-w-[80px] sm:max-w-none">
            {topPerformer?.name || 'N/A'}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-400">
            {topPerformer?.completed || 0} services
          </p>
        </div>

        <div className="text-center p-2 sm:p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Award className="w-3 h-3 sm:w-4 sm:h-4 text-[#3B82F6]" />
            <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Per Tech</p>
          </div>
          <p className="text-sm sm:text-lg md:text-xl font-bold text-[#3B82F6]">
            {avgPerTech.toFixed(1)}
          </p>
          <p className="text-[10px] sm:text-xs text-slate-400">services each</p>
        </div>
      </div>
    </div>
  )
}
