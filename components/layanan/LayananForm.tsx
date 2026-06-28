'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useUpload } from '@/hooks/useUpload'
import {
  jenisLayananLabels,
  metodePembayaranLabels,
  leadSourceLabels,
  JenisLayanan,
  MetodePembayaran,
  LeadSource
} from '@/types'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import {
  User, Phone, Tag, DollarSign, FileText,
  Send, X, Camera, Loader2, Trash2,
  AlertCircle, Calendar,
  CreditCard, Share2, Hash, Users,
  ShoppingBag, TrendingDown, Wrench,
  MapPin, Globe, Star, Music, Edit, Minus,
  Image as ImageIcon
} from 'lucide-react'

interface LayananFormProps {
  onSuccess?: () => void
  onClose?: () => void
  initialData?: any
}

export default function LayananForm({ onSuccess, onClose, initialData }: LayananFormProps) {
  const [formData, setFormData] = useState({
    customer_name: initialData?.customer_name || '',
    customer_whatsapp: initialData?.customer_whatsapp || '',
    jenis_layanan: initialData?.jenis_layanan || 'service_langsung',
    handled_by: initialData?.handled_by || '',
    metode_pembayaran: initialData?.metode_pembayaran || 'cash',
    lead_source: initialData?.lead_source || 'instagram',
    lead_source_custom: initialData?.lead_source_custom || '',
    detail_sku: initialData?.detail_sku || '',
    nominal: initialData?.nominal || '',
    notes: initialData?.notes || ''
  })
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showCustomLeadSource, setShowCustomLeadSource] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()
  const { user } = useAuthStore()
  const { uploadFile, uploading, progress } = useUpload()

  useEffect(() => {
    fetchUsers()
    setShowCustomLeadSource(formData.lead_source === 'tulis_sendiri')
  }, [formData.lead_source])

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['admin', 'teknisi', 'supervisor'])
      .order('full_name')
    if (data) setUsers(data)
  }

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Hanya file gambar yang diperbolehkan')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Ukuran gambar maksimal 10MB')
        return
      }
      setPhotoFile(file)
      const preview = URL.createObjectURL(file)
      setPhotoPreview(preview)
    }
  }

  const removePhoto = () => {
    setPhotoFile(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validasi
    if (!photoFile && !initialData?.photo_url) {
      toast.error('Wajib upload foto bukti transaksi!')
      return
    }
    if (!formData.customer_name) {
      toast.error('Nama customer wajib diisi')
      return
    }
    if (!formData.customer_whatsapp) {
      toast.error('Nomor WhatsApp wajib diisi')
      return
    }
    if (!formData.handled_by) {
      toast.error('Pilih yang melayani')
      return
    }
    if (!formData.nominal) {
      toast.error('Nominal wajib diisi')
      return
    }

    setLoading(true)
    let photoUrl = initialData?.photo_url || ''

    try {
      if (photoFile) {
        setUploadingPhoto(true)
        photoUrl = await uploadFile(photoFile, { type: 'service' })
        setUploadingPhoto(false)
        if (!photoUrl) {
          toast.error('Gagal upload foto')
          setLoading(false)
          return
        }
      }

      const selectedUser = users.find(u => u.id === formData.handled_by)

      const { error } = await supabase
        .from('layanan')
        .insert([{
          customer_name: formData.customer_name,
          customer_whatsapp: formData.customer_whatsapp,
          jenis_layanan: formData.jenis_layanan,
          handled_by: formData.handled_by,
          handled_by_name: selectedUser?.full_name,
          metode_pembayaran: formData.metode_pembayaran,
          lead_source: formData.lead_source,
          lead_source_custom: formData.lead_source === 'tulis_sendiri' ? formData.lead_source_custom : null,
          detail_sku: formData.detail_sku,
          nominal: parseInt(formData.nominal),
          notes: formData.notes,
          photo_url: photoUrl,
          created_by: user?.id,
          created_by_name: user?.full_name,
          status: 'active'
        }])

      if (error) throw error

      toast.success('Layanan berhasil ditambahkan!')

      if (onSuccess) onSuccess()
      if (onClose) onClose()

      // Reset form
      setFormData({
        customer_name: '',
        customer_whatsapp: '',
        jenis_layanan: 'service_langsung',
        handled_by: '',
        metode_pembayaran: 'cash',
        lead_source: 'instagram',
        lead_source_custom: '',
        detail_sku: '',
        nominal: '',
        notes: ''
      })
      removePhoto()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const jenisLayananOptions = [
    { value: 'ambil_jam_service', label: 'Ambil Jam Service' },
    { value: 'order_online', label: 'Order Online' },
    { value: 'beli_jam', label: 'Beli Jam' },
    { value: 'pengeluaran', label: 'Pengeluaran' },
    { value: 'dp_service', label: 'DP Service' },
    { value: 'service_langsung', label: 'Service Langsung' }
  ]

  const metodePembayaranOptions = [
    { value: 'cash', label: 'Cash' },
    { value: 'edc_mandiri', label: 'EDC Mandiri' },
    { value: 'tf_bca', label: 'Transfer BCA' },
    { value: 'bri', label: 'BRI' },
    { value: 'kudus', label: 'Kudus' },
    { value: 'edc_bca', label: 'EDC BCA' },
    { value: 'tf_mandiri', label: 'Transfer Mandiri' },
    { value: 'qris', label: 'QRIS' }
  ]

  const leadSourceOptions = [
    { value: 'instagram', label: 'Instagram' },
    { value: 'wom', label: 'WOM (Word of Mouth)' },
    { value: 'dekat_lewat', label: 'Dekat / Lewat' },
    { value: 'google', label: 'Google' },
    { value: 'dash', label: '-' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'old', label: 'Old Customer' },
    { value: 'tiktok', label: 'TikTok' },
    { value: 'tulis_sendiri', label: 'Tulis Sendiri' }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-xl border border-slate-200 shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Transaction</h2>
            <p className="text-xs text-slate-400">Input customer transaction</p>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        )}
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Customer Information */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <User className="w-4 h-4" />
            Customer Data
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Customer Name <span className="text-blue-600">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                  placeholder="Customer name"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                WhatsApp <span className="text-blue-600">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={formData.customer_whatsapp}
                  onChange={(e) => setFormData({ ...formData, customer_whatsapp: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                  placeholder="081234567890"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Date
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                <Calendar className="w-4 h-4 text-slate-400" />
                {new Date().toLocaleDateString('id-ID')}
              </div>
            </div>
          </div>
        </div>

        {/* Service Details */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            Service Details
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Service Type <span className="text-blue-600">*</span>
              </label>
              <select
                value={formData.jenis_layanan}
                onChange={(e) => setFormData({ ...formData, jenis_layanan: e.target.value as JenisLayanan })}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              >
                {jenisLayananOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Handled By <span className="text-blue-600">*</span>
              </label>
              <select
                value={formData.handled_by}
                onChange={(e) => setFormData({ ...formData, handled_by: e.target.value })}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                required
              >
                <option value="">Select handler</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                SKU / Description
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={formData.detail_sku}
                  onChange={(e) => setFormData({ ...formData, detail_sku: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                  placeholder="Item description / SKU..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Transaction
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Payment Method <span className="text-blue-600">*</span>
              </label>
              <select
                value={formData.metode_pembayaran}
                onChange={(e) => setFormData({ ...formData, metode_pembayaran: e.target.value as MetodePembayaran })}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              >
                {metodePembayaranOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Amount <span className="text-blue-600">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={formData.nominal}
                  onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                  placeholder="0"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Lead Source <span className="text-blue-600">*</span>
              </label>
              <select
                value={formData.lead_source}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value as LeadSource })}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              >
                {leadSourceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all resize-none text-sm"
                placeholder="Additional notes..."
              />
            </div>
          </div>
        </div>

        {/* Custom Lead Source (conditional) */}
        {showCustomLeadSource && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
              Custom Lead Source
            </label>
            <input
              type="text"
              value={formData.lead_source_custom}
              onChange={(e) => setFormData({ ...formData, lead_source_custom: e.target.value })}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              placeholder="Type custom lead source..."
            />
          </div>
        )}

        {/* Photo Upload - WAJIB */}
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            Transaction Photo <span className="text-blue-600">*Required</span>
          </p>

          {photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full max-h-64 object-cover rounded-lg border border-slate-200"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-blue-600 text-white p-1.5 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center cursor-pointer hover:bg-slate-50 transition-colors"
            >
              <Camera className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">Click to upload photo</p>
              <p className="text-xs text-slate-400 mt-1">JPG, PNG (max 10MB, auto compressed)</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {/* Upload Progress */}
          {(uploadingPhoto || (uploading && progress > 0)) && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-500">Compressing & uploading...</span>
                <span className="font-medium text-slate-900">{progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Image will be compressed 70-80%</p>
            </div>
          )}

          {!photoPreview && !initialData?.photo_url && (
            <p className="text-xs text-blue-600 flex items-center gap-1 mt-2">
              <AlertCircle className="w-3 h-3" />
              Photo is required
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4 border-t border-slate-200">
          <button
            type="submit"
            disabled={loading || uploadingPhoto || (!photoPreview && !initialData?.photo_url)}
            className="flex-1 bg-blue-600 text-white font-medium py-3 rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading || uploadingPhoto ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploadingPhoto ? 'Uploading Photo...' : 'Saving...'}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Save Transaction
              </>
            )}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 bg-white text-slate-900 font-medium py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </motion.div>
  )
}
