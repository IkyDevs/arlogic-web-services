"use client";

import { useState, useEffect, useRef, memo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useUpload } from "@/hooks/useUpload";
import { JenisLayanan, MetodePembayaran, LeadSource } from "@/types";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Phone,
  DollarSign,
  FileText,
  Send,
  X,
  Camera,
  Loader2,
  Trash2,
  AlertCircle,
  Calendar,
  Hash,
  Wrench,
  Plus,
  ChevronDown,
} from "lucide-react";
import CustomerAutocomplete from "@/components/admin/CustomerAutocomplete";

interface LayananFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
  initialData?: any;
}

// Semua jenis layanan yang valid di DB (tidak null)
const jenisLayananOptions = [
  { value: "service_langsung", label: "Service Langsung" },
  { value: "dp_service", label: "DP Service" },
  { value: "ambil_jam_service", label: "Ambil Jam Service" },
  { value: "order_online", label: "Order Online" },
  { value: "beli_jam", label: "Beli Jam" },
  { value: "pengeluaran", label: "Pengeluaran" },

];

const metodePembayaranOptions = [
  { value: "cash", label: "Cash" },
  { value: "qris", label: "QRIS" },
  { value: "tf_bca", label: "Transfer BCA" },
  { value: "tf_mandiri", label: "Transfer Mandiri" },
  { value: "edc_bca", label: "EDC BCA" },
  { value: "edc_mandiri", label: "EDC Mandiri" },
  { value: "bri", label: "BRI" },
  { value: "kudus", label: "Kudus" },
];

const leadSourceOptions = [
  { value: "instagram", label: "Instagram" },
  { value: "wom", label: "WOM (Word of Mouth)" },
  { value: "dekat_lewat", label: "Dekat / Lewat" },
  { value: "google", label: "Google" },
  { value: "facebook", label: "Facebook" },
  { value: "old", label: "Old Customer" },
  { value: "tiktok", label: "TikTok" },
  { value: "dash", label: "-" },
  { value: "tulis_sendiri", label: "Tulis Sendiri" },
];

export default memo(function LayananForm({
  onSuccess,
  onClose,
  initialData,
}: LayananFormProps) {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { uploadFile, uploadFiles, uploading, progress } = useUpload();

  // Form state
  const [formData, setFormData] = useState({
    customer_name: initialData?.customer_name || "",
    customer_whatsapp: initialData?.customer_whatsapp || "",
    jenis_layanan: (initialData?.jenis_layanan ||
      "service_langsung") as JenisLayanan,
    handled_by: initialData?.handled_by || user?.id || "",
    metode_pembayaran: (initialData?.metode_pembayaran ||
      "cash") as MetodePembayaran,
    lead_source: (initialData?.lead_source || "instagram") as LeadSource,
    lead_source_custom: initialData?.lead_source_custom || "",
    detail_sku: initialData?.detail_sku || "",
    nominal: initialData?.nominal?.toString() || "",
    notes: initialData?.notes || "",
  });

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOtherHandler, setShowOtherHandler] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Multiple photos
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showCustomLeadSource = formData.lead_source === "tulis_sendiri";

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchUsers();
    }, 0);

    return () => clearTimeout(debounceTimer);
  }, []);

  // Set default handled_by ke current user setelah mount
  useEffect(() => {
    if (user?.id && !formData.handled_by) {
      setFormData((p) => ({ ...p, handled_by: user.id }));
    }
  }, [user?.id]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["admin", "teknisi", "supervisor"])
      .order("full_name");
    if (data) setUsers(data);
  };

  // ── Photo helpers ─────────────────────────────────────────────────────────
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const valid = files.filter((f) => {
      if (!f.type.startsWith("image/")) {
        toast.error(`${f.name} bukan gambar`);
        return false;
      }
      if (f.size > 15 * 1024 * 1024) {
        toast.error(`${f.name} terlalu besar (max 15MB)`);
        return false;
      }
      return true;
    });

    setPhotoFiles((prev) => [...prev, ...valid]);
    valid.forEach((f) =>
      setPhotoPreviews((prev) => [...prev, URL.createObjectURL(f)]),
    );

    // reset input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(photoPreviews[idx]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name.trim()) {
      toast.error("Nama customer wajib diisi");
      return;
    }
    if (!formData.customer_whatsapp.trim()) {
      toast.error("Nomor WhatsApp wajib diisi");
      return;
    }
    if (!formData.handled_by) {
      toast.error("Pilih yang melayani");
      return;
    }
    if (!formData.nominal) {
      toast.error("Nominal wajib diisi");
      return;
    }
    if (!formData.jenis_layanan) {
      toast.error("Jenis layanan wajib dipilih");
      return;
    }
    if (photoFiles.length === 0 && !initialData?.photo_url) {
      toast.error("Wajib upload minimal 1 foto");
      return;
    }

    // Show confirmation modal instead of submitting directly
    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmation(false);
    setLoading(true);
    try {
      const selectedUser = users.find((u) => u.id === formData.handled_by);

      // Ensure jenis_layanan is always set (never null/undefined)
      const jenisLayananValue = formData.jenis_layanan || "service_langsung";

      // Prepare transaction description early for photo captions
      const jenisLayananLabel =
        jenisLayananOptions.find((opt) => opt.value === jenisLayananValue)
          ?.label || jenisLayananValue;
      const metodeLabel =
        metodePembayaranOptions.find(
          (opt) => opt.value === formData.metode_pembayaran,
        )?.label || formData.metode_pembayaran;

      const now = new Date();
      const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const fmtDateTime = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2, "0")}.${now.getMinutes().toString().padStart(2, "0")}.${now.getSeconds().toString().padStart(2, "0")}`;

      const typeIcon = jenisLayananValue === "dp_service" ? "💳" : "🔧";
      const transactionDescription = `📊 TRANSAKSI

