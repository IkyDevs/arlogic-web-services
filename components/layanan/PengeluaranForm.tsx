"use client";

import { useState, useEffect, useRef, memo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useBranch } from "@/lib/context/BranchContext";
import { useCentralUpload } from "@/hooks/useCentralUpload";
import { extractTelegramRefs, deleteTelegramMessages, editTelegramCaption } from "@/lib/telegram-sync";
import { MetodePembayaran } from "@/types";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  hasDraft,
  loadDraft,
  saveDraft,
  clearDraft,
  saveDraftTextSync,
} from "@/lib/draftStorage";
import { useTransactionStore } from "@/stores/transaction-store";
import {
  User,
  DollarSign,
  FileText,
  Send,
  X,
  Camera,
  Loader2,
  Trash2,
  AlertCircle,
  Calendar,
  Wrench,
  Plus,
  ChevronDown,
} from "lucide-react";

const metodePembayaranOptions = [
  { value: "cash", label: "Cash" },
  { value: "qris", label: "QRIS" },
  { value: "edc", label: "EDC" },
  { value: "tf_bca", label: "Transfer BCA" },
  { value: "tf_mandiri", label: "Transfer Mandiri" },
  { value: "edc_bca", label: "EDC BCA" },
  { value: "edc_mandiri", label: "EDC Mandiri" },
  { value: "bri", label: "BRI" },
  { value: "kudus", label: "Kudus" },
];

interface PengeluaranFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
  initialData?: any;
}

