'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ServiceOrder } from '@/types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, Clock, Wrench, Calendar, User,
  Watch, Eye, Package, AlertCircle, Phone,
  MessageSquare, ShoppingCart, Truck, Check,
  XCircle, Loader, Send, Camera
} from 'lucide-react'
import ServiceDetailModal from './ServiceDetailModal'
import ServiceTimeline from './ServiceTimeline'

interface QueueListProps {
  teknisiId: string
  onTakeProject: (project: ServiceOrder) => void
}

export default function QueueList({ teknisiId, onTakeProject }: QueueListProps) {
  const [pendingServices, setPendingServices] = useState<ServiceOrder[]>([])
  const [myServices, setMyServices] = useState<ServiceOrder[]>([])
  const [selectedService, setSelectedService] = useState<ServiceOrder | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showTimelineModal, setShowTimelineModal] = useState(false)
  const [showSparepartModal, setShowSparepartModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [whatsappLoading, setWhatsappLoading] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchQueues()

    const subscription = supabase
      .channel('service_orders_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_orders' },
        () => {
          fetchQueues()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [teknisiId])

  const fetchQueues = async () => {
    setLoading(true)

    // Get pending services (available for taking)
    const { data: pending } = await supabase
      .from('service_orders')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    // Get my assigned and in-progress services
    const { data: assigned } = await supabase
      .from('service_orders')
      .select('*')
      .eq('assigned_teknisi_id', teknisiId)
      .in('status', ['assigned', 'in_progress', 'waiting_sparepart'])
      .order('created_at', { ascending: false })

    // Get timeline for each service
    if (assigned) {
      for (const service of assigned) {
        const { data: timeline } = await supabase
          .from('service_timeline')
          .select('*')
          .eq('service_order_id', service.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (timeline && timeline.length > 0) {
          service.last_update = timeline[0]
        }
      }
    }

    if (pending) setPendingServices(pending)
    if (assigned) setMyServices(assigned)
    setLoading(false)
  }

  const takeProject = async (service: ServiceOrder) => {
    const { error } = await supabase
      .from('service_orders')
      .update({
        assigned_teknisi_id: teknisiId,
        status: 'assigned',
        start_date: new Date().toISOString()
      })
      .eq('id', service.id)

    if (error) {
      toast.error('Gagal mengambil proyek')
    } else {
      // Add to timeline
      await supabase.from('service_timeline').insert({
        service_order_id: service.id,
        teknisi_id: teknisiId,
        status: 'assigned',
        message: `Service diambil oleh teknisi`,
        details: { action: 'take_project' }
      })

      // Send notification to customer (via WhatsApp simulation)
      await sendWhatsAppNotification(service.customer_phone, service.customer_name, service.invoice_number)

      toast.success('Proyek berhasil diambil!')
      fetchQueues()
      onTakeProject(service)
      setShowDetailModal(false)
    }
  }

  const sendWhatsAppNotification = async (phone: string, name: string, invoice: string) => {
    // Format phone number
    let formattedPhone = phone.replace(/\D/g, '')
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.substring(1)
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1)
    }

    const message = `Halo ${name}, service jam tangan Anda dengan invoice ${invoice} sudah mulai kami kerjakan. Kami akan update progressnya secara berkala. Terima kasih.`
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
  }

  const updateStatus = async (serviceId: string, newStatus: string) => {
    const { error } = await supabase
      .from('service_orders')
      .update({ status: newStatus })
      .eq('id', serviceId)

    if (error) {
      toast.error('Gagal update status')
    } else {
      // Add to timeline
      let statusMessage = ''
      switch(newStatus) {
        case 'in_progress':
          statusMessage = 'Service sedang dalam proses pengerjaan'
          break
        case 'waiting_sparepart':
          statusMessage = 'Menunggu konfirmasi sparepart dari customer'
          break
        case 'qc_pending':
          statusMessage = 'Service selesai, menunggu pengecekan QC'
          break
        default:
          statusMessage = `Status diupdate menjadi ${newStatus}`
      }

      await supabase.from('service_timeline').insert({
        service_order_id: serviceId,
        teknisi_id: teknisiId,
        status: newStatus,
        message: statusMessage,
        details: { action: 'status_update' }
      })

      toast.success(`Status diupdate menjadi ${newStatus}`)
      fetchQueues()
    }
  }

  const openSparepartRequest = (service: ServiceOrder) => {
    setSelectedService(service)
    setShowSparepartModal(true)
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      assigned: { label: 'DITUGASKAN', color: 'bg-blue-100 text-blue-700 border-blue-200' },
      in_progress: { label: 'DALAM PENGERJAAN', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
      waiting_sparepart: { label: 'MENUNGGU SPAREPART', color: 'bg-orange-100 text-orange-700 border-orange-200' },
      qc_pending: { label: 'SIAP QC', color: 'bg-purple-100 text-purple-700 border-purple-200' },
      pending: { label: 'MENUNGGU', color: 'bg-gray-100 text-gray-700 border-gray-200' }
    }
    return badges[status] || { label: status, color: 'bg-gray-100 text-gray-700' }
  }

  const viewServiceDetails = (service: ServiceOrder) => {
    setSelectedService(service)
    setShowDetailModal(true)
  }

  const openTimeline = (service: ServiceOrder) => {
    setSelectedService(service)
    setShowTimelineModal(true)
  }

  if (loading) {
    return (
      <div className="border-2 border-black p-8 text-center">
        <div className="inline-block w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" />
        <p className="mt-2 font-mono">LOADING...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* My Current Projects Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#FF6B9D] flex items-center justify-center border-2 border-black">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xl font-black">PROYEK SAYA ({myServices.length})</h3>
        </div>

        {myServices.length === 0 ? (
          <div className="border-2 border-black p-8 text-center bg-gray-50">
            <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p className="font-mono">Belum ada proyek yang diambil</p>
            <p className="text-xs text-gray-500">Ambil proyek dari daftar di bawah</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {myServices.map((service, index) => {
              const statusBadge = getStatusBadge(service.status)
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_black] overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-black text-white text-xs font-mono">
                            {service.invoice_number}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-bold border ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                          {service.last_update && (
                            <span className="text-xs text-gray-400">
                              Update: {new Date(service.last_update.created_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-1 text-sm">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="font-bold">{service.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Watch className="w-4 h-4 text-gray-400" />
                            <span>{service.watch_brand || service.device_brand} {service.watch_model || service.device_model}</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {service.issue_description}
                        </p>

                        {service.last_update && (
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>Terakhir: {service.last_update.message}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => openTimeline(service)}
                          className="px-3 py-1.5 text-sm bg-white text-black font-bold border-2 border-black shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1"
                        >
                          <Clock className="w-4 h-4" />
                          TIMELINE
                        </button>

                        {service.status === 'assigned' && (
                          <button
                            onClick={() => updateStatus(service.id, 'in_progress')}
                            className="px-3 py-1.5 text-sm bg-[#FFDE00] text-black font-bold border-2 border-black shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1"
                          >
                            <Wrench className="w-4 h-4" />
                            MULAI KERJA
                          </button>
                        )}

                        {service.status === 'in_progress' && (
                          <>
                            <button
                              onClick={() => openSparepartRequest(service)}
                              className="px-3 py-1.5 text-sm bg-[#3B82F6] text-white font-bold border-2 border-black shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1"
                            >
                              <Package className="w-4 h-4" />
                              REQUEST SPAREPART
                            </button>
                            <button
                              onClick={() => onTakeProject(service)}
                              className="px-3 py-1.5 text-sm bg-[#FF6B9D] text-white font-bold border-2 border-black shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1"
                            >
                              <CheckCircle className="w-4 h-4" />
                              UPDATE PROGRES
                            </button>
                          </>
                        )}

                        {service.status === 'waiting_sparepart' && (
                          <div className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 border-2 border-orange-300 flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            MENUNGGU SPAREPART
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* Available Queue Section - NEW SERVICES */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#FFDE00] flex items-center justify-center border-2 border-black">
            <Package className="w-4 h-4 text-black" />
          </div>
          <h3 className="text-xl font-black">SERVICE BARU ({pendingServices.length})</h3>
        </div>

        {pendingServices.length === 0 ? (
          <div className="border-2 border-black p-8 text-center bg-gray-50">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p className="font-mono">Tidak ada service baru</p>
            <p className="text-xs text-gray-500">Semua service sudah diambil</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingServices.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_black] overflow-hidden hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer"
                onClick={() => viewServiceDetails(service)}
              >
                <div className="p-4">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-black text-white text-xs font-mono">
                          {service.invoice_number}
                        </span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold border border-green-200">
                          BARU
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-1 text-sm">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-bold">{service.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Watch className="w-4 h-4 text-gray-400" />
                          <span>{service.watch_brand || service.device_brand}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                          <span className="line-clamp-1">{service.issue_description.substring(0, 50)}...</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); viewServiceDetails(service); }}
                        className="px-3 py-1.5 text-sm bg-[#3B82F6] text-white font-bold border-2 border-black shadow-[2px_2px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        DETAIL
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Service Detail Modal */}
      {selectedService && (
        <ServiceDetailModal
          isOpen={showDetailModal}
          onClose={() => setShowDetailModal(false)}
          service={selectedService}
          onTake={() => takeProject(selectedService)}
          onSkip={() => setShowDetailModal(false)}
        />
      )}

      {/* Timeline Modal */}
      {selectedService && (
        <div className={`fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 transition-all ${showTimelineModal ? 'visible' : 'invisible'}`}
          style={{ display: showTimelineModal ? 'flex' : 'none' }}
        >
          <div className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_black] w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b-2 border-black flex justify-between items-center sticky top-0 bg-white">
              <div>
                <h3 className="text-xl font-black">TIMELINE SERVICE</h3>
                <p className="text-xs font-mono">{selectedService.invoice_number}</p>
              </div>
              <button
                onClick={() => setShowTimelineModal(false)}
                className="p-1 border-2 border-black hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <ServiceTimeline
                serviceId={selectedService.id}
                customerPhone={selectedService.customer_phone}
                customerName={selectedService.customer_name}
                onUpdate={() => {
                  fetchQueues()
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sparepart Request Modal */}
      {selectedService && (
        <SparepartRequestModal
          isOpen={showSparepartModal}
          onClose={() => setShowSparepartModal(false)}
          service={selectedService}
          teknisiId={teknisiId}
          onSuccess={() => {
            setShowSparepartModal(false)
            fetchQueues()
          }}
        />
      )}
    </div>
  )
}

// Import X icon
import { X } from 'lucide-react'
import SparepartRequestModal from './SparepartRequestModal'

