"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { ServiceOrder, ServiceItem } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle,
  Clock,
  Wrench,
  UserCheck,
  Package,
  Smartphone,
  Calendar,
  DollarSign,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Watch,
  Settings,
  Battery,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Image,
  User,
  Hash,
  FileText,
  Star,
  Award,
  Shield,
  Copy,
  Check,
  ExternalLink,
  QrCode,
} from "lucide-react";
import toast from "react-hot-toast";

// Extend ServiceOrder type for timeline
interface TimelineUpdate {
  id: string;
  message: string;
  status: string;
  photo_url?: string;
  created_at: string;
  details?: any;
}

export default function TrackingPage({ params }: { params: { id: string } }) {
  const [token, setToken] = useState("");
  const [service, setService] = useState<any>(null);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [timeline, setTimeline] = useState<TimelineUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    device: true,
    items: false,
    timeline: true,
  });
  const supabase = createClient();

  const statusSteps = [
    {
      status: "pending",
      label: "Order Received",
      icon: Clock,
      description: "Service order has been received",
      color: "from-slate-400 to-slate-500",
    },
    {
      status: "assigned",
      label: "Assigned to Teknisi",
      icon: UserCheck,
      description: "A teknisi has been assigned to your device",
      color: "from-blue-500 to-cyan-500",
    },
    {
      status: "in_progress",
      label: "Service in Progress",
      icon: Wrench,
      description: "Your device is being serviced",
      color: "from-purple-500 to-pink-500",
    },
    {
      status: "waiting_sparepart",
      label: "Waiting Sparepart",
      icon: Package,
      description: "Waiting for sparepart approval",
      color: "from-orange-500 to-red-500",
    },
    {
      status: "qc_pending",
      label: "Quality Check",
      icon: Shield,
      description: "Final quality check in progress",
      color: "from-indigo-500 to-purple-500",
    },
    {
      status: "completed",
      label: "Service Complete",
      icon: CheckCircle,
      description: "Your device is ready for pickup",
      color: "from-emerald-500 to-green-600",
    },
  ];

  const getCurrentStep = () => {
    if (!service) return 0;
    const index = statusSteps.findIndex(
      (step) => step.status === service.status,
    );
    return index >= 0 ? index : 0;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-slate-100 text-slate-700 border-slate-200",
      assigned: "bg-blue-100 text-blue-700 border-blue-200",
      in_progress: "bg-purple-100 text-purple-700 border-purple-200",
      waiting_sparepart: "bg-orange-100 text-orange-700 border-orange-200",
      qc_pending: "bg-indigo-100 text-indigo-700 border-indigo-200",
      completed: "bg-green-100 text-green-700 border-green-200",
      cancelled: "bg-red-100 text-red-700 border-red-200",
    };
    return colors[status] || colors.pending;
  };

  const getMovementIcon = (movement: string) => {
    switch (movement) {
      case "automatic":
        return <Settings className="w-4 h-4" />;
      case "quartz":
        return <Battery className="w-4 h-4" />;
      case "mechanical":
        return <Settings className="w-4 h-4" />;
      case "analog_digital":
        return <Watch className="w-4 h-4" />;
      case "smartwatch":
        return <Smartphone className="w-4 h-4" />;
      default:
        return <Watch className="w-4 h-4" />;
    }
  };

  const trackService = async () => {
    if (!token.trim()) {
      setError("Masukkan token tracking");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Clean and normalize token
      const normalizedToken = token.trim().toUpperCase();

      // Fetch service order
      const { data, error: fetchError } = await supabase
        .from("service_orders")
        .select("*")
        .eq("token", normalizedToken)
        .single();

      if (fetchError || !data) {
        console.error("Token fetch error:", fetchError);
        setError("Token tidak valid. Silakan cek kembali.");
        setService(null);
        setItems([]);
        setTimeline([]);
        return;
      }

      // Check if token is expired
      if (
        data.token_expires_at &&
        new Date(data.token_expires_at) < new Date()
      ) {
        setError("Token sudah kadaluarsa karena service sudah selesai.");
        setService(null);
        return;
      }

      setService(data);

      // Fetch service items
      const { data: itemsData } = await supabase
        .from("service_items")
        .select("*")
        .eq("service_order_id", data.id);
      if (itemsData) setItems(itemsData);

      // Fetch timeline updates
      const { data: timelineData } = await supabase
        .from("service_timeline")
        .select("*")
        .eq("service_order_id", data.id)
        .order("created_at", { ascending: true });
      if (timelineData) setTimeline(timelineData);
    } catch (error) {
      console.error("Tracking error:", error);
      setError("Gagal mengambil informasi service");
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Token disalin!");
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
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
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isWatch = service?.device_type === "smartwatch";
  const trackingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tracking/${token}`
      : "";

  if (!service) {
    return (
      <div className="min-h-screen bg-[#A8D7FF] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-[#4DB2FF]/20 rounded-[24px] shadow-sm p-8"
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#4DB2FF] flex items-center justify-center border border-white/20 mx-auto mb-4">
                <Watch className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-black">TRACK SERVICE</h1>
              <p className="text-sm font-mono text-slate-500 mt-2">
                Masukkan token tracking Anda
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value.toUpperCase())}
                  placeholder="Masukkan token tracking"
                  className="w-full pl-9 pr-4 py-3 border border-slate-200 font-mono focus:outline-none focus:border-blue-600 transition-all uppercase"
                  onKeyPress={(e) => e.key === "Enter" && trackService()}
                />
              </div>

              {error && (
                <p className="text-red-500 text-sm flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </p>
              )}

              <button
                onClick={trackService}
                disabled={loading}
                className="w-full bg-[#4DB2FF] text-white font-bold py-3 border border-[#4DB2FF]/30 font-mono rounded-xl hover:bg-[#4DB2FF]/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    TRACK SERVICE
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className="mt-6 p-4 bg-[#A8D7FF]/40 border border-[#4DB2FF]/20 rounded-[24px]">
              <p className="text-xs font-mono text-center">
                Token diberikan saat membuat service order. Hubungi kami jika
                kehilangan token.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#A8D7FF] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Header dengan QR Code */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#4DB2FF]/20 rounded-[24px] shadow-sm overflow-hidden"
        >
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#4DB2FF]/20">
            {/* Logo & Title */}
            <div className="p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-10 h-10 bg-[#4DB2FF] flex items-center justify-center border border-white/20">
                  <Watch className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-black">WATCH SERVICE</span>
              </div>
              <p className="text-xs font-mono text-slate-500">
                Official Service Center
              </p>
            </div>

            {/* Invoice Info */}
            <div className="p-5 text-center">
              <p className="text-xs font-black uppercase text-slate-500">
                INVOICE
              </p>
              <p className="text-lg font-black font-mono">
                {service.invoice_number}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {formatDate(service.created_at)}
              </p>
            </div>

            {/* Status */}
            <div className="p-5 text-center">
              <p className="text-xs font-black uppercase text-slate-500">
                STATUS
              </p>
              <span
                className={`inline-block px-3 py-1 text-sm font-bold border ${getStatusColor(service.status)}`}
              >
                {service.status === "qc_pending"
                  ? "QUALITY CHECK"
                  : service.status === "assigned"
                    ? "ASSIGNED"
                    : service.status === "in_progress"
                      ? "IN PROGRESS"
                      : service.status === "waiting_sparepart"
                        ? "WAITING SPAREPART"
                        : service.status === "completed"
                          ? "COMPLETED"
                          : service.status.toUpperCase()}
              </span>
            </div>
          </div>
        </motion.div>

        {/* QR Code Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-[#4DB2FF]/20 rounded-[24px] shadow-sm p-5"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            <div className="text-center md:text-left">
              <p className="text-xs font-black uppercase flex items-center gap-2 justify-center md:justify-start">
                <QrCode className="w-4 h-4" />
                SCAN QR CODE UNTUK TRACKING
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Scan dengan camera HP untuk akses cepat
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="border border-[#4DB2FF]/20 p-2 bg-white rounded-[24px]">
                <QRCodeSVG
                  value={trackingUrl}
                  size={80}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  level="H"
                />
              </div>
              <div>
                <p className="text-xs font-mono text-slate-500">Token</p>
                <div className="flex items-center gap-2">
                  <code className="px-2 py-1 bg-[#A8D7FF]/40 border border-[#4DB2FF]/20 font-mono text-sm">
                    {service.token}
                  </code>
                  <button
                    onClick={copyToken}
                    className="p-1 border border-[#4DB2FF]/20 hover:bg-[#A8D7FF]/30 transition-all"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-[#4DB2FF]/20 rounded-[24px] shadow-sm p-5"
        >
          <h2 className="text-lg font-black mb-5 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            PROGRESS SERVICE
          </h2>
          <div className="relative">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= getCurrentStep();
              const isCurrent = index === getCurrentStep();

              return (
                <div key={step.status} className="relative mb-6 last:mb-0">
                  <div className="flex items-start gap-4">
                    <div className="relative">
                      <div
                        className={`
                           w-10 h-10 flex items-center justify-center z-10 relative border border-[#4DB2FF]/20
                           ${isCompleted ? `bg-gradient-to-br ${step.color} text-white` : "bg-[#A8D7FF] text-slate-500"}
                         `}
                      >
                        {isCompleted ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <step.icon className="w-5 h-5" />
                        )}
                      </div>
                      {index < statusSteps.length - 1 && (
                        <div
                          className={`
                           absolute top-10 left-5 w-0.5 h-12
                           ${isCompleted ? "bg-[#4DB2FF]" : "bg-[#A8D7FF]"}
                         `}
                        />
                      )}
                    </div>
                    <div
                      className={`flex-1 ${isCurrent ? "bg-[#A8D7FF]/40 p-3 -mt-2 border border-[#4DB2FF]/20" : ""}`}
                    >
                      <h3
                        className={`font-black ${isCompleted ? "text-slate-900" : "text-slate-500"}`}
                      >
                        {step.label}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {step.description}
                      </p>
                      {isCurrent && service.status === "in_progress" && (
                        <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                          Sedang dikerjakan...
                        </p>
                      )}
                      {isCurrent && service.status === "waiting_sparepart" && (
                        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Menunggu konfirmasi sparepart
                        </p>
                      )}
                      {isCurrent && service.status === "completed" && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Siap diambil!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Service Details */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          {/* Customer & Device Info */}
          <div className="bg-white border border-[#4DB2FF]/20 rounded-[24px] shadow-sm">
            <button
              onClick={() => toggleSection("device")}
              className="w-full flex items-center justify-between p-4 border-b border-[#4DB2FF]/20 hover:bg-[#A8D7FF]/30"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#4DB2FF] flex items-center justify-center border border-white/20">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-black">INFORMASI SERVICE</h3>
              </div>
              {expandedSections.device ? (
                <ChevronDown className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
            </button>

            {expandedSections.device && (
              <div className="p-5 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-[#A8D7FF]/30 border border-[#4DB2FF]/20">
                    <User className="w-5 h-5 text-[#4DB2FF]" />
                    <div>
                      <p className="text-xs text-slate-500">Customer</p>
                      <p className="font-bold">{service.customer_name}</p>
                      <p className="text-sm font-mono">
                        {service.customer_phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-[#A8D7FF]/30 border border-[#4DB2FF]/20">
                    {isWatch ? (
                      <Watch className="w-5 h-5 text-[#4DB2FF]" />
                    ) : (
                      <Smartphone className="w-5 h-5 text-[#4DB2FF]" />
                    )}
                    <div>
                      <p className="text-xs text-slate-500">Device</p>
                      <p className="font-bold">
                        {isWatch
                          ? service.watch_brand || service.device_brand
                          : service.device_brand}
                        {service.device_model && ` ${service.device_model}`}
                      </p>
                      <p className="text-xs capitalize">
                        {service.device_type}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Watch-specific details */}
                {isWatch &&
                  (service.watch_movement || service.watch_condition) && (
                    <div className="p-3 bg-[#FFD65A]/10 border border-[#FFD65A]/30">
                      <p className="text-xs font-black mb-2">
                        DETAIL JAM TANGAN
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {service.watch_brand && (
                          <div>
                            <span className="text-slate-500">Brand:</span>{" "}
                            <span className="font-bold">
                              {service.watch_brand}
                            </span>
                          </div>
                        )}
                        {service.watch_model && (
                          <div>
                            <span className="text-slate-500">Model:</span>{" "}
                            <span className="font-bold">
                              {service.watch_model}
                            </span>
                          </div>
                        )}
                        {service.watch_movement && (
                          <div className="flex items-center gap-1">
                            {getMovementIcon(service.watch_movement)}
                            <span className="text-slate-500">Movement:</span>
                            <span className="font-bold capitalize">
                              {service.watch_movement}
                            </span>
                          </div>
                        )}
                        {service.watch_condition && (
                          <div>
                            <span className="text-slate-500">Condition:</span>{" "}
                            <span className="font-bold capitalize">
                              {service.watch_condition}
                            </span>
                          </div>
                        )}
                        {service.watch_year && (
                          <div>
                            <span className="text-slate-500">Year:</span>{" "}
                            <span className="font-bold">
                              {service.watch_year}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                {service.serial_number && (
                  <div className="flex items-center gap-2 p-3 bg-[#A8D7FF]/30 border border-[#4DB2FF]/20">
                    <Hash className="w-4 h-4 text-slate-400" />
                    <span className="text-sm">
                      Serial Number:{" "}
                      <span className="font-mono">{service.serial_number}</span>
                    </span>
                  </div>
                )}

                <div>
                  <p className="text-xs font-black mb-1">KERUSAKAN</p>
                  <div className="p-3 bg-[#FF5F87]/10 border border-[#FF5F87]/30 text-sm">
                    {service.issue_description}
                  </div>
                </div>

                {service.request && (
                  <div>
                    <p className="text-xs font-black mb-1">REQUEST CUSTOMER</p>
                    <div className="p-3 bg-[#4DB2FF]/10 border border-[#4DB2FF]/30 text-sm">
                      {service.request}
                    </div>
                  </div>
                )}

                {service.notes && (
                  <div>
                    <p className="text-xs font-black mb-1">CATATAN</p>
                    <div className="p-3 bg-[#A8D7FF]/30 border border-[#4DB2FF]/20 text-sm">
                      {service.notes}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items & Cost */}
          {items.length > 0 && (
            <div className="bg-white border border-[#4DB2FF]/20 rounded-[24px] shadow-sm">
              <button
                onClick={() => toggleSection("items")}
                className="w-full flex items-center justify-between p-4 border-b border-[#4DB2FF]/20 hover:bg-[#A8D7FF]/30"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#FFD65A] flex items-center justify-center border border-white/20">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-black">SPAREPART & BIAYA</h3>
                </div>
                {expandedSections.items ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>

              {expandedSections.items && (
                <div className="p-5 space-y-3">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-[#A8D7FF]/30 border border-[#4DB2FF]/20"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 text-xs font-bold border ${
                              item.item_type === "jasa"
                                ? "bg-[#4DB2FF]/20 text-[#4DB2FF] border-[#4DB2FF]/20"
                                : "bg-[#FFD65A]/20 text-[#FFD65A] border-[#FFD65A]/20"
                            }`}
                          >
                            {item.item_type === "jasa" ? "JASA" : "SPAREPART"}
                          </span>
                          <span className="font-bold">{item.name}</span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {item.quantity} x {formatRupiah(item.price)}
                        </p>
                      </div>
                      <span className="font-bold">
                        {formatRupiah(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-3 bg-[#4DB2FF] text-white font-bold rounded-[24px]">
                    <span>TOTAL</span>
                    <span className="text-xl">
                      {formatRupiah(
                        service.final_cost || service.estimated_cost || 0,
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline Updates */}
          {timeline.length > 0 && (
            <div className="bg-white border border-[#4DB2FF]/20 rounded-[24px] shadow-sm">
              <button
                onClick={() => toggleSection("timeline")}
                className="w-full flex items-center justify-between p-4 border-b border-[#4DB2FF]/20 hover:bg-[#A8D7FF]/30"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#4DB2FF] flex items-center justify-center border border-white/20">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-black">TIMELINE UPDATE</h3>
                </div>
                {expandedSections.timeline ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
              </button>

              {expandedSections.timeline && (
                <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
                  {timeline.map((update, index) => (
                    <div
                      key={update.id}
                      className="relative pl-6 pb-4 last:pb-0"
                    >
                      {index < timeline.length - 1 && (
                        <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-[#A8D7FF]" />
                      )}
                      <div className="absolute left-0 top-1 w-3 h-3 bg-[#4DB2FF] rounded-full border border-[#4DB2FF]/20" />
                      <div className="bg-[#A8D7FF]/30 p-3 ml-2 border border-[#4DB2FF]/20">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <span className="text-xs text-slate-500">
                            {formatDate(update.created_at)}
                          </span>
                          <span
                            className={`text-xs font-bold px-2 py-0.5 border ${
                              update.status === "completed"
                                ? "bg-[#3CCF91]/20 text-[#3CCF91] border-[#3CCF91]/20"
                                : update.status === "waiting_sparepart"
                                  ? "bg-[#FFD65A]/30 text-yellow-700 border-[#FFD65A]/30"
                                  : update.status === "in_progress"
                                    ? "bg-[#4DB2FF]/20 text-[#4DB2FF] border-[#4DB2FF]/20"
                                    : "bg-[#A8D7FF]/40 text-slate-600 border-[#4DB2FF]/20"
                            }`}
                          >
                            {update.status === "completed"
                              ? "SELESAI"
                              : update.status === "waiting_sparepart"
                                ? "MENUNGGU SPAREPART"
                                : update.status === "in_progress"
                                  ? "DALAM PENGERJAAN"
                                  : update.status === "assigned"
                                    ? "DITUGASKAN"
                                    : update.status === "qc_pending"
                                      ? "QUALITY CHECK"
                                      : "UPDATE"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">
                          {update.message}
                        </p>
                        {update.photo_url && (
                          <div className="mt-2">
                            <img
                              src={update.photo_url}
                              alt="Progress"
                              className="rounded border border-slate-200 max-h-48 object-cover cursor-pointer hover:opacity-90"
                              onClick={() =>
                                window.open(update.photo_url, "_blank")
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
        </motion.div>

        {/* Completion Message */}
        {service.status === "completed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border border-slate-200 bg-gradient-to-r from-emerald-500 to-green-600 p-5 text-white shadow-sm"
          >
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 bg-white/20 flex items-center justify-center border-2 border-white">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-black">SERVICE SELESAI!</h3>
                <p className="text-sm opacity-90">
                  Jam tangan Anda sudah siap diambil. Bawa invoice dan token
                  ini.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Contact Support */}
        <div className="text-center pt-4">
          <p className="text-sm text-slate-500">
            Butuh bantuan? Hubungi kami di
            <a href="tel:+62123456789" className="text-blue-600 font-bold ml-1">
              +62 123 456 789
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
