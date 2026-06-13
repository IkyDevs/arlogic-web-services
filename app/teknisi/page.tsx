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
  Bell, Settings, Search, Star, Users, Package
} from 'lucide-react'
import AttendanceModal from '@/components/teknisi/AttendanceModal'
import QueueList from '@/components/teknisi/QueueList'
import ProgressUpdate from '@/components/teknisi/ProgressUpdate'
import GlassCard from '@/components/ui/GlassCard'
import NeonButton from '@/components/ui/NeonButton'
import StatCard from '@/components/ui/StatCard'
import toast from 'react-hot-toast'
import { useMediaQuery } from '@/hooks/useMediaQuery'

export default function TeknisiDashboard() {
  const [activeTab, setActiveTab] = useState('queue')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [showAttendance, setShowAttendance] = useState(false)
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out'>('check_in')
  const [stats, setStats] = useState({
    completedToday: 0,
    completedThisMonth: 0,
    inProgress: 0,
    pendingQueue: 0,
    averageTime: 0,
    rating: 4.8
  })
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const { user } = useAuthStore()
  const router = useRouter()
  const supabase = createClient()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)')

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
      if (!silent) toast.error('Failed to load data')
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
      pendingQueue
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
    ])

    setStats({
      completedToday: completedToday.count || 0,
      completedThisMonth: completedMonth.count || 0,
      inProgress: inProgress.count || 0,
      pendingQueue: pendingQueue.count || 0,
      averageTime: 2.5,
      rating: 4.8
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

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    return past.toLocaleDateString()
  }

  const handleAttendance = (type: 'check_in' | 'check_out') => {
    if (type === 'check_in' && todayAttendance) {
      toast.error('You already checked in today!')
      return
    }
    if (type === 'check_out' && !todayAttendance) {
      toast.error('You need to check in first!')
      return
    }
    if (type === 'check_out' && todayAttendance?.check_out) {
      toast.error('You already checked out today!')
      return
    }

    setAttendanceType(type)
    setShowAttendance(true)
  }

  const handleAttendanceSuccess = () => {
    checkTodayAttendance()
    fetchRecentActivities()
    toast.success(`Attendance ${attendanceType === 'check_in' ? 'check in' : 'check out'} successful!`)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Logged out successfully')
  }

  const getAttendanceStatus = () => {
    if (!todayAttendance) return { text: 'Not Checked In', color: 'text-rose-500', bg: 'bg-rose-50', icon: '⭕' }
    if (!todayAttendance.check_out) return { text: 'Checked In', color: 'text-amber-600', bg: 'bg-amber-50', icon: '✅' }
    return { text: 'Completed', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '✓' }
  }

  const attendanceStatus = getAttendanceStatus()

  const menuItems = [
    { id: 'queue', label: 'Queue & Projects', icon: ClipboardList, description: 'View and take projects' },
    { id: 'stats', label: 'My Performance', icon: TrendingUp, description: 'View your stats' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-gray-200 rounded-full animate-spin" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-gray-500 mt-4">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-1000" />
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {sidebarOpen && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || !isMobile) && (
          <motion.aside
            initial={isMobile ? { x: -320 } : false}
            animate={{ x: 0 }}
            exit={isMobile ? { x: -320 } : false}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed left-0 top-0 h-full bg-white/95 backdrop-blur-sm shadow-2xl z-50 flex flex-col
              ${isMobile ? 'w-80' : isTablet ? 'w-64' : 'w-80'}`}
          >
            {/* Sidebar Header */}
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Wrench className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                      Teknisi Panel
                    </h1>
                    <p className="text-[10px] text-gray-400">Service Management</p>
                  </div>
                </div>
                {isMobile && (
                  <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                )}
              </div>

              {/* User Profile */}
              <div className="mt-5 flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-800 truncate">{user?.full_name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{user?.teknisi_name || user?.full_name}</p>
                </div>
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                </div>
              </div>

              {/* Attendance Status */}
              <div className={`mt-3 p-2.5 rounded-xl ${attendanceStatus.bg} border ${attendanceStatus.bg.replace('50', '100')}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{attendanceStatus.icon}</span>
                    <span className={`text-xs font-medium ${attendanceStatus.color}`}>{attendanceStatus.text}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400">
                    <Wifi className="w-3 h-3" />
                    <span>Online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
              {menuItems.map((item, index) => (
                <motion.button
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => {
                    setActiveTab(item.id)
                    if (isMobile) setSidebarOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group ${
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 shadow-sm'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    activeTab === item.id
                      ? 'bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md'
                      : 'bg-gray-100 group-hover:bg-gray-200'
                  }`}>
                    <item.icon className={`w-4 h-4 ${
                      activeTab === item.id ? 'text-white' : 'text-gray-500'
                    }`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium text-sm ${
                      activeTab === item.id ? 'text-gray-800' : 'text-gray-600'
                    }`}>
                      {item.label}
                    </div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {item.description}
                    </div>
                  </div>
                  {activeTab === item.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full"
                    />
                  )}
                </motion.button>
              ))}

              <div className="border-t border-gray-100 my-3" />

              {/* Attendance Button */}
              <div className="px-1 pt-2">
                <button
                  onClick={() => handleAttendance(todayAttendance && !todayAttendance.check_out ? 'check_out' : 'check_in')}
                  disabled={!!todayAttendance?.check_out}
                  className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    !todayAttendance
                      ? 'bg-gradient-to-r from-emerald-500 to-green-600 hover:shadow-lg text-white'
                      : todayAttendance.check_out
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:shadow-lg text-white'
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
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 text-red-600 hover:bg-red-50 mt-2"
              >
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                  <LogOut className="w-4 h-4" />
                </div>
                <span className="font-medium text-sm">Logout</span>
              </button>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <div className="flex items-center gap-2">
                  <Battery className="w-3 h-3" />
                  <span>System Online</span>
                </div>
                <div className="flex items-center gap-2">
                  <Signal className="w-3 h-3" />
                  <span>Secure</span>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${!isMobile && 'lg:ml-80'}`}>
        {/* Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-white/70 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100/50"
        >
          <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <Menu className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  {menuItems.find(m => m.id === activeTab)?.label}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <p className="text-xs text-gray-500">
                    {new Date().toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAllData(true)}
                className={`p-2 hover:bg-gray-100 rounded-xl transition-all ${refreshing ? 'animate-spin' : ''}`}
              >
                <RefreshCw className="w-4 h-4 text-gray-500" />
              </button>
              <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Bell className="w-4 h-4 text-gray-500" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full animate-pulse" />
              </button>
            </div>
          </div>
        </motion.header>

        {/* Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'queue' && (
              <motion.div
                key="queue"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <StatCard
                    title="Today's Completed"
                    value={stats.completedToday}
                    icon={<CheckCircle className="w-5 h-5 text-emerald-600" />}
                    color="bg-emerald-100"
                    delay={0}
                  />
                  <StatCard
                    title="In Progress"
                    value={stats.inProgress}
                    icon={<Wrench className="w-5 h-5 text-blue-600" />}
                    color="bg-blue-100"
                    delay={0.05}
                  />
                  <StatCard
                    title="Pending Queue"
                    value={stats.pendingQueue}
                    icon={<Clock className="w-5 h-5 text-amber-600" />}
                    color="bg-amber-100"
                    delay={0.1}
                  />
                  <StatCard
                    title="This Month"
                    value={stats.completedThisMonth}
                    icon={<Calendar className="w-5 h-5 text-purple-600" />}
                    color="bg-purple-100"
                    delay={0.15}
                    trend={12.5}
                  />
                </div>

                {/* Queue List Component */}
                <QueueList
                  teknisiId={user?.id || ''}
                  onTakeProject={(service) => setSelectedService(service)}
                />

                {/* Recent Activity */}
                <div className="mt-6">
                  <GlassCard className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-xl flex items-center justify-center">
                          <Activity className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="font-semibold text-gray-800">Recent Activity</h3>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {recentActivities.map((activity, i) => (
                        <motion.div
                          key={activity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          <div className="flex-1">
                            <p className="text-sm text-gray-700">{activity.message}</p>
                            <p className="text-xs text-gray-400">{activity.time}</p>
                          </div>
                        </motion.div>
                      ))}
                      {recentActivities.length === 0 && (
                        <div className="text-center py-6 text-gray-400">
                          <p className="text-sm">No recent activities</p>
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </div>
              </motion.div>
            )}

            {activeTab === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Performance Stats */}
                  <GlassCard className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800">Performance Metrics</h3>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Completion Rate</span>
                          <span className="font-semibold text-gray-800">94%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="w-[94%] h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Average Completion Time</span>
                          <span className="font-semibold text-gray-800">{stats.averageTime} days</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="w-[75%] h-full bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full" />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">Customer Rating</span>
                          <span className="font-semibold text-gray-800">{stats.rating} / 5.0</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= Math.floor(stats.rating)
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : star - 0.5 <= stats.rating
                                  ? 'text-yellow-400 fill-yellow-400 opacity-50'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-800">{stats.completedThisMonth}</p>
                          <p className="text-xs text-gray-500">Services This Month</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-800">0</p>
                          <p className="text-xs text-gray-500">Pending Reviews</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-800">100%</p>
                          <p className="text-xs text-gray-500">Attendance Rate</p>
                        </div>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Badges & Achievements */}
                  <GlassCard className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
                        <Award className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800">Badges & Achievements</h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl">
                        <Zap className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                        <p className="font-semibold text-sm">Speedster</p>
                        <p className="text-xs text-gray-500">Complete 10 services</p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl">
                        <Shield className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                        <p className="font-semibold text-sm">Quality Expert</p>
                        <p className="text-xs text-gray-500">95% approval rate</p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl">
                        <Users className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="font-semibold text-sm">Team Player</p>
                        <p className="text-xs text-gray-500">Help other teknisi</p>
                      </div>
                      <div className="text-center p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl">
                        <Star className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                        <p className="font-semibold text-sm">Top Performer</p>
                        <p className="text-xs text-gray-500">5-star ratings</p>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Progress Update Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-xl font-bold">Update Progress</h3>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Service: {selectedService.invoice_number}</p>
            <ProgressUpdate
              service={selectedService}
              onUpdate={() => {
                setSelectedService(null)
                fetchAllData()
              }}
            />
          </motion.div>
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
    </div>
  )
}

// Import missing icon
import { Activity } from 'lucide-react'
