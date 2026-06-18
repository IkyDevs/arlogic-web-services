'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { useUpload } from '@/hooks/useUpload'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Package, Warehouse, Camera, Loader,
  Trash2, Edit2, CheckCircle, AlertCircle, Image as ImageIcon
} from 'lucide-react'
import toast from 'react-hot-toast'

interface InventoryManagementProps {
  onUpdate?: () => void
}

export default function InventoryManagement({ onUpdate }: InventoryManagementProps) {
  const [inventory, setInventory] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const supabase = createClient()
  const { user } = useAuthStore()
  const { uploadFile, uploading, progress } = useUpload()

  const [formData, setFormData] = useState({
    item_name: '',
    sku: '',
    category: '',
    store_stock: 0,
    warehouse_stock: 0,
    unit: 'pcs',
    min_stock: 0
  })

  useEffect(() => {
    fetchInventory()
    fetchCategories()

    // Listen untuk event dari tombol tambah item
    const handleOpenForm = () => {
      resetForm()
      setShowForm(true)
    }
    document.addEventListener('openInventoryForm', handleOpenForm)
    return () => document.removeEventListener('openInventoryForm', handleOpenForm)
  }, [])

  const fetchInventory = async () => {
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setInventory(data)
  }

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('name')
      .order('name')
    if (data) setCategories(data.map(c => c.name))
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
  }

  const resetForm = () => {
    setFormData({
      item_name: '',
      sku: '',
      category: '',
      store_stock: 0,
      warehouse_stock: 0,
      unit: 'pcs',
      min_stock: 0
    })
    setEditingId(null)
    setShowForm(false)
    removePhoto()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.item_name || !formData.sku) {
      toast.error('Nama item dan SKU wajib diisi')
      return
    }

    setLoading(true)
    let photoUrl = ''

    if (photoFile) {
      setUploadingPhoto(true)
      photoUrl = await uploadFile(photoFile, { type: 'service' }) || ''
      setUploadingPhoto(false)
    }

    try {
      const dataToInsert = {
        ...formData,
        photo_url: photoUrl || null,
        category: formData.category || 'Uncategorized'
      }

      if (editingId) {
        const { error } = await supabase
          .from('inventory')
          .update(dataToInsert)
          .eq('id', editingId)

        if (error) throw error
        toast.success('Item berhasil diupdate!')
      } else {
        const { error } = await supabase
          .from('inventory')
          .insert([dataToInsert])

        if (error) throw error
        toast.success('Item berhasil ditambahkan!')
      }

      resetForm()
      fetchInventory()
      if (onUpdate) onUpdate()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteItem = async (id: string) => {
    if (!confirm('Yakin ingin menghapus item ini?')) return

    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Gagal menghapus item')
    } else {
      toast.success('Item berhasil dihapus')
      fetchInventory()
      if (onUpdate) onUpdate()
    }
  }

  const editItem = (item: any) => {
    setFormData({
      item_name: item.item_name,
      sku: item.sku,
      category: item.category || '',
      store_stock: item.store_stock,
      warehouse_stock: item.warehouse_stock,
      unit: item.unit || 'pcs',
      min_stock: item.min_stock || 0
    })
    setEditingId(item.id)
    setShowForm(true)
    if (item.photo_url) {
      setPhotoPreview(item.photo_url)
    }
  }

  return (
    <div>
      <div className="mb-5 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-[#1A1A2E]">Manajemen Inventori</h3>
          <p className="text-sm text-gray-500">Kelola stock sparepart</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="bg-[#E94560] text-white font-medium px-4 py-2 rounded-lg hover:bg-[#c73d54] transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Item
        </button>
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-[#E9ECEF] p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-[#1A1A2E]">
                  {editingId ? 'Edit Item' : 'Tambah Item'}
                </h3>
                <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Foto Item</label>
                  {photoPreview ? (
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg border border-[#E9ECEF]"
                      />
                      <button
                        type="button"
                        onClick={removePhoto}
                        className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-lg hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => document.getElementById('photo-upload')?.click()}
                      className="border-2 border-dashed border-[#E9ECEF] rounded-lg p-6 text-center cursor-pointer hover:border-[#E94560] transition-all"
                    >
                      <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Klik untuk upload foto</p>
                      <p className="text-xs text-gray-400">JPG, PNG (max 10MB)</p>
                    </div>
                  )}
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </div>

                {/* Form Fields */}
                <div>
                  <label className="block text-sm font-medium text-[#1A1A2E] mb-1">
                    Nama Item <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1A1A2E] mb-1">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Kategori</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="flex-1 px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560] bg-white"
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="Uncategorized">Uncategorized</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Stock Toko</label>
                    <input
                      type="number"
                      value={formData.store_stock}
                      onChange={(e) => setFormData({ ...formData, store_stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Stock Gudang</label>
                    <input
                      type="number"
                      value={formData.warehouse_stock}
                      onChange={(e) => setFormData({ ...formData, warehouse_stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
                      min={0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Satuan</label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                      className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
                      placeholder="pcs, box, dll"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[#1A1A2E] mb-1">Min Stock</label>
                    <input
                      type="number"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#E94560]"
                      min={0}
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || uploadingPhoto}
                  className="w-full bg-[#1A1A2E] text-white font-medium py-2.5 rounded-lg hover:bg-[#0F3460] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading || uploadingPhoto ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      {uploadingPhoto ? 'Uploading Foto...' : 'Menyimpan...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      {editingId ? 'Update Item' : 'Tambah Item'}
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inventory List - Card View */}
      {inventory.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p>Belum ada item inventory</p>
          <p className="text-sm">Klik "Tambah Item" untuk menambahkan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {inventory.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div className="relative h-40 bg-gray-100">
                {item.photo_url ? (
                  <img src={item.photo_url} alt={item.item_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => editItem(item)}
                    className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50"
                  >
                    <Edit2 className="w-3 h-3 text-blue-600" />
                  </button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50"
                  >
                    <Trash2 className="w-3 h-3 text-red-600" />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-semibold text-sm text-[#1A1A2E]">{item.item_name}</h4>
                  <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">{item.category || 'Uncategorized'}</span>
                </div>
                <p className="text-xs text-gray-400 mb-2">SKU: {item.sku}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-green-50 rounded p-1.5 text-center border border-green-100">
                    <Package className="w-3 h-3 text-green-600 mx-auto" />
                    <span className="font-semibold text-green-700">{item.store_stock}</span>
                    <span className="text-gray-500 ml-0.5">{item.unit}</span>
                  </div>
                  <div className="bg-blue-50 rounded p-1.5 text-center border border-blue-100">
                    <Warehouse className="w-3 h-3 text-blue-600 mx-auto" />
                    <span className="font-semibold text-blue-700">{item.warehouse_stock}</span>
                    <span className="text-gray-500 ml-0.5">{item.unit}</span>
                  </div>
                </div>
                {item.store_stock <= item.min_stock && (
                  <div className="mt-2 text-[10px] text-red-500 bg-red-50 p-1 rounded text-center">
                    ⚠️ Stock menipis!
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
