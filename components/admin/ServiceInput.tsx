'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Watch, Calendar, Send, CheckCircle,
  AlertCircle, ArrowRight, Settings, Battery,
  Cpu, Sparkles, Camera, X, Image as ImageIcon,
  Hash, Phone, Loader2, RotateCw, Smartphone, Circle, DollarSign
} from 'lucide-react'
import { useUpload } from '@/hooks/useUpload'
import dynamic from 'next/dynamic'

const QRCodeGenerator = dynamic(() => import('@/components/admin/QRCodeGenerator'), {
  loading: () => <div className="text-center py-4 text-sm text-slate-400">Loading QR...</div>
})

// Updated watch movements
const watchMovements = [
  { value: 'automatic', label: 'AUTOMATIC', icon: Settings },
  { value: 'quartz', label: 'QUARTZ', icon: Battery },
  { value: 'digital', label: 'DIGITAL', icon: RotateCw },
  { value: 'smartwatch', label: 'SMARTWATCH', icon: Smartphone },
]

const watchBrands = [
  'ROLEX', 'OMEGA', 'TAG HEUER', 'CASIO', 'SEIKO',
  'CITIZEN', 'TISSOT', 'LONGINES', 'BREITLING', 'CARTIER',
  'APPLE WATCH', 'SAMSUNG WATCH', 'GARMIN', 'FOSSIL', 'SWATCH'
]

const STEP_LABELS = ['Customer', 'Watch', 'Photos', 'Issue']

