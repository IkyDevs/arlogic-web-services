"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import ServiceDetailModal from "./ServiceDetailModal";
import ServiceTimeline from "./ServiceTimeline";
import ProgressUpdate from "./ProgressUpdate";
import AddSparepartModal from "./AddSparepartModal";
import AddJasaModal from "./AddJasaModal";
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
  const [showAddSparepart, setShowAddSparepart] = useState(false);
  const [showAddJasa, setShowAddJasa] = useState(false);
  const [showRequestSparepart, setShowRequestSparepart] = useState(false);
  const [requestSparepartQuery, setRequestSparepartQuery] = useState("");
  const [loading, setLoading] = useState(true);
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
        for (const admin of admins) {
          await supabase.from("notifications").insert({
            user_id: admin.id,
            title: "⏰ Peringatan: PO Belum Direspon",
            message: `Teknisi ${user?.full_name} mengingatkan PO untuk ${service.po_sparepart} (${service.invoice_number}) belum direspon. Mohon segera ditindaklanjuti.`,
            type: "warning",
            link: "/admin",
            is_read: false,
          });
        }
      }
      toast.success("Peringatan terkirim ke admin!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const openAddSparepart = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowAddSparepart(true);
  };

  const openAddJasa = (service: ExtendedServiceOrder) => {
    setSelectedService(service);
    setShowAddJasa(true);
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
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 shadow-sm hover:shadow-md transition-all overflow-hidden"
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
                      <button onClick={() => openTimeline(service)}
                        className="px-3 py-1.5 text-xs bg-white dark:bg-[#1c1c1c] text-gray-900 dark:text-gray-100 font-medium border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> TIMELINE
                      </button>
                      {(service.status === "assigned" || service.status === "in_progress" || service.status === "revision_required") && (
                        <button onClick={() => openProgressUpdate(service)}
                          className="px-3 py-1.5 text-xs bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-all flex items-center gap-1">
                          <Wrench className="w-3.5 h-3.5" />
                          {service.status === "revision_required" ? "REVISI & KIRIM" : "UPDATE"}
                        </button>
                      )}
                      {(service.status === "req_sparepart_admin" || service.status === "po_pending") && (
                        <button onClick={() => sendReminderToAdmin(service)}
                          className="px-3 py-1.5 text-xs bg-yellow-500 text-white font-medium rounded-xl hover:bg-yellow-600 transition-all flex items-center gap-1">
                          <Bell className="w-3.5 h-3.5" /> REMINDER
                        </button>
                      )}
                      {service.status === "sparepart_ready" && (
                        <button onClick={() => openAddSparepart(service)}
                          className="px-3 py-1.5 text-xs bg-green-500 text-white font-medium rounded-xl hover:bg-green-600 transition-all flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" /> AMBIL
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

          {showTimelineModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowTimelineModal(false)}>
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

          {showProgressModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowProgressModal(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-white/10"
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
                  <button onClick={() => setShowProgressModal(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <ProgressUpdate service={selectedService} onUpdate={() => fetchQueues()}
                    onAddSparepart={() => { setShowProgressModal(false); openAddSparepart(selectedService); }}
                    onAddJasa={() => { setShowProgressModal(false); openAddJasa(selectedService); }}
                    onSubmitToQC={() => handleSubmitToQC(selectedService)} />
                </div>
              </motion.div>
            </div>
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
                toast.success("Sparepart berhasil ditambahkan ke service");
              }}
              onRequestSparepart={(query: string) => {
                setShowAddSparepart(false);
                openRequestSparepart(selectedService, query);
              }}
            />
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
