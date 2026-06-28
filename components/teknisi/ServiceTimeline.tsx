'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useUpload } from '@/hooks/useUpload'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Send, CheckCircle, AlertCircle,
  Wrench, Package, Camera, User, MessageSquare,
  ChevronDown, ChevronUp, Plus, Image, Phone,
  Calendar, Check, X, Loader, MapPin
} from 'lucide-react'
import toast from 'react-hot-toast'
import GlassCard from '@/components/ui/GlassCard'
import NeonButton from '@/components/ui/NeonButton'

interface ServiceTimelineProps {
  serviceId: string
  customerPhone?: string
  customerName?: string
  onUpdate?: () => void
}

const updateTemplates = [
  { icon: Wrench, label: 'Diagnosis', message: 'Melakukan diagnosis awal pada jam tangan', status: 'diagnosis' },
  { icon: Package, label: 'Parts Ordered', message: 'Memesan sparepart yang dibutuhkan', status: 'parts_ordered' },
  { icon: Camera, label: 'Progress Photo', message: 'Upload foto progress service', status: 'progress_photo' },
  { icon: CheckCircle, label: 'Testing', message: 'Melakukan testing setelah perbaikan', status: 'testing' },
  { icon: AlertCircle, label: 'Issue Found', message: 'Menemukan kendala tambahan pada device', status: 'issue_found' },
  { icon: User, label: 'Consultation', message: 'Konsultasi dengan customer', status: 'consultation' },
  { icon: Check, label: 'Completed', message: 'Service selesai, siap diambil customer', status: 'completed' },
]

