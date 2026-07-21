"use client";

import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useUpload, compressFiles } from "@/hooks/useUpload";
import { JenisLayanan, MetodePembayaran, LeadSource } from "@/types";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  hasDraft,
  loadDraft,
  saveDraft,
  clearDraft,
  saveDraftTextSync,
} from "@/lib/draftStorage";
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
  { value: "ambil_jam_service", label: "Ambil Jam Service" },
  { value: "order_online", label: "Order Online" },
  { value: "beli_jam", label: "Beli Jam" },
  { value: "dp_service", label: "DP Service" },
];

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
  { value: "split_payment", label: "Split Payment" },
];

const splitMetodeOptions = metodePembayaranOptions.filter(
  (o) => o.value !== "split_payment",
);

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
    // Split payment fields
    metode_pembayaran_1: initialData?.metode_pembayaran_1 || "cash",
    nominal_1: initialData?.nominal_1?.toString() || "",
    metode_pembayaran_2: initialData?.metode_pembayaran_2 || "qris",
    nominal_2: initialData?.nominal_2?.toString() || "",
  });

  // ── Extra items (multi-jenis) ────────────────────────────────────────
  const [extraItems, setExtraItems] = useState<
    {
      jenis_layanan: string;
      nominal: string;
      notes: string;
      detail_sku: string;
    }[]
  >([]);
  const addExtraItem = () =>
    setExtraItems((p) => [
      ...p,
      {
        jenis_layanan: "service_langsung",
        nominal: "",
        notes: "",
        detail_sku: "",
      },
    ]);
  const removeExtraItem = (idx: number) =>
    setExtraItems((p) => p.filter((_, i) => i !== idx));
  const updateExtraItem = (idx: number, field: string, value: string) =>
    setExtraItems((p) =>
      p.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOtherHandler, setShowOtherHandler] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Multiple photos
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState({ done: 0, total: 0 });
  const [showPhotoSource, setShowPhotoSource] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const clearingDraft = useRef(false);

  const showCustomLeadSource = formData.lead_source === "tulis_sendiri";

  const serviceTotal = useMemo(
    () =>
      (parseInt(formData.nominal) || 0) +
      extraItems.reduce((s, it) => s + (parseInt(it.nominal) || 0), 0),
    [formData.nominal, extraItems],
  );

  const derivedNominal2 = useMemo(() => {
    if (formData.metode_pembayaran !== ("split_payment" as string)) return formData.nominal_2;
    const n1 = parseInt(formData.nominal_1) || 0;
    return Math.max(0, serviceTotal - n1).toString();
  }, [formData.metode_pembayaran, formData.nominal_1, serviceTotal]);

  const handleCancel = useCallback(() => {
    if (!initialData && user?.id) {
      clearingDraft.current = true;
      clearDraft("layanan", user.id);
    }
    restoredRef.current = false;
    onClose?.();
  }, [initialData, user?.id, onClose]);

  // ── Draft restore ────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialData || !user?.id || restoredRef.current) return;
    const checkDraft = async () => {
      if (!hasDraft("layanan", user.id)) return;
      const draft = await loadDraft("layanan", user.id);
      if (draft.data && !restoredRef.current) {
        if (photoTimer.current) clearTimeout(photoTimer.current);
        restoredRef.current = true;
        setFormData((p) => ({ ...p, ...draft.data }));
        if (draft.photoFiles && draft.photoFiles.length > 0) {
          setPhotoFiles(draft.photoFiles);
          setPhotoPreviews(draft.photoFiles.map((f) => URL.createObjectURL(f)));
        }
        // Restore extra items
        if (draft.data?.extraItems) {
          try {
            setExtraItems(JSON.parse(draft.data.extraItems));
          } catch {}
        }
        toast.success("Draft transaksi ditemukan dan dipulihkan", {
          duration: 3000,
        });
      }
    };
    checkDraft();
  }, [user?.id]);

  // ── Auto-save text segera (sync) ─────────────────────────────────────────
  useEffect(() => {
    if (initialData || !user?.id) return;
    const d = formData;
    if (d.customer_name || d.nominal || d.customer_whatsapp) {
      const dataWithItems = { ...d, extraItems: JSON.stringify(extraItems) };
      localStorage.setItem(
        `draft_layanan_${user.id}`,
        JSON.stringify({
          data: dataWithItems,
          timestamp: Date.now(),
          userId: user.id,
          photos: [],
          extraPhoto: null,
        }),
      );
    }
  }, [formData, extraItems, user?.id]);

  // ── Auto-save foto (debounce 2s, hanya saat photos berubah) ────────────
  const photoTimer = useRef<any>(null);
  useEffect(() => {
    if (initialData || !user?.id || photoFiles.length === 0) return;
    if (photoTimer.current) clearTimeout(photoTimer.current);
    photoTimer.current = setTimeout(() => {
      saveDraft("layanan", user.id, formData, photoFiles).catch(() => {});
    }, 2000);
    return () => {
      if (photoTimer.current) clearTimeout(photoTimer.current);
    };
  }, [photoFiles, user?.id]);

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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const rawFiles = files.filter(
      (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name),
    );
    if (rawFiles.length === 0) return;

    setIsCompressing(true);
    setCompressProgress({ done: 0, total: rawFiles.length });

    try {
      const compressed = await compressFiles(rawFiles, (done, total) => {
        setCompressProgress({ done, total });
      }, 'trx');
      if (compressed.length === 0) return;
      setPhotoFiles((prev) => [...prev, ...compressed]);
      compressed.forEach((f) => {
        setPhotoPreviews((prev) => [...prev, URL.createObjectURL(f)]);
      });
    } catch (e: any) {
      toast.error(e.message || 'Gagal memproses foto');
    } finally {
      setIsCompressing(false);
    }

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

    if ((formData.metode_pembayaran as string) === "split_payment") {
      const paymentTotal =
        (parseInt(formData.nominal_1) || 0) +
        (parseInt(derivedNominal2) || 0);
      if (paymentTotal !== serviceTotal) {
        toast.error(
          `Total pembayaran (Rp ${paymentTotal.toLocaleString("id-ID")}) harus sama dengan total service (Rp ${serviceTotal.toLocaleString("id-ID")})`,
        );
        return;
      }
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

      const isEdit = !!initialData?.id;
      const isMulti = extraItems.length > 0;
      const allItems = [
        {
          jenis: jenisLayananValue as string,
          sku: formData.detail_sku,
          notes: formData.notes,
          nominal: formData.nominal,
        },
      ].concat(
        extraItems.map((it) => ({
          jenis: it.jenis_layanan,
          sku: it.detail_sku,
          notes: it.notes,
          nominal: it.nominal,
        })),
      );

      // Build single caption combining all jenis layanan
      const buildCaption = (items: typeof allItems) => {
        const labels = items.map(
          (item) =>
            jenisLayananOptions.find((o) => o.value === item.jenis)?.label ||
            item.jenis,
        );
        const typeLabel = labels.join(" & ");
        const totalNominal = items.reduce(
          (s, item) => s + parseInt(item.nominal || "0"),
          0,
        );
        const allSkus = items
          .map((item) => item.sku)
          .filter(Boolean)
          .join(", ");
        const invoice = allSkus ? `\n📋 Invoice: ${allSkus}` : "";
        const allNotes = items
          .map((item) => item.notes)
          .filter(Boolean)
          .join("; ");
        const note = allNotes ? `\n📝 Keterangan: ${allNotes}` : "";

        const isSplit = (formData.metode_pembayaran as string) === "split_payment";
        const metodeSection = isSplit
          ? `💳 SPLIT PAYMENT
  ► Metode 1   : ${
              splitMetodeOptions.find(
                (o) => o.value === formData.metode_pembayaran_1,
              )?.label || formData.metode_pembayaran_1
            }
  ► Nominal 1  : Rp ${(parseInt(formData.nominal_1) || 0).toLocaleString("id-ID")}
  ► Metode 2   : ${
              splitMetodeOptions.find(
                (o) => o.value === formData.metode_pembayaran_2,
              )?.label || formData.metode_pembayaran_2
            }
  ► Nominal 2  : Rp ${(parseInt(derivedNominal2) || 0).toLocaleString("id-ID")}
  💰 Total      : Rp ${totalNominal.toLocaleString("id-ID")}`
          : `💰 Nominal: Rp ${totalNominal.toLocaleString("id-ID")}
💳 Metode: ${metodeLabel}`;

        return `📊 TRANSAKSI

🔧 tipe : ${typeLabel}
📱 Customer: ${formData.customer_name}
📞 WA: ${formData.customer_whatsapp}
${metodeSection}${invoice}${note}
👤 Operator: ${selectedUser?.full_name || user?.full_name}
⏰ ${fmtDateTime}`;
      };

      const mainCaption = buildCaption(allItems);

      let photoUrls: string[] = initialData?.photo_url
        ? [initialData.photo_url]
        : [];

      let telegramSent = false;
      let tgChatId: string | undefined = undefined;
      let tgMessageId: number | undefined = undefined;

      // Upload foto + kirim caption untuk item utama
      if (photoFiles.length > 0) {
        const results = await uploadFiles(photoFiles, {
          type: "layanan",
          caption: mainCaption,
        });
        if (results && results.length > 0) {
          photoUrls = results.map((r) => r.url);
          telegramSent = true;
          if (results[0].chat_id && results[0].message_id) {
            tgChatId = results[0].chat_id;
            tgMessageId = results[0].message_id;
          }
        } else {
          toast.error("Gagal upload foto");
          return;
        }
      }

      if (!telegramSent) {
        if (
          initialData?.id &&
          initialData.telegram_chat_id &&
          initialData.telegram_message_id
        ) {
          try {
            await fetch("/api/telegram/edit-message", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: initialData.telegram_chat_id,
                message_id: initialData.telegram_message_id,
                text: mainCaption,
                is_caption:
                  (initialData.photo_urls &&
                    initialData.photo_urls.length > 0) ||
                  !!initialData.photo_url,
              }),
            });
            telegramSent = true;
          } catch (telegramErr) {
            console.error("Failed to edit telegram message:", telegramErr);
          }
        } else {
          try {
            const res = await fetch("/api/telegram", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "transaction",
                message: mainCaption,
              }),
            });
            const data = await res.json();
            if (data.success && data.chat_id && data.message_id) {
              tgChatId = data.chat_id;
              tgMessageId = data.message_id;
            }
          } catch (telegramErr) {
            console.error(
              "Failed to send transaction to telegram:",
              telegramErr,
            );
          }
        }
      }

      const combinedJenisLabel = isMulti
        ? allItems
            .map(
              (item) =>
                jenisLayananOptions.find((o) => o.value === item.jenis)
                  ?.label || item.jenis,
            )
            .join(" & ")
        : jenisLayananValue;

      const isSplit = (formData.metode_pembayaran as string) === "split_payment";

      const payload: any = {
        customer_name: formData.customer_name.trim(),
        customer_whatsapp: formData.customer_whatsapp.trim(),
        jenis_layanan: combinedJenisLabel,
        handled_by: formData.handled_by,
        handled_by_name: selectedUser?.full_name || user?.full_name,
        metode_pembayaran: formData.metode_pembayaran,
        lead_source: formData.lead_source,
        lead_source_custom:
          formData.lead_source === "tulis_sendiri"
            ? formData.lead_source_custom
            : null,
        detail_sku: formData.detail_sku || null,
        nominal: isSplit
          ? (parseInt(formData.nominal_1) || 0) + (parseInt(derivedNominal2) || 0)
          : isMulti
            ? allItems.reduce((s, item) => s + parseInt(item.nominal || "0"), 0)
            : parseInt(formData.nominal) || 0,
        notes: formData.notes || null,
      };

      if (isSplit) {
        payload.split_payment = true;
        payload.metode_pembayaran_1 = formData.metode_pembayaran_1;
        payload.nominal_1 = parseInt(formData.nominal_1) || 0;
        payload.metode_pembayaran_2 = formData.metode_pembayaran_2;
        payload.nominal_2 = parseInt(derivedNominal2) || 0;
      }

      if (initialData?.id) {
        if (photoUrls.length > 0) {
          payload.photo_url = photoUrls[0];
          payload.photo_urls = photoUrls;
        }
        if (tgChatId && tgMessageId) {
          payload.telegram_chat_id = tgChatId;
          payload.telegram_message_id = tgMessageId;
        }
        const { error } = await supabase
          .from("layanan")
          .update(payload)
          .eq("id", initialData.id);
        if (error) throw error;
        toast.success("Transaksi berhasil diubah!");

        if (initialData.id) {
          await supabase
            .from("layanan_items")
            .delete()
            .eq("layanan_id", initialData.id);
          if (extraItems.length > 0) {
            const itemRows = extraItems.map((it) => ({
              layanan_id: initialData.id,
              jenis_layanan: it.jenis_layanan,
              detail_sku: it.detail_sku || "",
              notes: it.notes || "",
              nominal: parseInt(it.nominal) || 0,
            }));
            await supabase.from("layanan_items").insert(itemRows);
          }
        }
      } else {
        const { data: newLayanan, error } = await supabase
          .from("layanan")
          .insert([
            {
              ...payload,
              photo_url: photoUrls[0] || null,
              photo_urls: photoUrls,
              telegram_chat_id: tgChatId,
              telegram_message_id: tgMessageId,
              created_by: user?.id,
              created_by_name: user?.full_name,
              status: "active",
            },
          ])
          .select("id");
        if (error) throw error;
        toast.success("Transaksi berhasil ditambahkan!");

        if (extraItems.length > 0 && newLayanan?.[0]?.id) {
          const itemRows = extraItems.map((it) => ({
            layanan_id: newLayanan[0].id,
            jenis_layanan: it.jenis_layanan,
            detail_sku: it.detail_sku || "",
            notes: it.notes || "",
            nominal: parseInt(it.nominal) || 0,
          }));
          const { error: itemErr } = await supabase
            .from("layanan_items")
            .insert(itemRows);
          if (itemErr)
            console.error("Gagal simpan extra items:", JSON.stringify(itemErr));
        }
      }

      // Save to customers table + notify Telegram if new
      try {
        const custPhone = (formData.customer_whatsapp || "").replace(/\D/g, "");
        if (formData.customer_name && custPhone) {
          const last4 = custPhone.slice(-4);
          const rawName = formData.customer_name.trim().replace(/^CS\s*/i, "");
          const baseName = rawName.endsWith(` ${last4}`)
            ? rawName
            : `${rawName} ${last4}`;
          const custName = baseName.startsWith("CS ")
            ? baseName
            : `CS ${baseName}`;
          const { data: existingCust, error: checkErr } = await supabase
            .from("customers")
            .select("id, name")
            .eq("phone", custPhone)
            .maybeSingle();
          if (checkErr) throw checkErr;
          if (existingCust) {
            await supabase
              .from("customers")
              .update({ last_transaction: new Date().toISOString() })
              .eq("id", existingCust.id);
          } else {
            const { error: insertErr } = await supabase
              .from("customers")
              .insert({ name: custName, phone: custPhone });
            if (insertErr) throw insertErr;
            // Only send Telegram for genuinely new customers
            fetch("/api/telegram", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "customer",
                message: `CUSTOMER BARU \nnama cs: ${custName}\nno. wa: ${custPhone}`,
              }),
            }).catch(() => {});
          }
        }
      } catch (custErr: any) {
        console.error("Customer save error:", custErr);
        toast.error("Gagal simpan customer: " + custErr.message);
      }

      if (user?.id) {
        clearingDraft.current = true;
        clearDraft("layanan", user.id);
      }
      restoredRef.current = false;
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
        metode_pembayaran_1: "cash",
        nominal_1: "",
        metode_pembayaran_2: "qris",
        nominal_2: "",
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
              {initialData ? "Edit Transaction" : "New Transaction"}
            </h2>
            <p className="text-xs text-gray-500">
              {initialData
                ? "Edit data transaksi customer"
                : "Input transaksi customer"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!initialData && user?.id && hasDraft("layanan", user.id) && (
            <button
              type="button"
              onClick={() => {
                clearDraft("layanan", user.id);
                setFormData({
                  customer_name: "", customer_whatsapp: "",
                  jenis_layanan: "service_langsung" as JenisLayanan,
                  handled_by: user.id || "", metode_pembayaran: "cash" as MetodePembayaran,
                  lead_source: "instagram" as LeadSource, lead_source_custom: "",
                  detail_sku: "", nominal: "", notes: "",
                  metode_pembayaran_1: "cash", nominal_1: "",
                  metode_pembayaran_2: "qris", nominal_2: "",
                });
                setExtraItems([]);
                setPhotoFiles([]);
                setPhotoPreviews([]);
                toast.success("Draft berhasil dihapus", { duration: 2000 });
              }}
              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Hapus draft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
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
                onChange={(val) =>
                  setFormData((p) => ({ ...p, customer_name: val }))
                }
                onSelect={(name, phone) =>
                  setFormData((p) => ({
                    ...p,
                    customer_name: name,
                    customer_whatsapp: phone,
                    lead_source: "old" as LeadSource,
                  }))
                }
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
            <div className="space-y-3">
              {extraItems.length === 0 ? (
                <>
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
                  <label className={labelClass}>SKU / Invoice</label>
                  <input
                    type="text"
                    value={formData.detail_sku}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, detail_sku: e.target.value }))
                    }
                    className={inputClass}
                    placeholder="SKU / Invoice"
                  />
                  <label className={labelClass}>
                    Nominal <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={formData.nominal}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          nominal: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      className={`${inputClass} pl-9`}
                      placeholder="0"
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <label className={labelClass}>
                    Layanan <span className="text-red-500">*</span>
                  </label>
                  {/* Item 1: Utama */}
                  <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-white/10 border-b border-gray-200 dark:border-white/10">
                      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        Layanan Utama
                      </span>
                    </div>
                    <div className="p-3 space-y-2 bg-white dark:bg-[#1c1c1c]">
                      <select
                        value={formData.jenis_layanan}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            jenis_layanan: e.target.value as JenisLayanan,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                      >
                        {jenisLayananOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={formData.detail_sku}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              detail_sku: e.target.value,
                            }))
                          }
                          placeholder="SKU / Invoice"
                          className="px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10 w-full"
                        />
                        <input
                          type="text"
                          value={formData.nominal}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              nominal: e.target.value.replace(/\D/g, ""),
                            }))
                          }
                          placeholder="Nominal"
                          className="px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10 w-full"
                        />
                      </div>
                    </div>
                  </div>
                  {extraItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-white/10 border-b border-gray-200 dark:border-white/10">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          Layanan Tambahan #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeExtraItem(idx)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="p-3 space-y-2 bg-white dark:bg-[#1c1c1c]">
                        <select
                          value={item.jenis_layanan}
                          onChange={(e) =>
                            updateExtraItem(idx, "jenis_layanan", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                        >
                          {jenisLayananOptions
                            .filter(
                              (o) =>
                                o.value !== "pengeluaran" && o.value !== "cashdraw",
                            )
                            .map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={item.detail_sku}
                            onChange={(e) =>
                              updateExtraItem(idx, "detail_sku", e.target.value)
                            }
                            placeholder="SKU / Invoice"
                            className="px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10 w-full"
                          />
                          <input
                            type="text"
                            value={item.nominal}
                            onChange={(e) =>
                              updateExtraItem(
                                idx,
                                "nominal",
                                e.target.value.replace(/\D/g, ""),
                              )
                            }
                            placeholder="Nominal"
                            className="px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10 w-full"
                          />
                        </div>
                        <input
                          type="text"
                          value={item.notes}
                          onChange={(e) =>
                            updateExtraItem(idx, "notes", e.target.value)
                          }
                          placeholder="Catatan (opsional)"
                          className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Tambah Layanan button */}
              {extraItems.length === 0 ? (
                <button
                  type="button"
                  onClick={addExtraItem}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:border-gray-900 dark:hover:border-white hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Layanan Lain
                </button>
              ) : (
                <button
                  type="button"
                  onClick={addExtraItem}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-2 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:border-gray-900 dark:hover:border-white hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Layanan Lagi
                </button>
              )}
              {extraItems.length === 0 && (
                <p className="text-[11px] text-gray-400 italic -mt-1">
                  Tambah layanan lain dalam 1 transaksi (misal: beli jam + service jam)
                </p>
              )}
            </div>
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

            {(formData.metode_pembayaran as string) === "split_payment" ? (
              <div className="md:col-span-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl space-y-2">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Pembayaran 1
                    </label>
                    <select
                      value={formData.metode_pembayaran_1}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          metode_pembayaran_1: e.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      {splitMetodeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={formData.nominal_1}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          const n1 = parseInt(val) || 0;
                          const n2 = Math.max(0, serviceTotal - n1);
                          setFormData((p) => ({
                            ...p,
                            nominal_1: val,
                            nominal_2: n2.toString(),
                          }));
                        }}
                        className={`${inputClass} pl-9`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl space-y-2">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Pembayaran 2
                    </label>
                    <select
                      value={formData.metode_pembayaran_2}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          metode_pembayaran_2: e.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      {splitMetodeOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={derivedNominal2}
                        readOnly
                        className={`${inputClass} pl-9 bg-gray-50`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 px-3 py-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Total Bayar:
                  </span>
                  <span className="text-sm font-bold text-blue-600">
                    Rp{" "}
                    {(
                      (parseInt(formData.nominal_1) || 0) +
                      (parseInt(derivedNominal2) || 0)
                    ).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            ) : (
              <div>
                <label className={labelClass}>
                  Total Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type={extraItems.length > 0 ? "text" : "number"}
                    min="0"
                    value={
                      extraItems.length > 0
                        ? (
                            (parseInt(formData.nominal) || 0) +
                            extraItems.reduce(
                              (s, it) => s + (parseInt(it.nominal) || 0),
                              0,
                            )
                          ).toLocaleString("id-ID")
                        : formData.nominal
                    }
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, nominal: e.target.value }))
                    }
                    className={`${inputClass} pl-9`}
                    placeholder="0"
                    required
                    readOnly={extraItems.length > 0}
                  />
                  {extraItems.length > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      Total otomatis dari semua layanan
                    </p>
                  )}
                </div>
              </div>
            )}
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

        {/* ── Photos ────────────────────────────────────────────────────────── */}
        <div className={sectionClass}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Camera className="w-3.5 h-3.5" /> Foto Bukti Transaksi
              <span className="text-red-500">*Wajib min. 1</span>
            </p>
            <button
              type="button"
              onClick={() => setShowPhotoSource(true)}
              disabled={isCompressing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg text-xs font-semibold hover:bg-gray-800 transition-all disabled:opacity-50"
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
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {/* Photo Source Popup */}
          {showPhotoSource && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] p-4"
              onClick={() => setShowPhotoSource(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-xl w-full max-w-xs border border-gray-200 dark:border-white/10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-5 text-center border-b border-gray-200 dark:border-white/10">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Pilih Sumber Foto
                  </p>
                </div>
                <div className="p-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPhotoSource(false);
                      setTimeout(() => cameraInputRef.current?.click(), 100);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-left"
                  >
                    <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                      <Camera className="w-4 h-4 text-white dark:text-gray-900" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Ambil Foto
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Buka kamera langsung
                      </p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPhotoSource(false);
                      setTimeout(() => fileInputRef.current?.click(), 100);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition-all text-left"
                  >
                    <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Pilih dari Galeri
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Pilih foto yang sudah ada
                      </p>
                    </div>
                  </button>
                </div>
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => setShowPhotoSource(false)}
                    className="w-full py-2 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Preview grid */}
          {photoPreviews.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photoPreviews.map((src, i) => (
                <div
                  key={i}
                  className="relative group rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 aspect-square"
                >
                  <button
                    type="button"
                    onClick={() => setPreviewPhoto(src)}
                    className="w-full h-full p-0 border-0"
                  >
                    <img
                      src={src}
                      alt={`foto-${i}`}
                      className="w-full h-full object-cover cursor-pointer"
                    />
                  </button>
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
                onClick={() => setShowPhotoSource(true)}
                className="aspect-square rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center gap-1 hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-gray-400"
              >
                <Plus className="w-6 h-6" />
                <span className="text-xs">Tambah</span>
              </button>
            </div>
          ) : (
            <div
              onClick={() => setShowPhotoSource(true)}
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

          {/* Compression Loading Indicator */}
          {isCompressing && (
            <div className="flex items-center gap-2 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-sm text-blue-700">
                Mengompresi foto ({compressProgress.done}/{compressProgress.total})...
              </span>
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

        {/* ── Photo Preview Lightbox ─────────────────────────────────────── */}
        {previewPhoto && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[90] p-4"
            onClick={() => setPreviewPhoto(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative max-w-3xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="absolute -top-10 right-0 p-2 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={previewPhoto}
                alt="Preview foto"
                className="w-full h-full max-h-[85vh] object-contain rounded-xl"
              />
            </motion.div>
          </div>
        )}

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
          <button
            type="submit"
            disabled={
              loading ||
              uploading ||
              isCompressing ||
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
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 bg-white dark:bg-[#2a2a2a] text-gray-900 dark:text-gray-100 font-semibold py-3 rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 transition-all text-sm"
          >
            Batal
          </button>
        </div>
      </form>

      {/* ── Confirmation Modal ─────────────────────────────────────────── */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
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
                      {extraItems.length > 0 ? "Total Nominal" : "Nominal"}
                    </p>
                    <p className="text-sm font-bold text-blue-600">
                      Rp{" "}
                      {(
                        (formData.metode_pembayaran as string) === "split_payment"
                          ? (parseInt(formData.nominal_1) || 0) + (parseInt(derivedNominal2) || 0)
                          : serviceTotal
                      ).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Jenis Layanan
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {extraItems.length > 0
                        ? [
                            jenisLayananOptions.find(
                              (opt) => opt.value === formData.jenis_layanan,
                            )?.label || formData.jenis_layanan,
                            ...extraItems.map(
                              (it) =>
                                jenisLayananOptions.find(
                                  (o) => o.value === it.jenis_layanan,
                                )?.label || it.jenis_layanan,
                            ),
                          ].join(" & ")
                        : jenisLayananOptions.find(
                            (opt) => opt.value === formData.jenis_layanan,
                          )?.label}
                    </p>
                    {extraItems.length === 0 && (
                      <div className="mt-1 space-y-0.5">
                        {formData.detail_sku && (
                          <p className="text-[11px] text-gray-500">
                            SKU: {formData.detail_sku}
                          </p>
                        )}
                        <p className="text-[11px] font-semibold text-blue-600">
                          Rp {parseInt(formData.nominal || "0").toLocaleString("id-ID")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Metode Pembayaran
                  </p>
                  {(formData.metode_pembayaran as string) === "split_payment" ? (
                    <div className="mt-1 space-y-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        Split Payment
                      </p>
                      <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">
                            {splitMetodeOptions.find(
                              (o) => o.value === formData.metode_pembayaran_1,
                            )?.label || formData.metode_pembayaran_1}
                          </span>
                          <span className="font-semibold text-blue-600">
                            Rp {(parseInt(formData.nominal_1) || 0).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">
                            {splitMetodeOptions.find(
                              (o) => o.value === formData.metode_pembayaran_2,
                            )?.label || formData.metode_pembayaran_2}
                          </span>
                          <span className="font-semibold text-blue-600">
                            Rp {(parseInt(derivedNominal2) || 0).toLocaleString("id-ID")}
                          </span>
                        </div>
                        <div className="border-t border-gray-200 dark:border-white/10 pt-1 mt-1 flex justify-between text-xs font-bold">
                          <span>Total</span>
                          <span className="text-blue-600">
                            Rp {(
                              (parseInt(formData.nominal_1) || 0) +
                              (parseInt(derivedNominal2) || 0)
                            ).toLocaleString("id-ID")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {
                        metodePembayaranOptions.find(
                          (opt) => opt.value === formData.metode_pembayaran,
                        )?.label
                      }
                    </p>
                  )}
                </div>

                {extraItems.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Detail Layanan
                    </p>
                    {/* Main item */}
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-900">
                          {
                            jenisLayananOptions.find(
                              (o) => o.value === formData.jenis_layanan,
                            )?.label
                          }
                        </span>
                      </div>
                      {formData.detail_sku && (
                        <p className="text-[11px] text-gray-500">
                          SKU: {formData.detail_sku}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Nominal</span>
                        <span className="text-xs font-semibold text-blue-600">
                          Rp {parseInt(formData.nominal || "0").toLocaleString("id-ID")}
                        </span>
                      </div>
                    </div>
                    {extraItems.map((it, i) => (
                      <div
                        key={i}
                        className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-900">
                            {jenisLayananOptions.find(
                              (o) => o.value === it.jenis_layanan,
                            )?.label || it.jenis_layanan}
                          </span>
                        </div>
                        {it.detail_sku && (
                          <p className="text-[11px] text-gray-500">
                            SKU: {it.detail_sku}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">Nominal</span>
                          <span className="text-xs font-semibold text-blue-600">
                            Rp {parseInt(it.nominal || "0").toLocaleString("id-ID")}
                          </span>
                        </div>
                        {it.notes && (
                          <p className="text-[11px] text-gray-400 italic">
                            {it.notes}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
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
                  </>
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
