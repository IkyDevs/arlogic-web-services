'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, CheckCircle, LogOut, User, Calendar, Wrench,
  Camera, LogIn, LogOut as LogOutIcon, Menu, X,
  ClipboardList, TrendingUp, Award, Zap, Shield,
  Battery, Signal, Wifi, ChevronRight, RefreshCw,
  Bell, Settings, Star, Users, Package, DollarSign,
  AlertCircle, FileText, Watch, Box, Activity, Search
} from 'lucide-react'
import AttendanceModal from '@/components/teknisi/AttendanceModal'
import QueueList from '@/components/teknisi/QueueList'
import ProgressUpdate from '@/components/teknisi/ProgressUpdate'
import LayananForm from '@/components/layanan/LayananForm'
import LayananList from '@/components/layanan/LayananList'
import ThemeToggle from '@/components/ThemeToggle'
import toast from 'react-hot-toast'

import dynamic from 'next/dynamic'

const ServiceTimeline = dynamic(() => import('@/components/teknisi/ServiceTimeline'), {
  loading: () => <div className="text-center py-8 text-slate-500">Loading...</div>
})

export default function TeknisiDashboard() {
  const [activeTab, setActiveTab] = useState('queue')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [showAttendance, setShowAttendance] = useState(false)
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out'>('check_in')
  const [showLayananForm, setShowLayananForm] = useState(false)
  const [refreshLayanan, setRefreshLayanan] = useState(0)
  const [stats, setStats] = useState({
    completedToday: 0,
    completedThisMonth: 0,
    inProgress: 0,
    pendingQueue: 0,
    averageTime: 2.5,
    rating: 4.8,
    totalEarnings: 0
  })
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sparepartSearch, setSparepartSearch] = useState('')
  const [sparepartResults, setSparepartResults] = useState<any[]>([])
  const [sparepartSearching, setSparepartSearching] = useState(false)
  const [showSparepartResults, setShowSparepartResults] = useState(false)

  // Close sparepart search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.sparepart-search-container')) {
        setShowSparepartResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    fetchAllData()
    const interval = setInterval(() => fetchAllData(true), 30000)
    return () => clearInterval(interval)
  }, [])

  const { user } = useAuthStore()
  const router = useRouter()
  const supabase = createClient()

  const searchSparepart = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSparepartResults([])
      setShowSparepartResults(false)
      return
    }
    
    setSparepartSearching(true)
    try {
      const { data } = await supabase
        .from('inventory')
        .select('*')
        .or(`item_name.ilike.%${query}%,sku.ilike.%${query}%`)
        .limit(10)

      setSparepartResults(data || [])
      setShowSparepartResults(true)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSparepartSearching(false)
    }
  }, [supabase])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchSparepart(sparepartSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [sparepartSearch, searchSparepart])

  // Close sidebar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (sidebarOpen && !target.closest('.sidebar-container')) {
        setSidebarOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [sidebarOpen])

  const fetchAllData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    try {
      await Promise.all([
        checkTodayAttendance(),
        fetchStats(),
        fetchRecentActivities()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
      if (!silent) toast.error('Gagal memuat data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const checkTodayAttendance = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('attendances')
      .select('*')
      .eq('teknisi_id', user?.id)
      .gte('check_in', today)
      .lte('check_in', today + ' 23:59:59')
      .order('check_in', { ascending: false })
      .limit(1)
      .single()

    setTodayAttendance(data || null)
  }

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [
      completedToday,
      completedMonth,
      inProgress,
      pendingQueue,
      earnings
    ] = await Promise.all([
      supabase.from('service_orders')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_teknisi_id', user?.id)
        .eq('status', 'completed')
        .gte('completed_at', today),
      supabase.from('service_orders')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_teknisi_id', user?.id)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth),
      supabase.from('service_orders')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_teknisi_id', user?.id)
        .in('status', ['assigned', 'in_progress']),
      supabase.from('service_orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase.from('service_orders')
        .select('final_cost')
        .eq('assigned_teknisi_id', user?.id)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth),
    ])

    const totalEarnings = (earnings.data || []).reduce((sum: number, item: any) => sum + (item.final_cost || 0) * 0.3, 0)

    setStats({
      completedToday: completedToday.count || 0,
      completedThisMonth: completedMonth.count || 0,
      inProgress: inProgress.count || 0,
      pendingQueue: pendingQueue.count || 0,
      averageTime: 2.5,
      rating: 4.8,
      totalEarnings: totalEarnings
    })
  }

  const fetchRecentActivities = async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      const formatted = data.map(log => ({
        id: log.id,
        message: log.action.replace(/_/g, ' ').toLowerCase(),
        time: getRelativeTime(log.created_at),
        details: log.details
      }))
      setRecentActivities(formatted)
    }
  }

  const getRelativeTime = (date: string) => {
    const now = new Date()
    const past = new Date(date)
    const diffMs = now.getTime() - past.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Baru saja'
    if (diffMins < 60) return `${diffMins} menit lalu`
    if (diffHours < 24) return `${diffHours} jam lalu`
    if (diffDays < 7) return `${diffDays} hari lalu`
    return past.toLocaleDateString()
  }

  const handleAttendance = (type: 'check_in' | 'check_out') => {
    if (type === 'check_in' && todayAttendance) {
      toast.error('Anda sudah check in hari ini!')
      return
    }
    if (type === 'check_out' && !todayAttendance) {
      toast.error('Anda harus check in dulu!')
      return
    }
    if (type === 'check_out' && todayAttendance?.check_out) {
      toast.error('Anda sudah check out hari ini!')
      return
    }

    setAttendanceType(type)
    setShowAttendance(true)
  }

  const handleAttendanceSuccess = () => {
    checkTodayAttendance()
    fetchRecentActivities()
    toast.success(`Absensi ${attendanceType === 'check_in' ? 'masuk' : 'pulang'} berhasil!`)
  }

  const handleLayananSuccess = () => {
    setShowLayananForm(false)
    setRefreshLayanan(prev => prev + 1)
    toast.success('Layanan berhasil ditambahkan!')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Logout berhasil')
  }

  const getAttendanceStatus = () => {
    if (!todayAttendance) return { text: 'Belum Absen', color: 'text-red-500', bg: 'bg-red-50', icon: '❌' }
    if (!todayAttendance.check_out) return { text: 'Checked In', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '✅' }
    return { text: 'Selesai', color: 'text-green-600', bg: 'bg-green-50', icon: '✓' }
  }

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  const attendanceStatus = getAttendanceStatus()

  const menuItems = [
    { id: 'queue', label: 'Antrean & Proyek', icon: ClipboardList },
    { id: 'stats', label: 'Performa', icon: TrendingUp },
    { id: 'layanan', label: 'Transaksi', icon: FileText },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#A8D7FF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#4DB2FF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#A8D7FF]">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-20 bg-white z-50 flex flex-col items-center py-4 sm:py-6 shadow-2xl lg:shadow-none lg:translate-x-0 lg:static lg:z-auto lg:h-auto lg:w-auto transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#4DB2FF] rounded-2xl flex items-center justify-center mb-6 sm:mb-8">
          <Wrench className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col items-center gap-2 sm:gap-3 px-2 sm:px-3 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id)
                setSidebarOpen(false)
              }}
              className={`sidebar-item w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
                activeTab === item.id
                  ? 'bg-[#FFD65A] text-black shadow-md'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col items-center gap-2 sm:gap-3 px-2 sm:px-3">
          {/* Attendance */}
          <button
            onClick={() => handleAttendance(todayAttendance && !todayAttendance.check_out ? 'check_out' : 'check_in')}
            disabled={!!todayAttendance?.check_out}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              !todayAttendance
                ? 'bg-[#3CCF91] text-white hover:bg-[#2db87d]'
                : todayAttendance.check_out
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-[#FFD65A] text-black hover:bg-[#f5c94a]'
            }`}
            title={todayAttendance?.check_out ? 'Completed' : 'Attendance'}
          >
            {!todayAttendance ? (
              <LogIn className="w-5 h-5" />
            ) : todayAttendance.check_out ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <LogOutIcon className="w-5 h-5" />
            )}
          </button>

          {/* Theme Toggle */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
            <ThemeToggle />
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 sm:top-4 sm:left-4 z-30 lg:hidden bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg border border-slate-200"
      >
        <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 min-h-screen flex flex-col w-full max-w-full overflow-x-hidden lg:ml-64">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 px-3 py-3 sm:px-4 sm:py-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl md:rounded-3xl px-3 py-2.5 sm:px-5 sm:py-3.5 flex items-center justify-between shadow-sm gap-2 sm:gap-4">
            {/* Spacer for mobile menu button */}
            <div className="hidden lg:block w-12" />

            {/* Page Title - Center on mobile */}
            <div className="flex-1 lg:flex-none text-center lg:text-left">
              <h1 className="text-lg sm:text-lg md:text-xl font-bold text-slate-900">
                {menuItems.find(m => m.id === activeTab)?.label}
              </h1>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              {/* Refresh */}
              <button
                onClick={() => fetchAllData(true)}
                className={`p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-all flex-shrink-0 ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              </button>

              {/* Notification */}
              <button
                onClick={() => toast('Notifikasi belum tersedia', { icon: '🔔' })}
                className="relative p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-all flex-shrink-0"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-[#FF5F87] rounded-full flex-shrink-0" />
              </button>

              {/* Profile */}
              <div className="flex items-center pl-1.5 sm:pl-2 border-l border-slate-200 flex-shrink-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#4DB2FF] rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                  {user?.full_name?.charAt(0) || 'T'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ==================== CONTENT ==================== */}
        <main className="flex-1 p-2 sm:p-3 md:p-4">
          <AnimatePresence mode="wait">
            {activeTab === 'queue' && (
              <motion.div
                key="queue"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-3 sm:space-y-4 md:space-y-5"
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                  <div className="bg-white rounded-lg sm:rounded-xl md:rounded-[24px] border border-slate-200 p-2.5 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-1 sm:mb-3">
                      <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider truncate mr-1">Selesai Hari Ini</span>
                      <CheckCircle className="w-4 h-4 sm:w-6 sm:h-6 text-emerald-600 flex-shrink-0" />
                    </div>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">{stats.completedToday}</p>
                  </div>

                  <div className="bg-white rounded-lg sm:rounded-xl md:rounded-[24px] border border-slate-200 p-2.5 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-1 sm:mb-3">
                      <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider truncate mr-1">Sedang Dikerjakan</span>
                      <Wrench className="w-4 h-4 sm:w-6 sm:h-6 text-[#FFD65A] flex-shrink-0" />
                    </div>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">{stats.inProgress}</p>
                  </div>

                  <div className="bg-white rounded-lg sm:rounded-xl md:rounded-[24px] border border-slate-200 p-2.5 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-1 sm:mb-3">
                      <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider truncate mr-1">Antrean</span>
                      <Clock className="w-4 h-4 sm:w-6 sm:h-6 text-[#4DB2FF] flex-shrink-0" />
                    </div>
                    <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">{stats.pendingQueue}</p>
                  </div>

                  <div className="bg-white rounded-lg sm:rounded-xl md:rounded-[24px] border border-slate-200 p-2.5 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-1 sm:mb-3">
                      <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider truncate mr-1">Pendapatan Bulan Ini</span>
                      <DollarSign className="w-4 h-4 sm:w-6 sm:h-6 text-[#4DB2FF] flex-shrink-0" />
                    </div>
                    <p className="text-sm sm:text-xl md:text-2xl font-bold text-[#4DB2FF] truncate">{formatRupiah(stats.totalEarnings)}</p>
                  </div>
                </div>

                {/* Queue List Component */}
                <QueueList
                  teknisiId={user?.id || ''}
                  onTakeProject={(service) => setSelectedService(service)}
                />

                {/* Recent Activity */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl sm:rounded-2xl md:rounded-[24px] border border-slate-200 shadow-sm p-3 sm:p-5"
                >
                  <div className="flex items-center gap-2 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-slate-200">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-slate-900 rounded-md sm:rounded-lg flex items-center justify-center">
                      <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900">Aktivitas Terbaru</h3>
                  </div>
                  <div className="space-y-2">
                    {recentActivities.map((activity, i) => (
                      <div key={activity.id} className="flex items-center gap-3 p-2 border-b border-slate-100 last:border-0">
                        <div className="w-2 h-2 bg-[#4DB2FF] rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm text-slate-700 truncate">{activity.message}</p>
                          <p className="text-[10px] sm:text-xs text-slate-400">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                    {recentActivities.length === 0 && (
                      <div className="text-center py-6 text-slate-400">
                        <p className="text-xs sm:text-sm">Belum ada aktivitas</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid md:grid-cols-2 gap-3 sm:gap-4 md:gap-6"
              >
                {/* Performance Stats */}
                <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-[24px] border border-slate-200 shadow-sm p-3 sm:p-5">
                  <div className="flex items-center gap-2 mb-4 sm:mb-5 pb-2 sm:pb-3 border-b border-slate-200">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-slate-900 rounded-md sm:rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-900">Metrik Performa</h3>
                  </div>

                  <div className="space-y-4 sm:space-y-5">
                    <div>
                      <div className="flex justify-between text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                        <span className="text-slate-600">Completion Rate</span>
                        <span className="text-[#3CCF91]">94%</span>
                      </div>
                      <div className="h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="w-[94%] h-full bg-[#3CCF91] rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                        <span className="text-slate-600">Rata-rata Waktu Service</span>
                        <span className="text-emerald-600">{stats.averageTime} hari</span>
                      </div>
                      <div className="h-1.5 sm:h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="w-[75%] h-full bg-[#FFD65A] rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs sm:text-sm font-medium mb-1 sm:mb-2">
                        <span className="text-slate-600">Rating Customer</span>
                        <span className="text-[#4DB2FF]">{stats.rating} / 5.0</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 sm:w-5 sm:h-5 ${
                              star <= Math.floor(stats.rating)
                                ? 'fill-[#FFD65A] text-[#FFD65A]'
                                : star - 0.5 <= stats.rating
                                ? 'fill-[#FFD65A]/50 text-[#FFD65A]'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 sm:pt-4 border-t border-slate-200">
                      <div className="flex justify-between items-center">
                        <div className="text-center">
                          <p className="text-lg sm:text-2xl font-bold text-slate-900">{stats.completedThisMonth}</p>
                          <p className="text-[10px] text-slate-400 uppercase">Service Bulan Ini</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg sm:text-2xl font-bold text-[#4DB2FF]">{formatRupiah(stats.totalEarnings)}</p>
                          <p className="text-[10px] text-slate-400 uppercase">Pendapatan</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg sm:text-2xl font-bold text-[#3CCF91]">100%</p>
                          <p className="text-[10px] text-slate-400 uppercase">Kehadiran</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Badges & Achievements */}
                <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-[24px] border border-slate-200 shadow-sm p-3 sm:p-5">
                  <div className="flex items-center gap-2 mb-4 sm:mb-5 pb-2 sm:pb-3 border-b border-slate-200">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 bg-[#FFD65A] rounded-md sm:rounded-lg flex items-center justify-center">
                      <Award className="w-3 h-3 sm:w-4 sm:h-4 text-slate-900" />
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-900">Pencapaian</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div className="text-center p-2.5 sm:p-3 bg-[#DCEEFF] rounded-lg sm:rounded-xl border border-[#b3d9ff]">
                      <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-[#FFD65A] mx-auto mb-1.5 sm:mb-2" />
                      <p className="font-semibold text-xs sm:text-sm">Speedster</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">Selesaikan 10 service</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-3 bg-[#DCEEFF] rounded-lg sm:rounded-xl border border-[#b3d9ff]">
                      <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-[#4DB2FF] mx-auto mb-1.5 sm:mb-2" />
                      <p className="font-semibold text-xs sm:text-sm">Quality Expert</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">95% approval rate</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-3 bg-[#e6faf2] rounded-lg sm:rounded-xl border border-emerald-100">
                      <Users className="w-6 h-6 sm:w-8 sm:h-8 text-[#3CCF91] mx-auto mb-1.5 sm:mb-2" />
                      <p className="font-semibold text-xs sm:text-sm">Team Player</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">Bantu teknisi lain</p>
                    </div>
                    <div className="text-center p-2.5 sm:p-3 bg-[#fff8e6] rounded-lg sm:rounded-xl border border-[#ffe5a3]">
                      <Star className="w-6 h-6 sm:w-8 sm:h-8 text-[#FFD65A] mx-auto mb-1.5 sm:mb-2 fill-[#FFD65A]/30" />
                      <p className="font-semibold text-xs sm:text-sm">Top Performer</p>
                      <p className="text-[10px] sm:text-[11px] text-slate-500">Rating 5 bintang</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'layanan' && (
              <motion.div
                key="layanan"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-slate-900">Manajemen Transaksi</h3>
                    <p className="text-xs sm:text-sm text-slate-500">Input transaksi layanan customer</p>
                  </div>
                  <button
                    onClick={() => setShowLayananForm(true)}
                    className="bg-[#4DB2FF] text-white font-medium px-4 py-2.5 rounded-full hover:bg-[#3aa0f5] transition-all flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto"
                  >
                    + Tambah Transaksi
                  </button>
                </div>
                <LayananList isAdmin={false} key={refreshLayanan} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Progress Update Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-slate-900 rounded-md sm:rounded-lg flex items-center justify-center">
                  <Wrench className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-900">Update Service</h3>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              <p className="text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4">Service: <span className="font-medium">{selectedService.invoice_number}</span></p>
              <ProgressUpdate
                service={selectedService}
                onUpdate={() => {
                  setSelectedService(null)
                  fetchAllData()
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Attendance Modal */}
      <AttendanceModal
        isOpen={showAttendance}
        onClose={() => setShowAttendance(false)}
        onSuccess={handleAttendanceSuccess}
        type={attendanceType}
        existingAttendance={todayAttendance}
      />

      {/* Layanan Form Modal */}
      {showLayananForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-[24px] shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-200">
            <LayananForm
              onSuccess={handleLayananSuccess}
              onClose={() => setShowLayananForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
