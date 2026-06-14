'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Search, X, Database, Watch } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface WatchEntry {
  id: string;
  brand: string;
  model: string;
  movement: string | null;
  year_from: number | null;
  year_to: number | null;
  reference_number: string | null;
  created_at: string;
}

const MOVEMENTS = ['automatic', 'quartz', 'mechanical', 'smartwatch'];

const emptyForm = {
  brand: '',
  model: '',
  movement: '',
  year_from: '',
  year_to: '',
  reference_number: '',
};

export default function WatchDatabase() {
  const supabase = createClient();
  const [watches, setWatches] = useState<WatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WatchEntry | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchWatches();
  }, []);

  const fetchWatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('watch_database')
      .select('*')
      .order('brand', { ascending: true });

    if (error) toast.error('Failed to load watch database');
    else setWatches(data || []);
    setLoading(false);
  };

  const filtered = watches.filter(w =>
    w.brand.toLowerCase().includes(search.toLowerCase()) ||
    w.model.toLowerCase().includes(search.toLowerCase()) ||
    (w.movement || '').toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (w: WatchEntry) => {
    setEditing(w);
    setForm({
      brand: w.brand,
      model: w.model,
      movement: w.movement || '',
      year_from: w.year_from?.toString() || '',
      year_to: w.year_to?.toString() || '',
      reference_number: w.reference_number || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.brand.trim() || !form.model.trim()) {
      toast.error('Brand and Model are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        brand: form.brand.trim().toUpperCase(),
        model: form.model.trim(),
        movement: form.movement || null,
        year_from: form.year_from ? parseInt(form.year_from) : null,
        year_to: form.year_to ? parseInt(form.year_to) : null,
        reference_number: form.reference_number.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from('watch_database').update(payload).eq('id', editing.id);
        if (error) throw error;
        toast.success('Watch updated!');
      } else {
        const { error } = await supabase.from('watch_database').insert(payload);
        if (error) throw error;
        toast.success('Watch added!');
      }
      setShowModal(false);
      fetchWatches();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('watch_database').delete().eq('id', id);
      if (error) throw error;
      toast.success('Deleted!');
      fetchWatches();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const movementColor = (m: string | null) => {
    switch (m) {
      case 'automatic': return 'bg-[#3B82F6] text-white';
      case 'quartz': return 'bg-[#FFDE00] text-black';
      case 'mechanical': return 'bg-[#FF6B9D] text-white';
      case 'smartwatch': return 'bg-black text-white';
      default: return 'bg-gray-200 text-black';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FFDE00] border-2 border-black flex items-center justify-center shadow-[4px_4px_0_0_#000]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-black font-mono">WATCH DATABASE</h2>
            <p className="text-xs font-mono">{watches.length} watches registered</p>
          </div>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#FF6B9D] text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-mono font-bold"
        >
          <Plus size={16} />
          ADD WATCH
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
        <input
          type="text"
          placeholder="Search brand, model, movement..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-3 border-2 border-black shadow-[4px_4px_0_0_#000] font-mono text-sm focus:outline-none focus:shadow-[2px_2px_0_0_#000] focus:translate-x-[2px] focus:translate-y-[2px] transition-all"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="border-2 border-black p-8 text-center font-mono">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="border-2 border-black p-12 text-center shadow-[6px_6px_0_0_#000]">
          <Watch className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-mono font-bold">No watches found</p>
          <p className="text-sm font-mono text-gray-500 mt-1">Add your first watch to the database</p>
        </div>
      ) : (
        <div className="border-2 border-black shadow-[6px_6px_0_0_#000] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-black text-white">
                  <th className="px-4 py-3 text-left font-mono font-black text-sm">BRAND</th>
                  <th className="px-4 py-3 text-left font-mono font-black text-sm">MODEL</th>
                  <th className="px-4 py-3 text-left font-mono font-black text-sm">MOVEMENT</th>
                  <th className="px-4 py-3 text-left font-mono font-black text-sm">YEAR</th>
                  <th className="px-4 py-3 text-left font-mono font-black text-sm">REF#</th>
                  <th className="px-4 py-3 text-center font-mono font-black text-sm">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((w, i) => (
                  <motion.tr
                    key={w.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-t-2 border-black hover:bg-[#FFDE00]/20 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-black text-sm">{w.brand}</td>
                    <td className="px-4 py-3 font-mono text-sm">{w.model}</td>
                    <td className="px-4 py-3">
                      {w.movement && (
                        <span className={`px-2 py-0.5 text-xs font-mono font-bold border border-black ${movementColor(w.movement)}`}>
                          {w.movement.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      {w.year_from}{w.year_to ? ` – ${w.year_to}` : w.year_from ? ' – now' : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-500">{w.reference_number || '–'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(w)}
                          className="p-1.5 border-2 border-black bg-[#FFDE00] hover:shadow-[2px_2px_0_0_#000] transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(w.id)}
                          disabled={deletingId === w.id}
                          className="p-1.5 border-2 border-black bg-[#FF6B9D] text-white hover:shadow-[2px_2px_0_0_#000] transition-all disabled:opacity-50"
                        >
                          <Trash2 size={14} />
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

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-2 border-black shadow-[12px_12px_0_0_#000] w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-xl font-black font-mono">
                  {editing ? 'EDIT WATCH' : 'ADD WATCH'}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-1 border-2 border-black hover:bg-gray-100">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'brand', label: 'Brand *', placeholder: 'e.g. ROLEX' },
                  { key: 'model', label: 'Model *', placeholder: 'e.g. Submariner' },
                  { key: 'reference_number', label: 'Reference Number', placeholder: 'e.g. 126610LN' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="block text-xs font-black font-mono mb-1 uppercase">{field.label}</label>
                    <input
                      type="text"
                      value={form[field.key as keyof typeof form]}
                      onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border-2 border-black font-mono text-sm focus:outline-none shadow-[3px_3px_0_0_#000] focus:shadow-none focus:translate-x-[3px] focus:translate-y-[3px] transition-all"
                    />
                  </div>
                ))}

                <div>
                  <label className="block text-xs font-black font-mono mb-1">MOVEMENT</label>
                  <select
                    value={form.movement}
                    onChange={e => setForm(prev => ({ ...prev, movement: e.target.value }))}
                    className="w-full px-3 py-2 border-2 border-black font-mono text-sm focus:outline-none bg-white shadow-[3px_3px_0_0_#000]"
                  >
                    <option value="">Select movement</option>
                    {MOVEMENTS.map(m => (
                      <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'year_from', label: 'Year From' },
                    { key: 'year_to', label: 'Year To' },
                  ].map(field => (
                    <div key={field.key}>
                      <label className="block text-xs font-black font-mono mb-1">{field.label.toUpperCase()}</label>
                      <input
                        type="number"
                        value={form[field.key as keyof typeof form]}
                        onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                        placeholder="e.g. 1963"
                        className="w-full px-3 py-2 border-2 border-black font-mono text-sm focus:outline-none shadow-[3px_3px_0_0_#000]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border-2 border-black font-mono font-bold text-sm hover:bg-gray-100 transition-colors"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-[#FF6B9D] text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] font-mono font-bold text-sm transition-all disabled:opacity-50"
                >
                  {saving ? 'SAVING...' : editing ? 'UPDATE' : 'ADD'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
