'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { LogOut, User, ClipboardCheck, CheckCircle, XCircle, Clock } from 'lucide-react'
import QCReviewList from '@/components/qc/QCReviewList'
import toast from 'react-hot-toast'

export default function QCDashboard() {
  const [stats, setStats] = useState({
    pending: 0,
    approvedToday: 0,
    rejectedToday: 0
  })
  const { user } = useAuthStore()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    const today = new Date().toISOString().split('T')[0]

    const [pending, approved, rejected] = await Promise.all([
      supabase.from('service_orders').select('*', { count: 'exact', head: true }).eq('status', 'qc_pending'),
      supabase.from('qc_reviews').select('*', { count: 'exact', head: true }).eq('status', 'approved').gte('created_at', today),
      supabase.from('qc_reviews').select('*', { count: 'exact', head: true }).eq('status', 'rejected').gte('created_at', today),
    ])

    setStats({
      pending: pending.count || 0,
      approvedToday: approved.count || 0,
      rejectedToday: rejected.count || 0
    })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    toast.success('Logged out successfully')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
            QC Panel
          </h1>
          <div className="mt-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">{user?.full_name}</p>
              <p className="text-xs text-gray-500">Supervisor / QC</p>
            </div>
          </div>
        </div>

        <nav className="mt-6">
          <button className="w-full text-left px-6 py-3 bg-green-50 text-green-600 border-r-4 border-green-600 flex items-center gap-3">
            <ClipboardCheck className="w-5 h-5" />
            <span>QC Reviews</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full text-left px-6 py-3 transition-all flex items-center gap-3 text-red-600 hover:bg-red-50 mt-8"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard
              title="Pending Review"
              value={stats.pending}
              icon={<Clock className="w-6 h-6 text-yellow-600" />}
              color="bg-yellow-100"
            />
            <StatCard
              title="Approved Today"
              value={stats.approvedToday}
              icon={<CheckCircle className="w-6 h-6 text-green-600" />}
              color="bg-green-100"
            />
            <StatCard
              title="Rejected Today"
              value={stats.rejectedToday}
              icon={<XCircle className="w-6 h-6 text-red-600" />}
              color="bg-red-100"
            />
          </div>

          {/* QC Review List */}
          <QCReviewList />
        </motion.div>
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-white rounded-xl shadow-md p-6"
    >
      <div className={`${color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <h3 className="text-gray-600 text-sm">{title}</h3>
      <p className="text-2xl font-bold mt-2">{value}</p>
    </motion.div>
  )
}
