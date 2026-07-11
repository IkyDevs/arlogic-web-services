'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useUpload } from '@/hooks/useUpload'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Send, CheckCircle, AlertCircle,
  Wrench, Package, Camera, User, MessageSquare,
  ChevronDown, ChevronUp, Phone,
  Check, X, Loader, Plus, ExternalLink
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ServiceTimelineProps {
  serviceId: string
  customerPhone?: string
  customerName?: string
  invoiceNumber?: string
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

export default function ServiceTimeline({ serviceId, customerPhone, customerName, invoiceNumber, onUpdate }: ServiceTimelineProps) {
  const [timeline, setTimeline] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { user } = useAuthStore()
  const { uploadFile, uploading, progress } = useUpload()

  useEffect(() => {
    fetchTimeline()
    const subscription = supabase.channel(`timeline_${serviceId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'service_timeline', filter: `service_order_id=eq.${serviceId}` }, () => fetchTimeline())
      .subscribe()
    return () => { subscription.unsubscribe() }
  }, [serviceId])

  const fetchTimeline = async () => {
    const { data } = await supabase.from('service_timeline').select('*').eq('service_order_id', serviceId).order('created_at', { ascending: true })
    if (data) setTimeline(data)
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const removePhoto = () => {
    setSelectedPhoto(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const addTimelineUpdate = async (message: string, status?: string) => {
    if (!message.trim()) { toast.error('Please enter a message'); return }
    setLoading(true)
    let photoUrl = null
    try {
      const d = new Date();
      const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      const dateStr = `${dayNames[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")} ${monthNames[d.getMonth()]} (${String(d.getMonth()+1).padStart(2,"0")}), ${d.getFullYear()}`;
      if (selectedPhoto) {
        const uploadResult = await uploadFile(selectedPhoto, { type: 'service', caption: `tanggal : ${dateStr}\nteknisi : ${user?.full_name || '-'}\nupdate: ${message}\nstatus: ${status || 'progress'}` })
        if (!uploadResult) { toast.error('Failed to upload photo'); return }
        photoUrl = uploadResult.url
      }
       const { error } = await supabase.from('service_timeline').insert({
         service_order_id: serviceId, teknisi_id: user?.id, status: status || 'in_progress',
         message, photo_url: photoUrl,
         details: { updated_by: user?.full_name, timestamp: new Date().toISOString(), has_photo: !!photoUrl }
       })
      if (error) throw error
      toast.success('Update added!')
      setNewMessage('')
      removePhoto()
      if (onUpdate) onUpdate()
    } catch (error: any) { toast.error(error.message) }
    finally { setLoading(false) }
  }

  const sendToCustomer = () => {
    if (!customerPhone) { toast.error('No customer phone'); return }
    let phone = customerPhone.replace(/\D/g, '')
    if (phone.startsWith('0')) phone = '62' + phone.substring(1)
    const msg = newMessage.trim() || 'Ada update progress service Anda. Silakan cek tracking untuk info lebih lanjut.'
    const fullMsg = encodeURIComponent(
      `Halo ${customerName || 'Customer'},\n\n` +
      `Update Service ${invoiceNumber ? '(' + invoiceNumber + ')' : ''}:\n` +
      `${msg}\n\n` +
      `Terima kasih.\n- ${user?.full_name || 'Teknisi'}`
    )
    window.open(`https://wa.me/${phone}?text=${fullMsg}`, '_blank')
    toast.success('Membuka WhatsApp...')
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      diagnosis: { label: 'Diagnosis', color: 'bg-orange-100 text-orange-700 border border-orange-200' },
      parts_ordered: { label: 'Parts Ordered', color: 'bg-purple-100 text-purple-700 border border-purple-200' },
      progress_photo: { label: 'Progress', color: 'bg-blue-100 text-blue-700 border border-blue-200' },
      testing: { label: 'Testing', color: 'bg-cyan-100 text-cyan-700 border border-cyan-200' },
      issue_found: { label: 'Issue Found', color: 'bg-red-100 text-red-700 border border-red-200' },
      consultation: { label: 'Consultation', color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
      completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
      progress: { label: 'In Progress', color: 'bg-gray-100 text-gray-700 border border-gray-200' }
    }
    return badges[status] || badges.progress
  }

  return (
    <div className="space-y-4">
      {/* Timeline History */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {timeline.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Belum ada update</p>
            <p className="text-xs">Tambahkan update pertama untuk memberi informasi ke customer</p>
          </div>
        ) : (
          <AnimatePresence>
            {timeline.map((update, index) => {
              const badge = getStatusBadge(update.status)
              return (
                <motion.div key={update.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }}
                  className="relative pl-6 pb-4 last:pb-0">
                  {index < timeline.length - 1 && <div className="absolute left-2.5 top-4 bottom-0 w-0.5 bg-gray-200" />}
                  <div className="absolute left-0 top-1.5 w-5 h-5 bg-white border-2 border-gray-400 rounded-full flex items-center justify-center" />
                  <div className="bg-gray-50 rounded-xl p-3 ml-1 border border-gray-200">
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] text-gray-500">{new Date(update.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.color}`}>{badge.label}</span>
                      </div>
                      {update.details?.updated_by && <span className="text-[10px] text-gray-400">oleh {update.details.updated_by}</span>}
                    </div>
                    <p className="text-sm text-gray-700">{update.message}</p>
                    {update.photo_url && (
                      <img src={update.photo_url} alt="Update" className="mt-2 rounded-lg border border-gray-200 max-h-40 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(update.photo_url, '_blank')} />
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Add New Update */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-gray-600" />
            <h4 className="text-sm font-semibold text-gray-900">Tambah Update</h4>
          </div>
          <button onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 font-medium">
            {showTemplates ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Template
          </button>
        </div>

        <AnimatePresence>
          {showTemplates && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3 overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {updateTemplates.map((t, i) => (
                  <button key={i} onClick={() => { setNewMessage(t.message); setShowTemplates(false) }}
                    className="flex items-center gap-1.5 p-2 text-xs bg-white rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                    <t.icon className="w-3 h-3 text-gray-500" />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {photoPreview && (
          <div className="relative mb-3">
            <img src={photoPreview} alt="Preview" className="w-full h-28 object-cover rounded-xl border border-gray-200" />
            <button onClick={removePhoto} className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"><X className="w-4 h-4" /></button>
          </div>
        )}

        <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Tulis update progress service..." rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 resize-none" />

        <div className="flex gap-2 mt-2 flex-wrap">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center gap-1">
            <Camera className="w-4 h-4" />{uploading ? `${progress}%` : 'Foto'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />

          <button onClick={() => addTimelineUpdate(newMessage)} disabled={loading || (!newMessage.trim() && !selectedPhoto)}
            className="flex-1 min-w-[100px] px-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-1">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Kirim
          </button>

          {/* Kirim ke CS via WA */}
          {customerPhone && (
            <button onClick={sendToCustomer}
              className="px-3 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-1">
              <ExternalLink className="w-4 h-4" /> Kirim ke CS
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
