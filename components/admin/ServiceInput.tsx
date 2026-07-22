"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/stores/authStore";
import { hasDraft, loadDraft, saveDraft, clearDraft, saveDraftTextSync } from "@/lib/draftStorage";
import {
  User,
  Watch,
  Calendar,
  Send,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Settings,
  Battery,
  Cpu,
  Sparkles,
  Camera,
  X,
  Image as ImageIcon,
  Hash,
  Phone,
  Loader2,
  RotateCw,
  Smartphone,
  Circle,
  DollarSign,
  Trash2,
} from "lucide-react";
import { useUpload, compressFiles } from "@/hooks/useUpload";
import CustomerAutocomplete from "@/components/admin/CustomerAutocomplete";
import dynamic from "next/dynamic";

const QRCodeGenerator = dynamic(
  () => import("@/components/admin/QRCodeGenerator"),
  {
    loading: () => (
      <div className="text-center py-4 text-sm text-slate-400">
        Loading QR...
      </div>
    ),
  },
);

// Updated watch movements
const watchMovements = [
  { value: "automatic", label: "AUTOMATIC", icon: Settings },
  { value: "quartz", label: "QUARTZ", icon: Battery },
  { value: "digital", label: "DIGITAL", icon: Settings },
  { value: "analog_digital", label: "ANALOG-DIGITAL", icon: RotateCw },
  { value: "smartwatch", label: "SMARTWATCH", icon: Smartphone },
];

const paymentLabels: Record<string, string> = {
  cash: "Cash",
  qris: "QRIS",
  transfer: "Transfer",
  edc: "EDC",
  edc_bca: "EDC BCA",
  edc_mandiri: "EDC Mandiri",
  tf_bca: "Transfer BCA",
  tf_mandiri: "Transfer Mandiri",
  bri: "BRI",
  kudus: "Kudus",
};

const paymentOptions = Object.entries(paymentLabels).map(([value, label]) => ({ value, label }));

const watchBrands = [
  "ROLEX",
  "OMEGA",
  "TAG HEUER",
  "CASIO",
  "SEIKO",
  "CITIZEN",
  "TISSOT",
  "LONGINES",
  "BREITLING",
  "CARTIER",
  "APPLE WATCH",
  "SAMSUNG WATCH",
  "GARMIN",
  "FOSSIL",
  "SWATCH",
];

const STEP_LABELS = ["Customer", "Watch", "Photos", "Issue"];

