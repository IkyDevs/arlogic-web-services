'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Watch, Calendar, Send, CheckCircle,
  AlertCircle, ArrowRight, Settings, Battery,
  Cpu, Sparkles, Camera, X, Image as ImageIcon,
  Hash, Phone, Loader2, RotateCw, Smartphone, Circle
} from 'lucide-react'
import { useUpload } from '@/hooks/useUpload'
import dynamic from 'next/dynamic'

const QRCodeGenerator = dynamic(() => import('@/components/admin/QRCodeGenerator'), {
  loading: () => <div className="text-center py-4 text-sm text-gray-400">Loading QR...</div>
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
  const { uploadFile, uploading, progress } = useUpload()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [formData, setFormData] = useState({
    cs_name: '',
    cs_phone: '',
    serial_number: '',
    watch_brand: '',
    watch_model: '',
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
    setFormData({
      cs_name: '', cs_phone: '', serial_number: '',
      watch_brand: '', watch_model: '', watch_movement: '',
      problem: '', request: '', notes: ''
    })
    setPhotos([])
    setPhotoPreviews([])
    setSuccess(false)
    setStep(1)
    setLastInvoice(null)
  }

  return (
    <div className="max-w-3xl mx-auto py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#1A1A2E] rounded-lg flex items-center justify-center">
          <Watch className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#1A1A2E]">New Watch Service</h2>
          <p className="text-sm text-gray-400">Create service order for timepiece</p>
        </div>
      </div>

      {/* Progress Steps */}
      {step <= 4 && (
        <div className="flex gap-1 mb-8">
          {STEP_LABELS.map((label, i) => (
            <div
              key={i}
              className={`flex-1 flex items-center gap-2 py-2.5 px-3 rounded-lg transition-all ${
                step > i + 1
                  ? 'bg-gray-100 text-gray-400'
                  : step === i + 1
                    ? 'bg-[#1A1A2E] text-white shadow-sm'
                    : 'bg-gray-50 text-gray-400 border border-[#E9ECEF]'
              }`}
            >
              <span className={`text-xs font-medium ${step === i + 1 ? 'text-white' : 'text-gray-400'}`}>
                {i + 1}
              </span>
              <span className={`text-xs font-medium ${step === i + 1 ? 'text-white' : 'text-gray-500'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">

        {/* ── STEP 1: Customer ─────────────────────────────────────────── */}
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-xl border border-[#E9ECEF] p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#E9ECEF]">
              <User className="w-4 h-4 text-[#1A1A2E]" />
              <h3 className="font-semibold text-[#1A1A2E]">Customer Information</h3>
              <span className="ml-auto text-xs text-gray-400 font-medium">1/4</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-[#E94560]">*</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.cs_name}
                    onChange={e => setFormData(p => ({ ...p, cs_name: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                    placeholder="John Doe"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  WhatsApp / Phone <span className="text-[#E94560]">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={formData.cs_phone}
                    onChange={e => setFormData(p => ({ ...p, cs_phone: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                    placeholder="+62 812 3456 7890"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Serial Number
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={e => setFormData(p => ({ ...p, serial_number: e.target.value }))}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2D2D44] transition-all text-sm font-medium"
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
            className="bg-white rounded-xl border border-[#E9ECEF] p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#E9ECEF]">
              <Watch className="w-4 h-4 text-[#1A1A2E]" />
              <h3 className="font-semibold text-[#1A1A2E]">Watch Details</h3>
              <span className="ml-auto text-xs text-gray-400 font-medium">2/4</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Brand <span className="text-[#E94560]">*</span>
                </label>
                <input
                  type="text"
                  list="watchBrandsList"
                  value={formData.watch_brand}
                  onChange={e => setFormData(p => ({ ...p, watch_brand: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm uppercase"
                  placeholder="ROLEX, OMEGA, CASIO..."
                />
                <datalist id="watchBrandsList">
                  {watchBrands.map(b => <option key={b} value={b} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Model
                </label>
                <input
                  type="text"
                  value={formData.watch_model}
                  onChange={e => setFormData(p => ({ ...p, watch_model: e.target.value.toUpperCase() }))}
                  className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm uppercase"
                  placeholder="SUBMARINER, SPEEDMASTER..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Movement <span className="text-[#E94560]">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {watchMovements.map(m => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, watch_movement: m.value }))}
                      className={`py-3 text-xs font-medium rounded-lg border transition-all flex flex-col items-center gap-1.5 ${
                        formData.watch_movement === m.value
                          ? 'border-[#1A1A2E] bg-[#1A1A2E] text-white'
                          : 'border-[#E9ECEF] bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <m.icon className="w-5 h-5" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="px-5 py-2.5 bg-white text-[#1A1A2E] border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2D2D44] transition-all text-sm font-medium"
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
            className="bg-white rounded-xl border border-[#E9ECEF] p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#E9ECEF]">
              <Camera className="w-4 h-4 text-[#1A1A2E]" />
              <h3 className="font-semibold text-[#1A1A2E]">Initial Condition Photos</h3>
              <span className="ml-auto text-xs text-gray-400 font-medium">3/4</span>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Photos of the watch before service. Teknisi will use this as reference.
            </p>

            {/* Photo Grid */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {photoPreviews.map((src, i) => (
                  <div key={i} className="relative group border border-[#E9ECEF] rounded-lg overflow-hidden">
                    <img src={src} alt={`Foto ${i + 1}`} className="w-full h-28 object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1.5 right-1.5 bg-white p-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-gray-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2D2D44] transition-all text-sm font-medium"
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-sm font-medium text-[#1A1A2E]"
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

            <p className="text-xs text-gray-400 mt-3">
              {photos.length > 0 ? `${photos.length} photos selected` : 'Optional — can be skipped'}
            </p>

            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="px-5 py-2.5 bg-white text-[#1A1A2E] border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2D2D44] transition-all text-sm font-medium"
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
            className="bg-white rounded-xl border border-[#E9ECEF] p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#E9ECEF]">
              <AlertCircle className="w-4 h-4 text-[#1A1A2E]" />
              <h3 className="font-semibold text-[#1A1A2E]">Service Issue</h3>
              <span className="ml-auto text-xs text-gray-400 font-medium">4/4</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Problem / Kendala <span className="text-[#E94560]">*</span>
                </label>
                <textarea
                  value={formData.problem}
                  onChange={e => setFormData(p => ({ ...p, problem: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all resize-none text-sm"
                  placeholder="Describe the watch issue in detail..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Customer Request
                </label>
                <textarea
                  value={formData.request}
                  onChange={e => setFormData(p => ({ ...p, request: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all resize-none text-sm"
                  placeholder="Special requests from customer..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Additional Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all resize-none text-sm"
                  placeholder="Any additional notes..."
                />
              </div>

              {/* Summary */}
              <div className="bg-[#FAFAFA] rounded-lg p-4 border border-[#E9ECEF]">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Summary
                </p>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-medium text-[#1A1A2E]">{formData.cs_name || '—'}</span>
                  <span className="text-gray-500">Watch:</span>
                  <span className="font-medium text-[#1A1A2E]">{[formData.watch_brand, formData.watch_model].filter(Boolean).join(' ') || '—'}</span>
                  <span className="text-gray-500">Movement:</span>
                  <span className="font-medium text-[#1A1A2E] uppercase">{formData.watch_movement || '—'}</span>
                  <span className="text-gray-500">Photos:</span>
                  <span className="font-medium text-[#1A1A2E]">{photos.length} photos</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="px-5 py-2.5 bg-white text-[#1A1A2E] border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#E94560] text-white rounded-lg hover:bg-[#c73d54] transition-all text-sm font-medium disabled:opacity-50"
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
            className="bg-white rounded-xl border border-[#E9ECEF] p-8 text-center shadow-sm"
          >
            <div className="w-16 h-16 bg-[#2ECC71] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>

            <h3 className="text-2xl font-bold text-[#1A1A2E] mb-1">Order Created!</h3>
            <p className="text-sm text-gray-500 mb-6">
              Watch service order has been created
              {photos.length > 0 && ` with ${photos.length} initial condition photos`}.
            </p>

            <div className="bg-[#FAFAFA] rounded-lg p-4 mb-6 text-left border border-[#E9ECEF]">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Invoice</p>
                  <p className="text-lg font-mono font-bold text-[#1A1A2E]">{lastInvoice.invoice}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Token</p>
                  <p className="text-lg font-mono font-bold text-[#E94560]">{lastInvoice.token}</p>
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
                className="px-5 py-2.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2D2D44] transition-all text-sm font-medium"
              >
                New Order
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lastInvoice.token)
                  toast.success('Token copied!')
                }}
                className="px-5 py-2.5 bg-white text-[#1A1A2E] border border-[#E9ECEF] rounded-lg hover:bg-gray-50 transition-all text-sm font-medium"
              >
                Copy Token
              </button>
              <button
                onClick={() => {
                  window.open(`/tracking/${lastInvoice.token}`, '_blank')
                }}
                className="px-5 py-2.5 bg-[#E94560] text-white rounded-lg hover:bg-[#c73d54] transition-all text-sm font-medium"
              >
                Open Tracking
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Upload progress */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg border border-[#E9ECEF] shadow-lg p-4 w-64 z-50">
          <p className="text-xs font-medium text-[#1A1A2E] mb-2">Uploading photos...</p>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-[#E94560] transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{progress}% complete</p>
        </div>
      )}
    </div>
  )
}
