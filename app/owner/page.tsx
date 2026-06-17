'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Users, Clock, Calendar, ChevronDown, BarChart3,
  LogOut, Watch, Menu, X, LayoutDashboard,
  FileText, Star, Database, Bell, RefreshCw,
  ChevronRight, Activity, CheckCircle, AlertCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns'
import toast from 'react-hot-toast'
import dynamic from 'next/dynamic'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// Dynamic imports
const RevenueChart = dynamic(() => import('@/components/owner/RevenueChart'), {
  loading: () => <div className="bg-white rounded-xl border border-[#E9ECEF] p-8 text-center shadow-sm">Loading chart...</div>
})
const PerformanceChart = dynamic(() => import('@/components/owner/PerformanceChart'), {
  loading: () => <div className="bg-white rounded-xl border border-[#E9ECEF] p-8 text-center shadow-sm">Loading chart...</div>
})
const ExportButton = dynamic(() => import('@/components/owner/ExportButton'), {
  loading: () => <button className="px-3 py-1.5 bg-[#1A1A2E] text-white rounded-lg text-xs sm:text-sm font-medium">Export</button>
})
const WatchDatabase = dynamic(() => import('@/components/owner/WatchDatabase'), {
  loading: () => <div className="bg-white rounded-xl border border-[#E9ECEF] p-8 text-center shadow-sm">Loading...</div>
})
const FeedbackList = dynamic(() => import('@/components/owner/FeedbackList'), {
  loading: () => <div className="bg-white rounded-xl border border-[#E9ECEF] p-8 text-center shadow-sm">Loading...</div>
})

type DateRange = 'today' | 'week' | 'month' | 'custom'
type PeriodType = 'month' | 'year'
type ActiveTab = 'overview' | 'revenue' | 'performance' | 'feedback' | 'watch_db'

interface DashboardData {
  revenue: number
  expenses: number
  profit: number
  completedServices: number
  totalServices: number
  activeTechnicians: number
  averageCompletionTime: number
  technicianPerformance: any[]
  monthlyComparison: {
    revenue: number
    profit: number
    growth: number
  }
}

