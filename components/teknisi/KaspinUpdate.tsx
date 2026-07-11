"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import { Package, Camera, Store, Warehouse, User, Watch, Send, X } from "lucide-react";
import toast from "react-hot-toast";

export default function KaspinUpdate() {
  const supabase = createClient();
  const { user } = useAuthStore();
  const [services, setServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [location, setLocation] = useState<"gudang" | "toko">("gudang");
  const [items, setItems] = useState("");
  const [peruntukkan, setPeruntukkan] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    
    supabase
      .from("service_orders")
      .select("id, customer_name, watch_brand, device_brand, invoice_number, assigned_teknisi_id, status")
      .eq("assigned_teknisi_id", user.id)
      .in("status", ["assigned", "in_progress", "waiting_sparepart"])
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setServices(data);
      });
  }, [user]);

  const selectedService = services.find((s) => s.id === selectedServiceId);

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (services.length === 0) { 
      toast.error("Belum ada service yang diambil. Ambil service dari tab Queue terlebih dahulu."); 
      return; 
    }
    if (!selectedServiceId) { toast.error("Pilih service terlebih dahulu"); return; }
    if (!items.trim()) { toast.error("Isi barang sparepart"); return; }
    if (!peruntukkan.trim()) { toast.error("Isi peruntukkan"); return; }

    setSubmitting(true);
    try {
      const brand = selectedService?.watch_brand || selectedService?.device_brand || "-";
      const caption = `Ambil ${location === "gudang" ? "Gudang" : "Toko"}
Nama CS : ${selectedService?.customer_name || "-"}

Merk : ${brand}

Barang : ${items}

Peruntukkan : ${peruntukkan}

Teknisi : ${user?.full_name || "-"}`;

      if (photo) {
        const formData = new FormData();
        formData.append("files", photo);
        formData.append("type", "kaspin");
        formData.append("caption", caption);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Gagal upload");
      }

      toast.success("Update Kaspin terkirim ke Telegram!");
      setItems("");
      setPeruntukkan("");
      setPhoto(null);
      setPhotoPreview(null);
    } catch (e: any) {
      toast.error(e.message || "Gagal mengirim");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
          <Package className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-gray-100">Update Kaspin</h1>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm p-5 space-y-4">
        {/* Foto */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Foto Sparepart</label>
          {photoPreview ? (
            <div className="relative inline-block">
              <img src={photoPreview} alt="Preview" className="w-32 h-32 object-cover rounded-xl border border-slate-200" />
              <button onClick={() => { setPhoto(null); setPhotoPreview(null); }}
                className="absolute -top-2 -right-2 p-0.5 bg-red-500 text-white rounded-full">
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <label className="flex items-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-slate-400 transition-colors">
              <Camera className="w-5 h-5 text-slate-400" />
              <span className="text-sm text-slate-500">Klik untuk upload foto</span>
              <input type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
          )}
        </div>

        {/* Ambil */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Ambil</label>
          <div className="flex gap-2">
            <button onClick={() => setLocation("gudang")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${location === "gudang" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
              <Warehouse className="w-4 h-4" /> Gudang
            </button>
            <button onClick={() => setLocation("toko")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all ${location === "toko" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
              <Store className="w-4 h-4" /> Toko
            </button>
          </div>
        </div>

        {/* Pilih Service */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Pilih Service</label>
          {services.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <span>Belum ada service yang diambil. Ambil service terlebih dahulu dari tab Queue.</span>
            </div>
          ) : (
            <select value={selectedServiceId} onChange={(e) => setSelectedServiceId(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-[#1c1c1c] text-slate-900 dark:text-gray-100">
              <option value="">-- Pilih Service --</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.invoice_number} - {s.customer_name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Nama CS (auto) */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Nama CS</label>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-gray-300">
            <User className="w-4 h-4 text-slate-400" />
            {selectedService?.customer_name || "-"}
          </div>
        </div>

        {/* Merk (auto) */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Merk</label>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-gray-300">
            <Watch className="w-4 h-4 text-slate-400" />
            {selectedService?.watch_brand || selectedService?.device_brand || "-"}
          </div>
        </div>

        {/* Barang */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Barang</label>
          <textarea value={items} onChange={(e) => setItems(e.target.value)}
            placeholder="Sparepart yang diambil..."
            rows={3}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-[#1c1c1c] text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
        </div>

        {/* Peruntukkan */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Peruntukkan</label>
          <textarea value={peruntukkan} onChange={(e) => setPeruntukkan(e.target.value)}
            placeholder="Untuk service apa sparepart ini digunakan..."
            rows={2}
            className="w-full px-3 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-[#1c1c1c] text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none" />
        </div>

        {/* Teknisi (auto) */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Teknisi</label>
          <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-700 dark:text-gray-300">
            <User className="w-4 h-4 text-slate-400" />
            {user?.full_name || "-"}
          </div>
        </div>

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting || services.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Send className="w-4 h-4" /> Kirim ke Telegram</>
          )}
        </button>
      </div>
    </motion.div>
  );
}
