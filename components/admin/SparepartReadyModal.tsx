'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { X, Camera, CheckCircle, Loader, Package } from 'lucide-react'
import toast from 'react-hot-toast'

interface SparepartReadyModalProps {
  isOpen: boolean
  onClose: () => void
  service: any
  onSuccess: () => void
}

export default function SparepartReadyModal({
  isOpen,
  onClose,
  service,
  onSuccess
}: SparepartReadyModalProps) {
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  const removePhoto = () => {
    setPhotoFile(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
    }
  }

  const handleSubmit = async () => {
    if (!service) return
    setLoading(true)

    try {
      let photoUrl = null
      if (photoFile) {
        const formData = new FormData()
        formData.append('file', photoFile)
        formData.append('type', 'service')
        const response = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await response.json()
        if (data.url) photoUrl = data.url
      }

      // Update dengan po_status yang valid
      const { error } = await supabase
        .from('service_orders')
        .update({
          status: 'sparepart_ready',
          po_status: 'completed',  // ← pastikan ini 'completed'
          po_admin_response: notes || 'Sparepart sudah ready',
          po_responded_at: new Date().toISOString()
        })
        .eq('id', service.id)

      if (error) {
        console.error('Update error:', error)
        throw error
      }

      await supabase.from('service_timeline').insert({
        service_order_id: service.id,
        status: 'sparepart_ready',
        message: `Sparepart ${service.po_sparepart} sudah siap. ${notes || ''}`,
        details: {
          action: 'sparepart_ready',
          photo: photoUrl,
          notes: notes
        }
      })

      await supabase.from('notifications').insert({
        user_id: service.assigned_teknisi_id,
        title: '✅ Sparepart Sudah Siap!',
        message: `Sparepart ${service.po_sparepart} sudah ready. Silakan ambil dan lanjutkan service.`,
        type: 'success',
        link: '/teknisi',
        is_read: false
      })

      toast.success('Sparepart sudah siap! Teknisi akan diberitahu.')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Submit error:', error)
      toast.error(error.message || 'Gagal update status')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !service) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 p-6"
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Sparepart Ready</h3>
            <p className="text-xs text-slate-400">{service.invoice_number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
            <p className="font-bold">{service.po_sparepart}</p>
            <p className="text-sm">Teknisi: {service.teknisi_name || 'Loading...'}</p>
            <p className="text-sm">Customer: {service.customer_name}</p>
          </div>

          {/* Foto */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Foto Sparepart (Opsional)</label>
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-full h-32 object-cover rounded-lg border" />
                <button
                  onClick={removePhoto}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-lg hover:bg-red-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-green-500 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                  id="sparepart-photo"
                />
                <label htmlFor="sparepart-photo" className="cursor-pointer">
                  <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Klik untuk upload foto</p>
                </label>
              </div>
            )}
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-1">Catatan (Opsional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500 transition-all resize-none"
              placeholder="Contoh: Sparepart sudah datang, siap diambil"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-green-500 text-white font-medium py-2.5 rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Package className="w-4 h-4" />
            )}
            {loading ? 'Menyimpan...' : 'Sparepart Siap!'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
