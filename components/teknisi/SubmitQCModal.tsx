"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import {
  X, CheckCircle, Package, Camera, MessageSquare, Loader,
  Check, Trash2, Clock, User, Watch,
} from "lucide-react";
import toast from "react-hot-toast";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { uploadConfig } from "@/lib/uploadConfig";

const MAX_FILES = uploadConfig.IMAGE_MAX_FILES;
const MAX_FILE_SIZE = uploadConfig.IMAGE_MAX_SIZE_BYTES;
const MAX_TOTAL_SIZE = uploadConfig.IMAGE_MAX_SIZE_MB * uploadConfig.IMAGE_MAX_FILES * 1024 * 1024;
const ALLOWED_TYPES = uploadConfig.IMAGE_ALLOWED_TYPES;

interface SubmitQCModalProps {
  service: any;
  teknisiId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function SubmitQCModal({ service, teknisiId, onClose, onSuccess }: SubmitQCModalProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [initialItems, setInitialItems] = useState<any[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [editingPrice, setEditingPrice] = useState<{ [key: number]: number }>({});
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();
  const { user } = useAuthStore();
  const { addAndUpload } = usePhotoUpload();

  useEffect(() => {
    fetchItems();
  }, [service.id]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("service_items")
      .select("*")
      .eq("service_order_id", service.id);
    if (data) {
      setItems(data);
      setInitialItems(JSON.parse(JSON.stringify(data)));
      setTotalCost(data.reduce((sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 1), 0));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const valid: File[] = [];
    const previews: string[] = [];
    let currentSize = photos.reduce((s, f) => s + f.size, 0);

    for (const file of files) {
      if (photos.length + valid.length >= MAX_FILES) { toast.error(`Maksimal ${MAX_FILES} foto.`); break; }
      if (file.size > MAX_FILE_SIZE) { toast.error(`"${file.name}" terlalu besar (max 20MB).`); continue; }
      if (!ALLOWED_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|heic|heif|avif)$/i)) {
        toast.error(`"${file.name}" bukan gambar.`); continue;
      }
      if (currentSize + file.size > MAX_TOTAL_SIZE) { toast.error(`Total ukuran terlalu besar (max 4MB).`); continue; }
      valid.push(file);
      previews.push(URL.createObjectURL(file));
      currentSize += file.size;
    }
    if (valid.length > 0) {
      setPhotos((prev) => [...prev, ...valid]);
      setPhotoPreviews((prev) => [...prev, ...previews]);
    }
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const startEditPrice = (index: number, price: number) => setEditingPrice({ ...editingPrice, [index]: price });
  const savePrice = (index: number) => {
    const newPrice = editingPrice[index];
    if (newPrice === undefined || newPrice < 0) return;
    const updated = items.map((item, i) => i === index ? { ...item, price: newPrice } : item);
    setItems(updated);
    setTotalCost(updated.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0));
    const { [index]: _, ...rest } = editingPrice;
    setEditingPrice(rest);
  };
  const deleteItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    setTotalCost(updated.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0));
  };

  const handleSubmit = async () => {
    if (!service || !user) return;
    if (photos.length === 0) { toast.error("Setidaknya harus ada 1 foto."); return; }
    setSubmitting(true);
    try {
      const now = new Date();
      const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      const fmt = (d: string | null | undefined) => {
        if (!d) return "-";
        const dt = new Date(d);
        return `${dayNames[dt.getDay()]}, ${dt.getDate()} ${monthNames[dt.getMonth()]} (${String(dt.getMonth()+1).padStart(2,"0")}), ${dt.getFullYear()}`;
      };

      const startDate = fmt(service.start_date);
      const doneDate = fmt(now.toISOString());

      const barang = items.filter((i: any) => i.item_type === "sparepart");
      const jasa = items.filter((i: any) => i.item_type === "jasa");
      const barangList = barang.map((i: any) => `- ${i.name} (${i.quantity}x) @Rp${(i.price || 0).toLocaleString("id-ID")}`).join("\n");
      const jasaList = jasa.map((i: any) => `- ${i.name} (${i.quantity}x) @Rp${(i.price || 0).toLocaleString("id-ID")}`).join("\n");

      const sections = [
        `${service.status === "revision_required" ? "UPDATE QC AFTER REJECT QC" : "UPDATE QC"}`,
        `Status : Menunggu QC`,
        `Nama : ${service.customer_name || "-"}`,
        `No. hp : ${service.customer_phone || "-"}`,
        `Brand : ${service.watch_brand || "-"}`,
        service.watch_model ? `Tipe : ${service.watch_model}` : null,
        service.estimated_cost > 0 ? `Estimasi : Rp${service.estimated_cost.toLocaleString("id-ID")}` : null,
        `Teknisi : ${user?.full_name || "-"}`,
        `Start : ${startDate}`,
        `Done : ${doneDate}`,
        `Rincian Item`,
        barang.length > 0 ? `Barang:\n${barangList}` : null,
        jasa.length > 0 ? `Jasa:\n${jasaList}` : null,
        `Total : Rp${totalCost.toLocaleString("id-ID")}`,
        notes.trim() ? `Keterangan Teknisi :\n${notes.trim()}` : null,
      ].filter(Boolean).join("\n\n");

      const results = await addAndUpload(photos, { type: 'qc_update', caption: sections });

      const uploadedUrls: string[] = [];
      if (results.length > 0) {
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          uploadedUrls.push(r.url);
          await supabase.from("service_documentation").insert({
            service_order_id: service.id,
            photo_url: r.url,
            stage: "qc",
            uploaded_by: user.id,
            telegram_chat_id: r.chat_id,
            telegram_message_id: r.message_id,
          });
        }
      }

      const { error } = await supabase
        .from("service_orders")
        .update({
          status: "qc_pending",
          done_date: now.toISOString(),
          work_duration: service.start_date
            ? Math.ceil((now.getTime() - new Date(service.start_date).getTime()) / (1000 * 60 * 60 * 24))
            : null,
          qc_submit_notes: notes || null,
        })
        .eq("id", service.id);
      if (error) throw error;

      const deletedItems: string[] = [];
      for (const orig of initialItems) {
        const stillExists = items.some((item: any) => item.id === orig.id && item.name === orig.name);
        if (!stillExists) deletedItems.push(`${orig.name}`);
      }
      let changeMsg = "";
      if (deletedItems.length > 0) changeMsg += `menghapus ${deletedItems.join(", ")}. `;
      if (changeMsg) changeMsg = changeMsg.trim() + " ";

      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: teknisiId,
        status: "qc_pending",
        message: `${changeMsg}Service telah selesai dan dikirim ke QC oleh teknisi${uploadedUrls.length > 0 ? ` (${uploadedUrls.length} foto)` : ""}`,
        details: { action: "submit_to_qc", photos_count: uploadedUrls.length, total_cost: totalCost },
      });

      toast.success("Service berhasil dikirim ke QC!");
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Submit QC</h2>
              <p className="text-xs text-gray-500">{service.invoice_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Invoice</span>
              <span className="text-xs font-mono font-medium text-gray-900 dark:text-gray-100">{service.invoice_number}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Customer</span>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{service.customer_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Device</span>
              <span className="text-sm text-gray-900 dark:text-gray-100">{service.watch_brand || service.device_brand}</span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" /> Daftar Item
            </h4>
            {items.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">Belum ada item</p>
            ) : (
              <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                <div className="divide-y divide-gray-200 dark:divide-white/10">
                  {items.map((item, i) => {
                    const isEditing = editingPrice[i] !== undefined;
                    return (
                      <div key={item.id || i} className="flex items-center justify-between px-4 py-2 gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${item.item_type === "jasa" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                            {item.item_type === "jasa" ? "JASA" : "SPR"}
                          </span>
                          <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{item.name}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{item.quantity}x</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <input type="number" value={editingPrice[i]} onChange={(e) => setEditingPrice({ ...editingPrice, [i]: parseInt(e.target.value) || 0 })}
                                className="w-20 px-1.5 py-0.5 text-xs border border-gray-200 rounded-lg text-right" onKeyDown={(e) => e.key === "Enter" && savePrice(i)} />
                              <button onClick={() => savePrice(i)} className="p-0.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEditPrice(i, item.price || 0)} className="text-xs font-semibold text-gray-900 dark:text-gray-100 hover:text-indigo-600">
                                Rp {(item.price * item.quantity).toLocaleString()}
                              </button>
                              <button onClick={() => deleteItem(i)} className="p-0.5 text-red-400 hover:text-red-600 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-gray-50 dark:bg-white/5 px-4 py-3 border-t border-gray-200 dark:border-white/10 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Total Biaya</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Rp {totalCost.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <Camera className="w-4 h-4 text-gray-400" /> Foto Hasil Service
            </h4>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {photoPreviews.map((preview, i) => (
                <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center hover:border-gray-900 transition-colors bg-gray-50 dark:bg-white/5">
                <Camera className="w-6 h-6 text-gray-300" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gray-400" /> Catatan Teknisi
            </h4>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
              placeholder="Catatan untuk QC..." />
          </div>

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
            {submitting ? <><Loader className="w-4 h-4 animate-spin" /> MENGIRIM...</> : <><CheckCircle className="w-4 h-4" /> KIRIM KE QC</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
