'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Package, ClipboardList, Users, LogOut,
  Clock, Menu, X, Watch, Zap, Target, TrendingUp,
  CheckCircle, AlertCircle, Download, Bell,
  ShoppingCart, RefreshCw, Eye, Calendar,
  DollarSign, Star, Activity, Settings, HelpCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import LayananForm from '@/components/layanan/LayananForm'
import LayananList from '@/components/layanan/LayananList'

// Dynamic imports
const RoleManagement = dynamic(() => import('@/components/admin/RoleManagement'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white animate-pulse">LOADING...</div>
})
const InventoryManagement = dynamic(() => import('@/components/admin/InventoryManagement'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white animate-pulse">LOADING...</div>
})
const ServiceInput = dynamic(() => import('@/components/admin/ServiceInput'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white animate-pulse">LOADING...</div>
})
const ExportReports = dynamic(() => import('@/components/admin/ExportReports'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white animate-pulse">LOADING...</div>
})

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showLayananForm, setShowLayananForm] = useState(false)
  const [refreshLayanan, setRefreshLayanan] = useState(0)
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalServices: 0,
    totalInventory: 0,
    pendingServices: 0,
    completedToday: 0,
    revenue: 0,
    revenueGrowth: 12.5,
    avgRating: 4.8
  })

  const [recentServices, setRecentServices] = useState<any[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const supabase = createClient()
  const { user, logout } = useAuthStore()
  const router = useRouter()

  // ==================== FETCH FUNCTIONS ====================

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]

    const [users, services, inventory, pending, completed, revenue] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }),
      supabase.from('inventory').select('*', { count: 'exact', head: true }),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('status', 'completed').gte('completed_at', today),
      supabase.from('service_orders').select('final_cost').eq('status', 'completed'),
    ])

    const totalRevenue = (revenue.data || []).reduce((sum: number, item: any) => sum + (item.final_cost || 0), 0)

    setStats({
      totalUsers: users.count || 0,
      totalServices: services.count || 0,
      totalInventory: inventory.count || 0,
      pendingServices: pending.count || 0,
      completedToday: completed.count || 0,
      revenue: totalRevenue,
      revenueGrowth: 12.5,
      avgRating: 4.8
    })
  }

  const fetchRecentServices = async () => {
    const { data } = await supabase
      .from('service_orders')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(5)

    if (data) setRecentServices(data)
  }

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(10)

    if (data) {
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.is_read).length)
    }
  }

  const markNotificationRead = async (id: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    setNotifications(prev => prev.map(n =>
      n.id === id ? { ...n, is_read: true } : n
    ))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user?.id)
      .eq('is_read', false)

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
    toast.success('Semua notifikasi ditandai dibaca')
  }

  const fetchAllData = async () => {
    setLoading(true)
    try {
      await Promise.all([
        fetchStats(),
        fetchRecentServices(),
        fetchNotifications()
      ])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLayananSuccess = () => {
    setShowLayananForm(false)
    setRefreshLayanan(prev => prev + 1)
    toast.success('Layanan berhasil ditambahkan!')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
    router.push('/login')
    toast.success('Logged out')
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  const menuItems = [
    { id: 'overview', label: 'BERANDA', icon: LayoutDashboard, color: 'pink' },
    { id: 'services', label: 'SERVICE BARU', icon: ClipboardList, color: 'yellow' },
    { id: 'layanan', label: 'TRANSAKSI', icon: ShoppingCart, color: 'blue' },
    { id: 'users', label: 'PENGGUNA', icon: Users, color: 'pink' },
    { id: 'inventory', label: 'INVENTORI', icon: Package, color: 'yellow' },
    { id: 'export', label: 'LAPORAN', icon: Download, color: 'blue' },
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
    <div className="min-h-screen bg-[#F5F5F5]">
      {/* ==================== SIDEBAR ==================== */}
      <div className={`fixed left-0 top-0 h-full w-72 bg-white border-r-2 border-black z-40 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="p-5 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#FF6B9D] flex items-center justify-center border-2 border-black">
                <Watch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter">WATCH<span className="text-[#FF6B9D]">SERVICE</span></h1>
                <p className="text-[10px] font-mono">MANAGEMENT SYSTEM</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 border-2 border-black">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile */}
          <div className="mt-5 p-3 border-2 border-black bg-[#F5F5F5]">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#3B82F6] flex items-center justify-center text-white font-bold text-lg border-2 border-black">
                {user?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{user?.full_name}</p>
                <p className="text-[10px] font-mono truncate text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {menuItems.map((item) => {
            const colorClasses = {
              pink: 'bg-[#FF6B9D] text-white',
              yellow: 'bg-[#FFDE00] text-black',
              blue: 'bg-[#3B82F6] text-white'
            }
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id)
                  setSidebarOpen(false)
                }}
                className={`w-full text-left px-3 py-3 font-bold text-sm flex items-center gap-3 border-2 border-black transition-all ${
                  activeTab === item.id
                    ? colorClasses[item.color as keyof typeof colorClasses]
                    : 'bg-white text-black hover:bg-gray-100 hover:translate-x-[1px] hover:translate-y-[1px]'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            )
          })}

          <div className="pt-6 mt-6 border-t-2 border-black">
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-3 font-bold text-sm flex items-center gap-3 border-2 border-black bg-black text-white hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
            >
              <LogOut className="w-4 h-4" />
              KELUAR
            </button>
          </div>
        </nav>

        {/* Version */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t-2 border-black text-center">
          <p className="text-[10px] font-mono text-gray-400">WATCH SERVICE v2.0 | ADMIN</p>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden bg-[#FFDE00] border-2 border-black shadow-[3px_3px_0px_0px_black] p-2"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="lg:ml-72">
        {/* Header */}
        <header className="sticky top-0 bg-white border-b-2 border-black z-20">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tighter">{menuItems.find(m => m.id === activeTab)?.label}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 bg-[#FF6B9D] rounded-full animate-pulse" />
                <p className="text-xs font-mono text-gray-500">
                  {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Refresh Button */}
              <button onClick={fetchAllData} className="p-2 border-2 border-black hover:bg-gray-100 transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 border-2 border-black hover:bg-gray-100 transition-all"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border border-white rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border-2 border-black shadow-[4px_4px_0px_0px_black] z-50">
                    <div className="p-3 border-b-2 border-black flex justify-between items-center">
                      <span className="font-bold text-sm">NOTIFIKASI</span>
                      <button onClick={markAllRead} className="text-xs text-[#3B82F6] hover:underline">
                        Baca semua
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-400">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Tidak ada notifikasi</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-3 border-b border-black cursor-pointer hover:bg-gray-50 ${!notif.is_read ? 'bg-yellow-50' : ''}`}
                            onClick={() => markNotificationRead(notif.id)}
                          >
                            <p className="text-sm font-bold">{notif.title}</p>
                            <p className="text-xs text-gray-600 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(notif.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Badge */}
              <div className="bg-[#FF6B9D] px-3 py-1 border-2 border-black text-white text-xs font-bold">
                ADMIN
              </div>
            </div>
          </div>
        </header>

        {/* ==================== CONTENT AREA ==================== */}
        <main className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Welcome Banner */}
              <div className="bg-gradient-to-r from-[#FF6B9D] to-[#FFDE00] p-6 border-2 border-black shadow-[6px_6px_0px_0px_black]">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-white">Halo, {user?.full_name?.split(' ')[0]}! 👋</h3>
                    <p className="text-white/90 text-sm mt-1">Selamat datang di dashboard admin. Kelola service center Anda dengan mudah.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-white/20 backdrop-blur px-4 py-2 border-2 border-white text-white text-sm font-bold">
                      <span className="mr-2">📅</span> {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid - 4 column layout */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Card 1 - Total Service */}
                <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_black] hover:translate-y-[-2px] transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-[#FF6B9D]/20 flex items-center justify-center border border-[#FF6B9D]">
                      <Watch className="w-5 h-5 text-[#FF6B9D]" />
                    </div>
                    <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-0.5 border border-green-200">+{stats.revenueGrowth}%</span>
                  </div>
                  <p className="text-2xl font-black">{stats.totalServices}</p>
                  <p className="text-xs text-gray-500 mt-1">TOTAL SERVICE</p>
                </div>

                {/* Card 2 - Pendapatan */}
                <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_black] hover:translate-y-[-2px] transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-[#FFDE00]/20 flex items-center justify-center border border-[#FFDE00]">
                      <DollarSign className="w-5 h-5 text-[#FFDE00]" />
                    </div>
                  </div>
                  <p className="text-2xl font-black text-[#FF6B9D]">{formatRupiah(stats.revenue)}</p>
                  <p className="text-xs text-gray-500 mt-1">PENDAPATAN</p>
                </div>

                {/* Card 3 - Pengguna */}
                <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_black] hover:translate-y-[-2px] transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-[#3B82F6]/20 flex items-center justify-center border border-[#3B82F6]">
                      <Users className="w-5 h-5 text-[#3B82F6]" />
                    </div>
                  </div>
                  <p className="text-2xl font-black">{stats.totalUsers}</p>
                  <p className="text-xs text-gray-500 mt-1">PENGGUNA AKTIF</p>
                </div>

                {/* Card 4 - Rating */}
                <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_0px_black] hover:translate-y-[-2px] transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 bg-[#4A6B5A]/20 flex items-center justify-center border border-[#4A6B5A]">
                      <Star className="w-5 h-5 text-[#4A6B5A]" />
                    </div>
                  </div>
                  <p className="text-2xl font-black">{stats.avgRating} / 5</p>
                  <p className="text-xs text-gray-500 mt-1">RATING CUSTOMER</p>
                </div>
              </div>

              {/* Second Row Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">PENDING</p>
                      <p className="text-xl font-black">{stats.pendingServices}</p>
                    </div>
                    <Clock className="w-6 h-6 text-orange-500" />
                  </div>
                </div>
                <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">SELESAI HARI INI</p>
                      <p className="text-xl font-black">{stats.completedToday}</p>
                    </div>
                    <CheckCircle className="w-6 h-6 text-green-500" />
                  </div>
                </div>
                <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">INVENTORI</p>
                      <p className="text-xl font-black">{stats.totalInventory}</p>
                    </div>
                    <Package className="w-6 h-6 text-purple-500" />
                  </div>
                </div>
                <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-500">RATA-RATA SERVICE</p>
                      <p className="text-xl font-black">2.5 hari</p>
                    </div>
                    <Activity className="w-6 h-6 text-blue-500" />
                  </div>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Recent Services */}
                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_black]">
                  <div className="p-4 border-b-2 border-black flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-5 h-5 text-[#FF6B9D]" />
                      <h3 className="font-black">SERVICE TERBARU</h3>
                    </div>
                    <button className="text-xs text-[#3B82F6] hover:underline">Lihat semua</button>
                  </div>
                  <div className="divide-y-2 divide-black">
                    {recentServices.map((service) => (
                      <div key={service.id} className="p-4 hover:bg-gray-50 transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-mono text-xs text-gray-500">{service.invoice_number}</p>
                            <p className="font-bold">{service.customer_name}</p>
                            <p className="text-xs text-gray-500">{service.watch_brand || service.device_brand} {service.watch_model}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 border ${
                            service.status === 'pending' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                            service.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' :
                            'bg-blue-100 text-blue-700 border-blue-200'
                          }`}>
                            {service.status}
                          </span>
                        </div>
                      </div>
                    ))}
                    {recentServices.length === 0 && (
                      <div className="p-8 text-center text-gray-400">Belum ada service</div>
                    )}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_black]">
                  <div className="p-4 border-b-2 border-black">
                    <div className="flex items-center gap-2">
                      <Zap className="w-5 h-5 text-[#FFDE00]" />
                      <h3 className="font-black">AKSI CEPAT</h3>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <button
                      onClick={() => setActiveTab('services')}
                      className="w-full bg-[#FF6B9D] text-white font-bold py-3 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2"
                    >
                      <ClipboardList className="w-4 h-4" />
                      + SERVICE BARU
                    </button>
                    <button
                      onClick={() => setActiveTab('users')}
                      className="w-full bg-[#FFDE00] text-black font-bold py-3 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      + TAMBAH PENGGUNA
                    </button>
                    <button
                      onClick={() => setActiveTab('inventory')}
                      className="w-full bg-[#3B82F6] text-white font-bold py-3 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2"
                    >
                      <Package className="w-4 h-4" />
                      + TAMBAH STOCK
                    </button>
                    <button
                      onClick={() => setShowLayananForm(true)}
                      className="w-full bg-white text-black font-bold py-3 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      + TRANSAKSI LAYANAN
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'services' && <ServiceInput />}
          {activeTab === 'users' && <RoleManagement />}
          {activeTab === 'inventory' && <InventoryManagement />}
          {activeTab === 'export' && <ExportReports />}

          {/* Layanan Tab */}
          {activeTab === 'layanan' && (
            <div>
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black">MANAJEMEN TRANSAKSI</h3>
                  <p className="text-xs font-mono text-gray-500">Input dan kelola transaksi layanan customer</p>
                </div>
                <button
                  onClick={() => setShowLayananForm(true)}
                  className="bg-[#FF6B9D] text-white font-bold px-4 py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2"
                >
                  + TAMBAH TRANSAKSI
                </button>
              </div>
              <LayananList isAdmin={true} key={refreshLayanan} />
            </div>
          )}
        </main>
      </div>

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
