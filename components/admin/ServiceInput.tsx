'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Watch, Calendar, Send, CheckCircle,
  AlertCircle, ArrowRight, Settings, Battery,
  Cpu, Sparkles, Camera, X, Image as ImageIcon,
  Hash, Phone
} from 'lucide-react'
import { useUpload } from '@/hooks/useUpload'
import dynamic from 'next/dynamic'

const QRCodeGenerator = dynamic(() => import('@/components/admin/QRCodeGenerator'), {
  loading: () => <div className="border-2 border-black p-4 text-center font-mono text-sm">Loading QR...</div>
})

const watchMovements = [
  { value: 'automatic', label: 'AUTOMATIC', icon: Settings, color: 'pink' },
  { value: 'quartz', label: 'QUARTZ', icon: Battery, color: 'yellow' },
  { value: 'mechanical', label: 'MECHANICAL', icon: Cpu, color: 'blue' },
]

const watchBrands = [
  'ROLEX', 'OMEGA', 'TAG HEUER', 'CASIO', 'SEIKO',
  'CITIZEN', 'TISSOT', 'LONGINES', 'BREITLING', 'CARTIER',
  'APPLE WATCH', 'SAMSUNG WATCH', 'GARMIN'
]

const STEP_LABELS = ['CUSTOMER', 'WATCH', 'PHOTOS', 'ISSUE']
const STEP_COLORS = ['bg-[#FF6B9D] text-white', 'bg-[#FFDE00] text-black', 'bg-[#3B82F6] text-white', 'bg-black text-white']

