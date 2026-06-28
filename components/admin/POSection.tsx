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
        for (const admin of admins) {
          await supabase.from('notifications').insert({
            user_id: admin.id,
            title: '⏰ Peringatan: PO Belum Direspon',
            message: `PO untuk ${service.po_sparepart} (${service.invoice_number}) belum direspon. Mohon segera ditindaklanjuti.`,
            type: 'warning',
            link: '/admin',
            is_read: false
          })
        }
      }
      toast.success('Peringatan terkirim ke admin!')
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-yellow-50 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-yellow-600" />
          <h3 className="font-semibold text-slate-900">REQUEST SPAREPART (PO)</h3>
          {poServices.filter(s => s.status !== 'sparepart_ready').length > 0 && (
            <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
              {poServices.filter(s => s.status !== 'sparepart_ready').length} pending
            </span>
          )}
        </div>
        <button onClick={fetchPOData} className="text-xs text-slate-500 hover:text-slate-700">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <div className="inline-block w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : poServices.length === 0 ? (
        <div className="p-6 text-center text-slate-400">
          <Box className="w-12 h-12 mx-auto mb-2 opacity-30" />
          <p>Tidak ada request PO</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {poServices.map((service) => {
            const isReady = service.status === 'sparepart_ready'
            const isRequest = service.status === 'req_sparepart_admin'
            const isApproved = service.status === 'po_pending'

            return (
              <div key={service.id} className={`p-4 transition-all ${isReady ? 'bg-green-50' : 'hover:bg-yellow-50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-medium">{service.invoice_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isReady ? 'bg-green-100 text-green-700' :
                        isRequest ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {isReady ? '✅ Siap Diambil' :
                         isRequest ? 'Request PO' :
                         'PO Approved'}
                      </span>
                    </div>
                    <p className="font-bold text-slate-900">{service.po_sparepart}</p>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-500 mt-1">
                      <span>Teknisi: {service.teknisi_name}</span>
                      <span>•</span>
                      <span>Customer: {service.customer_name}</span>
                    </div>
                    {isRequest && (
                      <div className="mt-2 text-xs text-yellow-600 bg-yellow-50 p-1.5 rounded border border-yellow-200">
                        ⏳ Menunggu respon admin
                      </div>
                    )}
                    {isApproved && service.po_admin_response && (
                      <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-1.5 rounded border border-blue-200">
                        📝 {service.po_admin_response}
                      </div>
                    )}
                    {isReady && (
                      <div className="mt-2 text-xs text-green-600 bg-green-50 p-1.5 rounded border border-green-200">
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
                          className="px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-all"
                        >
                          <CheckCircle className="w-4 h-4 inline mr-1" />
                          READY
                        </button>
                        <button
                          onClick={() => sendReminderToAdmin(service)}
                          className="px-3 py-1.5 bg-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-300 transition-all"
                          title="Kirim peringatan ke admin"
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {isApproved && (
                      <span className="px-3 py-1.5 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Menunggu
                      </span>
                    )}
                    {isReady && (
                      <span className="px-3 py-1.5 bg-green-100 text-green-700 text-sm font-medium rounded-lg">
                        <CheckCircle className="w-4 h-4 inline mr-1" />
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