export default memo(function PengeluaranForm({
  onSuccess,
  onClose,
  initialData,
}: PengeluaranFormProps) {
  const { user } = useAuthStore();
  const { activeBranch } = useBranch();
  const supabase = createClient();
  // uploadKey stabil untuk edit/retry (recover foto dari IndexedDB pakai session key lama)
  const [uploadKey] = useState(
    () =>
      (initialData as any)?.upload_session_key ||
      `pengeluaran_${user?.id || "anon"}_${Date.now()}`,
  );
  const upload = useCentralUpload(uploadKey);
  const fetchTransactions = useTransactionStore((s) => s.fetch);

  const [formData, setFormData] = useState({
    item_name: initialData?.item_name || initialData?.customer_name || "",
    handled_by: initialData?.handled_by || user?.id || "",
    metode_pembayaran: (initialData?.metode_pembayaran ||
      "cash") as MetodePembayaran,
    nominal: initialData?.nominal?.toString() || "",
    notes: initialData?.notes || initialData?.detail_sku || "",
  });

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOtherHandler, setShowOtherHandler] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(() => {
    if (initialData?.photo_urls && Array.isArray(initialData.photo_urls)) {
      return initialData.photo_urls;
    }
    if (initialData?.photo_url) {
      return [initialData.photo_url];
    }
    return [];
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const clearingDraft = useRef(false);
  const handleCancel = useCallback(() => {
    if (!initialData && user?.id) {
      clearingDraft.current = true;
      clearDraft("pengeluaran", user.id);
    }
    restoredRef.current = false;
    onClose?.();
  }, [initialData, user?.id, onClose]);

  // ── Draft restore ────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialData || !user?.id || restoredRef.current) return;
    (async () => {
      if (!hasDraft("pengeluaran", user.id)) return;
      const draft = await loadDraft("pengeluaran", user.id);
      if (draft.data && !restoredRef.current) {
        restoredRef.current = true;
        setFormData((p) => ({ ...p, ...draft.data }));
        if (draft.photoFiles && draft.photoFiles.length > 0) {
          const result = await upload.addFiles(draft.photoFiles);
          if (result.files.length > 0) {
            setPhotoPreviews((prev) => [
              ...prev,
              ...result.files.map((f) => f.preview),
            ]);
          }
        }
        toast.success("Draft pengeluaran ditemukan dan dipulihkan", {
          duration: 3000,
        });
      }
    })();
  }, [user?.id]);

  // ── Auto-save text segera (sync) ─────────────────────────────────────────
  useEffect(() => {
    if (initialData || !user?.id) return;
    const d = formData;
    if (d.item_name || d.nominal) saveDraftTextSync("pengeluaran", user.id, d);
  }, [formData, user?.id]);

  // ── Auto-save foto (debounce 2s) ────────────────────────────────────────
  const photoTimer = useRef<any>(null);
  useEffect(() => {
    const draftFiles = upload.pendingFiles
      .filter((f) => f.status === "ready")
      .map((f) => f.file);
    if (
      initialData ||
      !user?.id ||
      clearingDraft.current ||
      draftFiles.length === 0
    )
      return;
    if (photoTimer.current) clearTimeout(photoTimer.current);
    photoTimer.current = setTimeout(() => {
      saveDraft("pengeluaran", user.id, formData, draftFiles).catch(() => {});
    }, 2000);
    return () => {
      if (photoTimer.current) clearTimeout(photoTimer.current);
    };
  }, [upload.pendingFiles, user?.id]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (initialData?.handled_by && initialData.handled_by !== user?.id) {
      setShowOtherHandler(true);
    } else {
      setShowOtherHandler(false);
    }
  }, [initialData?.handled_by, user?.id]);

  useEffect(() => {
    if (user?.id && !formData.handled_by && !initialData) {
      setFormData((p) => ({ ...p, handled_by: user.id }));
    }
  }, [user?.id, initialData]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["admin", "teknisi", "supervisor"])
      .order("full_name");
    if (data) setUsers(data);
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!rawFiles.length) return;

    const result = await upload.addFiles(rawFiles);
    if (result.files.length > 0) {
      setPhotoPreviews((prev) => [
        ...prev,
        ...result.files.map((f) => f.preview),
      ]);
    }
    if (result.errors.length > 0) {
      result.errors.forEach((e) => toast.error(e));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = async (idx: number) => {
    const url = photoPreviews[idx];
    const isBlob = url.startsWith("blob:");
    if (isBlob) {
      const pending = upload.pendingFiles.find((f) => f.preview === url);
      if (pending) await upload.removeFile(pending.id);
    } else {
      URL.revokeObjectURL(url);
    }
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.item_name.trim()) {
      toast.error("Nama barang wajib diisi");
      return;
    }
    if (!formData.handled_by) {
      toast.error("Pilih yang menangani");
      return;
    }
    if (!formData.nominal) {
      toast.error("Nominal wajib diisi");
      return;
    }
    if (!formData.metode_pembayaran) {
      toast.error("Metode pembayaran wajib dipilih");
      return;
    }
    if (
      upload.pendingFiles.length === 0 &&
      photoPreviews.length === 0 &&
      !initialData?.id
    ) {
      toast.error("Wajib upload minimal 1 foto bukti");
      return;
    }

    setShowConfirmation(true);
  };

  const submittingRef = useRef(false);

  const handleConfirmSubmit = async () => {
    if (submittingRef.current) {
      toast.error("Pengeluaran sedang diproses...");
      return;
    }
    submittingRef.current = true;
    setShowConfirmation(false);
    setLoading(true);
    try {
      // Find selected user from cached list, or fetch from DB if not found
      let selectedUser = users.find((u) => u.id === formData.handled_by);
      if (!selectedUser && formData.handled_by) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", formData.handled_by)
          .single();
        selectedUser = profile || null;
      }
      // When editing, use initialData's handled_by_name as fallback
      const handlerName =
        selectedUser?.full_name ||
        initialData?.handled_by_name ||
        user?.full_name;

      const now = new Date();
      const dayNames = [
        "Minggu",
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu",
      ];
      const monthNames = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      const fmtDateTime = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2, "0")}.${now.getMinutes().toString().padStart(2, "0")}.${now.getSeconds().toString().padStart(2, "0")}`;

      const metodeLabel =
        metodePembayaranOptions.find(
          (opt) => opt.value === formData.metode_pembayaran,
        )?.label || formData.metode_pembayaran;
      const transactionDescription = `💰 PENGELUARAN

