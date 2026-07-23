"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import {
  X,
  User,
  Watch,
  Wrench,
  Package,
  FileText,
  Image as ImageIcon,
  Clock as ClockIcon,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Calendar,
  Phone,
  DollarSign,
  CheckCircle,
  XCircle,
  Check,
  Trash2,
  Plus,
  ZoomIn,
  Download,
  ClipboardCheck,
  Hash,
  Tag,
  Award,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  clearDraft,
  saveDraftTextSync,
  loadDraft,
  hasDraft,
} from "@/lib/draftStorage";

interface QCReviewModalProps {
  service: any;
  onClose: () => void;
  onComplete: () => void;
  reviewerId?: string;
  reviewerName?: string;
}

export default function QCReviewModal({
  service,
  onClose,
  onComplete,
  reviewerId,
  reviewerName,
}: QCReviewModalProps) {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [serviceItems, setServiceItems] = useState<any[]>([]);
  const [documentations, setDocumentations] = useState<any[]>([]);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [discount, setDiscount] = useState(0);
  const [customJasa, setCustomJasa] = useState({
    name: "",
    price: 0,
    quantity: 1,
  });
  const [showAddJasa, setShowAddJasa] = useState(false);
  const [customSparepart, setCustomSparepart] = useState({
    name: "",
    price: 0,
    quantity: 1,
  });
  const [showAddSparepart, setShowAddSparepart] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    [key: number]: { price?: number; quantity?: number };
  }>({});
  const [expandedSections, setExpandedSections] = useState({
    items: true,
    timeline: true,
    photos: true,
  });
  const [previewPhotoIndex, setPreviewPhotoIndex] = useState<number | null>(
    null,
  );
  const [previewZoomed, setPreviewZoomed] = useState(false);
  const [hasDraftData, setHasDraftData] = useState(false);
  const initialLoadDone = useRef(false);
  const supabase = createClient();
  const userId = reviewerId || "qc";

  // ── Draft key ──
  const draftKey = `qc_review_${service?.id}`;

  // ── Draft auto-save ──
  const saveDraftDebounced = useCallback(() => {
    const payload = { localItems, discount, reviewNotes };
    saveDraftTextSync(draftKey, userId, payload);
  }, [localItems, discount, reviewNotes, draftKey, userId]);

  // Auto-save on changes
  useEffect(() => {
    if (!initialLoadDone.current) return;
    const timer = setTimeout(saveDraftDebounced, 1000);
    return () => clearTimeout(timer);
  }, [localItems, discount, reviewNotes, saveDraftDebounced]);

  // ── Restore draft or fetch data ──
  useEffect(() => {
    if (!service) return;
    const init = async () => {
      setLoading(true);
      const draft = await loadDraft(draftKey, userId);
      if (draft.data) {
        setLocalItems(draft.data.localItems || []);
        setDiscount(draft.data.discount || 0);
        setReviewNotes(draft.data.reviewNotes || "");
        setHasDraftData(true);
      }
      await fetchDetails(draft.data);
      initialLoadDone.current = true;
      setLoading(false);
    };
    init();
  }, [service]);

  const fetchDetails = async (draftData?: any) => {
    const [timelineRes, itemsRes, photosRes] = await Promise.all([
      supabase
        .from("service_timeline")
        .select("*")
        .eq("service_order_id", service.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("service_items")
        .select("*")
        .eq("service_order_id", service.id),
      supabase
        .from("service_documentation")
        .select("*")
        .eq("service_order_id", service.id)
        .order("created_at", { ascending: true }),
    ]);
    if (timelineRes.data) setTimeline(timelineRes.data);
    if (photosRes.data) setDocumentations(photosRes.data);
    const technicianSubmittedItems = itemsRes.data || [];

    // setServiceItems is used as a reference (e.g., for clearing draft)
    setServiceItems(technicianSubmittedItems);

    if (!draftData) {
      // Initialize localItems (the editable list in QC modal) ONLY from technician's submitted items
      setLocalItems(JSON.parse(JSON.stringify(technicianSubmittedItems))); // Deep copy to avoid direct state mutation
      setDiscount(service.discount || 0);
    }
    // The timelineSparepartsForReference can be used to display a separate section in the UI
    // if QC needs to be aware of items logged in timeline but not officially submitted.
    //   });

    //   initialLocalItemsForReview = Array.from(finalItemsMap.values());
  };

  const clearDraftData = () => {
    clearDraft(draftKey, userId);
    setHasDraftData(false);
    setLocalItems(JSON.parse(JSON.stringify(serviceItems)));
    setDiscount(service.discount || 0);
    setReviewNotes("");
    toast.success("Draft dihapus");
  };

  // ── Calculations ──
  const subtotal = localItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0,
  );
  const totalBeforeDiscount = subtotal;
  const effectiveDiscount = Math.min(discount, totalBeforeDiscount);
  const afterDiscount = totalBeforeDiscount - effectiveDiscount;
  const dpValue = Number(service?.down_payment) || 0;
  const grandTotal = Math.max(0, afterDiscount - dpValue);
  const discountPercent =
    totalBeforeDiscount > 0
      ? Math.round((effectiveDiscount / totalBeforeDiscount) * 100)
      : 0;

  // ── Item editing ──
  // ── Item editing ──
  const startEditItem = (index: number, item: any) => {
    setEditingItem({
      ...editingItem,
      [index]: { price: item.price, quantity: item.quantity },
    });
  };

  const saveItemEdit = (index: number) => {
    const edit = editingItem[index];
    if (!edit) return;
    const updated = [...localItems];
    updated[index] = {
      ...updated[index],
      price: edit.price ?? updated[index].price,
      quantity: edit.quantity ?? updated[index].quantity,
    };
    setLocalItems(updated);
    const { [index]: _, ...rest } = editingItem;
    setEditingItem(rest);
  };

  const cancelItemEdit = (index: number) => {
    const { [index]: _, ...rest } = editingItem;
    setEditingItem(rest);
  };

  const deleteItem = (index: number) => {
    setLocalItems(localItems.filter((_, i) => i !== index));
  };

  // ── Add custom items ──
  const addCustomJasa = () => {
    if (!customJasa.name.trim() || customJasa.price <= 0) return;
    setLocalItems([
      ...localItems,
      {
        id: `custom_${Date.now()}`,
        name: customJasa.name.trim(),
        price: customJasa.price,
        quantity: customJasa.quantity,
        item_type: "jasa",
        notes: reviewNotes || null,
      },
    ]);
    setCustomJasa({ name: "", price: 0, quantity: 1 });
    setShowAddJasa(false);
  };

  const addCustomSparepart = () => {
    if (!customSparepart.name.trim() || customSparepart.price <= 0) return;
    setLocalItems([
      ...localItems,
      {
        id: `custom_sp_${Date.now()}`,
        name: customSparepart.name.trim(),
        price: customSparepart.price,
        quantity: customSparepart.quantity,
        item_type: "sparepart",
        notes: reviewNotes || null,
      },
    ]);
    setCustomSparepart({ name: "", price: 0, quantity: 1 });
    setShowAddSparepart(false);
  };

  // ── Caption generators ──
  const formatDateFull = (d: string) => {
    const dt = new Date(d);
    const days = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    const months = [
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
    return `${days[dt.getDay()]}, ${dt.getDate()} ${months[dt.getMonth()]} (${String(dt.getMonth() + 1).padStart(2, "0")}), ${dt.getFullYear()}`;
  };

  const generateCaption = async (
    status: string,
    serviceDetails: any,
    items: any[],
    currentReviewNotes: string,
    currentDiscount: number,
  ) => {
    const now = new Date();
    const fmtDate = formatDateFull(now.toISOString());
    const allItems = items;

    // Extract details from serviceDetails for customer, watch, etc.
    const customerName = serviceDetails.customer_name || "-";
    const customerPhone = serviceDetails.customer_phone || "-";
    const watchBrand =
      serviceDetails.watch_brand || serviceDetails.device_brand || "-";
    const watchModel =
      serviceDetails.watch_model || serviceDetails.device_model;
    const estimatedCost = serviceDetails.estimated_cost;
    const teknisiName =
      serviceDetails.teknisi_name ||
      serviceDetails.assigned_teknisi_name ||
      "-";
    const startDate = serviceDetails.start_date
      ? formatDateFull(serviceDetails.start_date)
      : "-";
    const doneDate = serviceDetails.done_date
      ? formatDateFull(serviceDetails.done_date)
      : fmtDate;
    const teknisiNotes = serviceDetails.qc_submit_notes?.trim();

    const subtotal = allItems.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
      0,
    );
    const effectiveDiscount = Math.min(currentDiscount, subtotal);
    const grandTotal = Math.max(0, subtotal - effectiveDiscount - dpValue);

    const barangItems = allItems.filter((i) => i.item_type === "sparepart");
    const jasaItems = allItems.filter((i) => i.item_type === "jasa");

    const barangList =
      barangItems.length > 0
        ? barangItems
            .map(
              (i: any) =>
                `- ${i.name} (${i.quantity || 1}x) @Rp${(i.price || 0).toLocaleString("id-ID")}`,
            )
            .join("\n")
        : "";

    const jasaList =
      jasaItems.length > 0
        ? jasaItems
            .map(
              (i: any) =>
                `- ${i.name} (${i.quantity}x) @Rp${(i.price || 0).toLocaleString("id-ID")}`,
            )
            .join("\n")
        : "";

    const sections: string[] = [];
    sections.push(`UPDATE QC`);
    sections.push(
      `Status : ${status === "approved" ? "QC Approve" : "QC Revisi"}`,
    );
    sections.push(`Nama : ${customerName}`);
    sections.push(`No. hp : ${customerPhone}`);
    sections.push(`Brand : ${watchBrand}`);
    if (watchModel) {
      sections.push(`Tipe : ${watchModel}`);
    }
    if (estimatedCost && estimatedCost > 0) {
      sections.push(`Estimasi : Rp${estimatedCost.toLocaleString("id-ID")}`);
    }
    sections.push(`Teknisi : ${teknisiName}`);
    sections.push(`Start : ${startDate}`);
    sections.push(`Done : ${doneDate}`);

    if (barangItems.length > 0 || jasaItems.length > 0) {
      sections.push(`Rincian Item`);
      if (barangItems.length > 0) {
        sections.push(`Barang:\n${barangList}`);
      }
      if (jasaItems.length > 0) {
        sections.push(`Jasa:\n${jasaList}`);
      }
    }

    if (dpValue > 0) {
      sections.push(`Dp : Rp${dpValue.toLocaleString("id-ID")}`);
    }
    if (effectiveDiscount > 0) {
      sections.push(`Diskon : Rp${effectiveDiscount.toLocaleString("id-ID")}`);
    }
    if (grandTotal > 0) {
      sections.push(`Total : Rp${grandTotal.toLocaleString("id-ID")}`);
    }

    if (teknisiNotes) {
      sections.push(`Keterangan Teknisi :\n${teknisiNotes}`);
    }
    if (currentReviewNotes.trim()) {
      sections.push(`Keterangan QC:\n${currentReviewNotes.trim()}`);
    }

    return sections.filter(Boolean).join("\n\n");
  };

  // ── Review action ──
  const handleReview = async (status: "approved" | "rejected") => {
    if (!service) return;
    if (status === "rejected" && !reviewNotes.trim()) {
      toast.error("Harap berikan alasan penolakan");
      return;
    }
    setProcessing(true);
    try {
      if (status === "approved" && localItems.length > 0) {
        const { error: delErr } = await supabase
          .from("service_items")
          .delete()
          .eq("service_order_id", service.id);
        if (delErr) throw new Error("Gagal hapus item lama: " + delErr.message);

        const combinedItems = localItems;

        const insertItems = combinedItems.map((item: any) => ({
          service_order_id: service.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          item_type: item.item_type,
        }));
        if (insertItems.length > 0) {
          const { error: itemsErr } = await supabase
            .from("service_items")
            .insert(insertItems);
          if (itemsErr)
            throw new Error("Gagal simpan item: " + itemsErr.message);
        }
        await supabase
          .from("service_orders")
          .update({
            final_cost: grandTotal,
            discount: effectiveDiscount,
            discount_percentage: discountPercent,
          })
          .eq("id", service.id);
      }

      const newStatus =
        status === "approved" ? "completed" : "revision_required";
      const { error: updateError } = await supabase
        .from("service_orders")
        .update({
          status: newStatus,
          completed_at: status === "approved" ? new Date().toISOString() : null,
          discount: effectiveDiscount,
          discount_percentage: discountPercent,
        })
        .eq("id", service.id);
      if (updateError) throw updateError;

      await supabase.from("qc_reviews").insert({
        service_order_id: service.id,
        reviewer_id: reviewerId,
        status: status,
        notes: reviewNotes,
      });

      const message =
        status === "approved"
          ? `Service telah disetujui oleh QC (${reviewerName})`
          : `Service memerlukan revisi. Alasan: ${reviewNotes}`;
      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        status: newStatus,
        message,
        details: {
          action: "qc_review",
          reviewer: reviewerName,
          revision: true,
        },
      });

      let notifMsg =
        status === "approved"
          ? `Service ${service.invoice_number} telah disetujui oleh QC`
          : `Service ${service.invoice_number} ditolak QC. Alasan: ${reviewNotes}. Silakan perbaiki dan kirim kembali.`;

      if (status === "approved") {
        const changes: string[] = [];
        for (const orig of serviceItems) {
          const stillExists = localItems.some(
            (item) => item.id === orig.id && item.name === orig.name,
          );
          if (!stillExists)
            changes.push(
              `\u2022 ${orig.item_type === "jasa" ? "Jasa" : "Sparepart"} "${orig.name}" dihapus`,
            );
        }
        for (const curr of localItems) {
          const orig = serviceItems.find(
            (o: any) => o.id === curr.id && o.name === curr.name,
          );
          if (orig && orig.price !== curr.price)
            changes.push(
              `\u2022 Harga ${curr.name}: Rp${(orig.price || 0).toLocaleString()} \u2192 Rp${(curr.price || 0).toLocaleString()}`,
            );
          if (orig && orig.quantity !== curr.quantity)
            changes.push(
              `\u2022 Qty ${curr.name}: ${orig.quantity}x \u2192 ${curr.quantity}x`,
            );
          if (!orig)
            changes.push(
              `\u2022 ${curr.item_type === "jasa" ? "Jasa" : "Sparepart"} baru: ${curr.name} Rp${(curr.price || 0).toLocaleString()}`,
            );
        }
        if (changes.length > 0) {
          notifMsg += "\n\nPerubahan oleh QC:\n" + changes.join("\n");
          const { data: photoDocs } = await supabase
            .from("service_documentation")
            .select("photo_url")
            .eq("service_order_id", service.id)
            .order("created_at", { ascending: true });
          await supabase.from("activity_logs").insert({
            user_id: service.assigned_teknisi_id,
            action: "qc_price_changes",
            details: {
              service_id: service.id,
              invoice: service.invoice_number,
              customer_name: service.customer_name,
              customer_phone: service.customer_phone,
              watch_brand: service.watch_brand || service.device_brand || "",
              serial_number: service.serial_number || "",
              reviewer: reviewerName,
              changes,
              items_before: serviceItems.map((i: any) => ({
                name: i.name,
                price: i.price,
                quantity: i.quantity,
                item_type: i.item_type,
              })),
              items_after: localItems.map((i: any) => ({
                name: i.name,
                price: i.price,
                quantity: i.quantity,
                item_type: i.item_type,
              })),
              photo_urls: (photoDocs || []).map((d: any) => d.photo_url),
            },
          });
        }

        // Edit Telegram caption
        try {
          const newCaption = await generateCaption(
            newStatus,
            service,
            localItems,
            reviewNotes,
            effectiveDiscount,
          );
          const editRes = await fetch("/api/telegram/edit-caption", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_order_id: service.id,
              new_caption: newCaption,
              channel: "qc_update",
            }),
          });
          if (!editRes.ok) {
            const errData = await editRes.json().catch(() => ({}));
            console.warn("Edit caption API error:", editRes.status, errData);
            toast.error(
              "Gagal update caption Telegram: " +
                (errData.error || editRes.statusText),
            );
          }
        } catch (e: any) {
          console.warn("Failed to edit Telegram caption:", e.message);
          toast.error("Gagal edit caption Telegram: " + e.message);
        }
      }

      await supabase.from("notifications").insert({
        user_id: service.assigned_teknisi_id,
        title:
          status === "approved"
            ? "\u2705 Service Disetujui QC"
            : "\U0001f504 Service Perlu Revisi",
        message: notifMsg,
        type: status === "approved" ? "success" : "warning",
        link: "/teknisi",
        is_read: false,
      });

      clearDraft(draftKey, userId);
      toast.success(
        `Service ${status === "approved" ? "disetujui" : "ditolak"}`,
      );
      onComplete();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatRupiah = (nominal: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(nominal);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
      assigned: { label: "Assigned", color: "bg-blue-100 text-blue-700" },
      in_progress: {
        label: "In Progress",
        color: "bg-purple-100 text-purple-700",
      },
      req_sparepart_admin: {
        label: "Request PO",
        color: "bg-orange-100 text-orange-700",
      },
      po_pending: {
        label: "PO Pending",
        color: "bg-indigo-100 text-indigo-700",
      },
      sparepart_ready: {
        label: "Sparepart Ready",
        color: "bg-green-100 text-green-700",
      },
      qc_pending: {
        label: "QC Pending",
        color: "bg-yellow-100 text-yellow-700",
      },
      completed: { label: "Completed", color: "bg-green-100 text-green-700" },
      cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
    };
    return (
      badges[status] || { label: status, color: "bg-slate-100 text-slate-700" }
    );
  };

  const toggleSection = (section: keyof typeof expandedSections) =>
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
        <div className="bg-[var(--color-card)] rounded-[var(--radius-card-md)] border border-[var(--color-border)] w-full max-w-4xl p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--color-accent)] border-t-transparent mx-auto" />
          <p className="mt-3 text-[var(--color-text-secondary)]">
            Loading details...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--color-card)] rounded-[var(--radius-card-md)] border border-[var(--color-border)] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center sticky top-0 bg-[var(--color-card)]/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] rounded-xl flex items-center justify-center shadow-sm">
              <ClipboardCheck className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--color-text)]">
                  Review Service
                </h3>
                {hasDraftData && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                    Draft
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs font-mono text-[var(--color-text-tertiary)]">
                  {service.invoice_number}
                </span>
                <span className="text-[10px] text-[var(--color-text-tertiary)]">
                  •
                </span>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {service.teknisi_name}
                </span>
                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                  QC Pending
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasDraftData && (
              <button
                onClick={clearDraftData}
                className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
              >
                Hapus Draft
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-all text-[var(--color-text-tertiary)] hover:text-[var(--color-text)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Customer & Watch Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-xs">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Customer
                </h4>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {service.customer_name}
                </p>
                <div className="space-y-1">
                  {[
                    {
                      label: "WhatsApp",
                      value: service.customer_phone || "-",
                      icon: Phone,
                    },
                    {
                      label: "Serial",
                      value: service.serial_number || "-",
                      icon: Hash,
                    },
                    {
                      label: "Tanggal",
                      value: formatDate(service.created_at),
                      icon: Calendar,
                    },
                  ].map((d) => (
                    <div
                      key={d.label}
                      className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]"
                    >
                      <d.icon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center shadow-xs">
                  <Watch className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Jam Tangan
                </h4>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {service.watch_brand || service.device_brand || "-"}
                  {service.watch_model && (
                    <span className="font-normal text-[var(--color-text-secondary)]">
                      {" "}
                      {service.watch_model}
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {service.watch_movement && (
                    <span className="text-[10px] bg-[var(--color-card)] border border-[var(--color-border)] px-2 py-0.5 rounded-md text-[var(--color-text-secondary)]">
                      {service.watch_movement}
                    </span>
                  )}
                  {service.watch_condition && (
                    <span className="text-[10px] bg-[var(--color-card)] border border-[var(--color-border)] px-2 py-0.5 rounded-md text-[var(--color-text-secondary)]">
                      {service.watch_condition}
                    </span>
                  )}
                  {service.watch_year && (
                    <span className="text-[10px] bg-[var(--color-card)] border border-[var(--color-border)] px-2 py-0.5 rounded-md text-[var(--color-text-secondary)]">
                      {service.watch_year}
                    </span>
                  )}
                </div>
                {service.serial_number && (
                  <p className="text-xs text-[var(--color-text-tertiary)] flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {service.serial_number}
                  </p>
                )}
                {service.watch_accessories?.length > 0 && (
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {service.watch_accessories.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Teknisi Info */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-xs">
                <Wrench className="w-3.5 h-3.5 text-white" />
              </div>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Teknisi
              </h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Teknisi", value: service.teknisi_name || "-" },
                {
                  label: "Start",
                  value: service.start_date
                    ? formatDate(service.start_date)
                    : "-",
                },
                {
                  label: "Done",
                  value: service.done_date
                    ? formatDate(service.done_date)
                    : "-",
                },
                { label: "Duration", value: service.work_duration || "-" },
              ].map((d) => (
                <div
                  key={d.label}
                  className="bg-[var(--color-card)] rounded-lg p-2.5 border border-[var(--color-border)]"
                >
                  <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    {d.label}
                  </p>
                  <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5">
                    {d.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Pembayaran */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-xs">
                <DollarSign className="w-3.5 h-3.5 text-white" />
              </div>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Pembayaran
              </h4>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="bg-[var(--color-card)] rounded-xl p-4 border border-[var(--color-border)] space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    Estimasi Biaya
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {service.estimated_cost
                      ? formatRupiah(service.estimated_cost)
                      : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[var(--color-text-tertiary)]">
                    Total Item
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-text)]">
                    {formatRupiah(totalBeforeDiscount)}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      Diskon
                    </span>
                    <span className="text-sm font-semibold text-red-500">
                      -{formatRupiah(effectiveDiscount)}
                    </span>
                  </div>
                )}
              </div>
              <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-xl p-4 text-white space-y-2 shadow-sm">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/80">DP Dibayar</span>
                  <span className="text-sm font-bold">
                    {service?.down_payment > 0
                      ? formatRupiah(Number(service.down_payment))
                      : "Belum DP"}
                  </span>
                </div>
                <div className="h-px bg-white/20" />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/80">
                    Sisa yang harus dibayar
                  </span>
                  <span className="text-lg font-bold">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
                {dpValue > 0 && grandTotal <= 0 && (
                  <p className="text-xs text-emerald-100 font-medium flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> LUNAS
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-xs">
                <FileText className="w-3.5 h-3.5 text-white" />
              </div>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Service Details
              </h4>
            </div>
            <div className="space-y-3">
              <div className="bg-[var(--color-card)] rounded-lg p-3 border border-[var(--color-border)]">
                <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                  Issue
                </p>
                <p className="text-sm text-[var(--color-text)] leading-relaxed">
                  {service.issue_description}
                </p>
              </div>
              {service.request && (
                <div className="bg-[var(--color-card)] rounded-lg p-3 border border-[var(--color-border)]">
                  <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Customer Request
                  </p>
                  <p className="text-sm text-[var(--color-text)] leading-relaxed">
                    {service.request}
                  </p>
                </div>
              )}
              {service.notes && (
                <div className="bg-[var(--color-card)] rounded-lg p-3 border border-[var(--color-border)]">
                  <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Catatan
                  </p>
                  <p className="text-sm text-[var(--color-text)] leading-relaxed">
                    {service.notes}
                  </p>
                </div>
              )}
              {service.completion_notes && (
                <div className="bg-[var(--color-card)] rounded-lg p-3 border border-[var(--color-border)]">
                  <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">
                    Completion Notes
                  </p>
                  <p className="text-sm text-[var(--color-text)] leading-relaxed">
                    {service.completion_notes}
                  </p>
                </div>
              )}
              {service.qc_submit_notes && (
                <div className="bg-[var(--color-card)] rounded-lg p-3 border border-[var(--color-border)] border-l-4 border-l-amber-400">
                  <p className="text-[10px] text-amber-600 uppercase tracking-wider mb-1 font-semibold">
                    Catatan Teknisi
                  </p>
                  <p className="text-sm text-[var(--color-text)] leading-relaxed">
                    {service.qc_submit_notes}
                  </p>
                </div>
              )}
              {(service.warranty_months || service.warranty_expiry) && (
                <div className="flex items-center gap-4 pt-2 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                    <Award className="w-3.5 h-3.5" />
                    {service.warranty_months
                      ? `Garansi ${service.warranty_months} bulan`
                      : ""}
                  </div>
                  {service.warranty_expiry && (
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      Exp: {formatDate(service.warranty_expiry)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Original Technician Items — read-only reference */}
          {serviceItems.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)] border-l-4 border-l-amber-400">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center shadow-xs">
                  <Package className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Item dari Teknisi
                </h4>
                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  {serviceItems.length} item
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {serviceItems.map((item, index) => {
                  const isDeleted = !localItems.some(
                    (li) => li.id === item.id && li.name === item.name,
                  );
                  const modifiedItem = localItems.find(
                    (li) => li.id === item.id && li.name === item.name,
                  );
                  const priceChanged =
                    modifiedItem && modifiedItem.price !== item.price;
                  const qtyChanged =
                    modifiedItem && modifiedItem.quantity !== item.quantity;
                  return (
                    <div
                      key={item.id || index}
                      className={`flex items-center justify-between p-2.5 rounded-lg border gap-2 ${
                        isDeleted
                          ? "bg-red-50 border-red-200 line-through opacity-60"
                          : priceChanged || qtyChanged
                            ? "bg-amber-50 border-amber-200"
                            : "bg-[var(--color-card)] border-[var(--color-border)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md flex-shrink-0 ${item.item_type === "jasa" ? "bg-pink-100 text-pink-700" : "bg-purple-100 text-purple-700"}`}
                        >
                          {item.item_type === "jasa" ? "JASA" : "SPR"}
                        </span>
                        <span className="text-sm font-medium truncate text-[var(--color-text)]">
                          {item.name}
                        </span>
                        <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
                          {item.quantity}x
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-semibold text-[var(--color-text)]">
                          {formatRupiah(
                            (item.price || 0) * (item.quantity || 1),
                          )}
                        </span>
                        {isDeleted && (
                          <span className="text-[10px] font-medium text-red-600 bg-red-100 px-1.5 py-0.5 rounded-md">
                            Dihapus
                          </span>
                        )}
                        {priceChanged && (
                          <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">
                            Harga berubah
                          </span>
                        )}
                        {qtyChanged && !priceChanged && (
                          <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md">
                            Qty berubah
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {localItems.some((li) =>
                li.id?.toString().startsWith("custom_"),
              ) && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1 bg-amber-50 rounded-lg p-2">
                  <span className="font-bold">*</span> Item baru yang
                  ditambahkan QC tidak muncul di daftar ini
                </p>
              )}
            </div>
          )}

          {/* PO Info */}
          {(service.po_status || service.po_sparepart) && (
            <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center shadow-xs">
                  <Package className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Purchase Order
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Status PO", value: service.po_status },
                  { label: "Sparepart PO", value: service.po_sparepart },
                  {
                    label: "Requested At",
                    value: service.po_requested_at
                      ? formatDate(service.po_requested_at)
                      : null,
                  },
                  { label: "Admin Response", value: service.po_admin_response },
                ]
                  .filter((d) => d.value)
                  .map((d) => (
                    <div
                      key={d.label}
                      className="bg-[var(--color-card)] rounded-lg p-2.5 border border-[var(--color-border)]"
                    >
                      <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase tracking-wider">
                        {d.label}
                      </p>
                      <p className="text-sm font-semibold text-[var(--color-text)] mt-0.5">
                        {d.value}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Service Items — editable with discount */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
            <button
              onClick={() => toggleSection("items")}
              className="w-full flex items-center justify-between mb-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-sky-500 to-sky-600 rounded-lg flex items-center justify-center shadow-xs">
                  <Package className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Items
                </h4>
                <span className="text-[10px] bg-[var(--color-card)] text-[var(--color-text-tertiary)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                  {localItems.length} item
                </span>
              </div>
              {expandedSections.items ? (
                <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              )}
            </button>
            {expandedSections.items && (
              <div className="space-y-2">
                {localItems.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-tertiary)] text-center py-3">
                    Belum ada item
                  </p>
                ) : (
                  localItems.map((item, index) => {
                    const isEditing = editingItem[index] !== undefined;
                    return (
                      <div
                        key={item.id || index}
                        className={`flex items-center justify-between p-2.5 rounded-lg border gap-2 transition-all ${
                          isEditing
                            ? "bg-blue-50 border-blue-200 shadow-xs"
                            : "bg-[var(--color-card)] border-[var(--color-border)]"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md flex-shrink-0 ${item.item_type === "jasa" ? "bg-pink-100 text-pink-700" : "bg-purple-100 text-purple-700"}`}
                          >
                            {item.item_type === "jasa" ? "JASA" : "SPR"}
                          </span>
                          {isEditing ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  const updated = [...localItems];
                                  updated[index] = {
                                    ...updated[index],
                                    name: e.target.value,
                                  };
                                  setLocalItems(updated);
                                }}
                                className="w-28 px-2 py-1 text-xs border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                              />
                              <input
                                type="number"
                                value={
                                  editingItem[index]?.quantity ?? item.quantity
                                }
                                onChange={(e) =>
                                  setEditingItem({
                                    ...editingItem,
                                    [index]: {
                                      ...editingItem[index],
                                      quantity: parseInt(e.target.value) || 1,
                                    },
                                  })
                                }
                                className="w-14 px-2 py-1 text-xs border border-blue-300 rounded-md text-center focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                              />
                              <span className="text-xs text-[var(--color-text-tertiary)]">
                                x
                              </span>
                              <input
                                type="number"
                                value={editingItem[index]?.price ?? item.price}
                                onChange={(e) =>
                                  setEditingItem({
                                    ...editingItem,
                                    [index]: {
                                      ...editingItem[index],
                                      price: parseInt(e.target.value) || 0,
                                    },
                                  })
                                }
                                className="w-24 px-2 py-1 text-xs border border-blue-300 rounded-md text-right focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                              />
                            </div>
                          ) : (
                            <>
                              <span
                                className="text-sm font-medium truncate text-[var(--color-text)] cursor-pointer hover:text-[var(--color-accent)]"
                                onClick={() => startEditItem(index, item)}
                              >
                                {item.name}
                              </span>
                              <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
                                {item.quantity}x
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveItemEdit(index)}
                                className="p-1 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                title="Simpan"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => cancelItemEdit(index)}
                                className="p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                                title="Batal"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span
                                className="text-xs font-semibold text-[var(--color-text)] cursor-pointer hover:text-[var(--color-accent)] bg-[var(--color-surface)] px-2 py-1 rounded-md"
                                onClick={() => startEditItem(index, item)}
                              >
                                {formatRupiah(
                                  (item.price || 0) * (item.quantity || 1),
                                )}
                              </span>
                              <button
                                onClick={() => deleteItem(index)}
                                className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Total */}
                <div className="space-y-1.5 p-4 bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] text-white rounded-xl shadow-sm">
                  <div className="flex justify-between items-center text-sm text-white/80">
                    <span>Subtotal</span>
                    <span>{formatRupiah(totalBeforeDiscount)}</span>
                  </div>
                  {dpValue > 0 && (
                    <div className="flex justify-between items-center text-sm text-white/80">
                      <span>DP</span>
                      <span>-{formatRupiah(dpValue)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-sm font-medium text-white/90">
                      Diskon
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={discount}
                        onChange={(e) =>
                          setDiscount(
                            Math.max(0, parseInt(e.target.value) || 0),
                          )
                        }
                        className="w-20 px-1.5 py-0.5 text-xs text-right text-[var(--color-text)] bg-white/95 rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-white/40"
                        min={0}
                        max={totalBeforeDiscount}
                      />
                      <span className="text-xs text-white/60">
                        ({discountPercent}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-lg font-bold pt-2 border-t border-white/20">
                    <span>Sisa yang harus dibayar</span>
                    <span>{formatRupiah(grandTotal)}</span>
                  </div>
                </div>

                {/* Add Jasa */}
                {showAddJasa ? (
                  <div className="p-3.5 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                    <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5">
                      <Plus className="w-3 h-3" /> Tambah Jasa
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={customJasa.name}
                        onChange={(e) =>
                          setCustomJasa({ ...customJasa, name: e.target.value })
                        }
                        placeholder="Nama jasa..."
                        className="min-w-[120px] flex-1 px-3 py-2 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                      />
                      <input
                        type="number"
                        value={customJasa.quantity || ""}
                        onChange={(e) =>
                          setCustomJasa({
                            ...customJasa,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        placeholder="Qty"
                        className="w-16 px-2 py-2 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-center"
                      />
                      <input
                        type="number"
                        value={customJasa.price || ""}
                        onChange={(e) =>
                          setCustomJasa({
                            ...customJasa,
                            price: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="Harga"
                        className="w-24 px-2 py-2 text-xs border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white text-right"
                      />
                      <button
                        onClick={addCustomJasa}
                        disabled={
                          !customJasa.name.trim() || customJasa.price <= 0
                        }
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
                      >
                        Tambah
                      </button>
                      <button
                        onClick={() => setShowAddJasa(false)}
                        className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddJasa(true)}
                    className="w-full py-2.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-300 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Jasa
                  </button>
                )}

                {/* Add Sparepart */}
                {showAddSparepart ? (
                  <div className="p-3.5 bg-purple-50 rounded-xl border border-purple-200 space-y-3">
                    <p className="text-xs font-semibold text-purple-700 flex items-center gap-1.5">
                      <Plus className="w-3 h-3" /> Tambah a
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={customSparepart.name}
                        onChange={(e) =>
                          setCustomSparepart({
                            ...customSparepart,
                            name: e.target.value,
                          })
                        }
                        placeholder="Nama sparepart..."
                        className="min-w-[120px] flex-1 px-3 py-2 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
                      />
                      <input
                        type="number"
                        value={customSparepart.quantity || ""}
                        onChange={(e) =>
                          setCustomSparepart({
                            ...customSparepart,
                            quantity: parseInt(e.target.value) || 1,
                          })
                        }
                        placeholder="Qty"
                        className="w-16 px-2 py-2 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white text-center"
                      />
                      <input
                        type="number"
                        value={customSparepart.price || ""}
                        onChange={(e) =>
                          setCustomSparepart({
                            ...customSparepart,
                            price: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="Harga"
                        className="w-24 px-2 py-2 text-xs border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white text-right"
                      />
                      <button
                        onClick={addCustomSparepart}
                        disabled={
                          !customSparepart.name.trim() ||
                          customSparepart.price <= 0
                        }
                        className="px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-xs"
                      >
                        Tambah
                      </button>
                      <button
                        onClick={() => setShowAddSparepart(false)}
                        className="px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddSparepart(true)}
                    className="w-full py-2.5 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl border-2 border-dashed border-purple-200 hover:border-purple-300 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Sparepart
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
            <button
              onClick={() => toggleSection("timeline")}
              className="w-full flex items-center justify-between mb-3"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg flex items-center justify-center shadow-xs">
                  <ClockIcon className="w-3.5 h-3.5 text-white" />
                </div>
                <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Aktivitas Teknisi
                </h4>
                <span className="text-[10px] bg-[var(--color-card)] text-[var(--color-text-tertiary)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                  {timeline.length} event
                </span>
              </div>
              {expandedSections.timeline ? (
                <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              )}
            </button>
            {expandedSections.timeline && (
              <div className="space-y-2 pt-1">
                {timeline.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4 bg-[var(--color-card)] rounded-lg border border-[var(--color-border)]">
                    Tidak ada aktivitas tercatat.
                  </p>
                ) : (
                  timeline.map((event, index) => (
                    <div
                      key={event.id || index}
                      className="flex items-start gap-3 p-3 bg-[var(--color-card)] rounded-lg border border-[var(--color-border)]"
                    >
                      <div className="w-6 h-6 bg-[var(--color-surface)] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <ClockIcon className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] text-[var(--color-text-tertiary)] font-mono">
                            {formatDate(event.created_at)}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${getStatusBadge(event.status).color}`}
                          >
                            {getStatusBadge(event.status).label}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--color-text)] font-medium">
                          {event.message}
                        </p>
                        {event.details?.spareparts &&
                          event.details.spareparts.length > 0 && (
                            <div className="mt-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
                              <p className="text-[10px] font-semibold text-purple-700 uppercase tracking-wider mb-1">
                                Item Sparepart yang Ditambahkan:
                              </p>
                              <ul className="space-y-0.5">
                                {event.details.spareparts.map(
                                  (sp: any, spIndex: number) => (
                                    <li
                                      key={spIndex}
                                      className="text-xs text-purple-700 flex items-center gap-1"
                                    >
                                      <span className="w-1 h-1 bg-purple-400 rounded-full" />
                                      {sp.name} ({sp.qty}x) @ Rp
                                      {sp.price.toLocaleString("id-ID")}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                        {event.details?.action === "qc_price_changes" &&
                          event.details.changes &&
                          event.details.changes.length > 0 && (
                            <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wider mb-1">
                                Perubahan Item oleh QC:
                              </p>
                              <ul className="space-y-0.5">
                                {event.details.changes.map(
                                  (change: string, changeIndex: number) => (
                                    <li
                                      key={changeIndex}
                                      className="text-xs text-amber-700 flex items-center gap-1"
                                    >
                                      <span className="w-1 h-1 bg-amber-400 rounded-full" />
                                      {change}
                                    </li>
                                  ),
                                )}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Photos */}
          {documentations.length > 0 && (
            <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
              <button
                onClick={() => toggleSection("photos")}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg flex items-center justify-center shadow-xs">
                    <ImageIcon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Dokumentasi
                  </h4>
                  <span className="text-[10px] bg-[var(--color-card)] text-[var(--color-text-tertiary)] px-2 py-0.5 rounded-full border border-[var(--color-border)]">
                    {documentations.length} foto
                  </span>
                </div>
                {expandedSections.photos ? (
                  <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
                )}
              </button>
              {expandedSections.photos && (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                  {documentations.map((doc, index) => (
                    <div
                      key={doc.id}
                      className="relative group cursor-pointer rounded-xl overflow-hidden border border-[var(--color-border)] aspect-square bg-[var(--color-card)]"
                    >
                      <img
                        src={doc.photo_url}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onClick={() => setPreviewPhotoIndex(index)}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                        <span className="text-[10px] text-white font-medium bg-black/50 px-1.5 py-0.5 rounded-md">
                          {doc.stage || "Progress"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Review Notes */}
          <div className="bg-[var(--color-surface)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-xs">
                <MessageSquare className="w-3.5 h-3.5 text-white" />
              </div>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                Review Notes
              </h4>
              <span className="text-[10px] text-red-500 font-medium">
                *wajib untuk penolakan
              </span>
            </div>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-[var(--color-border)] rounded-xl bg-[var(--color-card)] text-sm text-[var(--color-text)] focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none"
              placeholder="Masukkan catatan review..."
            />
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1.5 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Catatan akan dikirim ke teknisi
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex gap-3 bg-[var(--color-card)]/95 backdrop-blur-sm">
          <button
            onClick={() => handleReview("rejected")}
            disabled={processing}
            className="flex-1 bg-white text-red-600 font-semibold px-4 py-2.5 rounded-xl border-2 border-red-200 hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-xs"
          >
            {processing ? (
              <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ThumbsDown className="w-4 h-4" />
            )}
            Reject
          </button>
          <button
            onClick={() => handleReview("approved")}
            disabled={processing}
            className="flex-1 bg-gradient-to-br from-emerald-600 to-emerald-500 text-white font-semibold px-4 py-2.5 rounded-xl hover:from-emerald-700 hover:to-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {processing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <ThumbsUp className="w-4 h-4" />
            )}
            Approve
          </button>
        </div>
      </motion.div>

      {/* Photo Preview Modal */}
      {previewPhotoIndex !== null && documentations[previewPhotoIndex] && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[80] p-4"
          onClick={() => {
            setPreviewPhotoIndex(null);
            setPreviewZoomed(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="flex items-center gap-2">
                <span className="text-white text-sm">
                  {previewPhotoIndex + 1} / {documentations.length}
                </span>
                <span className="text-white/60 text-xs bg-white/10 px-2 py-0.5 rounded">
                  {documentations[previewPhotoIndex].stage}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    window.open(
                      documentations[previewPhotoIndex].photo_url,
                      "_blank",
                    )
                  }
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Download"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPreviewZoomed(!previewZoomed)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Zoom"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setPreviewPhotoIndex(null);
                    setPreviewZoomed(false);
                  }}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={documentations[previewPhotoIndex].photo_url}
              alt={`Photo ${previewPhotoIndex + 1}`}
              className={`max-w-full max-h-[75vh] rounded-lg object-contain transition-all duration-200 ${previewZoomed ? "scale-150 cursor-zoom-out" : "cursor-zoom-in"}`}
              onClick={() => setPreviewZoomed(!previewZoomed)}
            />
            {documentations.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-3">
                {documentations.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setPreviewPhotoIndex(i);
                      setPreviewZoomed(false);
                    }}
                    className={`w-2 h-2 rounded-full transition-all ${i === previewPhotoIndex ? "bg-white w-4" : "bg-white/40 hover:bg-white/60"}`}
                  />
                ))}
              </div>
            )}
            <div className="flex gap-4 mt-3">
              <button
                onClick={() => {
                  setPreviewPhotoIndex(Math.max(0, previewPhotoIndex - 1));
                  setPreviewZoomed(false);
                }}
                disabled={previewPhotoIndex === 0}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  setPreviewPhotoIndex(
                    Math.min(documentations.length - 1, previewPhotoIndex + 1),
                  );
                  setPreviewZoomed(false);
                }}
                disabled={previewPhotoIndex >= documentations.length - 1}
                className="px-4 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