export default function ServiceTimeline({ serviceId, customerPhone, customerName, onUpdate }: ServiceTimelineProps) {
  const [timeline, setTimeline] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showContactModal, setShowContactModal] = useState(false)
  const [contactMessage, setContactMessage] = useState('')
  const [contactMethod, setContactMethod] = useState<'whatsapp' | 'call'>('whatsapp')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { user } = useAuthStore()
  const { uploadFile, uploading, progress } = useUpload()

  useEffect(() => {
    fetchTimeline()

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

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedPhoto(file)
      const preview = URL.createObjectURL(file)
      setPhotoPreview(preview)
    }
  }

  const removePhoto = () => {
    setSelectedPhoto(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const addTimelineUpdate = async (message: string, status?: string) => {
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    setLoading(true)
    let photoUrl = null

    try {
      // Upload photo if exists
      if (selectedPhoto) {
        const now = new Date().toLocaleString('id-ID', { 
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        })

        const caption = `foto hasil jepretan teknisi

${now}
Teknisi : ${user?.full_name || '—'}
Deskripsi : ${message}`

        photoUrl = await uploadFile(selectedPhoto, { 
          type: 'service', 
          caption 
        })
        if (!photoUrl) {
          toast.error('Failed to upload photo')
          return
        }
      }

      const { error } = await supabase
        .from('service_timeline')
        .insert({
          service_order_id: serviceId,
          teknisi_id: user?.id,
          status: status || 'progress',
          message: message,
          photo_url: photoUrl,
          details: {
            updated_by: user?.full_name,
            timestamp: new Date().toISOString(),
            has_photo: !!photoUrl
          }
        })

      if (error) throw error

      toast.success(photoUrl ? 'Update with photo added!' : 'Update added successfully!')
      setNewMessage('')
      removePhoto()
      if (onUpdate) onUpdate()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const sendWhatsApp = () => {
    if (!customerPhone) {
      toast.error('Customer phone number not available')
      return
    }

    // Format phone number (remove +62 or 0, add 62)
    let phone = customerPhone.replace(/\D/g, '')
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1)
    } else if (phone.startsWith('+')) {
      phone = phone.substring(1)
    }

    const message = encodeURIComponent(contactMessage || `Halo ${customerName}, saya teknisi yang menangani service device Anda. Ada update progress service.`)
    const whatsappUrl = `https://wa.me/${phone}?text=${message}`
    window.open(whatsappUrl, '_blank')

    // Log contact
    supabase.from('contact_logs').insert({
      service_order_id: serviceId,
      teknisi_id: user?.id,
      contact_method: 'whatsapp',
      message: contactMessage,
      notes: 'Contact via WhatsApp'
    })

    setShowContactModal(false)
    setContactMessage('')
    toast.success('Opening WhatsApp...')
  }

  const makeCall = () => {
    if (!customerPhone) {
      toast.error('Customer phone number not available')
      return
    }

    const phone = customerPhone.replace(/\D/g, '')
    window.location.href = `tel:${phone}`

    supabase.from('contact_logs').insert({
      service_order_id: serviceId,
      teknisi_id: user?.id,
      contact_method: 'call',
      notes: 'Phone call made'
    })

    setShowContactModal(false)
  }

  const useTemplate = (template: typeof updateTemplates[0]) => {
    setNewMessage(template.message)
    setShowTemplates(false)
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'issue_found': return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'testing': return <CheckCircle className="w-4 h-4 text-blue-500" />
      case 'diagnosis': return <Wrench className="w-4 h-4 text-orange-500" />
      default: return <Clock className="w-4 h-4 text-slate-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      diagnosis: { label: 'Diagnosis', color: 'bg-orange-100 text-orange-700' },
      parts_ordered: { label: 'Parts Ordered', color: 'bg-purple-100 text-purple-700' },
      progress_photo: { label: 'Progress', color: 'bg-blue-100 text-blue-700' },
      testing: { label: 'Testing', color: 'bg-cyan-100 text-cyan-700' },
      issue_found: { label: 'Issue Found', color: 'bg-red-100 text-red-700' },
      consultation: { label: 'Consultation', color: 'bg-yellow-100 text-yellow-700' },
      completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
      progress: { label: 'In Progress', color: 'bg-slate-100 text-slate-700' }
    }

    const badge = badges[status] || badges.progress
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>{badge.label}</span>
  }

  return (
    <div className="space-y-4">
      {/* Contact Customer Button */}
      {customerPhone && (
        <div className="flex gap-2">
          <button
            onClick={() => {
              setContactMethod('whatsapp')
              setShowContactModal(true)
            }}
            className="flex-1 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <MessageSquare className="w-4 h-4" />
            WhatsApp Customer
          </button>
          <button
            onClick={makeCall}
            className="flex-1 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Phone className="w-4 h-4" />
            Call Customer
          </button>
        </div>
      )}

      {/* Timeline History */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
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
                <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-slate-200" />
              )}

              {/* Timeline dot */}
              <div className="absolute left-0 top-1 w-4 h-4 bg-white border-2 border-blue-500 rounded-full" />

              {/* Content */}
              <div className="bg-slate-50 rounded-xl p-3 ml-2">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(update.status)}
                    <span className="text-xs font-medium text-slate-500">
                      {new Date(update.created_at).toLocaleString()}
                    </span>
                    {getStatusBadge(update.status)}
                  </div>
                  {update.details?.updated_by && (
                    <span className="text-xs text-slate-400">by {update.details.updated_by}</span>
                  )}
                </div>
                <p className="text-sm text-slate-700">{update.message}</p>

                {/* Photo if exists */}
                {update.photo_url && (
                  <div className="mt-2">
                    <img
                      src={update.photo_url}
                      alt="Update photo"
                      className="w-full max-h-48 object-cover rounded-lg cursor-pointer"
                      onClick={() => window.open(update.photo_url, '_blank')}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {timeline.length === 0 && (
          <div className="text-center py-8 text-slate-400">
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
          <h4 className="font-semibold text-slate-800">Add Service Update</h4>
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
                    className="flex items-center gap-2 p-2 text-left text-sm bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <template.icon className="w-3 h-3 text-slate-500" />
                    <span className="text-xs">{template.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Photo Preview */}
        {photoPreview && (
          <div className="relative mb-3">
            <img
              src={photoPreview}
              alt="Preview"
              className="w-full h-32 object-cover rounded-xl"
            />
            <button
              onClick={removePhoto}
              className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="flex flex-col gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Update customer about service progress..."
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none text-sm"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors flex items-center gap-1 text-sm"
              disabled={uploading}
            >
              <Camera className="w-4 h-4" />
              {uploading ? 'Uploading...' : 'Add Photo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            <button
              onClick={() => addTimelineUpdate(newMessage)}
              disabled={loading || (!newMessage.trim() && !selectedPhoto)}
              className="flex-1 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Post Update
            </button>
            {customerPhone && (
              <button
                type="button"
                onClick={() => {
                  setContactMessage(`Update service: ${newMessage || 'Progress update'}`)
                  setShowContactModal(true)
                }}
                className="px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                title="Kirim ke Customer"
              >
                <MessageSquare className="w-4 h-4" />
                Kirim
              </button>
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
          <Camera className="w-3 h-3" />
          Updates with photos will be visible to customer for service tracking
        </p>
      </GlassCard>

      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl w-full max-w-md p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-500" />
                <h3 className="text-lg font-bold">Contact Customer</h3>
              </div>
              <button onClick={() => setShowContactModal(false)} className="p-1">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  To: {customerName}
                </label>
                <p className="text-sm text-slate-500">{customerPhone}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Message (Optional)
                </label>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 resize-none"
                  placeholder={`Halo ${customerName}, saya teknisi yang menangani service device Anda...`}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={sendWhatsApp}
                  className="flex-1 bg-green-600 text-white py-2 rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  Send WhatsApp
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