tanggal : ${fmtDateTime}
nama barang: ${formData.item_name}
nominal: Rp ${parseInt(formData.nominal).toLocaleString("id-ID")}
jenis pembayaran: ${metodeLabel}
operator: ${handlerName}`;

      // Get existing photo URLs from initialData
      const existingPhotoUrls: string[] =
        initialData?.photo_urls && Array.isArray(initialData.photo_urls)
          ? initialData.photo_urls
          : initialData?.photo_url
            ? [initialData.photo_url]
            : [];

      const isEditing = !!initialData?.id;
      const pendingFiles = upload.pendingFiles.filter(
        (f) => f.status === "ready",
      );
      const hasNewFiles = pendingFiles.length > 0;

      // ── FIXED FLOW: Insert transaction FIRST, then upload photos ──────────────

      // TAHAP 1: Simpan pengeluaran dulu dengan status PENDING (jika ada foto baru)
      // Jika ini gagal, stop total — jangan lanjut ke upload foto.
      let newTxId: string | undefined;
      const photoStatus = hasNewFiles ? "pending" : "no_photo";

      if (isEditing) {
        const updateData: any = {
          customer_name: formData.item_name.trim(),
          customer_whatsapp: "",
          jenis_layanan: "pengeluaran",
          handled_by: formData.handled_by,
          handled_by_name: handlerName,
          metode_pembayaran: formData.metode_pembayaran,
          lead_source: "pengeluaran",
          detail_sku: formData.notes || null,
          nominal: parseInt(formData.nominal) || 0,
          notes: formData.notes || null,
          updated_at: new Date().toISOString(),
          upload_session_key: uploadKey,
        };

        // Jika ada foto baru, jangan update photo_url/photo_urls sampai upload selesai
        if (!hasNewFiles) {
          updateData.photo_url = existingPhotoUrls[0] || null;
          updateData.photo_urls = existingPhotoUrls;
        } else {
          updateData.photo_status = "pending"; // Tandai sedang upload foto
        }

        const result = await supabase
          .from("layanan")
          .update(updateData)
          .eq("id", initialData.id);
        if (result.error) throw result.error;
        newTxId = initialData.id;

        if (!hasNewFiles) {
          toast.success("Pengeluaran berhasil diperbarui!");
        }
      } else {
        // INSERT baru dengan status PENDING jika ada foto, atau no_photo jika tidak
        const result = await supabase
          .from("layanan")
          .insert([
            {
              customer_name: formData.item_name.trim(),
              customer_whatsapp: "",
              jenis_layanan: "pengeluaran",
              handled_by: formData.handled_by,
              handled_by_name: handlerName,
              metode_pembayaran: formData.metode_pembayaran,
              lead_source: "pengeluaran",
              detail_sku: formData.notes || null,
              nominal: parseInt(formData.nominal) || 0,
              notes: formData.notes || null,
              photo_url: null, // Jangan set URL sampai foto upload selesai
              photo_urls: [],
              photo_status: photoStatus, // "pending" atau "no_photo"
              created_by: user?.id,
              created_by_name: user?.full_name,
              status: "completed",
              branch_id: (activeBranch as any)?.id || null,
              upload_session_key: uploadKey,
            },
          ])
          .select()
          .single();
        if (result.error) throw result.error;
        newTxId = result.data?.id;

        if (!hasNewFiles) {
          toast.success("Pengeluaran berhasil dicatat!");
        }
      }

      // Kalau nggak ada foto baru, selesai di sini (edit data-only → edit caption pesan lama, D6)
      if (!hasNewFiles) {
        if (isEditing && initialData?.id) {
          const oldRef = extractTelegramRefs(initialData as any);
          if (oldRef) {
            editTelegramCaption(oldRef.chat_id, oldRef.message_ids[0], transactionDescription).then((ok) => {
              if (!ok) {
                supabase.from("layanan").update({ telegram_sync: "caption_failed" } as any).eq("id", initialData.id).then((res) => {
                  if (res.error) console.warn("[Pengeluaran] mark caption_failed error:", res.error);
                });
              }
            });
          }
        }
        // Cleanup
        setFormData({
          item_name: "",
          handled_by: user?.id || "",
          metode_pembayaran: "cash",
          nominal: "",
          notes: "",
        });
        setPhotoPreviews([]);

        if (user?.id) {
          clearingDraft.current = true;
          clearDraft("pengeluaran", user.id);
        }
        restoredRef.current = false;
        fetchTransactions();
        onSuccess?.();
        onClose?.();
        return;
      }

      // TAHAP 2: Upload foto ke Telegram — di-await agar photo_urls tersimpan sebelum UI ditutup
      const txIdToUpdate = isEditing ? initialData.id : newTxId;
      let uploadOk = false;
      if (txIdToUpdate) {
        const filesToUpload = pendingFiles.map((pf) => pf.file);

        try {
          const results = await upload.legacyUpload(
            filesToUpload,
            "layanan",
            transactionDescription,
            undefined,
            (activeBranch as any)?.code,
          );

          if (results?.length) {
            const newPhotoUrls = [
              ...existingPhotoUrls,
              ...results.map((r) => r.url),
            ];
            const newMessageIds = results.map(r => r.message_id).filter((id: number) => Number.isFinite(id));
            const newFileIds = results.map(r => r.file_id).filter(Boolean);
            const { error: updateErr } = await supabase
              .from("layanan")
              .update({
                photo_urls: newPhotoUrls,
                photo_url: newPhotoUrls[0] || null,
                photo_status: "completed", // Tandai berhasil
                upload_status: "SUCCESS",
                telegram_chat_id: results[0]?.chat_id || null,
                telegram_message_id: results[0]?.message_id || null,
                telegram_message_ids: newMessageIds,
                telegram_file_ids: newFileIds,
                telegram_sync: "synced",
              } as any)
              .eq("id", txIdToUpdate);
            if (updateErr) throw updateErr;

            // D3: pesan baru sudah terkirim → hapus pesan lama (hanya saat edit & ada ref lama)
            if (isEditing) {
              const oldRef = extractTelegramRefs(initialData as any);
              if (oldRef) {
                await deleteTelegramMessages(oldRef.chat_id, oldRef.message_ids);
              }
            }
            console.log(
              "[Pengeluaran] Photos uploaded successfully",
              newPhotoUrls.length,
            );
            upload.clear();
            uploadOk = true;
          }
        } catch (err: any) {
          console.error("[Pengeluaran] Upload failed:", err);
        }

        if (!uploadOk) {
          // Upload gagal — tandai failed + pertahankan IndexedDB untuk retry
          await supabase
            .from("layanan")
            .update({ photo_status: "failed", upload_status: "FAILED" } as any)
            .eq("id", txIdToUpdate);
          window.dispatchEvent(
            new CustomEvent("layanan-retry-upload", {
              detail: { txId: txIdToUpdate },
            }),
          );
        }
      }

      setFormData({
        item_name: "",
        handled_by: user?.id || "",
        metode_pembayaran: "cash",
        nominal: "",
        notes: "",
      });
      setPhotoPreviews([]);

      if (user?.id) {
        clearingDraft.current = true;
        clearDraft("pengeluaran", user.id);
      }
      restoredRef.current = false;

      if (uploadOk) {
        toast.success("Pengeluaran berhasil dicatat!");
      } else {
        toast.error("Pengeluaran tersimpan, tetapi foto gagal diupload. Akan dicoba lagi.");
      }
      fetchTransactions();
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan pengeluaran");
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

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
      <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-10 flex justify-between items-center px-6 py-4 border-b border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Pengeluaran Baru
            </h2>
            <p className="text-xs text-gray-500">
              Input pengeluaran operasional
            </p>
          </div>
        </div>
        <button
          onClick={handleCancel}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div className={sectionClass}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5" /> Detail Pengeluaran
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>
                Nama Barang <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.item_name}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, item_name: e.target.value }))
                }
                className={inputClass}
                placeholder="Nama barang / jasa"
                required
                autoFocus
              />
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
            <div>
              <label className={labelClass}>
                Handle By <span className="text-red-500">*</span>
              </label>

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
            <div>
              <label className={labelClass}>
                Metode Pembayaran <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.metode_pembayaran}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    metode_pembayaran: e.target.value as MetodePembayaran,
                  }))
                }
                className={inputClass}
                required
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

          {upload.uploading && upload.progress > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1 text-gray-500">
                <span>Mengupload foto…</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {upload.progress}%
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gray-900 dark:bg-white h-1.5 transition-all duration-300"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            </div>
          )}

          {upload.pendingFiles.length === 0 &&
            photoPreviews.length === 0 &&
            !initialData?.id && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" /> Minimal 1 foto wajib
                diupload
              </p>
            )}
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
          <button
            type="submit"
            disabled={
              loading ||
              upload.uploading ||
              (upload.pendingFiles.length === 0 &&
                photoPreviews.length === 0 &&
                !initialData?.id)
            }
            className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading || upload.uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {upload.uploading
                  ? `Uploading ${upload.progress}%…`
                  : "Menyimpan…"}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Simpan Pengeluaran
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100 font-semibold py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all text-sm"
          >
            Batal
          </button>
        </div>
      </form>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md border border-gray-200 dark:border-white/10"
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Konfirmasi Pengeluaran
              </h3>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs sm:text-sm text-red-700 dark:text-red-300">
                  Periksa kembali semua data di bawah sebelum menyimpan
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nama Barang
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {formData.item_name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nominal
                    </p>
                    <p className="text-sm font-bold text-red-600">
                      Rp{" "}
                      {parseInt(formData.nominal || "0").toLocaleString(
                        "id-ID",
                      )}
                    </p>
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
                </div>

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
                disabled={loading || upload.uploading}
                className="flex-1 px-4 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading || upload.uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {upload.uploading
                      ? `Uploading ${upload.progress}%…`
                      : "Menyimpan…"}
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
