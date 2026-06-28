'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/authStore'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Package, Warehouse, Plus, Minus, Loader,
  CheckCircle, AlertCircle, RefreshCw, ArrowRight,
  Search, Truck, Bell, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface SelectedSparepart {
  id: string
  name: string
  sku: string
  quantity: number
  source_type: 'store' | 'warehouse'
  unit: string
  store_stock: number
  warehouse_stock: number
  notes?: string
  is_po?: boolean
}

interface AddSparepartModalProps {
  isOpen: boolean
  onClose: () => void
  service: any
  onSuccess: () => void
  onRequestSparepart?: (query: string) => void
}

export default function AddSparepartModal({
  isOpen,
  onClose,
  service,
  onSuccess,
  onRequestSparepart
}: AddSparepartModalProps) {
  const [selectedSparepartList, setSelectedSparepartList] = useState<SelectedSparepart[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [allInventory, setAllInventory] = useState<any[]>([])
  const [loadingInventory, setLoadingInventory] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferData, setTransferData] = useState<any>(null)
  const [transferQuantity, setTransferQuantity] = useState(1)
  const [transferLoading, setTransferLoading] = useState(false)
  const [showReportAdmin, setShowReportAdmin] = useState(false)
  const [reportMessage, setReportMessage] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()
  const { user } = useAuthStore()

  useEffect(() => {
    if (user) {
      setIsAdmin(user.role === 'admin')
    }
  }, [user])

  useEffect(() => {
    if (isOpen) {
      loadAllInventory()
      setSelectedSparepartList([])
      setSearchQuery('')
    } else {
      setSelectedSparepartList([])
      setSearchQuery('')
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadAllInventory = async () => {
    setLoadingInventory(true)
    try {
      const { data: inventoryData } = await supabase
        .from('inventory')
        .select('*')
        .not('store_stock', 'is', null)
        .order('item_name')

      const { data: poData } = await supabase
        .from('service_orders')
        .select('po_sparepart')
        .eq('status', 'sparepart_ready')
        .eq('assigned_teknisi_id', user?.id)

      let combinedData = (inventoryData || []).filter(item => item.store_stock >= 0)

      poData?.forEach(po => {
        const exists = combinedData.some(item =>
          item.item_name.toLowerCase() === po.po_sparepart.toLowerCase()
        )
        if (!exists && po.po_sparepart) {
          combinedData.push({
            id: `po_${po.po_sparepart}`,
            item_name: po.po_sparepart,
            sku: `PO-${po.po_sparepart}`,
            store_stock: 1,
            warehouse_stock: 0,
            unit: 'pcs',
            min_stock: 0,
            is_po: true
          })
        }
      })

      setAllInventory(combinedData)
    } catch (error) {
      console.error('Error loading inventory:', error)
    } finally {
      setLoadingInventory(false)
    }
  }

  const filteredInventory = useMemo(() => {
    if (!searchQuery.trim()) {
      return allInventory.filter(item => item.store_stock >= 0 || item.is_po).slice(0, 20)
    }
    const query = searchQuery.toLowerCase().trim()
    return allInventory.filter(item =>
      (item.item_name.toLowerCase().includes(query) ||
       item.sku.toLowerCase().includes(query)) &&
      (item.store_stock >= 0 || item.is_po)
    )
  }, [allInventory, searchQuery])

  const isSparepartAlreadySelected = (sparepartId: string) => {
    return selectedSparepartList.some(item => item.id === sparepartId)
  }

  const getAvailableSource = (item: any) => {
    if (item.is_po) return 'store'
    const hasStoreStock = item.store_stock > 0
    const hasWarehouseStock = item.warehouse_stock > 0
    return hasStoreStock ? 'store' : (hasWarehouseStock ? 'warehouse' : null)
  }

  const addSparepartToList = (item: any) => {
    if (isSparepartAlreadySelected(item.id)) {
      toast.error(`"${item.item_name}" sudah ditambahkan`)
      return
    }

    const source = getAvailableSource(item)
    if (!source) {
      toast.error(`Stock "${item.item_name}" habis!`)
      if (!isAdmin) {
        setReportData(item)
        setShowReportAdmin(true)
      }
      return
    }

    const newSparepart: SelectedSparepart = {
      id: item.id,
      name: item.item_name,
      sku: item.sku,
      quantity: 1,
      source_type: source,
      unit: item.unit || 'pcs',
      store_stock: item.store_stock || 0,
      warehouse_stock: item.warehouse_stock || 0,
      notes: '',
      is_po: item.is_po || false
    }

    setSelectedSparepartList([...selectedSparepartList, newSparepart])
    setSearchQuery('')
    setShowDropdown(false)
    toast.success(`"${item.item_name}" ditambahkan`)
  }

  const removeSparepartFromList = (index: number) => {
    const removed = selectedSparepartList[index]
    setSelectedSparepartList(selectedSparepartList.filter((_, i) => i !== index))
    toast.success(`"${removed.name}" dihapus dari daftar`)
  }

  const updateQuantityInList = (index: number, newQuantity: number) => {
    if (newQuantity < 1) return
    const updatedList = [...selectedSparepartList]
    updatedList[index].quantity = newQuantity
    setSelectedSparepartList(updatedList)
  }

  const getTotalSparepart = () => {
    return selectedSparepartList.reduce((total, item) => total + item.quantity, 0)
  }

  const [reportData, setReportData] = useState<any>(null)

  const handleTransferStock = async () => {
    if (!transferData) return

    if (transferQuantity > transferData.warehouse_stock) {
      toast.error(`Stock gudang hanya ${transferData.warehouse_stock} ${transferData.unit}`)
      return
    }

    setTransferLoading(true)
    try {
      const { error } = await supabase
        .from('inventory')
        .update({
          warehouse_stock: transferData.warehouse_stock - transferQuantity,
          store_stock: transferData.store_stock + transferQuantity
        })
        .eq('sku', transferData.sku)

      if (error) throw error

      toast.success(`${transferQuantity} ${transferData.unit} berhasil ditransfer!`)
      await loadAllInventory()
      setShowTransferModal(false)
      setTransferQuantity(1)
      setTransferData(null)

    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setTransferLoading(false)
    }
  }

  const handleReportAdmin = async () => {
    if (!reportMessage.trim()) {
      toast.error('Harap berikan pesan untuk admin')
      return
    }

    setReportLoading(true)
    try {
      const { data: admins } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'admin')

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await supabase.from('notifications').insert({
            user_id: admin.id,
            title: '📦 Laporan Stock Sparepart',
            message: `${user?.full_name} melaporkan stock ${reportData?.item_name || 'sparepart'} (SKU: ${reportData?.sku}) habis. Pesan: ${reportMessage}`,
            type: 'warning',
            link: '/admin/inventory',
            is_read: false
          })
        }
      }

      toast.success('Laporan terkirim ke admin!')
      setShowReportAdmin(false)
      setReportMessage('')
      setReportData(null)

    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setReportLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()

  if (selectedSparepartList.length === 0) {
    toast.error('Tambahkan minimal 1 sparepart')
    return
  }

  // Cek stock untuk non-PO items
  for (const sparepart of selectedSparepartList) {
    if (sparepart.is_po) continue
    const currentStock = sparepart.source_type === 'store'
      ? sparepart.store_stock
      : sparepart.warehouse_stock

    if (currentStock < sparepart.quantity) {
      toast.error(`Stock "${sparepart.name}" tidak mencukupi! Tersedia: ${currentStock}`)
      return
    }
  }

  setLoading(true)

  try {
    // Cek apakah ada PO item yang diambil
    const hasPO = selectedSparepartList.some(s => s.is_po)
    console.log('📦 hasPO:', hasPO)
    console.log('📦 selectedSparepartList:', selectedSparepartList)

    // Proses setiap sparepart
    for (const sparepart of selectedSparepartList) {
      if (!sparepart.is_po) {
        const updateField = sparepart.source_type === 'store' ? 'store_stock' : 'warehouse_stock'
        const currentStock = sparepart.source_type === 'store'
          ? sparepart.store_stock
          : sparepart.warehouse_stock

        await supabase
          .from('inventory')
          .update({ [updateField]: currentStock - sparepart.quantity })
          .eq('id', sparepart.id)
      }

      await supabase
        .from('service_items')
        .insert({
          service_order_id: service.id,
          item_type: 'sparepart',
          name: sparepart.name,
          quantity: sparepart.quantity,
          price: 0
        })
    }

    // =============================================
    // UPDATE STATUS - FORCE UPDATE TERLEPAS DARI hasPO
    // =============================================
    console.log('🔄 FORCE UPDATE STATUS: sparepart_ready → in_progress')
    console.log('📦 Service ID:', service.id)

    // UPDATE STATUS SERVICE - PAKAI .update LANGSUNG
    const { error: updateError } = await supabase
      .from('service_orders')
      .update({
        status: 'in_progress',
        po_status: 'completed'
      })
      .eq('id', service.id)

    if (updateError) {
      console.error('❌ Error update status:', updateError)
      throw updateError
    }

    console.log('✅ Status berhasil diupdate ke in_progress')

    // Cek apakah update berhasil
    const { data: checkData } = await supabase
      .from('service_orders')
      .select('status, po_status')
      .eq('id', service.id)
      .single()

    console.log('📊 Status setelah update:', checkData)

    // Add to timeline - selalu tambahkan
    await supabase.from('service_timeline').insert({
      service_order_id: service.id,
      teknisi_id: user?.id,
      status: 'in_progress',
      message: `Sparepart PO telah diambil, service dilanjutkan`,
      details: {
        action: 'po_sparepart_taken',
        sparepart_list: selectedSparepartList.filter(s => s.is_po).map(s => s.name)
      }
    })

    toast.success('Sparepart berhasil diambil! Service dilanjutkan.')

    // Refresh data di parent
    onSuccess()
    onClose()
    setSuccess(false)
    setLoading(false)
    return

  } catch (error: any) {
    console.error('❌ Submit error:', error)
    toast.error(error.message)
    setLoading(false)
  }
}

  if (!isOpen) return null

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border border-slate-200"
        >
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">SPAREPART DIAMBIL!</h3>
          <p className="text-slate-500 mb-4">{selectedSparepartList.length} sparepart berhasil diambil.</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-200"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">TAMBAH SPAREPART</h3>
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
              {selectedSparepartList.length} terpilih
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-all">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Search */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Cari Sparepart
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                placeholder="Ketik nama sparepart..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                autoComplete="off"
              />
              {loadingInventory && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && searchQuery && filteredInventory.length > 0 && !loadingInventory && (
              <div className="absolute z-50 w-full mt-1">
                <div className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filteredInventory.map((item) => {
                    const isSelected = isSparepartAlreadySelected(item.id)
                    const hasStock = item.store_stock > 0 || item.warehouse_stock > 0 || item.is_po
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!isSelected) {
                            if (hasStock) {
                              addSparepartToList(item)
                            } else {
                              toast.error(`Stock "${item.item_name}" habis!`)
                              if (!isAdmin) {
                                setReportData(item)
                                setShowReportAdmin(true)
                              }
                            }
                          } else {
                            toast.error(`"${item.item_name}" sudah di daftar`)
                          }
                        }}
                        className={`px-3 py-2.5 cursor-pointer transition-all border-b border-slate-200 last:border-0 ${
                          isSelected ? 'bg-slate-100 opacity-60' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{item.item_name}</p>
                            <p className="text-xs text-slate-400">SKU: {item.sku}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 text-xs">
                              {item.is_po && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                  📦 PO Ready
                                </span>
                              )}
                              {!item.is_po && item.store_stock > 0 && (
                                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                  🏪 {item.store_stock}
                                </span>
                              )}
                              {!item.is_po && item.warehouse_stock > 0 && (
                                <span className={`px-1.5 py-0.5 rounded ${item.store_stock > 0 ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'}`}>
                                  🏭 {item.warehouse_stock}
                                </span>
                              )}
                              {!item.is_po && !hasStock && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Kosong</span>
                              )}
                            </div>
                            {isSelected ? (
                              <span className="text-xs text-green-600">✓</span>
                            ) : hasStock ? (
                              <span className="text-xs text-blue-600">+</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {showDropdown && searchQuery && filteredInventory.length === 0 && !loadingInventory && (
              <div className="absolute z-50 w-full mt-1">
                <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4 text-center">
                  <p className="text-sm text-slate-500">Tidak ada sparepart ditemukan</p>
                  {onRequestSparepart && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          onClose()
                          onRequestSparepart(searchQuery)
                        }}
                        className="mt-3 w-full py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all flex items-center justify-center gap-2"
                      >
                        <Package className="w-4 h-4" />
                        Request "{searchQuery}" (PO)
                      </button>
                      <p className="text-xs text-slate-400 mt-2">Tidak ditemukan? Request ke admin untuk di-PO</p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected Sparepart List */}
          {selectedSparepartList.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                <p className="text-xs font-medium text-slate-500">DAFTAR SPAREPART ({selectedSparepartList.length})</p>
              </div>
              <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto">
                {selectedSparepartList.map((sparepart, index) => (
                  <div key={index} className="p-3 hover:bg-slate-50 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{sparepart.name}</p>
                          {sparepart.is_po && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                              📦 PO
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-slate-400">SKU: {sparepart.sku}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            sparepart.source_type === 'store'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {sparepart.source_type === 'store' ? '🏪 Toko' : '🏭 Gudang'}
                          </span>
                          {!sparepart.is_po && (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateQuantityInList(index, sparepart.quantity - 1)}
                                className="w-6 h-6 border border-slate-200 rounded hover:bg-slate-100"
                              >
                                -
                              </button>
                              <span className="text-sm font-medium w-6 text-center">{sparepart.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantityInList(index, sparepart.quantity + 1)}
                                className="w-6 h-6 border border-slate-200 rounded hover:bg-slate-100"
                              >
                                +
                              </button>
                            </div>
                          )}
                          {sparepart.is_po && (
                            <span className="text-xs text-green-600 font-medium">✅ Siap diambil</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSparepartFromList(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-medium">Total Item</span>
                <span className="text-lg font-bold text-slate-900">
                  {getTotalSparepart()} pcs
                </span>
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Informasi Service</p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-medium truncate">{service.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-mono text-xs">{service.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Device:</span>
                <span className="truncate">{service.watch_brand || service.device_brand}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || selectedSparepartList.length === 0}
            className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                MENGAMBIL...
              </>
            ) : (
              <>
                <Package className="w-4 h-4" />
                AMBIL {selectedSparepartList.length} SPAREPART
              </>
            )}
          </button>
        </form>
      </motion.div>

      {/* Transfer Stock Modal */}
      {showTransferModal && transferData && isAdmin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Transfer Stock</h3>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-sm font-medium">{transferData.item_name}</p>
                <p className="text-xs text-slate-400">SKU: {transferData.sku}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                  <p className="text-xs text-slate-500">Toko</p>
                  <p className="text-xl font-bold text-red-500">{transferData.store_stock} {transferData.unit}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-xs text-slate-500">Gudang</p>
                  <p className="text-xl font-bold text-green-600">{transferData.warehouse_stock} {transferData.unit}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">Jumlah Transfer</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferQuantity(Math.max(1, transferQuantity - 1))}
                    className="w-9 h-9 border border-slate-200 rounded-lg font-bold hover:bg-slate-50"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min={1}
                    max={transferData.warehouse_stock}
                    className="w-20 text-center px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setTransferQuantity(Math.min(transferData.warehouse_stock, transferQuantity + 1))}
                    className="w-9 h-9 border border-slate-200 rounded-lg font-bold hover:bg-slate-50"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Maks: {transferData.warehouse_stock} {transferData.unit}</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 bg-white text-slate-900 border border-slate-200 py-2 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleTransferStock}
                  disabled={transferLoading || transferQuantity > transferData.warehouse_stock}
                  className="flex-1 bg-yellow-500 text-white py-2 rounded-lg hover:bg-yellow-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {transferLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Transfer <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Report Admin Modal */}
      {showReportAdmin && reportData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Lapor Admin</h3>
              </div>
              <button
                onClick={() => setShowReportAdmin(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="text-sm font-medium">{reportData.item_name}</p>
                <p className="text-xs text-slate-400">SKU: {reportData.sku}</p>
                <div className="mt-2 flex gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">Toko: {reportData.store_stock || 0}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Gudang: {reportData.warehouse_stock || 0}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-900 mb-1">Pesan untuk Admin</label>
                <textarea
                  value={reportMessage}
                  onChange={(e) => setReportMessage(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 resize-none"
                  placeholder="Contoh: Stock sparepart habis, mohon diisi ulang..."
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowReportAdmin(false)}
                  className="flex-1 bg-white text-slate-900 border border-slate-200 py-2 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleReportAdmin}
                  disabled={reportLoading || !reportMessage.trim()}
                  className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {reportLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      Kirim Laporan
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
