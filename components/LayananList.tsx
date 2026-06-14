'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Layanan, jenisLayananLabels, metodePembayaranLabels, leadSourceLabels } from '@/types'
import { motion } from 'framer-motion'
import {
  Search, Filter, Download, Eye,
  CheckCircle, XCircle, Calendar, User, Phone,
  Tag, DollarSign, FileText, Trash2, Image as ImageIcon,
  ChevronDown, ChevronUp, Printer, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'

interface LayananListProps {
  isAdmin?: boolean
  onEdit?: (layanan: Layanan) => void
}

export default function LayananList({ isAdmin = false, onEdit }: LayananListProps) {
  const [layanan, setLayanan] = useState<Layanan[]>([])
  const [filteredLayanan, setFilteredLayanan] = useState<Layanan[]>([])
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
    toast.success('Data berhasil di-refresh')
  }

  const calculateTotal = (data: Layanan[]) => {
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
      toast.error('Gagal update status')
    } else {
      toast.success(`Status berhasil diupdate menjadi ${status === 'completed' ? 'SELESAI' : 'BATAL'}`)
      fetchLayanan()
    }
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'active':
        return <span className="inline-flex items-center gap-1 bg-[#FFDE00] text-black px-2 py-0.5 text-xs font-bold border border-black">🟡 AKTIF</span>
      case 'completed':
        return <span className="inline-flex items-center gap-1 bg-[#3B82F6] text-white px-2 py-0.5 text-xs font-bold border border-black">✅ SELESAI</span>
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 bg-[#FF6B9D] text-white px-2 py-0.5 text-xs font-bold border border-black">❌ BATAL</span>
      default:
        return null
    }
  }

  const getJenisLayananStyle = (jenis: string) => {
    const styles: Record<string, string> = {
      ambil_jam_service: 'bg-pink-100 text-pink-700 border-pink-200',
      order_online: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      beli_jam: 'bg-blue-100 text-blue-700 border-blue-200',
      pengeluaran: 'bg-red-100 text-red-700 border-red-200',
      dp_service: 'bg-purple-100 text-purple-700 border-purple-200',
      service_langsung: 'bg-green-100 text-green-700 border-green-200'
    }
    return styles[jenis] || 'bg-gray-100 text-gray-700 border-gray-200'
  }

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(nominal)
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const exportToCSV = () => {
    const headers = ['Tanggal', 'Customer', 'WhatsApp', 'Jenis Layanan', 'Handled By', 'Metode Bayar', 'Lead Source', 'Detail SKU', 'Nominal', 'Status', 'Catatan']
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
      item.status === 'active' ? 'AKTIF' : item.status === 'completed' ? 'SELESAI' : 'BATAL',
      item.notes || '-'
    ])

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `layanan_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Export CSV berhasil!')
  }

  const resetFilters = () => {
    setSearchQuery('')
    setFilterJenis('')
    setFilterStatus('')
    setFilterMetode('')
    setStartDate('')
    setEndDate('')
    toast.info('Filter direset')
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
      <div className="border-2 border-black bg-white p-8 text-center">
        <div className="inline-block w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 font-mono">LOADING DATA...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
          <p className="text-xs font-black uppercase text-gray-500">Total Transaksi</p>
          <p className="text-2xl font-black">{filteredLayanan.length}</p>
        </div>
        <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
          <p className="text-xs font-black uppercase text-gray-500">Total Nominal</p>
          <p className="text-2xl font-black text-[#FF6B9D]">{formatRupiah(totalNominal)}</p>
        </div>
        <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
          <p className="text-xs font-black uppercase text-gray-500">Aktif</p>
          <p className="text-2xl font-black text-[#FFDE00]">{layanan.filter(l => l.status === 'active').length}</p>
        </div>
        <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
          <p className="text-xs font-black uppercase text-gray-500">Selesai</p>
          <p className="text-2xl font-black text-[#3B82F6]">{layanan.filter(l => l.status === 'completed').length}</p>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black]">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-black uppercase mb-1">CARI</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                placeholder="Nama / WA / SKU..."
              />
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="bg-[#FFDE00] text-black font-bold px-4 py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            FILTER
            {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            onClick={exportToCSV}
            className="bg-[#3B82F6] text-white font-bold px-4 py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            EXPORT
          </button>

          <button
            onClick={refreshData}
            disabled={refreshing}
            className="bg-white text-black font-bold px-4 py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t-2 border-black grid grid-cols-2 md:grid-cols-5 gap-3"
          >
            <div>
              <label className="block text-xs font-black uppercase mb-1">JENIS LAYANAN</label>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black font-mono bg-white"
              >
                <option value="">Semua</option>
                {jenisLayananOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">STATUS</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black font-mono bg-white"
              >
                <option value="">Semua</option>
                <option value="active">Aktif</option>
                <option value="completed">Selesai</option>
                <option value="cancelled">Batal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">METODE BAYAR</label>
              <select
                value={filterMetode}
                onChange={(e) => setFilterMetode(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black font-mono bg-white"
              >
                <option value="">Semua</option>
                {metodePembayaranOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">DARI TANGGAL</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">SAMPAI TANGGAL</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border-2 border-black font-mono"
              />
            </div>
            <div className="col-span-2 md:col-span-5 flex justify-end">
              <button
                onClick={resetFilters}
                className="text-sm text-[#FF6B9D] font-bold hover:underline"
              >
                Reset Filter
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto border-2 border-black bg-white">
        <table className="w-full min-w-[1200px]">
          <thead className="bg-black text-white">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-bold">TGL</th>
              <th className="px-3 py-3 text-left text-xs font-bold">CUSTOMER</th>
              <th className="px-3 py-3 text-left text-xs font-bold">JENIS</th>
              <th className="px-3 py-3 text-left text-xs font-bold">HANDLED BY</th>
              <th className="px-3 py-3 text-left text-xs font-bold">METODE</th>
              <th className="px-3 py-3 text-left text-xs font-bold">LEAD</th>
              <th className="px-3 py-3 text-left text-xs font-bold">NOMINAL</th>
              <th className="px-3 py-3 text-left text-xs font-bold">FOTO</th>
              <th className="px-3 py-3 text-left text-xs font-bold">STATUS</th>
              {isAdmin && <th className="px-3 py-3 text-left text-xs font-bold">AKSI</th>}
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-black">
            {filteredLayanan.map((item, index) => (
              <motion.tr
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="hover:bg-gray-50"
              >
                <td className="px-3 py-3 text-xs font-mono">
                  {new Date(item.created_at).toLocaleDateString('id-ID')}
                  <br />
                  <span className="text-[10px] text-gray-400">
                    {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                 </td>
                <td className="px-3 py-3">
                  <div>
                    <p className="font-bold text-sm">{item.customer_name}</p>
                    <p className="text-xs font-mono text-gray-500">{item.customer_whatsapp}</p>
                    {item.detail_sku && (
                      <p className="text-[10px] font-mono text-gray-400 mt-1">SKU: {item.detail_sku}</p>
                    )}
                  </div>
                 </td>
                <td className="px-3 py-3">
                  <span className={`inline-block px-2 py-1 text-xs font-bold border ${getJenisLayananStyle(item.jenis_layanan)}`}>
                    {jenisLayananLabels[item.jenis_layanan]}
                  </span>
                 </td>
                <td className="px-3 py-3 text-sm font-mono">{item.handled_by_name || '-'}</td>
                <td className="px-3 py-3 text-sm">{metodePembayaranLabels[item.metode_pembayaran]}</td>
                <td className="px-3 py-3 text-xs">
                  {item.lead_source === 'tulis_sendiri' ? item.lead_source_custom : leadSourceLabels[item.lead_source]}
                 </td>
                <td className="px-3 py-3 font-bold text-[#FF6B9D] whitespace-nowrap">
                  {formatRupiah(item.nominal)}
                 </td>
                <td className="px-3 py-3">
                  {item.photo_url ? (
                    <button
                      onClick={() => setSelectedPhoto(item.photo_url)}
                      className="p-1.5 bg-[#3B82F6] text-white border-2 border-black hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                      title="Lihat Foto"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                 </td>
                <td className="px-3 py-3">{getStatusBadge(item.status)}</td>
                {isAdmin && (
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      {item.status === 'active' && (
                        <>
                          <button
                            onClick={() => updateStatus(item.id, 'completed')}
                            className="p-1.5 bg-[#3B82F6] text-white border-2 border-black hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                            title="Selesaikan"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => updateStatus(item.id, 'cancelled')}
                            className="p-1.5 bg-[#FF6B9D] text-white border-2 border-black hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                            title="Batalkan"
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

        {filteredLayanan.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block p-4 border-2 border-black mb-3">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="font-mono text-gray-500">Tidak ada data layanan</p>
            <p className="text-xs text-gray-400 mt-1">Silakan tambahkan layanan baru</p>
          </div>
        )}
      </div>

      {/* Footer Summary */}
      {filteredLayanan.length > 0 && (
        <div className="border-2 border-black bg-white p-4 shadow-[4px_4px_0px_0px_black] flex justify-between items-center flex-wrap gap-3">
          <div>
            <p className="text-xs font-black uppercase text-gray-500">Menampilkan</p>
            <p className="font-bold">{filteredLayanan.length} dari {layanan.length} transaksi</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black uppercase text-gray-500">Total Keseluruhan</p>
            <p className="text-2xl font-black text-[#FF6B9D]">{formatRupiah(totalNominal)}</p>
          </div>
        </div>
      )}

      {/* Modal Preview Foto */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="border-4 border-white bg-white">
              <img
                src={selectedPhoto}
                alt="Bukti Transaksi"
                className="w-full max-h-[70vh] object-contain"
              />
              <div className="p-3 border-t-2 border-black flex justify-between items-center">
                <p className="text-xs font-mono">Bukti Transaksi</p>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="bg-black text-white font-bold px-4 py-1 border-2 border-black hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                >
                  TUTUP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
