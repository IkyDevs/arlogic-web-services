'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { ServiceOrder, ServiceItem, ServiceDocumentation } from '@/types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, XCircle, Eye, Calendar, User, Watch,
  DollarSign, X, Phone, Image, FileText, Package
} from 'lucide-react'

interface QCReviewListProps {
  onReview?: () => void
}

export default function QCReviewList({ onReview }: QCReviewListProps) {
  const [qcPendingServices, setQcPendingServices] = useState<any[]>([])
  const [selectedService, setSelectedService] = useState<any | null>(null)
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([])
  const [servicePhotos, setServicePhotos] = useState<ServiceDocumentation[]>([])
  const [reviewNotes, setReviewNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const supabase = createClient()
  const { user } = useAuthStore()

  useEffect(() => {
    fetchQCPendingServices()
  }, [])

  const fetchQCPendingServices = async () => {
    setFetching(true)
    const { data } = await supabase
      .from('service_orders')
      .select('*')
      .eq('status', 'qc_pending')
      .order('created_at', { ascending: true })

    if (data) setQcPendingServices(data)
    setFetching(false)
  }

  const viewServiceDetails = async (service: any) => {
    setSelectedService(service)
    setReviewNotes('')

    const [itemsRes, photosRes] = await Promise.all([
      supabase.from('service_items').select('*').eq('service_order_id', service.id),
      supabase.from('service_documentation').select('*').eq('service_order_id', service.id),
    ])

    if (itemsRes.data) setServiceItems(itemsRes.data)
    if (photosRes.data) setServicePhotos(photosRes.data)
  }

  const submitReview = async (status: 'approved' | 'rejected') => {
    if (!selectedService) return
    setLoading(true)

    try {
      const { error: reviewError } = await supabase.from('qc_reviews').insert({
        service_order_id: selectedService.id,
        reviewer_id: user?.id,
        status,
        notes: reviewNotes
      })
      if (reviewError) throw reviewError

      const newStatus = status === 'approved' ? 'completed' : 'in_progress'
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({
          status: newStatus,
          completed_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', selectedService.id)
      if (updateError) throw updateError

      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: status === 'approved' ? 'QC_APPROVED' : 'QC_REJECTED',
        details: { service_id: selectedService.id, notes: reviewNotes }
      })

      // Notify teknisi
      if (selectedService.assigned_teknisi_id) {
        await supabase.from('notifications').insert({
          user_id: selectedService.assigned_teknisi_id,
          type: status === 'approved' ? 'qc_approved' : 'qc_rejected',
          title: status === 'approved' ? 'Service Approved' : 'Service Needs Revision',
          message: status === 'approved'
            ? `Service ${selectedService.invoice_number} has been approved and completed`
            : `Service ${selectedService.invoice_number} was rejected. Reason: ${reviewNotes || 'No notes'}`,
          data: { service_id: selectedService.id, invoice: selectedService.invoice_number }
        })
      }

      toast.success(`Service ${status === 'approved' ? 'approved' : 'rejected'} successfully!`)
      setSelectedService(null)
      setReviewNotes('')
      fetchQCPendingServices()
      onReview?.()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const totalCost = serviceItems.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <div>
      {/* List */}
      {fetching ? (
        <div className="border-2 border-black p-8 text-center font-mono">Loading services...</div>
      ) : qcPendingServices.length === 0 ? (
        <div className="border-2 border-black p-12 text-center shadow-[6px_6px_0_0_#000]">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-black mb-2">ALL CLEAR!</h3>
          <p className="font-mono text-gray-600">No services pending QC review</p>
        </div>
      ) : (
        <div className="space-y-4">
          {qcPendingServices.map((service, i) => (
            <motion.div
              key={service.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="border-2 border-black bg-white shadow-[4px_4px_0_0_#000] p-5 hover:shadow-[6px_6px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="px-2 py-0.5 bg-[#FFDE00] border-2 border-black text-xs font-black font-mono">
                      {service.invoice_number}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 border border-purple-400 text-purple-700 text-xs font-mono">
                      QC Pending
                    </span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 mt-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-sm">{service.customer_name}</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {service.customer_phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Watch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div>
                        <p className="font-bold text-sm">{service.watch_brand || service.device_brand}</p>
                        <p className="text-xs text-gray-500">{service.watch_model || service.device_model}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <p className="text-sm">{new Date(service.created_at).toLocaleDateString('id-ID')}</p>
                    </div>
                    {service.final_cost && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <p className="font-bold text-sm">Rp {service.final_cost.toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mt-2 font-mono">{service.issue_description}</p>
                </div>

                <button
                  onClick={() => viewServiceDetails(service)}
                  className="flex items-center gap-2 px-4 py-2 bg-[#3B82F6] text-white border-2 border-black shadow-[3px_3px_0_0_#000] hover:shadow-[1px_1px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] font-mono font-bold text-sm transition-all flex-shrink-0"
                >
                  <Eye className="w-4 h-4" />
                  REVIEW
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      <AnimatePresence>
        {selectedService && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-black shadow-[12px_12px_0_0_#000] w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-[#FFDE00] border-b-2 border-black p-4 flex items-center justify-between z-10">
                <div>
                  <h3 className="text-lg font-black font-mono">QC REVIEW</h3>
                  <p className="font-mono text-sm">{selectedService.invoice_number}</p>
                </div>
                <button
                  onClick={() => setSelectedService(null)}
                  className="p-2 border-2 border-black bg-white hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Service Info */}
                <div className="border-2 border-black p-4 bg-gray-50">
                  <p className="text-xs font-black uppercase mb-3">Service Information</p>
                  <div className="grid sm:grid-cols-2 gap-3 text-sm font-mono">
                    <div>
                      <p className="text-gray-500 text-xs">Customer</p>
                      <p className="font-bold">{selectedService.customer_name}</p>
                      <p>{selectedService.customer_phone}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Watch</p>
                      <p className="font-bold">{selectedService.watch_brand || selectedService.device_brand}</p>
                      <p>{selectedService.watch_model || selectedService.device_model}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-gray-500 text-xs">Issue</p>
                      <p>{selectedService.issue_description}</p>
                    </div>
                  </div>
                </div>

                {/* Service Items */}
                {serviceItems.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4" />
                      <p className="font-black text-sm uppercase">Service Items</p>
                    </div>
                    <div className="border-2 border-black overflow-hidden">
                      {serviceItems.map((item, i) => (
                        <div key={i} className={`flex justify-between p-3 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${i < serviceItems.length - 1 ? 'border-b border-black' : ''}`}>
                          <div>
                            <p className="font-bold text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500 font-mono">
                              {item.item_type.toUpperCase()} · {item.quantity} × Rp {item.price.toLocaleString()}
                            </p>
                          </div>
                          <p className="font-bold font-mono text-sm">
                            Rp {(item.price * item.quantity).toLocaleString()}
                          </p>
                        </div>
                      ))}
                      <div className="flex justify-between p-3 bg-[#FFDE00] border-t-2 border-black">
                        <p className="font-black">TOTAL</p>
                        <p className="font-black font-mono">Rp {totalCost.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Photos */}
                {servicePhotos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Image className="w-4 h-4" />
                      <p className="font-black text-sm uppercase">Documentation Photos</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {servicePhotos.map((photo, i) => (
                        <img
                          key={i}
                          src={photo.photo_url}
                          alt={`Service ${i + 1}`}
                          className="w-full h-28 object-cover border-2 border-black cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(photo.photo_url, '_blank')}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Review Notes */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4" />
                    <label className="font-black text-sm uppercase">Review Notes</label>
                  </div>
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border-2 border-black font-mono text-sm resize-none focus:outline-none shadow-[3px_3px_0_0_#000] focus:shadow-none focus:translate-x-[3px] focus:translate-y-[3px] transition-all"
                    placeholder="Add review notes or reason for rejection..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => submitReview('approved')}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-600 text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] font-mono font-black text-sm transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        APPROVE & COMPLETE
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => submitReview('rejected')}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-500 text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] font-mono font-black text-sm transition-all disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    REJECT & RETURN
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
