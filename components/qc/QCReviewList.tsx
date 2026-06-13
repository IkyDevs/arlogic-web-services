'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { ServiceOrder, ServiceItem, ServiceDocumentation } from '@/types'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Eye, Calendar, User, Smartphone, DollarSign } from 'lucide-react'

export default function QCReviewList() {
  const [qcPendingServices, setQcPendingServices] = useState<ServiceOrder[]>([])
  const [selectedService, setSelectedService] = useState<ServiceOrder | null>(null)
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>([])
  const [servicePhotos, setServicePhotos] = useState<ServiceDocumentation[]>([])
  const [reviewNotes, setReviewNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const { user } = useAuthStore()

  useEffect(() => {
    fetchQCPendingServices()
  }, [])

  const fetchQCPendingServices = async () => {
    const { data } = await supabase
      .from('service_orders')
      .select('*')
      .eq('status', 'qc_pending')
      .order('created_at', { ascending: true })

    if (data) setQcPendingServices(data)
  }

  const viewServiceDetails = async (service: ServiceOrder) => {
    setSelectedService(service)

    // Fetch service items
    const { data: items } = await supabase
      .from('service_items')
      .select('*')
      .eq('service_order_id', service.id)

    if (items) setServiceItems(items)

    // Fetch service photos
    const { data: photos } = await supabase
      .from('service_documentation')
      .select('*')
      .eq('service_order_id', service.id)

    if (photos) setServicePhotos(photos)
  }

  const submitReview = async (status: 'approved' | 'rejected') => {
    if (!selectedService) return

    setLoading(true)

    try {
      // Save QC review
      const { error: reviewError } = await supabase
        .from('qc_reviews')
        .insert({
          service_order_id: selectedService.id,
          reviewer_id: user?.id,
          status: status,
          notes: reviewNotes
        })

      if (reviewError) throw reviewError

      // Update service status
      const newStatus = status === 'approved' ? 'completed' : 'in_progress'
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({
          status: newStatus,
          completed_at: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', selectedService.id)

      if (updateError) throw updateError

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: status === 'approved' ? 'QC_APPROVED' : 'QC_REJECTED',
        details: { service_id: selectedService.id, notes: reviewNotes }
      })

      toast.success(`Service ${status} successfully!`)

      // Reset and refresh
      setSelectedService(null)
      setReviewNotes('')
      fetchQCPendingServices()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="grid gap-6">
        {qcPendingServices.map((service) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                    {service.invoice_number}
                  </span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                    Ready for QC
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span>{service.customer_name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Smartphone className="w-4 h-4 text-gray-500" />
                      <span>{service.device_brand} {service.device_model}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span>{new Date(service.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                    {service.final_cost && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold">Rp {service.final_cost.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-600">
                  {service.issue_description}
                </p>
              </div>

              <button
                onClick={() => viewServiceDetails(service)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ml-4 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Review
              </button>
            </div>
          </motion.div>
        ))}

        {qcPendingServices.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Pending Reviews</h3>
            <p className="text-gray-600">All services have been reviewed</p>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">QC Review - {selectedService.invoice_number}</h3>
              <button
                onClick={() => setSelectedService(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* Service Info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{selectedService.customer_name}</p>
                  <p className="text-sm">{selectedService.customer_phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Device</p>
                  <p className="font-medium">{selectedService.device_brand} {selectedService.device_model}</p>
                  <p className="text-sm">{selectedService.device_type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-gray-500">Issue</p>
                  <p className="text-sm">{selectedService.issue_description}</p>
                </div>
              </div>
            </div>

            {/* Service Items */}
            {serviceItems.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Service Items & Spareparts</h4>
                <div className="space-y-2">
                  {serviceItems.map((item, index) => (
                    <div key={index} className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-xs text-gray-500 ml-2">({item.item_type})</span>
                        <div className="text-sm text-gray-600">
                          {item.quantity} x Rp {item.price.toLocaleString()}
                        </div>
                      </div>
                      <span className="font-semibold">Rp {(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex justify-between p-3 bg-blue-50 rounded-lg font-bold">
                    <span>Total</span>
                    <span>Rp {selectedService.final_cost?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Service Photos */}
            {servicePhotos.length > 0 && (
              <div className="mb-6">
                <h4 className="font-semibold mb-3">Service Documentation</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {servicePhotos.map((photo, index) => (
                    <img
                      key={index}
                      src={photo.photo_url}
                      alt={`Service ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg cursor-pointer"
                      onClick={() => window.open(photo.photo_url, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Review Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review Notes
              </label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Add any notes or comments about the service..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => submitReview('approved')}
                disabled={loading}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="w-5 h-5" />
                Approve & Complete
              </button>
              <button
                onClick={() => submitReview('rejected')}
                disabled={loading}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <XCircle className="w-5 h-5" />
                Reject & Return
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
