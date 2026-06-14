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
  Send, X, Camera, Loader, Trash2,
  AlertCircle, Calendar, Clock,
  CreditCard, Share2, Hash, Users,
  ShoppingBag, TrendingDown, Wrench, QrCode,
   MapPin, Globe, Star, Music, Edit, Minus
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
      className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_black] w-full max-w-3xl max-h-[90vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 flex justify-between items-center p-5 pb-3 border-b-2 border-black">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FF6B9D] flex items-center justify-center border-2 border-black">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-xl font-black">TAMBAH LAYANAN</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1 hover:bg-gray-100 border-2 border-black">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* Customer Information */}
        <div className="border-2 border-black p-4 bg-[#F5F5F5]">
          <p className="text-xs font-black uppercase mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            DATA CUSTOMER
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase mb-1">Nama Customer *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                  placeholder="Nama customer"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">WhatsApp *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={formData.customer_whatsapp}
                  onChange={(e) => setFormData({ ...formData, customer_whatsapp: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                  placeholder="081234567890"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Tanggal</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={new Date().toLocaleDateString('id-ID')}
                  disabled
                  className="w-full pl-9 pr-3 py-2 border-2 border-black bg-gray-100 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Service Details */}
        <div className="border-2 border-black p-4 bg-[#F5F5F5]">
          <p className="text-xs font-black uppercase mb-3 flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            DETAIL LAYANAN
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase mb-1">Jenis Layanan *</label>
              <select
                value={formData.jenis_layanan}
                onChange={(e) => setFormData({ ...formData, jenis_layanan: e.target.value as JenisLayanan })}
                className="w-full px-3 py-2 border-2 border-black font-mono bg-white focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
              >
                {jenisLayananOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Handle By *</label>
              <select
                value={formData.handled_by}
                onChange={(e) => setFormData({ ...formData, handled_by: e.target.value })}
                className="w-full px-3 py-2 border-2 border-black font-mono bg-white focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                required
              >
                <option value="">Pilih yang melayani</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase mb-1">Detail SKU</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.detail_sku}
                  onChange={(e) => setFormData({ ...formData, detail_sku: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                  placeholder="Deskripsi item / SKU..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Details */}
        <div className="border-2 border-black p-4 bg-[#F5F5F5]">
          <p className="text-xs font-black uppercase mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            TRANSAKSI
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase mb-1">Metode Pembayaran *</label>
              <select
                value={formData.metode_pembayaran}
                onChange={(e) => setFormData({ ...formData, metode_pembayaran: e.target.value as MetodePembayaran })}
                className="w-full px-3 py-2 border-2 border-black font-mono bg-white focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
              >
                {metodePembayaranOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Nominal *</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  value={formData.nominal}
                  onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                  className="w-full pl-9 pr-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                  placeholder="0"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-black uppercase mb-1">Lead Source *</label>
              <select
                value={formData.lead_source}
                onChange={(e) => setFormData({ ...formData, lead_source: e.target.value as LeadSource })}
                className="w-full px-3 py-2 border-2 border-black font-mono bg-white focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
              >
                {leadSourceOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-black uppercase mb-1">Catatan</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all resize-none"
                placeholder="Catatan tambahan..."
              />
            </div>
          </div>
        </div>

        {/* Custom Lead Source (conditional) */}
        {showCustomLeadSource && (
          <div className="border-2 border-black p-4 bg-[#FFDE00]/20">
            <label className="block text-xs font-black uppercase mb-1">Tulis Lead Source</label>
            <input
              type="text"
              value={formData.lead_source_custom}
              onChange={(e) => setFormData({ ...formData, lead_source_custom: e.target.value })}
              className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
              placeholder="Tulis sumber customer..."
            />
          </div>
        )}

        {/* Photo Upload - WAJIB */}
        <div className="border-2 border-black p-4 bg-[#F5F5F5]">
          <p className="text-xs font-black uppercase mb-3 flex items-center gap-2">
            <Camera className="w-4 h-4" />
            FOTO BUKTI TRANSAKSI <span className="text-[#FF6B9D]">*WAJIB</span>
          </p>

          {photoPreview ? (
            <div className="relative">
              <img
                src={photoPreview}
                alt="Preview"
                className="w-full max-h-64 object-cover border-2 border-black"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-red-500 text-white p-1.5 border-2 border-black hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-black p-8 text-center cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <Camera className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm font-mono font-bold">Klik untuk upload foto bukti</p>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG (max 10MB, akan dikompres)</p>
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
                <span>Mengkompres & mengupload...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 h-2 border border-black">
                <div
                  className="bg-[#FF6B9D] h-2 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">Foto akan dikompres 70-80% lebih kecil</p>
            </div>
          )}

          {!photoPreview && !initialData?.photo_url && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-3">
              <AlertCircle className="w-3 h-3" />
              Foto bukti transaksi wajib diupload
            </p>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 pt-4 border-t-2 border-black">
          <button
            type="submit"
            disabled={loading || uploadingPhoto || (!photoPreview && !initialData?.photo_url)}
            className="flex-1 bg-[#FF6B9D] text-white font-bold py-3 border-2 border-black shadow-[4px_4px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 disabled:hover:translate-x-0 disabled:hover:translate-y-0 flex items-center justify-center gap-2 text-lg"
          >
            {loading || uploadingPhoto ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                {uploadingPhoto ? 'MENGUPLOAD FOTO...' : 'MENYIMPAN...'}
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                SIMPAN LAYANAN
              </>
            )}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-6 bg-white text-black font-bold py-3 border-2 border-black hover:bg-gray-100 transition-all"
            >
              BATAL
            </button>
          )}
        </div>
      </form>
    </motion.div>
  )
}
