'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Box, RefreshCw, Bell, CheckCircle, Clock, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import SparepartReadyModal from './SparepartReadyModal'

interface POSectionProps {
  onUpdate?: () => void
}

export default function POSection({ onUpdate }: POSectionProps) {
  const [poServices, setPoServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPO, setSelectedPO] = useState<any>(null)
  const [showReadyModal, setShowReadyModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchPOData()
    const interval = setInterval(fetchPOData, 15000)
    return () => clearInterval(interval)
  }, [])

  const fetchPOData = async () => {
    setLoading(true)
    try {
      const { data } = await supabase
        .from('service_orders')
        .select('*')
        .in('status', ['req_sparepart_admin', 'po_pending', 'sparepart_ready'])
        .order('created_at', { ascending: false })

      if (data) {
        const teknisiIds = data.map(s => s.assigned_teknisi_id).filter(Boolean)
        let teknisiMap = new Map()
        if (teknisiIds.length > 0) {
          const { data: teknisiData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', teknisiIds)
          teknisiData?.forEach(t => teknisiMap.set(t.id, t))
        }

        const enriched = data.map(service => ({
          ...service,
          teknisi_name: teknisiMap.get(service.assigned_teknisi_id)?.full_name || 'Unknown'
        }))

        setPoServices(enriched)
      }
    } catch (error) {
      console.error('Error fetching PO:', error)
    } finally {
      setLoading(false)
    }
  }

  const sendReminderToAdmin = async (service: any) => {
    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')

      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map((admin: any) => ({
            user_id: admin.id,
            title: '⏰ Peringatan: PO Belum Direspon',
            message: `PO untuk ${service.po_sparepart} (${service.invoice_number}) belum direspon. Mohon segera ditindaklanjuti.`,
            type: 'warning',
            link: '/admin',
            is_read: false
          }))
        )
      }
      toast.success('Peringatan terkirim ke admin!')
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  return (
    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-5 border-b border-slate-200 bg-[#DCEEFF] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white/50 rounded-xl flex items-center justify-center">
            <Box className="w-4 h-4 text-[#4DB2FF]" />
          </div>
          <h3 className="font-semibold text-slate-900">REQUEST SPAREPART (PO)</h3>
          {poServices.filter(s => s.status !== 'sparepart_ready').length > 0 && (
            <span className="bg-[#FF5F87] text-white text-xs px-2.5 py-0.5 rounded-full font-medium">
              {poServices.filter(s => s.status !== 'sparepart_ready').length} pending
            </span>
          )}
        </div>
        <button onClick={fetchPOData} className="text-xs text-slate-500 hover:text-slate-700 p-1">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="p-10 text-center">
          <div className="inline-block w-6 h-6 border-2 border-[#4DB2FF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : poServices.length === 0 ? (
        <div className="p-10 text-center text-slate-400">
          <Box className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Tidak ada request PO</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {poServices.map((service) => {
            const isReady = service.status === 'sparepart_ready'
            const isRequest = service.status === 'req_sparepart_admin'
            const isApproved = service.status === 'po_pending'

            return (
              <div key={service.id} className={`p-5 transition-all ${isReady ? 'bg-emerald-50/30' : 'hover:bg-[#DCEEFF]/30'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-mono text-xs font-medium text-slate-600">{service.invoice_number}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        isReady ? 'bg-emerald-100 text-emerald-700' :
                        isRequest ? 'bg-[#FFD65A] text-slate-800' :
                        'bg-[#DCEEFF] text-[#4DB2FF]'
                      }`}>
                        {isReady ? '✅ Siap Diambil' :
                         isRequest ? 'Request PO' :
                         'PO Approved'}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900 text-sm">{service.po_sparepart}</p>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-500 mt-1.5">
                      <span>Teknisi: {service.teknisi_name}</span>
                      <span className="text-slate-300">•</span>
                      <span>Customer: {service.customer_name}</span>
                    </div>
                    {isRequest && (
                      <div className="mt-3 text-xs text-yellow-700 bg-yellow-50 p-2.5 rounded-xl border border-yellow-100">
                        ⏳ Menunggu respon admin
                      </div>
                    )}
                    {isApproved && service.po_admin_response && (
                      <div className="mt-3 text-xs text-[#4DB2FF] bg-[#DCEEFF] p-2.5 rounded-xl border border-[#b3d9ff]">
                        📝 {service.po_admin_response}
                      </div>
                    )}
                    {isReady && (
                      <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-100">
                        ✅ Siap diambil teknisi
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isRequest && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedPO(service)
                            setShowReadyModal(true)
                          }}
                          className="px-4 py-2 bg-[#3CCF91] text-white text-sm font-medium rounded-xl hover:bg-[#2db87d] transition-all"
                        >
                          <CheckCircle className="w-4 h-4 inline mr-1.5" />
                          READY
                        </button>
                        <button
                          onClick={() => sendReminderToAdmin(service)}
                          className="px-3 py-2 bg-white text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 border border-slate-200 transition-all"
                          title="Kirim peringatan ke admin"
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {isApproved && (
                      <span className="px-4 py-2 bg-[#DCEEFF] text-[#4DB2FF] text-sm font-medium rounded-xl">
                        <Clock className="w-4 h-4 inline mr-1.5" />
                        Menunggu
                      </span>
                    )}
                    {isReady && (
                      <span className="px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-medium rounded-xl">
                        <CheckCircle className="w-4 h-4 inline mr-1.5" />
                        Selesai
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sparepart Ready Modal */}
      {selectedPO && (
        <SparepartReadyModal
          isOpen={showReadyModal}
          onClose={() => {
            setShowReadyModal(false)
            setSelectedPO(null)
          }}
          service={selectedPO}
          onSuccess={() => {
            fetchPOData()
            if (onUpdate) onUpdate()
          }}
        />
      )}
    </div>
  )
}
