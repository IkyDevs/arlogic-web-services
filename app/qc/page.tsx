'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  LogOut, User, ClipboardCheck, Clock,
  Menu, X, Watch, Bell, RefreshCw, Search, Package
} from 'lucide-react'
import toast from 'react-hot-toast'
import QCSidebar from '@/components/qc/QCSidebar'
import QCStats from '@/components/qc/QCStats'
import QCServiceList from '@/components/qc/QCServiceList'
import QCReviewModal from '@/components/qc/QCReviewModal'
import ThemeToggle from '@/components/ThemeToggle'

export default function QCDashboard() {
  const [activeTab, setActiveTab] = useState('all')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [services, setServices] = useState<any[]>([])
  const [filteredServices, setFilteredServices] = useState<any[]>([])
  const [teknisiList, setTeknisiList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedService, setSelectedService] = useState<any>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [sparepartSearch, setSparepartSearch] = useState('')
  const [sparepartResults, setSparepartResults] = useState<any[]>([])
  const [sparepartSearching, setSparepartSearching] = useState(false)
  const [showSparepartResults, setShowSparepartResults] = useState(false)

  const supabase = createClient()
  const { user, logout } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    fetchServices()
    fetchTeknisiList()
  }, [])

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
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

      {/* Main Content */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-200 z-20">
          <div className="px-6 py-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">QC Dashboard</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTab === 'all' ? 'Semua service' : `Teknisi: ${activeTab}`}
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
                              <p className="text-xs font-bold text-green-600">Toko: {item.store_stock}</p>
                              <p className="text-xs font-bold text-blue-600">Gudang: {item.warehouse_stock}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button onClick={fetchServices} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
                <RefreshCw className="w-4 h-4 text-slate-400" />
              </button>
              <div className="bg-blue-600 px-3 py-1 rounded-full text-white text-xs font-medium">
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

