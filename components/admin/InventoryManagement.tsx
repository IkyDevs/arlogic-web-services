'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Inventory } from '@/types'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { Plus, Edit2, Save, X, Package, Warehouse } from 'lucide-react'

export default function InventoryManagement() {
  const [inventory, setInventory] = useState<Inventory[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    item_name: '',
    sku: '',
    store_stock: 0,
    warehouse_stock: 0,
    unit: '',
    min_stock: 0
  })
  const supabase = createClient()

  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to fetch inventory')
    } else {
      setInventory(data || [])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (editingId) {
      const { error } = await supabase
        .from('inventory')
        .update(formData)
        .eq('id', editingId)

      if (error) {
        toast.error('Failed to update item')
      } else {
        toast.success('Item updated successfully')
        setEditingId(null)
        fetchInventory()
      }
    } else {
      const { error } = await supabase
        .from('inventory')
        .insert([formData])

      if (error) {
        toast.error('Failed to add item')
      } else {
        toast.success('Item added successfully')
        fetchInventory()
      }
    }

    setShowAddForm(false)
    resetForm()
  }

  const resetForm = () => {
    setFormData({
      item_name: '',
      sku: '',
      store_stock: 0,
      warehouse_stock: 0,
      unit: '',
      min_stock: 0
    })
  }

  const updateStock = async (id: string, field: 'store_stock' | 'warehouse_stock', value: number) => {
    const { error } = await supabase
      .from('inventory')
      .update({ [field]: value })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update stock')
    } else {
      toast.success('Stock updated')
      fetchInventory()
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Inventory Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Item
        </button>
      </div>

      {/* Add/Edit Form Modal */}
      {(showAddForm || editingId) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-xl p-6 w-full max-w-md"
          >
            <h3 className="text-xl font-bold mb-4">{editingId ? 'Edit Item' : 'Add New Item'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input                type="text"
                placeholder="Item Name"
                value={formData.item_name}
                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="SKU"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
              <input
                type="text"
                placeholder="Unit (pcs, box, etc)"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
              <input
                type="number"
                placeholder="Store Stock"
                value={formData.store_stock}
                onChange={(e) => setFormData({ ...formData, store_stock: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              <input
                type="number"
                placeholder="Warehouse Stock"
                value={formData.warehouse_stock}
                onChange={(e) => setFormData({ ...formData, warehouse_stock: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              <input
                type="number"
                placeholder="Minimum Stock"
                value={formData.min_stock}
                onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg"
              />
              <div className="flex gap-3">
                <button type="submit" className="flex-1 btn-primary">Save</button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false)
                    setEditingId(null)
                    resetForm()
                  }}
                  className="flex-1 btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {inventory.map((item) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">{item.item_name}</h3>
                <p className="text-sm text-gray-500">SKU: {item.sku}</p>
              </div>
              <button
                onClick={() => {
                  setEditingId(item.id)
                  setFormData(item)
                  setShowAddForm(true)
                }}
                className="text-blue-600 hover:text-blue-800"
              >
                <Edit2 className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Store Stock</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{item.store_stock} {item.unit}</span>
                  <button
                    onClick={() => updateStock(item.id, 'store_stock', item.store_stock + 1)}
                    className="text-green-600 hover:text-green-800 text-sm"
                  >
                    +1
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-4 h-4 text-gray-500" />
                  <span className="text-sm">Warehouse Stock</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{item.warehouse_stock} {item.unit}</span>
                  <button
                    onClick={() => updateStock(item.id, 'warehouse_stock', item.warehouse_stock + 1)}
                    className="text-green-600 hover:text-green-800 text-sm"
                  >
                    +1
                  </button>
                </div>
              </div>

              {item.store_stock <= item.min_stock && (
                <div className="mt-3 p-2 bg-red-50 text-red-600 rounded text-xs">
                  ⚠️ Low stock! Please restock
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
