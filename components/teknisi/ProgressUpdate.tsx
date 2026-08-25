'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { ServiceOrder } from '@/types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Plus, X, Save, Calendar, Clock, User, Package, DollarSign, CheckCircle, AlertCircle, Trash2, Wrench, ChevronDown, ChevronUp, Video, Pencil, Loader2 } from 'lucide-react'
import { useCentralUpload } from '@/hooks/useCentralUpload'
import { buildTelegramMetadata } from '@/lib/telegram-metadata'
import { isVideoFile } from '@/lib/upload/upload-config'
import { mediaTypeFromFile } from '@/lib/media-utils'
import { useBranchScope } from '@/lib/context/useBranchScope'
import { ensureVideoUnderLimit } from '@/lib/video-compress'
import VideoRecorderModal from '@/components/ui/VideoRecorderModal'

interface ProgressUpdateProps {
  service: ServiceOrder
  onUpdate: () => void
  onAddJasa?: () => void
  onSubmitToQC?: () => void
}

export default function ProgressUpdate({ service, onUpdate, onAddJasa, onSubmitToQC }: ProgressUpdateProps) {
  const [step, setStep] = useState(1)
  const [showDetail, setShowDetail] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [completionNotes, setCompletionNotes] = useState('')
  const [startDate, setStartDate] = useState(new Date())
  const [doneDate, setDoneDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { user } = useAuthStore()
  const [sessionKey] = useState(() => `progress_${service.id}_${Date.now()}`)
  const upload = useCentralUpload(sessionKey)
  const [localProgress, setLocalProgress] = useState(0)
  const { branchId } = useBranchScope()

  // ── Riwayat update milik teknisi ini ──
  interface TimelineEntry {
    id: string
    status: string
    message: string | null
    photo_url: string | null
    details: any
    created_at: string
    teknisi_id: string | null
  }
  const [history, setHistory] = useState<TimelineEntry[]>([])
  const [histLoading, setHistLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [savingEditId, setSavingEditId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showVideoRec, setShowVideoRec] = useState(false)

  const isLocked = ['completed', 'done'].includes(service.status)

  const loadHistory = useCallback(async () => {
    if (!service?.id) return
    setHistLoading(true)
    const { data } = await supabase
      .from('service_timeline')
      .select('*')
      .eq('service_order_id', service.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setHistory((data || []) as TimelineEntry[])
    setHistLoading(false)
  }, [service?.id])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  function canManage(entry: TimelineEntry) {
    return entry.teknisi_id === user?.id && !isLocked
  }

  async function saveEdit(entry: TimelineEntry) {
    if (!editText.trim()) {
      toast.error('Catatan tidak boleh kosong')
      return
    }
    setSavingEditId(entry.id)
    const { error } = await supabase.from('service_timeline').update({ message: editText.trim() }).eq('id', entry.id)
    setSavingEditId(null)
    if (error) {
      toast.error('Gagal mengubah update: ' + error.message)
      return
    }
    setEditingId(null)
    toast.success('Update berhasil diubah — tampilan tracking customer ikut terbarui')
    void loadHistory()
    onUpdate()
  }

  async function deleteEntry(entry: TimelineEntry) {
    setDeletingId(entry.id)
    try {
      // Hapus dokumentasi progress yang terkait entri ini (berdasarkan URL foto)
      const urls: string[] =
        entry.details?.all_photo_urls?.length > 0
          ? entry.details.all_photo_urls
          : entry.photo_url
            ? [entry.photo_url]
            : []

      if (urls.length > 0) {
        const { data: docs } = await supabase
          .from('service_documentation')
          .select('id, telegram_chat_id, telegram_message_id')
          .eq('service_order_id', service.id)
          .eq('stage', 'progress')
          .in('photo_url', urls)

        if (docs?.length) {
          for (const d of docs) {
            if (d.telegram_chat_id && d.telegram_message_id) {
              // Best-effort hapus salinan di Telegram channel
              await fetch('/api/telegram/delete-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: d.telegram_chat_id, message_id: d.telegram_message_id }),
              }).catch(() => {})
            }
          }
          const { error: delDocsErr } = await supabase
            .from('service_documentation')
            .delete()
            .in('id', docs.map((d) => d.id))
          if (delDocsErr) throw new Error('Gagal hapus dokumentasi: ' + delDocsErr.message)
        }
      }

      const { error } = await supabase.from('service_timeline').delete().eq('id', entry.id)
      if (error) throw new Error('Gagal menghapus update: ' + error.message)

      toast.success('Update dihapus — tracking customer ikut terbarui')
      void loadHistory()
      onUpdate()
    } catch (e: any) {
      toast.error(e.message || 'Gagal menghapus update')
    } finally {
      setDeletingId(null)
    }
  }

  const calculateTotal = (itemsList: any[]) =>
    itemsList.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
  const finalCost = calculateTotal(items)

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let files = Array.from(e.target.files || [])
    if (files.length === 0) return
    e.target.value = ''

    // Video >50MB dikompres otomatis sebelum masuk antrean upload
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      if (!isVideoFile(f) || f.size <= 50 * 1024 * 1024) continue
      const tid = toast.loading(`Mengompres ${f.name}... jangan tutup halaman`, { duration: 0 })
      try {
        const compressed = await ensureVideoUnderLimit(f, (p) =>
          toast.loading(`Mengompres ${f.name} — ${p}%`, { id: tid }),
        )
        files[i] = compressed
        toast.success(`${f.name} selesai dikompres (${(compressed.size / 1024 / 1024).toFixed(1)}MB)`)
      } catch (err: any) {
        toast.error(`${f.name}: ${err.message}`)
      }
      toast.dismiss(tid)
    }
    files = files.filter((f) => !!f)

    const result = await upload.addFiles(files)
    if (result.errors.length > 0) {
      result.errors.forEach((msg) => toast.error(msg))
    }
  }

  const removePhoto = (id: string) => {
    upload.removeFile(id)
  }

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index))

  const submitProgress = async () => {
     setLoading(true); setUploading(true)
     try {
       const d = new Date();
       const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
       const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
       const dateStr = `${dayNames[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")} ${monthNames[d.getMonth()]} (${String(d.getMonth()+1).padStart(2,"0")}), ${d.getFullYear()}`;
       const caption = `tanggal : ${dateStr}\nteknisi : ${user?.full_name || '-'}\nupdate: ${completionNotes || 'Progress service'}\nstatus: ${service?.status || 'in_progress'}`;

       const newPhotoUrls: string[] = []
        const mediaTypes: Array<'image' | 'video'> = []
        const filesToUpload = upload.pendingFiles.map((pf) => pf.file)
        if (filesToUpload.length > 0) {
          setLocalProgress(10)
          const timer = setInterval(() => {
            setLocalProgress((prev) => {
              if (prev >= 90) return prev
              return prev + 15
            })
          }, 400)

          const results = await upload.legacyUpload(
            filesToUpload,
            'service',
            caption,
            undefined,
            undefined,
            (p) => setLocalProgress(Math.min(85, 10 + Math.round(p * 0.75))),
          )
          clearInterval(timer)
          setLocalProgress(100)

          const pendingForUpload = upload.pendingFiles
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            if (result) {
              newPhotoUrls.push(result.url);
              const mt = pendingForUpload[i]
                ? mediaTypeFromFile(pendingForUpload[i].file)
                : 'image'
              mediaTypes.push(mt)
              await supabase.from('service_documentation').insert({
                 service_order_id: service.id,
                 photo_url: result.url,
                 stage: 'progress',
                 uploaded_by: user?.id,
                 media_type: mt,
                 ...buildTelegramMetadata(results),
               });
            }
          }
        }
        setLocalProgress(100)
        if (newPhotoUrls.length === 0 && filesToUpload.length > 0) {
          toast.error(`Gagal upload ${filesToUpload.length} foto. Cek koneksi dan coba lagi.`);
          setLoading(false);
          setUploading(false);
          return;
       }
       if (items.length > 0) {
         await supabase.from('service_items').insert(items)
       }
       const done = doneDate || new Date()
       const start = startDate
       const diffMs = done.getTime() - start.getTime()
       const workDuration = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
       await supabase.from('service_orders').update({
         status: 'in_progress', start_date: start.toISOString(), done_date: done.toISOString(),
         work_duration: workDuration, completion_notes: completionNotes, final_cost: finalCost,
       }).eq('id', service.id)
       await supabase.from('service_timeline').insert({
         service_order_id: service.id,
         teknisi_id: user?.id,
         status: 'in_progress',
         message: `Service dalam pengerjaan. ${completionNotes ? 'Catatan: ' + completionNotes : ''}`,
         photo_url: newPhotoUrls[0] || null,
         details: {
           items_count: items.length,
           photos_count: newPhotoUrls.length,
           all_photo_urls: newPhotoUrls,
           media_types: mediaTypes,
           media_type: mediaTypes[0] || null,
           final_cost: finalCost,
         },
       })
       console.log(`✅ Timeline entry created:`, {
         photo_url: newPhotoUrls[0] || null,
         total_photos: newPhotoUrls.length,
         photos: newPhotoUrls
       })
        toast.success('Progress saved!')
        void loadHistory()
        onUpdate()
     } catch (error: any) { toast.error(error.message) }
      finally { setLoading(false); setUploading(false); setLocalProgress(0) }
   }

  return (
    <div className="space-y-5">
      {/* Primary actions: Add Jasa */}
      <button onClick={onAddJasa}
        className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all text-sm">
        <Wrench className="w-4 h-4" /> TAMBAH JASA
      </button>

      {/* Submit to QC */}
      <button onClick={onSubmitToQC}
        className="w-full bg-gray-900 text-white font-semibold py-2.5 rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 text-sm">
        <CheckCircle className="w-4 h-4" /> SUBMIT TO QC
      </button>

      {/* Riwayat Update */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <h4 className="text-sm font-semibold text-gray-600">
          Riwayat Update {isLocked && <span className="text-[10px] text-gray-400 font-normal">(service selesai — riwayat terkunci)</span>}
        </h4>
        {histLoading ? (
          <p className="text-xs text-gray-400 py-2">Memuat...</p>
        ) : history.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">Belum ada update.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {history.map((entry) => {
              const mine = canManage(entry);
              const isEditing = editingId === entry.id;
              const mediaCount = entry.details?.all_photo_urls?.length || (entry.photo_url ? 1 : 0);
              return (
                <div key={entry.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-600 uppercase">{entry.status}</span>
                      <span className="text-[11px] text-gray-400">
                        {new Date(entry.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      {mediaCount > 0 && <span className="text-[10px] text-slate-400">📎 {mediaCount}</span>}
                    </div>
                    {mine && !isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setEditingId(entry.id); setEditText(entry.message || '') }} title="Edit catatan" className="p-1 rounded hover:bg-blue-50 text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
                        {deletingId === entry.id ? (
                          <>
                            <button onClick={() => deleteEntry(entry)} disabled className="p-1 rounded bg-red-100 text-red-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /></button>
                            <button onClick={() => setDeletingId(null)} className="text-[10px] px-1.5 py-1 rounded hover:bg-gray-100 text-gray-500">Batal</button>
                          </>
                        ) : (
                          <button onClick={() => setDeletingId(entry.id)} title="Hapus update ini" className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        )}
                      </div>
                    )}
                  </div>

                  {deletingId === entry.id ? (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                      Hapus update ini beserta {mediaCount} dokumentasinya? Tampilan tracking customer ikut berubah.
                      <div className="flex gap-2 mt-1.5">
                        <button onClick={() => deleteEntry(entry)} className="px-2.5 py-1 rounded-md bg-red-600 text-white font-semibold">Ya, Hapus</button>
                        <button onClick={() => setDeletingId(null)} className="px-2.5 py-1 rounded-md border border-gray-300 text-gray-500">Batal</button>
                      </div>
                    </div>
                  ) : isEditing ? (
                    <div className="mt-2 space-y-1.5">
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
                          onClick={() => saveEdit(entry)}
                          disabled={savingEditId === entry.id || !editText.trim()}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {savingEditId === entry.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                          Simpan & Sinkronkan
                        </button>
                      </div>
                    </div>
                  ) : (
                    entry.message && <p className={`mt-1 whitespace-pre-wrap ${mine ? 'text-gray-800' : 'text-gray-600'}`}>{entry.message}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Update (collapsible wizard) */}
      <div className="border-t border-gray-200 pt-4">
        <button onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-center justify-between text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors">
          <span>Detail Update (Foto &amp; Ringkasan)</span>
          {showDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        <AnimatePresence>
          {showDetail && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              {/* Step indicator */}
              <div className="flex items-center justify-between my-4">
                {[1, 2, 3].map((s) => (
                  <div key={s} className="flex-1 text-center">
                    <div className={`w-7 h-7 rounded-full mx-auto flex items-center justify-center text-[10px] font-bold ${step >= s ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>{s}</div>
                    <p className="text-[10px] mt-1 text-gray-400">{s === 1 ? 'Foto' : s === 2 ? 'Items' : 'Ringkasan'}</p>
                  </div>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">Upload Foto/Video Progress</h4>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {upload.pendingFiles.map((pf, i) => (
                        <div key={pf.id} className="relative group">
                          {isVideoFile(pf.file) ? (
                            <video src={pf.preview} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                          ) : (
                            <img src={pf.preview} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                          )}
                          <button onClick={() => removePhoto(pf.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <button onClick={() => fileInputRef.current?.click()} title="Pilih Foto" className="border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center h-24 hover:border-blue-600 transition-colors">
                        <Camera className="w-6 h-6 text-gray-300" />
                        <span className="text-[10px] text-gray-400 mt-0.5">Foto</span>
                      </button>
                      <button onClick={() => videoInputRef.current?.click()} title="Pilih Video" className="border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center h-24 hover:border-blue-600 transition-colors">
                        <Video className="w-6 h-6 text-gray-300" />
                        <span className="text-[10px] text-gray-400 mt-0.5">Video</span>
                      </button>
                      <button onClick={() => setShowVideoRec(true)} title="Rekam Video" className="border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center h-24 hover:border-emerald-600 transition-colors">
                        <Video className="w-6 h-6 text-emerald-400" />
                        <span className="text-[10px] text-gray-400 mt-0.5">Rekam</span>
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                      <input ref={videoInputRef} type="file" accept="video/*" multiple onChange={handlePhotoUpload} className="hidden" />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">Item Tersimpan</h4>
                    {items.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">Belum ada item. Gunakan tombol TAMBAH JASA di atas atau TAMBAH SPAREPART dari detail service.</div>
                    ) : (
                      <div className="space-y-1.5 mb-3">
                        {items.map((item, i) => (
                          <div key={i} className="flex justify-between items-center p-2 bg-white rounded-lg border border-gray-200">
                            <div className="flex items-center gap-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${item.item_type === 'jasa' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{item.item_type === 'jasa' ? 'JASA' : 'SPR'}</span>
                              <span className="text-sm font-medium text-gray-900">{item.name}</span>
                              <span className="text-xs text-gray-500">{item.quantity}x @{item.price.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-900">Rp {(item.price * item.quantity).toLocaleString()}</span>
                              <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">Ringkasan</h4>
                    <div className="space-y-2">
                      <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Tanggal Mulai</label><input type="date" value={startDate.toISOString().split('T')[0]} onChange={(e) => setStartDate(new Date(e.target.value))} className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900" /></div>
                      <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Tanggal Selesai (opsional)</label><input type="date" value={doneDate?.toISOString().split('T')[0] || ''} onChange={(e) => setDoneDate(e.target.value ? new Date(e.target.value) : null)} className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900" /></div>
                      <div><label className="block text-xs font-medium text-gray-600 mb-0.5">Catatan</label><textarea value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} rows={2} className="w-full px-3 py-1.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900" placeholder="Catatan pengerjaan..." /></div>
                      <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
                        <span className="text-sm font-bold text-gray-900">Total Biaya</span>
                        <span className="text-lg font-bold text-gray-900">Rp {finalCost.toLocaleString()}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between gap-3 mt-3">
                {step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 bg-white text-gray-900 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm">Back</button>}
                {step < 3 ? (
                  <button onClick={() => setStep(step + 1)} className="flex-1 bg-gray-900 text-white font-medium py-2 rounded-xl hover:bg-gray-800 transition-all text-sm">Continue</button>
                ) : (
                  <>
                    {uploading && (
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span>Mengirim bukti...</span>
                          <span>{localProgress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-gray-900 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${localProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <button onClick={submitProgress} disabled={loading} className="flex-1 bg-gray-900 text-white font-medium py-2 rounded-xl hover:bg-gray-800 disabled:opacity-50 text-sm">{loading ? 'Saving...' : 'Save Progress'}</button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <VideoRecorderModal
        open={showVideoRec}
        onClose={() => setShowVideoRec(false)}
        onConfirm={(file) => {
          setShowVideoRec(false);
          void handlePhotoUpload({ target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>);
        }}
      />
    </div>
  )
}
