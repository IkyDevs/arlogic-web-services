'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { motion } from 'framer-motion'
import { X, Package, Warehouse, Send, Loader, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface SparepartRequestModalProps {
  isOpen: boolean
  onClose: () => void
  service: any
  teknisiId: string
  onSuccess: () => void
}

export default function SparepartRequestModal({
  isOpen,
  onClose,
  service,
  teknisiId,
  onSuccess
}: SparepartRequestModalProps) {
  const [formData, setFormData] = useState({
    sparepart_name: '',
    sparepart_sku: '',
    quantity: 1,
    source_type: 'store' as 'store' | 'warehouse',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()
  const { user } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.sparepart_name) {
      toast.error('Nama sparepart wajib diisi')
      return
    }

    setLoading(true)

    try {
      console.log('📝 Creating sparepart request...')
      console.log('Service:', service)
      console.log('Teknisi ID:', teknisiId)
      console.log('User:', user)

      // 1. Insert ke sparepart_requests
      const { data: requestData, error: insertError } = await supabase
        .from('sparepart_requests')
        .insert({
          service_order_id: service.id,
          teknisi_id: teknisiId,
          teknisi_name: user?.full_name,
          sparepart_name: formData.sparepart_name,
          sparepart_sku: formData.sparepart_sku,
          quantity: formData.quantity,
          source_type: formData.source_type,
          status: 'pending',
          admin_notes: formData.notes
        })
        .select()
        .single()

      if (insertError) {
        console.error('❌ Insert error:', insertError)
        throw insertError
      }

      console.log('✅ Sparepart request created:', requestData)

      // 2. Update status service order ke waiting_sparepart
      const { error: updateError } = await supabase
        .from('service_orders')
        .update({ status: 'waiting_sparepart' })
        .eq('id', service.id)

      if (updateError) {
        console.error('❌ Update service error:', updateError)
      } else {
        console.log('✅ Service status updated to waiting_sparepart')
      }

      // 3. Add to timeline
      const { error: timelineError } = await supabase
        .from('service_timeline')
        .insert({
          service_order_id: service.id,
          teknisi_id: teknisiId,
          status: 'waiting_sparepart',
          message: `Mengajukan permintaan sparepart: ${formData.sparepart_name} (${formData.quantity} pcs) dari ${formData.source_type === 'store' ? 'Stock Toko' : 'Stock Gudang'}`,
          details: {
            action: 'sparepart_request',
            sparepart_name: formData.sparepart_name,
            quantity: formData.quantity,
            source: formData.source_type
          }
        })

      if (timelineError) {
        console.error('❌ Timeline error:', timelineError)
      }

      // 4. Kirim notifikasi ke semua admin dan supervisor
      const { data: admins, error: adminError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('role', ['admin', 'supervisor'])

      if (adminError) {
        console.error('❌ Error fetching admins:', adminError)
      } else {
        console.log(`📨 Sending notifications to ${admins?.length || 0} admins...`)

        if (admins && admins.length > 0) {
          for (const admin of admins) {
            const { error: notifError } = await supabase
              .from('notifications')
              .insert({
                user_id: admin.id,
                title: '📦 Request Sparepart Baru',
                message: `${user?.full_name} membutuhkan ${formData.sparepart_name} (x${formData.quantity}) untuk service ${service.invoice_number} - ${service.customer_name}`,
                type: 'warning',
                link: '/admin',
                is_read: false
              })

            if (notifError) {
              console.error(`❌ Failed to send notification to ${admin.full_name}:`, notifError)
            } else {
              console.log(`✅ Notification sent to ${admin.full_name} (${admin.role})`)
            }
          }
        }
      }

      setSuccess(true)
      toast.success('Request sparepart berhasil dikirim! Admin akan segera memproses.')

      setTimeout(() => {
        onSuccess()
        onClose()
        setSuccess(false)
      }, 2000)

    } catch (error: any) {
      console.error('❌ Submit error:', error)
      toast.error(error.message || 'Gagal mengirim request')
    } finally {
      setLoading(false)
    }
  }

  const increaseQuantity = () => {
    setFormData({ ...formData, quantity: formData.quantity + 1 })
  }

  const decreaseQuantity = () => {
    if (formData.quantity > 1) {
      setFormData({ ...formData, quantity: formData.quantity - 1 })
    }
  }

  if (!isOpen) return null

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white border border-slate-200 shadow-sm w-full max-w-md p-8 text-center"
        >
          <div className="w-16 h-16 bg-green-500 flex items-center justify-center border border-slate-200 mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-black mb-2">REQUEST TERKIRIM!</h3>
          <p className="text-slate-600 mb-4">Permintaan sparepart sudah dikirim ke admin.</p>
          <p className="text-sm text-slate-500">Status service akan berubah setelah admin merespon.</p>
          <button
            onClick={() => {
              onSuccess()
              onClose()
              setSuccess(false)
            }}
            className="mt-4 bg-teal-600 text-white font-bold py-2 px-4 border border-slate-200 shadow-sm hover:shadow-md transition-all"
          >
            TUTUP
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white border border-slate-200 shadow-sm w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="p-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 flex items-center justify-center border border-slate-200">
              <Package className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-xl font-black">REQUEST SPAREPART</h3>
          </div>
          <button onClick={onClose} className="p-1 border border-slate-200 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-black uppercase mb-1">
              Nama Sparepart <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.sparepart_name}
              onChange={(e) => setFormData({ ...formData, sparepart_name: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 font-mono focus:outline-none   transition-all"
              placeholder="Contoh: Kaca Arloji, Mesin, Battery..."
              required
            />
          </div>

          <div>
            <label className="block text-xs font-black uppercase mb-1">
              SKU (Opsional)
            </label>
            <input
              type="text"
              value={formData.sparepart_sku}
              onChange={(e) => setFormData({ ...formData, sparepart_sku: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 font-mono focus:outline-none   transition-all"
              placeholder="Kode SKU jika ada"
            />
            <p className="text-xs text-slate-400 mt-1">*Memasukkan SKU akan mempermudah admin mencari stock</p>
          </div>

          <div>
            <label className="block text-xs font-black uppercase mb-1">Jumlah</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={decreaseQuantity}
                className="w-8 h-8 border border-slate-200 font-bold hover:bg-slate-100 transition-all"
              >
                -
              </button>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                min={1}
                className="w-20 text-center px-2 py-2 border border-slate-200 font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={increaseQuantity}
                className="w-8 h-8 border border-slate-200 font-bold hover:bg-slate-100 transition-all"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase mb-1">
              Sumber Stock <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, source_type: 'store' })}
                className={`py-2 border border-slate-200 font-bold flex items-center justify-center gap-2 transition-all ${
                  formData.source_type === 'store' ? 'bg-amber-500 text-black' : 'bg-white text-slate-900'
                }`}
              >
                <Package className="w-4 h-4" />
                STOK TOKO
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, source_type: 'warehouse' })}
                className={`py-2 border border-slate-200 font-bold flex items-center justify-center gap-2 transition-all ${
                  formData.source_type === 'warehouse' ? 'bg-pink-600 text-white' : 'bg-white text-slate-900'
                }`}
              >
                <Warehouse className="w-4 h-4" />
                STOK GUDANG
              </button>
            </div>
            {formData.source_type === 'warehouse' && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-300">
                <p className="text-xs text-yellow-700 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Stock gudang perlu konfirmasi admin terlebih dahulu. Proses akan lebih lama.
                </p>
              </div>
            )}
            {formData.source_type === 'store' && (
              <div className="mt-2 p-2 bg-green-50 border border-green-300">
                <p className="text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Stock toko bisa langsung diambil jika tersedia.
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-black uppercase mb-1">
              Catatan (Opsional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-slate-200 font-mono focus:outline-none   transition-all resize-none"
              placeholder="Tambahan informasi untuk admin..."
            />
          </div>

          <div className="border-t border-slate-200 pt-4 bg-slate-50 p-3 -mx-5 px-5">
            <p className="text-xs font-black uppercase mb-2">INFORMASI SERVICE</p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-bold">{service.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-mono">{service.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Device:</span>
                <span>{service.watch_brand || service.device_brand} {service.watch_model || service.device_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Problem:</span>
                <span className="truncate max-w-[200px]">{service.issue_description?.substring(0, 50)}...</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-600 text-white font-bold py-3 border border-slate-200 shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                MENGIRIM REQUEST...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                KIRIM REQUEST
              </>
            )}
          </button>

          <p className="text-xs text-slate-400 text-center">
            *Request akan dikirim ke admin. Kamu akan mendapat notifikasi setelah admin merespon.
          </p>
        </form>
      </motion.div>
    </div>
  )
}
