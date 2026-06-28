'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Category } from '@/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Edit2, Trash2, Save, Loader } from 'lucide-react'
import toast from 'react-hot-toast'

interface CategoryManagerProps {
  onCategoryChange?: () => void
}

export default function CategoryManager({ onCategoryChange }: CategoryManagerProps) {
  const [categories, setCategories] = useState<Category[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .order('name')
    if (data) setCategories(data)
  }

  const addCategory = async () => {
    if (!newCategory.trim()) {
      toast.error('Nama kategori wajib diisi')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('categories')
        .insert([{ name: newCategory.trim() }])

      if (error) throw error

      toast.success('Kategori berhasil ditambahkan')
      setNewCategory('')
      await fetchCategories()
      if (onCategoryChange) onCategoryChange()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const updateCategory = async (id: string) => {
    if (!editingName.trim()) {
      toast.error('Nama kategori wajib diisi')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: editingName.trim() })
        .eq('id', id)

      if (error) throw error

      toast.success('Kategori berhasil diupdate')
      setEditingId(null)
      setEditingName('')
      await fetchCategories()
      if (onCategoryChange) onCategoryChange()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Kategori berhasil dihapus')
      await fetchCategories()
      if (onCategoryChange) onCategoryChange()
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
      >
        <Edit2 className="w-3 h-3" />
        Kelola Kategori
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 z-50 p-4"
          >
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-sm">Kelola Kategori</h4>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Add New */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nama kategori baru..."
                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
              />
              <button
                onClick={addCategory}
                disabled={loading}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List Categories */}
            <div className="max-h-48 overflow-y-auto space-y-1">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                  {editingId === cat.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded"
                      />
                      <button
                        onClick={() => updateCategory(cat.id)}
                        disabled={loading}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <Save className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm">{cat.name}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingId(cat.id)
                            setEditingName(cat.name)
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          disabled={loading}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
