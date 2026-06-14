'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import {
  X, User, Phone, Watch, AlertCircle, FileText,
  Calendar, Hash, CheckCircle, ArrowRight, Camera
} from 'lucide-react'
import toast from 'react-hot-toast'

interface ServiceDetailModalProps {
  isOpen: boolean
  onClose: () => void
  service: any
  onTake: () => void
  onSkip: () => void
}

export default function ServiceDetailModal({
  isOpen,
  onClose,
  service,
  onTake,
  onSkip
}: ServiceDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])

  useEffect(() => {
    if (service && isOpen) {
      fetchPhotos()
    }
  }, [service, isOpen])

  const fetchPhotos = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('service_documentation')
      .select('photo_url')
      .eq('service_order_id', service.id)
      .eq('stage', 'initial')

    if (data) {
      setPhotos(data.map(p => p.photo_url))
    }
  }

  if (!isOpen || !service) return null

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_black] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-4 border-b-2 border-black flex justify-between items-center sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FF6B9D] flex items-center justify-center border border-black">
              <Watch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black">DETAIL SERVICE</h3>
              <p className="text-xs font-mono">{service.invoice_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 border-2 border-black hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Customer Information */}
          <div className="border-2 border-black p-4 bg-[#F5F5F5]">
            <p className="text-xs font-black uppercase mb-3 flex items-center gap-2">
              <User className="w-4 h-4" />
              DATA CUSTOMER
            </p>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Nama</span>
                <span className="font-bold">{service.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">WhatsApp</span>
                <span className="font-mono">{service.customer_phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Tanggal Masuk</span>
                <span>{formatDate(service.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Watch Information */}
          <div className="border-2 border-black p-4 bg-[#F5F5F5]">
            <p className="text-xs font-black uppercase mb-3 flex items-center gap-2">
              <Watch className="w-4 h-4" />
              INFORMASI JAM TANGAN
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-gray-600 text-sm">Brand</p>
                <p className="font-bold">{service.watch_brand || service.device_brand || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Model</p>
                <p className="font-bold">{service.watch_model || service.device_model || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Movement</p>
                <p className="font-bold capitalize">{service.watch_movement || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Serial Number</p>
                <p className="font-mono text-sm">{service.serial_number || '-'}</p>
              </div>
            </div>
          </div>

          {/* Service Issue */}
          <div className="border-2 border-black p-4 bg-[#F5F5F5]">
            <p className="text-xs font-black uppercase mb-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              DESKRIPSI KERUSAKAN
            </p>
            <p className="text-gray-700">{service.issue_description}</p>
            {service.request && (
              <>
                <div className="h-px bg-black my-3" />
                <p className="text-xs font-black uppercase mb-1">REQUEST CUSTOMER</p>
                <p className="text-gray-700">{service.request}</p>
              </>
            )}
            {service.notes && (
              <>
                <div className="h-px bg-black my-3" />
                <p className="text-xs font-black uppercase mb-1">CATATAN TAMBAHAN</p>
                <p className="text-gray-700">{service.notes}</p>
              </>
            )}
          </div>

          {/* Photos */}
          {photos.length > 0 && (
            <div className="border-2 border-black p-4 bg-[#F5F5F5]">
              <p className="text-xs font-black uppercase mb-3 flex items-center gap-2">
                <Camera className="w-4 h-4" />
                FOTO DOKUMENTASI
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((photo, i) => (
                  <img
                    key={i}
                    src={photo}
                    alt={`Service ${i + 1}`}
                    className="w-full h-24 object-cover border border-black cursor-pointer hover:opacity-80"
                    onClick={() => window.open(photo, '_blank')}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t-2 border-black flex gap-3 bg-white">
          <button
            onClick={onSkip}
            className="flex-1 bg-white text-black font-bold py-2 border-2 border-black hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
          >
            SKIP
          </button>
          <button
            onClick={onTake}
            disabled={loading}
            className="flex-1 bg-[#FF6B9D] text-white font-bold py-2 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            AMBIL JAM INI
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </div>
  )
}