export default function ServiceInput() {
  const supabase = createClient()
  const { uploadFile, uploading, progress } = useUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    cs_name: '',
    cs_phone: '',
    serial_number: '',
    watch_brand: '',
    watch_model: '',
    watch_year: '',
    watch_movement: '',
    problem: '',
    request: '',
    notes: ''
  })
  const [photos, setPhotos] = useState<File[]>([])
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lastInvoice, setLastInvoice] = useState<{ invoice: string; token: string; serviceId: string } | null>(null)
  const [step, setStep] = useState(1)

  const generateInvoiceNumber = () => {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    return `WATCH-${y}${m}${day}-${rand}`
  }

  const generateToken = () => Math.random().toString(36).substring(2, 15).toUpperCase()

  const handleAddPhoto = (files: FileList | null) => {
    if (!files) return
    const newFiles = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (newFiles.length === 0) return
    setPhotos(prev => [...prev, ...newFiles])
    newFiles.forEach(f => {
      const url = URL.createObjectURL(f)
      setPhotoPreviews(prev => [...prev, url])
    })
  }

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photoPreviews[i])
    setPhotos(prev => prev.filter((_, idx) => idx !== i))
    setPhotoPreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const nextStep = () => {
    if (step === 1 && (!formData.cs_name.trim() || !formData.cs_phone.trim())) {
      toast.error('Fill customer name and phone!')
      return
    }
    if (step === 2 && (!formData.watch_brand.trim() || !formData.watch_movement)) {
      toast.error('Fill watch brand and movement!')
      return
    }
    // Step 3 (photos) is optional — warn but allow skip
    if (step === 3 && photos.length === 0) {
      toast('No photos added. Teknisi won\'t have initial condition reference.', { icon: '⚠️' })
    }
    if (step === 4 && !formData.problem.trim()) {
      toast.error('Describe the problem!')
      return
    }
    setStep(s => s + 1)
  }

  const prevStep = () => setStep(s => s - 1)

  const handleSubmit = async () => {
    if (!formData.problem.trim()) {
      toast.error('Describe the problem!')
      return
    }
    setLoading(true)

    try {
      const invoiceNumber = generateInvoiceNumber()
      const token = generateToken()
      const tokenExpiresAt = new Date()
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30)

      const { data: orderData, error } = await supabase
        .from('service_orders')
        .insert([{
          invoice_number: invoiceNumber,
          token,
          token_expires_at: tokenExpiresAt.toISOString(),
          customer_name: formData.cs_name,
          customer_phone: formData.cs_phone,
          serial_number: formData.serial_number || null,
          device_type: 'smartwatch',
          device_brand: formData.watch_brand,
          device_model: formData.watch_model || null,
          watch_brand: formData.watch_brand,
          watch_model: formData.watch_model || null,
          watch_year: formData.watch_year ? parseInt(formData.watch_year) : null,
          watch_movement: formData.watch_movement,
          issue_description: formData.problem,
          request: formData.request || null,
          notes: formData.notes || null,
          status: 'pending',
        }])
        .select('id')
        .single()

      if (error) throw error

      const serviceId = orderData.id

      // Upload initial condition photos
      if (photos.length > 0) {
        for (const photo of photos) {
          const url = await uploadFile(photo, { type: 'service' })
          if (url) {
            await supabase.from('service_documentation').insert({
              service_order_id: serviceId,
              photo_url: url,
              stage: 'initial_condition',
              uploaded_by: (await supabase.auth.getUser()).data.user?.id,
            })
          }
        }
      }

      setLastInvoice({ invoice: invoiceNumber, token, serviceId })
      setSuccess(true)
      setStep(5)
      toast.success('Watch service order created!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to create order')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    photoPreviews.forEach(url => URL.revokeObjectURL(url))
    setFormData({ cs_name: '', cs_phone: '', serial_number: '', watch_brand: '', watch_model: '', watch_year: '', watch_movement: '', problem: '', request: '', notes: '' })
    setPhotos([])
    setPhotoPreviews([])
    setSuccess(false)
    setStep(1)
    setLastInvoice(null)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-[#FF6B9D] flex items-center justify-center border-2 border-black shadow-[4px_4px_0_0_black]">
          <Watch className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-black tracking-tighter">NEW WATCH SERVICE</h2>
          <p className="text-xs font-mono">Create service order for timepiece</p>
        </div>
      </div>

      {/* Progress Bar (steps 1–4) */}
      {step <= 4 && (
        <div className="flex mb-8 border-2 border-black">
          {STEP_LABELS.map((label, i) => (
            <div
              key={i}
              className={`flex-1 py-2.5 text-center font-black text-xs border-r-2 border-black last:border-r-0 transition-colors ${
                step > i + 1 ? 'bg-gray-100 text-gray-400' : step === i + 1 ? STEP_COLORS[i] : 'bg-white text-gray-400'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Customer ─────────────────────────────────────────── */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_black]">
            <StepHeader icon={<User />} title="CUSTOMER INFO" step="1/4" color="bg-[#FF6B9D] text-white" />
            <div className="space-y-4 mt-5">
              <Field label="Full Name *">
                <input type="text" value={formData.cs_name}
                  onChange={e => setFormData(p => ({ ...p, cs_name: e.target.value }))}
                  className="input-brutal w-full" placeholder="John Doe" />
              </Field>
              <Field label="WhatsApp / Phone *">
                <input type="tel" value={formData.cs_phone}
                  onChange={e => setFormData(p => ({ ...p, cs_phone: e.target.value }))}
                  className="input-brutal w-full" placeholder="+62 812 3456 7890" />
              </Field>
              <Field label="Serial Number">
                <input type="text" value={formData.serial_number}
                  onChange={e => setFormData(p => ({ ...p, serial_number: e.target.value }))}
                  className="input-brutal w-full" placeholder="Watch serial number (optional)" />
              </Field>
              <Field label="In Date">
                <div className="flex items-center gap-2 px-3 py-2 border-2 border-black bg-gray-50 font-mono text-sm">
                  <Calendar className="w-4 h-4 text-[#FF6B9D]" />
                  {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </Field>
            </div>
            <div className="flex justify-end mt-6">
              <BtnNext onClick={nextStep} color="bg-[#FF6B9D] text-white" />
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Watch Details ─────────────────────────────────────── */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_black]">
            <StepHeader icon={<Watch />} title="WATCH DETAILS" step="2/4" color="bg-[#FFDE00] text-black" />
            <div className="space-y-4 mt-5">
              <Field label="Brand *">
                <input type="text" list="watchBrandsList" value={formData.watch_brand}
                  onChange={e => setFormData(p => ({ ...p, watch_brand: e.target.value.toUpperCase() }))}
                  className="input-brutal w-full uppercase" placeholder="ROLEX, OMEGA, CASIO..." />
                <datalist id="watchBrandsList">
                  {watchBrands.map(b => <option key={b} value={b} />)}
                </datalist>
              </Field>
              <Field label="Model">
                <input type="text" value={formData.watch_model}
                  onChange={e => setFormData(p => ({ ...p, watch_model: e.target.value.toUpperCase() }))}
                  className="input-brutal w-full uppercase" placeholder="SUBMARINER, SPEEDMASTER..." />
              </Field>
              <Field label="Year">
                <input type="number" value={formData.watch_year}
                  onChange={e => setFormData(p => ({ ...p, watch_year: e.target.value }))}
                  className="input-brutal w-full" placeholder="e.g. 2020" min="1900" max={new Date().getFullYear()} />
              </Field>
              <Field label="Movement *">
                <div className="grid grid-cols-3 gap-2">
                  {watchMovements.map(m => (
                    <button key={m.value} type="button"
                      onClick={() => setFormData(p => ({ ...p, watch_movement: m.value }))}
                      className={`py-3 text-xs font-black border-2 border-black flex flex-col items-center gap-1 transition-all ${
                        formData.watch_movement === m.value
                          ? m.color === 'pink' ? 'bg-[#FF6B9D] text-white shadow-[3px_3px_0_0_black]'
                            : m.color === 'yellow' ? 'bg-[#FFDE00] text-black shadow-[3px_3px_0_0_black]'
                            : 'bg-[#3B82F6] text-white shadow-[3px_3px_0_0_black]'
                          : 'bg-white text-black hover:bg-gray-50'
                      }`}>
                      <m.icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="flex justify-between mt-6">
              <BtnBack onClick={prevStep} />
              <BtnNext onClick={nextStep} color="bg-[#FFDE00] text-black" />
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Photos (Initial Condition) ───────────────────────── */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_black]">
            <StepHeader icon={<Camera />} title="INITIAL CONDITION PHOTOS" step="3/4" color="bg-[#3B82F6] text-white" />
            <p className="text-xs font-mono text-gray-500 mt-2 mb-5">
              Foto kondisi jam sebelum diservice. Teknisi dan QC akan melihat ini sebagai referensi awal.
            </p>

            {/* Photo Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {photoPreviews.map((src, i) => (
                <div key={i} className="relative group border-2 border-black overflow-hidden">
                  <img src={src} alt={`Foto ${i + 1}`} className="w-full h-36 object-cover" />
                  <button onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-red-600 text-white p-1 border border-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] font-mono py-0.5 px-1">
                    Foto {i + 1}
                  </div>
                </div>
              ))}
            </div>

            {/* Upload Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-2">
              {/* Camera capture */}
              <button onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 bg-[#FF6B9D] text-white border-2 border-black shadow-[4px_4px_0_0_black] hover:shadow-[2px_2px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-mono font-black text-sm transition-all">
                <Camera className="w-4 h-4" />
                KAMERA
              </button>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                multiple onChange={e => handleAddPhoto(e.target.files)} className="hidden" />

              {/* File picker */}
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-3 bg-white border-2 border-black shadow-[4px_4px_0_0_black] hover:shadow-[2px_2px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-mono font-black text-sm transition-all">
                <ImageIcon className="w-4 h-4" />
                GALERI
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple
                onChange={e => handleAddPhoto(e.target.files)} className="hidden" />
            </div>

            <p className="text-[10px] font-mono text-gray-400 text-center">
              {photos.length > 0 ? `${photos.length} foto dipilih` : 'Opsional — bisa di-skip'}
            </p>

            <div className="flex justify-between mt-6">
              <BtnBack onClick={prevStep} />
              <BtnNext onClick={nextStep} color="bg-[#3B82F6] text-white" label={photos.length === 0 ? 'SKIP →' : undefined} />
            </div>
          </motion.div>
        )}

        {/* ── STEP 4: Issue ─────────────────────────────────────────────── */}
        {step === 4 && (
          <motion.div key="s4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="border-2 border-black bg-white p-6 shadow-[6px_6px_0_0_black]">
            <StepHeader icon={<AlertCircle />} title="SERVICE ISSUE" step="4/4" color="bg-black text-white" />
            <div className="space-y-4 mt-5">
              <Field label="Problem / Kendala *">
                <textarea value={formData.problem}
                  onChange={e => setFormData(p => ({ ...p, problem: e.target.value }))}
                  rows={3} className="input-brutal w-full resize-none"
                  placeholder="Describe the watch issue in detail..." />
              </Field>
              <Field label="Customer Request">
                <textarea value={formData.request}
                  onChange={e => setFormData(p => ({ ...p, request: e.target.value }))}
                  rows={2} className="input-brutal w-full resize-none"
                  placeholder="Special requests from customer..." />
              </Field>
              <Field label="Additional Notes">
                <textarea value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  rows={2} className="input-brutal w-full resize-none"
                  placeholder="Any additional notes..." />
              </Field>

              {/* Summary */}
              <div className="p-4 border-2 border-black bg-[#F5F5F5]">
                <p className="text-xs font-black uppercase mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#FFDE00]" /> SUMMARY
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
                  <span className="text-gray-500">Customer:</span><span className="font-bold">{formData.cs_name || '—'}</span>
                  <span className="text-gray-500">Watch:</span><span className="font-bold">{[formData.watch_brand, formData.watch_model].filter(Boolean).join(' ') || '—'}</span>
                  <span className="text-gray-500">Movement:</span><span className="font-bold uppercase">{formData.watch_movement || '—'}</span>
                  <span className="text-gray-500">Photos:</span><span className="font-bold">{photos.length} foto</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <BtnBack onClick={prevStep} />
              <button onClick={handleSubmit} disabled={loading || uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#FF6B9D] text-white border-2 border-black shadow-[4px_4px_0_0_black] hover:shadow-[2px_2px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-black text-sm transition-all disabled:opacity-50">
                {loading || uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    {uploading ? `UPLOADING ${progress}%` : 'CREATING...'}
                  </>
                ) : (
                  <><Send className="w-4 h-4" /> CREATE ORDER</>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 5: Success ───────────────────────────────────────────── */}
        {step === 5 && success && lastInvoice && (
          <motion.div key="s5" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-black bg-white p-8 text-center shadow-[8px_8px_0_0_black]">
            <div className="w-16 h-16 bg-[#FF6B9D] flex items-center justify-center mx-auto mb-4 border-2 border-black">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-black mb-1">ORDER CREATED!</h3>
            <p className="font-mono text-sm text-gray-600 mb-5">
              Watch service order berhasil dibuat{photos.length > 0 ? ` dengan ${photos.length} foto kondisi awal` : ''}.
            </p>

            <div className="border-2 border-black p-4 mb-5 bg-[#F5F5F5] text-left">
              <div className="mb-3">
                <p className="text-[10px] font-black uppercase text-gray-500">INVOICE NUMBER</p>
                <p className="text-xl font-black font-mono">{lastInvoice.invoice}</p>
              </div>
              <div className="border-t border-black pt-3">
                <p className="text-[10px] font-black uppercase text-gray-500">TRACKING TOKEN</p>
                <p className="text-lg font-black font-mono text-[#FF6B9D]">{lastInvoice.token}</p>
              </div>
            </div>

            <div className="flex justify-center mb-5">
              <QRCodeGenerator
                invoiceNumber={lastInvoice.invoice}
                token={lastInvoice.token}
                customerName={formData.cs_name}
              />
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={resetForm}
                className="px-5 py-2 border-2 border-black bg-white font-black text-sm hover:bg-gray-100 transition-colors">
                NEW ORDER
              </button>
              <button onClick={() => { navigator.clipboard.writeText(lastInvoice.token); toast.success('Token copied!') }}
                className="px-5 py-2 bg-[#FFDE00] border-2 border-black shadow-[3px_3px_0_0_black] hover:translate-x-[1px] hover:translate-y-[1px] font-black text-sm transition-all">
                COPY TOKEN
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Upload progress toast */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white border-2 border-black shadow-[6px_6px_0_0_black] p-4 w-64 z-50">
          <p className="font-mono font-black text-xs mb-2">UPLOADING PHOTOS...</p>
          <div className="h-2 bg-gray-200 border border-black overflow-hidden">
            <div className="h-full bg-[#FF6B9D] transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <p className="font-mono text-[10px] text-gray-500 mt-1">{progress}% complete</p>
        </div>
      )}
    </div>
  )
}

// ─── Helper Components ─────────────────────────────────────────────────────

function StepHeader({ icon, title, step, color }: { icon: React.ReactNode; title: string; step: string; color: string }) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b-2 border-black">
      <div className={`w-8 h-8 flex items-center justify-center border-2 border-black ${color}`}>
        {icon}
      </div>
      <h3 className="text-lg font-black">{title}</h3>
      <span className={`ml-auto text-xs font-mono px-2 py-0.5 border border-black ${color}`}>{step}</span>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-black uppercase mb-1">{label}</label>
      {children}
    </div>
  )
}

function BtnNext({ onClick, color = 'bg-[#3B82F6] text-white', label }: { onClick: () => void; color?: string; label?: string }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2.5 border-2 border-black shadow-[4px_4px_0_0_black] hover:shadow-[2px_2px_0_0_black] hover:translate-x-[2px] hover:translate-y-[2px] font-black text-sm transition-all ${color}`}>
      {label ?? 'NEXT'} <ArrowRight className="w-4 h-4" />
    </button>
  )
}

function BtnBack({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="px-6 py-2.5 border-2 border-black bg-white font-black text-sm hover:bg-gray-50 transition-colors">
      ← BACK
    </button>
  )
}
