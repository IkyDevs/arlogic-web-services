'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, ClipboardList, Users, LogOut,
  Clock, Menu, X, Watch, Zap, Target, TrendingUp,
  CheckCircle, Download, Bell, ShoppingCart, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import LayananForm from '@/components/layanan/LayananForm'
import LayananList from '@/components/layanan/LayananList'

// Dynamic imports
const RoleManagement = dynamic(() => import('@/components/admin/RoleManagement'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white">LOADING...</div>
})
const InventoryManagement = dynamic(() => import('@/components/admin/InventoryManagement'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white">LOADING...</div>
})
const ServiceInput = dynamic(() => import('@/components/admin/ServiceInput'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white">LOADING...</div>
})
const ExportReports = dynamic(() => import('@/components/admin/ExportReports'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white">LOADING...</div>
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
    revenue: 0
  })

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
      revenue: totalRevenue
    })
  }

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false })
      .limit(20)

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

  // ==================== EFFECTS ====================

  useEffect(() => {
    fetchAllData()
  }, [])

  const menuItems = [
    { id: 'overview', label: 'DASHBOARD', icon: LayoutDashboard, color: 'pink' },
    { id: 'services', label: 'NEW SERVICE', icon: ClipboardList, color: 'yellow' },
    { id: 'layanan', label: 'LAYANAN', icon: ShoppingCart, color: 'blue' },
    { id: 'users', label: 'USERS', icon: Users, color: 'pink' },
    { id: 'inventory', label: 'INVENTORY', icon: Package, color: 'yellow' },
    { id: 'export', label: 'EXPORT', icon: Download, color: 'blue' },
  ]

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

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
      <div className={`fixed left-0 top-0 h-full w-72 bg-white border-r-2 border-black z-40 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-5 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#FF6B9D] flex items-center justify-center border-2 border-black">
                <Watch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter">WATCH<span className="text-[#FF6B9D]">SERVICE</span></h1>
                <p className="text-[10px] font-mono">ADMIN PANEL</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 border-2 border-black hover:bg-gray-100">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-5 p-3 border-2 border-black bg-[#F5F5F5]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#3B82F6] flex items-center justify-center text-white font-bold text-sm border-2 border-black">
                {user?.full_name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{user?.full_name}</p>
                <p className="text-[10px] font-mono truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-2">
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
                className={`w-full text-left px-3 py-2 font-bold text-sm flex items-center gap-3 border-2 border-black shadow-[3px_3px_0px_0px_black] transition-all ${
                  activeTab === item.id ? colorClasses[item.color as keyof typeof colorClasses] : 'bg-white text-black hover:translate-x-[1px] hover:translate-y-[1px]'
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
              className="w-full text-left px-3 py-2 font-bold text-sm flex items-center gap-3 border-2 border-black bg-black text-white hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
            >
              <LogOut className="w-4 h-4" />
              LOGOUT
            </button>
          </div>
        </nav>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden bg-[#FFDE00] border-2 border-black shadow-[3px_3px_0px_0px_black] p-2"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Main Content */}
      <div className="lg:ml-72">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-2 border-black z-20">
          <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tighter">{menuItems.find(m => m.id === activeTab)?.label}</h2>
              <p className="text-xs font-mono">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 border-2 border-black hover:bg-gray-100 transition-all"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border border-white rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border-2 border-black shadow-[4px_4px_0px_0px_black] z-50">
                    <div className="p-3 border-b-2 border-black flex justify-between items-center">
                      <span className="font-bold">NOTIFIKASI</span>
                      <button onClick={markAllRead} className="text-xs text-[#3B82F6] hover:underline">
                        Tandai semua dibaca
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
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
                            <p className="text-xs text-gray-600">{notif.message}</p>
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

              <button onClick={fetchAllData} className="p-2 border-2 border-black hover:bg-gray-100">
                <RefreshCw className="w-4 h-4" />
              </button>

              <div className="bg-[#FF6B9D] px-3 py-1 border-2 border-black text-white text-xs font-bold">
                ADMIN ACCESS
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-gray-500">TOTAL USERS</p>
                      <p className="text-3xl font-black">{stats.totalUsers}</p>
                    </div>
                    <Users className="w-8 h-8 text-[#3B82F6]" />
                  </div>
                </div>
                <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-gray-500">WATCHES SERVICED</p>
                      <p className="text-3xl font-black">{stats.totalServices}</p>
                    </div>
                    <Watch className="w-8 h-8 text-[#FF6B9D]" />
                  </div>
                </div>
                <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-gray-500">PENDAPATAN</p>
                      <p className="text-xl font-black text-[#FF6B9D]">{formatRupiah(stats.revenue)}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-[#FFDE00]" />
                  </div>
                </div>
                <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase text-gray-500">PENDING</p>
                      <p className="text-3xl font-black">{stats.pendingServices}</p>
                    </div>
                    <Clock className="w-8 h-8 text-[#FF6B9D]" />
                  </div>
                </div>
              </div>

              {/* Welcome Banner */}
              <div className="bg-[#FFDE00] p-6 border-2 border-black shadow-[6px_6px_0px_0px_black]">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#FF6B9D] flex items-center justify-center border-2 border-black">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black">WELCOME BACK, {user?.full_name?.split(' ')[0]}!</h3>
                      <p className="text-sm font-mono">Manage your watch service center</p>
                    </div>
                  </div>
                  <div className="bg-[#3B82F6] px-4 py-2 border-2 border-black text-white text-sm font-bold">
                    ADMIN ACCESS
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid md:grid-cols-3 gap-5">
                <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-[#FF6B9D] flex items-center justify-center border-2 border-black">
                      <Target className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-black">NEW SERVICE</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('services')}
                    className="w-full bg-[#FF6B9D] text-white font-bold py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                  >
                    + CREATE ORDER
                  </button>
                </div>

                <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-[#FFDE00] flex items-center justify-center border-2 border-black">
                      <Users className="w-4 h-4 text-black" />
                    </div>
                    <h3 className="font-black">USER MGMT</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('users')}
                    className="w-full bg-[#FFDE00] text-black font-bold py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                  >
                    + ADD STAFF
                  </button>
                </div>

                <div className="border-2 border-black bg-white p-5 shadow-[4px_4px_0px_0px_black]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-[#3B82F6] flex items-center justify-center border-2 border-black">
                      <Package className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-black">INVENTORY</h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('inventory')}
                    className="w-full bg-[#3B82F6] text-white font-bold py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                  >
                    + UPDATE PARTS
                  </button>
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
            <motion.div
              key="layanan"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
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
              <LayananList isAdmin={true} key={refreshLayanan} />
            </motion.div>
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
