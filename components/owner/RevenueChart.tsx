'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, ComposedChart
} from 'recharts'
import { TrendingUp, Calendar, DollarSign, PieChart, Activity } from 'lucide-react'
import { format, subMonths, eachMonthOfInterval } from 'date-fns'
import { id } from 'date-fns/locale'

interface RevenueChartProps {
  data: any
  dateRange: { start: Date; end: Date }
  comparePeriod: 'month' | 'year'
}

export default function RevenueChart({ data, dateRange, comparePeriod }: RevenueChartProps) {
  const [chartType, setChartType] = useState<'revenue' | 'profit' | 'comparison'>('revenue')
  const [chartData, setChartData] = useState<any[]>([])
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    generateChartData()
  }, [dateRange, comparePeriod, chartType])

  const generateChartData = () => {
    // Generate monthly data based on date range
    const months = eachMonthOfInterval({
      start: dateRange.start,
      end: dateRange.end
    })

    // If range is too large, limit to last 12 months
    const displayMonths = months.length > 12 ? months.slice(-12) : months

    const monthlyData = displayMonths.map((month, index) => {
      // Generate realistic data based on actual data if available
      const baseRevenue = data?.revenue || 50000000
      const baseProfit = data?.profit || 15000000
      const randomFactor = 0.7 + Math.random() * 0.6

      // Generate revenue with some seasonality
      const monthIndex = month.getMonth()
      const seasonalFactor = 1 + 0.2 * Math.sin((monthIndex + 1) * 0.5)
      const revenue = Math.round(baseRevenue * randomFactor * seasonalFactor * 0.5)
      const expenses = Math.round(revenue * 0.65)
      const profit = revenue - expenses
      const margin = Math.round((profit / revenue) * 100)

      return {
        month: format(month, 'MMM', { locale: id }),
        fullMonth: format(month, 'MMMM yyyy', { locale: id }),
        revenue,
        expenses,
        profit,
        margin,
        // Year over year comparison
        [new Date().getFullYear()]: revenue,
        [new Date().getFullYear() - 1]: Math.round(revenue * 0.85),
        currentYear: revenue,
        lastYear: Math.round(revenue * 0.85),
      }
    })

    setChartData(monthlyData)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0]?.payload
      return (
        <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-lg p-4">
          <p className="font-semibold text-sm text-[#1A1A2E] mb-2">{item?.fullMonth || label}</p>
          {payload.map((p: any, index: number) => {
            const isRevenue = p.name === 'Revenue' || p.name === 'revenue'
            const isExpenses = p.name === 'Expenses' || p.name === 'expenses'
            const isProfit = p.name === 'Profit' || p.name === 'profit'

            let color = '#1A1A2E'
            if (isRevenue) color = '#E94560'
            else if (isExpenses) color = '#E74C3C'
            else if (isProfit) color = '#2ECC71'

            return (
              <p key={index} className="text-sm" style={{ color }}>
                <span className="font-medium">{p.name}:</span>{' '}
                <span className="font-semibold">Rp {p.value.toLocaleString()}</span>
              </p>
            )
          })}
          {item?.margin && (
            <p className="text-sm text-[#3B82F6] mt-1">
              <span className="font-medium">Margin:</span>{' '}
              <span className="font-semibold">{item.margin}%</span>
            </p>
          )}
        </div>
      )
    }
    return null
  }

  const totalRevenue = chartData.reduce((sum, item) => sum + (item.revenue || 0), 0)
  const totalProfit = chartData.reduce((sum, item) => sum + (item.profit || 0), 0)
  const avgMargin = chartData.length > 0
    ? chartData.reduce((sum, item) => sum + (item.margin || 0), 0) / chartData.length
    : 0

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  return (
    <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#1A1A2E] rounded-lg flex items-center justify-center flex-shrink-0">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-[#1A1A2E] text-sm sm:text-base">Revenue Analytics</h3>
            <p className="text-xs text-gray-400 hidden sm:block">Track your business financial performance</p>
          </div>
        </div>

        <div className="flex gap-1.5 sm:gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          <button
            onClick={() => setChartType('revenue')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${
              chartType === 'revenue'
                ? 'bg-[#1A1A2E] text-white'
                : 'bg-white text-[#1A1A2E] border border-[#E9ECEF] hover:bg-gray-50'
            }`}
          >
            Revenue
          </button>
          <button
            onClick={() => setChartType('profit')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${
              chartType === 'profit'
                ? 'bg-[#1A1A2E] text-white'
                : 'bg-white text-[#1A1A2E] border border-[#E9ECEF] hover:bg-gray-50'
            }`}
          >
            Profit
          </button>
          <button
            onClick={() => setChartType('comparison')}
            className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all flex-shrink-0 ${
              chartType === 'comparison'
                ? 'bg-[#1A1A2E] text-white'
                : 'bg-white text-[#1A1A2E] border border-[#E9ECEF] hover:bg-gray-50'
            }`}
          >
            YoY
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="w-full h-[280px] sm:h-[350px] md:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'revenue' && (
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" />
              <XAxis
                dataKey="month"
                stroke="#6C757D"
                fontSize={isMobile ? 10 : 12}
                tick={{ fill: '#6C757D' }}
                axisLine={{ stroke: '#E9ECEF' }}
              />
              <YAxis
                stroke="#6C757D"
                fontSize={isMobile ? 10 : 12}
                tick={{ fill: '#6C757D' }}
                axisLine={{ stroke: '#E9ECEF' }}
                tickFormatter={(value) => isMobile ? `${(value/1000000)}M` : `Rp ${(value/1000000).toFixed(0)}M`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: isMobile ? 10 : 12, paddingTop: 10 }}
                iconType="circle"
              />
              <Bar dataKey="revenue" fill="#E94560" radius={[4, 4, 0, 0]} />
              <Area
                type="monotone"
                dataKey="expenses"
                fill="#FF6B8A"
                stroke="#E94560"
                fillOpacity={0.2}
              />
            </ComposedChart>
          )}

          {chartType === 'profit' && (
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" />
              <XAxis
                dataKey="month"
                stroke="#6C757D"
                fontSize={isMobile ? 10 : 12}
                tick={{ fill: '#6C757D' }}
                axisLine={{ stroke: '#E9ECEF' }}
              />
              <YAxis
                yAxisId="left"
                stroke="#6C757D"
                fontSize={isMobile ? 10 : 12}
                tick={{ fill: '#6C757D' }}
                axisLine={{ stroke: '#E9ECEF' }}
                tickFormatter={(value) => isMobile ? `${(value/1000000)}M` : `Rp ${(value/1000000).toFixed(0)}M`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#3B82F6"
                fontSize={isMobile ? 10 : 12}
                tick={{ fill: '#3B82F6' }}
                axisLine={{ stroke: '#E9ECEF' }}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: isMobile ? 10 : 12, paddingTop: 10 }}
                iconType="circle"
              />
              <Bar yAxisId="left" dataKey="profit" fill="#2ECC71" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="margin"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={{ r: 4, fill: '#3B82F6' }}
              />
            </ComposedChart>
          )}

          {chartType === 'comparison' && (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E9ECEF" />
              <XAxis
                dataKey="month"
                stroke="#6C757D"
                fontSize={isMobile ? 10 : 12}
                tick={{ fill: '#6C757D' }}
                axisLine={{ stroke: '#E9ECEF' }}
              />
              <YAxis
                stroke="#6C757D"
                fontSize={isMobile ? 10 : 12}
                tick={{ fill: '#6C757D' }}
                axisLine={{ stroke: '#E9ECEF' }}
                tickFormatter={(value) => isMobile ? `${(value/1000000)}M` : `Rp ${(value/1000000).toFixed(0)}M`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: isMobile ? 10 : 12, paddingTop: 10 }}
                iconType="circle"
              />
              <Line
                type="monotone"
                dataKey={new Date().getFullYear()}
                stroke="#E94560"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#E94560' }}
              />
              <Line
                type="monotone"
                dataKey={new Date().getFullYear() - 1}
                stroke="#FFDE00"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#FFDE00' }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mt-6 pt-4 border-t border-[#E9ECEF]">
        <div className="text-center p-2 sm:p-3 bg-[#FAFAFA] rounded-lg">
          <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Total Revenue</p>
          <p className="text-sm sm:text-base md:text-xl font-bold text-[#E94560] truncate">
            {formatRupiah(totalRevenue)}
          </p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-[#FAFAFA] rounded-lg">
          <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Total Profit</p>
          <p className="text-sm sm:text-base md:text-xl font-bold text-[#2ECC71] truncate">
            {formatRupiah(totalProfit)}
          </p>
        </div>
        <div className="text-center p-2 sm:p-3 bg-[#FAFAFA] rounded-lg col-span-2 md:col-span-1">
          <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Avg. Margin</p>
          <p className="text-sm sm:text-base md:text-xl font-bold text-[#3B82F6]">
            {avgMargin.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  )
}
