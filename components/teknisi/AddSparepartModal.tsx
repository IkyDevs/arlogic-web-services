'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { motion } from 'framer-motion'
import { X, Package, Warehouse, Plus, Minus, Loader, CheckCircle, AlertCircle, Search } from 'lucide-react'
import toast from 'react-hot-toast'

interface AddSparepartModalProps {
  isOpen: boolean
  onClose: () => void
  service: any
  onSuccess: () => void
}

export default function AddSparepartModal({ isOpen, onClose, service, onSuccess }: AddSparepartModalProps) {
  const [formData, setFormData] = useState({
    sparepart_name: '',
    sparepart_sku: '',
    quantity: 1,
    source_type: 'store' as 'store' | 'warehouse',
    notes: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [inventoryItems, setInventoryItems] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const supabase = createClient()
  const { user } = useAuthStore()

  useEffect(() => {
    if (isOpen) {
      fetchInventory()
    }
  }, [isOpen, searchQuery])

  const fetchInventory = async () => {
    let query = supabase
      .from('inventory')
      .select('*')
      .order('item_name')

    if (searchQuery) {
      query = query.ilike('item_name', `%${searchQuery}%`)
    }

    const { data } = await query.limit(10)
    if (data) setInventoryItems(data)
  }

  const selectSparepart = (item: any) => {
    setFormData({
      ...formData,
      sparepart_name: item.item_name,
      sparepart_sku: item.sku
    })
    setShowDropdown(false)
    setSearchQuery('')
  }

  const increaseQuantity = () => {
    setFormData({ ...formData, quantity: formData.quantity + 1 })
  }

  const decreaseQuantity = () => {
    if (formData.quantity > 1) {
      setFormData({ ...formData, quantity: formData.quantity - 1 })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.sparepart_name) {
      toast.error('Pilih atau masukkan nama sparepart')
      return
    }

    setLoading(true)

    try {
      // Cek stock tersedia
      const { data: stockData } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku', formData.sparepart_sku)
        .single()

      if (formData.source_type === 'store') {
        const currentStock = stockData?.store_stock || 0
        if (currentStock < formData.quantity) {
          toast.error(`Stock toko tidak mencukupi! Tersedia: ${currentStock}`)
          setLoading(false)
          return
        }

        // Kurangi stock toko
        await supabase
          .from('inventory')
          .update({ store_stock: currentStock - formData.quantity })
          .eq('id', stockData?.id)
      } else {
        const currentStock = stockData?.warehouse_stock || 0
        if (currentStock < formData.quantity) {
          toast.error(`Stock gudang tidak mencukupi! Tersedia: ${currentStock}`)
          setLoading(false)
          return
        }

        // Kurangi stock gudang
        await supabase
          .from('inventory')
          .update({ warehouse_stock: currentStock - formData.quantity })
          .eq('id', stockData?.id)
      }

      // Tambahkan ke service items
      const { error: itemError } = await supabase
        .from('service_items')
        .insert({
          service_order_id: service.id,
          item_type: 'sparepart',
          name: formData.sparepart_name,
          quantity: formData.quantity,
          price: 0 // Harga bisa diisi nanti atau 0
        })

      if (itemError) throw itemError

      // Add to timeline
      await supabase.from('service_timeline').insert({
        service_order_id: service.id,
        teknisi_id: user?.id,
        status: 'in_progress',
        message: `Mengambil sparepart: ${formData.sparepart_name} (x${formData.quantity}) dari ${formData.source_type === 'store' ? 'Stock Toko' : 'Stock Gudang'}`,
        details: { action: 'add_sparepart' }
      })

      setSuccess(true)
      toast.success(`Sparepart berhasil diambil! Stock ${formData.source_type === 'store' ? 'toko' : 'gudang'} berkurang ${formData.quantity}.`)

      setTimeout(() => {
        onSuccess()
        onClose()
        setSuccess(false)
      }, 2000)

    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_black] w-full max-w-md p-8 text-center"
        >
          <div className="w-16 h-16 bg-green-500 flex items-center justify-center border-2 border-black mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-black mb-2">SPAREPART DIAMBIL!</h3>
          <p className="text-gray-600 mb-4">Sparepart berhasil diambil dari stock.</p>
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
        className="bg-white border-2 border-black shadow-[8px_8px_0px_0px_black] w-full max-w-md max-h-[90vh] overflow-y-auto"
      >
        <div className="p-4 border-b-2 border-black flex justify-between items-center sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FF6B9D] flex items-center justify-center border border-black">
              <Package className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-xl font-black">TAMBAH SPAREPART</h3>
          </div>
          <button onClick={onClose} className="p-1 border-2 border-black hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Pilih Sparepart */}
          <div>
            <label className="block text-xs font-black uppercase mb-1">
              Cari / Pilih Sparepart <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setShowDropdown(true)
                  if (e.target.value === '') {
                    setFormData({ ...formData, sparepart_name: '', sparepart_sku: '' })
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all"
                placeholder="Ketik nama sparepart..."
              />
              {showDropdown && inventoryItems.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-black max-h-48 overflow-y-auto">
                  {inventoryItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectSparepart(item)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-black last:border-b-0"
                    >
                      <div className="font-bold">{item.item_name}</div>
                      <div className="text-xs text-gray-500">SKU: {item.sku} | Stock Toko: {item.store_stock} | Stock Gudang: {item.warehouse_stock}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {formData.sparepart_name && (
              <div className="mt-2 p-2 bg-green-50 border border-green-300 text-sm">
                <span className="font-bold">Dipilih:</span> {formData.sparepart_name}
                {formData.sparepart_sku && <span className="text-gray-500 ml-2">(SKU: {formData.sparepart_sku})</span>}
              </div>
            )}
          </div>

          {/* Jumlah */}
          <div>
            <label className="block text-xs font-black uppercase mb-1">Jumlah</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={decreaseQuantity}
                className="w-8 h-8 border-2 border-black font-bold hover:bg-gray-100 transition-all"
              >
                -
              </button>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                min={1}
                className="w-20 text-center px-2 py-2 border-2 border-black font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={increaseQuantity}
                className="w-8 h-8 border-2 border-black font-bold hover:bg-gray-100 transition-all"
              >
                +
              </button>
            </div>
          </div>

          {/* Sumber Stock */}
          <div>
            <label className="block text-xs font-black uppercase mb-1">Ambil Dari</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, source_type: 'store' })}
                className={`py-2 border-2 border-black font-bold flex items-center justify-center gap-2 transition-all ${
                  formData.source_type === 'store' ? 'bg-[#FFDE00] text-black' : 'bg-white text-black'
                }`}
              >
                <Package className="w-4 h-4" />
                STOK TOKO
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, source_type: 'warehouse' })}
                className={`py-2 border-2 border-black font-bold flex items-center justify-center gap-2 transition-all ${
                  formData.source_type === 'warehouse' ? 'bg-[#FF6B9D] text-white' : 'bg-white text-black'
                }`}
              >
                <Warehouse className="w-4 h-4" />
                STOK GUDANG
              </button>
            </div>
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-black uppercase mb-1">Catatan (Opsional)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border-2 border-black font-mono focus:outline-none focus:translate-x-[1px] focus:translate-y-[1px] transition-all resize-none"
              placeholder="Tambahan informasi..."
            />
          </div>

          {/* Informasi Service */}
          <div className="border-t-2 border-black pt-4 bg-[#F5F5F5] p-3 -mx-5 px-5">
            <p className="text-xs font-black uppercase mb-2">INFORMASI SERVICE</p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-bold">{service.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice:</span>
                <span className="font-mono">{service.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Device:</span>
                <span>{service.watch_brand || service.device_brand} {service.watch_model || service.device_model}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !formData.sparepart_name}
            className="w-full bg-[#3B82F6] text-white font-bold py-3 border-2 border-black shadow-[3px_3px_0px_0px_black] hover:translate-x-[1px] hover:translate-y-[1px] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                MENGAMBIL SPAREPART...
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                AMBIL SPAREPART
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            *Stock akan langsung berkurang dari toko/gudang
          </p>
        </form>
      </motion.div>
    </div>
  )
}
