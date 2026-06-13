'use client'

import dynamic from 'next/dynamic'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, ClipboardList, Users, LogOut,
  TrendingUp, Clock, CheckCircle, Menu, X,
  Bell, Search, Settings, User, ChevronRight,
  RefreshCw, Activity, DollarSign, Briefcase,
  Sparkles, Zap, Shield, Star, Crown, Award,
  Sun, Moon, Monitor, Wifi, Battery, Signal,
  ArrowUpRight, ArrowDownRight, MoreVertical
} from 'lucide-react'
import StatCard from '@/components/ui/StatCard'
import GlassCard from '@/components/ui/GlassCard'
import NeonButton from '@/components/ui/NeonButton'
import SearchInput from '@/components/ui/SearchInput'
import AdminAttendanceModal from '@/components/admin/AdminAttendanceModal'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// Dynamic imports with loading states
const RoleManagement = dynamic(() => import('@/components/admin/RoleManagement'), {
  loading: () => <LoadingSpinner text="Loading user management..." />,
  ssr: false
})

const InventoryManagement = dynamic(() => import('@/components/admin/InventoryManagement'), {
  loading: () => <LoadingSpinner text="Loading inventory..." />,
  ssr: false
})

const ServiceInput = dynamic(() => import('@/components/admin/ServiceInput'), {
  loading: () => <LoadingSpinner text="Loading service form..." />,
  ssr: false
})

// Loading component
function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-gray-100 rounded-full animate-spin" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <div className="absolute inset-0 w-16 h-16 border-4 border-purple-500 border-b-transparent rounded-full animate-spin animation-delay-150" />
      </div>
      <p className="text-gray-500 mt-6 font-medium">{text}</p>
      <p className="text-xs text-gray-400 mt-1">Please wait...</p>
    </div>
  )
}

