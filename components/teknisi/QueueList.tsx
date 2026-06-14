'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ServiceOrder } from '@/types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, Clock, Wrench, Calendar, User,
  Smartphone, Watch, Eye, Package, AlertCircle
} from 'lucide-react'
import ServiceDetailModal from './ServiceDetailModal'
import ServiceTimeline from './ServiceTimeline'
import GlassCard from '@/components/ui/GlassCard'
import NeonButton from '@/components/ui/NeonButton'

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
  const [loading, setLoading] = useState(true)
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
      .in('status', ['assigned', 'in_progress'])
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
        status: 'assigned'
      })
      .eq('id', service.id)

    if (error) {
      toast.error('Failed to take project')
    } else {
      // Add to timeline
      await supabase.from('service_timeline').insert({
        service_order_id: service.id,
        teknisi_id: teknisiId,
        status: 'assigned',
        message: `Service assigned to teknisi ${teknisiId}`,
        details: { action: 'take_project' }
      })

      toast.success('Project taken successfully!')
      fetchQueues()
      onTakeProject(service)
      setShowDetailModal(false)
    }
  }

  const skipProject = () => {
    setShowDetailModal(false)
    toast('Service skipped. It will be available for other teknisi.', { icon: 'ℹ️' })
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
    return <div className="text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* My Current Projects */}
      {myServices.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800">
              My Projects ({myServices.length})
            </h3>
          </div>
          <div className="grid gap-4">
            {myServices.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="relative overflow-hidden bg-white rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500" />

                <div className="p-4">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                          {service.invoice_number}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          service.status === 'assigned'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {service.status === 'assigned' ? 'Assigned' : 'In Progress'}
                        </span>
                        {(service as any).last_update && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                            Last update: {new Date((service as any).last_update.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1 text-sm">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{service.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Watch className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{service.watch_brand || service.device_brand} {service.watch_model || service.device_model}</span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {service.issue_description}
                      </p>

                      {service.last_update && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                          <Clock className="w-3 h-3" />
                          <span>Latest: {(service.last_update as any)?.message}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openTimeline(service)}
                        className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1"
                      >
                        <Clock className="w-4 h-4" />
                        Timeline
                      </button>
                      {service.status === 'assigned' && (
                        <button
                          onClick={() => onTakeProject(service)}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Start Work
                        </button>
                      )}
                      {service.status === 'in_progress' && (
                        <button
                          onClick={() => onTakeProject(service)}
                          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Update Progress
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Available Queue */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xl font-semibold text-gray-800">
            Available Queue ({pendingServices.length})
          </h3>
        </div>

        {pendingServices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
            <p className="text-gray-500">No pending services in queue</p>
            <p className="text-sm text-gray-400">All caught up! Good job!</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingServices.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-mono">
                          {service.invoice_number}
                        </span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                          Pending
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-1 text-sm">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-800">{service.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Watch className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600">{service.watch_brand || service.device_brand}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 line-clamp-1">{service.issue_description.substring(0, 60)}...</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => viewServiceDetails(service)}
                        className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        View Details
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
          onSkip={skipProject}
        />
      )}

      {/* Timeline Modal */}
      // Update the Timeline Modal section to include customer info
{selectedService && (
  <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all ${showTimelineModal ? 'visible' : 'invisible'}`}
    style={{ display: showTimelineModal ? 'flex' : 'none' }}
  >
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col"
    >
      <div className="p-5 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Service Timeline</h3>
          <p className="text-xs text-gray-500">{selectedService.invoice_number}</p>
        </div>
        <button
          onClick={() => setShowTimelineModal(false)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
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
    </motion.div>
  </div>
)}s
    </div>
  )
}

// Import X icon
import { X } from 'lucide-react'
