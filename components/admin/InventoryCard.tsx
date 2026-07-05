'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { motion } from 'framer-motion'
import { Package, Warehouse, Edit2, Trash2, Image as ImageIcon, DollarSign } from 'lucide-react'
import toast from 'react-hot-toast'

interface InventoryCardProps {
  item: any
  onUpdate: () => void
}

export default function InventoryCard({ item, onUpdate }: InventoryCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [showImage, setShowImage] = useState(false)
  const supabase = createClient()

  const deleteItem = async () => {
    if (!confirm(`Yakin ingin menghapus "${item.item_name}"?`)) return

    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', item.id)

    if (error) {
      toast.error('Gagal menghapus item')
    } else {
      toast.success('Item berhasil dihapus')
      onUpdate()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image */}
      <div
        className="relative h-32 bg-slate-100 cursor-pointer"
        onClick={() => setShowImage(true)}
      >
        {item.photo_url ? (
          <img
            src={item.photo_url}
            alt={item.item_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-slate-300" />
          </div>
        )}
        {isHovered && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <span className="text-white text-xs bg-black/50 px-2 py-1 rounded">Lihat Foto</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="font-semibold text-slate-900">{item.item_name}</h4>
            <p className="text-xs text-slate-400">SKU: {item.sku}</p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
              {item.category || 'Uncategorized'}
            </span>
            {item.price > 0 && (
              <span className="text-xs font-bold text-emerald-600">
                Rp {Number(item.price).toLocaleString('id-ID')}
              </span>
            )}
          </div>
        </div>

        {/* Stock */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-green-50 rounded-lg p-2 text-center border border-green-100">
            <Package className="w-4 h-4 text-green-600 mx-auto" />
            <p className="text-xs text-slate-500">Toko</p>
            <p className="text-sm font-bold text-green-700">{item.store_stock} {item.unit}</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-2 text-center border border-emerald-100">
            <Warehouse className="w-4 h-4 text-emerald-600 mx-auto" />
            <p className="text-xs text-slate-500">Gudang</p>
            <p className="text-sm font-bold text-emerald-700">{item.warehouse_stock} {item.unit}</p>
          </div>
        </div>

        {/* Actions */}
        {isHovered && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-slate-200">
            <button className="flex-1 text-xs text-emerald-600 hover:bg-emerald-50 py-1 rounded flex items-center justify-center gap-1">
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
            <button
              onClick={deleteItem}
              className="flex-1 text-xs text-red-600 hover:bg-red-50 py-1 rounded flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Hapus
            </button>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {showImage && item.photo_url && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setShowImage(false)}
        >
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={item.photo_url}
              alt={item.item_name}
              className="w-full rounded-lg"
            />
            <button
              onClick={() => setShowImage(false)}
              className="mt-4 w-full bg-white text-black py-2 rounded-lg hover:bg-slate-100"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}
