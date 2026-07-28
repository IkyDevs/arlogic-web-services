"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus, Trash2, Wrench, Package, Save,
  X, Edit3, Loader, AlertCircle,
} from "lucide-react"
import toast from "react-hot-toast"
import type { ServiceItem } from "@/lib/domain/service-order/types"
import { formatRupiah } from "@/lib/domain/shared/formatters"
import { validateServiceItem } from "@/lib/domain/shared/validation"

interface ServiceItemManagerProps {
  serviceOrderId: string
  teknisiId: string
  teknisiName?: string
  finalOnly?: boolean
  readonly?: boolean
  onItemsChange?: (items: ServiceItem[]) => void
}

export default function ServiceItemManager({
  serviceOrderId,
  teknisiId,
  teknisiName,
  finalOnly = false,
  readonly = false,
  onItemsChange,
}: ServiceItemManagerProps) {
  const [items, setItems] = useState<ServiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [itemType, setItemType] = useState<"jasa" | "sparepart">("jasa")
  const [itemName, setItemName] = useState("")
  const [itemQty, setItemQty] = useState(1)
  const [itemPrice, setItemPrice] = useState(0)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState(0)
  const [editQty, setEditQty] = useState(1)

  const supabase = createClient()

  const fetchItems = useCallback(async () => {
    setLoading(true)
    let query = supabase.from("service_items").select("*").eq("service_order_id", serviceOrderId)
    if (finalOnly) query = query.eq("is_final", true)
    const { data } = await query.order("created_at", { ascending: true })
    if (data) {
      setItems(data as ServiceItem[])
      onItemsChange?.(data as ServiceItem[])
    }
    setLoading(false)
  }, [serviceOrderId, finalOnly, onItemsChange])

  useEffect(() => {
    fetchItems()

    const channel = supabase
      .channel(`service-items-${serviceOrderId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_items", filter: `service_order_id=eq.${serviceOrderId}` },
        fetchItems,
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [serviceOrderId])

  const handleAdd = async () => {
    const errors = validateServiceItem({ name: itemName, price: itemPrice, quantity: itemQty, item_type: itemType })
    if (errors.length > 0) {
      toast.error(errors[0].message)
      return
    }

    setSaving(true)
    try {
      const { data, error } = await supabase
        .from("service_items")
        .insert({
          service_order_id: serviceOrderId,
          item_type: itemType,
          name: itemName.trim(),
          quantity: itemQty,
          price: itemPrice,
          is_final: finalOnly,
        })
        .select()
        .single()

      if (error) throw error

      // Timeline WITHOUT nominal
      const itemTypeLabel = itemType === "jasa" ? "Jasa" : "Sparepart"
      await supabase.from("service_timeline").insert({
        service_order_id: serviceOrderId,
        teknisi_id: teknisiId,
        status: "item_added",
        message: `Tambah ${itemTypeLabel}\n${itemName.trim()}`,
        details: { action: "add_item", item_type: itemType, item_id: data?.id },
      })

      toast.success(`${itemTypeLabel} berhasil ditambahkan`)
      setItemName("")
      setItemQty(1)
      setItemPrice(0)
      setShowAddForm(false)
      fetchItems()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menambah item")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (itemId: string) => {
    try {
      await supabase.from("service_items").delete().eq("id", itemId)

      await supabase.from("service_timeline").insert({
        service_order_id: serviceOrderId,
        teknisi_id: teknisiId,
        status: "item_deleted",
        message: `Item dihapus`,
        details: { action: "delete_item", item_id: itemId },
      })

      toast.success("Item dihapus")
      fetchItems()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus item")
    }
  }

  const handleUpdate = async (itemId: string) => {
    setSaving(true)
    try {
      await supabase.from("service_items").update({ price: editPrice, quantity: editQty }).eq("id", itemId)

      await supabase.from("service_timeline").insert({
        service_order_id: serviceOrderId,
        teknisi_id: teknisiId,
        status: "item_updated",
        message: `Item diupdate`,
        details: { action: "update_item", item_id: itemId },
      })

      toast.success("Item diupdate")
      setEditingId(null)
      fetchItems()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal mengupdate item")
    } finally {
      setSaving(false)
    }
  }

  const totalJasa = items.filter((i) => i.item_type === "jasa").reduce((s, i) => s + i.price * i.quantity, 0)
  const totalSparepart = items.filter((i) => i.item_type === "sparepart").reduce((s, i) => s + i.price * i.quantity, 0)
  const grandTotal = totalJasa + totalSparepart

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Jasa Section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Jasa</h4>
        {items.filter((i) => i.item_type === "jasa").length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Belum ada jasa</p>
        ) : (
          <div className="space-y-1.5">
            {items.filter((i) => i.item_type === "jasa").map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                {editingId === item.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                    <input
                      type="number"
                      value={editQty}
                      onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg"
                    />
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-lg"
                    />
                    <button onClick={() => handleUpdate(item.id)} disabled={saving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-pink-100 text-pink-700 flex-shrink-0">JASA</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</span>
                      <span className="text-xs text-gray-400">x{item.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(item.price * item.quantity)}</span>
                      {!readonly && !finalOnly && (
                        <>
                          <button
                            onClick={() => { setEditingId(item.id); setEditPrice(item.price); setEditQty(item.quantity) }}
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sparepart Section */}
      <div>
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sparepart</h4>
        {items.filter((i) => i.item_type === "sparepart").length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Belum ada sparepart</p>
        ) : (
          <div className="space-y-1.5">
            {items.filter((i) => i.item_type === "sparepart").map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                {editingId === item.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm text-gray-700">{item.name}</span>
                    <input
                      type="number"
                      value={editQty}
                      onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1 text-xs border border-gray-200 rounded-lg"
                    />
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-24 px-2 py-1 text-xs border border-gray-200 rounded-lg"
                    />
                    <button onClick={() => handleUpdate(item.id)} disabled={saving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700 flex-shrink-0">SPR</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.name}</span>
                      <span className="text-xs text-gray-400">x{item.quantity}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatRupiah(item.price * item.quantity)}</span>
                      {!readonly && !finalOnly && (
                        <>
                          <button
                            onClick={() => { setEditingId(item.id); setEditPrice(item.price); setEditQty(item.quantity) }}
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1 text-red-400 hover:bg-red-50 rounded">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Item Form */}
      {!readonly && !finalOnly && (
        <AnimatePresence>
          {showAddForm ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-3"
            >
              <div className="flex gap-2">
                <button
                  onClick={() => setItemType("jasa")}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                    itemType === "jasa" ? "bg-pink-600 text-white" : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" /> Jasa
                </button>
                <button
                  onClick={() => setItemType("sparepart")}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                    itemType === "sparepart" ? "bg-purple-600 text-white" : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" /> Sparepart
                </button>
              </div>

              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder={itemType === "jasa" ? "Nama jasa..." : "Nama sparepart..."}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={itemQty}
                    onChange={(e) => setItemQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1">Harga</label>
                  <input
                    type="number"
                    min={0}
                    value={itemPrice}
                    onChange={(e) => setItemPrice(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowAddForm(false)} className="flex-1 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-100">
                  Batal
                </button>
                <button onClick={handleAdd} disabled={saving || !itemName.trim()} className="flex-1 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                  {saving ? "Menyimpan..." : "Tambah"}
                </button>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-500 hover:text-gray-900 hover:border-gray-900 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Tambah Item
            </button>
          )}
        </AnimatePresence>
      )}

      {/* Total */}
      {items.length > 0 && (
        <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 border border-gray-200 dark:border-white/10 space-y-1">
          {totalJasa > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Jasa</span>
              <span className="font-medium text-gray-900">{formatRupiah(totalJasa)}</span>
            </div>
          )}
          {totalSparepart > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Sparepart</span>
              <span className="font-medium text-gray-900">{formatRupiah(totalSparepart)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm pt-1.5 border-t border-gray-200 dark:border-white/10">
            <span className="font-semibold text-gray-700">Grand Total</span>
            <span className="font-bold text-gray-900">{formatRupiah(grandTotal)}</span>
          </div>
        </div>
      )}
    </div>
  )
}