export default function ServiceInput() {
  const supabase = createClient()
  const { uploadFile, uploadFiles, uploading, progress } = useUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    cs_name: '',
    cs_phone: '',
    category: '',
    serial_number: '',
    watch_brand: '',
    watch_model: '',
    watch_movement: '',
    problem: '',
    request: '',
    notes: '',
    down_payment: '',
    payment_method: 'cash',
    qris_photo: null as File | null
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

      const dpValue = formData.down_payment ? parseInt(formData.down_payment) : 0
      
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
          watch_movement: formData.watch_movement,
          category: formData.category || null,
          down_payment: dpValue,
          payment_method: formData.payment_method || 'cash',
          issue_description: formData.problem,
          request: formData.request || null,
          notes: formData.notes || null,
          status: 'pending',
        }])
        .select('id')
        .single()

      if (error) throw error

      const serviceId = orderData.id

      // Upload QRIS photo if payment method is QRIS - merge with initial condition photos
      if (formData.payment_method === 'qris' && formData.qris_photo) {
        const qrisUrl = await uploadFile(formData.qris_photo, { type: 'service' })
        if (qrisUrl) {
          await supabase.from('service_documentation').insert({
            service_order_id: serviceId,
            photo_url: qrisUrl,
            stage: 'initial_condition',
            uploaded_by: (await supabase.auth.getUser()).data.user?.id,
          })
        }
      }

      if (photos.length > 0) {
        const now = new Date().toLocaleString('id-ID', { 
          day: 'numeric', month: 'long', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })

        const formattedCaption = 
`Kategori : ${formData.category || '—'}
CS :  ${formData.cs_name}
WA : ${formData.cs_phone}
Seri : ${formData.serial_number || '—'}
Tipe : ${formData.watch_movement ? formData.watch_movement.toUpperCase() : '—'}
Kendala : ${formData.problem}
Request : ${formData.request || '—'}
Keterangan : ${formData.notes || '—'}
dp : ${dpValue ? `Rp ${dpValue.toLocaleString('id-ID')}` : '—'}
Pembayaran : ${formData.payment_method === 'qris' ? 'QRIS' : 'Cash'}
Teknisi : —
In : ${now}
Start : —
Done : —
Pengerjaan :
Barang :
Jasa :
Total : —
Keterangan : —
`

        const urls = await uploadFiles(photos, {
          type: 'service',
          caption: formattedCaption,
        })

        for (const url of urls) {
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
    setFormData({
      cs_name: '', cs_phone: '', category: '', serial_number: '',
      watch_brand: '',       watch_model: '', watch_movement: '',
      problem: '', request: '', notes: '', down_payment: '',
      payment_method: 'cash', qris_photo: null
    })
    setPhotos([])
    setPhotoPreviews([])
    setSuccess(false)
    setStep(1)
    setLastInvoice(null)
  }

  return (
    <div className="max-w-3xl mx-auto py-3 sm:py-4 px-0 sm:px-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 sm:mb-6 px-4 sm:px-0">
        <div className="w-10 h-10 bg-[#4DB2FF] rounded-xl flex items-center justify-center flex-shrink-0">
          <Watch className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-900 truncate">New Watch Service</h2>
          <p className="text-xs sm:text-sm text-slate-400 truncate">Create service order for timepiece</p>
        </div>
      </div>

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Customer ─────────────────────────────────────────── */}
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-[24px] border border-[#4DB2FF]/20 p-4 sm:p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#4DB2FF]/20">
              <User className="w-4 h-4 text-[#4DB2FF]" />
              <h3 className="font-semibold text-slate-900">Customer Information</h3>
              <span className="ml-auto text-xs text-slate-400 font-medium">1/4</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-[#FF5F87]">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/1 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.cs_name}
                    onChange={e => setFormData(p => ({ ...p, cs_name: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#4DB2FF]/20 rounded-xl focus:outline-none focus:border-[#4DB2FF] focus:ring-2 focus:ring-[#4DB2FF]/10 transition-all text-sm"
                    placeholder="John Doe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  WhatsApp / Phone <span className="text-[#FF5F87]">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/1 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.cs_phone}
                    onChange={e => setFormData(p => ({ ...p, cs_phone: e.target.value.replace(/[^0-9]/g, '') }))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#4DB2FF]/20 rounded-xl focus:outline-none focus:border-[#4DB2FF] focus:ring-2 focus:ring-[#4DB2FF]/10 transition-all text-sm"
                    placeholder="81234567890"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Serial Number
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/1 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={e => setFormData(p => ({ ...p, serial_number: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#4DB2FF]/20 rounded-xl focus:outline-none focus:border-[#4DB2FF] focus:ring-2 focus:ring-[#4DB2FF]/10 transition-all text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#4DB2FF] text-white rounded-xl hover:bg-[#3aa0f5] transition-all text-sm font-medium"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Watch Details ─────────────────────────────────────── */}
        {step === 2 && (
          <motion.div
            key="s2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-[24px] border border-[#4DB2FF]/20 p-4 sm:p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#4DB2FF]/20">
              <Watch className="w-4 h-4 text-[#4DB2FF]" />
              <h3 className="font-semibold text-slate-900">Watch Details</h3>
              <span className="ml-auto text-xs text-slate-400 font-medium">2/4</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Brand <span className="text-[#FF5F87]">*</span>
                </label>
                <input
                  type="text"
                  list="watchBrandsList"
                  value={formData.watch_brand}
                  onChange={e => setFormData(p => ({ ...p, watch_brand: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2.5 bg-white border border-[#4DB2FF]/20 rounded-xl focus:outline-none focus:border-[#4DB2FF] focus:ring-2 focus:ring-[#4DB2FF]/10 transition-all text-sm uppercase"
                  placeholder="ROLEX, OMEGA, CASIO..."
                />
                <datalist id="watchBrandsList">
                  {watchBrands.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Model
                </label>
                <input
                  type="text"
                  value={formData.watch_model}
                  onChange={e => setFormData(p => ({ ...p, watch_model: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2.5 bg-white border border-[#4DB2FF]/20 rounded-xl focus:outline-none focus:border-[#4DB2FF] focus:ring-2 focus:ring-[#4DB2FF]/10 transition-all text-sm uppercase"
                  placeholder="SUBMARINER, SPEEDMASTER..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Tipe Jam <span className="text-[#FF5F87]">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                   {watchMovements.map(m => (
                    <button
                      key={m.value}
                      type="button"
                       onClick={() => setFormData(p => ({ ...p, watch_movement: m.value }))}
                       className={`py-3 text-xs font-medium rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                         formData.watch_movement === m.value
                          ? 'border-[#4DB2FF] bg-[#4DB2FF] text-white'
                          : 'border-[#4DB2FF]/20 bg-white text-slate-600 hover:border-[#4DB2FF]/40'
                      }`}
                    >
                      <m.icon className="w-5 h-5" />
                      {m.label}
                    </button>
                  ))}
                </div>
               </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Category / Kategori
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData(p => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-white border border-[#4DB2FF]/20 rounded-xl focus:outline-none focus:border-[#4DB2FF] focus:ring-2 focus:ring-[#4DB2FF]/10 transition-all text-sm"
                  placeholder="e.g. Ganti Battery, Service Ringkas..."
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 sm:gap-0 mt-4 sm:mt-6">
              <button
                onClick={prevStep}
                className="w-full sm:w-auto px-5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={nextStep}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

         {/* ── STEP 3: Photos ───────────────────────────────────────────── */}
         {step === 3 && (
           <motion.div
             key="s3"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             className="bg-white rounded-[24px] border border-[#4DB2FF]/20 p-4 sm:p-6 shadow-sm"
           >
             <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#4DB2FF]/20">
               <Camera className="w-4 h-4 text-[#4DB2FF]" />
               <h3 className="font-semibold text-slate-900">Initial Condition Photos</h3>
               <span className="ml-auto text-xs text-slate-400 font-medium">3/4</span>
             </div>

            <p className="text-sm text-slate-500 mb-4">
              Photos of the watch before service. Teknisi will use this as reference.
            </p>

            {/* Photo Grid */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="relative group border border-slate-200 rounded-lg overflow-hidden">
                    <img src={src} alt={`Foto ${i + 1}`} className="w-full h-28 object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1.5 right-1.5 bg-white p-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-slate-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium text-slate-900"
              >
                <ImageIcon className="w-4 h-4" />
                Upload from Gallery
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={e => handleAddPhoto(e.target.files)}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={e => handleAddPhoto(e.target.files)}
                className="hidden"
              />
            </div>

            <p className="text-xs text-slate-400 mt-3">
              {photos.length > 0 ? `${photos.length} photos selected` : 'Optional — can be skipped'}
            </p>

            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="px-5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
              >
                {photos.length === 0 ? 'Skip →' : 'Continue →'}
              </button>
            </div>
          </motion.div>
        )}

         {/* ── STEP 4: Issue ─────────────────────────────────────────────── */}
         {step === 4 && (
           <motion.div
             key="s4"
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             className="bg-white rounded-[24px] border border-[#4DB2FF]/20 p-4 sm:p-6 shadow-sm"
           >
             <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#4DB2FF]/20">
               <AlertCircle className="w-4 h-4 text-[#4DB2FF]" />
               <h3 className="font-semibold text-slate-900">Service Issue</h3>
               <span className="ml-auto text-xs text-slate-400 font-medium">4/4</span>
             </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Problem / Kendala <span className="text-emerald-600">*</span>
                </label>
                <textarea
                  value={formData.problem}
                  onChange={e => setFormData(p => ({ ...p, problem: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all resize-none text-sm"
                  placeholder="Describe the watch issue in detail..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Customer Request
                </label>
                <textarea
                  value={formData.request}
                  onChange={e => setFormData(p => ({ ...p, request: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all resize-none text-sm"
                  placeholder="Special requests from customer..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Additional Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all resize-none text-sm"
                  placeholder="Any additional notes..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Down Payment (DP)
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.down_payment}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '')
                      setFormData(p => ({ ...p, down_payment: raw }))
                    }}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Metode Pembayaran
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, payment_method: 'cash' }))}
                    className={`w-full sm:w-auto flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      formData.payment_method === 'cash'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, payment_method: 'qris' }))}
                    className={`w-full sm:w-auto flex-1 sm:flex-none px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      formData.payment_method === 'qris'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    QRIS
                  </button>
                </div>
              </div>

              {formData.payment_method === 'qris' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Foto Bukti QRIS <span className="text-emerald-600">*</span>
                  </label>
                  <div
                    onClick={() => document.getElementById('qris-photo-input')?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-slate-900 transition-all"
                  >
                    {formData.qris_photo ? (
                      <div className="flex items-center gap-3">
                        <ImageIcon className="w-8 h-8 text-green-500" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-900">{formData.qris_photo.name}</p>
                          <p className="text-xs text-slate-400">Klik untuk ganti</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">Klik untuk upload bukti QRIS</p>
                      </div>
                    )}
                    <input
                      id="qris-photo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setFormData(p => ({ ...p, qris_photo: file }))
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Summary
                </p>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-medium text-slate-900">{formData.cs_name || '—'}</span>
                  <span className="text-slate-500">Watch:</span>
                  <span className="font-medium text-slate-900">{[formData.watch_brand, formData.watch_model].filter(Boolean).join(' ') || '—'}</span>
                  <span className="text-slate-500">Movement:</span>
                  <span className="font-medium text-slate-900 uppercase">{formData.watch_movement || '—'}</span>
                  <span className="text-slate-500">Category:</span>
                  <span className="font-medium text-slate-900">{formData.category || '—'}</span>
                  <span className="text-slate-500">Down Payment:</span>
                  <span className="font-medium text-slate-900">{formData.down_payment ? `Rp ${Number(formData.down_payment).toLocaleString('id-ID')}` : '—'}</span>
                  <span className="text-slate-500">Pembayaran:</span>
                  <span className="font-medium text-slate-900">{formData.payment_method === 'qris' ? 'QRIS' : 'Cash'}</span>
                  <span className="text-slate-500">Photos:</span>
                  <span className="font-medium text-slate-900">{photos.length} photos</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="px-5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-sm font-medium disabled:opacity-50"
              >
                {loading || uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploading ? `Uploading ${progress}%` : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Create Order
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 5: Success ───────────────────────────────────────────── */}
        {step === 5 && success && lastInvoice && (
          <motion.div
            key="s5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm"
          >
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-1">Order Created!</h3>
            <p className="text-sm text-slate-500 mb-6">
              Watch service order has been created
              {photos.length > 0 && ` with ${photos.length} initial condition photos`}.
            </p>

            <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left border border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Invoice</p>
                  <p className="text-lg font-mono font-bold text-slate-900">{lastInvoice.invoice}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Token</p>
                  <p className="text-lg font-mono font-bold text-emerald-600">{lastInvoice.token}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <QRCodeGenerator
                invoiceNumber={lastInvoice.invoice}
                token={lastInvoice.token}
                customerName={formData.cs_name}
                customerPhone={formData.cs_phone}
              />
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={resetForm}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
              >
                New Order
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lastInvoice.token)
                  toast.success('Token copied!')
                }}
                className="px-5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
              >
                Copy Token
              </button>
              <button
                onClick={() => {
                  window.open(`/tracking/${lastInvoice.token}`, '_blank')
                }}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-sm font-medium"
              >
                Open Tracking
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Upload progress */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg border border-slate-200 shadow-lg p-4 w-64 z-50">
          <p className="text-xs font-medium text-slate-900 mb-2">Uploading photos...</p>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{progress}% complete</p>
        </div>
      )}
    </div>
  )
}