export default function ServiceInput({
  variant = "page",
  onClose,
  onSuccess,
}: {
  variant?: "page" | "modal";
  onClose?: () => void;
  onSuccess?: () => void;
}) {
  const supabase = createClient();
  const { user } = useAuthStore();
  const { uploadFile, uploadFiles, uploading, progress } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    cs_name: "",
    cs_phone: "",
    category: "",
    serial_number: "",
    watch_brand: "",
    watch_model: "",
    watch_movement: "",
    problem: "",
    request: "",
    notes: "",
    down_payment: "",
    payment_method: "cash",
    qris_photo: null as File | null,
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<{
    invoice: string;
    token: string;
    serviceId: string;
  } | null>(null);
  const [step, setStep] = useState(1);
  const [estimatedCost, setEstimatedCost] = useState("");
  const [dpTransactions, setDpTransactions] = useState<any[]>([]);
  const [selectedDpId, setSelectedDpId] = useState<string | null>(null);
  const [dpMode, setDpMode] = useState<"manual" | "from_transaction">("manual");
  const [dpSearch, setDpSearch] = useState("");
  const restoredRef = useRef(false);
  const clearingDraft = useRef(false);

  // ── Reset state on mount ─────────────────────────────────────────────────
  useEffect(() => {
    setSuccess(false);
    setStep(1);
    setLastInvoice(null);
    setLoading(false);
    setSelectedDpId(null);
    setDpTransactions([]);
    setDpMode("manual");
  }, []);

  // ── Draft restore ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || restoredRef.current) return;
    (async () => {
      if (!hasDraft("service", user.id)) return;
      const draft = await loadDraft("service", user.id, 1);
      if (draft.data && !restoredRef.current) {
        restoredRef.current = true;
        setFormData((p) => ({ ...p, ...draft.data }));
        if (draft.photoFiles && draft.photoFiles.length > 0) {
          setPhotos(draft.photoFiles);
          setPhotoPreviews(draft.photoFiles.map((f) => URL.createObjectURL(f)));
        }
        if (draft.extraPhotoFiles && draft.extraPhotoFiles.length > 0 && draft.data?.qris_photo !== null) {
          setFormData((p) => ({ ...p, qris_photo: draft.extraPhotoFiles![0] }));
        }
        toast.success("Draft service ditemukan dan dipulihkan", { duration: 3000 });
        saveDraft("service", user.id, draft.data, draft.photoFiles || undefined, draft.extraPhotoFiles || undefined);
      }
    })();
  }, [user?.id]);

  // ── Fetch DP transaksi customer ────────────────────────────────────────
  useEffect(() => {
    if (dpMode !== "from_transaction") return;
    const name = formData.cs_name?.trim();
    const phone = formData.cs_phone?.replace(/\D/g, "");
    if (!name && !phone) return;
    const fetchDp = async () => {
      let query = supabase
        .from("layanan")
        .select("id, nominal, metode_pembayaran, detail_sku, notes, photo_url, created_at, customer_name, customer_whatsapp")
        .in("jenis_layanan", ["dp_service", "DP Service"])
        .is("linked_service_order_id", null)
        .or("dp_applied.is.null,dp_applied.eq.false");
      if (name && phone.length >= 8) {
        query = query.or(`customer_name.ilike.%${name}%,customer_whatsapp.ilike.%${phone}%`);
      } else if (name) {
        query = query.ilike("customer_name", `%${name}%`);
      } else {
        query = query.ilike("customer_whatsapp", `%${phone}%`);
      }
      const { data, error } = await query.order("created_at", { ascending: false }).limit(50);
      if (error) {
        toast.error("Gagal memuat DP: " + error.message);
        return;
      }
      setDpTransactions(data || []);
    };
    fetchDp();
  }, [dpMode, formData.cs_name, formData.cs_phone]);

  // ── Auto-save text segera (sync) ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const d = formData;
    if (d.cs_name || d.cs_phone) saveDraftTextSync("service", user.id, d);
  }, [formData, user?.id]);

  // ── Auto-save foto (debounce 2s) ────────────────────────────────────────
  const photoTimer = useRef<any>(null);
  const latestPhotos = useRef(photos);
  latestPhotos.current = photos;
  useEffect(() => {
    if (!user?.id || photos.length === 0) return;
    if (photoTimer.current) clearTimeout(photoTimer.current);
    photoTimer.current = setTimeout(() => {
      saveDraft("service", user.id, formData, photos, formData.qris_photo ? [formData.qris_photo] : undefined).catch(() => {});
    }, 2000);
    return () => { if (photoTimer.current) clearTimeout(photoTimer.current); };
  }, [photos, user?.id]);

  const generateInvoiceNumber = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    return `WATCH-${y}${m}${day}-${rand}`;
  };

  const generateToken = async () => {
    // Generate a 12-character alphanumeric token
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";

    // Try up to 5 times to generate a unique token
    for (let attempt = 0; attempt < 5; attempt++) {
      token = "";
      for (let i = 0; i < 12; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      // Check if token already exists
      const { data: existing } = await supabase
        .from("service_orders")
        .select("id")
        .eq("token", token)
        .maybeSingle();

      if (!existing) {
        return token; // Token is unique
      }
    }

    // If still no unique token after 5 attempts, use timestamp-based fallback
    return `${token}${Date.now().toString(36).toUpperCase().slice(-4)}`;
  };

  const handleAddPhoto = async (files: FileList | null) => {
    if (!files) return;
    const rawFiles = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name),
    );
    if (rawFiles.length === 0) return;

    setIsCompressing(true);
    setCompressProgress({ done: 0, total: rawFiles.length });

    try {
      const compressed = await compressFiles(rawFiles, (done, total) => {
        setCompressProgress({ done, total });
      });

      if (compressed.length === 0) return;
      setPhotos((prev) => [...prev, ...compressed]);
      compressed.forEach((f) => {
        const url = URL.createObjectURL(f);
        setPhotoPreviews((prev) => [...prev, url]);
      });
    } catch (e: any) {
      toast.error(e.message || 'Gagal memproses foto');
    } finally {
      setIsCompressing(false);
    }
  };

  const removePhoto = (i: number) => {
    URL.revokeObjectURL(photoPreviews[i]);
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
    setPhotoPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const nextStep = () => {
    if (step === 1 && (!formData.cs_name.trim() || !formData.cs_phone.trim())) {
      toast.error("Fill customer name and phone!");
      return;
    }
    if (step === 2 && !formData.watch_brand) {
      toast.error("Fill watch brand!");
      return;
    }
    if (step === 3 && photos.length === 0) {
      toast(
        "No photos added. Teknisi won't have initial condition reference.",
        { icon: "⚠️" },
      );
    }
    setStep((s) => s + 1);
  };

  const prevStep = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    if (!formData.problem.trim()) {
      toast.error("Describe the problem!");
      return;
    }
    setLoading(true);

    try {
      const invoiceNumber = generateInvoiceNumber();
      const token = await generateToken();
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30);

      const dpValue = formData.down_payment
        ? parseInt(formData.down_payment)
        : 0;
      const hasDp = dpValue > 0;

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      const { data: orderData, error } = await supabase
        .from("service_orders")
        .insert([
          {
            invoice_number: invoiceNumber,
            token,
            token_expires_at: tokenExpiresAt.toISOString(),
            customer_name: formData.cs_name,
            customer_phone: formData.cs_phone,
            serial_number: formData.serial_number || null,
            device_type: "smartwatch",
            device_brand: formData.watch_brand,
            device_model: formData.watch_model || null,
            watch_brand: formData.watch_brand,
            watch_model: formData.watch_model || null,
            watch_movement: formData.watch_movement,
            category: formData.category || null,
            down_payment: dpValue,
            payment_method: formData.payment_method || "cash",
            issue_description: formData.problem,
            request: formData.request || null,
            notes: formData.notes || null,
            estimated_cost: estimatedCost ? parseInt(estimatedCost) : null,
            status: "pending",
          },
        ])
        .select("id")
        .single();

      if (error) throw error;

      const serviceId = orderData.id;

      // All photos (initial condition + qris/transfer proof) grouped as one album
      let allPhotosToUpload = [...photos];
      if (
        formData.qris_photo &&
        (formData.payment_method === "qris" ||
          formData.payment_method === "transfer" ||
          formData.payment_method === "edc_mandiri" ||
          formData.payment_method === "edc_bca")
      ) {
        const alreadyInPhotos = photos.some(
          (f) =>
            f.name === formData.qris_photo?.name &&
            f.size === formData.qris_photo?.size,
        );
        if (!alreadyInPhotos) {
          allPhotosToUpload.push(formData.qris_photo);
        }
      }

      if (allPhotosToUpload.length > 0) {
        const now = new Date().toLocaleString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        let formattedCaption = `Kategori : ${formData.category || "—"}
CS :  ${formData.cs_name}
WA : ${formData.cs_phone}
Seri : ${formData.serial_number || "—"}
Brand : ${formData.watch_brand || "—"}
Model : ${formData.watch_model || "—"}
Tipe : ${formData.watch_movement ? formData.watch_movement.toUpperCase() : "—"}
Kendala : ${formData.problem}
Request : ${formData.request || "—"}
Keterangan : ${formData.notes || "—"}`;

        if (hasDp) {
          formattedCaption += `
dp : Rp ${dpValue.toLocaleString("id-ID")}`;
          if (estimatedCost) {
            formattedCaption += `
estimasi : Rp ${parseInt(estimatedCost).toLocaleString("id-ID")}`;
          }
          formattedCaption += `
Pembayaran : ${paymentLabels[formData.payment_method] || formData.payment_method}`;
        } else if (estimatedCost) {
          formattedCaption += `
estimasi : Rp ${parseInt(estimatedCost).toLocaleString("id-ID")}`;
        }

        formattedCaption += `
In : ${now}`;

        const urls = await uploadFiles(allPhotosToUpload, {
          type: "service",
          caption: formattedCaption,
        });

        const authUserForDoc = (await supabase.auth.getUser()).data.user;
        const docInserts = urls.map((r) => ({
          service_order_id: serviceId,
          photo_url: r.url,
          stage: "initial_condition",
          uploaded_by: authUserForDoc?.id,
          telegram_chat_id: r.chat_id,
          telegram_message_id: r.message_id,
        }));
        if (docInserts.length > 0) {
          await supabase.from("service_documentation").insert(docInserts);
        }

        if (urls.length === 0 && allPhotosToUpload.length > 0) {
          throw new Error("Upload foto gagal, transaksi DP dibatalkan");
        }
      }

      // Link existing DP transaction (from manual DP Service input)
      if (selectedDpId) {
        const selectedDp = dpTransactions.find((d) => d.id === selectedDpId);
        await supabase
          .from("layanan")
          .update({ linked_service_order_id: serviceId })
          .eq("id", selectedDpId);
        // Copy DP photo to service_documentation if exists
        if (selectedDp?.photo_url) {
          await supabase.from("service_documentation").insert({
            service_order_id: serviceId,
            photo_url: selectedDp.photo_url,
            stage: "initial_condition",
            uploaded_by: authUser?.id,
          });
        }
      }

      // Auto-add DP transaction if DP > 0 (only if not linked)
      if (hasDp && dpValue > 0 && !selectedDpId) {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("id", authUser?.id)
          .single();

        // Upload DP proof photo directly to layanan channel (2nd send: transaction photo + caption = 1 chat)
        let dpPhotoUrl = null;
        let dpTelegramSent = false;
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

        const dpDescription = `📊 TRANSAKSI

💳 tipe : dp service
📱 Customer: ${formData.cs_name}
📞 WA: ${formData.cs_phone}
💰 Nominal: Rp ${dpValue.toLocaleString("id-ID")}
💳 Metode: ${paymentLabels[formData.payment_method] || formData.payment_method}
📋 Invoice: ${invoiceNumber}
📝 Keterangan: Down Payment
👤 Operator: ${userProfile?.full_name || "System"}
⏰ ${fmtDateTime}
`;

        if (
          formData.qris_photo &&
          (formData.payment_method === "qris" ||
            formData.payment_method === "transfer" ||
            formData.payment_method === "edc_mandiri" ||
            formData.payment_method === "edc_bca")
        ) {
          try {
            const dpPhotoUrls = await uploadFiles([formData.qris_photo], {
              type: "layanan",
              caption: dpDescription,
            });
            dpPhotoUrl = dpPhotoUrls?.[0] || null;
            dpTelegramSent = true;
          } catch (photoErr) {
            console.error(
              "Failed to upload DP photo to transaction:",
              photoErr,
            );
          }
        }

        if (!dpTelegramSent) {
          // Fallback: send text-only notification for Cash DP (no photo)
          try {
            await fetch("/api/telegram", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "transaction",
                message: dpDescription,
              }),
            });
          } catch (telegramErr) {
            console.error("Failed to send DP text to telegram:", telegramErr);
          }
        }

        // Insert DP transaction
        const { data: dpTransaction } = await supabase
          .from("layanan")
          .insert([
            {
              customer_name: formData.cs_name,
              customer_whatsapp: formData.cs_phone,
              jenis_layanan: "dp_service",
              handled_by: authUser?.id,
              handled_by_name: userProfile?.full_name || "System",
              metode_pembayaran: formData.payment_method || "cash",
              lead_source: "service_order",
              detail_sku: `DP - Invoice ${invoiceNumber}`,
              nominal: dpValue,
              notes: `Down Payment untuk service order ${invoiceNumber}`,
              photo_url: dpPhotoUrl,
              photo_urls: dpPhotoUrl ? [dpPhotoUrl] : [],
              created_by: authUser?.id,
              created_by_name: userProfile?.full_name || "System",
              status: "active",
            },
          ])
          .select("id")
          .single();

        // Auto-refresh: trigger fetchAllData via custom event
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("new-transaction"));
        }
      }

      if (user?.id) { clearingDraft.current = true; clearDraft("service", user.id); }
      restoredRef.current = false;
      setLastInvoice({ invoice: invoiceNumber, token, serviceId });
      setSuccess(true);
      setStep(5);
      toast.success("Watch service order created!");
      onSuccess?.();

      // Save to customers table + notify Telegram if new
      try {
        const custPhone = (formData.cs_phone || "").replace(/\D/g, "");
        if (formData.cs_name && custPhone) {
          const last4 = custPhone.slice(-4);
          const rawName = formData.cs_name.trim().replace(/^CS\s*/i, "");
          const baseName = rawName.endsWith(` ${last4}`) ? rawName : `${rawName} ${last4}`;
          const custName = baseName.startsWith("CS ") ? baseName : `CS ${baseName}`;
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
    } catch (err: any) {
      // Handle unique constraint violation for token
      if (err.code === "23505" && err.message.includes("token")) {
        toast.error("Token conflict. Please try again.");
      } else {
        toast.error(err.message || "Failed to create order");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    photoPreviews.forEach((url) => URL.revokeObjectURL(url));
    setFormData({
      cs_name: "",
      cs_phone: "",
      category: "",
      serial_number: "",
      watch_brand: "",
      watch_model: "",
      watch_movement: "",
      problem: "",
      request: "",
      notes: "",
      down_payment: "",
      payment_method: "cash",
      qris_photo: null,
    });
    setPhotos([]);
    setPhotoPreviews([]);
    setIsCompressing(false);
    setCompressProgress({ done: 0, total: 0 });
    setSuccess(false);
    setStep(1);
    setLastInvoice(null);
    setSelectedDpId(null);
    setDpTransactions([]);
  };

  return (
    <div
      className={`overflow-x-hidden ${variant === "modal" ? "" : "max-w-3xl mx-auto py-3 sm:py-4 px-0 sm:px-4"}`}
    >
      {variant === "modal" && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors z-10"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}
      {variant === "page" && (
        <div className="flex items-center gap-3 mb-4 sm:mb-6 px-4 sm:px-0">
          <div className="w-10 h-10 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center flex-shrink-0">
            <Watch className="w-5 h-5 text-white dark:text-gray-900" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
              New Watch Service
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 truncate">
              Create service order for timepiece
            </p>
          </div>
          {user?.id && hasDraft("service", user.id) && (
            <button
              type="button"
              onClick={() => {
                clearDraft("service", user.id);
                restoredRef.current = false;
                photoPreviews.forEach((url) => URL.revokeObjectURL(url));
                setFormData({
                  cs_name: "", cs_phone: "", category: "", serial_number: "",
                  watch_brand: "", watch_model: "", watch_movement: "", problem: "",
                  request: "", notes: "", down_payment: "", payment_method: "cash", qris_photo: null,
                });
                setPhotos([]);
                setPhotoPreviews([]);
                setStep(1);
                toast.success("Draft berhasil dihapus", { duration: 2000 });
              }}
              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Hapus draft"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {variant === "modal" && user?.id && hasDraft("service", user.id) && (
        <div className="flex justify-end px-4 pt-2">
          <button
            type="button"
            onClick={() => {
              clearDraft("service", user.id);
              restoredRef.current = false;
              photoPreviews.forEach((url) => URL.revokeObjectURL(url));
              setFormData({
                cs_name: "", cs_phone: "", category: "", serial_number: "",
                watch_brand: "", watch_model: "", watch_movement: "", problem: "",
                request: "", notes: "", down_payment: "", payment_method: "cash", qris_photo: null,
              });
              setPhotos([]);
              setPhotoPreviews([]);
              setStep(1);
              toast.success("Draft berhasil dihapus", { duration: 2000 });
            }}
            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 px-2 py-1"
          >
            <Trash2 className="w-3 h-3" /> Hapus Draft
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ── STEP 1: Customer ─────────────────────────────────────────── */}
        {step === 1 && (
          <motion.div
            key="s1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-[24px] border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200 dark:border-white/10">
              <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Customer Information
              </h3>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">
                1/5
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <CustomerAutocomplete
                  value={formData.cs_name}
                  onChange={(val) =>
                    setFormData((p) => ({ ...p, cs_name: val }))
                  }
                  onSelect={(name, phone) =>
                    setFormData((p) => ({
                      ...p,
                      cs_name: name,
                      cs_phone: phone,
                    }))
                  }
                  placeholder="John Doe"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  WhatsApp / Phone <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/1 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="tel"
                    value={formData.cs_phone}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        cs_phone: e.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-gray-900 dark:focus:border-white focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 transition-all text-sm dark:text-gray-100"
                    placeholder="81234567890"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Serial Number
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/1 w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    value={formData.serial_number}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        serial_number: e.target.value,
                      }))
                    }
                    className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-gray-900 dark:focus:border-white focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 transition-all text-sm dark:text-gray-100"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={nextStep}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all text-sm font-medium"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 2: Watch Details ─────────────────────────────────────── */}
        {step === 2 && (
          <motion.div
            key="s2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-[24px] border border-gray-200 dark:border-white/10 p-4 sm:p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200 dark:border-white/10">
              <Watch className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                Watch Details
              </h3>
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">
                2/5
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Brand <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="watchBrandsList"
                  value={formData.watch_brand}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      watch_brand: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-gray-900 dark:focus:border-white focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 transition-all text-sm uppercase dark:text-gray-100"
                  placeholder="ROLEX, OMEGA, CASIO..."
                />
                <datalist id="watchBrandsList">
                  {watchBrands.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Model
                </label>
                <input
                  type="text"
                  value={formData.watch_model}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      watch_model: e.target.value.toUpperCase(),
                    }))
                  }
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-gray-900 dark:focus:border-white focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 transition-all text-sm uppercase dark:text-gray-100"
                  placeholder="SUBMARINER, SPEEDMASTER..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Tipe Jam <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {watchMovements.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({ ...p, watch_movement: m.value }))
                      }
                      className={`py-3 text-xs font-medium rounded-xl border transition-all flex flex-col items-center gap-1.5 ${
                        formData.watch_movement === m.value
                          ? "border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                          : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#1c1c1c] text-gray-600 dark:text-gray-400 hover:border-gray-900 dark:hover:border-white"
                      }`}
                    >
                      <m.icon className="w-5 h-5" />
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
                  Category / Kategori
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, category: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl focus:outline-none focus:border-gray-900 dark:focus:border-white focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10 transition-all text-sm dark:text-gray-100"
                  placeholder="e.g. Ganti Battery, Service Ringkas..."
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 sm:gap-0 mt-4 sm:mt-6">
              <button
                onClick={prevStep}
                className="w-full sm:w-auto px-5 py-2.5 bg-white dark:bg-[#1c1c1c] text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={nextStep}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-all text-sm font-medium"
              >
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Photos ───────────────────────────────────────────── */}
        {step === 3 && (
          <motion.div
            key="s3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-[24px] border border-[#4DB2FF]/20 p-4 sm:p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#4DB2FF]/20">
              <Camera className="w-4 h-4 text-[#4DB2FF]" />
              <h3 className="font-semibold text-slate-900">
                Initial Condition Photos
              </h3>
              <span className="ml-auto text-xs text-slate-400 font-medium">
                3/5
              </span>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              Photos of the watch before service. Teknisi will use this as
              reference.
            </p>

            {/* Photo Grid */}
            {photoPreviews.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
                {photoPreviews.map((src, i) => (
                  <div
                    key={i}
                    className="relative group border border-slate-200 rounded-lg overflow-hidden"
                  >
                    <img
                      src={src}
                      alt={`Foto ${i + 1}`}
                      className="w-full h-28 object-cover"
                    />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1.5 right-1.5 bg-white p-1 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-slate-600" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Compression Loading Indicator */}
            {isCompressing && (
              <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-700">
                  Mengompresi foto ({compressProgress.done}/{compressProgress.total})...
                </span>
              </div>
            )}

            {/* Upload Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isCompressing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                Take Photo
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium text-slate-900 disabled:opacity-50"
              >
                <ImageIcon className="w-4 h-4" />
                Upload from Gallery
              </button>
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={(e) => handleAddPhoto(e.target.files)}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleAddPhoto(e.target.files)}
                className="hidden"
              />
            </div>

            <p className="text-xs text-slate-400 mt-3">
              {isCompressing
                ? "Processing..."
                : photos.length > 0
                  ? `${photos.length} photos selected`
                  : "Optional — can be skipped"}
            </p>

            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="px-5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={nextStep}
                disabled={isCompressing}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium disabled:opacity-50"
              >
                {photos.length === 0 ? "Skip →" : "Continue →"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 4: Issue + Estimasi Biaya ─────────────────────────── */}
        {step === 4 && (
          <motion.div
            key="s4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-[24px] border border-[#4DB2FF]/20 p-4 sm:p-6 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[#4DB2FF]/20">
              <AlertCircle className="w-4 h-4 text-[#4DB2FF]" />
              <h3 className="font-semibold text-slate-900">Service Issue</h3>
              <span className="ml-auto text-xs text-slate-400 font-medium">
                4/5
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Problem / Kendala <span className="text-emerald-600">*</span>
                </label>
                <textarea
                  value={formData.problem}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, problem: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all resize-none text-sm"
                  placeholder="Describe the watch issue in detail..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Customer Request
                </label>
                <textarea
                  value={formData.request}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, request: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all resize-none text-sm"
                  placeholder="Special requests from customer..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Additional Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, notes: e.target.value }))
                  }
                  rows={2}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all resize-none text-sm"
                  placeholder="Any additional notes..."
                />
              </div>

              {/* Estimasi Biaya */}
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Estimasi Biaya (opsional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                    Rp
                  </span>
                  <input
                    type="text"
                    value={estimatedCost}
                    onChange={(e) =>
                      setEstimatedCost(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder="0"
                    className="w-full pl-10 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {dpMode === "from_transaction" && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setDpMode("manual")}>
                  <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-hidden shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                      <h3 className="text-sm font-bold text-slate-900">Pilih DP dari Transaksi</h3>
                      <button type="button" onClick={() => setDpMode("manual")} className="p-1 hover:bg-slate-100 rounded-lg">
                        <X className="w-4 h-4 text-slate-400" />
                      </button>
                    </div>
                    <div className="p-3 border-b border-slate-200">
                      <input
                        type="text"
                        value={dpSearch}
                        onChange={(e) => setDpSearch(e.target.value)}
                        placeholder="Cari transaksi DP..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all"
                      />
                    </div>
                    <div className="p-4 space-y-2 overflow-y-auto max-h-[calc(80vh-130px)]">
                      {dpTransactions.length === 0 ? (
                        <p className="text-sm text-slate-400 text-center py-8">
                          Tidak ada transaksi DP ditemukan
                        </p>
                      ) : (
                        dpTransactions.filter((dp) => {
                          if (!dpSearch.trim()) return true;
                          const q = dpSearch.toLowerCase();
                          return (
                            (dp.nominal?.toString() || "").includes(q) ||
                            (dp.detail_sku || "").toLowerCase().includes(q) ||
                            (dp.customer_name || "").toLowerCase().includes(q) ||
                            (dp.customer_whatsapp || "").includes(q)
                          );
                        }).map((dp) => (
                          <button
                            key={dp.id}
                            type="button"
                            onClick={() => {
                              setSelectedDpId(dp.id);
                              setFormData((p) => ({
                                ...p,
                                down_payment: String(dp.nominal || 0),
                                payment_method: dp.metode_pembayaran || "cash",
                              }));
                              setDpSearch("");
                              setDpMode("manual");
                            }}
                            className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-sm transition-all ${
                              selectedDpId === dp.id
                                ? "border-emerald-500 bg-emerald-50"
                                : "border-slate-200 bg-white hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">
                                Rp {Number(dp.nominal).toLocaleString("id-ID")}
                              </p>
                              <p className="text-[11px] text-slate-700 truncate mt-0.5">
                                {dp.customer_name || "-"} — {dp.customer_whatsapp || "-"}
                              </p>
                              {dp.detail_sku && (
                                <p className="text-[11px] text-slate-400 truncate">
                                  {dp.detail_sku}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {new Date(dp.created_at).toLocaleDateString("id-ID")}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Down Payment (DP)
                </label>
                <div className="flex gap-2 items-start">
                  {dpMode === "manual" && !selectedDpId ? (
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formData.down_payment}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        setFormData((p) => ({ ...p, down_payment: raw }));
                        setSelectedDpId(null);
                      }}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                      placeholder="0"
                    />
                  </div>
                  ) : selectedDpId ? (
                    <div className="flex-1 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-emerald-700">
                          Rp {Number(formData.down_payment).toLocaleString("id-ID")}
                        </p>
                        <p className="text-xs text-emerald-600">
                          {paymentLabels[formData.payment_method] || formData.payment_method}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDpId(null);
                          setFormData((p) => ({ ...p, down_payment: "", payment_method: "cash" }));
                        }}
                        className="text-xs text-emerald-700 underline hover:text-emerald-900"
                      >
                        Ganti
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-xs text-slate-400">Pilih transaksi DP melalui tombol di samping</p>
                    </div>
                  )}
                  <select
                    value={dpMode}
                    onChange={(e) => {
                      const mode = e.target.value as "manual" | "from_transaction";
                      setDpMode(mode);
                      setDpSearch("");
                      if (mode === "from_transaction") {
                        setSelectedDpId(null);
                        setFormData((p) => ({ ...p, down_payment: "", payment_method: "cash" }));
                      }
                    }}
                    className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                  >
                    <option value="manual">Manual</option>
                    <option value="from_transaction">Pilih dari Transaksi</option>
                  </select>
                </div>
              </div>

              {dpMode === "manual" && !selectedDpId && (
                <>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                  Metode Pembayaran
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, payment_method: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                >
                  {paymentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {(formData.payment_method === "qris" ||
                formData.payment_method === "transfer" ||
                formData.payment_method === "edc_mandiri" ||
                formData.payment_method === "edc_bca") && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
                    Foto Bukti Pembayaran{" "}
                    <span className="text-emerald-600">*</span>
                  </label>
                  <div
                    onClick={() =>
                      document.getElementById("qris-photo-input")?.click()
                    }
                    className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-slate-900 transition-all"
                  >
                    {formData.qris_photo ? (
                      <div className="flex items-center gap-3">
                        <ImageIcon className="w-8 h-8 text-green-500" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-900">
                            {formData.qris_photo.name}
                          </p>
                          <p className="text-xs text-slate-400">
                            Klik untuk ganti
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-500">
                          Klik untuk upload bukti {paymentLabels[formData.payment_method] || formData.payment_method}
                        </p>
                      </div>
                    )}
                    <input
                      id="qris-photo-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormData((p) => ({ ...p, qris_photo: file }));
                        }
                      }}
                    />
                  </div>
                </div>
              )}
                </>
              )}

              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Summary
                </p>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-medium text-slate-900">
                    {formData.cs_name || "—"}
                  </span>
                  <span className="text-slate-500">Watch:</span>
                  <span className="font-medium text-slate-900">
                    {[formData.watch_brand, formData.watch_model]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </span>
                  <span className="text-slate-500">Movement:</span>
                  <span className="font-medium text-slate-900 uppercase">
                    {formData.watch_movement || "—"}
                  </span>
                  <span className="text-slate-500">Category:</span>
                  <span className="font-medium text-slate-900">
                    {formData.category || "—"}
                  </span>
                  {formData.down_payment && (
                    <>
                      <span className="text-slate-500">Down Payment:</span>
                      <span className="font-medium text-slate-900">
                        Rp{" "}
                        {Number(formData.down_payment).toLocaleString("id-ID")}
                      </span>
                      <span className="text-slate-500">Pembayaran:</span>
                      <span className="font-medium text-slate-900">
                        {paymentLabels[formData.payment_method] || formData.payment_method}
                      </span>
                    </>
                  )}
                  <span className="text-slate-500">Photos:</span>
                  <span className="font-medium text-slate-900">
                    {photos.length} photos
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-between mt-6">
              <button
                onClick={prevStep}
                className="px-5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-sm font-medium disabled:opacity-50"
              >
                {loading || uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {uploading ? `Uploading ${progress}%` : "Creating..."}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Create Order
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 5: Success ───────────────────────────────────────────── */}
        {step === 5 && success && lastInvoice && (
          <motion.div
            key="s5"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm"
          >
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-white" />
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-1">
              Order Created!
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Watch service order has been created
              {photos.length > 0 &&
                ` with ${photos.length} initial condition photos`}
              .
            </p>

            <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left border border-slate-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Invoice
                  </p>
                  <p className="text-lg font-mono font-bold text-slate-900">
                    {lastInvoice.invoice}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">
                    Token
                  </p>
                  <p className="text-lg font-mono font-bold text-emerald-600">
                    {lastInvoice.token}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <QRCodeGenerator
                invoiceNumber={lastInvoice.invoice}
                token={lastInvoice.token}
                customerName={formData.cs_name}
                customerPhone={formData.cs_phone}
              />
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={resetForm}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
              >
                New Order
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(lastInvoice.token);
                  toast.success("Token copied!");
                }}
                className="px-5 py-2.5 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
              >
                Copy Token
              </button>
              <button
                onClick={() => {
                  window.open(`/tracking/${lastInvoice.token}`, "_blank");
                }}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all text-sm font-medium"
              >
                Open Tracking
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload progress */}
      {uploading && (
        <div className="fixed bottom-4 right-4 bg-white rounded-lg border border-slate-200 shadow-lg p-4 w-64 z-50">
          <p className="text-xs font-medium text-slate-900 mb-2">
            Uploading photos...
          </p>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1.5">{progress}% complete</p>
        </div>
      )}
    </div>
  );
}
