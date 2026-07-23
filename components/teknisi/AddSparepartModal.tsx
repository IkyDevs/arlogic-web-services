"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import { X, Package, Plus, Loader, CheckCircle, Trash2, Search } from "lucide-react";
import toast from "react-hot-toast";

interface SparepartEntry {
  id: string;
  name: string;
  quantity: number;
  notes: string;
  price: number;
}

interface AddSparepartModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: any;
  onSuccess: () => void;
}

export default function AddSparepartModal({
  isOpen,
  onClose,
  service,
  onSuccess,
}: AddSparepartModalProps) {
  const [entries, setEntries] = useState<SparepartEntry[]>([
    { id: Date.now().toString(), name: "", quantity: 1, notes: "", price: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();
  const { user } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      setEntries([{ id: Date.now().toString(), name: "", quantity: 1, notes: "", price: 0 }]);
      setSuccess(false);
    }
  }, [isOpen]);

  const addRow = () => {
    setEntries([...entries, { id: Date.now().toString(), name: "", quantity: 1, notes: "", price: 0 }]);
  };

  const updateEntry = (id: string, field: keyof SparepartEntry, value: any) => {
    setEntries(entries.map((e) => (e.id === id ? { ...e, [field]: value } : e)));
  };

  const removeEntry = (id: string) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((e) => e.id !== id));
  };

  const handleSave = async () => {
    const valid = entries.filter((e) => e.name.trim() && e.price > 0);
    if (valid.length === 0) {
      toast.error("Isi minimal 1 sparepart dengan harga");
      return;
    }

    setLoading(true);
    try {
      const items = valid.map((e) => ({
        service_order_id: service.id,
        name: e.name.trim(),
        quantity: e.quantity,
        price: e.price,
        item_type: "sparepart" as const,
      }));

      const { error: insertError } = await supabase.from("service_items").insert(items).select();
      if (insertError) throw insertError;

      // Auto-create timeline entry
      const sparepartDesc = valid
        .map((e) => `\u2022 ${e.name.trim()} (${e.quantity}x)${e.notes ? ` - ${e.notes}` : ""}`)
        .join("\n");
      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: user?.id,
        status: service.status || "in_progress",
        message: `Teknisi menambahkan sparepart:\n${sparepartDesc}`,
        details: {
          action: "add_sparepart",
          spareparts: valid.map((e) => ({
            name: e.name.trim(),
            qty: e.quantity,
            price: e.price,
            notes: e.notes,
          })),
          total_sparepart_cost: valid.reduce((sum, e) => sum + e.price * e.quantity, 0),
        },
      });

      setSuccess(true);
      toast.success(`${valid.length} sparepart berhasil ditambahkan`);
      setTimeout(() => { onSuccess(); onClose(); }, 800);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--color-card)] rounded-[var(--radius-card-md)] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-[var(--color-card)] z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-text)]">Tambah Sparepart</h2>
              <p className="text-xs text-[var(--color-text-secondary)]">{service?.invoice_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-colors">
            <X className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {success ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-[var(--color-text)]">Sparepart Berhasil Ditambahkan</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Masukkan sparepart yang digunakan. Timeline akan dibuat otomatis.
              </p>

              <div className="space-y-2">
                {entries.map((entry, i) => (
                  <div key={entry.id} className="p-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase">Item #{i + 1}</span>
                      {entries.length > 1 && (
                        <button onClick={() => removeEntry(entry.id)} className="p-0.5 text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      <input type="text" value={entry.name} onChange={(e) => updateEntry(entry.id, "name", e.target.value)}
                        placeholder="Nama sparepart *" className="w-full px-3 py-1.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/10" />
                      <div className="grid grid-cols-3 gap-2">
                        <input type="number" value={entry.quantity || ""} onChange={(e) => updateEntry(entry.id, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                          placeholder="Qty" className="w-full px-3 py-1.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none text-center" />
                        <input type="number" value={entry.price || ""} onChange={(e) => updateEntry(entry.id, "price", Math.max(0, parseInt(e.target.value) || 0))}
                          placeholder="Harga" className="col-span-2 w-full px-3 py-1.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none text-right [appearance:textfield]" />
                      </div>
                      <input type="text" value={entry.notes} onChange={(e) => updateEntry(entry.id, "notes", e.target.value)}
                        placeholder="Catatan (opsional)" className="w-full px-3 py-1.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none" />
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={addRow}
                className="w-full py-2 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl border border-dashed border-purple-200 transition-all flex items-center justify-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Tambah Baris
              </button>
            </>
          )}
        </div>

        {!success && (
          <div className="sticky bottom-0 bg-[var(--color-card)] border-t border-[var(--color-border)] px-6 py-4 flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-surface)] transition-all">Batal</button>
            <button onClick={handleSave} disabled={loading}
              className="flex-1 bg-purple-600 text-white font-medium px-4 py-2.5 rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
              {loading ? <><Loader className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><Package className="w-4 h-4" /> Simpan Sparepart</>}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
