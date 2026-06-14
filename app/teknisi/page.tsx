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
  AlertCircle, FileText, Watch
} from 'lucide-react'
import AttendanceModal from '@/components/teknisi/AttendanceModal'
import QueueList from '@/components/teknisi/QueueList'
import ProgressUpdate from '@/components/teknisi/ProgressUpdate'
import LayananForm from '@/components/layanan/LayananForm'
import LayananList from '@/components/layanan/LayananList'
import toast from 'react-hot-toast'

// Dynamic imports
import dynamic from 'next/dynamic'

const ServiceTimeline = dynamic(() => import('@/components/teknisi/ServiceTimeline'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono">LOADING...</div>
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

  const { user } = useAuthStore()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchAllData()
    const interval = setInterval(() => fetchAllData(true), 30000)
    return () => clearInterval(interval)
  }, [])

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
    if (!todayAttendance) return { text: 'BELUM ABSEN', color: 'text-red-600', bg: 'bg-red-100', icon: '❌' }
    if (!todayAttendance.check_out) return { text: 'SUDAH CHECK IN', color: 'text-yellow-600', bg: 'bg-yellow-100', icon: '✅' }
    return { text: 'SUDAH PULANG', color: 'text-green-600', bg: 'bg-green-100', icon: '✓' }
  }

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  const attendanceStatus = getAttendanceStatus()

  const menuItems = [
    { id: 'queue', label: 'ANTREAN & PROYEK', icon: ClipboardList, description: 'Lihat dan ambil proyek', color: 'pink' },
    { id: 'stats', label: 'PERFORMASI', icon: TrendingUp, description: 'Lihat statistik Anda', color: 'yellow' },
    { id: 'layanan', label: 'LAYANAN', icon: FileText, description: 'Input transaksi layanan', color: 'blue' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-10 h-10 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 font-mono">LOADING DASHBOARD...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-80 bg-white border-r-2 border-black z-40 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-5 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#FF6B9D] flex items-center justify-center border-2 border-black">
                <Wrench className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter">WATCH<span className="text-[#FF6B9D]">SERVICE</span></h1>
                <p className="text-[10px] font-mono">TEKNISI PANEL</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 border-2 border-black">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile */}
          <div className="mt-5 p-3 border-2 border-black bg-[#F5F5F5]">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#3B82F6] flex items-center justify-center text-white font-bold text-sm border-2 border-black">
                {user?.full_name?.charAt(0) || 'T'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{user?.full_name}</p>
                <p className="text-[10px] font-mono truncate">{user?.teknisi_name || user?.full_name}</p>
              </div>
            </div>
          </div>

          {/* Attendance Status */}
          <div className={`mt-3 p-2.5 border-2 border-black ${attendanceStatus.bg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{attendanceStatus.icon}</span>
                <span className={`text-xs font-bold ${attendanceStatus.color}`}>{attendanceStatus.text}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-gray-500">
                <Wifi className="w-3 h-3" />
                <span>ONLINE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-2">
          {menuItems.map((item) => {
            const colorClasses = {
              pink: 'bg-[#FF6B9D] text-white hover:bg-[#ff5588]',
              yellow: 'bg-[#FFDE00] text-black hover:bg-[#e6c800]',
              blue: 'bg-[#3B82F6] text-white hover:bg-[#2563eb]'
            }
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                }}
                className={`w-full text-left px-3 py-2.5 rounded-none font-bold text-sm flex items-center gap-3 border-2 border-black shadow-[3px_3px_0px_0px_black] transition-all ${
                  activeTab === item.id ? colorClasses[item.color as keyof typeof colorClasses] : 'bg-white text-black hover:translate-x-[1px] hover:translate-y-[1px]'
                }`}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <item.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left">
                  <div>{item.label}</div>
                  <div className="text-[9px] opacity-70">{item.description}</div>
                </div>
                {activeTab === item.id && <ChevronRight className="w-4 h-4" />}
              </button>
            )
          })}

          <div className="pt-4 mt-4 border-t-2 border-black space-y-2">
            {/* Attendance Button */}
            <button
              onClick={() => handleAttendance(todayAttendance && !todayAttendance.check_out ? 'check_out' : 'check_in')}
              disabled={!!todayAttendance?.check_out}
              className={`w-full py-2.5 rounded-none font-bold text-sm transition-all flex items-center justify-center gap-2 border-2 border-black shadow-[3px_3px_0px_0px_black] ${
                !todayAttendance
                  ? 'bg-[#FFDE00] text-black hover:translate-x-[1px] hover:translate-y-[1px]'
                  : todayAttendance.check_out
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-[#FF6B9D] text-white hover:translate-x-[1px] hover:translate-y-[1px]'
              }`}
            >
              {!todayAttendance ? (
                <>
                  <LogIn className="w-4 h-4" />
                  CHECK IN
                </>
              ) : todayAttendance.check_out ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  COMPLETED
                </>
              ) : (
                <>
                  <LogOutIcon className="w-4 h-4" />
                  CHECK OUT
                </>
              )}
            </button>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-none font-bold text-sm flex items-center gap-3 border-2 border-black bg-black text-white hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
            >
              <LogOut className="w-4 h-4" />
              LOGOUT
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t-2 border-black">
          <div className="flex items-center justify-between text-[10px] font-mono text-gray-400">
            <div className="flex items-center gap-2">
              <Battery className="w-3 h-3" />
              <span>SYSTEM ONLINE</span>
            </div>
            <div className="flex items-center gap-2">
              <Signal className="w-3 h-3" />
              <span>SECURE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden bg-[#FFDE00] border-2 border-black shadow-[3px_3px_0px_0px_black] p-2"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Main Content */}
      <div className="lg:ml-80">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-2 border-black z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tighter">{menuItems.find(m => m.id === activeTab)?.label}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 bg-[#3B82F6] rounded-full" />
                <p className="text-xs font-mono text-gray-500">
                  {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAllData(true)}
                className={`p-2 border-2 border-black hover:bg-gray-100 transition-all ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="relative p-2 border-2 border-black hover:bg-gray-100 transition-all">
                <Bell className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#FF6B9D] border border-black rounded-full" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
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
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-gray-500">SELESAI HARI INI</p>
                        <p className="text-3xl font-black">{stats.completedToday}</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-[#3B82F6]" />
                    </div>
                  </div>
                  <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-gray-500">SEDANG DIKERJAKAN</p>
                        <p className="text-3xl font-black">{stats.inProgress}</p>
                      </div>
                      <Wrench className="w-8 h-8 text-[#FFDE00]" />
                    </div>
                  </div>
                  <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-gray-500">ANTREAN</p>
                        <p className="text-3xl font-black">{stats.pendingQueue}</p>
                      </div>
                      <Clock className="w-8 h-8 text-[#FF6B9D]" />
                    </div>
                  </div>
                  <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-gray-500">PENDAPATAN BULAN INI</p>
                        <p className="text-xl font-black text-[#FF6B9D]">{formatRupiah(stats.totalEarnings)}</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-[#FF6B9D]" />
                    </div>
                  </div>
                </div>

                {/* Queue List Component */}
                <QueueList
                  teknisiId={user?.id || ''}
                  onTakeProject={(service) => setSelectedService(service)}
                />

                {/* Recent Activity */}
                <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#FF6B9D] flex items-center justify-center border border-black">
                        <Activity className="w-3 h-3 text-white" />
                      </div>
                      <h3 className="font-black">AKTIVITAS TERBARU</h3>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {recentActivities.map((activity, i) => (
                      <div key={activity.id} className="flex items-center gap-3 p-2 border-b border-black last:border-0">
                        <div className="w-2 h-2 bg-[#3B82F6] rounded-full" />
                        <div className="flex-1">
                          <p className="text-sm font-mono">{activity.message}</p>
                          <p className="text-[10px] text-gray-400">{activity.time}</p>
                        </div>
                      </div>
                    ))}
                    {recentActivities.length === 0 && (
                      <div className="text-center py-6 text-gray-400">
                        <p className="text-sm font-mono">Belum ada aktivitas</p>
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
                <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_black]">
                  <div className="flex items-center gap-2 mb-5 pb-2 border-b-2 border-black">
                    <div className="w-8 h-8 bg-[#FF6B9D] flex items-center justify-center border border-black">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-black">METRIK PERFORMASI</h3>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between text-sm font-bold mb-1">
                        <span className="uppercase">Completion Rate</span>
                        <span className="text-[#3B82F6]">94%</span>
                      </div>
                      <div className="h-3 border border-black bg-white">
                        <div className="w-[94%] h-full bg-[#3B82F6]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm font-bold mb-1">
                        <span className="uppercase">Rata-rata Waktu Service</span>
                        <span className="text-[#FFDE00]">{stats.averageTime} hari</span>
                      </div>
                      <div className="h-3 border border-black bg-white">
                        <div className="w-[75%] h-full bg-[#FFDE00]" />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm font-bold mb-1">
                        <span className="uppercase">Rating Customer</span>
                        <span className="text-[#FF6B9D]">{stats.rating} / 5.0</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-5 h-5 ${
                              star <= Math.floor(stats.rating)
                                ? 'fill-[#FFDE00] text-[#FFDE00]'
                                : star - 0.5 <= stats.rating
                                ? 'fill-[#FFDE00]/50 text-[#FFDE00]'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t-2 border-black">
                      <div className="flex justify-between items-center">
                        <div className="text-center">
                          <p className="text-2xl font-black">{stats.completedThisMonth}</p>
                          <p className="text-[10px] font-mono uppercase">Service Bulan Ini</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black text-[#FF6B9D]">{formatRupiah(stats.totalEarnings)}</p>
                          <p className="text-[10px] font-mono uppercase">Pendapatan</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-black">100%</p>
                          <p className="text-[10px] font-mono uppercase">Kehadiran</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Badges & Achievements */}
                <div className="border-2 border-black bg-white p-5 shadow-[6px_6px_0px_0px_black]">
                  <div className="flex items-center gap-2 mb-5 pb-2 border-b-2 border-black">
                    <div className="w-8 h-8 bg-[#FFDE00] flex items-center justify-center border border-black">
                      <Award className="w-4 h-4 text-black" />
                    </div>
                    <h3 className="text-lg font-black">PENCAPAIAN</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 border-2 border-black bg-[#FF6B9D]/10">
                      <Zap className="w-10 h-10 text-[#FFDE00] mx-auto mb-2" />
                      <p className="font-black text-sm">SPEEDSTER</p>
                      <p className="text-[10px] font-mono">Selesaikan 10 service</p>
                    </div>
                    <div className="text-center p-3 border-2 border-black bg-[#3B82F6]/10">
                      <Shield className="w-10 h-10 text-[#3B82F6] mx-auto mb-2" />
                      <p className="font-black text-sm">QUALITY EXPERT</p>
                      <p className="text-[10px] font-mono">95% approval rate</p>
                    </div>
                    <div className="text-center p-3 border-2 border-black bg-[#FFDE00]/10">
                      <Users className="w-10 h-10 text-[#FFDE00] mx-auto mb-2" />
                      <p className="font-black text-sm">TEAM PLAYER</p>
                      <p className="text-[10px] font-mono">Bantu teknisi lain</p>
                    </div>
                    <div className="text-center p-3 border-2 border-black bg-[#FF6B9D]/10">
                      <Star className="w-10 h-10 text-[#FF6B9D] mx-auto mb-2 fill-[#FF6B9D]/30" />
                      <p className="font-black text-sm">TOP PERFORMER</p>
                      <p className="text-[10px] font-mono">Rating 5 bintang</p>
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
                <div className="mb-6 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-black">MANAJEMEN LAYANAN</h3>
                    <p className="text-xs font-mono text-gray-500">Input transaksi layanan customer</p>
                  </div>
                  <button
                    onClick={() => setShowLayananForm(true)}
                    className="bg-[#FF6B9D] text-white font-bold px-4 py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2"
                  >
                    + TAMBAH LAYANAN
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_black] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b-2 border-black sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#3B82F6] flex items-center justify-center border border-black">
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-xl font-black">UPDATE PROGRES</h3>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1 border-2 border-black hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm font-mono mb-4">Service: <span className="font-bold">{selectedService.invoice_number}</span></p>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <LayananForm
            onSuccess={handleLayananSuccess}
            onClose={() => setShowLayananForm(false)}
          />
        </div>
      )}
    </div>
  )
}

// Import missing icon
import { Activity } from 'lucide-react'
