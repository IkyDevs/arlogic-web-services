'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LogOut, User, ClipboardCheck, Clock,
  Menu, X, Watch, Bell, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import QCSidebar from '@/components/qc/QCSidebar'
import QCStats from '@/components/qc/QCStats'
import QCServiceList from '@/components/qc/QCServiceList'
import QCReviewModal from '@/components/qc/QCReviewModal'

export default function QCDashboard() {
  const [activeTab, setActiveTab] = useState('all')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [services, setServices] = useState<any[]>([])
  const [filteredServices, setFilteredServices] = useState<any[]>([])
  const [teknisiList, setTeknisiList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  const supabase = createClient()
  const { user, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    fetchServices()
    fetchTeknisiList()
  }, [])

  const fetchTeknisiList = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('role', 'teknisi')
      .order('full_name')

    if (data) {
      const names = data.map(t => t.full_name).filter(Boolean) as string[]
      setTeknisiList(names)
    }
  }

  const fetchServices = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('service_orders')
      .select('*')
      .eq('status', 'qc_pending')
      .order('created_at', { ascending: false })

    if (data) {
      setServices(data)
      setFilteredServices(data)
    }
    setLoading(false)
  }

  const filterByTeknisi = (teknisiName: string) => {
    if (teknisiName === 'all') {
      setFilteredServices(services)
      setActiveTab('all')
    } else {
      const filtered = services.filter(s => s.teknisi_name === teknisiName)
      setFilteredServices(filtered)
      setActiveTab(teknisiName)
    }
  }

  const viewServiceDetails = (service: any) => {
    setSelectedService(service)
    setShowDetailModal(true)
  }

  const handleReviewComplete = () => {
    setShowDetailModal(false)
    setSelectedService(null)
    fetchServices()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    logout()
    router.push('/login')
    toast.success('Logged out')
  }

  const menuItems = [
    { id: 'all', label: 'Semua', icon: ClipboardCheck },
  ]

  teknisiList.forEach(name => {
    menuItems.push({
      id: name,
      label: name,
      icon: User
    })
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#E94560] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Sidebar */}
      <QCSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuItems={menuItems}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          if (tabId === 'all') {
            filterByTeknisi('all')
          } else {
            filterByTeknisi(tabId)
          }
          setSidebarOpen(false)
        }}
        services={services}
        user={user}
        onLogout={handleLogout}
      />

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden bg-white p-2 rounded-lg shadow-sm border border-[#E9ECEF]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-[#E9ECEF] z-20">
          <div className="px-6 py-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A2E]">QC Dashboard</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeTab === 'all' ? 'Semua service' : `Teknisi: ${activeTab}`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={fetchServices} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
              <div className="bg-[#E94560] px-3 py-1 rounded-full text-white text-xs font-medium">
                QC
              </div>
            </div>
          </div>
        </header>

        {/* Stats */}
        <QCStats services={services} filteredServices={filteredServices} teknisiList={teknisiList} />

        {/* Service List */}
        <div className="px-6 pb-6">
          <QCServiceList
            services={filteredServices}
            onViewDetails={viewServiceDetails}
          />
        </div>
      </div>

      {/* Review Modal */}
      {showDetailModal && selectedService && (
        <QCReviewModal
          service={selectedService}
          onClose={() => setShowDetailModal(false)}
          onComplete={handleReviewComplete}
          reviewerId={user?.id}
          reviewerName={user?.full_name}
        />
      )}
    </div>
  )
}
