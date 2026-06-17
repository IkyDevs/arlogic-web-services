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
  DollarSign, Star, Activity, Settings, HelpCircle,
  QrCode, Copy, ExternalLink, Trash2, Edit2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import LayananForm from '@/components/layanan/LayananForm'
import LayananList from '@/components/layanan/LayananList'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import QRCodeGenerator from '@/components/admin/QRCodeGenerator'

// Dynamic imports
const RoleManagement = dynamic(() => import('@/components/admin/RoleManagement'), {
  loading: () => <div className="text-center py-8 text-gray-400">Loading...</div>
})
const InventoryManagement = dynamic(() => import('@/components/admin/InventoryManagement'), {
  loading: () => <div className="text-center py-8 text-gray-400">Loading...</div>
})
const ServiceInput = dynamic(() => import('@/components/admin/ServiceInput'), {
  loading: () => <div className="text-center py-8 text-gray-400">Loading...</div>
})
const ExportReports = dynamic(() => import('@/components/admin/ExportReports'), {
  loading: () => <div className="text-center py-8 text-gray-400">Loading...</div>
})

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showLayananForm, setShowLayananForm] = useState(false)
  const [refreshLayanan, setRefreshLayanan] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [showQRModal, setShowQRModal] = useState(false)

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
  const isMobile = useMediaQuery('(max-width: 768px)')

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
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)

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
    toast.success('All notifications marked as read')
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
    toast.success('Transaction added successfully!')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
    router.push('/login')
    toast.success('Logged out')
  }

  const openQRModal = (service: any) => {
    setSelectedService(service)
    setShowQRModal(true)
  }

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token)
    toast.success('Token copied!')
  }

  const markTokenExpired = async (serviceId: string) => {
    const { error } = await supabase
      .from('service_orders')
      .update({ token_expires_at: new Date().toISOString() })
      .eq('id', serviceId)

    if (error) {
      toast.error('Failed to disable token')
    } else {
      toast.success('Token disabled! Customer can no longer track.')
      fetchRecentServices()
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(nominal)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const menuItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'services', label: 'New Service', icon: ClipboardList },
    { id: 'layanan', label: 'Transactions', icon: ShoppingCart },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'export', label: 'Reports', icon: Download },
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#E94560] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ==================== OVERLAY MOBILE ==================== */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ==================== SIDEBAR ==================== */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-[#E9ECEF] z-40 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 overflow-y-auto`}>
        <div className="p-4 border-b border-[#E9ECEF]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-[#1A1A2E] rounded-lg flex items-center justify-center">
                <Watch className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#1A1A2E]">Watch<span className="text-[#E94560]">Service</span></h1>
                <p className="text-[10px] text-gray-400">Management System</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 p-2.5 bg-[#FAFAFA] rounded-lg">
            <div className="w-9 h-9 bg-[#1A1A2E] rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.full_name?.charAt(0) || 'A'}
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
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}

          <div className="pt-4 mt-4 border-t border-[#E9ECEF]">
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-lg text-[#E94560] hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#E9ECEF] text-center">
          <p className="text-[10px] text-gray-400">Watch Service v2.0</p>
        </div>
      </div>

      {/* ==================== MOBILE MENU BUTTON ==================== */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden bg-white p-2 rounded-lg shadow-sm border border-[#E9ECEF]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-[#E9ECEF] z-20">
          <div className="px-6 py-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A2E]">{menuItems.find(m => m.id === activeTab)?.label}</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={fetchAllData} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <Bell className="w-4 h-4 text-gray-400" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E94560] text-white text-[9px] font-bold flex items-center justify-center rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-[#E9ECEF] z-50">
                    <div className="p-3 border-b border-[#E9ECEF] flex justify-between items-center">
                      <span className="font-medium text-sm">Notifications</span>
                      <button onClick={markAllRead} className="text-xs text-[#E94560] hover:underline">
                        Mark all read
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-400">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No notifications</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-3 border-b border-[#E9ECEF] cursor-pointer hover:bg-gray-50 ${!notif.is_read ? 'bg-blue-50' : ''}`}
                            onClick={() => markNotificationRead(notif.id)}
                          >
                            <p className="text-sm font-medium">{notif.title}</p>
                            <p className="text-xs text-gray-500 line-clamp-2">{notif.message}</p>
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

              <div className="bg-[#E94560] px-3 py-1 rounded-full text-white text-xs font-medium">
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
              <div className="bg-white rounded-xl border border-[#E9ECEF] p-5 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#1A1A2E]">Welcome back, {user?.full_name?.split(' ')[0]}! 👋</h3>
                    <p className="text-sm text-gray-500 mt-0.5">Manage your watch service center efficiently.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-[#FAFAFA] px-4 py-2 rounded-lg text-sm font-medium border border-[#E9ECEF]">
                      <span className="mr-2">📅</span> {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-[#E9ECEF] p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Services</span>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">+{stats.revenueGrowth}%</span>
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">{stats.totalServices}</p>
                </div>

                <div className="bg-white rounded-xl border border-[#E9ECEF] p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Revenue</span>
                  </div>
                  <p className="text-2xl font-bold text-[#E94560]">{formatRupiah(stats.revenue)}</p>
                </div>

                <div className="bg-white rounded-xl border border-[#E9ECEF] p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Users</span>
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">{stats.totalUsers}</p>
                </div>

                <div className="bg-white rounded-xl border border-[#E9ECEF] p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Rating</span>
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">{stats.avgRating} / 5</p>
                </div>
              </div>

              {/* Service List with QR & Token */}
              <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#E9ECEF] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-[#E94560]" />
                    <h3 className="font-semibold text-[#1A1A2E]">Service List</h3>
                    <span className="bg-[#E94560] text-white text-xs px-2 py-0.5 rounded-full">{recentServices.length}</span>
                  </div>
                  <button onClick={() => setActiveTab('services')} className="text-sm text-[#E94560] hover:underline font-medium">
                    + New Service
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Invoice</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Device</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Token & QR</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9ECEF]">
                      {recentServices.map((service) => (
                        <tr key={service.id} className="hover:bg-[#FAFAFA] transition-all">
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm font-medium">{service.invoice_number}</span>
                            <p className="text-xs text-gray-400">{formatDate(service.created_at)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-sm">{service.customer_name}</p>
                            <p className="text-xs text-gray-400">{service.customer_phone}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm">{service.watch_brand || service.device_brand}</p>
                            <p className="text-xs text-gray-400">{service.watch_model || service.device_model}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`badge ${
                              service.status === 'pending' ? 'badge-warning' :
                              service.status === 'completed' ? 'badge-success' :
                              service.status === 'in_progress' ? 'badge-info' :
                              'badge-neutral'
                            }`}>
                              {service.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openQRModal(service)}
                                className="p-1.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#0F3460] transition-all"
                                title="View QR Code"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => copyToken(service.token)}
                                className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                                title="Copy Token"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <span className="text-xs font-mono text-gray-500 truncate max-w-[60px]">
                                {service.token}
                              </span>
                              {service.token_expires_at && new Date(service.token_expires_at) < new Date() && (
                                <span className="text-xs text-red-500 font-medium">Expired</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {!service.token_expires_at || new Date(service.token_expires_at) > new Date() ? (
                              <button
                                onClick={() => markTokenExpired(service.id)}
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                              >
                                Disable Token
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">Token Disabled</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {recentServices.length === 0 && (
                  <div className="p-8 text-center text-gray-400">
                    <Watch className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>No services yet</p>
                    <button onClick={() => setActiveTab('services')} className="text-[#E94560] hover:underline text-sm mt-1">
                      Create new service
                    </button>
                  </div>
                )}
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
              <div className="mb-5 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-[#1A1A2E]">Transactions</h3>
                  <p className="text-sm text-gray-500">Manage customer transactions</p>
                </div>
                <button
                  onClick={() => setShowLayananForm(true)}
                  className="bg-[#E94560] text-white font-medium px-4 py-2 rounded-lg hover:bg-[#c73d54] transition-all flex items-center gap-2 text-sm"
                >
                  + New Transaction
                </button>
              </div>
              <LayananList isAdmin={true} key={refreshLayanan} />
            </div>
          )}
        </main>
      </div>

      {/* QR Code Generator Modal */}
      {showQRModal && selectedService && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <QRCodeGenerator
            invoiceNumber={selectedService.invoice_number}
            token={selectedService.token}
            customerName={selectedService.customer_name}
            customerPhone={selectedService.customer_phone}
            onClose={() => {
              setShowQRModal(false)
              setSelectedService(null)
            }}
          />
        </div>
      )}

      {/* Layanan Form Modal */}
      {showLayananForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <LayananForm
            onSuccess={handleLayananSuccess}
            onClose={() => setShowLayananForm(false)}
          />
        </div>
      )}
    </div>
  )
}
