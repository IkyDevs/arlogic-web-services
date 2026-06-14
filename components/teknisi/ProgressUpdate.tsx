'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { ServiceOrder, ServiceItem } from '@/types'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, X, Plus, Trash2, Send, CheckCircle,
  Image as ImageIcon, Package, FileText, ArrowRight,
  DollarSign, AlertTriangle
} from 'lucide-react'
import { useUpload } from '@/hooks/useUpload'

interface ProgressUpdateProps {
  service: ServiceOrder
  onUpdate: () => void
}

const STEP_LABELS = ['PHOTOS', 'ITEMS', 'SUMMARY']

export default function ProgressUpdate({ service, onUpdate }: ProgressUpdateProps) {
  const supabase = createClient()
  const { user } = useAuthStore()
  const { uploadFile, uploading, progress } = useUpload()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [initialPhotos, setInitialPhotos] = useState<string[]>([])  // kondisi awal dari admin
  const [items, setItems] = useState<ServiceItem[]>([])
  const [newItem, setNewItem] = useState({ name: '', price: 0, quantity: 1, item_type: 'jasa' as 'jasa' | 'sparepart' })
  const [completionNotes, setCompletionNotes] = useState('')
  const [finalCost, setFinalCost] = useState(Number(service.final_cost) || Number(service.estimated_cost) || 0)
  const [loading, setLoading] = useState(false)

  // Load initial condition photos from admin
  useEffect(() => {
    const fetchInitialPhotos = async () => {
      const { data } = await supabase
        .from('service_documentation')
        .select('photo_url')
        .eq('service_order_id', service.id)
        .eq('stage', 'initial_condition')
      if (data) setInitialPhotos(data.map(d => d.photo_url))
    }
    fetchInitialPhotos()
  }, [service.id])

  const calcTotal = (list: ServiceItem[]) =>
    list.reduce((sum, i) => sum + i.price * i.quantity, 0)

  const handleAddPhoto = (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    setPhotos(p => [...p, ...valid])
    valid.forEach(f => setPhotoPreviews(p => [...p, URL.createObjectURL(f)]))
  }

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photoPreviews[i])
    setPhotos(p => p.filter((_, idx) => idx !== i))
    setPhotoPreviews(p => p.filter((_, idx) => idx !== i))
  }

  const addItem = () => {
    if (!newItem.name.trim() || newItem.price <= 0) {
      toast.error('Fill item name and price')
      return
    }
    const item: ServiceItem = {
      ...newItem,
      id: Date.now().toString(),
      service_order_id: service.id,
      created_at: new Date().toISOString(),
    }
    const updated = [...items, item]
    setItems(updated)
    setFinalCost(calcTotal(updated))
    setNewItem({ name: '', price: 0, quantity: 1, item_type: 'jasa' })
  }

  const removeItem = (i: number) => {
    const updated = items.filter((_, idx) => idx !== i)
    setItems(updated)
    setFinalCost(calcTotal(updated))
  }

  const nextStep = () => {
    if (step === 1 && photos.length === 0) {
      toast.error('Upload at least 1 progress photo')
      return
    }
    setStep(s => s + 1)
  }

  const submitProgress = async () => {
    setLoading(true)
    try {
      // 1. Upload progress photos
      const uploadedUrls: string[] = []
      for (const photo of photos) {
        const url = await uploadFile(photo, { type: 'service' })
        if (url) uploadedUrls.push(url)
      }

      if (uploadedUrls.length === 0 && photos.length > 0) {
        throw new Error('Photo upload failed. Check your internet connection.')
      }

      // 2. Save documentation
      for (const url of uploadedUrls) {
        await supabase.from('service_documentation').insert({
          service_order_id: service.id,
          photo_url: url,
          stage: 'progress',
          uploaded_by: user?.id,
        })
      }

      // 3. Save service items
      for (const item of items) {
        await supabase.from('service_items').insert({
          service_order_id: service.id,
          item_type: item.item_type,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })
      }

      // 4. Update service order → qc_pending
      const now = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({
          final_cost: finalCost,
          status: 'qc_pending',
          done_date: now,
          completion_notes: completionNotes || null,
        })
        .eq('id', service.id)
      if (updateError) throw updateError

      // 5. Add timeline entry
      await supabase.from('service_timeline').insert({
        service_order_id: service.id,
        teknisi_id: user?.id,
        status: 'qc_pending',
        message: completionNotes || 'Service selesai, menunggu QC review',
        photo_url: uploadedUrls[0] || null,
      })

      // 6. Activity log
      await supabase.from('activity_logs').insert({
        user_id: user?.id,
        action: 'UPDATE_PROGRESS',
        details: { service_id: service.id, photos: uploadedUrls.length, items: items.length, final_cost: finalCost },
      })

      toast.success('Progress submitted for QC review!')
      onUpdate()
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex border-2 border-black">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className={`flex-1 py-2 text-center font-black text-xs border-r-2 border-black last:border-r-0 transition-colors ${
            step === i + 1 ? (i === 0 ? 'bg-[#FF6B9D] text-white' : i === 1 ? 'bg-[#FFDE00] text-black' : 'bg-[#3B82F6] text-white')
            : step > i + 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-400'
          }`}>
            {step > i + 1 ? '✓ ' : ''}{label}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Progress Photos ─────────────────────────────────────── */}
        {step === 1 && (
          <motion.div key="p1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

            {/* Initial condition reference */}
            {initialPhotos.length > 0 && (
              <div className="border-2 border-black bg-[#FFDE00] p-3 mb-4">
                <p className="text-xs font-black uppercase mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> KONDISI AWAL (dari Admin)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {initialPhotos.map((src, i) => (
                    <img key={i} src={src} alt={`Kondisi awal ${i + 1}`}
                      className="w-full h-24 object-cover border-2 border-black cursor-pointer hover:opacity-80"
                      onClick={() => window.open(src, '_blank')} />
                  ))}
                </div>
              </div>
            )}

            <div className="border-2 border-black bg-white p-4">
              <p className="font-black text-sm mb-3 flex items-center gap-2">
                <Camera className="w-4 h-4" /> FOTO PROGRES SERVICE
                <span className="ml-auto text-[10px] font-mono text-gray-400">Min. 1 foto</span>
              </p>

              {/* Photo grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="relative group border-2 border-black overflow-hidden">
                    <img src={src} alt={`Foto ${i + 1}`} className="w-full h-28 object-cover" />
                    <button onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] font-mono py-0.5 px-1">
                      Foto {i + 1}
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => cameraInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 bg-[#FF6B9D] text-white border-2 border-black shadow-[3px_3px_0_0_black] hover:shadow-[1px_1px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-black text-sm transition-all">
                  <Camera className="w-4 h-4" /> KAMERA
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                  multiple onChange={e => handleAddPhoto(e.target.files)} className="hidden" />

                <button onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 py-3 bg-white border-2 border-black shadow-[3px_3px_0_0_black] hover:shadow-[1px_1px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-black text-sm transition-all">
                  <ImageIcon className="w-4 h-4" /> GALERI
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple
                  onChange={e => handleAddPhoto(e.target.files)} className="hidden" />
              </div>

              {photos.length > 0 && (
                <p className="text-[10px] font-mono text-green-600 mt-2 text-center">{photos.length} foto dipilih</p>
              )}
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6B9D] text-white border-2 border-black shadow-[4px_4px_0_0_black] hover:shadow-[2px_2px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-black text-sm transition-all">
                NEXT <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Service Items ───────────────────────────────────────── */}
        {step === 2 && (
          <motion.div key="p2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="border-2 border-black bg-white p-4">
              <p className="font-black text-sm mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" /> JASA & SPAREPART
                <span className="ml-auto text-[10px] font-mono text-gray-400">Opsional</span>
              </p>

              {/* Existing items */}
              {items.length > 0 && (
                <div className="mb-3 border-2 border-black overflow-hidden">
                  {items.map((item, i) => (
                    <div key={i} className={`flex items-center justify-between p-2.5 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${i < items.length - 1 ? 'border-b border-black' : ''}`}>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 border border-black ${item.item_type === 'jasa' ? 'bg-[#3B82F6] text-white' : 'bg-[#FF6B9D] text-white'}`}>
                            {item.item_type.toUpperCase()}
                          </span>
                          <span className="font-bold text-sm">{item.name}</span>
                        </div>
                        <p className="text-xs font-mono text-gray-500 mt-0.5">
                          {item.quantity} × Rp {item.price.toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-black font-mono text-sm">Rp {(item.price * item.quantity).toLocaleString()}</span>
                        <button onClick={() => removeItem(i)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-2.5 bg-[#FFDE00] border-t-2 border-black">
                    <span className="font-black text-sm">TOTAL</span>
                    <span className="font-black font-mono">Rp {calcTotal(items).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Add item form */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={newItem.item_type}
                    onChange={e => setNewItem(p => ({ ...p, item_type: e.target.value as 'jasa' | 'sparepart' }))}
                    className="px-3 py-2 border-2 border-black font-mono text-sm focus:outline-none bg-white">
                    <option value="jasa">Jasa Service</option>
                    <option value="sparepart">Sparepart</option>
                  </select>
                  <input type="number" placeholder="Qty" min="1" value={newItem.quantity}
                    onChange={e => setNewItem(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                    className="px-3 py-2 border-2 border-black font-mono text-sm focus:outline-none" />
                </div>
                <input type="text" placeholder="Nama item (e.g. Cleaning Service)" value={newItem.name}
                  onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 border-2 border-black font-mono text-sm focus:outline-none" />
                <div className="flex gap-2">
                  <input type="number" placeholder="Harga (Rp)" min="0" value={newItem.price || ''}
                    onChange={e => setNewItem(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                    className="flex-1 px-3 py-2 border-2 border-black font-mono text-sm focus:outline-none" />
                  <button onClick={addItem}
                    className="px-4 py-2 bg-[#FFDE00] border-2 border-black shadow-[3px_3px_0_0_black] hover:shadow-[1px_1px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-black text-sm transition-all flex items-center gap-1">
                    <Plus className="w-4 h-4" /> ADD
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(1)}
                className="px-5 py-2.5 border-2 border-black bg-white font-black text-sm hover:bg-gray-50">
                ← BACK
              </button>
              <button onClick={() => setStep(3)}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#FFDE00] text-black border-2 border-black shadow-[4px_4px_0_0_black] hover:shadow-[2px_2px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-black text-sm transition-all">
                NEXT <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Summary & Submit ────────────────────────────────────── */}
        {step === 3 && (
          <motion.div key="p3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="border-2 border-black bg-white p-4">
              <p className="font-black text-sm mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> SUMMARY & SUBMIT
              </p>

              {/* Photo count */}
              <div className="flex items-center justify-between py-2.5 border-b-2 border-black">
                <span className="font-mono text-sm">Progress Photos</span>
                <span className="font-black">{photos.length} foto</span>
              </div>

              {/* Items total */}
              <div className="flex items-center justify-between py-2.5 border-b-2 border-black">
                <span className="font-mono text-sm">Service Items</span>
                <span className="font-black">{items.length} item(s)</span>
              </div>

              {/* Total cost */}
              <div className="flex items-center justify-between py-3 border-b-2 border-black">
                <span className="font-mono text-sm flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" /> Total Cost
                </span>
                <span className="font-black font-mono text-[#FF6B9D]">
                  Rp {finalCost.toLocaleString()}
                </span>
              </div>

              {/* Completion notes */}
              <div className="mt-3">
                <label className="block text-xs font-black uppercase mb-1.5">Catatan Penyelesaian</label>
                <textarea value={completionNotes}
                  onChange={e => setCompletionNotes(e.target.value)}
                  rows={3} placeholder="Jelaskan apa yang sudah dikerjakan, hasil diagnosa, dll..."
                  className="w-full px-3 py-2 border-2 border-black font-mono text-sm resize-none focus:outline-none shadow-[3px_3px_0_0_black] focus:shadow-none focus:translate-x-[3px] focus:translate-y-[3px] transition-all" />
              </div>

              {/* Warning */}
              <div className="mt-3 p-3 bg-[#FFDE00] border-2 border-black flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-mono">
                  Setelah submit, status service akan berubah ke <strong>QC Pending</strong> dan supervisor akan me-review pekerjaan kamu.
                </p>
              </div>
            </div>

            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(2)}
                className="px-5 py-2.5 border-2 border-black bg-white font-black text-sm hover:bg-gray-50">
                ← BACK
              </button>
              <button onClick={submitProgress} disabled={loading || uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#3B82F6] text-white border-2 border-black shadow-[4px_4px_0_0_black] hover:shadow-[2px_2px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-black text-sm transition-all disabled:opacity-50">
                {loading || uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    {uploading ? `${progress}%` : 'SUBMITTING...'}
                  </>
                ) : (
                  <><Send className="w-4 h-4" /> SUBMIT TO QC</>
                )}
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Upload progress overlay */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white border-2 border-black shadow-[6px_6px_0_0_black] p-4 w-56 z-50">
          <p className="font-black text-xs mb-2">UPLOADING...</p>
          <div className="h-2 bg-gray-200 border border-black overflow-hidden">
            <div className="h-full bg-[#3B82F6] transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="font-mono text-[10px] text-gray-500 mt-1">{progress}%</p>
        </div>
      )}
    </div>
  )
}
