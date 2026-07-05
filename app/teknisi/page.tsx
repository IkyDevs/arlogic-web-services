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

// Dynamic imports
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

  useEffect(() => {
    if (todayAttendance === null && !loading) {
      const now = new Date()
      const hours = now.getHours()
      const minutes = now.getMinutes()
      const currentTime = hours * 60 + minutes
      const deadline = 11 * 60

      if (currentTime >= deadline) {
        setAttendanceType('check_in')
        setShowAttendance(true)
      }
    }
  }, [todayAttendance, loading])

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
    { id: 'queue', label: 'Antrean & Proyek', icon: ClipboardList, description: 'Lihat dan ambil proyek' },
    { id: 'stats', label: 'Performa', icon: TrendingUp, description: 'Lihat statistik Anda' },
    { id: 'layanan', label: 'Transaksi', icon: FileText, description: 'Input transaksi layanan' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-slate-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ==================== SIDEBAR ==================== */}
      <div className={`sidebar-container fixed left-0 top-0 h-full w-64 bg-white border-r border-slate-200 z-40 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Watch<span className="text-blue-600">Service</span></h1>
                <p className="text-[10px] text-slate-400">Teknisi Panel</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
            <div className="w-9 h-9 bg-slate-900 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.full_name?.charAt(0) || 'T'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user?.full_name}</p>
              <p className="text-xs text-slate-400 truncate">{user?.teknisi_name || user?.full_name}</p>
            </div>
          </div>

          {/* Attendance Status */}
          <div className={`mt-3 p-2 rounded-lg ${attendanceStatus.bg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span>{attendanceStatus.icon}</span>
                <span className={attendanceStatus.color}>{attendanceStatus.text}</span>
              </div>
              <span className="text-[10px] text-slate-400">Teknisi</span>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-0.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id)
                setSidebarOpen(false)
              }}
              className={`w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-lg transition-all ${
                activeTab === item.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-900 hover:bg-slate-100'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}

          <div className="pt-2 mt-2 border-t border-slate-200 space-y-2">
            {/* Attendance Button */}
            <button
              onClick={() => handleAttendance(todayAttendance && !todayAttendance.check_out ? 'check_out' : 'check_in')}
              disabled={!!todayAttendance?.check_out}
              className={`w-full py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                !todayAttendance
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : todayAttendance.check_out
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
            >
              {!todayAttendance ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Check In
                </>
              ) : todayAttendance.check_out ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Completed
                </>
              ) : (
                <>
                  <LogOutIcon className="w-4 h-4" />
                  Check Out
                </>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-lg text-blue-600 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </button>
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 text-center">
          <p className="text-[10px] text-slate-400">Watch Service v2.0</p>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden bg-white p-2 rounded-lg shadow-sm border border-slate-200"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-200 z-20">
          <div className="px-6 py-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{menuItems.find(m => m.id === activeTab)?.label}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <div className="relative hidden sm:block sparepart-search-container">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={sparepartSearch}
                  onChange={(e) => setSparepartSearch(e.target.value)}
                  onFocus={() => sparepartResults.length > 0 && setShowSparepartResults(true)}
                  placeholder="Cari sparepart..."
                  className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 w-48"
                />
                {showSparepartResults && (
                  <div className="absolute top-full mt-1 right-0 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    {sparepartSearching ? (
                      <div className="p-3 text-center text-sm text-slate-400">Mencari...</div>
                    ) : sparepartResults.length === 0 ? (
                      <div className="p-3 text-center text-sm text-slate-400">Tidak tersedia</div>
                    ) : (
                      sparepartResults.map((item) => (
                        <div key={item.id} className="p-3 border-b border-slate-200 last:border-0 hover:bg-slate-50">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-slate-900">{item.item_name}</p>
                              <p className="text-xs text-slate-400">SKU: {item.sku}</p>
                              <p className="text-xs text-slate-500">Kategori: {item.category || 'Uncategorized'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-bold text-emerald-600">Toko: {item.store_stock}</p>
                              <p className="text-xs font-bold text-blue-600">Gudang: {item.warehouse_stock}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button onClick={() => fetchAllData(true)} className={`p-2 hover:bg-slate-100 rounded-lg transition-all ${refreshing ? 'animate-spin' : ''}`}>
                <RefreshCw className="w-4 h-4 text-slate-400" />
              </button>
              <button onClick={() => toast('Notifikasi belum tersedia', { icon: '??' })} className="relative p-2 hover:bg-slate-100 rounded-lg transition-all">
                <Bell className="w-4 h-4 text-slate-400" />
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-600 rounded-full" />
              </button>
              <div className="bg-blue-600 px-3 py-1 rounded-full text-white text-xs font-medium">
                TEKNISI
              </div>
            </div>
          </div>
        </header>

        {/* ==================== CONTENT ==================== */}
        <main className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'queue' && (
              <motion.div
                key="queue"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="stat-card">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Selesai Hari Ini</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-slate-900">{stats.completedToday}</p>
                      <CheckCircle className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Sedang Dikerjakan</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-slate-900">{stats.inProgress}</p>
                      <Wrench className="w-6 h-6 text-amber-500" />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Antrean</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-slate-900">{stats.pendingQueue}</p>
                      <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pendapatan Bulan Ini</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xl font-bold text-blue-600">{formatRupiah(stats.totalEarnings)}</p>
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </div>

                {/* Queue List Component */}
                <QueueList
                  teknisiId={user?.id || ''}
                  onTakeProject={(service) => setSelectedService(service)}
                />

                {/* Recent Activity */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-6 h-6 bg-slate-900 rounded-lg flex items-center justify-center">
                      <Activity className="w-3 h-3 text-white" />
                    </div>
                    <h3 className="font-semibold text-slate-900">Aktivitas Terbaru</h3>
                  </div>
                  <div className="space-y-2">
                    {recentActivities.map((activity, i) => (
                      <div key={activity.id} className="flex items-center gap-3 p-2 border-b border-slate-200 last:border-0">
                        <div className="w-2 h-2 bg-blue-600 rounded-full" />
                        <div className="flex-1">
                          <p className="text-sm text-slate-700">{activity.message}</p>
                          <p className="text-xs text-slate-400">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                    {recentActivities.length === 0 && (
                      <div className="text-center py-6 text-slate-400">
                        <p className="text-sm">Belum ada aktivitas</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid md:grid-cols-2 gap-6"
              >
                {/* Performance Stats */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-5 pb-2 border-b border-slate-200">
                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Metrik Performa</h3>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-slate-600">Completion Rate</span>
                        <span className="text-[#2ECC71]">94%</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="w-[94%] h-full bg-emerald-600 rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-slate-600">Rata-rata Waktu Service</span>
                        <span className="text-emerald-600">{stats.averageTime} hari</span>
                      </div>
                      <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className="w-[75%] h-full bg-amber-500 rounded-full" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-slate-600">Rating Customer</span>
                        <span className="text-blue-600">{stats.rating} / 5.0</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-5 h-5 ${
                              star <= Math.floor(stats.rating)
                                ? 'fill-[#F1C40F] text-[#F1C40F]'
                                : star - 0.5 <= stats.rating
                                ? 'fill-[#F1C40F]/50 text-[#F1C40F]'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex justify-between items-center">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-slate-900">{stats.completedThisMonth}</p>
                          <p className="text-[10px] text-slate-400 uppercase">Service Bulan Ini</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-blue-600">{formatRupiah(stats.totalEarnings)}</p>
                          <p className="text-[10px] text-slate-400 uppercase">Pendapatan</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-[#2ECC71]">100%</p>
                          <p className="text-[10px] text-slate-400 uppercase">Kehadiran</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Badges & Achievements */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-5 pb-2 border-b border-slate-200">
                    <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center">
                      <Award className="w-4 h-4 text-slate-900" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Pencapaian</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <Zap className="w-8 h-8 text-[#F1C40F] mx-auto mb-2" />
                      <p className="font-semibold text-sm">Speedster</p>
                      <p className="text-[10px] text-slate-400">Selesaikan 10 service</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <Shield className="w-8 h-8 text-[#3498DB] mx-auto mb-2" />
                      <p className="font-semibold text-sm">Quality Expert</p>
                      <p className="text-[10px] text-slate-400">95% approval rate</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <Users className="w-8 h-8 text-[#2ECC71] mx-auto mb-2" />
                      <p className="font-semibold text-sm">Team Player</p>
                      <p className="text-[10px] text-slate-400">Bantu teknisi lain</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <Star className="w-8 h-8 text-blue-600 mx-auto mb-2 fill-blue-600/30" />
                      <p className="font-semibold text-sm">Top Performer</p>
                      <p className="text-[10px] text-slate-400">Rating 5 bintang</p>
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
                <div className="mb-5 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Manajemen Transaksi</h3>
                    <p className="text-sm text-slate-500">Input transaksi layanan customer</p>
                  </div>
                  <button
                    onClick={() => setShowLayananForm(true)}
                    className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 text-sm"
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Update Service</h3>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-sm text-slate-500 mb-4">Service: <span className="font-medium">{selectedService.invoice_number}</span></p>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-200">
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