━━━━━━━━━━━━━━━━━━━━━━━━
${typeIcon} tipe : ${jenisLayananLabel}
📱 Customer: ${formData.customer_name}
📞 WA: ${formData.customer_whatsapp}
💰 Nominal: Rp ${parseInt(formData.nominal).toLocaleString("id-ID")}
💳 Metode: ${metodeLabel}
📋 Invoice: ${formData.detail_sku || "-"}
📝 Keterangan: ${formData.notes || "-"}
👤 Operator: ${user?.full_name}
⏰ ${fmtDateTime}
━━━━━━━━━━━━━━━━━━━━━━━━`;

      let photoUrls: string[] = initialData?.photo_url
        ? [initialData.photo_url]
        : [];

      let telegramSent = false;
      if (photoFiles.length > 0) {
        const urls = await uploadFiles(photoFiles, {
          type: "layanan",
          caption: transactionDescription,
        });
        if (urls && urls.length > 0) {
          photoUrls = urls;
          telegramSent = true;
        } else {
          toast.error("Gagal upload foto");
          return;
        }
      }

      if (!telegramSent) {
        // Fallback: send text-only notification
        try {
          await fetch("/api/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "transaction", message: transactionDescription }),
          });
        } catch (telegramErr) {
          console.error("Failed to send transaction to telegram:", telegramErr);
        }
      }

      const { error } = await supabase.from("layanan").insert([
        {
          customer_name: formData.customer_name.trim(),
          customer_whatsapp: formData.customer_whatsapp.trim(),
          jenis_layanan: jenisLayananValue,
          handled_by: formData.handled_by,
          handled_by_name: selectedUser?.full_name || user?.full_name,
          metode_pembayaran: formData.metode_pembayaran,
          lead_source: formData.lead_source,
          lead_source_custom:
            formData.lead_source === "tulis_sendiri"
              ? formData.lead_source_custom
              : null,
          detail_sku: formData.detail_sku || null,
          nominal: parseInt(formData.nominal) || 0,
          notes: formData.notes || null,
          photo_url: photoUrls[0] || null,
          photo_urls: photoUrls,
          created_by: user?.id,
          created_by_name: user?.full_name,
          status: "active",
        },
      ]);

      if (error) throw error;

      toast.success("Transaksi berhasil ditambahkan!");

      // Notify Telegram for new customer
      fetch("/api/telegram/customer-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formData.customer_name, phone: formData.customer_whatsapp }),
      }).catch(() => {});

      onSuccess?.();
      onClose?.();

      // Reset
      photoPreviews.forEach((u) => URL.revokeObjectURL(u));
      setFormData({
        customer_name: "",
        customer_whatsapp: "",
        jenis_layanan: "service_langsung",
        handled_by: user?.id || "",
        metode_pembayaran: "cash",
        lead_source: "instagram",
        lead_source_custom: "",
        detail_sku: "",
        nominal: "",
        notes: "",
      });
      setPhotoFiles([]);
      setPhotoPreviews([]);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan transaksi");
    } finally {
      setLoading(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-sm dark:bg-[#1c1c1c] dark:border-white/10 dark:text-gray-100 dark:focus:border-white";
  const labelClass =
    "block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5";
  const sectionClass =
    "bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-4";

  const currentUserName = user?.full_name || "Saya";
  const isHandledByMe = formData.handled_by === user?.id;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-10 flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
            <FileText className="w-4 h-4 text-white dark:text-gray-900" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              New Transaction
            </h2>
            <p className="text-xs text-gray-500">Input transaksi customer</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        {/* ── Customer Data ────────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <User className="w-3.5 h-3.5" /> Customer Data
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Nama Customer <span className="text-red-500">*</span>
              </label>
              <CustomerAutocomplete
                value={formData.customer_name}
                onChange={(val) => setFormData((p) => ({ ...p, customer_name: val }))}
                onSelect={(name, phone) => setFormData((p) => ({ ...p, customer_name: name, customer_whatsapp: phone }))}
                placeholder="Nama lengkap customer"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>
                WhatsApp <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={formData.customer_whatsapp}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      customer_whatsapp: e.target.value,
                    }))
                  }
                  className={`${inputClass} pl-9`}
                  placeholder="081234567890"
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Tanggal</label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-600 dark:text-gray-400">
                <Calendar className="w-4 h-4" />
                {new Date().toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Service Details ──────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5" /> Service Details
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Jenis Layanan <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.jenis_layanan}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    jenis_layanan: e.target.value as JenisLayanan,
                  }))
                }
                className={inputClass}
                required
              >
                {jenisLayananOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* ── Handled By — default current user, toggle untuk pilih lain ── */}
            <div>
              <label className={labelClass}>
                Handled By <span className="text-red-500">*</span>
              </label>

              {/* Toggle: by me / someone else */}
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherHandler(false);
                    setFormData((p) => ({ ...p, handled_by: user?.id || "" }));
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                    !showOtherHandler
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white dark:bg-[#1c1c1c] text-gray-600 border-gray-200 dark:border-white/10 hover:bg-gray-50"
                  }`}
                >
                  Saya ({currentUserName})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherHandler(true);
                    setFormData((p) => ({ ...p, handled_by: "" }));
                  }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1 ${
                    showOtherHandler
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white dark:bg-[#1c1c1c] text-gray-600 border-gray-200 dark:border-white/10 hover:bg-gray-50"
                  }`}
                >
                  <ChevronDown className="w-3.5 h-3.5" /> Orang Lain
                </button>
              </div>

              {showOtherHandler && (
                <select
                  value={formData.handled_by}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, handled_by: e.target.value }))
                  }
                  className={inputClass}
                  required
                >
                  <option value="">Pilih handler…</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="md:col-span-2">
              <label className={labelClass}>SKU / Keterangan Barang</label>
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={formData.detail_sku}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, detail_sku: e.target.value }))
                  }
                  className={`${inputClass} pl-9`}
                  placeholder="Deskripsi item / SKU…"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Transaction ──────────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5" /> Transaksi
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Metode Pembayaran</label>
              <select
                value={formData.metode_pembayaran}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    metode_pembayaran: e.target.value as MetodePembayaran,
                  }))
                }
                className={inputClass}
              >
                {metodePembayaranOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Nominal <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="number"
                  min="0"
                  value={formData.nominal}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, nominal: e.target.value }))
                  }
                  className={`${inputClass} pl-9`}
                  placeholder="0"
                  required
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>Lead Source</label>
              <select
                value={formData.lead_source}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    lead_source: e.target.value as LeadSource,
                  }))
                }
                className={inputClass}
              >
                {leadSourceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {showCustomLeadSource && (
              <div>
                <label className={labelClass}>Custom Lead Source</label>
                <input
                  type="text"
                  value={formData.lead_source_custom}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      lead_source_custom: e.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Tulis sumber…"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className={labelClass}>Catatan</label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, notes: e.target.value }))
                }
                rows={3}
                className={`${inputClass} resize-none`}
                placeholder="Catatan tambahan…"
              />
            </div>
          </div>
        </div>

        {/* ── Multiple Photo Upload ─────────────────────────────────────────── */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-3.5 h-3.5" /> Foto Bukti
              <span className="text-red-500">*Wajib min. 1</span>
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-semibold hover:bg-gray-800 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Foto
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {/* Preview grid */}
          {photoPreviews.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photoPreviews.map((src, i) => (
                <div
                  key={i}
                  className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 aspect-square"
                >
                  <img
                    src={src}
                    alt={`foto-${i}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-2 py-1 text-center">
                    Foto {i + 1}
                  </div>
                </div>
              ))}
              {/* Add more tile */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center gap-1 hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-gray-400"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs">Tambah</span>
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
            >
              <Camera className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">
                Klik untuk upload foto
              </p>
              <p className="text-xs text-gray-400 mt-1">
                JPG/PNG, bisa lebih dari 1 foto (max 15MB/foto)
              </p>
            </div>
          )}

          {/* Upload progress */}
          {uploading && progress > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1 text-gray-500">
                <span>Mengupload foto…</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gray-900 dark:bg-white h-1.5 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {photoFiles.length === 0 && !initialData?.photo_url && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
              <AlertCircle className="w-3.5 h-3.5" /> Minimal 1 foto wajib
              diupload
            </p>
          )}
        </div>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
          <button
            type="submit"
            disabled={
              loading ||
              uploading ||
              (photoFiles.length === 0 && !initialData?.photo_url)
            }
            className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading || uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploading ? `Uploading ${progress}%…` : "Menyimpan…"}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Simpan Transaksi
              </>
            )}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100 font-semibold py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all text-sm"
            >
              Batal
            </button>
          )}
        </div>
      </form>

      {/* ── Confirmation Modal ─────────────────────────────────────────── */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md border border-gray-200 dark:border-white/10"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Konfirmasi Transaksi
              </h3>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                  Periksa kembali semua data di bawah sebelum menyimpan
                </p>
              </div>

              {/* Summary Items */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Customer
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formData.customer_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formData.customer_whatsapp}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nominal
                    </p>
                    <p className="text-sm font-bold text-blue-600">
                      Rp {parseInt(formData.nominal).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Jenis Layanan
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {
                        jenisLayananOptions.find(
                          (opt) => opt.value === formData.jenis_layanan,
                        )?.label
                      }
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Metode Pembayaran
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {
                      metodePembayaranOptions.find(
                        (opt) => opt.value === formData.metode_pembayaran,
                      )?.label
                    }
                  </p>
                </div>

                {formData.detail_sku && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      SKU / Detail
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formData.detail_sku}
                    </p>
                  </div>
                )}

                {formData.notes && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Catatan
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 break-words">
                      {formData.notes}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Foto
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {photoPreviews.length} foto akan diupload
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-white/20 transition-all text-sm"
              >
                Ubah
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={loading || uploading}
                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading || uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploading ? `Uploading ${progress}%…` : "Menyimpan…"}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Simpan
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
});
