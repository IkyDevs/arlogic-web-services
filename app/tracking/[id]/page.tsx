'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ServiceOrder, ServiceItem } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Clock, Wrench, UserCheck, Package, Smartphone, Calendar, DollarSign } from 'lucide-react'

export default function TrackingPage({ params }: { params: { id: string } }) {
  const [token, setToken] = useState('')
  const [service, setService] = useState<ServiceOrder | null>(null)
  const [items, setItems] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  const statusSteps = [
    { status: 'pending', label: 'Order Received', icon: Clock, description: 'Your service order has been received' },
    { status: 'assigned', label: 'Assigned to Teknisi', icon: UserCheck, description: 'A teknisi has been assigned to your device' },
    { status: 'in_progress', label: 'Service in Progress', icon: Wrench, description: 'Your device is being serviced' },
    { status: 'qc_pending', label: 'Quality Check', icon: Package, description: 'Final quality check in progress' },
    { status: 'completed', label: 'Service Complete', icon: CheckCircle, description: 'Your device is ready for pickup' },
  ]

  const getCurrentStep = () => {
    if (!service) return 0
    const index = statusSteps.findIndex(step => step.status === service.status)
    return index >= 0 ? index : 0
  }

  const trackService = async () => {
    if (!token.trim()) {
      setError('Please enter tracking token')
      return
    }

    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('service_orders')
      .select('*')
      .eq('token', token.toUpperCase())
      .single()

    if (fetchError || !data) {
      setError('Invalid tracking token. Please check and try again.')
      setService(null)
    } else {
      // Check if token is expired
      if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) {
        setError('This tracking token has expired because the service is complete.')
        setService(null)
      } else {
        setService(data)
        // Fetch service items
        const { data: itemsData } = await supabase
          .from('service_items')
          .select('*')
          .eq('service_order_id', data.id)
        if (itemsData) setItems(itemsData)
      }
    }
    setLoading(false)
  }

  if (!service) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800">Track Your Service</h1>
            <p className="text-gray-600 mt-2">Enter your tracking token to check status</p>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value.toUpperCase())}
              placeholder="Enter tracking token"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center uppercase"
              onKeyPress={(e) => e.key === 'Enter' && trackService()}
            />

            {error && (
              <p className="text-red-600 text-sm text-center">{error}</p>
            )}

            <button
              onClick={trackService}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold"
            >
              {loading ? 'Tracking...' : 'Track Service'}
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-6 mb-6"
        >
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Service Tracking</h1>
              <p className="text-gray-600">Invoice: {service.invoice_number}</p>
            </div>
            <div className="text-right">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                service.status === 'completed' ? 'bg-green-100 text-green-700' :
                service.status === 'qc_pending' ? 'bg-purple-100 text-purple-700' :
                service.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {service.status === 'qc_pending' ? 'Quality Check' :
                 service.status === 'assigned' ? 'Assigned' :
                 service.status.charAt(0).toUpperCase() + service.status.slice(1)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-xl p-6 mb-6"
        >
          <h2 className="text-lg font-semibold mb-6">Service Progress</h2>
          <div className="relative">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= getCurrentStep()
              const isCurrent = index === getCurrentStep()

              return (
                <div key={step.status} className="relative mb-8 last:mb-0">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center z-10 relative
                        ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}
                      `}>
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5 text-white" />
                        ) : (
                          <step.icon className="w-5 h-5 text-white" />
                        )}
                      </div>
                      {index < statusSteps.length - 1 && (
                        <div className={`
                          absolute top-10 left-5 w-0.5 h-12
                          ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}
                        `} />
                      )}
                    </div>
                    <div className={`flex-1 ${isCurrent ? 'bg-blue-50 p-4 rounded-lg -mt-2' : ''}`}>
                      <h3 className={`font-semibold ${isCompleted ? 'text-green-700' : 'text-gray-700'}`}>
                        {step.label}
                      </h3>
                      <p className="text-sm text-gray-500">{step.description}</p>
                      {isCurrent && service.status === 'in_progress' && (
                        <p className="text-xs text-blue-600 mt-2">Currently in progress...</p>
                      )}
                      {isCurrent && service.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-2">✓ Ready for pickup!</p>
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
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-xl p-6"
        >
          <h2 className="text-lg font-semibold mb-4">Service Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500">Device</p>
                <p className="font-medium">{service.device_brand} {service.device_model}</p>
                <p className="text-sm text-gray-600">{service.device_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500">Service Date</p>
                <p className="font-medium">{new Date(service.created_at).toLocaleDateString('id-ID')}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-500 mb-1">Issue Description</p>
            <p className="text-gray-700">{service.issue_description}</p>
          </div>

          {items.length > 0 && (
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">Service Items & Spareparts</p>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex justify-between p-2 bg-gray-50 rounded">
                    <span>{item.name} x{item.quantity}</span>
                    <span>Rp {item.price.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between p-3 bg-blue-50 rounded font-semibold">
                  <span>Total Cost</span>
                  <span>Rp {service.final_cost?.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {service.status === 'completed' && (
            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-700">Service Complete!</p>
                  <p className="text-sm text-green-600">Your device is ready for pickup.</p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
