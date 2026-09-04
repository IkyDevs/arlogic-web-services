'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useCentralUpload } from '@/hooks/useCentralUpload'
import { buildTelegramMetadata } from '@/lib/telegram-metadata'
import { isVideoFile } from '@/lib/upload/upload-config'
import { mediaTypeFromFile } from '@/lib/media-utils'
import SmartMedia from '@/components/ui/SmartMedia'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Send, CheckCircle, AlertCircle,
  Wrench, Package, Camera, User, MessageSquare,
  ChevronDown, ChevronUp, Phone,
  Check, X, Loader, Plus, ExternalLink, Video,
  Pencil, Trash2, Save, Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { normalizePhone, buildWhatsAppUrl, buildTimelineUpdateMessage, isValidWhatsAppPhone } from '@/lib/whatsapp'

interface ServiceTimelineProps {
  serviceId: string
  customerPhone?: string
  customerName?: string
  invoiceNumber?: string
  onUpdate?: () => void
}

const updateTemplates = [
  { icon: Wrench, label: 'Diagnosis', message: 'Melakukan diagnosis awal pada jam tangan', status: 'diagnosis' },
  { icon: Package, label: 'Pesan Sparepart', message: 'Memesan sparepart yang dibutuhkan', status: 'parts_ordered' },
  { icon: Camera, label: 'Foto Progress', message: 'Upload foto progress service', status: 'progress_photo' },
  { icon: CheckCircle, label: 'Testing', message: 'Melakukan testing setelah perbaikan', status: 'testing' },
  { icon: AlertCircle, label: 'Temuan Baru', message: 'Menemukan kendala tambahan pada device', status: 'issue_found' },
  { icon: User, label: 'Konsultasi', message: 'Konsultasi dengan customer', status: 'consultation' },
  { icon: Check, label: 'Selesai', message: 'Service selesai, siap diambil customer', status: 'completed' },
]

