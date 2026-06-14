'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ServiceOrder, ServiceItem } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, Clock, Wrench, UserCheck, Package,
  Smartphone, Calendar, DollarSign, AlertCircle,
  Phone, Mail, MapPin, Watch, Settings, Battery,
  ChevronRight, ChevronDown, MessageSquare, Image,
  User, Hash, FileText, Star, Award, Shield
} from 'lucide-react'
import GlassCard from '@/components/ui/GlassCard'

export default function TrackingPage({ params }: { params: { id: string } }) {
  const [token, setToken] = useState('')
  const [service, setService] = useState<any>(null)
  const [items, setItems] = useState<ServiceItem[]>([])
  const [timeline, setTimeline] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expandedSections, setExpandedSections] = useState({
    device: true,
    items: false,
    timeline: true
  })
  const supabase = createClient()

  const statusSteps = [
    { status: 'pending', label: 'Order Received', icon: Clock, description: 'Service order has been received', color: 'from-gray-400 to-gray-500' },
    { status: 'assigned', label: 'Assigned to Teknisi', icon: UserCheck, description: 'A teknisi has been assigned to your device', color: 'from-blue-500 to-cyan-500' },
    { status: 'in_progress', label: 'Service in Progress', icon: Wrench, description: 'Your device is being serviced', color: 'from-purple-500 to-pink-500' },
    { status: 'qc_pending', label: 'Quality Check', icon: Package, description: 'Final quality check in progress', color: 'from-orange-500 to-red-500' },
    { status: 'completed', label: 'Service Complete', icon: CheckCircle, description: 'Your device is ready for pickup', color: 'from-emerald-500 to-green-600' },
  ]

  const getCurrentStep = () => {
    if (!service) return 0
    const index = statusSteps.findIndex(step => step.status === service.status)
    return index >= 0 ? index : 0
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      assigned: 'bg-blue-100 text-blue-700 border-blue-200',
      in_progress: 'bg-purple-100 text-purple-700 border-purple-200',
      qc_pending: 'bg-orange-100 text-orange-700 border-orange-200',
      completed: 'bg-green-100 text-green-700 border-green-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200'
    }
    return colors[status] || colors.pending
  }

  const getMovementIcon = (movement: string) => {
    switch(movement) {
      case 'automatic': return <Settings className="w-4 h-4" />
      case 'quartz': return <Battery className="w-4 h-4" />
      case 'mechanical': return <Settings className="w-4 h-4" />
      case 'smartwatch': return <Smartphone className="w-4 h-4" />
      default: return <Watch className="w-4 h-4" />
    }
  }

  const trackService = async () => {
    if (!token.trim()) {
      setError('Please enter tracking token')
      return
    }

    setLoading(true)
    setError('')

    try {
      // Fetch service order
      const { data, error: fetchError } = await supabase
        .from('service_orders')
        .select('*')
        .eq('token', token.toUpperCase())
        .single()

      if (fetchError || !data) {
        setError('Invalid tracking token. Please check and try again.')
        setService(null)
        setItems([])
        setTimeline([])
        return
      }

      // Check if token is expired
      if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
        setError('This tracking token has expired because the service is complete.')
        setService(null)
        return
      }

      setService(data)

      // Fetch service items
      const { data: itemsData } = await supabase
        .from('service_items')
        .select('*')
        .eq('service_order_id', data.id)
      if (itemsData) setItems(itemsData)

      // Fetch timeline updates
      const { data: timelineData } = await supabase
        .from('service_timeline')
        .select('*')
        .eq('service_order_id', data.id)
        .order('created_at', { ascending: true })
      if (timelineData) setTimeline(timelineData)

    } catch (error) {
      console.error('Tracking error:', error)
      setError('Failed to fetch service information')
    } finally {
      setLoading(false)
    }
  }

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const isWatch = service?.device_type === 'smartwatch'

  if (!service) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-2xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Watch className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Track Your Service</h1>
            <p className="text-gray-500 mt-2">Enter your tracking token to check status</p>
          </div>

          <div className="space-y-4">
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="Enter tracking token"
                className="w-full pl-10 pr-4 py-3 bg-white/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-center uppercase tracking-wider font-mono"
                onKeyPress={(e) => e.key === 'Enter' && trackService()}
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-red-500 text-sm text-center flex items-center justify-center gap-1"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.p>
            )}

            <button
              onClick={trackService}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Track Service
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
            <p className="text-xs text-gray-500 text-center">
              Token provided when you created the service order.
              Contact us if you lost your token.
            </p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6"
        >
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                  <Watch className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">Service Tracking</h1>
                  <p className="text-sm text-gray-500 font-mono">{service.invoice_number}</p>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1.5 rounded-xl text-sm font-semibold border ${getStatusColor(service.status)}`}>
                {service.status === 'qc_pending' ? 'Quality Check' :
                 service.status === 'assigned' ? 'Assigned' :
                 service.status === 'in_progress' ? 'In Progress' :
                 service.status === 'completed' ? 'Completed' :
                 service.status.charAt(0).toUpperCase() + service.status.slice(1)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 mb-6"
        >
          <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            Service Progress
          </h2>
          <div className="relative">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= getCurrentStep()
              const isCurrent = index === getCurrentStep()

              return (
                <div key={step.status} className="relative mb-8 last:mb-0">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <motion.div
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        className={`
                          w-12 h-12 rounded-2xl flex items-center justify-center z-10 relative shadow-lg
                          ${isCompleted ? `bg-gradient-to-br ${step.color} text-white` : 'bg-gray-200 text-gray-500'}
                        `}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-6 h-6" />
                        ) : (
                          <step.icon className="w-6 h-6" />
                        )}
                      </motion.div>
                      {index < statusSteps.length - 1 && (
                        <div className={`
                          absolute top-12 left-6 w-0.5 h-12
                          ${isCompleted ? 'bg-gradient-to-b from-blue-500 to-purple-500' : 'bg-gray-200'}
                        `} />
                      )}
                    </div>
                    <div className={`flex-1 ${isCurrent ? 'bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl -mt-2' : ''}`}>
                      <h3 className={`font-semibold ${isCompleted ? 'text-gray-800' : 'text-gray-500'}`}>
                        {step.label}
                      </h3>
                      <p className="text-sm text-gray-500">{step.description}</p>
                      {isCurrent && service.status === 'in_progress' && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-blue-600 mt-2 flex items-center gap-1"
                        >
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                          Currently in progress...
                        </motion.p>
                      )}
                      {isCurrent && service.status === 'completed' && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-green-600 mt-2 flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Ready for pickup!
                        </motion.p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Service Details */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="space-y-4 mb-6"
        >
          {/* Customer & Device Info */}
          <GlassCard className="p-5">
            <button
              onClick={() => toggleSection('device')}
              className="w-full flex items-center justify-between mb-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-gray-800">Service Information</h3>
              </div>
              {expandedSections.device ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {expandedSections.device && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4 pt-2"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                    <User className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-xs text-gray-500">Customer</p>
                      <p className="font-medium text-gray-800">{service.customer_name}</p>
                      <p className="text-sm text-gray-600">{service.customer_phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl">
                    {isWatch ? <Watch className="w-5 h-5 text-purple-500" /> : <Smartphone className="w-5 h-5 text-purple-500" />}
                    <div>
                      <p className="text-xs text-gray-500">Device</p>
                      <p className="font-medium text-gray-800">
                        {isWatch ? service.watch_brand || service.device_brand : service.device_brand}
                        {service.device_model && ` ${service.device_model}`}
                      </p>
                      <p className="text-sm text-gray-600 capitalize">{service.device_type}</p>
                    </div>
                  </div>
                </div>

                {/* Watch-specific details */}
                {isWatch && (service.watch_movement || service.watch_condition) && (
                  <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl">
                    <p className="text-xs text-gray-500 mb-2">Watch Details</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {service.watch_brand && (
                        <div>
                          <span className="text-gray-500">Brand:</span>
                          <span className="ml-1 font-medium">{service.watch_brand}</span>
                        </div>
                      )}
                      {service.watch_model && (
                        <div>
                          <span className="text-gray-500">Model:</span>
                          <span className="ml-1 font-medium">{service.watch_model}</span>
                        </div>
                      )}
                      {service.watch_movement && (
                        <div className="flex items-center gap-1">
                          {getMovementIcon(service.watch_movement)}
                          <span className="text-gray-500">Movement:</span>
                          <span className="font-medium capitalize">{service.watch_movement}</span>
                        </div>
                      )}
                      {service.watch_condition && (
                        <div>
                          <span className="text-gray-500">Condition:</span>
                          <span className="ml-1 font-medium capitalize">{service.watch_condition}</span>
                        </div>
                      )}
                      {service.watch_year && (
                        <div>
                          <span className="text-gray-500">Year:</span>
                          <span className="ml-1 font-medium">{service.watch_year}</span>
                        </div>
                      )}
                    </div>
                    {service.watch_accessories && service.watch_accessories.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-emerald-200">
                        <p className="text-xs text-gray-500 mb-1">Accessories:</p>
                        <div className="flex flex-wrap gap-1">
                          {service.watch_accessories.map((acc: string, i: number) => (
                            <span key={i} className="text-xs bg-white px-2 py-0.5 rounded-full">{acc.replace(/_/g, ' ')}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {service.serial_number && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                    <Hash className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">Serial Number: {service.serial_number}</span>
                  </div>
                )}

                <div>
                  <p className="text-sm text-gray-500 mb-1">Issue Description</p>
                  <div className="bg-orange-50 p-3 rounded-xl text-sm text-gray-700">
                    {service.issue_description}
                  </div>
                </div>

                {service.request && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Customer Request</p>
                    <div className="bg-blue-50 p-3 rounded-xl text-sm text-gray-700">
                      {service.request}
                    </div>
                  </div>
                )}

                {service.notes && (
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Additional Notes</p>
                    <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-600">
                      {service.notes}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  <span>Service started: {new Date(service.created_at).toLocaleDateString('id-ID')}</span>
                </div>
              </motion.div>
            )}
          </GlassCard>

          {/* Items & Cost */}
          {items.length > 0 && (
            <GlassCard className="p-5">
              <button
                onClick={() => toggleSection('items')}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-800">Service Items & Cost</h3>
                </div>
                {expandedSections.items ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expandedSections.items && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  {items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            item.item_type === 'jasa' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {item.item_type === 'jasa' ? 'Jasa' : 'Sparepart'}
                          </span>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {item.quantity} x Rp {item.price.toLocaleString()}
                        </p>
                      </div>
                      <span className="font-semibold text-gray-800">
                        Rp {(item.price * item.quantity).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl font-bold">
                    <span>Total</span>
                    <span className="text-xl text-blue-600">Rp {service.final_cost?.toLocaleString() || service.estimated_cost?.toLocaleString() || 0}</span>
                  </div>
                </motion.div>
              )}
            </GlassCard>
          )}

          {/* Timeline Updates */}
          {timeline.length > 0 && (
            <GlassCard className="p-5">
              <button
                onClick={() => toggleSection('timeline')}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-800">Service Updates Timeline</h3>
                </div>
                {expandedSections.timeline ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              {expandedSections.timeline && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4 max-h-96 overflow-y-auto pr-2"
                >
                  {timeline.map((update, index) => (
                    <div key={update.id} className="relative pl-6 pb-4 last:pb-0">
                      {index < timeline.length - 1 && (
                        <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-gray-200" />
                      )}
                      <div className="absolute left-0 top-1 w-3 h-3 bg-blue-500 rounded-full" />
                      <div className="bg-gray-50 rounded-xl p-3 ml-2">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <span className="text-xs text-gray-500">
                            {new Date(update.created_at).toLocaleString()}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            update.status === 'completed' ? 'bg-green-100 text-green-700' :
                            update.status === 'issue_found' ? 'bg-red-100 text-red-700' :
                            update.status === 'testing' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {update.status === 'completed' ? 'Selesai' :
                             update.status === 'diagnosis' ? 'Diagnosis' :
                             update.status === 'testing' ? 'Testing' :
                             update.status === 'issue_found' ? 'Kendala' : 'Update'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{update.message}</p>
                        {update.photo_url && (
                          <div className="mt-2">
                            <img
                              src={update.photo_url}
                              alt="Service progress"
                              className="rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(update.photo_url, '_blank')}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </GlassCard>
          )}
        </motion.div>

        {/* Completion Message */}
        {service.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl p-6 text-white shadow-xl">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-1">Service Complete!</h3>
                  <p className="text-emerald-100">
                    Your device is ready for pickup. Please bring your invoice and tracking token.
                  </p>
                </div>
              </div>
            </div>

            {/* Rate Us Banner */}
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 text-center">
              <div className="flex items-center justify-center gap-1 mb-3">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <h3 className="font-bold text-lg mb-1">How was your experience?</h3>
              <p className="text-gray-500 text-sm mb-4">Your feedback helps us improve our service quality</p>
              <a
                href={`/feedback/${service.invoice_number}?token=${service.token}`}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                <Star className="w-4 h-4" />
                Rate This Service
              </a>
            </div>
          </motion.div>
        )}

        {/* Contact Support */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center pt-6"
        >
          <p className="text-sm text-gray-500">
            Need help? Contact our support at
            <a href="tel:+62123456789" className="text-blue-600 ml-1">+62 123 456 789</a>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