// Activity item component
function ActivityItem({ message, time, type = 'info', icon }: { message: string; time: string; type?: 'info' | 'success' | 'warning'; icon?: React.ReactNode }) {
  const colors = {
    info: 'bg-gradient-to-br from-blue-500 to-blue-600',
    success: 'bg-gradient-to-br from-emerald-500 to-green-600',
    warning: 'bg-gradient-to-br from-amber-500 to-orange-600'
  }

  const icons = {
    info: <Activity className="w-3.5 h-3.5 text-white" />,
    success: <CheckCircle className="w-3.5 h-3.5 text-white" />,
    warning: <Clock className="w-3.5 h-3.5 text-white" />
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 4 }}
      transition={{ duration: 0.2 }}
      className="group flex items-center gap-3 p-3 rounded-xl hover:bg-gradient-to-r hover:from-gray-50 hover:to-transparent transition-all cursor-pointer"
    >
      <div className={`w-8 h-8 rounded-xl ${colors[type]} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}>
        {icon || icons[type]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{message}</p>
        <p className="text-xs text-gray-400 mt-0.5">{time}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
    </motion.div>
  )
}

// Stat card component with gradient
function GradientStatCard({ title, value, icon, gradient, delay = 0, trend }: any) {
  const gradients = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    teal: 'from-teal-500 to-teal-600',
    pink: 'from-pink-500 to-pink-600',
    indigo: 'from-indigo-500 to-indigo-600',
    cyan: 'from-cyan-500 to-cyan-600'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradients[gradient]} opacity-5 rounded-full blur-2xl group-hover:opacity-10 transition-opacity`} />

      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</p>
            <motion.p
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + 0.1 }}
              className="text-2xl font-bold text-gray-800 mt-2"
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </motion.p>
            {trend !== undefined && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(trend)}% from last month
              </div>
            )}
          </div>

          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + 0.15, type: 'spring', stiffness: 200 }}
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradients[gradient]} flex items-center justify-center shadow-lg`}
          >
            {icon}
          </motion.div>
        </div>

        <motion.div
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ delay: delay + 0.2, duration: 0.8 }}
        />
      </div>
    </motion.div>
  )
}

// Quick action card
function QuickActionCard({ title, description, icon, onClick, color }: any) {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    emerald: 'from-emerald-500 to-emerald-600',
    orange: 'from-orange-500 to-orange-600'
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="relative group overflow-hidden bg-white rounded-xl p-4 text-left shadow-md hover:shadow-xl transition-all duration-300"
    >
      <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
      <div className="relative flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center shadow-md flex-shrink-0`}>
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-800 text-sm">{title}</h4>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
      </div>
    </motion.button>
  )
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalServices: 0,
    totalInventory: 0,
    pendingServices: 0,
    completedToday: 0,
    inProgressServices: 0,
    revenue: 0,
    revenueGrowth: 0
  })
  const [todayAttendance, setTodayAttendance] = useState<any>(null)
  const [showAttendance, setShowAttendance] = useState(false)
  const [attendanceType, setAttendanceType] = useState<'check_in' | 'check_out'>('check_in')
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const supabase = createClient()
  const { user, logout } = useAuthStore()
  const router = useRouter()
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
        fetchStats(),
        fetchRecentActivities(),
        checkTodayAttendance()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
      if (!silent) toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    const [
      users, services, inventory, pending,
      completed, inProgress, revenue
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }),
      supabase.from('inventory').select('*', { count: 'exact', head: true }),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', today),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }).in('status', ['assigned', 'in_progress']),
      supabase.from('service_orders').select('final_cost').eq('status', 'completed').gte('completed_at', startOfMonth),
    ])

    const totalRevenue = (revenue.data || []).reduce((sum, item) => sum + (item.final_cost || 0), 0)
    const lastMonthRevenue = totalRevenue * 0.85

    setStats({
      totalUsers: users.count || 0,
      totalServices: services.count || 0,
      totalInventory: inventory.count || 0,
      pendingServices: pending.count || 0,
      completedToday: completed.count || 0,
      inProgressServices: inProgress.count || 0,
      revenue: totalRevenue,
      revenueGrowth: totalRevenue > 0 ? ((totalRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0
    })
  }

  const fetchRecentActivities = async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) {
      const formatted = data.map(log => ({
        id: log.id,
        message: `${log.profiles?.full_name || 'System'} ${log.action.replace(/_/g, ' ').toLowerCase()}`,
        time: getRelativeTime(log.created_at),
        type: log.action.includes('APPROVED') ? 'success' : log.action.includes('REJECTED') ? 'warning' : 'info'
      }))
      setRecentActivities(formatted)
    }
  }

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
    logout()
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
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview & statistics', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'services', label: 'New Service', icon: ClipboardList, description: 'Create service order', gradient: 'from-emerald-500 to-teal-500' },
    { id: 'users', label: 'User Management', icon: Users, description: 'Manage users & roles', gradient: 'from-purple-500 to-pink-500' },
    { id: 'inventory', label: 'Inventory', icon: Package, description: 'Manage stock', gradient: 'from-orange-500 to-red-500' },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/50 flex items-center justify-center">
        <LoadingSpinner text="Loading dashboard..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse animation-delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl opacity-5 animate-pulse animation-delay-2000" />
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
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      ServiceMS
                    </h1>
                    <p className="text-[10px] text-gray-400">Admin Panel v2.0</p>
                  </div>
                </div>
                {isMobile && (
                  <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                )}
              </div>

              {/* User Profile */}
              <div className="mt-5 flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-gray-800 truncate">{user?.full_name}</p>
                  <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
                </div>
                <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
                  <Crown className="w-3.5 h-3.5 text-amber-500" />
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
                      ? 'bg-gradient-to-r from-blue-50 to-purple-50 shadow-sm'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                    activeTab === item.id
                      ? `bg-gradient-to-br ${item.gradient} shadow-md`
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
                      className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"
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
                      <Zap className="w-4 h-4" />
                      Check In
                    </>
                  ) : todayAttendance.check_out ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Completed
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4" />
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
                  <span>Secure Connection</span>
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
              <div className="relative">
                <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <Bell className="w-4 h-4 text-gray-500" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gradient-to-r from-rose-500 to-pink-500 rounded-full animate-pulse" />
                </button>
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <Settings className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        </motion.header>

        {/* Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {/* Welcome Banner */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-6 p-4 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl text-white shadow-xl"
                >
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <Star className="w-6 h-6 text-yellow-300" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Welcome back, {user?.full_name?.split(' ')[0]}!</h3>
                        <p className="text-white/80 text-sm">Here's what's happening with your service center today.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm">
                      <Award className="w-4 h-4" />
                      <span>Admin Access</span>
                    </div>
                  </div>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <GradientStatCard
                    title="Total Users"
                    value={stats.totalUsers}
                    icon={<Users className="w-5 h-5 text-white" />}
                    gradient="blue"
                    delay={0}
                    trend={8.2}
                  />
                  <GradientStatCard
                    title="Total Services"
                    value={stats.totalServices}
                    icon={<Briefcase className="w-5 h-5 text-white" />}
                    gradient="emerald"
                    delay={0.05}
                    trend={12.5}
                  />
                  <GradientStatCard
                    title="Inventory Items"
                    value={stats.totalInventory}
                    icon={<Package className="w-5 h-5 text-white" />}
                    gradient="purple"
                    delay={0.1}
                    trend={-3.2}
                  />
                  <GradientStatCard
                    title="Revenue"
                    value={`Rp ${(stats.revenue / 1000000).toFixed(1)}M`}
                    icon={<DollarSign className="w-5 h-5 text-white" />}
                    gradient="orange"
                    delay={0.15}
                    trend={stats.revenueGrowth}
                  />
                </div>

                {/* Second Row Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <GradientStatCard
                    title="Pending Services"
                    value={stats.pendingServices}
                    icon={<Clock className="w-5 h-5 text-white" />}
                    gradient="amber"
                    delay={0.2}
                  />
                  <GradientStatCard
                    title="In Progress"
                    value={stats.inProgressServices}
                    icon={<Activity className="w-5 h-5 text-white" />}
                    gradient="indigo"
                    delay={0.25}
                  />
                  <GradientStatCard
                    title="Completed Today"
                    value={stats.completedToday}
                    icon={<CheckCircle className="w-5 h-5 text-white" />}
                    gradient="teal"
                    delay={0.3}
                  />
                  <GradientStatCard
                    title="Active Users"
                    value={Math.floor(stats.totalUsers * 0.75)}
                    icon={<Users className="w-5 h-5 text-white" />}
                    gradient="pink"
                    delay={0.35}
                    trend={5.2}
                  />
                </div>

                {/* Bottom Section */}
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Recent Activity - Takes 2 columns */}
                  <div className="lg:col-span-2">
                    <GlassCard className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
                            <Activity className="w-4 h-4 text-white" />
                          </div>
                          <h3 className="font-semibold text-gray-800">Recent Activity</h3>
                        </div>
                        <button className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors">
                          View All
                        </button>
                      </div>
                      <div className="space-y-1 max-h-[400px] overflow-y-auto">
                        {recentActivities.map((activity, i) => (
                          <ActivityItem
                            key={activity.id}
                            message={activity.message}
                            time={activity.time}
                            type={activity.type}
                          />
                        ))}
                        {recentActivities.length === 0 && (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                              <Activity className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="text-sm text-gray-400">No recent activities</p>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <GlassCard className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                          <Zap className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="font-semibold text-gray-800">Quick Actions</h3>
                      </div>
                      <div className="space-y-3">
                        <QuickActionCard
                          title="New Service Order"
                          description="Create a new service request"
                          icon={<ClipboardList className="w-4 h-4 text-white" />}
                          color="blue"
                          onClick={() => setActiveTab('services')}
                        />
                        <QuickActionCard
                          title="Add New User"
                          description="Invite team members"
                          icon={<Users className="w-4 h-4 text-white" />}
                          color="purple"
                          onClick={() => setActiveTab('users')}
                        />
                        <QuickActionCard
                          title="Update Inventory"
                          description="Manage stock levels"
                          icon={<Package className="w-4 h-4 text-white" />}
                          color="emerald"
                          onClick={() => setActiveTab('inventory')}
                        />
                        <QuickActionCard
                          title="Generate Report"
                          description="Export performance data"
                          icon={<TrendingUp className="w-4 h-4 text-white" />}
                          color="orange"
                          onClick={() => {}}
                        />
                      </div>

                      {/* System Status */}
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between text-xs mb-2">
                          <span className="text-gray-500">System Health</span>
                          <span className="text-emerald-600 font-medium">98.5%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="w-[98.5%] h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full" />
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                          <span>Uptime: 99.9%</span>
                          <span>Response: 124ms</span>
                          <span>Errors: 0</span>
                        </div>
                      </div>
                    </GlassCard>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'services' && (
              <motion.div
                key="services"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Suspense fallback={<LoadingSpinner text="Loading service form..." />}>
                  <ServiceInput />
                </Suspense>
              </motion.div>
            )}

            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Suspense fallback={<LoadingSpinner text="Loading user management..." />}>
                  <RoleManagement />
                </Suspense>
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Suspense fallback={<LoadingSpinner text="Loading inventory..." />}>
                  <InventoryManagement />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Attendance Modal */}
      <AdminAttendanceModal
        isOpen={showAttendance}
        onClose={() => setShowAttendance(false)}
        onSuccess={handleAttendanceSuccess}
        type={attendanceType}
        existingAttendance={todayAttendance}
      />
    </div>
  )
}
