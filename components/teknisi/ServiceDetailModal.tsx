'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Clock, User, Phone, Hash, AlertCircle,
  FileText, Calendar, Watch, Settings, Battery,
  Shield, CheckCircle, XCircle, ArrowRight,
  Smartphone, Cpu, Activity, Package, DollarSign,
  Camera
} from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'
import NeonButton from '@/components/ui/NeonButton'
import toast from 'react-hot-toast'

interface ServiceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  service: any
  onTake: () => void
  onSkip: () => void
}

export default function ServiceDetailModal({
  isOpen,
  onClose,
  service,
  onTake,
  onSkip
}: ServiceDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)
  const [initialPhotos, setInitialPhotos] = useState<any[]>([])
  const supabase = createClient()

  // Fetch initial condition photos
  useEffect(() => {
    if (isOpen && service?.id) {
      fetchInitialPhotos()
    }
  }, [isOpen, service?.id])

  const fetchInitialPhotos = async () => {
    const { data } = await supabase
      .from('service_documentation')
      .select('*')
      .eq('service_order_id', service.id)
      .eq('stage', 'initial_condition')
      .order('created_at', { ascending: true })

    if (data) setInitialPhotos(data)
  }

  if (!isOpen || !service) return null

  const getMovementIcon = (movement: string) => {
    switch(movement) {
      case 'automatic': return <Settings className="w-4 h-4" />
      case 'quartz': return <Battery className="w-4 h-4" />
      case 'mechanical': return <Cpu className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  const getConditionColor = (condition: string) => {
    switch(condition) {
      case 'new': return 'text-emerald-600 bg-emerald-50'
      case 'excellent': return 'text-green-600 bg-green-50'
      case 'good': return 'text-blue-600 bg-blue-50'
      case 'fair': return 'text-yellow-600 bg-yellow-50'
      case 'poor': return 'text-red-600 bg-red-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-start sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
              <Watch className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Service Details</h3>
              <p className="text-xs text-gray-500">{service.invoice_number}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Watch Information */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Watch className="w-4 h-4 text-blue-500" />
              <h4 className="font-semibold text-gray-800">Watch Information</h4>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Brand</p>
                <p className="font-medium text-gray-800">{service.watch_brand || service.device_brand || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Model</p>
                <p className="font-medium text-gray-800">{service.watch_model || service.device_model || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Year</p>
                <p className="font-medium text-gray-800">{service.watch_year || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Movement</p>
                <div className="flex items-center gap-1 mt-1">
                  {service.watch_movement && getMovementIcon(service.watch_movement)}
                  <p className="font-medium text-gray-800 capitalize">{service.watch_movement || '-'}</p>
                </div>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500">Condition</p>
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getConditionColor(service.watch_condition)}`}>
                  {service.watch_condition || 'Not specified'}
                </span>
              </div>
              {service.watch_accessories && service.watch_accessories.length > 0 && (
                <div className="col-span-2">
                  <p className="text-gray-500">Accessories</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {service.watch_accessories.map((acc: string, i: number) => (
                      <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">{acc}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Customer Information */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-purple-500" />
              <h4 className="font-semibold text-gray-800">Customer Information</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Name</span>
                <span className="font-medium text-gray-800">{service.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Phone</span>
                <span className="font-medium text-gray-800">{service.customer_phone}</span>
              </div>
              {service.serial_number && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Serial Number</span>
                  <span className="font-mono text-sm">{service.serial_number}</span>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Problem & Request */}
          <GlassCard className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <h4 className="font-semibold text-gray-800">Service Request</h4>
            </div>

            <div className="mb-3">
              <p className="text-gray-500 text-sm mb-1">Problem / Kendala</p>
              <div className={`bg-orange-50 p-3 rounded-xl text-sm text-gray-700 ${!showFullDescription && 'max-h-20 overflow-hidden relative'}`}>
                <p>{service.issue_description}</p>
                {!showFullDescription && service.issue_description?.length > 150 && (
                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-orange-50 to-transparent" />
                )}
              </div>
              {service.issue_description?.length > 150 && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-xs text-blue-500 mt-1 hover:text-blue-600"
                >
                  {showFullDescription ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>

            {service.request && (
              <div>
                <p className="text-gray-500 text-sm mb-1">Customer Request</p>
                <div className="bg-blue-50 p-3 rounded-xl text-sm text-gray-700">
                  <p>{service.request}</p>
                </div>
              </div>
            )}

            {service.notes && (
              <div className="mt-3">
                <p className="text-gray-500 text-sm mb-1">Additional Notes</p>
                <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-600">
                  <p>{service.notes}</p>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Initial Condition Photos */}
          {initialPhotos.length > 0 && (
            <GlassCard className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                <h4 className="font-semibold text-gray-800">Initial Condition Photos</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {initialPhotos.map((photo, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200">
                    <img
                      src={photo.photo_url}
                      alt={`Initial condition ${i + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(photo.photo_url, '_blank')}
                    />
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Photos taken when the watch was received for service
              </p>
            </GlassCard>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-gray-100 flex gap-3 bg-white">
          <NeonButton
            variant="secondary"
            onClick={onSkip}
            className="flex-1"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Skip
          </NeonButton>
          <NeonButton
            variant="success"
            onClick={onTake}
            loading={loading}
            className="flex-1"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Take This Service
            <ArrowRight className="w-4 h-4 ml-2" />
          </NeonButton>
        </div>
      </motion.div>
    </div>
  )
}
