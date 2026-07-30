"use client";

import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useCentralUpload } from "@/hooks/useCentralUpload";
import {
  jenisLayananLabels,
  metodePembayaranLabels,
} from "@/lib/domain/transaction/enums";
import type {
  TransactionServiceItem,
  SKUItem,
  TransactionData,
} from "@/lib/domain/transaction/types";
import type {
  JenisLayanan,
  MetodePembayaran,
  LeadSource,
} from "@/lib/domain/transaction/enums";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import { validateTransaction } from "@/lib/domain/shared/validation";
import {
  calculateTransactionTotal,
  calculateItemSubtotal,
  serializeSKUs,
  parseSKUs,
  syncCustomer,
} from "@/lib/domain/transaction/service";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
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
import { useTransactionStore } from "@/stores/transaction-store";

interface LayananFormProps {
  onSuccess?: () => void;
  onClose?: () => void;
  initialData?: any;
}

const jenisLayananOptions = [
  { value: "service_langsung", label: "Service Langsung" },
  { value: "ambil_jam_service", label: "Ambil Jam Service" },
  { value: "order_online", label: "Order Online" },
  { value: "beli_jam", label: "Beli Jam" },
  { value: "custom_strap", label: "Custom Strap" },
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
  const [uploadKey] = useState(() => `layanan_${user?.id || 'anon'}_${Date.now()}`)
  const upload = useCentralUpload(uploadKey);
  const createTx = useTransactionStore((s) => s.create);
  const updateTx = useTransactionStore((s) => s.update);

  const [customerName, setCustomerName] = useState(
    initialData?.customer_name || "",
  );
  const [customerWhatsapp, setCustomerWhatsapp] = useState(
    initialData?.customer_whatsapp || "",
  );
  const [handledBy, setHandledBy] = useState(
    initialData?.handled_by || user?.id || "",
  );
  const [metodePembayaran, setMetodePembayaran] = useState<string>(
    initialData?.metode_pembayaran || "cash",
  );
  const [leadSource, setLeadSource] = useState<string>(
    initialData?.lead_source || "instagram",
  );
  const [leadSourceCustom, setLeadSourceCustom] = useState(
    initialData?.lead_source_custom || "",
  );
  const [notes, setNotes] = useState(initialData?.notes || "");

  const [items, setItems] = useState<TransactionServiceItem[]>(() => {
    if (initialData?.items) return initialData.items;
    if (initialData?.id) {
      const mapped = [];
      const mainJenis = initialData.jenis_layanan;
      if (
        mainJenis &&
        mainJenis !== "pengeluaran" &&
        mainJenis !== "cashdraw"
      ) {
        const mainSkus = parseSKUs(initialData.detail_sku, initialData.nominal);
        mapped.push({
          jenis_layanan: mainJenis,
          skus: mainSkus,
          notes: initialData.notes || "",
        });
      }
      if (Array.isArray(initialData.layanan_items)) {
        for (const li of initialData.layanan_items) {
          const existing = mapped.find(
            (i) => i.jenis_layanan === li.jenis_layanan,
          );
          if (existing) {
            existing.skus.push(...parseSKUs(li.detail_sku, li.nominal));
          } else {
            mapped.push({
              jenis_layanan: li.jenis_layanan,
              skus: parseSKUs(li.detail_sku, li.nominal),
              notes: li.notes || "",
            });
          }
        }
      }
      return mapped;
    }
    return [
      {
        jenis_layanan: "service_langsung",
        skus: [{ sku: "", nominal: 0 }],
        notes: "",
      },
    ];
  });

  const [splitPayment, setSplitPayment] = useState({
    enabled: initialData?.split_payment || false,
    metode_1: initialData?.metode_pembayaran_1 || "cash",
    nominal_1: initialData?.nominal_1?.toString() || "",
    metode_2: initialData?.metode_pembayaran_2 || "qris",
    nominal_2: initialData?.nominal_2?.toString() || "",
  });

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showOtherHandler, setShowOtherHandler] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>(() => {
    if (initialData?.photo_urls?.length) return initialData.photo_urls;
    if (initialData?.photo_url) return [initialData.photo_url];
    return [];
  });
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState({
    done: 0,
    total: 0,
  });
  const [showPhotoSource, setShowPhotoSource] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const restoredRef = useRef(false);
  const clearingDraft = useRef(false);
  const [errors, setErrors] = useState<string[]>([]);

  const showCustomLeadSource = leadSource === "tulis_sendiri";

  const total = useMemo(() => calculateTransactionTotal(items), [items]);

  const derivedNominal2 = useMemo(() => {
    if (metodePembayaran !== "split_payment") return splitPayment.nominal_2;
    const n1 = parseInt(splitPayment.nominal_1) || 0;
    return Math.max(0, total - n1).toString();
  }, [metodePembayaran, splitPayment.nominal_1, total]);

  const addItem = useCallback(() => {
    setItems((prev) => [
      ...prev,
      {
        jenis_layanan: "service_langsung" as JenisLayanan,
        skus: [{ sku: "", nominal: 0 }],
        notes: "",
      },
    ]);
  }, []);

  const removeItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateItemJenis = useCallback((idx: number, jenis: string) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, jenis_layanan: jenis as JenisLayanan } : item,
      ),
    );
  }, []);

  const updateItemNotes = useCallback((idx: number, notes: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, notes } : item)),
    );
  }, []);

  const addSku = useCallback((itemIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx
          ? { ...item, skus: [...item.skus, { sku: "", nominal: 0 }] }
          : item,
      ),
    );
  }, []);

  const removeSku = useCallback((itemIdx: number, skuIdx: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === itemIdx
          ? { ...item, skus: item.skus.filter((_, j) => j !== skuIdx) }
          : item,
      ),
    );
  }, []);

  const updateSku = useCallback(
    (itemIdx: number, skuIdx: number, field: keyof SKUItem, value: string) => {
      setItems((prev) =>
        prev.map((item, i) =>
          i === itemIdx
            ? {
                ...item,
                skus: item.skus.map((sku, j) =>
                  j === skuIdx
                    ? {
                        ...sku,
                        [field]:
                          field === "nominal"
                            ? parseInt(value.replace(/\D/g, "")) || 0
                            : value,
                      }
                    : sku,
                ),
              }
            : item,
        ),
      );
    },
    [],
  );

  const handleCancel = useCallback(() => {
    if (!initialData && user?.id) {
      clearingDraft.current = true;
      clearDraft("layanan", user.id);
    }
    restoredRef.current = false;
    onClose?.();
  }, [initialData, user?.id, onClose]);

  useEffect(() => {
    if (initialData || !user?.id || restoredRef.current) return;
    const checkDraft = async () => {
      if (!hasDraft("layanan", user.id)) return;
      const draft = await loadDraft("layanan", user.id);
      if (draft.data && !restoredRef.current) {
        restoredRef.current = true;
        if (draft.data.customer_name) setCustomerName(draft.data.customer_name);
        if (draft.data.customer_whatsapp)
          setCustomerWhatsapp(draft.data.customer_whatsapp);
        if (draft.data.items) setItems(draft.data.items);
        if (draft.photoFiles?.length) {
          const result = await upload.addFiles(draft.photoFiles);
          if (result.files.length > 0) {
            setPhotoPreviews((prev) => [...prev, ...result.files.map(f => f.preview)]);
          }
        }
        toast.success("Draft transaksi ditemukan dan dipulihkan", {
          duration: 3000,
        });
      }
    };
    checkDraft();
  }, [user?.id]);

  useEffect(() => {
    if (initialData || !user?.id) return;
    const d = {
      customer_name: customerName,
      customer_whatsapp: customerWhatsapp,
      items,
      lead_source: leadSource,
      lead_source_custom: leadSourceCustom,
      notes,
    };
    if (customerName || items.length > 0) {
      saveDraftTextSync("layanan", user.id, d);
    }
  }, [
    customerName,
    customerWhatsapp,
    items,
    leadSource,
    leadSourceCustom,
    notes,
    user?.id,
  ]);

  const photoTimer = useRef<any>(null);
  useEffect(() => {
    const draftFiles = upload.pendingFiles.filter(f => f.status === 'ready').map(f => f.file);
    if (initialData || !user?.id || draftFiles.length === 0) return;
    if (photoTimer.current) clearTimeout(photoTimer.current);
    photoTimer.current = setTimeout(() => {
      const d = {
        customer_name: customerName,
        customer_whatsapp: customerWhatsapp,
        items,
        lead_source: leadSource,
        lead_source_custom: leadSourceCustom,
        notes,
      };
      saveDraft("layanan", user.id, d, draftFiles).catch(() => {});
    }, 2000);
    return () => {
      if (photoTimer.current) clearTimeout(photoTimer.current);
    };
  }, [upload.pendingFiles, user?.id]);

  useEffect(() => {
    const t = setTimeout(() => fetchUsers(), 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (user?.id && !handledBy) setHandledBy(user.id);
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
    const rawFiles = Array.from(e.target.files || []).filter(
      (f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name),
    );
    if (!rawFiles.length) return;
    console.log('[DEBUG:LayananForm] handlePhotoSelect BEFORE addFiles', {
      rawFiles_count: rawFiles.length,
      rawFiles_names: rawFiles.map(f => f.name),
      upload_pendingFiles_len_before: upload.pendingFiles.length,
    });
    const result = await upload.addFiles(rawFiles);
    console.log('[DEBUG:LayananForm] handlePhotoSelect AFTER addFiles', {
      result_files_count: result.files.length,
      result_errors: result.errors,
      upload_pendingFiles_len_after: upload.pendingFiles.length,
    });
    if (result.files.length > 0) {
      setPhotoPreviews((prev) => [...prev, ...result.files.map(f => f.preview)]);
    }
    if (result.errors.length > 0) {
      result.errors.forEach(e => toast.error(e));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = async (idx: number) => {
    const url = photoPreviews[idx];
    const isBlob = url.startsWith('blob:');
    if (isBlob) {
      const pending = upload.pendingFiles.find(f => f.preview === url);
      if (pending) await upload.removeFile(pending.id);
    } else {
      URL.revokeObjectURL(url);
    }
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const validationErrors = validateTransaction({
      customer_name: customerName,
      customer_whatsapp: customerWhatsapp,
      items,
      handled_by: handledBy,
    });

    if (
      upload.pendingFiles.length === 0 &&
      photoPreviews.length === 0 &&
      !initialData?.id
    ) {
      validationErrors.push({
        field: "photo",
        message: "Wajib upload minimal 1 foto",
      });
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors.map((e) => e.message));
      toast.error(validationErrors[0].message);
      return;
    }

    if (metodePembayaran === "split_payment") {
      const paymentTotal =
        (parseInt(splitPayment.nominal_1) || 0) +
        (parseInt(derivedNominal2) || 0);
      if (paymentTotal !== total) {
        toast.error(
          `Total pembayaran (${formatRupiah(paymentTotal)}) harus sama dengan total (${formatRupiah(total)})`,
        );
        return;
      }
    }

    setShowConfirmation(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmation(false);
    setLoading(true);
    try {
      const selectedUser = users.find((u) => u.id === handledBy);

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

      const allJenisLabels = items.map(
        (item) =>
          jenisLayananOptions.find((o) => o.value === item.jenis_layanan)
            ?.label || item.jenis_layanan,
      );
      const metodeLabel =
        metodePembayaranOptions.find((o) => o.value === metodePembayaran)
          ?.label || metodePembayaran;
      const allSkusForCaption = items
        .flatMap((item) => item.skus.map((s) => s.sku))
        .filter(Boolean)
        .join(", ");
      const allNotesForCaption = items
        .map((item) => item.notes)
        .filter(Boolean)
        .join("; ");

      const mainCaption = [
        "📊 TRANSAKSI",
        "",
        `🔧 tipe : ${allJenisLabels.join(" & ")}`,
        `📱 Customer: ${customerName}`,
        `📞 WA: ${customerWhatsapp}`,
        metodePembayaran === "split_payment"
          ? `💳 SPLIT PAYMENT\n  ► ${splitMetodeOptions.find((o) => o.value === splitPayment.metode_1)?.label || splitPayment.metode_1}: Rp ${(parseInt(splitPayment.nominal_1) || 0).toLocaleString("id-ID")}\n  ► ${splitMetodeOptions.find((o) => o.value === splitPayment.metode_2)?.label || splitPayment.metode_2}: Rp ${(parseInt(derivedNominal2) || 0).toLocaleString("id-ID")}\n  💰 Total: Rp ${total.toLocaleString("id-ID")}`
          : `💰 Nominal: Rp ${total.toLocaleString("id-ID")}\n💳 Metode: ${metodeLabel}`,
        allSkusForCaption ? `\n📋 SKU: ${allSkusForCaption}` : "",
        allNotesForCaption ? `\n📝 Keterangan: ${allNotesForCaption}` : "",
        `\n👤 Operator: ${selectedUser?.full_name || user?.full_name}`,
        `\n⏰ ${fmtDateTime}`,
      ].join("\n");

      let photoUrls: string[] = photoPreviews.filter((p) =>
        p.startsWith("http"),
      );
      let tgChatId: string | undefined;
      let tgMessageId: number | undefined;

      const isEdit = !!initialData?.id;

      const pendingFiles = upload.pendingFiles.filter(f => f.status === 'ready');
      const hasNewFiles = pendingFiles.length > 0;
      console.log('[DEBUG:LayananForm] handleConfirmSubmit hasNewFiles check', {
        upload_pendingFiles_total: upload.pendingFiles.length,
        ready_count: pendingFiles.length,
        hasNewFiles,
        file_statuses: upload.pendingFiles.map(f => ({ id: f.id, name: f.name, status: f.status })),
        sessionKey: uploadKey,
      });

      // STEP 1: Simpan transaksi dulu (instant, <500ms)
      let newTxId: string | undefined;
      if (isEdit) {
        await updateTx(initialData.id, {
          customer_name: customerName.trim(),
          customer_whatsapp: customerWhatsapp.trim(),
          items,
          handled_by: handledBy,
          handled_by_name: selectedUser?.full_name || user?.full_name,
          metode_pembayaran: metodePembayaran as MetodePembayaran,
          lead_source: leadSource as LeadSource,
          lead_source_custom:
            leadSource === "tulis_sendiri" ? leadSourceCustom : null,
          notes,
          photo_urls: photoUrls,
          split_payment: metodePembayaran === "split_payment",
          metode_pembayaran_1:
            metodePembayaran === "split_payment"
              ? splitPayment.metode_1
              : undefined,
          nominal_1:
            metodePembayaran === "split_payment"
              ? parseInt(splitPayment.nominal_1) || 0
              : undefined,
          metode_pembayaran_2:
            metodePembayaran === "split_payment"
              ? splitPayment.metode_2
              : undefined,
          nominal_2:
            metodePembayaran === "split_payment"
              ? parseInt(derivedNominal2) || 0
              : undefined,
        });
        toast.success("Transaksi berhasil diubah!");
      } else {
        const txData: TransactionData = {
          customer_name: customerName.trim(),
          customer_whatsapp: customerWhatsapp.trim(),
          items,
          status: "active",
          handled_by: handledBy,
          handled_by_name: selectedUser?.full_name || user?.full_name || "",
          metode_pembayaran: metodePembayaran as MetodePembayaran,
          lead_source: leadSource as LeadSource,
          lead_source_custom:
            leadSource === "tulis_sendiri" ? leadSourceCustom : null,
          notes,
          photo_urls: photoUrls,
          telegram_chat_id: tgChatId,
          telegram_message_id: tgMessageId,
          split_payment: metodePembayaran === "split_payment",
          metode_pembayaran_1:
            metodePembayaran === "split_payment"
              ? (splitPayment.metode_1 as MetodePembayaran)
              : undefined,
          nominal_1:
            metodePembayaran === "split_payment"
              ? parseInt(splitPayment.nominal_1) || 0
              : 0,
          metode_pembayaran_2:
            metodePembayaran === "split_payment"
              ? (splitPayment.metode_2 as MetodePembayaran)
              : undefined,
          nominal_2:
            metodePembayaran === "split_payment"
              ? parseInt(derivedNominal2) || 0
              : 0,
        };
        const tx = await createTx(txData, user!.id, user!.full_name || "");
        newTxId = (tx as any)?.id;
        console.log('[DEBUG:LayananForm] createTransaction RESULT', {
          has_id: !!newTxId,
          id: newTxId,
          created_at: (tx as any)?.created_at,
          full_tx_obj: JSON.stringify({ id: (tx as any)?.id, customer_name: (tx as any)?.customer_name }),
        });
        toast.success("Transaksi berhasil ditambahkan!");
      }

      await syncCustomer(customerName, customerWhatsapp);

      // STEP 2: Upload foto di background dan update transaksi dengan hasilnya
      const step2TxId = isEdit ? initialData.id : newTxId;
      const tNow = Date.now();
      console.log('[DEBUG:LayananForm] STEP 2 background upload', {
        hasNewFiles,
        txIdToUpdate: step2TxId,
        txId_type: typeof step2TxId,
        txId_length: String(step2TxId || '').length,
        pendingFiles_count: pendingFiles.length,
        pendingFiles_names: pendingFiles.map(f => f.name),
        timestamp: tNow,
      });
      if (hasNewFiles) {
        const txIdToUpdate = isEdit ? initialData.id : newTxId;
        console.log('[DEBUG:LayananForm] Starting background upload', {
          txIdToUpdate,
          txIdToUpdate_type: typeof txIdToUpdate,
          txIdToUpdate_length: String(txIdToUpdate || '').length,
          files_count: pendingFiles.length,
          files_names: pendingFiles.map(f => f.name),
          timestamp: Date.now(),
        });

        // Set status PENDING (fire-and-forget)
        supabase.from('layanan').update({ upload_status: 'PENDING' } as any).eq('id', txIdToUpdate).then((r: any) => {
          console.log('[DEBUG:LayananForm] status PENDING result', { error: r?.error, status: r?.status, txIdToUpdate });
        });

        // Show initial toast
        toast.success(
          <div>
            <div className="font-medium">Transaksi berhasil disimpan</div>
            <div className="text-xs text-gray-500 mt-0.5">Foto sedang diproses di background. Anda dapat melanjutkan transaksi berikutnya.</div>
          </div>,
          { duration: 5000 },
        );

        // Start background upload
        const legacyPromise = upload.legacyUpload(
          pendingFiles.map(f => f.file),
          "layanan",
          mainCaption,
        );

        supabase.from('layanan').update({ upload_status: 'UPLOADING' } as any).eq('id', txIdToUpdate).then((r: any) => {
          console.log('[DEBUG:LayananForm] status UPLOADING result', { error: r?.error, status: r?.status, txIdToUpdate });
        });

        console.log('[DEBUG:LayananForm] BEFORE legacyUpload await', { timestamp: Date.now() - tNow });

        legacyPromise.then(async (results) => {
          const thenTs = Date.now();
          console.log('[DEBUG:LayananForm] INSIDE .then() CALLBACK', {
            elapsed_ms: thenTs - tNow,
            results_count: results?.length,
            txIdToUpdate,
            txIdToUpdate_type: typeof txIdToUpdate,
            txIdToUpdate_isTruthy: !!txIdToUpdate,
            condition_1: !!(results?.length && txIdToUpdate),
            condition_2: !!(!results?.length && txIdToUpdate),
            has_success_urls: results?.some(r => r.url),
            first_result: results?.[0] ? { url: results[0].url?.slice(0,50), chat_id: results[0].chat_id, message_id: results[0].message_id, has_file_id: !!results[0].file_id } : null,
          });
          if (results?.length && txIdToUpdate) {
            console.log('[DEBUG:LayananForm] BEFORE supabase.update', {
              photoUrls_length: photoUrls.length,
              results_urls_count: results.length,
              results_urls: results.map(r => r.url?.slice(0,50)),
              txIdToUpdate,
              timestamp: Date.now() - thenTs,
            });
            const { data: upData, error: upError, status: upStatus, count: upCount } = await supabase
              .from('layanan')
              .update({
                photo_urls: [...photoUrls, ...results.map(r => r.url)],
                telegram_chat_id: results[0]?.chat_id || null,
                telegram_message_id: results[0]?.message_id || null,
                upload_status: 'SUCCESS',
              } as any)
              .eq('id', txIdToUpdate)
              .select('id, photo_urls, upload_status, telegram_chat_id, telegram_message_id');
            console.log('[DEBUG:LayananForm] AFTER supabase.update RESULT', {
              upError: upError ? { message: upError.message, details: upError.details, hint: upError.hint, code: upError.code } : null,
              upData,
              upStatus,
              upCount,
              txIdToUpdate,
              elapsed_since_then: Date.now() - thenTs,
            });

            // Verify by re-querying
            const { data: verifyData } = await supabase
              .from('layanan')
              .select('id, photo_urls, upload_status, telegram_chat_id, telegram_message_id, created_at')
              .eq('id', txIdToUpdate)
              .single();
            console.log('[DEBUG:LayananForm] VERIFY after update', {
              verifyData: verifyData ? {
                id: (verifyData as any).id,
                photo_urls: (verifyData as any).photo_urls,
                photo_urls_length: ((verifyData as any)?.photo_urls || []).length,
                upload_status: (verifyData as any).upload_status,
                telegram_chat_id: (verifyData as any).telegram_chat_id,
                telegram_message_id: (verifyData as any).telegram_message_id,
              } : 'NO_DATA',
              txIdToUpdate,
            });

            toast.success(`Foto transaksi ${customerName} berhasil diproses`);
          } else if (txIdToUpdate) {
            console.log('[DEBUG:LayananForm] FAILED path (results empty but txId exists)', {
              results_count: results?.length,
              txIdToUpdate,
            });
            await supabase
              .from('layanan')
              .update({ upload_status: 'FAILED' } as any)
              .eq('id', txIdToUpdate);
            toast.error(
              <div>
                <div className="font-medium">Upload foto gagal</div>
                <div className="text-xs text-gray-500 mt-0.5">Klik di sini untuk upload ulang.</div>
              </div>,
              { duration: 8000 },
            );
          } else {
            console.log('[DEBUG:LayananForm] NEITHER path - both conditions false', {
              results_length: results?.length,
              txIdToUpdate,
              txIdToUpdate_type: typeof txIdToUpdate,
            });
          }
          console.log('[DEBUG:LayananForm] BEFORE upload.clear', { timestamp: Date.now() });
          upload.clear();
          console.log('[DEBUG:LayananForm] AFTER upload.clear', { timestamp: Date.now() });
        }).catch(async (err) => {
          console.error('[DEBUG:LayananForm] Background legacyUpload CATCH', {
            error_message: err instanceof Error ? err.message : String(err),
            error_name: err instanceof Error ? err.name : typeof err,
            error_stack: err instanceof Error ? err.stack : undefined,
            txIdToUpdate,
            elapsed_ms: Date.now() - tNow,
            component_still_mounted: !!(document.querySelector('[data-layanan-form]')),
          });
          if (txIdToUpdate) {
            await supabase
              .from('layanan')
              .update({ upload_status: 'FAILED' } as any)
              .eq('id', txIdToUpdate);
          }
          toast.error(
            <div>
              <div className="font-medium">Upload foto gagal</div>
              <div className="text-xs text-gray-500 mt-0.5">Klik invoice untuk upload ulang.</div>
            </div>,
            { duration: 8000 },
          );
          upload.clear();
        });
      }

      // STEP 3: Handle Telegram caption update untuk edit mode tanpa foto baru
      if (!hasNewFiles && initialData?.id) {
        if (
          (initialData as any).telegram_chat_id &&
          (initialData as any).telegram_message_id
        ) {
          try {
            await fetch("/api/telegram/edit-message", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: (initialData as any).telegram_chat_id,
                message_id: (initialData as any).telegram_message_id,
                text: mainCaption,
                is_caption: photoUrls.length > 0,
              }),
            });
          } catch {}
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
          } catch {}
        }
      }

      if (user?.id) {
        const notifType = isEdit ? "transaction_update" : "transaction";
        await fetch("/api/notifications/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: notifType,
            title: isEdit ? "Transaksi Diubah" : "Transaksi Baru",
            message: `${customerName} - Rp ${total.toLocaleString("id-ID")}`,
            targetRoles: ["admin", "owner"],
          }),
        }).catch(() => {});
      }

      if (user?.id) {
        clearingDraft.current = true;
        clearDraft("layanan", user.id);
      }
      restoredRef.current = false;
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan transaksi");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all text-sm dark:bg-[#1c1c1c] dark:border-white/10 dark:text-gray-100 dark:focus:border-white";
  const labelClass =
    "block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5";
  const sectionClass =
    "bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-4";

  return (
    <motion.div
      data-layanan-form="true"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
    >
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
                upload.clear();
                setItems([
                  {
                    jenis_layanan: "service_langsung",
                    skus: [{ sku: "", nominal: 0 }],
                    notes: "",
                  },
                ]);
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
                value={customerName}
                onChange={setCustomerName}
                onSelect={(name, phone) => {
                  setCustomerName(name);
                  setCustomerWhatsapp(phone);
                  setLeadSource("old");
                }}
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
                  value={customerWhatsapp}
                  onChange={(e) => setCustomerWhatsapp(e.target.value)}
                  className={`${inputClass} pl-9`}
                  placeholder="081234567890"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        <div className={sectionClass}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5" /> Items
          </p>
          <div className="space-y-3">
            {items.map((item, itemIdx) => (
              <div
                key={itemIdx}
                className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-white/10 border-b border-gray-200 dark:border-white/10">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Layanan #{itemIdx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(itemIdx)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-3 bg-white dark:bg-[#1c1c1c]">
                  <select
                    value={item.jenis_layanan}
                    onChange={(e) => updateItemJenis(itemIdx, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  >
                    {jenisLayananOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  <div className="space-y-2">
                    {item.skus.map((sku, skuIdx) => (
                      <div
                        key={skuIdx}
                        className="flex flex-col md:flex-row items-start md:items-center gap-2"
                      >
                        <input
                          type="text"
                          value={sku.sku}
                          onChange={(e) =>
                            updateSku(itemIdx, skuIdx, "sku", e.target.value)
                          }
                          placeholder="SKU / Invoice"
                          className="w-full md:flex-1 px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                        />
                        <div className="relative w-full md:w-32">
                          <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            value={sku.nominal || ""}
                            onChange={(e) =>
                              updateSku(
                                itemIdx,
                                skuIdx,
                                "nominal",
                                e.target.value,
                              )
                            }
                            placeholder="Nominal"
                            className="w-full pl-7 pr-2 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                          />
                        </div>
                        {item.skus.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSku(itemIdx, skuIdx)}
                            className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors self-start md:self-center"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => addSku(itemIdx)}
                      className="flex items-center justify-center gap-1 w-full px-3 py-1.5 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-lg text-xs font-semibold text-gray-500 dark:text-gray-400 hover:border-gray-900 dark:hover:border-white hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Tambah SKU
                    </button>
                  </div>

                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) => updateItemNotes(itemIdx, e.target.value)}
                    placeholder="Catatan (opsional)"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg text-sm bg-white dark:bg-[#1c1c1c] focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                  />
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addItem}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 border-2 border-dashed border-gray-300 dark:border-white/20 rounded-xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:border-gray-900 dark:hover:border-white hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Layanan
            </button>
          </div>
        </div>

        <div className={sectionClass}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <User className="w-3.5 h-3.5" /> Handler
          </p>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => {
                setShowOtherHandler(false);
                setHandledBy(user?.id || "");
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${!showOtherHandler ? "bg-gray-900 text-white border-gray-900" : "bg-white dark:bg-[#1c1c1c] text-gray-600 border-gray-200 dark:border-white/10 hover:bg-gray-50"}`}
            >
              Saya ({user?.full_name || "Saya"})
            </button>
            <button
              type="button"
              onClick={() => {
                setShowOtherHandler(true);
                setHandledBy("");
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all flex items-center justify-center gap-1 ${showOtherHandler ? "bg-gray-900 text-white border-gray-900" : "bg-white dark:bg-[#1c1c1c] text-gray-600 border-gray-200 dark:border-white/10 hover:bg-gray-50"}`}
            >
              <ChevronDown className="w-3.5 h-3.5" /> Orang Lain
            </button>
          </div>
          {showOtherHandler && (
            <select
              value={handledBy}
              onChange={(e) => setHandledBy(e.target.value)}
              className={inputClass}
              required
            >
              <option value="">Pilih handler...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
            </select>
          )}
        </div>

        <div className={sectionClass}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5" /> Payment
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Metode Pembayaran</label>
              <select
                value={metodePembayaran}
                onChange={(e) => setMetodePembayaran(e.target.value)}
                className={inputClass}
              >
                {metodePembayaranOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {metodePembayaran === "split_payment" ? (
              <div className="md:col-span-2 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl space-y-2">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Pembayaran 1
                    </label>
                    <select
                      value={splitPayment.metode_1}
                      onChange={(e) =>
                        setSplitPayment((p) => ({
                          ...p,
                          metode_1: e.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      {splitMetodeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={splitPayment.nominal_1}
                      onChange={(e) =>
                        setSplitPayment((p) => ({
                          ...p,
                          nominal_1: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      className={inputClass}
                      placeholder="0"
                    />
                  </div>
                  <div className="p-3 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl space-y-2">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                      Pembayaran 2
                    </label>
                    <select
                      value={splitPayment.metode_2}
                      onChange={(e) =>
                        setSplitPayment((p) => ({
                          ...p,
                          metode_2: e.target.value,
                        }))
                      }
                      className={inputClass}
                    >
                      {splitMetodeOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={derivedNominal2}
                      readOnly
                      className={`${inputClass} bg-gray-50`}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>Total</label>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-bold text-blue-600">
                    {formatRupiah(total)}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Lead Source</label>
                  <select
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value)}
                    className={inputClass}
                  >
                    {leadSourceOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                {showCustomLeadSource && (
                  <div>
                    <label className={labelClass}>Custom Lead Source</label>
                    <input
                      type="text"
                      value={leadSourceCustom}
                      onChange={(e) => setLeadSourceCustom(e.target.value)}
                      className={inputClass}
                      placeholder="Tulis sumber..."
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {metodePembayaran !== "split_payment" && (
          <div className={sectionClass}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-3.5 h-3.5" /> Lead Source & Notes
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Lead Source</label>
                <select
                  value={leadSource}
                  onChange={(e) => setLeadSource(e.target.value)}
                  className={inputClass}
                >
                  {leadSourceOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              {showCustomLeadSource && (
                <div>
                  <label className={labelClass}>Custom Lead Source</label>
                  <input
                    type="text"
                    value={leadSourceCustom}
                    onChange={(e) => setLeadSourceCustom(e.target.value)}
                    className={inputClass}
                    placeholder="Tulis sumber..."
                  />
                </div>
              )}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={`${inputClass} resize-none mt-2`}
              placeholder="Catatan tambahan..."
            />
          </div>
        )}

        <div className={sectionClass}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Camera className="w-3.5 h-3.5" /> Foto{" "}
            <span className="text-red-500">*Wajib min. 1</span>
          </p>
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
                </div>
              ))}
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
            </div>
          )}
          {upload.pendingFiles.length === 0 &&
            photoPreviews.length === 0 &&
            !initialData?.id && (
              <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" /> Minimal 1 foto wajib
              </p>
            )}
        </div>

        <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-white/10">
          <button
            type="submit"
            disabled={loading || upload.uploading}
            className="flex-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold py-3 rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
          >
            {loading || upload.uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" /> Simpan Transaksi
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
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-white/10"
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Konfirmasi Transaksi
              </h3>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Periksa kembali data di bawah sebelum menyimpan
                </p>
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {customerName} - {customerWhatsapp}
              </p>
              {items.map((item, i) => (
                <div
                  key={i}
                  className="p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 space-y-1"
                >
                  <p className="text-xs font-semibold text-gray-900">
                    {jenisLayananOptions.find(
                      (o) => o.value === item.jenis_layanan,
                    )?.label || item.jenis_layanan}
                  </p>
                  {item.skus.map((sku, j) => (
                    <div key={j} className="flex justify-between text-xs">
                      <span className="text-gray-500">{sku.sku || "-"}</span>
                      <span className="font-semibold text-blue-600">
                        {formatRupiah(sku.nominal)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 dark:border-white/10 pt-1 flex justify-between text-xs font-bold">
                    <span>Subtotal</span>
                    <span className="text-blue-600">
                      {formatRupiah(calculateItemSubtotal(item.skus))}
                    </span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between p-3 bg-gray-900 dark:bg-white rounded-xl">
                <span className="text-sm font-bold text-white dark:text-gray-900">
                  Grand Total
                </span>
                <span className="text-sm font-bold text-white dark:text-gray-900">
                  {formatRupiah(total)}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                {photoPreviews.length} foto akan diupload
              </p>
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Simpan
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showPhotoSource && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80] p-4"
          onClick={() => setShowPhotoSource(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-xl w-full max-w-xs border border-gray-200 dark:border-white/10"
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
    </motion.div>
  );
});
