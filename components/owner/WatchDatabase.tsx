'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, Trash2, Search, X, Database, Watch, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

interface WatchEntry {
  id: string
  brand: string
  model: string
  movement: string | null
  year_from: number | null
  year_to: number | null
  reference_number: string | null
  created_at: string
}

const MOVEMENTS = ['automatic', 'quartz', 'mechanical', 'smartwatch']

const emptyForm = {
  brand: '',
  model: '',
  movement: '',
  year_from: '',
  year_to: '',
  reference_number: '',
}

export default function WatchDatabase() {
  const supabase = createClient()
  const [watches, setWatches] = useState<WatchEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<WatchEntry | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchWatches()
  }, [])

  const fetchWatches = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('watch_database')
      .select('*')
      .order('brand', { ascending: true })

    if (error) {
      console.error('Error fetching watches:', error)
      toast.error('Failed to load watch database')
    } else {
      setWatches(data || [])
    }
    setLoading(false)
  }

  const filtered = watches.filter(w =>
    w.brand.toLowerCase().includes(search.toLowerCase()) ||
    w.model.toLowerCase().includes(search.toLowerCase()) ||
    (w.movement || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.reference_number || '').toLowerCase().includes(search.toLowerCase())
  )

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (w: WatchEntry) => {
    setEditing(w)
    setForm({
      brand: w.brand,
      model: w.model,
      movement: w.movement || '',
      year_from: w.year_from?.toString() || '',
      year_to: w.year_to?.toString() || '',
      reference_number: w.reference_number || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.brand.trim() || !form.model.trim()) {
      toast.error('Brand and Model are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        brand: form.brand.trim().toUpperCase(),
        model: form.model.trim(),
        movement: form.movement || null,
        year_from: form.year_from ? parseInt(form.year_from) : null,
        year_to: form.year_to ? parseInt(form.year_to) : null,
        reference_number: form.reference_number.trim() || null,
      }

      if (editing) {
        const { error } = await supabase
          .from('watch_database')
          .update(payload)
          .eq('id', editing.id)
        if (error) throw error
        toast.success('Watch updated!')
      } else {
        const { error } = await supabase
          .from('watch_database')
          .insert(payload)
        if (error) throw error
        toast.success('Watch added!')
      }
      setShowModal(false)
      fetchWatches()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this watch?')) return

    setDeletingId(id)
    try {
      const { error } = await supabase
        .from('watch_database')
        .delete()
        .eq('id', id)
      if (error) throw error
      toast.success('Deleted!')
      fetchWatches()
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const movementColor = (m: string | null) => {
    switch (m) {
      case 'automatic': return 'bg-[#3B82F6] text-white'
      case 'quartz': return 'bg-[#F59E0B] text-black'
      case 'mechanical': return 'bg-[#E94560] text-white'
      case 'smartwatch': return 'bg-[#1A1A2E] text-white'
      default: return 'bg-gray-100 text-gray-500'
    }
  }

  const movementLabel = (m: string | null) => {
    switch (m) {
      case 'automatic': return 'Automatic'
      case 'quartz': return 'Quartz'
      case 'mechanical': return 'Mechanical'
      case 'smartwatch': return 'Smartwatch'
      default: return '—'
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-[#E9ECEF] p-8 text-center shadow-sm">
        <div className="inline-block w-8 h-8 border-3 border-[#E94560] border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-gray-400 font-medium">Loading watch database...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ==================== HEADER ==================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#1A1A2E] rounded-lg flex items-center justify-center">
            <Database className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1A1A2E]">Watch Database</h2>
            <p className="text-xs text-gray-400">{watches.length} watches registered</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#E94560] text-white rounded-lg hover:bg-[#c73d54] transition-all text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Watch
        </button>
      </div>

      {/* ==================== SEARCH ==================== */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search brand, model, movement, reference..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
        />
      </div>

      {/* ==================== TABLE ==================== */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E9ECEF] p-12 text-center shadow-sm">
          <Watch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-400 font-medium">No watches found</p>
          <p className="text-sm text-gray-400 mt-1">
            {search ? 'Try adjusting your search' : 'Add your first watch to the database'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-[#FAFAFA]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Brand</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Movement</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Year</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Ref #</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9ECEF]">
                {filtered.map((w, i) => (
                  <motion.tr
                    key={w.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-[#FAFAFA] transition-all"
                  >
                    <td className="px-4 py-3 font-semibold text-[#1A1A2E] text-sm">{w.brand}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{w.model}</td>
                    <td className="px-4 py-3">
                      {w.movement ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${movementColor(w.movement)}`}>
                          {movementLabel(w.movement)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {w.year_from ? (
                        <span>{w.year_from}{w.year_to ? ` – ${w.year_to}` : ' – now'}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-400">
                      {w.reference_number || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(w)}
                          className="p-1.5 text-[#3B82F6] hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(w.id)}
                          disabled={deletingId === w.id}
                          className="p-1.5 text-[#E94560] hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === w.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== FOOTER ==================== */}
      {filtered.length > 0 && (
        <div className="text-center text-xs text-gray-400 pt-2">
          Showing {filtered.length} of {watches.length} watches
        </div>
      )}

      {/* ==================== MODAL ==================== */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl border border-[#E9ECEF] shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9ECEF] sticky top-0 bg-white">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#1A1A2E] rounded-lg flex items-center justify-center">
                    {editing ? <Pencil className="w-4 h-4 text-white" /> : <Plus className="w-4 h-4 text-white" />}
                  </div>
                  <h3 className="text-lg font-bold text-[#1A1A2E]">
                    {editing ? 'Edit Watch' : 'Add Watch'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Brand <span className="text-[#E94560]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={e => setForm(prev => ({ ...prev, brand: e.target.value }))}
                    placeholder="e.g. ROLEX"
                    className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Model <span className="text-[#E94560]">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={e => setForm(prev => ({ ...prev, model: e.target.value }))}
                    placeholder="e.g. Submariner"
                    className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Movement
                  </label>
                  <select
                    value={form.movement}
                    onChange={e => setForm(prev => ({ ...prev, movement: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                  >
                    <option value="">Select movement</option>
                    {MOVEMENTS.map(m => (
                      <option key={m} value={m}>
                        {m.charAt(0).toUpperCase() + m.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                      Year From
                    </label>
                    <input
                      type="number"
                      value={form.year_from}
                      onChange={e => setForm(prev => ({ ...prev, year_from: e.target.value }))}
                      placeholder="1963"
                      className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                      Year To
                    </label>
                    <input
                      type="number"
                      value={form.year_to}
                      onChange={e => setForm(prev => ({ ...prev, year_to: e.target.value }))}
                      placeholder="2020"
                      className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={form.reference_number}
                    onChange={e => setForm(prev => ({ ...prev, reference_number: e.target.value }))}
                    placeholder="e.g. 126610LN"
                    className="w-full px-3 py-2.5 bg-white border border-[#E9ECEF] rounded-lg focus:outline-none focus:border-[#1A1A2E] focus:ring-2 focus:ring-[#1A1A2E]/10 transition-all text-sm"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-[#E9ECEF] bg-[#FAFAFA]">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-white text-[#1A1A2E] font-medium rounded-lg border border-[#E9ECEF] hover:bg-gray-50 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#E94560] text-white font-medium rounded-lg hover:bg-[#c73d54] transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editing ? 'Update' : 'Add'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