export default function ServiceTimeline({ serviceId, customerPhone, customerName, invoiceNumber, onUpdate }: ServiceTimelineProps) {
  const [timeline, setTimeline] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [spareparts, setSpareparts] = useState<Array<{ name: string; qty: number; price: number }>>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const recordInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { user } = useAuthStore()
  const [sessionKey] = useState(() => `timeline_${serviceId}_${Date.now()}`)
  const upload = useCentralUpload(sessionKey)
  const [uploading, setUploading] = useState(false)
  const [localProgress, setLocalProgress] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [whatsappUpdate, setWhatsappUpdate] = useState<any | null>(null)

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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    e.target.value = ''

    if (files.length > 0) {
      const result = await upload.addFiles(files)
      if (result.errors.length > 0) {
        result.errors.forEach((msg) => toast.error(msg))
      }
    }
  }

  const removePhoto = (id: string) => {
    upload.removeFile(id)
  }

  const addTimelineUpdate = async (message: string, status?: string) => {
    if (!message.trim()) { toast.error('Masukkan pesan'); return }
    setLoading(true)
    const filesToUpload = upload.pendingFiles.map((pf) => pf.file)
    try {
      const d = new Date();
      const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      const dateStr = `${dayNames[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")} ${monthNames[d.getMonth()]} (${String(d.getMonth()+1).padStart(2,"0")}), ${d.getFullYear()}`;
      const fullCaption = `tanggal : ${dateStr}\nteknisi : ${user?.full_name || '-'}\nupdate: ${message || 'Progress service'}\nstatus: ${status || 'in_progress'}`;

      const newPhotoUrls: string[] = []
      const mediaTypes: Array<'image' | 'video'> = []

      if (filesToUpload.length > 0) {
        const mediaTypeHints = filesToUpload.map((f) => mediaTypeFromFile(f))
        setUploading(true)
        setLocalProgress(10)
        const timer = setInterval(() => {
          setLocalProgress((prev) => {
            if (prev >= 90) return prev
            return prev + 15
          })
        }, 400)

        const results = await upload.legacyUpload(
          filesToUpload,
          'teknisi_update',
          fullCaption,
          undefined,
          undefined,
          undefined,
          (p) => setLocalProgress(Math.min(85, 10 + Math.round(p * 0.75))),
        )
        clearInterval(timer)
        setLocalProgress(100)

        for (let i = 0; i < results.length; i++) {
          const result = results[i]
          if (result) {
            newPhotoUrls.push(result.url)
            mediaTypes.push(mediaTypeHints[i] || 'image')
          }
        }
      }

      if (newPhotoUrls.length === 0 && filesToUpload.length > 0) {
        toast.error(`Gagal upload ${filesToUpload.length} foto. Cek koneksi dan coba lagi.`)
        setLoading(false)
        setUploading(false)
        return
      }

      const telegramMeta = buildTelegramMetadata(
        newPhotoUrls.map((url, i) => ({ url, chat_id: '', message_id: 0 }))
      )

      const { error: timelineError } = await supabase.from('service_timeline').insert({
        service_order_id: serviceId, teknisi_id: user?.id, status: status || 'in_progress',
        message: message || 'Progress service',
        photo_url: newPhotoUrls[0] || null,
        details: {
          updated_by: user?.full_name,
          timestamp: new Date().toISOString(),
          has_photo: newPhotoUrls.length > 0,
          photos_count: newPhotoUrls.length,
          all_photo_urls: newPhotoUrls,
          media_types: mediaTypes,
          media_type: mediaTypes[0] || null,
        },
        ...telegramMeta,
      })
      if (timelineError) throw timelineError

      toast.success('Update added!')
      setNewMessage('')
      await upload.clear()
      if (onUpdate) onUpdate()
    } catch (error: any) { toast.error(error.message) }
    finally { setLoading(false); setUploading(false); setLocalProgress(0) }
  }

  const saveEdit = async (entry: any) => {
    if (!editText.trim()) { toast.error('Catatan tidak boleh kosong'); return }
    setSavingEditId(entry.id)
    const { error } = await supabase.from('service_timeline').update({ message: editText.trim() }).eq('id', entry.id)
    setSavingEditId(null)
    if (error) { toast.error('Gagal mengubah update: ' + error.message); return }
    setEditingId(null)
    toast.success('Update berhasil diubah')
    fetchTimeline()
    if (onUpdate) onUpdate()
  }

  const deleteEntry = async (entry: any) => {
    setDeletingId(entry.id)
    try {
      const urls: string[] =
        entry.details?.all_photo_urls?.length > 0
          ? entry.details.all_photo_urls
          : entry.photo_url
            ? [entry.photo_url]
            : []

      if (urls.length > 0) {
        const { data: docs } = await supabase
          .from('service_documentation')
          .select('id')
          .eq('service_order_id', serviceId)
          .in('photo_url', urls)

        if (docs?.length) {
          await supabase.from('service_documentation').delete().in('id', docs.map((d) => d.id))
        }
      }

      const { error } = await supabase.from('service_timeline').delete().eq('id', entry.id)
      if (error) throw new Error('Gagal menghapus update: ' + error.message)

      toast.success('Update dihapus')
      fetchTimeline()
      if (onUpdate) onUpdate()
    } catch (e: any) {
      toast.error(e.message || 'Gagal menghapus update')
    } finally {
      setDeletingId(null)
    }
  }

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      diagnosis: { label: 'Diagnosis', color: 'bg-orange-100 text-orange-700 border border-orange-200' },
      parts_ordered: { label: 'Sparepart', color: 'bg-purple-100 text-purple-700 border border-purple-200' },
      progress_photo: { label: 'Progress', color: 'bg-blue-100 text-blue-700 border border-blue-200' },
      testing: { label: 'Testing', color: 'bg-cyan-100 text-cyan-700 border border-cyan-200' },
      issue_found: { label: 'Temuan', color: 'bg-red-100 text-red-700 border border-red-200' },
      consultation: { label: 'Konsultasi', color: 'bg-yellow-100 text-yellow-700 border border-yellow-200' },
      completed: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
      progress: { label: 'Progress', color: 'bg-gray-100 text-gray-700 border border-gray-200' }
    }
    return badges[status] || badges.progress
  }

  const openWhatsAppForUpdate = () => {
    if (!whatsappUpdate) return
    const phone = normalizePhone(customerPhone)
    if (!phone) {
      toast.error('Nomor WhatsApp customer belum tersedia atau tidak valid.')
      return
    }
    const caption = whatsappUpdate.message || 'Progress service'
    const message = buildTimelineUpdateMessage(caption)
    const url = buildWhatsAppUrl(phone, message)
    try {
      window.open(url, '_blank')
      toast.success('Membuka WhatsApp...')
    } catch {
      toast.error('WhatsApp tidak dapat dibuka otomatis. Silakan izinkan popup pada browser atau buka WhatsApp secara manual.')
    }
    setWhatsappUpdate(null)
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
                      <div className="flex items-center gap-1">
                        {update.details?.updated_by && <span className="text-[10px] text-gray-400">oleh {update.details.updated_by}</span>}
                        {update.teknisi_id === user?.id && editingId !== update.id && deletingId !== update.id && (
                          <div className="flex items-center gap-0.5 ml-1">
                            <button onClick={() => { setEditingId(update.id); setEditText(update.message || '') }} title="Edit catatan" className="p-1 rounded hover:bg-blue-50 text-blue-500"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => setDeletingId(update.id)} title="Hapus update ini" className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        )}
                        {isValidWhatsAppPhone(customerPhone) && editingId !== update.id && deletingId !== update.id && (
                          <button
                            onClick={() => setWhatsappUpdate(update)}
                            title="Kirim update ini ke WhatsApp customer"
                            className="p-1 rounded hover:bg-green-50 text-green-600 hover:text-green-700 ml-0.5"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {deletingId === update.id ? (
                      <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                        Hapus update ini beserta fotonya?
                        <div className="flex gap-2 mt-1.5">
                          <button onClick={() => deleteEntry(update)} className="px-2.5 py-1 rounded-md bg-red-600 text-white font-semibold">
                            Ya, Hapus
                          </button>
                          <button onClick={() => setDeletingId(null)} className="px-2.5 py-1 rounded-md border border-gray-300 text-gray-500">Batal</button>
                        </div>
                      </div>
                    ) : editingId === update.id ? (
                      <div className="space-y-1.5">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          autoFocus
                          className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500"
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50">Batal</button>
                          <button
                            onClick={() => saveEdit(update)}
                            disabled={savingEditId === update.id || !editText.trim()}
                            className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                          >
                            {savingEditId === update.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Simpan
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700">{update.message}</p>
                    )}
                    {(() => {
                      const urls: string[] = update.photo_urls?.length
                        ? update.photo_urls
                        : update.details?.all_photo_urls?.length
                          ? update.details.all_photo_urls
                          : update.photo_url
                            ? [update.photo_url]
                            : []
                      const types: string[] = update.media_types?.length
                        ? update.media_types
                        : update.details?.media_types?.length
                          ? update.details.media_types
                          : update.details?.media_type
                            ? [update.details.media_type]
                            : []
                      if (urls.length === 0) return null
                      return (
                        <div className={`grid gap-2 mt-2 ${urls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                          {urls.map((url: string, i: number) => (
                            <SmartMedia
                              key={`${update.id}-${i}`}
                              src={url}
                              mediaType={types[i] || types[0] || null}
                              imgClassName="rounded-lg border border-gray-200 max-h-40 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              videoClassName="rounded-lg border border-gray-200 max-h-48 w-full object-contain bg-black"
                              imgOnClick={() => window.open(url, '_blank')}
                            />
                          ))}
                        </div>
                      )
                    })()}
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

        {upload.pendingFiles.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {upload.pendingFiles.map((pf) => (
              <div key={pf.id} className="relative group">
                {isVideoFile(pf.file) ? (
                  <video src={pf.preview} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                ) : (
                  <img src={pf.preview} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                )}
                <button onClick={() => removePhoto(pf.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}



        {uploading && (
          <div className="mb-3 rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm flex items-center gap-2" role="status" aria-live="polite">
            <Loader className="w-4 h-4 animate-spin" />
            <span className="flex-1">Mengirim...</span>
            <span className="font-semibold tabular-nums">{localProgress}%</span>
          </div>
        )}

        <textarea value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Tulis update progress service..." rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 resize-none" />

        <div className="flex gap-2 mt-2 flex-wrap">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center gap-1">
            <Camera className="w-4 h-4" /> Foto
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />

          <button
            onClick={() => recordInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center gap-1">
            <Video className="w-4 h-4" /> Rekam Langsung
          </button>
          <input
            ref={recordInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          <button onClick={() => videoInputRef.current?.click()} disabled={uploading}
            className="px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors text-sm flex items-center gap-1">
            <Camera className="w-4 h-4" /> Video Galeri
          </button>
          <input ref={videoInputRef} type="file" accept="video/*" multiple onChange={handlePhotoSelect} className="hidden" />

          <button onClick={() => addTimelineUpdate(newMessage)} disabled={loading || (!newMessage.trim() && upload.pendingFiles.length === 0)}
            className="flex-1 min-w-[100px] px-4 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-1">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Kirim
          </button>

        </div>
      </div>
      {/* WhatsApp Confirmation Modal */}
      <AnimatePresence>
        {whatsappUpdate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={() => setWhatsappUpdate(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5"
            >
              <div className="flex items-center gap-2 mb-3">
                <ExternalLink className="w-5 h-5 text-green-600" />
                <h3 className="text-sm font-bold text-gray-900">Kirim Update ke WhatsApp?</h3>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1.5 font-medium">Preview pesan:</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {buildTimelineUpdateMessage(whatsappUpdate.message || 'Progress service')}
                </p>
              </div>

              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                Foto/video tidak akan dikirim otomatis. Foto/video perlu dilampirkan secara manual setelah WhatsApp dibuka.
              </p>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setWhatsappUpdate(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={openWhatsAppForUpdate}
                  className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3 h-3" />
                  Lanjut ke WhatsApp
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
