'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { ServiceOrder, ServiceItem } from '@/types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, Plus, X, Save, Calendar, Clock, User, Package, DollarSign, CheckCircle, AlertCircle, Trash2, Wrench, ChevronDown, ChevronUp } from 'lucide-react'
import { useUpload } from '@/hooks/useUpload'

interface ProgressUpdateProps {
  service: ServiceOrder
  onUpdate: () => void
  onAddSparepart?: () => void
  onAddJasa?: () => void
  onSubmitToQC?: () => void
}

export default function ProgressUpdate({ service, onUpdate, onAddSparepart, onAddJasa, onSubmitToQC }: ProgressUpdateProps) {
  const [step, setStep] = useState(1)
  const [showDetail, setShowDetail] = useState(false)
  const [items, setItems] = useState<ServiceItem[]>([])
  const [newItem, setNewItem] = useState({ name: '', price: 0, quantity: 1, item_type: 'jasa' as 'jasa' | 'sparepart' })
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [completionNotes, setCompletionNotes] = useState('')
  const [startDate, setStartDate] = useState(new Date())
  const [doneDate, setDoneDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()
  const { user } = useAuthStore()
  const { uploadFile } = useUpload()

  const calculateTotal = (itemsList: ServiceItem[]) =>
    itemsList.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0)
  const finalCost = calculateTotal(items)

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newPhotos = [...photos, ...files]
    setPhotos(newPhotos)
    const newPreviews = files.map((f) => URL.createObjectURL(f))
    setPhotoPreviews([...photoPreviews, ...newPreviews])
  }

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index])
    setPhotos(photos.filter((_, i) => i !== index))
    setPhotoPreviews(photoPreviews.filter((_, i) => i !== index))
  }

  const addItem = () => {
    if (!newItem.name || newItem.price <= 0) { toast.error('Fill item name and price'); return }
    const newItemObj: ServiceItem = { id: Date.now().toString(), name: newItem.name, price: newItem.price, quantity: newItem.quantity, item_type: newItem.item_type, service_order_id: service.id, created_at: new Date().toISOString() }
    setItems([...items, newItemObj])
    setNewItem({ name: '', price: 0, quantity: 1, item_type: 'jasa' })
  }

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index))

  const submitProgress = async () => {
    setLoading(true); setUploading(true)
    try {
      const newPhotoUrls: string[] = []
      for (let i = 0; i < photos.length; i++) {
        setProgress(Math.round((i / photos.length) * 100))
        const d = new Date();
        const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
        const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
        const dateStr = `${dayNames[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")} ${monthNames[d.getMonth()]} (${String(d.getMonth()+1).padStart(2,"0")}), ${d.getFullYear()}`;
        const caption = `tanggal : ${dateStr}\nteknisi : ${user?.full_name || '-'}\nupdate: ${completionNotes || 'Progress service'}\nstatus: ${service?.status || 'in_progress'}`;
        const url = await uploadFile(photos[i], { type: 'service', caption })
        if (url) { newPhotoUrls.push(url); await supabase.from('service_documentation').insert({ service_order_id: service.id, photo_url: url, stage: 'progress', uploaded_by: user?.id }) }
      }
      setProgress(100)
      if (items.length > 0) {
        for (const item of items) {
          await supabase.from('service_items').insert(item)
        }
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
        service_order_id: service.id, teknisi_id: user?.id, status: 'in_progress',
        message: `Service dalam pengerjaan. ${completionNotes ? 'Catatan: ' + completionNotes : ''}`,
        details: { items_count: items.length, photos_count: newPhotoUrls.length, final_cost: finalCost }
      })
      toast.success('Progress saved!')
      onUpdate()
    } catch (error: any) { toast.error(error.message) }
    finally { setLoading(false); setUploading(false); setProgress(0) }
  }

  return (
    <div className="space-y-5">
      {/* Primary actions: Add Jasa & Add Sparepart */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={onAddJasa}
          className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all text-sm">
          <Wrench className="w-4 h-4" /> TAMBAH JASA
        </button>
        <button onClick={onAddSparepart}
          className="flex items-center justify-center gap-2 py-3 bg-white text-gray-900 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-all text-sm">
          <Package className="w-4 h-4" /> TAMBAH SPAREPART
        </button>
      </div>

      {/* Submit to QC */}
      <button onClick={onSubmitToQC}
        className="w-full bg-gray-900 text-white font-semibold py-2.5 rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 text-sm">
        <CheckCircle className="w-4 h-4" /> SUBMIT TO QC
      </button>

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
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">Upload Foto Progress</h4>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {photoPreviews.map((preview, i) => (
                        <div key={i} className="relative group">
                          <img src={preview} alt="" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                          <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                      <button onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center h-24 hover:border-gray-900 transition-colors">
                        <Camera className="w-6 h-6 text-gray-300" />
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-3 text-sm">Item Tersimpan</h4>
                    {items.length === 0 ? (
                      <div className="text-center py-4 text-gray-400 text-sm">Belum ada item. Gunakan tombol TAMBAH JASA / TAMBAH SPAREPART di atas.</div>
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
                  <button onClick={submitProgress} disabled={loading} className="flex-1 bg-gray-900 text-white font-medium py-2 rounded-xl hover:bg-gray-800 disabled:opacity-50 text-sm">{loading ? 'Saving...' : 'Save Progress'}</button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