export default function OwnerDashboard() {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const supabase = createClient()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)')
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const [customStartDate, setCustomStartDate] = useState<Date>(subDays(new Date(), 7))
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [comparePeriod, setComparePeriod] = useState<PeriodType>('month')
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    fetchDashboardData()
    fetchUnreadCount()
    const interval = setInterval(() => {
      fetchDashboardData(true)
      fetchUnreadCount()
    }, 30000)
    return () => clearInterval(interval)
  }, [dateRange, customStartDate, customEndDate])

  const getDateRangeValues = () => {
    const now = new Date()
    switch (dateRange) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) }
      case 'week': return { start: startOfDay(subWeeks(now, 1)), end: endOfDay(now) }
      case 'month': return { start: startOfDay(subMonths(now, 1)), end: endOfDay(now) }
      case 'custom': return { start: startOfDay(customStartDate), end: endOfDay(customEndDate) }
      default: return { start: startOfDay(subMonths(now, 1)), end: endOfDay(now) }
    }
  }

  const fetchUnreadCount = async () => {
    if (!user?.id) return
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    setUnreadCount(count || 0)
  }

  const fetchDashboardData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { start, end } = getDateRangeValues()

    try {
      const { data: services, error: servicesError } = await supabase
        .from('service_orders')
        .select(`
          *,
          service_items (*)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      if (servicesError) throw servicesError

      const { data: attendances } = await supabase
        .from('attendances')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      const { data: techProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'teknisi')

      let revenue = 0
      services?.forEach(service => {
        const serviceTotal = service.service_items?.reduce((sum: number, item: any) => {
          return sum + (Number(item.price) * (item.quantity || 1) || 0)
        }, 0) || 0
        revenue += serviceTotal
      })

      const expenses = revenue * 0.35
      const profit = revenue - expenses
      const completedServices = services?.filter(s => s.status === 'completed').length || 0
      const totalServices = services?.length || 0
      const activeTechnicians = new Set(attendances?.filter(a => !a.check_out).map(a => a.teknisi_id)).size

      const completionTimes = services
        ?.filter(s => s.completed_at && s.created_at)
        .map(s => {
          const created = new Date(s.created_at)
          const completed = new Date(s.completed_at)
          return (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
        }) || []

      const averageCompletionTime = completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : 0

      const techMap: Record<string, any> = {}
      services?.filter(s => s.assigned_teknisi_id).forEach(service => {
        const techId = service.assigned_teknisi_id
        const techName = techProfiles?.find(t => t.id === techId)?.full_name || 'Unknown'
        const serviceRevenue = service.service_items?.reduce((sum: number, item: any) => {
          return sum + (Number(item.price) * (item.quantity || 1) || 0)
        }, 0) || 0

        if (!techMap[techId]) {
          techMap[techId] = { id: techId, name: techName, completed: 0, revenue: 0 }
        }
        if (service.status === 'completed') techMap[techId].completed++
        techMap[techId].revenue += serviceRevenue
      })

      const technicianPerformance = Object.values(techMap)

      const previousStart = subMonths(start, 1)
      const previousEnd = subMonths(end, 1)
      const { data: previousServices } = await supabase
        .from('service_orders')
        .select('*, service_items(*)')
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString())

      let previousRevenue = 0
      previousServices?.forEach(service => {
        const serviceTotal = service.service_items?.reduce((sum: number, item: any) => {
          return sum + (Number(item.price) * (item.quantity || 1) || 0)
        }, 0) || 0
        previousRevenue += serviceTotal
      })

      const revenueGrowth = previousRevenue === 0 ? 100
        : ((revenue - previousRevenue) / previousRevenue) * 100

      setDashboardData({
        revenue, expenses, profit, completedServices, totalServices,
        activeTechnicians, averageCompletionTime, technicianPerformance,
        monthlyComparison: { revenue, profit, growth: revenueGrowth }
      })
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error)
      if (!silent) toast.error(error.message || 'Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
    router.push('/login')
    toast.success('Logged out successfully')
  }

  const menuItems: { id: ActiveTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'feedback', label: 'Feedback', icon: Star },
    { id: 'watch_db', label: 'Watch DB', icon: Database },
  ]

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  const formatDate = (date: Date) => {
    return format(date, 'EEEE, dd MMMM yyyy')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#E94560] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ==================== SIDEBAR ==================== */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-[#E9ECEF] z-40 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 overflow-y-auto`}>
        <div className="p-4 border-b border-[#E9ECEF]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-[#1A1A2E] rounded-lg flex items-center justify-center flex-shrink-0">
                <Watch className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#1A1A2E]">Watch<span className="text-[#E94560]">Service</span></h1>
                <p className="text-[10px] text-gray-400">Owner Panel</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 p-2.5 bg-[#FAFAFA] rounded-lg">
            <div className="w-9 h-9 bg-[#1A1A2E] rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
              {user?.full_name?.charAt(0) || 'O'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-0.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id)
                if (isMobile) setSidebarOpen(false)
              }}
              className={`w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-lg transition-all ${
                activeTab === item.id
                  ? 'bg-[#1A1A2E] text-white'
                  : 'text-[#1A1A2E] hover:bg-gray-100'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-[#E9ECEF]">
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-lg text-[#E94560] hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>Logout</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-[#E9ECEF] text-center">
          <p className="text-[10px] text-gray-400">Watch Service v2.0</p>
        </div>
      </div>

      {/* Overlay untuk mobile */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-[#E9ECEF] z-20">
          <div className="px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-[#1A1A2E] truncate">
                  {menuItems.find(m => m.id === activeTab)?.label}
                </h2>
                <p className="text-xs text-gray-400 hidden sm:block">{formatDate(new Date())}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Notification */}
              <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-all flex-shrink-0">
                <Bell className="w-4 h-4 text-gray-400" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E94560] text-white text-[9px] font-bold flex items-center justify-center rounded-full">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Refresh */}
              <button
                onClick={() => fetchDashboardData(true)}
                disabled={refreshing}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50 flex-shrink-0"
              >
                <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
              </button>

              {/* Date Range - Responsive */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-xs sm:text-sm font-medium"
                >
                  <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                  <span className="hidden xs:inline">
                    {dateRange === 'today' ? 'Today' :
                     dateRange === 'week' ? 'Week' :
                     dateRange === 'month' ? 'Month' :
                     'Custom'}
                  </span>
                  <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                </button>

                {showDatePicker && (
                  <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white rounded-xl border border-[#E9ECEF] shadow-lg z-50 p-2 sm:p-3">
                    {['today', 'week', 'month', 'custom'].map((range) => (
                      <button
                        key={range}
                        onClick={() => {
                          setDateRange(range as DateRange)
                          if (range !== 'custom') setShowDatePicker(false)
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm transition-all ${
                          dateRange === range
                            ? 'bg-[#1A1A2E] text-white'
                            : 'hover:bg-gray-50 text-[#1A1A2E]'
                        }`}
                      >
                        {range === 'today' ? 'Today' :
                         range === 'week' ? 'This Week' :
                         range === 'month' ? 'This Month' :
                         'Custom Range'}
                      </button>
                    ))}

                    {dateRange === 'custom' && (
                      <div className="mt-3 pt-3 border-t border-[#E9ECEF] space-y-2">
                        <div>
                          <label className="text-xs text-gray-400">Start</label>
                          <input
                            type="date"
                            value={format(customStartDate, 'yyyy-MM-dd')}
                            onChange={(e) => setCustomStartDate(new Date(e.target.value))}
                            className="w-full px-2 py-1.5 border border-[#E9ECEF] rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">End</label>
                          <input
                            type="date"
                            value={format(customEndDate, 'yyyy-MM-dd')}
                            onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                            className="w-full px-2 py-1.5 border border-[#E9ECEF] rounded-lg text-sm"
                          />
                        </div>
                        <button
                          onClick={() => {
                            fetchDashboardData()
                            setShowDatePicker(false)
                          }}
                          className="w-full bg-[#1A1A2E] text-white py-2 rounded-lg text-sm font-medium hover:bg-[#2D2D44] transition-all"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <ExportButton data={dashboardData} dateRange={getDateRangeValues()} />
            </div>
          </div>
        </header>

        {/* ==================== CONTENT ==================== */}
        <main className="p-3 sm:p-4 md:p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-4 sm:space-y-6"
              >
                {/* Welcome Banner */}
                <div className="bg-white rounded-xl border border-[#E9ECEF] p-4 sm:p-5 shadow-sm">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg sm:text-xl font-bold text-[#1A1A2E]">Welcome back, {user?.full_name?.split(' ')[0]}! 👋</h3>
                      <p className="text-sm text-gray-500 mt-0.5">Here's your business performance overview.</p>
                    </div>
                    <div className="bg-[#FAFAFA] px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border border-[#E9ECEF] flex-shrink-0">
                      <span className="mr-2">📅</span> {format(new Date(), 'MMMM yyyy')}
                    </div>
                  </div>
                </div>

                {/* Stats Grid - Responsive 2-3-5 columns */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                  <div className="bg-white rounded-xl border border-[#E9ECEF] p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                    <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Revenue</span>
                    <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-[#E94560] truncate">{formatRupiah(dashboardData?.revenue || 0)}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      <span className="text-[10px] sm:text-xs text-green-500 font-medium">{dashboardData?.monthlyComparison.growth.toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[#E9ECEF] p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                    <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Profit</span>
                    <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-[#1A1A2E] truncate">{formatRupiah(dashboardData?.profit || 0)}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <TrendingUp className="w-3 h-3 text-green-500" />
                      <span className="text-[10px] sm:text-xs text-green-500 font-medium">+12.5%</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[#E9ECEF] p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                    <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Services</span>
                    <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-[#1A1A2E]">{dashboardData?.completedServices || 0}/{dashboardData?.totalServices || 0}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <CheckCircle className="w-3 h-3 text-green-500" />
                      <span className="text-[10px] sm:text-xs text-green-500 font-medium">{dashboardData?.totalServices ? Math.round((dashboardData.completedServices / dashboardData.totalServices) * 100) : 0}%</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[#E9ECEF] p-3 sm:p-4 shadow-sm hover:shadow-md transition-all">
                    <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Active Teknisi</span>
                    <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-[#1A1A2E]">{dashboardData?.activeTechnicians || 0}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Users className="w-3 h-3 text-[#3B82F6]" />
                      <span className="text-[10px] sm:text-xs text-gray-400">Working</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[#E9ECEF] p-3 sm:p-4 shadow-sm hover:shadow-md transition-all col-span-2 md:col-span-1">
                    <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">Avg. Duration</span>
                    <p className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-[#1A1A2E]">{(dashboardData?.averageCompletionTime || 0).toFixed(1)} days</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-[#F1C40F]" />
                      <span className="text-[10px] sm:text-xs text-gray-400">Per service</span>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#E9ECEF]">
                      <h3 className="font-semibold text-[#1A1A2E] text-sm sm:text-base">Revenue Trend</h3>
                    </div>
                    <div className="p-3 sm:p-5">
                      <RevenueChart data={dashboardData} dateRange={getDateRangeValues()} comparePeriod={comparePeriod} />
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#E9ECEF]">
                      <h3 className="font-semibold text-[#1A1A2E] text-sm sm:text-base">Technician Performance</h3>
                    </div>
                    <div className="p-3 sm:p-5">
                      <PerformanceChart data={dashboardData?.technicianPerformance || []} totalServices={dashboardData?.totalServices || 0} />
                    </div>
                  </div>
                </div>

                {/* Financial Summary & Quick Actions */}
                <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
                  <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm p-4 sm:p-5">
                    <h3 className="font-semibold text-[#1A1A2E] mb-3 sm:mb-4 text-sm sm:text-base">Financial Summary</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-[#E9ECEF]">
                        <span className="text-xs sm:text-sm text-gray-500">Revenue</span>
                        <span className="font-bold text-[#1A1A2E] text-xs sm:text-sm">{formatRupiah(dashboardData?.revenue || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#E9ECEF]">
                        <span className="text-xs sm:text-sm text-gray-500">Expenses (est.)</span>
                        <span className="font-bold text-[#E94560] text-xs sm:text-sm">{formatRupiah(dashboardData?.expenses || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-[#E9ECEF]">
                        <span className="text-xs sm:text-sm text-gray-500">Gross Profit</span>
                        <span className="font-bold text-[#2ECC71] text-xs sm:text-sm">{formatRupiah(dashboardData?.profit || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs sm:text-sm text-gray-500">Profit Margin</span>
                        <span className="font-bold text-[#1A1A2E] text-xs sm:text-sm">
                          {dashboardData?.revenue ? ((dashboardData.profit / dashboardData.revenue) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm p-4 sm:p-5">
                    <h3 className="font-semibold text-[#1A1A2E] mb-3 sm:mb-4 text-sm sm:text-base">Quick Actions</h3>
                    <div className="space-y-2 sm:space-y-3">
                      <button
                        onClick={() => setActiveTab('revenue')}
                        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2D2D44] transition-all text-xs sm:text-sm font-medium"
                      >
                        <span>Revenue Analytics</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setActiveTab('performance')}
                        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-[#E94560] text-white rounded-lg hover:bg-[#c73d54] transition-all text-xs sm:text-sm font-medium"
                      >
                        <span>Team Performance</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setActiveTab('feedback')}
                        className="w-full flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 bg-white border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-xs sm:text-sm font-medium"
                      >
                        <span>Customer Feedback</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'revenue' && (
              <motion.div
                key="revenue"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm p-4 sm:p-5">
                  <RevenueChart data={dashboardData} dateRange={getDateRangeValues()} comparePeriod={comparePeriod} />
                </div>
              </motion.div>
            )}

            {activeTab === 'performance' && (
              <motion.div
                key="performance"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm p-4 sm:p-5">
                  <PerformanceChart data={dashboardData?.technicianPerformance || []} totalServices={dashboardData?.totalServices || 0} />
                </div>
              </motion.div>
            )}

            {activeTab === 'feedback' && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <FeedbackList />
              </motion.div>
            )}

            {activeTab === 'watch_db' && (
              <motion.div
                key="watch_db"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <WatchDatabase />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
