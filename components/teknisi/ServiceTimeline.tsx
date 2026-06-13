'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Send, CheckCircle, AlertCircle,
  Wrench, Package, Camera, User, MessageSquare,
  ChevronDown, ChevronUp, Plus
} from 'lucide-react'
import toast from 'react-hot-toast'
import GlassCard from '@/components/ui/GlassCard'
import NeonButton from '@/components/ui/NeonButton'

interface ServiceTimelineProps {
  serviceId: string
  onUpdate?: () => void
}

const updateTemplates = [
  { icon: Wrench, label: 'Diagnosis', message: 'Melakukan diagnosis awal pada jam tangan' },
  { icon: Package, label: 'Parts Ordered', message: 'Memesan sparepart yang dibutuhkan' },
  { icon: Camera, label: 'Progress Photo', message: 'Mengupload foto progress service' },
  { icon: CheckCircle, label: 'Testing', message: 'Melakukan testing setelah perbaikan' },
  { icon: AlertCircle, label: 'Issue Found', message: 'Menemukan kendala tambahan' },
  { icon: User, label: 'Consultation', message: 'Konsultasi dengan customer' },
]

export default function ServiceTimeline({ serviceId, onUpdate }: ServiceTimelineProps) {
  const [timeline, setTimeline] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const supabase = createClient()
  const { user } = useAuthStore()

  useEffect(() => {
    fetchTimeline()

    // Subscribe to real-time updates
    const subscription = supabase
      .channel(`timeline_${serviceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'service_timeline',
          filter: `service_order_id=eq.${serviceId}`
        },
        () => {
          fetchTimeline()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [serviceId])

  const fetchTimeline = async () => {
    const { data } = await supabase
      .from('service_timeline')
      .select('*')
      .eq('service_order_id', serviceId)
      .order('created_at', { ascending: true })

    if (data) setTimeline(data)
  }

  const addTimelineUpdate = async (message: string, status?: string) => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('service_timeline')
        .insert({
          service_order_id: serviceId,
          teknisi_id: user?.id,
          status: status || 'progress',
          message: message,
          details: { updated_by: user?.full_name, timestamp: new Date().toISOString() }
        })

      if (error) throw error

      toast.success('Update added successfully!')
      setNewMessage('')
      if (onUpdate) onUpdate()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const useTemplate = (template: typeof updateTemplates[0]) => {
    setNewMessage(template.message)
    setShowTemplates(false)
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'issue': return <AlertCircle className="w-4 h-4 text-red-500" />
      default: return <Clock className="w-4 h-4 text-blue-500" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Timeline History */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        <AnimatePresence>
          {timeline.map((update, index) => (
            <motion.div
              key={update.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative pl-6 pb-4 last:pb-0"
            >
              {/* Timeline line */}
              {index < timeline.length - 1 && (
                <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-gray-200" />
              )}

              {/* Timeline dot */}
              <div className="absolute left-0 top-1 w-4 h-4 bg-white border-2 border-blue-500 rounded-full" />

              {/* Content */}
              <div className="bg-gray-50 rounded-xl p-3 ml-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(update.status)}
                    <span className="text-xs font-medium text-gray-500">
                      {new Date(update.created_at).toLocaleString()}
                    </span>
                  </div>
                  {update.details?.updated_by && (
                    <span className="text-xs text-gray-400">by {update.details.updated_by}</span>
                  )}
                </div>
                <p className="text-sm text-gray-700">{update.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {timeline.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No updates yet</p>
            <p className="text-xs">Add your first update to keep customer informed</p>
          </div>
        )}
      </div>

      {/* Add New Update */}
      <GlassCard className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="w-4 h-4 text-blue-500" />
          <h4 className="font-semibold text-gray-800">Add Service Update</h4>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            className="ml-auto text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Quick Templates
          </button>
        </div>

        {/* Templates */}
        <AnimatePresence>
          {showTemplates && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden"
            >
              <div className="grid grid-cols-2 gap-2">
                {updateTemplates.map((template, i) => (
                  <button
                    key={i}
                    onClick={() => useTemplate(template)}
                    className="flex items-center gap-2 p-2 text-left text-sm bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <template.icon className="w-3 h-3 text-gray-500" />
                    <span className="text-xs">{template.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <div className="flex gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Update customer about service progress..."
            rows={2}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-sm"
          />
          <button
            onClick={() => addTimelineUpdate(newMessage)}
            disabled={loading || !newMessage.trim()}
            className="px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 self-end"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Updates will be visible to customer for service tracking
        </p>
      </GlassCard>
    </div>
  )
}
