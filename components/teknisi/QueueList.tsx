"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { ServiceOrder } from "@/types";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Clock,
  Wrench,
  Calendar,
  User,
  Watch,
  Eye,
  Package,
  AlertCircle,
  Phone,
  MessageSquare,
  ShoppingCart,
  Truck,
  X,
  ChevronRight,
  RefreshCw,
  FileText,
  Box,
  Bell,
  Camera,
  Check,
  Trash2,
  Loader,
  ImageIcon,
} from "lucide-react";
import ServiceDetailModal from "./ServiceDetailModal";
import ServiceTimeline from "./ServiceTimeline";
import ProgressUpdate from "./ProgressUpdate";

import AddJasaModal from "./AddJasaModal";
import AddSparepartModal from "./AddSparepartModal";
import RequestSparepartModal from "./RequestSparepartModal";

interface QueueListProps {
  teknisiId: string;
  onTakeProject: (project: ServiceOrder) => void;
}

interface ExtendedServiceOrder extends ServiceOrder {
  last_update?: {
    id: string;
    message: string;
    status: string;
    created_at: string;
    photo_url?: string;
  };
}

export default function QueueList({
  teknisiId,
  onTakeProject,
}: QueueListProps) {
  const [pendingServices, setPendingServices] = useState<
    ExtendedServiceOrder[]
  >([]);
  const [myServices, setMyServices] = useState<ExtendedServiceOrder[]>([]);
  const [selectedService, setSelectedService] =
    useState<ExtendedServiceOrder | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showTimelineModal, setShowTimelineModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);

  const [showAddJasa, setShowAddJasa] = useState(false);
  const [showAddSparepart, setShowAddSparepart] = useState(false);
  const [showRequestSparepart, setShowRequestSparepart] = useState(false);
  const [requestSparepartQuery, setRequestSparepartQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showSubmitQCModal, setShowSubmitQCModal] = useState(false);
  const [showServiceInfoModal, setShowServiceInfoModal] = useState(false);
  const [qcPhotos, setQCPhotos] = useState<File[]>([]);
  const [qcPhotoPreviews, setQCPhotoPreviews] = useState<string[]>([]);
  const [qcItems, setQCItems] = useState<any[]>([]);
  const [qcTotalCost, setQCTotalCost] = useState(0);
  const [qcSubmitting, setQCSubmitting] = useState(false);
  const [qcNotes, setQCNotes] = useState("");
  const qcFileInputRef = useRef<HTMLInputElement>(null);
  const [editingPrice, setEditingPrice] = useState<{ [key: number]: number }>({});
  const qcInitialItemsRef = useRef<any[]>([]);
  const [serviceInfoPhotos, setServiceInfoPhotos] = useState<string[]>([]);
  const [serviceInfoPhotosLoading, setServiceInfoPhotosLoading] =
    useState(false);

  const supabase = createClient();
  const { user } = useAuthStore();

  useEffect(() => {
    fetchQueues();

    const subscription = supabase
      .channel("service_orders_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_orders" },
        () => {
          fetchQueues();
        },
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [teknisiId]);

  const fetchQueues = async () => {
    setLoading(true);

    const { data: pending } = await supabase
      .from("service_orders")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    const { data: assigned } = await supabase
      .from("service_orders")
      .select("*")
      .eq("assigned_teknisi_id", teknisiId)
      .in("status", [
        "assigned",
        "in_progress",
        "req_sparepart_admin",
        "po_pending",
        "sparepart_ready",
        "revision_required",
      ])
      .order("created_at", { ascending: false });

    if (assigned && assigned.length > 0) {
      for (const service of assigned) {
        const { data: timeline } = await supabase
          .from("service_timeline")
          .select("*")
          .eq("service_order_id", service.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (timeline && timeline.length > 0) {
          (service as ExtendedServiceOrder).last_update = timeline[0];
        }
      }
    }

    if (pending) setPendingServices(pending as ExtendedServiceOrder[]);
    if (assigned) setMyServices(assigned as ExtendedServiceOrder[]);
    setLoading(false);
  };

  const takeProject = async (service: ExtendedServiceOrder) => {
    const { error } = await supabase
      .from("service_orders")
      .update({
        assigned_teknisi_id: teknisiId,
        status: "assigned",
        start_date: new Date().toISOString(),
      })
      .eq("id", service.id);

    if (error) {
      toast.error("Gagal mengambil proyek");
    } else {
      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: teknisiId,
        status: "assigned",
        message: `Service diambil oleh teknisi`,
        details: { action: "take_project" },
      });

      toast.success("Proyek berhasil diambil!");
      fetchQueues();
      setShowDetailModal(false);
    }
  };

  const sendReminderToAdmin = async (service: ExtendedServiceOrder) => {
    try {
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const notifications: any[] = []
        for (const admin of admins) {
          notifications.push({
            user_id: admin.id,
            title: '⏰ Reminder: PO Belum Direspon',
            message: `PO untuk ${service.invoice_number} (${service.po_sparepart}) belum direspon oleh admin.`,
            type: 'warning',
            link: '/admin',
            is_read: false
          })
        }
        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications)
        }
      }
      toast.success("Peringatan terkirim ke admin!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openAddJasa = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowAddJasa(true);
  };

  const openAddSparepart = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowAddSparepart(true);
  };

  const openRequestSparepart = (
    service: ExtendedServiceOrder,
    query?: string,
  ) => {
    setSelectedService(service);
    setRequestSparepartQuery(query || "");
    setShowRequestSparepart(true);
  };

  const openProgressUpdate = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowProgressModal(true);
  };

  const openUpdate = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowUpdateModal(true);
  };

  const openSubmitQC = async (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setQCPhotos([]);
    setQCPhotoPreviews([]);
    await fetchQCItems(service.id);
    setShowSubmitQCModal(true);
  };

  const fetchQCItems = async (serviceId: string) => {
    const { data } = await supabase
      .from("service_items")
      .select("*")
      .eq("service_order_id", serviceId);
    if (data) {
      setQCItems(data);
      qcInitialItemsRef.current = JSON.parse(JSON.stringify(data));
      setQCTotalCost(
        data.reduce(
          (sum, item) => sum + (item.price || 0) * (item.quantity || 1),
          0,
        ),
      );
    } else {
      setQCItems([]);
      setQCTotalCost(0);
    }
  };

  const handleQCPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos = [...qcPhotos, ...files];
    setQCPhotos(newPhotos);
    const newPreviews = files.map((f) => URL.createObjectURL(f));
    setQCPhotoPreviews([...qcPhotoPreviews, ...newPreviews]);
  };

  const removeQCPhoto = (index: number) => {
    URL.revokeObjectURL(qcPhotoPreviews[index]);
    setQCPhotos(qcPhotos.filter((_, i) => i !== index));
    setQCPhotoPreviews(qcPhotoPreviews.filter((_, i) => i !== index));
  };

  const deleteQCItem = (index: number) => {
    const updated = qcItems.filter((_, i) => i !== index);
    setQCItems(updated);
    setQCTotalCost(updated.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0));
  };

  const startEditPrice = (index: number, currentPrice: number) => {
    setEditingPrice({ ...editingPrice, [index]: currentPrice });
  };

  const savePrice = (index: number) => {
    const newPrice = editingPrice[index];
    if (newPrice === undefined || newPrice < 0) return;
    const updated = qcItems.map((item, i) =>
      i === index ? { ...item, price: newPrice } : item
    );
    setQCItems(updated);
    setQCTotalCost(updated.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0));
    const { [index]: _, ...rest } = editingPrice;
    setEditingPrice(rest);
  };

  const handleSubmitQC = async () => {
    if (!selectedService || !user) return;
    setQCSubmitting(true);
    try {
      if (qcPhotos.length > 10) {
        toast.error("Maksimal 10 foto untuk submit QC");
        setQCSubmitting(false);
        return;
      }
      // Build caption
      const now = new Date();
      const dayNames = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
      const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
      const fmtDate = `${dayNames[now.getDay()]}, ${now.getDate()} ${monthNames[now.getMonth()]} (${String(now.getMonth()+1).padStart(2,"0")}), ${now.getFullYear()}`;

      const barangList = qcItems.filter((i) => i.item_type === "sparepart").map((i) => `• ${i.name} (${i.quantity}x) @Rp ${(i.price || 0).toLocaleString()}`).join("\n") || "—";
      const jasaList = qcItems.filter((i) => i.item_type === "jasa").map((i) => `• ${i.name} (${i.quantity}x) @Rp ${(i.price || 0).toLocaleString()}`).join("\n") || "—";

      const startDate = selectedService.start_date ? new Date(selectedService.start_date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "-";

      // Check for DP
      let dpText = "";
      let kekuranganText = "";
      try {
        const { data: dpData } = await supabase
          .from("layanan")
          .select("nominal")
          .eq("detail_sku", `DP - Invoice ${selectedService.invoice_number}`)
          .maybeSingle();
        if (dpData && dpData.nominal) {
          const dpNominal = dpData.nominal || 0;
          dpText = `\ndp: Rp ${dpNominal.toLocaleString("id-ID")}`;
          const selisih = qcTotalCost - dpNominal;
          if (selisih > 0) {
            kekuranganText = `\nkekurangan: Rp ${selisih.toLocaleString("id-ID")}`;
          } else if (selisih < 0) {
            kekuranganText = `\nreturn: Rp ${Math.abs(selisih).toLocaleString("id-ID")}`;
          }
        }
      } catch { /* ignore */ }

      const captionHeader = selectedService.status === "revision_required" ? "UPDATE QC AFTER REJECT QC" : "UPDATE QC";
      const teknisiNotes = qcNotes.trim() ? `\n\nKeterangan Teknisi :\n${qcNotes.trim()}` : "";
      const caption = `${captionHeader}

Status : Menunggu QC

Teknisi : ${user?.full_name || "-"}

Pelanggan : ${selectedService.customer_name || "-"}
No. HP : ${selectedService.customer_phone || "-"}
Brand Jam : ${selectedService.watch_brand || "-"}
Tipe Jam : ${selectedService.watch_model || "-"}

Start : ${startDate}

Done : ${fmtDate}

Rincian Item

Barang:
${barangList}

Jasa:
${jasaList}

Total : Rp ${qcTotalCost.toLocaleString("id-ID")}${dpText}${kekuranganText}${teknisiNotes}`;

      const uploadedUrls: string[] = [];
      let firstChatId = '';
      let firstMessageId = 0;
      const formData = new FormData();
      for (let i = 0; i < qcPhotos.length; i++) {
        formData.append("files", qcPhotos[i]);
      }
      formData.append("type", "qc_update");
      formData.append("caption", caption);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.urls && data.urls.length > 0) {
        for (let i = 0; i < data.urls.length; i++) {
          const chatId = data.messages?.[i]?.chat_id || '';
          const messageId = data.messages?.[i]?.message_id || 0;
          uploadedUrls.push(data.urls[i]);
          if (!firstChatId && chatId) { firstChatId = chatId; firstMessageId = messageId; }
          await supabase.from("service_documentation").insert({
            service_order_id: selectedService.id,
            photo_url: data.urls[i],
            stage: "qc",
            uploaded_by: user.id,
            telegram_chat_id: chatId,
            telegram_message_id: messageId,
          });
        }
      }

      const { error } = await supabase
        .from("service_orders")
        .update({
          status: "qc_pending",
          done_date: new Date().toISOString(),
          work_duration: selectedService.start_date
            ? Math.ceil((new Date().getTime() - new Date(selectedService.start_date).getTime()) / (1000 * 60 * 60 * 24))
            : null,
          qc_submit_notes: qcNotes || null,
        })
        .eq("id", selectedService.id);

      if (error) throw error;

      // Detect changes from initial items
      const initialItems = qcInitialItemsRef.current;
      const deletedItems: string[] = [];
      const priceChanges: string[] = [];

      for (const orig of initialItems) {
        const stillExists = qcItems.some((item) => item.id === orig.id && item.name === orig.name);
        if (!stillExists) {
          deletedItems.push(`${orig.item_type === "jasa" ? "jasa" : "sparepart"} ${orig.name}`);
        }
      }

      for (const curr of qcItems) {
        const orig = initialItems.find((o: any) => o.id === curr.id && o.name === curr.name);
        if (orig && orig.price !== curr.price) {
          priceChanges.push(`${curr.name}: Rp ${(orig.price || 0).toLocaleString()} → Rp ${(curr.price || 0).toLocaleString()}`);
        }
      }

      let changeMsg = "";
      if (deletedItems.length > 0) changeMsg += `menghapus ${deletedItems.join(", ")}. `;
      if (priceChanges.length > 0) changeMsg += `mengubah harga ${priceChanges.join(", ")}. `;
      if (changeMsg) changeMsg = changeMsg.trim() + " ";

      await supabase.from("service_timeline").insert({
        service_order_id: selectedService.id,
        teknisi_id: teknisiId,
        status: "qc_pending",
        message: `${changeMsg}Service telah selesai dan dikirim ke QC oleh teknisi${
          uploadedUrls.length > 0
            ? ` (${uploadedUrls.length} foto)`
            : ""
        }`,
        details: {
          action: "submit_to_qc",
          photos_count: uploadedUrls.length,
          total_cost: qcTotalCost,
        },
      });

      toast.success("Service berhasil dikirim ke QC!");
      setShowSubmitQCModal(false);
      setQCPhotos([]);
      setQCPhotoPreviews([]);
      setQCNotes("");
      fetchQueues();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setQCSubmitting(false);
    }
  };

  const viewMyServiceInfo = async (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setServiceInfoPhotosLoading(true);
    setShowServiceInfoModal(true);

    const { data } = await supabase
      .from("service_documentation")
      .select("photo_url")
      .eq("service_order_id", service.id)
      .order("created_at", { ascending: true });

    if (data) {
      setServiceInfoPhotos(data.map((p) => p.photo_url));
    }
    setServiceInfoPhotosLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string }> = {
      assigned: {
        label: "DITUGASKAN",
        color: "bg-blue-100 text-blue-700 border-blue-200",
      },
      in_progress: {
        label: "DALAM PENGERJAAN",
        color: "bg-yellow-100 text-yellow-700 border-yellow-200",
      },
      req_sparepart_admin: {
        label: "REQUEST PO",
        color: "bg-orange-100 text-orange-700 border-orange-200",
      },
      po_pending: {
        label: "PO PENDING",
        color: "bg-purple-100 text-purple-700 border-purple-200",
      },
      sparepart_ready: {
        label: "SPAREPART READY",
        color: "bg-green-100 text-green-700 border-green-200",
      },
      qc_pending: {
        label: "SIAP QC",
        color: "bg-indigo-100 text-indigo-700 border-indigo-200",
      },
      revision_required: {
        label: "PERLU REVISI",
        color: "bg-red-100 text-red-700 border-red-200",
      },
      pending: {
        label: "MENUNGGU",
        color: "bg-gray-100 text-gray-700 border-gray-200",
      },
      completed: {
        label: "SELESAI",
        color: "bg-green-100 text-green-700 border-green-200",
      },
    };
    return (
      badges[status] || {
        label: status.toUpperCase(),
        color: "bg-slate-100 text-slate-700",
      }
    );
  };

  const viewServiceDetails = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowDetailModal(true);
  };

  const openTimeline = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowTimelineModal(true);
  };

  const handleSubmitToQC = async (service: ExtendedServiceOrder) => {
    try {
      const { error } = await supabase
        .from("service_orders")
        .update({ status: "qc_pending" })
        .eq("id", service.id);

      if (error) throw error;

      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: teknisiId,
        status: "qc_pending",
        message: `Service telah selesai dan dikirim ke QC oleh teknisi`,
        details: { action: "submit_to_qc" },
      });

      toast.success("Service berhasil dikirim ke QC!");
      setShowProgressModal(false);
      fetchQueues();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
        <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        <p className="mt-3 text-sm font-medium text-gray-500">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* My Current Projects Section */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center flex-shrink-0">
            <Wrench className="w-4 h-4 text-white dark:text-gray-900" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Proyek Saya ({myServices.length})
          </h3>
        </div>

        {myServices.length === 0 ? (
          <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-8 text-center shadow-sm">
            <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium text-gray-500">Belum ada proyek yang diambil</p>
            <p className="text-xs text-gray-400 mt-1">Ambil proyek dari daftar di bawah</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {myServices.map((service, index) => {
              const statusBadge = getStatusBadge(service.status);
              const lastUpdateMessage = service.last_update?.message || "Belum ada update";

              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => viewMyServiceInfo(service)}
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer"
                >
                  <div className="p-4 space-y-3">
                    {/* Row 1: Invoice + Status badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-0.5 bg-gray-900 text-white text-xs font-mono rounded-md">
                        {service.invoice_number}
                      </span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                      {service.status === "revision_required" && (
                        <span className="px-2 py-0.5 text-xs bg-red-600 text-white font-bold rounded-full border border-red-700">
                          REJECT QC
                        </span>
                      )}
                      {service.status === "req_sparepart_admin" && (
                        <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full border border-orange-200">⏳ Menunggu Admin</span>
                      )}
                      {service.status === "po_pending" && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full border border-purple-200">📦 PO Diproses</span>
                      )}
                      {service.status === "sparepart_ready" && (
                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full border border-green-200">✅ Siap Diambil</span>
                      )}
                      {service.last_update && (
                        <span className="text-xs text-gray-400 ml-auto">{new Date(service.last_update.created_at).toLocaleDateString()}</span>
                      )}
                    </div>

                    {/* Row 2: Customer + Watch (full width) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                        <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Customer</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{service.customer_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2.5 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
                        <Watch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">Device</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{service.watch_brand || service.device_brand}{" "}{service.watch_model || service.device_model}</p>
                        </div>
                      </div>
                    </div>

                    {/* Row 3: Issue description */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{service.issue_description}</p>

                    {service.last_update && (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>Terakhir: {lastUpdateMessage}</span>
                      </div>
                    )}

                    {/* Row 4: Action buttons — always at bottom */}
                    <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-100 dark:border-white/5">
                      {(service.status === "assigned" || service.status === "in_progress" || service.status === "revision_required") && (
                        <>
                          <button onClick={(e) => { e.stopPropagation(); openUpdate(service); }}
                            className="px-3 py-1.5 text-xs bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all flex items-center gap-1">
                            <Wrench className="w-3.5 h-3.5" /> UPDATE
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); openSubmitQC(service); }}
                            className="px-3 py-1.5 text-xs bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> SUBMIT QC
                          </button>
                        </>
                      )}
                      {(service.status === "req_sparepart_admin" || service.status === "po_pending") && (
                        <button onClick={(e) => { e.stopPropagation(); sendReminderToAdmin(service); }}
                          className="px-3 py-1.5 text-xs bg-yellow-500 text-white font-medium rounded-xl hover:bg-yellow-600 transition-all flex items-center gap-1">
                          <Bell className="w-3.5 h-3.5" /> REMINDER
                        </button>
                      )}
                      {service.status === "qc_pending" && (
                        <span className="px-3 py-1.5 text-xs bg-purple-100 text-purple-700 border border-purple-300 rounded-xl flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5" /> QC
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Available Queue Section - NEW SERVICES */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center flex-shrink-0">
            <Package className="w-4 h-4 text-white dark:text-gray-900" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Service Baru ({pendingServices.length})
          </h3>
        </div>

        {pendingServices.length === 0 ? (
          <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-8 text-center shadow-sm">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p className="text-sm font-medium text-gray-500">Tidak ada service baru</p>
            <p className="text-xs text-gray-400 mt-1">Semua service sudah diambil</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingServices.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-gray-900 dark:hover:border-white"
                onClick={() => viewServiceDetails(service)}
              >
                <div className="p-4">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-gray-900 text-white text-xs font-mono rounded-md">
                          {service.invoice_number}
                        </span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full border border-green-200">BARU</span>
                      </div>

                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5 text-sm">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900 dark:text-gray-100">{service.customer_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Watch className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-400">{service.watch_brand || service.device_brand}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-gray-500">
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                          <span className="line-clamp-1">{service.issue_description?.substring(0, 50)}...</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); viewServiceDetails(service); }}
                        className="px-3 py-1.5 text-sm bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all flex items-center gap-1">
                        <Eye className="w-4 h-4" /> DETAIL
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* All Modals */}
      {selectedService && (
        <>
          <ServiceDetailModal
            isOpen={showDetailModal}
            onClose={() => setShowDetailModal(false)}
            service={selectedService}
            onTake={() => takeProject(selectedService)}
            onSkip={() => setShowDetailModal(false)}
          />

          {/* UPDATE MODAL — combines Timeline + Add Jasa + Add Sparepart */}
          {showUpdateModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setShowUpdateModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10"
                onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-white dark:text-gray-900" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Update Service</h2>
                      <p className="text-xs text-gray-500">{selectedService.invoice_number}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowUpdateModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <ServiceTimeline
                    serviceId={selectedService.id}
                    customerPhone={selectedService.customer_phone}
                    customerName={selectedService.customer_name}
                    invoiceNumber={selectedService.invoice_number}
                    onUpdate={() => fetchQueues()}
                  />

                  <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-white/10">
                    <button onClick={() => { setShowUpdateModal(false); openAddJasa(selectedService); }}
                      className="flex items-center justify-center gap-2 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all text-sm">
                      <Wrench className="w-4 h-4" /> TAMBAH JASA
                    </button>

                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* PROGRESS (legacy) MODAL */}
          {showProgressModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setShowProgressModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10"
                onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-white dark:text-gray-900" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Detail Update</h2>
                      <p className="text-xs text-gray-500">{selectedService.invoice_number}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowProgressModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <ProgressUpdate service={selectedService} onUpdate={() => fetchQueues()}
                    onAddJasa={() => { setShowProgressModal(false); openAddJasa(selectedService); }}
                    onAddSparepart={() => { setShowProgressModal(false); openAddSparepart(selectedService); }}
                    onSubmitToQC={() => handleSubmitToQC(selectedService)} />
                </div>
              </motion.div>
            </div>
          )}

          {/* SUBMIT QC MODAL */}
          {showSubmitQCModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setShowSubmitQCModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10"
                onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Submit QC</h2>
                      <p className="text-xs text-gray-500">{selectedService.invoice_number}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowSubmitQCModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Summary */}
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Invoice</span>
                      <span className="text-xs font-mono font-medium text-gray-900 dark:text-gray-100">{selectedService.invoice_number}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Customer</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedService.customer_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Device</span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{selectedService.watch_brand || selectedService.device_brand}</span>
                    </div>
                  </div>

                  {/* Items List */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      Daftar Item
                    </h4>
                    {qcItems.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-3">Belum ada item</p>
                    ) : (
                      <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
                        <div className="divide-y divide-gray-200 dark:divide-white/10">
                          {qcItems.map((item, i) => {
                            const isEditing = editingPrice[i] !== undefined;
                            return (
                              <div key={item.id || i} className="flex items-center justify-between px-4 py-2 gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${item.item_type === "jasa" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                    {item.item_type === "jasa" ? "JASA" : "SPR"}
                                  </span>
                                  <span className="text-sm text-gray-900 dark:text-gray-100 truncate">{item.name}</span>
                                  <span className="text-xs text-gray-400 flex-shrink-0">{item.quantity}x</span>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {isEditing ? (
                                    <>
                                      <input type="number"
                                        value={editingPrice[i]}
                                        onChange={(e) => setEditingPrice({ ...editingPrice, [i]: parseInt(e.target.value) || 0 })}
                                        className="w-20 px-1.5 py-0.5 text-xs border border-gray-200 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-indigo-500/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        onKeyDown={(e) => e.key === "Enter" && savePrice(i)} />
                                      <button onClick={() => savePrice(i)} className="p-0.5 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => { const { [i]: _, ...rest } = editingPrice; setEditingPrice(rest); }} className="p-0.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => startEditPrice(i, item.price || 0)} className="text-xs font-semibold text-gray-900 dark:text-gray-100 hover:text-indigo-600 transition-colors">
                                        Rp {(item.price * item.quantity).toLocaleString()}
                                      </button>
                                      <button onClick={() => deleteQCItem(i)} className="p-0.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="bg-gray-50 dark:bg-white/5 px-4 py-3 border-t border-gray-200 dark:border-white/10 flex justify-between items-center">
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">Total Biaya</span>
                          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                            Rp {qcTotalCost.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Photo Upload */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                      <Camera className="w-4 h-4 text-gray-400" />
                      Foto Hasil Service
                    </h4>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {qcPhotoPreviews.map((preview, i) => (
                        <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50">
                          <img src={preview} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => removeQCPhoto(i)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => qcFileInputRef.current?.click()}
                        className="aspect-square border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg flex items-center justify-center hover:border-gray-900 dark:hover:border-white transition-colors bg-gray-50 dark:bg-white/5">
                        <Camera className="w-6 h-6 text-gray-300" />
                      </button>
                      <input ref={qcFileInputRef} type="file" accept="image/*" multiple onChange={handleQCPhotoUpload} className="hidden" />
                    </div>
                    <p className="text-xs text-gray-400">Tambahkan foto hasil service sebagai bukti QC</p>
                  </div>

                  {/* Catatan Teknisi */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      Catatan Teknisi <span className="text-xs text-gray-400 font-normal">(opsional)</span>
                    </h4>
                    <textarea value={qcNotes} onChange={(e) => setQCNotes(e.target.value)}
                      rows={2} className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                      placeholder="Catatan untuk QC..." />
                  </div>

                  {/* Submit */}
                  <button onClick={handleSubmitQC} disabled={qcSubmitting}
                    className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
                    {qcSubmitting ? (
                      <><Loader className="w-4 h-4 animate-spin" /> MENGIRIM...</>
                    ) : (
                      <><CheckCircle className="w-4 h-4" /> KIRIM KE QC</>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* SERVICE INFO MODAL — card click on my services */}
          {showServiceInfoModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => { setShowServiceInfoModal(false); setServiceInfoPhotos([]); }}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10"
                onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                      <Watch className="w-4 h-4 text-white dark:text-gray-900" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Detail Service</h2>
                      <p className="text-xs text-gray-500">{selectedService.invoice_number}</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowServiceInfoModal(false); setServiceInfoPhotos([]); }}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                  {/* Photos */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Camera className="w-4 h-4 text-gray-600" />
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dokumentasi Service</h4>
                      {serviceInfoPhotos.length > 0 && (
                        <span className="text-xs text-gray-400 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">
                          {serviceInfoPhotos.length} foto
                        </span>
                      )}
                    </div>
                    {serviceInfoPhotosLoading ? (
                      <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-6 text-center border border-gray-200 dark:border-white/10">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin mx-auto" />
                        <p className="text-xs text-gray-400 mt-2">Memuat foto...</p>
                      </div>
                    ) : serviceInfoPhotos.length === 0 ? (
                      <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-6 text-center border border-dashed border-gray-200 dark:border-white/10">
                        <ImageIcon className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                        <p className="text-xs text-gray-400">Belum ada foto dokumentasi</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {serviceInfoPhotos.map((photo, i) => (
                          <div key={i} className="aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(photo, "_blank")}>
                            <img src={photo} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Invoice</span>
                      <span className="text-xs font-mono font-medium text-gray-900 dark:text-gray-100">{selectedService.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Status</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusBadge(selectedService.status).color}`}>
                        {getStatusBadge(selectedService.status).label}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Customer</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedService.customer_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Phone</span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{selectedService.customer_phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Device</span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{selectedService.watch_brand || selectedService.device_brand} {selectedService.watch_model || selectedService.device_model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500">Tanggal Masuk</span>
                      <span className="text-sm text-gray-900 dark:text-gray-100">{new Date(selectedService.created_at).toLocaleDateString("id-ID")}</span>
                    </div>
                  </div>

                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-200 dark:border-white/10">
                    <h4 className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">Deskripsi Kerusakan</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedService.issue_description}</p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* LEGACY TIMELINE MODAL */}
          {showTimelineModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setShowTimelineModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10"
                onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Timeline Service</h2>
                    <p className="text-xs text-gray-500">{selectedService.invoice_number}</p>
                  </div>
                  <button onClick={() => setShowTimelineModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <ServiceTimeline serviceId={selectedService.id} customerPhone={selectedService.customer_phone} customerName={selectedService.customer_name} invoiceNumber={selectedService.invoice_number} onUpdate={() => fetchQueues()} />
                </div>
              </motion.div>
            </div>
          )}



          {showAddJasa && (
            <AddJasaModal
              isOpen={showAddJasa}
              onClose={() => {
                setShowAddJasa(false);
                setSelectedService(null);
              }}
              service={selectedService}
              onSuccess={() => {
                setShowAddJasa(false);
                setSelectedService(null);
                fetchQueues();
                toast.success("Jasa berhasil ditambahkan ke service");
              }}
            />
          )}

          {showAddSparepart && (
            <AddSparepartModal
              isOpen={showAddSparepart}
              onClose={() => {
                setShowAddSparepart(false);
                setSelectedService(null);
              }}
              service={selectedService}
              onSuccess={() => {
                setShowAddSparepart(false);
                setSelectedService(null);
                fetchQueues();
              }}
            />
          )}

          {showRequestSparepart && (
            <RequestSparepartModal
              isOpen={showRequestSparepart}
              onClose={() => {
                setShowRequestSparepart(false);
                setSelectedService(null);
              }}
              service={selectedService}
              onSuccess={() => {
                setShowRequestSparepart(false);
                setSelectedService(null);
                fetchQueues();
                toast.success("Request sparepart terkirim!");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
