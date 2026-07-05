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
    store_stock: '',
    warehouse_stock: '',
    unit: 'pcs',
    min_stock: '',
    price: ''
  })
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [transferItemId, setTransferItemId] = useState<string>('')
  const [transferQuantity, setTransferQuantity] = useState('')
  const [transferFrom, setTransferFrom] = useState<'warehouse' | 'store'>('warehouse')
  const [transferTo, setTransferTo] = useState<'warehouse' | 'store'>('store')
  const [transferNotes, setTransferNotes] = useState('')
  const [transferPhotoFile, setTransferPhotoFile] = useState<File | null>(null)
  const [transferPhotoPreview, setTransferPhotoPreview] = useState<string | null>(null)

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
      store_stock: '',
      warehouse_stock: '',
      unit: 'pcs',
      min_stock: '',
      price: ''
    })
    setEditingId(null)
    setShowForm(false)
    removePhoto()
  }

  const editItem = (item: any) => {
    setFormData({
      item_name: item.item_name,
      sku: item.sku,
      category: item.category || '',
      store_stock: String(item.store_stock ?? 0),
      warehouse_stock: String(item.warehouse_stock ?? 0),
      unit: item.unit || 'pcs',
      min_stock: String(item.min_stock ?? 0),
      price: String(item.price ?? 0)
    })
    setEditingId(item.id)
    setShowForm(true)
    if (item.photo_url) {
      setPhotoPreview(item.photo_url)
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
      return
    }

    toast.success('Item berhasil dihapus!')
    fetchInventory()
    onUpdate?.()
  }

  const openTransferForm = (itemId?: string) => {
    setTransferItemId(itemId || '')
    setTransferQuantity('')
    setTransferFrom('warehouse')
    setTransferTo('store')
    setTransferNotes('')
    setTransferPhotoFile(null)
    setTransferPhotoPreview(null)
    setShowTransferForm(true)
  }

  const handleTransferPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      setTransferPhotoFile(file)
      setTransferPhotoPreview(URL.createObjectURL(file))
    }
  }

  const removeTransferPhoto = () => {
    setTransferPhotoFile(null)
    if (transferPhotoPreview) {
      URL.revokeObjectURL(transferPhotoPreview)
      setTransferPhotoPreview(null)
    }
  }

  const submitTransfer = async () => {
    if (!transferItemId || !transferQuantity) {
      toast.error('Pilih item dan jumlah transfer')
      return
    }

    const qty = parseInt(transferQuantity, 10)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Jumlah harus lebih dari 0')
      return
    }

    const selectedItem = inventory.find(item => item.id === transferItemId)
    if (!selectedItem) {
      toast.error('Item tidak ditemukan')
      return
    }

    const sourceStock = transferFrom === 'warehouse' ? selectedItem.warehouse_stock : selectedItem.store_stock
    if (sourceStock < qty) {
      toast.error('Stock tidak cukup')
      return
    }

    setLoading(true)
    let photoUrl = ''

    try {
      if (transferPhotoFile) {
        photoUrl = await uploadFile(transferPhotoFile, { type: 'inventory' }) || ''
      }

      const { error: transferError } = await supabase
        .from('stock_transfers')
        .insert({
          inventory_id: transferItemId,
          from_location: transferFrom,
          to_location: transferTo,
          quantity: qty,
          notes: transferNotes || null,
          photo_url: photoUrl || null,
          created_by: user?.id
        })

      if (transferError) throw transferError

      const warehouseDelta = transferFrom === 'warehouse' ? -qty : (transferTo === 'warehouse' ? qty : 0)
      const storeDelta = transferFrom === 'store' ? -qty : (transferTo === 'store' ? qty : 0)

      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          warehouse_stock: Math.max(0, (selectedItem.warehouse_stock || 0) + warehouseDelta),
          store_stock: Math.max(0, (selectedItem.store_stock || 0) + storeDelta)
        })
        .eq('id', transferItemId)

      if (updateError) throw updateError

      const caption = `STOCK TRANSFER
Item: ${selectedItem.item_name}
SKU: ${selectedItem.sku}
Dari: ${transferFrom === 'warehouse' ? 'Gudang' : 'Toko'}
Ke: ${transferTo === 'warehouse' ? 'Gudang' : 'Toko'}
Jumlah: ${qty} ${selectedItem.unit}
Admin: ${user?.full_name || 'Admin'}`

      if (photoUrl && transferPhotoFile) {
        await uploadFile(transferPhotoFile, { type: 'inventory', caption })
      }

      toast.success('Stock transfer berhasil!')
      setShowTransferForm(false)
      fetchInventory()
      onUpdate?.()
    } catch (error: any) {
      console.error('Transfer error:', error)
      toast.error(error.message || 'Gagal transfer stock')
    } finally {
      setLoading(false)
    }
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
        item_name: formData.item_name,
        sku: formData.sku,
        category: formData.category || 'Uncategorized',
        store_stock: parseInt(formData.store_stock) || 0,
        warehouse_stock: parseInt(formData.warehouse_stock) || 0,
        unit: formData.unit || 'pcs',
        min_stock: parseInt(formData.min_stock) || 0,
        price: parseInt(formData.price) || 0,
        photo_url: photoUrl || null
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
      onUpdate?.()
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Manajemen Inventori</h3>
          <p className="text-sm text-slate-500">Kelola stock sparepart</p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm(true)
          }}
          className="bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah Item
        </button>
        <button
          onClick={() => openTransferForm()}
          className="bg-amber-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-amber-700 transition-all flex items-center gap-2 text-sm"
        >
          <Package className="w-4 h-4" />
          Transfer Stock
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-200 p-6"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Edit Item' : 'Tambah Item'}
                </h3>
                <button onClick={resetForm} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Foto Item</label>
                  {photoPreview ? (
                    <div className="relative">
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-full h-32 object-cover rounded-lg border border-slate-200"
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
                      className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-blue-600 transition-all"
                    >
                      <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500">Klik untuk upload foto</p>
                      <p className="text-xs text-slate-400">JPG, PNG (max 10MB)</p>
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
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    Nama Item <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.item_name}
                    onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-1">Kategori</label>
                  <div className="flex gap-2">
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                    >
                      <option value="">Pilih Kategori</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="Uncategorized">Uncategorized</option>
                    </select>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      id="new-category-input"
                      placeholder="Tambah kategori baru..."
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-sm"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const input = e.currentTarget
                          const name = input.value.trim()
                          if (!name) return
                          setLoading(true)
                          try {
                            const { error } = await supabase
                              .from('categories')
                              .insert([{ name }])
                            if (error) throw error
                            toast.success('Kategori berhasil ditambahkan')
                            input.value = ''
                            await fetchCategories()
                          } catch (err: any) {
                            toast.error(err.message)
                          } finally {
                            setLoading(false)
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const input = document.getElementById('new-category-input') as HTMLInputElement | null
                        const name = input?.value.trim()
                        if (!name) return
                        setLoading(true)
                        try {
                          const { error } = await supabase
                            .from('categories')
                            .insert([{ name }])
                          if (error) throw error
                          toast.success('Kategori berhasil ditambahkan')
                          if (input) input.value = ''
                          await fetchCategories()
                        } catch (err: any) {
                          toast.error(err.message)
                        } finally {
                          setLoading(false)
                        }
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">Stock Toko</label>
                    <input
                      type="number"
                      value={formData.store_stock}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '')
                        setFormData({ ...formData, store_stock: raw })
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-1">Stock Gudang</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.warehouse_stock}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '')
                        setFormData({ ...formData, warehouse_stock: raw })
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1">Harga (Rp)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.price}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '')
                          setFormData({ ...formData, price: raw })
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                        placeholder="0"
                      />
                    </div>

                   <div>
                     <label className="block text-sm font-medium text-slate-900 mb-1">Satuan</label>
                     <input
                       type="text"
                       value={formData.unit}
                       onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                       className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                       placeholder="pcs, box, dll"
                     />
                   </div>
                 </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-900 mb-1">Min Stock</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.min_stock}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '')
                          setFormData({ ...formData, min_stock: raw })
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div></div>
                  </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading || uploadingPhoto}
                  className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
        <div className="text-center py-12 text-slate-400">
          <Package className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p>Belum ada item inventory</p>
          <p className="text-sm">Klik "Tambah Item" untuk menambahkan</p>
        </div>
      ) : (
        <>
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Semua
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeCategory === cat
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {inventory
              .filter(item => activeCategory === 'all' || item.category === activeCategory)
              .map((item) => (
              <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="relative h-40 bg-slate-100">
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={item.item_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                   <div className="absolute top-2 right-2 flex gap-1">
                     <button
                       onClick={() => openTransferForm(item.id)}
                       className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-slate-50"
                       title="Transfer Stock"
                     >
                       <Package className="w-3 h-3 text-amber-600" />
                     </button>
                     <button
                       onClick={() => editItem(item)}
                       className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-slate-50"
                     >
                       <Edit2 className="w-3 h-3 text-blue-600" />
                     </button>
                     <button
                       onClick={() => deleteItem(item.id)}
                       className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-slate-50"
                     >
                       <Trash2 className="w-3 h-3 text-red-600" />
                     </button>
                   </div>
                </div>
                <div className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-sm text-slate-900">{item.item_name}</h4>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full">{item.category || 'Uncategorized'}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">SKU: {item.sku}</p>
                  {item.price > 0 && (
                    <p className="text-xs font-bold text-blue-600 mb-2">
                      Rp {Number(item.price).toLocaleString('id-ID')}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-green-50 rounded p-1.5 text-center border border-green-100">
                      <Package className="w-3 h-3 text-green-600 mx-auto" />
                      <span className="font-semibold text-green-700">{item.store_stock}</span>
                      <span className="text-slate-500 ml-0.5">{item.unit}</span>
                    </div>
                    <div className="bg-blue-50 rounded p-1.5 text-center border border-blue-100">
                      <Warehouse className="w-3 h-3 text-blue-600 mx-auto" />
                      <span className="font-semibold text-blue-700">{item.warehouse_stock}</span>
                      <span className="text-slate-500 ml-0.5">{item.unit}</span>
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
         </>
       )}
     </div>

     {/* Transfer Stock Modal */}
     <AnimatePresence>
       {showTransferForm && (
         <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <motion.div
             initial={{ scale: 0.95, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             exit={{ scale: 0.95, opacity: 0 }}
             className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 max-h-[85vh] overflow-y-auto"
           >
             <div className="flex justify-between items-center p-4 border-b border-slate-200">
               <h3 className="text-base font-semibold text-slate-900">Transfer Stock</h3>
               <button onClick={() => setShowTransferForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                 <X className="w-5 h-5 text-slate-500" />
               </button>
             </div>
             <div className="p-4 space-y-3">
               <div>
                 <label className="block text-sm font-medium text-slate-900 mb-1">Item</label>
                 <select
                   value={transferItemId}
                   onChange={(e) => setTransferItemId(e.target.value)}
                   className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                 >
                   <option value="">Pilih item</option>
                   {inventory.map(item => (
                     <option key={item.id} value={item.id}>{item.item_name} ({item.sku})</option>
                   ))}
                 </select>
               </div>
               <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="block text-sm font-medium text-slate-900 mb-1">Dari</label>
                   <select
                     value={transferFrom}
                     onChange={(e) => {
                       const val = e.target.value as 'warehouse' | 'store'
                       setTransferFrom(val)
                       if (val === transferTo) setTransferTo(val === 'warehouse' ? 'store' : 'warehouse')
                     }}
                     className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                   >
                     <option value="warehouse">Gudang</option>
                     <option value="store">Toko</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-slate-900 mb-1">Ke</label>
                   <select
                     value={transferTo}
                     onChange={(e) => {
                       const val = e.target.value as 'warehouse' | 'store'
                       setTransferTo(val)
                       if (val === transferFrom) setTransferFrom(val === 'warehouse' ? 'store' : 'warehouse')
                     }}
                     className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                   >
                     <option value="warehouse">Gudang</option>
                     <option value="store">Toko</option>
                   </select>
                 </div>
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-900 mb-1">Jumlah</label>
                 <input
                   type="text"
                   inputMode="numeric"
                   value={transferQuantity}
                   onChange={(e) => setTransferQuantity(e.target.value.replace(/[^0-9]/g, ''))}
                   className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                   placeholder="0"
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-900 mb-1">Catatan</label>
                 <textarea
                   value={transferNotes}
                   onChange={(e) => setTransferNotes(e.target.value)}
                   rows={2}
                   className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 text-sm resize-none"
                   placeholder="Opsional..."
                 />
               </div>
               <div>
                 <label className="block text-sm font-medium text-slate-900 mb-1">Foto Bukti</label>
                 <input
                   type="file"
                   accept="image/*"
                   onChange={handleTransferPhotoSelect}
                   className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                 />
                 {transferPhotoPreview && (
                   <div className="mt-2 relative">
                     <img src={transferPhotoPreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                     <button
                       type="button"
                       onClick={removeTransferPhoto}
                       className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                     >
                       <X className="w-4 h-4" />
                     </button>
                   </div>
                 )}
               </div>
               <button
                 onClick={submitTransfer}
                 disabled={loading}
                 className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
               >
                 {loading ? (
                   <>
                     <Loader className="w-4 h-4 animate-spin" />
                     Memproses...
                   </>
                 ) : (
                   'Transfer Stock'
                 )}
               </button>
             </div>
           </motion.div>
         </div>
       )}
     </AnimatePresence>
   )
 }
