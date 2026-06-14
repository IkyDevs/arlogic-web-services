'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LogOut, User, ClipboardCheck, CheckCircle, XCircle, Clock,
  TrendingUp, BarChart3, Calendar, Menu, X, Watch
} from 'lucide-react'
import QCReviewList from '@/components/qc/QCReviewList'
import NotificationBell from '@/components/ui/NotificationBell'
import toast from 'react-hot-toast'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

type ActiveTab = 'reviews' | 'stats'

export default function QCDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('reviews')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [stats, setStats] = useState({
    pending: 0,
    approvedToday: 0,
    rejectedToday: 0,
    approvalRate: 0,
    weeklyData: [] as { day: string; approved: number; rejected: number }[]
  })
  const { user } = useAuthStore()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]

    const [pending, approved, rejected, weeklyApproved, weeklyRejected] = await Promise.all([
      supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('status', 'qc_pending'),
      supabase.from('qc_reviews').select('*', { count: 'exact', head: true }).eq('status', 'approved').gte('created_at', today),
      supabase.from('qc_reviews').select('*', { count: 'exact', head: true }).eq('status', 'rejected').gte('created_at', today),
      supabase.from('qc_reviews').select('created_at').eq('status', 'approved').gte('created_at', subDays(new Date(), 7).toISOString()),
      supabase.from('qc_reviews').select('created_at').eq('status', 'rejected').gte('created_at', subDays(new Date(), 7).toISOString()),
    ])

    const approvedCount = approved.count || 0
    const rejectedCount = rejected.count || 0
    const total = approvedCount + rejectedCount
    const approvalRate = total > 0 ? Math.round((approvedCount / total) * 100) : 0

    // Build weekly chart data
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i)
      return format(date, 'EEE')
    })

    const weeklyData = weekDays.map((day, i) => {
      const date = subDays(new Date(), 6 - i)
      const dayStart = startOfDay(date).toISOString()
      const dayEnd = endOfDay(date).toISOString()
      const dayApproved = weeklyApproved.data?.filter(r =>
        r.created_at >= dayStart && r.created_at <= dayEnd
      ).length || 0
      const dayRejected = weeklyRejected.data?.filter(r =>
        r.created_at >= dayStart && r.created_at <= dayEnd
      ).length || 0
      return { day, approved: dayApproved, rejected: dayRejected }
    })

    setStats({
      pending: pending.count || 0,
      approvedToday: approvedCount,
      rejectedToday: rejectedCount,
      approvalRate,
      weeklyData
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Logged out successfully')
  }

  const menuItems = [
    { id: 'reviews' as ActiveTab, label: 'QC REVIEWS', icon: ClipboardCheck, color: 'green' },
    { id: 'stats' as ActiveTab, label: 'STATISTICS', icon: BarChart3, color: 'blue' },
  ]

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white border-2 border-black shadow-[4px_4px_0_0_#000] p-5"
    >
      <div className={`w-10 h-10 ${color} border-2 border-black flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="text-xs font-black uppercase tracking-wide text-gray-600 mb-1">{title}</h3>
      <p className="text-3xl font-black font-mono">{value}</p>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-white border-r-2 border-black z-50 flex flex-col transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="p-5 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-green-600 border-2 border-black flex items-center justify-center">
                <Watch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tighter">QC PANEL</h1>
                <p className="text-[10px] font-mono">Quality Control</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 border border-black">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 p-3 border-2 border-black bg-green-50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-600 border border-black flex items-center justify-center text-white font-black text-sm">
                {user?.full_name?.charAt(0) || 'Q'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm truncate">{user?.full_name}</p>
                <p className="text-[10px] font-mono">Supervisor / QC</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
              className={`w-full text-left px-3 py-2.5 font-black text-sm flex items-center gap-3 border-2 border-black transition-all ${
                activeTab === item.id
                  ? 'bg-green-600 text-white shadow-[3px_3px_0_0_#000]'
                  : 'bg-white text-black hover:bg-green-50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t-2 border-black">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 font-black text-sm flex items-center gap-3 border-2 border-black bg-black text-white hover:bg-gray-800 transition-all"
          >
            <LogOut className="w-4 h-4" />
            LOGOUT
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Top Bar */}
        <div className="sticky top-0 bg-white border-b-2 border-black z-30 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 border-2 border-black bg-green-100"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-xl font-black">
                {menuItems.find(m => m.id === activeTab)?.label}
              </h2>
              <p className="text-xs font-mono">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            {stats.pending > 0 && (
              <span className="px-3 py-1 bg-[#FFDE00] border-2 border-black font-mono font-bold text-xs shadow-[3px_3px_0_0_#000]">
                {stats.pending} PENDING
              </span>
            )}
          </div>
        </div>

        <main className="p-6">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Stats Cards - always shown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              <StatCard title="Pending Review" value={stats.pending} icon={Clock} color="bg-[#FFDE00] !text-black" />
              <StatCard title="Approved Today" value={stats.approvedToday} icon={CheckCircle} color="bg-green-600" />
              <StatCard title="Rejected Today" value={stats.rejectedToday} icon={XCircle} color="bg-red-500" />
              <StatCard title="Approval Rate" value={`${stats.approvalRate}%`} icon={TrendingUp} color="bg-[#3B82F6]" />
            </div>

            {activeTab === 'reviews' && <QCReviewList onReview={fetchStats} />}

            {activeTab === 'stats' && (
              <div className="space-y-6">
                {/* Weekly Chart */}
                <div className="border-2 border-black shadow-[6px_6px_0_0_#000] bg-white p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-[#3B82F6] border-2 border-black flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-black font-mono text-lg">WEEKLY REVIEW ACTIVITY</h3>
                  </div>

                  <div className="flex items-end gap-3 h-40">
                    {stats.weeklyData.map((d, i) => {
                      const max = Math.max(...stats.weeklyData.map(x => x.approved + x.rejected), 1)
                      const totalH = ((d.approved + d.rejected) / max) * 120
                      const approvedH = (d.approved / (d.approved + d.rejected || 1)) * totalH

                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex flex-col justify-end" style={{ height: 120 }}>
                            {totalH > 0 ? (
                              <div className="w-full border-2 border-black overflow-hidden" style={{ height: totalH }}>
                                <div className="w-full bg-green-500" style={{ height: `${(approvedH / totalH) * 100}%` }} />
                                <div className="w-full bg-red-400" style={{ height: `${100 - (approvedH / totalH) * 100}%` }} />
                              </div>
                            ) : (
                              <div className="w-full border-2 border-dashed border-gray-300" style={{ height: 8 }} />
                            )}
                          </div>
                          <span className="text-[10px] font-mono font-bold">{d.day}</span>
                          <span className="text-[9px] font-mono text-gray-500">{d.approved + d.rejected}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center gap-4 mt-4 pt-4 border-t-2 border-black">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-500 border border-black" />
                      <span className="text-xs font-mono font-bold">Approved</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-red-400 border border-black" />
                      <span className="text-xs font-mono font-bold">Rejected</span>
                    </div>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className="border-2 border-black shadow-[6px_6px_0_0_#000] bg-white p-5">
                    <h3 className="font-black font-mono text-sm mb-4 uppercase">Today's Summary</h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Total Reviewed', value: stats.approvedToday + stats.rejectedToday },
                        { label: 'Approved', value: stats.approvedToday, color: 'text-green-600' },
                        { label: 'Rejected', value: stats.rejectedToday, color: 'text-red-600' },
                        { label: 'Approval Rate', value: `${stats.approvalRate}%`, color: 'text-[#3B82F6]' },
                      ].map((item, i) => (
                        <div key={i} className="flex justify-between items-center pb-2 border-b border-gray-200 last:border-0 last:pb-0">
                          <span className="font-mono text-sm">{item.label}</span>
                          <span className={`font-mono font-black ${item.color || ''}`}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-2 border-black shadow-[6px_6px_0_0_#000] bg-[#FFDE00] p-5">
                    <h3 className="font-black font-mono text-sm mb-4 uppercase">Quality Target</h3>
                    <div className="text-center">
                      <div className="text-6xl font-black font-mono mb-2">{stats.approvalRate}%</div>
                      <p className="font-mono text-sm">Current approval rate</p>
                      <div className="mt-4 h-3 bg-black/20 border-2 border-black overflow-hidden">
                        <div
                          className="h-full bg-green-600 transition-all duration-500"
                          style={{ width: `${stats.approvalRate}%` }}
                        />
                      </div>
                      <p className="font-mono text-xs mt-2">Target: 90%+</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
