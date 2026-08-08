"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import { Package, Camera, Store, Warehouse, User, Watch, Send, X, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { useCentralUpload } from "@/hooks/useCentralUpload";

export default function KaspinUpdate() {
  const supabase = createClient();
  const { user } = useAuthStore();
  const [sessionKey] = useState(
    () => `kaspin_${user?.id || "anon"}_${Date.now()}`,
  );
  const upload = useCentralUpload(sessionKey);
  const [localProgress, setLocalProgress] = useState(0);
  const [showSummary, setShowSummary] = useState(false);
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
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
  };

  const handleSubmit = () => {
    if (services.length === 0) { 
      toast.error("Belum ada service yang diambil. Ambil service dari tab Queue terlebih dahulu."); 
      return; 
    }
    if (!selectedServiceId) { toast.error("Pilih service terlebih dahulu"); return; }
    if (!items.trim()) { toast.error("Isi barang sparepart"); return; }
    if (!peruntukkan.trim()) { toast.error("Isi peruntukkan"); return; }
    setShowSummary(true);
  };

  const handleConfirm = async () => {
    setShowSummary(false);
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
        setLocalProgress(10);
        const timer = setInterval(() => {
          setLocalProgress((prev) => {
            if (prev >= 90) return prev;
            return prev + 15;
          });
        }, 400);

        const results = await upload.legacyUpload([photo], "kaspin", caption);
        clearInterval(timer);
        setLocalProgress(100);
        if (!results?.length) throw new Error("Gagal upload");
      }

      toast.success("Update Kaspin terkirim ke Telegram!");
      setItems("");
      setPeruntukkan("");
      if (photoPreview) URL.revokeObjectURL(photoPreview);
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
        {submitting && (
          <div>
            <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400 mb-1">
              <span>Mengirim bukti...</span>
              <span>{localProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1 overflow-hidden">
              <div
                className="bg-gray-900 h-1 rounded-full transition-all duration-300"
                style={{ width: `${localProgress}%` }}
              />
            </div>
          </div>
        )}
        <button onClick={handleSubmit} disabled={submitting || services.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Send className="w-4 h-4" /> Kirim ke Telegram</>
          )}
        </button>
      </div>

      {/* Summary modal sebelum kirim */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md border border-gray-200 dark:border-white/10"
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Ringkasan Update Kaspin
              </h3>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-amber-700 dark:text-amber-300">
                  Periksa kembali rincian di bawah sebelum mengirim
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ambil</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {location === "gudang" ? "Gudang" : "Toko"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Customer</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedService?.customer_name || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Invoice</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {selectedService?.invoice_number || "-"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Merk</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {selectedService?.watch_brand || selectedService?.device_brand || "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Barang</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                    {items}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Peruntukkan</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                    {peruntukkan}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Teknisi</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {user?.full_name || "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex gap-3">
              <button onClick={() => setShowSummary(false)}
                className="flex-1 px-4 py-2.5 bg-white dark:bg-white/5 text-gray-700 dark:text-gray-300 font-medium rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all text-sm">
                UBAH
              </button>
              <button onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all text-sm flex items-center justify-center gap-2">
                <Send className="w-4 h-4" /> KIRIM
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
