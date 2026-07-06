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
        color: "bg-slate-100 text-slate-700 border-slate-200",
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
      <div className="border border-slate-200 p-8 text-center">
        <div className="inline-block w-6 h-6 border border-slate-200 border-t-transparent rounded-full animate-spin" />
        <p className="mt-2 font-mono">LOADING...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* My Current Projects Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#2563eb] flex items-center justify-center border border-slate-200">
            <Wrench className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-xl font-black">
            PROYEK SAYA ({myServices.length})
          </h3>
        </div>

        {myServices.length === 0 ? (
          <div className="border border-slate-200 p-8 text-center bg-slate-50">
            <Package className="w-12 h-12 mx-auto mb-2 text-slate-400" />
            <p className="font-mono">Belum ada proyek yang diambil</p>
            <p className="text-xs text-slate-500">
              Ambil proyek dari daftar di bawah
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {myServices.map((service, index) => {
              const statusBadge = getStatusBadge(service.status);
              const lastUpdateMessage =
                service.last_update?.message || "Belum ada update";

              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex flex-wrap justify-between items-start gap-3">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-slate-900 text-white text-xs font-mono rounded">
                            {service.invoice_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full border ${statusBadge.color}`}
                          >
                            {statusBadge.label}
                          </span>
                          {service.status === "req_sparepart_admin" && (
                            <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                              ⏳ Menunggu Admin
                            </span>
                          )}
                          {service.status === "po_pending" && (
                            <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                              📦 PO Diproses
                            </span>
                          )}
                          {service.status === "sparepart_ready" && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full border border-green-200">
                              ✅ Siap Diambil
                            </span>
                          )}
                          {service.last_update && (
                            <span className="text-xs text-slate-400">
                              Update:{" "}
                              {new Date(
                                service.last_update.created_at,
                              ).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <div className="flex items-center gap-1 text-sm">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">
                              {service.customer_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <Watch className="w-4 h-4 text-slate-400" />
                            <span>
                              {service.watch_brand || service.device_brand}{" "}
                              {service.watch_model || service.device_model}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-slate-600 line-clamp-2 mb-2">
                          {service.issue_description}
                        </p>

                        {service.last_update && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                            <Clock className="w-3 h-3" />
                            <span>Terakhir: {lastUpdateMessage}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {/* Timeline - Selalu muncul */}
                        <button
                          onClick={() => openTimeline(service)}
                          className="px-3 py-1.5 text-sm bg-white text-slate-900 font-medium border border-slate-200 rounded-lg hover:bg-slate-50 transition-all flex items-center gap-1"
                        >
                          <Clock className="w-4 h-4" />
                          TIMELINE
                        </button>

                        {/* UPDATE SERVICE - Untuk assigned, in_progress, dan revision_required */}
                        {(service.status === "assigned" ||
                          service.status === "in_progress" ||
                          service.status === "revision_required") && (
                          <button
                            onClick={() => openProgressUpdate(service)}
                            className="px-3 py-1.5 text-sm bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1"
                          >
                            <Wrench className="w-4 h-4" />
                            {service.status === "revision_required"
                              ? "REVISI & KIRIM"
                              : "UPDATE SERVICE"}
                          </button>
                        )}

                        {/* REMINDER - Untuk req_sparepart_admin dan po_pending */}
                        {(service.status === "req_sparepart_admin" ||
                          service.status === "po_pending") && (
                          <button
                            onClick={() => sendReminderToAdmin(service)}
                            className="px-3 py-1.5 text-sm bg-yellow-500 text-white font-medium rounded-lg hover:bg-yellow-600 transition-all flex items-center gap-1"
                            title="Kirim peringatan ke admin"
                          >
                            <Bell className="w-4 h-4" />
                            REMINDER
                          </button>
                        )}

                        {/* AMBIL SPAREPART - Hanya untuk sparepart_ready */}
                        {service.status === "sparepart_ready" && (
                          <button
                            onClick={() => openAddSparepart(service)}
                            className="px-3 py-1.5 text-sm bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-all flex items-center gap-1"
                          >
                            <Package className="w-4 h-4" />
                            AMBIL SPAREPART
                          </button>
                        )}

                        {/* QC Pending - Status info saja */}
                        {service.status === "qc_pending" && (
                          <div className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 border border-purple-300 rounded-lg flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            MENUNGGU QC
                          </div>
                        )}
                      </div>
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
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-[#f59e0b] flex items-center justify-center border border-slate-200">
            <Package className="w-4 h-4 text-black" />
          </div>
          <h3 className="text-xl font-black">
            SERVICE BARU ({pendingServices.length})
          </h3>
        </div>

        {pendingServices.length === 0 ? (
          <div className="border border-slate-200 p-8 text-center bg-slate-50">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
            <p className="font-mono">Tidak ada service baru</p>
            <p className="text-xs text-slate-500">
              Semua service sudah diambil
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingServices.map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-blue-600"
                onClick={() => viewServiceDetails(service)}
              >
                <div className="p-4">
                  <div className="flex flex-wrap justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-slate-900 text-white text-xs font-mono rounded">
                          {service.invoice_number}
                        </span>
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full border border-green-200">
                          BARU
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <div className="flex items-center gap-1 text-sm">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">
                            {service.customer_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Watch className="w-4 h-4 text-slate-400" />
                          <span>
                            {service.watch_brand || service.device_brand}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <AlertCircle className="w-4 h-4 text-slate-400" />
                          <span className="line-clamp-1">
                            {service.issue_description?.substring(0, 50)}...
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          viewServiceDetails(service);
                        }}
                        className="px-3 py-1.5 text-sm bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1"
                      >
                        <Eye className="w-4 h-4" />
                        DETAIL
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
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md lg:max-w-xl max-h-[80vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      TIMELINE SERVICE
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedService.invoice_number}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTimelineModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  <ServiceTimeline
                    serviceId={selectedService.id}
                    customerPhone={selectedService.customer_phone}
                    customerName={selectedService.customer_name}
                    onUpdate={() => fetchQueues()}
                  />
                </div>
              </div>
            </div>
          )}

          {showProgressModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md lg:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                      <Wrench className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      UPDATE SERVICE
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowProgressModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  <p className="text-sm text-slate-500 mb-4">
                    Service:{" "}
                    <span className="font-medium">
                      {selectedService.invoice_number}
                    </span>
                  </p>
                  <ProgressUpdate
                    service={selectedService}
                    onUpdate={() => fetchQueues()}
                    onAddSparepart={() => {
                      setShowProgressModal(false);
                      openAddSparepart(selectedService);
                    }}
                    onAddJasa={() => {
                      setShowProgressModal(false);
                      openAddJasa(selectedService);
                    }}
                    onSubmitToQC={() => handleSubmitToQC(selectedService)}
                  />
                </div>
              </div>
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
