"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useUpload } from "@/hooks/useUpload";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { X, Camera, Loader2, Send, User, Wallet, Hash, DollarSign, Phone } from "lucide-react";

interface CashdrawFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

export default function CashdrawForm({ onSuccess, onClose }: CashdrawFormProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { uploadFile, uploading, progress } = useUpload();

  const [formData, setFormData] = useState({
    staff_name: user?.full_name || "",
    staff_phone: "",
    nominal: "",
    metode_pembayaran: "qris" as string,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [users, setUsers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showOtherStaff, setShowOtherStaff] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>(user?.id || "");

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").in("role", ["admin", "teknisi", "supervisor"]).order("full_name");
    if (data) setUsers(data);
  };

  const handleStaffSelect = (uid: string) => {
    setSelectedUserId(uid);
    const u = users.find(x => x.id === uid);
    setFormData(p => ({ ...p, staff_name: u?.full_name || "" }));
    setShowOtherStaff(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nominal = parseInt(formData.nominal.replace(/\D/g, ""));
    if (!nominal || nominal <= 0) { toast.error("Nominal harus diisi"); return; }
    if (!formData.staff_name) { toast.error("Nama staff harus diisi"); return; }
    if (!formData.metode_pembayaran) { toast.error("Pilih metode pembayaran"); return; }
    if (!photoFile) { toast.error("Upload bukti pembayaran"); return; }
    if (!selectedUserId) { toast.error("Staff tidak valid"); return; }

    setSubmitting(true);
    try {
      // Upload foto
      const uploadResult = await uploadFile(photoFile, { type: "layanan", caption: `Cashdraw ${formData.staff_name}` });
      const photoUrl = uploadResult?.url || "";

      // Dapatkan no hp staff
      const { data: staffProfile } = await supabase.from("profiles").select("phone").eq("id", selectedUserId).single();

      // Entry A: cashdraw (QRIS/TF bertambah)
      const { data: entryA, error: errA } = await supabase.from("layanan").insert({
        customer_name: formData.staff_name,
        customer_whatsapp: staffProfile?.phone || formData.staff_phone,
        jenis_layanan: "cashdraw",
        metode_pembayaran: formData.metode_pembayaran,
        nominal: nominal,
        handled_by: selectedUserId,
        handled_by_name: formData.staff_name,
        photo_urls: photoUrl ? [photoUrl] : [],
        notes: `Cashdraw: ${formData.staff_name} tarik tunai Rp ${nominal.toLocaleString("id-ID")} via ${formData.metode_pembayaran}`,
      }).select("id").single();

      if (errA) { toast.error("Gagal simpan cashdraw: " + errA.message); return; }

      // Entry B: pengeluaran (Cash berkurang)
      const { error: errB } = await supabase.from("layanan").insert({
        customer_name: formData.staff_name,
        customer_whatsapp: staffProfile?.phone || formData.staff_phone,
        jenis_layanan: "pengeluaran",
        metode_pembayaran: "cash",
        nominal: nominal,
        handled_by: selectedUserId,
        handled_by_name: formData.staff_name,
        photo_urls: photoUrl ? [photoUrl] : [],
        notes: `Cashdraw: ${formData.staff_name} tarik tunai Rp ${nominal.toLocaleString("id-ID")} (kompensasi cash)`,
      });

      if (errB) { toast.error("Gagal simpan pengeluaran cash: " + errB.message); return; }

      // Kirim ke Telegram (buku kas)
      const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
      const chatId = process.env.NEXT_PUBLIC_TELEGRAM_BOOK_CASH;
      if (botToken && chatId) {
        const msg = `🧾 *CASHDRAW*\\n\\n👤 Staff: ${formData.staff_name}\\n💰 Nominal: Rp ${nominal.toLocaleString("id-ID")}\\n💳 Metode: ${formData.metode_pembayaran}\\n📅 ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: "Markdown" }),
          });
          if (photoUrl) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: `Bukti cashdraw ${formData.staff_name}` }),
            });
          }
        } catch {}
      }

      toast.success("Cashdraw berhasil");
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      toast.error("Gagal: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl border border-gray-200 shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Cashdraw</h2>
            <p className="text-xs text-gray-500">Tarik tunai dari saldo digital</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* Staff */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Staff</label>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <User className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <select value={selectedUserId} onChange={(e) => handleStaffSelect(e.target.value)}
              className="flex-1 bg-transparent text-sm font-medium text-gray-900 focus:outline-none">
              {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>
        </div>

        {/* Nominal */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Total Tarik Tunai</label>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <DollarSign className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input type="text" value={formData.nominal} onChange={(e) => setFormData(p => ({ ...p, nominal: e.target.value.replace(/\D/g, "") }))}
              placeholder="0" className="flex-1 bg-transparent text-sm font-bold text-gray-900 focus:outline-none" />
          </div>
          {formData.nominal && <p className="text-xs text-gray-400 mt-1">Rp {parseInt(formData.nominal || "0").toLocaleString("id-ID")}</p>}
        </div>

        {/* Metode Pembayaran */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Metode Pembayaran</label>
          <div className="grid grid-cols-2 gap-2">
            {[{ value: "qris", label: "QRIS" }, { value: "tf_bca", label: "TF BCA" }, { value: "tf_mandiri", label: "TF Mandiri" }].map(m => (
              <button key={m.value} type="button" onClick={() => setFormData(p => ({ ...p, metode_pembayaran: m.value }))}
                className={`p-3 rounded-xl border text-sm font-medium transition-all ${formData.metode_pembayaran === m.value ? "bg-gray-900 text-white border-gray-900" : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Upload Foto */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Upload Bukti Pembayaran</label>
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition-all"
            onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setPhotoFile(f); setPhotoPreview(URL.createObjectURL(f)); }
              }} />
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="preview" className="max-h-40 mx-auto rounded-lg" />
                <button type="button" onClick={(e) => { e.stopPropagation(); setPhotoFile(null); setPhotoPreview(""); }}
                  className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <div>
                <Camera className="w-8 h-8 mx-auto mb-1 text-gray-300" />
                <p className="text-xs text-gray-400">Klik untuk upload foto</p>
              </div>
            )}
          </div>
        </div>

        {/* Submit */}
        <button type="submit" disabled={submitting || uploading}
          className="w-full py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {submitting || uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {submitting ? "Memproses..." : uploading ? `Upload ${Math.round(progress)}%` : "Ajukan Cashdraw"}
        </button>
      </form>
    </motion.div>
  );
}