'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useBranch } from '@/lib/context/BranchContext'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeftRight, ArrowDownLeft, ArrowUpRight, Eye, RotateCcw,
  Loader2, Package, User, Clock, CheckCircle, Search, X, Send
} from 'lucide-react'
import toast from 'react-hot-toast'
import TransferServiceModal from './TransferServiceModal'

interface TransferServiceTabProps {
  onViewDetails?: (service: any) => void
}

export default function TransferServiceTab({ onViewDetails }: TransferServiceTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'incoming' | 'outgoing'>('incoming')
  const [incomingServices, setIncomingServices] = useState<any[]>([])
  const [outgoingServices, setOutgoingServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [returningId, setReturningId] = useState<string | null>(null)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnTarget, setReturnTarget] = useState<any>(null)
  const [returnReason, setReturnReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const supabase = createClient()
  const { user } = useAuthStore()
  const { activeBranchId } = useBranch()

  const fetchTransfers = useCallback(async () => {
    if (!activeBranchId) return
    setLoading(true)

    const { data: incoming } = await supabase
      .from('service_orders')
      .select('*, profiles:assigned_teknisi_id(full_name), branches:branch_id(name)')
      .eq('transferred_to_branch_id', activeBranchId)
      .neq('branch_id', activeBranchId)
      .order('created_at', { ascending: false })

    const { data: outgoing } = await supabase
      .from('service_orders')
      .select('*, profiles:assigned_teknisi_id(full_name), branches:transferred_to_branch_id(name)')
      .eq('branch_id', activeBranchId)
      .not('transferred_to_branch_id', 'is', null)
      .neq('transferred_to_branch_id', activeBranchId)
      .order('created_at', { ascending: false })

    setIncomingServices(incoming || [])
    setOutgoingServices(outgoing || [])
    setLoading(false)
  }, [activeBranchId, supabase])

  useEffect(() => {
    fetchTransfers()
  }, [fetchTransfers])

  const handleReturn = async () => {
    if (!returnTarget || !activeBranchId) return
    setReturningId(returnTarget.id)
    try {
      const res = await fetch('/api/admin/transfer-service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceOrderId: returnTarget.id,
          action: 'return',
          reason: returnReason.trim() || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message)
        setShowReturnModal(false)
        setReturnTarget(null)
        setReturnReason('')
        fetchTransfers()
      } else {
        toast.error(json.error)
      }
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setReturningId(null)
    }
  }

  const formatRupiah = (n: number) => `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(n)}`
  const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })

  const filterBySearch = (services: any[]) => {
    if (!searchQuery.trim()) return services
    const q = searchQuery.toLowerCase()
    return services.filter(s =>
      s.invoice_number?.toLowerCase().includes(q) ||
      s.customer_name?.toLowerCase().includes(q) ||
      s.watch_brand?.toLowerCase().includes(q) ||
      s.device_brand?.toLowerCase().includes(q)
    )
  }

  const currentServices = activeSubTab === 'incoming' ? incomingServices : outgoingServices
  const filteredServices = filterBySearch(currentServices)

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      pending: { label: 'Menunggu', color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
      assigned: { label: 'Ditugaskan', color: 'bg-blue-100 text-blue-700 border border-blue-200' },
      in_progress: { label: 'Dikerjakan', color: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
      completed: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
      qc_pending: { label: 'QC Pending', color: 'bg-orange-100 text-orange-700 border border-orange-200' },
    }
    return badges[status] || { label: status, color: 'bg-gray-100 text-gray-700 border border-gray-200' }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Transfer Service</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari invoice, nama, brand..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button onClick={fetchTransfers} className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors" title="Refresh">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveSubTab('incoming')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeSubTab === 'incoming' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Transfer Masuk
          {incomingServices.length > 0 && (
            <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full">{incomingServices.length}</span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('outgoing')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeSubTab === 'outgoing' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Transfer Keluar
          {outgoingServices.length > 0 && (
            <span className="bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded-full">{outgoingServices.length}</span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
          <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            {searchQuery ? 'Tidak ada hasil pencarian' : activeSubTab === 'incoming' ? 'Tidak ada transfer masuk' : 'Tidak ada transfer keluar'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery ? 'Coba kata kunci lain' : 'Service yang ditransfer akan muncul di sini'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredServices.map((service, idx) => {
              const badge = getStatusBadge(service.status)
              const originBranch = service.branches?.name || '-'
              const teknisiName = service.profiles?.full_name || '-'

              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-300 transition-all flex flex-col"
                >
                  <div className="p-4 flex-1 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {service.invoice_number}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{service.customer_name}</p>
                      <p className="text-xs text-slate-500">{service.customer_phone || '-'}</p>
                    </div>

                    <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                      <span className="font-medium text-slate-700">
                        {service.watch_brand || service.device_brand || '-'}
                      </span>
                      {service.watch_model && <span> {service.watch_model}</span>}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 mt-auto">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {activeSubTab === 'incoming' ? `Dari: ${originBranch}` : `Ke: ${service.branches?.name || '-'}`}
                      </span>
                      <span>{formatDate(service.created_at)}</span>
                    </div>

                    {service.status === 'completed' && activeSubTab === 'incoming' && (
                      <div className="text-xs text-emerald-600 bg-emerald-50 rounded-lg p-2 border border-emerald-200 flex items-center gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Service sudah selesai — siap dikembalikan
                      </div>
                    )}
                  </div>

                  <div className="p-3 border-t border-slate-100 flex gap-2">
                    <button
                      onClick={() => onViewDetails?.(service)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> Detail
                    </button>
                    {activeSubTab === 'incoming' && service.status === 'completed' && (
                      <button
                        onClick={() => { setReturnTarget(service); setShowReturnModal(true) }}
                        disabled={returningId === service.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {returningId === service.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Transfer Balik
                      </button>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {showReturnModal && returnTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowReturnModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900 mb-1">Transfer Balik ke Cabang Asal</h3>
            <p className="text-sm text-slate-500 mb-4">
              Service <span className="font-mono font-semibold">{returnTarget.invoice_number}</span> akan dikembalikan ke cabang asal.
            </p>

            <div className="space-y-3">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Customer</p>
                <p className="text-sm font-medium text-slate-900">{returnTarget.customer_name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan (opsional)</label>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Alasan pengembalian..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowReturnModal(false)} className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
                Batal
              </button>
              <button
                onClick={handleReturn}
                disabled={returningId === returnTarget.id}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {returningId === returnTarget.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Ya, Transfer Balik
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
