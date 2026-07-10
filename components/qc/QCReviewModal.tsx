"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import toast from "react-hot-toast";

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
  const [editingPrice, setEditingPrice] = useState<{ [key: number]: number }>(
    {},
  );
  const [localItems, setLocalItems] = useState<any[]>([]);
  const [customJasa, setCustomJasa] = useState({ name: "", price: 0 });
  const [showAddJasa, setShowAddJasa] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    items: true,
    timeline: true,
    photos: true,
  });
  const supabase = createClient();

  useEffect(() => {
    if (service) {
      fetchDetails();
    }
  }, [service]);

  const fetchDetails = async () => {
    setLoading(true);

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
    if (itemsRes.data) {
      setServiceItems(itemsRes.data);
      setLocalItems(JSON.parse(JSON.stringify(itemsRes.data)));
    }
    if (photosRes.data) setDocumentations(photosRes.data);

    setLoading(false);
  };

  const totalCost = localItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
    0,
  );

  const startEditPrice = (index: number, currentPrice: number) => {
    setEditingPrice({ ...editingPrice, [index]: currentPrice });
  };

  const savePrice = (index: number) => {
    const newPrice = editingPrice[index];
    if (newPrice === undefined || newPrice < 0) return;
    const updated = [...localItems];
    updated[index] = { ...updated[index], price: newPrice };
    setLocalItems(updated);
    const { [index]: _, ...rest } = editingPrice;
    setEditingPrice(rest);
  };

  const addCustomJasa = () => {
    if (!customJasa.name.trim() || customJasa.price <= 0) return;
    setLocalItems([
      ...localItems,
      {
        id: `custom_${Date.now()}`,
        name: customJasa.name.trim(),
        price: customJasa.price,
        quantity: 1,
        item_type: "jasa",
        notes: reviewNotes || null,
      },
    ]);
    setCustomJasa({ name: "", price: 0 });
    setShowAddJasa(false);
  };

  const handleReview = async (status: "approved" | "rejected") => {
    if (!service) return;

    if (status === "rejected" && !reviewNotes.trim()) {
      toast.error("Harap berikan alasan penolakan");
      return;
    }

    setProcessing(true);

    try {
      // Save item changes before updating status
      if (status === "approved" && localItems.length > 0) {
        // Delete all existing items and re-insert in batch
        await supabase
          .from("service_items")
          .delete()
          .eq("service_order_id", service.id);
        await supabase.from("service_items").insert(
          localItems.map((item: any) => ({
            service_order_id: service.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            item_type: item.item_type,
            notes: item.notes || null,
          })),
        );

        // Update final_cost on the service order
        const newTotal = localItems.reduce(
          (s: number, i: any) =>
            s + (parseFloat(i.price) || 0) * (i.quantity || 1),
          0,
        );
        await supabase
          .from("service_orders")
          .update({ final_cost: newTotal })
          .eq("id", service.id);
      }

      const newStatus =
        status === "approved" ? "completed" : "revision_required";

      const { error: updateError } = await supabase
        .from("service_orders")
        .update({
          status: newStatus,
          completed_at: status === "approved" ? new Date().toISOString() : null,
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
        message: message,
        details: {
          action: "qc_review",
          reviewer: reviewerName,
          revision: true,
        },
      });

      // Build notification
      let notifMsg =
        status === "approved"
          ? `Service ${service.invoice_number} telah disetujui oleh QC`
          : `Service ${service.invoice_number} ditolak QC. Alasan: ${reviewNotes}. Silakan perbaiki dan kirim kembali.`;

      // Detect item changes when approved
      if (status === "approved") {
        const changes: string[] = [];

        // Find deleted items
        for (const orig of serviceItems) {
          const stillExists = localItems.some(
            (item) => item.id === orig.id && item.name === orig.name,
          );
          if (!stillExists) {
            changes.push(
              `• ${orig.item_type === "jasa" ? "Jasa" : "Sparepart"} "${orig.name}" dihapus`,
            );
          }
        }

        // Find price changes and new items
        for (const curr of localItems) {
          const orig = serviceItems.find(
            (o: any) => o.id === curr.id && o.name === curr.name,
          );
          if (orig && orig.price !== curr.price) {
            changes.push(
              `• Harga ${curr.name}: Rp ${(orig.price || 0).toLocaleString()} → Rp ${(curr.price || 0).toLocaleString()}`,
            );
          }
          if (!orig) {
            changes.push(
              `• ${curr.item_type === "jasa" ? "Jasa" : "Sparepart"} baru: ${curr.name} Rp ${(curr.price || 0).toLocaleString()}`,
            );
          }
        }

        if (changes.length > 0) {
          notifMsg += "\n\nPerubahan oleh QC:\n" + changes.join("\n");

          // Fetch photos for activity detail
          const { data: photoDocs } = await supabase
            .from("service_documentation")
            .select("photo_url")
            .eq("service_order_id", service.id)
            .order("created_at", { ascending: true });

          // Also log to activity_logs so teknisi sees it
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
              changes: changes,
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

          // Edit Telegram caption to reflect revisions
          try {
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
            const now = new Date();
            const fmtDate = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} (${String(now.getMonth() + 1).padStart(2, "0")}), ${now.getFullYear()}`;

            const barangList =
              localItems
                .filter((i) => i.item_type === "sparepart")
                .map(
                  (i) =>
                    `• ${i.name} (${i.quantity}x) @Rp ${(i.price || 0).toLocaleString()}`,
                )
                .join("\n") || "—";
            const jasaList =
              localItems
                .filter((i) => i.item_type === "jasa")
                .map(
                  (i) =>
                    `• ${i.name} (${i.quantity}x) @Rp ${(i.price || 0).toLocaleString()}`,
                )
                .join("\n") || "—";
            const startDate = service.start_date
              ? new Date(service.start_date).toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "-";

            let dpText = "";
            let kekuranganText = "";
            const { data: dpData } = await supabase
              .from("layanan")
              .select("nominal")
              .eq("detail_sku", `DP - Invoice ${service.invoice_number}`)
              .maybeSingle();
            if (dpData && dpData.nominal) {
              const dpNominal = dpData.nominal;
              dpText = `\ndp: Rp ${dpNominal.toLocaleString("id-ID")}`;
              const selisih = totalCost - dpNominal;
              if (selisih > 0)
                kekuranganText = `\nkekurangan: Rp ${selisih.toLocaleString("id-ID")}`;
              else if (selisih < 0)
                kekuranganText = `\nreturn: Rp ${Math.abs(selisih).toLocaleString("id-ID")}`;
            }

            const revisiText =
              changes.length > 0 ? `\nrevisi : \n${changes.join(", ")}` : "";
            const newCaption = `UPDATE QC\nTeknisi : ${service.teknisi_name || service.assigned_teknisi_name || "-"}\nStart : ${startDate}\nDone : ${fmtDate}\npengerjaan :\nbarang:\n${barangList}\njasa:\n${jasaList}\ntotal: Rp ${totalCost.toLocaleString("id-ID")}${dpText}${kekuranganText}${revisiText}\nstatus : QC approve\nketerangan:`;

            const editRes = await fetch("/api/telegram/edit-caption", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                service_order_id: service.id,
                new_caption: newCaption,
              }),
            });
            if (!editRes.ok) {
              const errData = await editRes.json().catch(() => ({}));
              console.warn(
                "⚠️ Edit caption API error:",
                editRes.status,
                errData,
              );
              toast.error(
                "Gagal update caption Telegram: " +
                  (errData.error || editRes.statusText),
              );
            } else {
              console.log("✅ Telegram caption updated");
            }
          } catch (e: any) {
            console.warn("⚠️ Failed to edit Telegram caption:", e.message);
            toast.error("Gagal edit caption Telegram: " + e.message);
          }
        }
      }

      await supabase.from("notifications").insert({
        user_id: service.assigned_teknisi_id,
        title:
          status === "approved"
            ? "✅ Service Disetujui QC"
            : "🔄 Service Perlu Revisi",
        message: notifMsg,
        type: status === "approved" ? "success" : "warning",
        link: "/teknisi",
        is_read: false,
      });

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

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(nominal);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto" />
          <p className="mt-3 text-slate-500">Loading details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Review Service</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-400">
                {service.invoice_number}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs text-slate-400">
                {service.teknisi_name}
              </span>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                QC Pending
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Customer & Watch Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold">Customer</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama</span>
                  <span className="font-medium">{service.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">WhatsApp</span>
                  <span className="font-medium">
                    {service.customer_phone || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Serial</span>
                  <span className="font-mono text-sm">
                    {service.serial_number || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tanggal</span>
                  <span className="font-medium">
                    {formatDate(service.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Watch className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold">Watch</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Brand</span>
                  <span className="font-medium">
                    {service.watch_brand || service.device_brand || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Model</span>
                  <span className="font-medium">
                    {service.watch_model || service.device_model || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Movement</span>
                  <span className="font-medium capitalize">
                    {service.watch_movement || "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Condition</span>
                  <span className="font-medium capitalize">
                    {service.watch_condition || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Teknisi Info */}
          <div className="bg-[#F8F9FA] rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Wrench className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold">Teknisi</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-slate-500">Teknisi</p>
                <p className="font-medium">{service.teknisi_name || "-"}</p>
              </div>
              <div>
                <p className="text-slate-500">Start</p>
                <p className="font-medium">
                  {service.start_date ? formatDate(service.start_date) : "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Done</p>
                <p className="font-medium">
                  {service.done_date ? formatDate(service.done_date) : "-"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Duration</p>
                <p className="font-medium">{service.work_duration || "-"}</p>
              </div>
            </div>
          </div>

          {/* Service Details */}
          <div className="bg-[#F8F9FA] rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold">Service Details</h4>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-slate-500 mb-1">Issue</p>
                <p className="text-slate-800 bg-white p-2 rounded border border-slate-200">
                  {service.issue_description}
                </p>
              </div>
              {service.request && (
                <div>
                  <p className="text-slate-500 mb-1">Customer Request</p>
                  <p className="text-slate-800 bg-white p-2 rounded border border-slate-200">
                    {service.request}
                  </p>
                </div>
              )}
              {service.completion_notes && (
                <div>
                  <p className="text-slate-500 mb-1">Completion Notes</p>
                  <p className="text-slate-800 bg-white p-2 rounded border border-slate-200">
                    {service.completion_notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Service Items — editable */}
          <div className="bg-[#F8F9FA] rounded-lg p-4 border border-slate-200">
            <button
              onClick={() => toggleSection("items")}
              className="w-full flex items-center justify-between mb-3"
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold">
                  Items ({localItems.length})
                </h4>
              </div>
              {expandedSections.items ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {expandedSections.items && (
              <div className="space-y-2">
                {localItems.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-3">
                    Belum ada item
                  </p>
                ) : (
                  localItems.map((item, index) => {
                    const isEditing = editingPrice[index] !== undefined;
                    return (
                      <div
                        key={item.id || index}
                        className="flex items-center justify-between p-2 bg-white rounded border border-slate-200 gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${
                              item.item_type === "jasa"
                                ? "bg-pink-100 text-pink-700"
                                : "bg-purple-100 text-purple-700"
                            }`}
                          >
                            {item.item_type === "jasa" ? "JASA" : "SPR"}
                          </span>
                          <span className="text-sm font-medium truncate">
                            {item.name}
                          </span>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            x{item.quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <input
                                type="number"
                                value={editingPrice[index]}
                                onChange={(e) =>
                                  setEditingPrice({
                                    ...editingPrice,
                                    [index]: parseInt(e.target.value) || 0,
                                  })
                                }
                                className="w-20 px-1 py-0.5 text-xs border border-slate-200 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20 [appearance:textfield]"
                                onKeyDown={(e) =>
                                  e.key === "Enter" && savePrice(index)
                                }
                              />
                              <button
                                onClick={() => savePrice(index)}
                                className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  const { [index]: _, ...rest } = editingPrice;
                                  setEditingPrice(rest);
                                }}
                                className="p-0.5 text-slate-400 hover:bg-slate-100 rounded"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span
                                className="text-sm font-semibold cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() =>
                                  startEditPrice(index, item.price || 0)
                                }
                              >
                                {formatRupiah(item.price * item.quantity)}
                              </span>

                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div className="flex justify-between items-center p-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-lg font-bold">
                  <span>Total</span>
                  <span className="text-xl">{formatRupiah(totalCost)}</span>
                </div>

                {/* Tambah Jasa Custom */}
                {showAddJasa ? (
                  <div className="p-3 bg-white rounded border border-blue-200 space-y-2">
                    <p className="text-xs font-semibold text-blue-700">
                      Tambah Jasa Custom
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={customJasa.name}
                        onChange={(e) =>
                          setCustomJasa({ ...customJasa, name: e.target.value })
                        }
                        placeholder="Nama jasa..."
                        className="min-w-[140px] flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                        className="w-24 px-2 py-1.5 text-xs border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500/20 [appearance:textfield]"
                      />
                      <button
                        onClick={addCustomJasa}
                        disabled={
                          !customJasa.name.trim() || customJasa.price <= 0
                        }
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-all"
                      >
                        Tambah
                      </button>
                      <button
                        onClick={() => setShowAddJasa(false)}
                        className="px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddJasa(true)}
                    className="w-full py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg border border-dashed border-blue-200 transition-all"
                  >
                    + Tambah Jasa Custom
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-slate-200">
              <button
                onClick={() => toggleSection("timeline")}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-semibold">Timeline</h4>
                </div>
                {expandedSections.timeline ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {expandedSections.timeline && (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {timeline.map((item, index) => (
                    <div key={item.id} className="relative pl-6 pb-3 last:pb-0">
                      {index < timeline.length - 1 && (
                        <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-slate-200" />
                      )}
                      <div className="absolute left-0 top-1 w-3 h-3 rounded-full bg-blue-600" />
                      <div className="bg-white p-3 rounded-lg border border-slate-200 ml-2">
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                          <span className="text-xs text-slate-500">
                            {formatDate(item.created_at)}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${getStatusBadge(item.status).color}`}
                          >
                            {getStatusBadge(item.status).label}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800">{item.message}</p>
                        {item.photo_url && (
                          <div className="mt-2">
                            <img
                              src={item.photo_url}
                              alt="Timeline"
                              className="max-h-32 rounded border border-slate-200 object-cover cursor-pointer"
                              onClick={() =>
                                window.open(item.photo_url, "_blank")
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Photos */}
          {documentations.length > 0 && (
            <div className="bg-[#F8F9FA] rounded-lg p-4 border border-slate-200">
              <button
                onClick={() => toggleSection("photos")}
                className="w-full flex items-center justify-between mb-3"
              >
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-semibold">
                    Photos ({documentations.length})
                  </h4>
                </div>
                {expandedSections.photos ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>

              {expandedSections.photos && (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {documentations.map((doc, index) => (
                    <div key={doc.id} className="relative group cursor-pointer">
                      <img
                        src={doc.photo_url}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-slate-200 hover:shadow-md transition-all"
                        onClick={() => window.open(doc.photo_url, "_blank")}
                      />
                      <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                        {doc.stage || "Progress"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Review Notes */}
          <div className="bg-[#F8F9FA] rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <h4 className="text-sm font-semibold">
                Review Notes <span className="text-red-500 text-xs">*</span>
              </h4>
            </div>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all resize-none"
              placeholder="Masukkan catatan review (wajib untuk penolakan)..."
            />
            <p className="text-xs text-slate-400 mt-1">
              Catatan akan dikirim ke teknisi
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3 bg-white">
          <button
            onClick={() => handleReview("rejected")}
            disabled={processing}
            className="flex-1 bg-red-50 text-red-600 font-medium px-4 py-2.5 rounded-lg border border-red-200 hover:bg-red-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
            className="flex-1 bg-slate-900 text-white font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
    </div>
  );
}
