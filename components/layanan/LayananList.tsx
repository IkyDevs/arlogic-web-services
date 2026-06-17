'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Layanan, jenisLayananLabels, metodePembayaranLabels, leadSourceLabels } from '@/types'
import { motion } from 'framer-motion'
import {
  Search, Filter, Download, Eye,
  CheckCircle, XCircle, Calendar,
  DollarSign, FileText,
  ChevronDown, ChevronUp, RefreshCw,
  Clock, TrendingUp, Users
} from 'lucide-react'
import toast from 'react-hot-toast'

interface LayananListProps {
  isAdmin?: boolean
  onEdit?: (layanan: Layanan) => void
}

interface LayananWithPhoto extends Layanan {
  photo_url?: string
}

export default function LayananList({ isAdmin = false, onEdit }: LayananListProps) {
  const [layanan, setLayanan] = useState<LayananWithPhoto[]>([])
  const [filteredLayanan, setFilteredLayanan] = useState<LayananWithPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterJenis, setFilterJenis] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterMetode, setFilterMetode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [totalNominal, setTotalNominal] = useState(0)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchLayanan()
  }, [])

  useEffect(() => {
    filterLayanan()
  }, [searchQuery, filterJenis, filterStatus, filterMetode, startDate, endDate, layanan])

  const fetchLayanan = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('layanan')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setLayanan(data)
      setFilteredLayanan(data)
      calculateTotal(data)
    }
    setLoading(false)
  }

  const refreshData = async () => {
    setRefreshing(true)
    await fetchLayanan()
    setRefreshing(false)
    toast.success('Data refreshed')
  }

  const calculateTotal = (data: LayananWithPhoto[]) => {
    const total = data.reduce((sum, item) => sum + (item.nominal || 0), 0)
    setTotalNominal(total)
  }

  const filterLayanan = () => {
    let filtered = [...layanan]

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(item =>
        item.customer_name.toLowerCase().includes(query) ||
        item.customer_whatsapp.includes(query) ||
        item.detail_sku?.toLowerCase().includes(query) ||
        item.handled_by_name?.toLowerCase().includes(query)
      )
    }

    if (filterJenis) {
      filtered = filtered.filter(item => item.jenis_layanan === filterJenis)
    }

    if (filterStatus) {
      filtered = filtered.filter(item => item.status === filterStatus)
    }

    if (filterMetode) {
      filtered = filtered.filter(item => item.metode_pembayaran === filterMetode)
    }

    if (startDate) {
      filtered = filtered.filter(item => new Date(item.created_at) >= new Date(startDate))
    }

    if (endDate) {
      filtered = filtered.filter(item => new Date(item.created_at) <= new Date(endDate + 'T23:59:59'))
    }

    setFilteredLayanan(filtered)
    calculateTotal(filtered)
  }

  const updateStatus = async (id: string, status: 'cancelled' | 'completed') => {
    const { error } = await supabase
      .from('layanan')
      .update({ status })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update status')
    } else {
      toast.success(`Status updated to ${status === 'completed' ? 'COMPLETED' : 'CANCELLED'}`)
      fetchLayanan()
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return <span className="badge badge-warning">Active</span>
      case 'completed':
        return <span className="badge badge-success">Completed</span>
      case 'cancelled':
        return <span className="badge badge-danger">Cancelled</span>
      default:
        return <span className="badge badge-neutral">{status}</span>
    }
  }

  const getJenisLayananStyle = (jenis: string) => {
    const styles: Record<string, string> = {
      ambil_jam_service: 'badge-info',
      order_online: 'badge-warning',
      beli_jam: 'badge-success',
      pengeluaran: 'badge-danger',
      dp_service: 'badge-primary',
      service_langsung: 'badge-neutral'
    }
    return styles[jenis] || 'badge-neutral'
  }

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(nominal)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const exportToCSV = () => {
    const headers = ['Date', 'Customer', 'WhatsApp', 'Service Type', 'Handled By', 'Payment Method', 'Lead Source', 'SKU', 'Amount', 'Status', 'Notes']
    const rows = filteredLayanan.map(item => [
      formatDate(item.created_at),
      item.customer_name,
      item.customer_whatsapp,
      jenisLayananLabels[item.jenis_layanan],
      item.handled_by_name,
      metodePembayaranLabels[item.metode_pembayaran],
      item.lead_source === 'tulis_sendiri' ? item.lead_source_custom : leadSourceLabels[item.lead_source],
      item.detail_sku || '-',
      item.nominal,
      item.status === 'active' ? 'ACTIVE' : item.status === 'completed' ? 'COMPLETED' : 'CANCELLED',
      item.notes || '-'
    ])

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('CSV exported!')
  }

  const resetFilters = () => {
    setSearchQuery('')
    setFilterJenis('')
    setFilterStatus('')
    setFilterMetode('')
    setStartDate('')
    setEndDate('')
    toast.success('Filters reset')
  }

  const jenisLayananOptions = [
    { value: 'ambil_jam_service', label: 'Ambil Jam Service' },
    { value: 'order_online', label: 'Order Online' },
    { value: 'beli_jam', label: 'Beli Jam' },
    { value: 'pengeluaran', label: 'Pengeluaran' },
    { value: 'dp_service', label: 'DP Service' },
    { value: 'service_langsung', label: 'Service Langsung' }
  ]

  const metodePembayaranOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'edc_mandiri', label: 'EDC Mandiri' },
    { value: 'tf_bca', label: 'Transfer BCA' },
    { value: 'bri', label: 'BRI' },
    { value: 'kudus', label: 'Kudus' },
    { value: 'edc_bca', label: 'EDC BCA' },
    { value: 'tf_mandiri', label: 'Transfer Mandiri' },
    { value: 'qris', label: 'QRIS' }
  ]

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E9ECEF] p-8 text-center shadow-sm">
        <div className="inline-block w-8 h-8 border-3 border-[#E94560] border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-gray-400 font-medium">Loading data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ==================== STATS CARDS ==================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: Total Transaksi */}
        <div className="bg-white rounded-xl border border-[#E9ECEF] p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total</span>
            <FileText className="w-4 h-4 text-[#1A1A2E] opacity-50" />
          </div>
          <p className="text-2xl font-bold text-[#1A1A2E]">{filteredLayanan.length}</p>
          <p className="text-xs text-gray-400 mt-1">Transaksi</p>
        </div>

        {/* Card 2: Total Amount (Full Width di Mobile) */}
        <div className="bg-gradient-to-br from-[#E94560]/5 to-[#E94560]/10 rounded-xl border border-[#E94560]/20 p-4 shadow-sm hover:shadow-md transition-all col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-[#E94560] uppercase tracking-wider">Total Amount</span>
            <DollarSign className="w-4 h-4 text-[#E94560]" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-[#E94560] truncate">
            {formatRupiah(totalNominal)}
          </p>
          <p className="text-xs text-[#E94560]/60 mt-1">Keseluruhan</p>
        </div>

        {/* Card 3: Active */}
        <div className="bg-white rounded-xl border border-[#E9ECEF] p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Active</span>
            <Clock className="w-4 h-4 text-[#F1C40F] opacity-50" />
          </div>
          <p className="text-2xl font-bold text-[#1A1A2E]">{layanan.filter(l => l.status === 'active').length}</p>
          <p className="text-xs text-gray-400 mt-1">Sedang berjalan</p>
        </div>

        {/* Card 4: Completed */}
        <div className="bg-white rounded-xl border border-[#E9ECEF] p-4 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Completed</span>
            <CheckCircle className="w-4 h-4 text-[#2ECC71] opacity-50" />
          </div>
          <p className="text-2xl font-bold text-[#1A1A2E]">{layanan.filter(l => l.status === 'completed').length}</p>
          <p className="text-xs text-gray-400 mt-1">Selesai</p>
        </div>
      </div>

      {/* ==================== SEARCH & FILTER ==================== */}
      <div className="bg-white rounded-xl border border-[#E9ECEF] p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                placeholder="Name / WA / SKU..."
              />
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-[#1A1A2E] border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2D2D44] transition-all text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white text-[#1A1A2E] border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-[#E9ECEF] grid grid-cols-2 md:grid-cols-5 gap-3"
          >
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Service Type</label>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
              >
                <option value="">All</option>
                {jenisLayananOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">Payment Method</label>
              <select
                value={filterMetode}
                onChange={(e) => setFilterMetode(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
              >
                <option value="">All</option>
                {metodePembayaranOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">From Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5">To Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
              />
            </div>
            <div className="col-span-2 md:col-span-5 flex justify-end">
              <button
                onClick={resetFilters}
                className="text-sm text-[#E94560] hover:underline font-medium"
              >
                Reset Filters
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ==================== TABLE ==================== */}
      <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-[#FAFAFA]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Handled By</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Payment</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Photo</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                {isAdmin && <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9ECEF]">
              {filteredLayanan.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-[#FAFAFA] transition-all"
                >
                  <td className="px-4 py-3 text-xs">
                    <p className="font-medium">{new Date(item.created_at).toLocaleDateString('id-ID')}</p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{item.customer_name}</p>
                    <p className="text-xs text-gray-400">{item.customer_whatsapp}</p>
                    {item.detail_sku && (
                      <p className="text-[10px] text-gray-400 mt-0.5">SKU: {item.detail_sku}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${getJenisLayananStyle(item.jenis_layanan)}`}>
                      {jenisLayananLabels[item.jenis_layanan]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{item.handled_by_name || '-'}</td>
                  <td className="px-4 py-3 text-sm">{metodePembayaranLabels[item.metode_pembayaran]}</td>
                  <td className="px-4 py-3 font-bold text-[#E94560] whitespace-nowrap">
                    {formatRupiah(item.nominal)}
                  </td>
                  <td className="px-4 py-3">
                    {(item as any).photo_url ? (
                      <button
                        onClick={() => setSelectedPhoto((item as any).photo_url)}
                        className="p-1.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#0F3460] transition-all"
                        title="View Photo"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {item.status === 'active' && (
                          <>
                            <button
                              onClick={() => updateStatus(item.id, 'completed')}
                              className="p-1.5 text-[#2ECC71] hover:bg-green-50 rounded-lg transition-all"
                              title="Mark as Completed"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateStatus(item.id, 'cancelled')}
                              className="p-1.5 text-[#E94560] hover:bg-red-50 rounded-lg transition-all"
                              title="Cancel"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLayanan.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-400 font-medium">No transactions found</p>
            <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* ==================== FOOTER ==================== */}
      {filteredLayanan.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E9ECEF] p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-center sm:text-left">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Showing</p>
            <p className="font-medium text-[#1A1A2E]">{filteredLayanan.length} of {layanan.length} transactions</p>
          </div>
          <div className="text-center sm:text-right w-full sm:w-auto">
            <p className="text-xs text-gray-400 uppercase tracking-wider">Total Amount</p>
            <p className="text-xl sm:text-2xl font-bold text-[#E94560]">{formatRupiah(totalNominal)}</p>
          </div>
        </div>
      )}

      {/* ==================== MODAL PREVIEW PHOTO ==================== */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-xl overflow-hidden border border-[#E9ECEF] shadow-xl">
              <img
                src={selectedPhoto}
                alt="Transaction Proof"
                className="w-full max-h-[70vh] object-contain"
              />
              <div className="p-4 border-t border-[#E9ECEF] flex justify-between items-center">
                <p className="text-xs text-gray-400">Transaction Proof</p>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="px-4 py-1.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2D2D44] transition-all text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
