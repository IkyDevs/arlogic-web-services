"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  CheckCircle, Clock, Wrench, UserCheck, Package, Smartphone,
  DollarSign, AlertCircle, Phone, Watch, Settings, Battery, ChevronRight,
  ChevronDown, Star, Shield, Copy, Check, Camera,
  Image, Hash, X, Send, Search, User,
} from "lucide-react";
import toast from "react-hot-toast";

const supabase = createClient();

const statusSteps = [
  { status: "pending", label: "Order Received", icon: Clock, desc: "Service order has been received", color: "from-slate-400 to-slate-500" },
  { status: "assigned", label: "Assigned to Teknisi", icon: UserCheck, desc: "A teknisi has been assigned", color: "from-blue-500 to-cyan-500" },
  { status: "in_progress", label: "Service in Progress", icon: Wrench, desc: "Your device is being serviced", color: "from-purple-500 to-pink-500" },
  { status: "waiting_sparepart", label: "Waiting Sparepart", icon: Package, desc: "Waiting for sparepart", color: "from-orange-500 to-red-500" },
  { status: "qc_pending", label: "Quality Check", icon: Shield, desc: "Final quality check", color: "from-indigo-500 to-purple-500" },
  { status: "completed", label: "Service Complete", icon: CheckCircle, desc: "Ready for pickup", color: "from-emerald-500 to-green-600" },
];

const statusColors: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  assigned: "bg-blue-100 text-blue-700 border-blue-200",
  in_progress: "bg-purple-100 text-purple-700 border-purple-200",
  waiting_sparepart: "bg-orange-100 text-orange-700 border-orange-200",
  qc_pending: "bg-indigo-100 text-indigo-700 border-indigo-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

const ratingLabels = ["", "Very Unsatisfied", "Unsatisfied", "Neutral", "Satisfied", "Very Satisfied"];
const ratingColors = ["", "text-red-500", "text-orange-500", "text-yellow-500", "text-blue-500", "text-emerald-500"];

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getMovementIcon(m: string) {
  switch (m) {
    case "automatic": return <Settings className="w-4 h-4" />;
    case "quartz": return <Battery className="w-4 h-4" />;
    case "digital": return <Settings className="w-4 h-4" />;
    case "analog_digital": return <Watch className="w-4 h-4" />;
    case "smartwatch": return <Smartphone className="w-4 h-4" />;
    default: return <Watch className="w-4 h-4" />;
  }
}

export default function TrackingPage({ params }: { params: { slug?: string[] } }) {
  const [token, setToken] = useState("");
  const [service, setService] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [initialPhotos, setInitialPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ device: true, items: false, timeline: true, photos: true });
  const [photoModal, setPhotoModal] = useState<string | null>(null);

  // Feedback state
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackAlready, setFeedbackAlready] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackHover, setFeedbackHover] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");

  const currentStep = useMemo(() => {
    if (!service) return 0;
    const idx = statusSteps.findIndex((s) => s.status === service.status);
    return idx >= 0 ? idx : 0;
  }, [service]);

  // Auto-load from URL path if token is present
  useEffect(() => {
    const urlToken = params.slug?.[0];
    if (urlToken && urlToken !== "tracking") {
      setToken(urlToken.toUpperCase());
      const t = setTimeout(() => {
        setToken(urlToken.toUpperCase());
        trackServiceFromUrl(urlToken.toUpperCase());
      }, 50);
      return () => clearTimeout(t);
    }
  }, []);

  const trackServiceFromUrl = async (t: string) => {
    setLoading(true); setError("");
    try {
      const { data, error: fetchError } = await supabase.from("service_orders").select("*").eq("token", t).single();
      if (fetchError || !data) { setError("Token tidak valid."); setLoading(false); return; }
      if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) { setError("Token sudah kadaluarsa."); setLoading(false); return; }
      setService(data);
      const [itemsRes, timelineRes, docsRes, feedbackRes] = await Promise.all([
        supabase.from("service_items").select("*").eq("service_order_id", data.id),
        supabase.from("service_timeline").select("*").eq("service_order_id", data.id).order("created_at", { ascending: true }),
        supabase.from("service_documentation").select("*").eq("service_order_id", data.id).eq("stage", "initial_condition"),
        supabase.from("feedbacks").select("id").eq("service_order_id", data.id).maybeSingle(),
       ]);
       if (itemsRes.data) setItems(itemsRes.data);
       if (timelineRes.data) {
         console.log(`📋 Timeline fetched (${timelineRes.data.length} items):`, timelineRes.data.map((t: any) => ({
           id: t.id,
           status: t.status,
           message: t.message?.slice(0, 50),
           photo_url: t.photo_url ? '✅ ' + t.photo_url.slice(0, 50) : '❌ null/undefined',
           details_photos: t.details?.all_photo_urls?.length || 0
         })));
         setTimeline(timelineRes.data);
       }
       if (docsRes.data) setInitialPhotos(docsRes.data);
       if (feedbackRes.data) setFeedbackAlready(true);

       // Log visit to tracking_logs
      await supabase.from("tracking_logs").insert({
        service_order_id: data.id,
        token: t,
      });
    } catch (e) { setError("Gagal mengambil informasi service"); }
    setLoading(false);
  };

  const trackService = async () => {
    if (!token.trim()) { setError("Masukkan token tracking"); return; }
    setLoading(true); setError(""); setService(null);
    try {
      const normalizedToken = token.trim().toUpperCase();
      const { data, error: fetchError } = await supabase.from("service_orders").select("*").eq("token", normalizedToken).single();
      if (fetchError || !data) { setError("Token tidak valid. Silakan cek kembali."); setLoading(false); return; }
      if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) { setError("Token sudah kadaluarsa."); setLoading(false); return; }
      setService(data);

      const [itemsRes, timelineRes, docsRes, feedbackRes] = await Promise.all([
        supabase.from("service_items").select("*").eq("service_order_id", data.id),
        supabase.from("service_timeline").select("*").eq("service_order_id", data.id).order("created_at", { ascending: true }),
        supabase.from("service_documentation").select("*").eq("service_order_id", data.id).eq("stage", "initial_condition"),
        supabase.from("feedbacks").select("id").eq("service_order_id", data.id).maybeSingle(),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (timelineRes.data) setTimeline(timelineRes.data);
      if (docsRes.data) setInitialPhotos(docsRes.data);
      if (feedbackRes.data) setFeedbackAlready(true);

      // Log visit
      await supabase.from("tracking_logs").insert({
        service_order_id: data.id,
        token: normalizedToken,
      });

      // Update URL to include token (without full page reload)
      window.history.replaceState(null, "", "/tracking/" + normalizedToken);
    } catch (e) { setError("Gagal mengambil informasi service"); }
    setLoading(false);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(service?.token || token);
    setCopiedId(true); toast.success("Token disalin!");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const toggleSection = (s: keyof typeof expandedSections) => setExpandedSections((p) => ({ ...p, [s]: !p[s] }));

  const handleFeedbackSubmit = async () => {
    if (feedbackRating === 0) { toast.error("Pilih rating terlebih dahulu"); return; }
    if (!service) return;
    setFeedbackLoading(true);
    try {
      const { error: insertError } = await supabase.from("feedbacks").insert({
        service_order_id: service.id, customer_name: service.customer_name,
        rating: feedbackRating, comment: feedbackComment.trim() || null,
        teknisi_id: service.assigned_teknisi_id || null,
      });
      if (insertError) throw insertError;
      
      // Send notification to all owner and admin users
      const { data: owners } = await supabase
        .from("profiles")
        .select("id")
        .in("role", ["owner", "admin"]);
      
      if (owners && owners.length > 0) {
        const notifications = owners.map(owner => ({
          user_id: owner.id,
          type: "feedback",
          title: "New Customer Feedback",
          message: service.customer_name + " rated service " + service.invoice_number + " with " + feedbackRating + " stars",
        }));
        
        await supabase.from("notifications").insert(notifications);
      }
      
      setFeedbackSubmitted(true);
      toast.success("Terima kasih atas feedback Anda!");
    } catch (err: any) {
      if (err.code === "23505") setFeedbackAlready(true);
      else toast.error("Gagal mengirim feedback");
    }
    setFeedbackLoading(false);
  };

  if (!service) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
              <Watch className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Track Service</h1>
            <p className="text-sm text-slate-500 mt-1">Masukkan token tracking Anda</p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="text" value={token} onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="Masukkan token tracking"
                className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                onKeyDown={(e) => e.key === "Enter" && trackService()} />
            </div>
            {error && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
            <button onClick={trackService} disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200">
              {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><Search className="w-4 h-4" /> Track Service</>}
            </button>
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-slate-500 text-center">Token diberikan saat membuat service order. Hubungi kami jika kehilangan token.</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Header Card */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            <div className="p-5 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Watch className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-slate-900">Watch Service</span>
              </div>
              <p className="text-xs text-slate-500">Official Service Center</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Invoice</p>
              <p className="text-lg font-bold font-mono text-slate-900">{service.invoice_number}</p>
              <p className="text-xs text-slate-500 mt-1">{fmtDate(service.created_at)}</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider">Status</p>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full border ${statusColors[service.status] || statusColors.pending}`}>
                  {service.status === "qc_pending" ? "Quality Check" : service.status === "waiting_sparepart" ? "Waiting Sparepart" : service.status === "in_progress" ? "In Progress" : service.status === "assigned" ? "Assigned" : service.status === "completed" ? "Completed" : service.status === "cancelled" ? "Cancelled" : service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* QR Code + Token */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider flex items-center gap-2 justify-center sm:justify-start">
                Scan QR Code untuk Tracking</p>
              <p className="text-sm text-slate-500 mt-1">Scan dengan camera HP untuk akses cepat</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="border border-slate-200 p-2 bg-white rounded-xl shadow-sm">
                <QRCodeSVG value={typeof window !== "undefined" ? window.location.origin + "/tracking" : ""} size={72} level="H" />
                <p className="text-[10px] text-slate-400 mt-1">Scan untuk tracking</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Token</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-800">{service.token}</code>
                  <button onClick={copyToken} className="p-1.5 hover:bg-slate-100 rounded-lg transition-all">
                    {copiedId ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-slate-400" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Progress Steps */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
          <h2 className="text-base font-bold text-slate-900 mb-5 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" /> Progress Service
          </h2>
          <div className="relative">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;
              return (
                <div key={step.status} className="relative flex items-start gap-4 pb-8 last:pb-0">
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl border-2 z-10 relative transition-all ${isCompleted ? "bg-gradient-to-br " + step.color + " text-white border-transparent shadow-md" : "bg-white text-slate-400 border-slate-200"}`}>
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                    </div>
                    {index < statusSteps.length - 1 && (
                      <div className={`absolute top-10 left-5 w-0.5 h-8 ${isCompleted ? "bg-blue-500" : "bg-slate-200"}`} />
                    )}
                  </div>
                  <div className={`flex-1 pt-1.5 ${isCurrent ? "bg-blue-50 -mx-3 p-3 rounded-xl border border-blue-100" : ""}`}>
                    <h3 className={`font-semibold text-sm ${isCompleted ? "text-slate-900" : "text-slate-500"}`}>{step.label}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
                    {isCurrent && service.status === "in_progress" && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />Sedang dikerjakan...</p>
                    )}
                    {isCurrent && service.status === "waiting_sparepart" && (
                      <p className="text-xs text-orange-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Menunggu konfirmasi sparepart</p>
                    )}
                    {isCurrent && service.status === "completed" && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Siap diambil!</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Service Details Section */}
        <div className="space-y-4">
          {/* Customer & Device Info */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <button onClick={() => toggleSection("device")}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-sm text-slate-900">Informasi Service</h3>
              </div>
              {expandedSections.device ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            </button>
            {expandedSections.device && (
              <div className="p-5 space-y-4 border-t border-slate-100">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <User className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-slate-500">Customer</p>
                      <p className="font-semibold text-slate-900">{service.customer_name}</p>
                      <p className="text-sm text-slate-600">{service.customer_phone}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
                    <Watch className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-xs text-slate-500">Device</p>
                      <p className="font-semibold text-slate-900">{service.watch_brand || service.device_brand}{service.device_model ? " " + service.device_model : ""}</p>
                      <p className="text-xs text-slate-500 capitalize">{service.device_type}</p>
                    </div>
                  </div>
                </div>
                {service.watch_movement && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                    {service.watch_brand && <div><span className="text-xs text-slate-500">Brand:</span> <span className="font-semibold text-sm">{service.watch_brand}</span></div>}
                    {service.watch_model && <div><span className="text-xs text-slate-500">Model:</span> <span className="font-semibold text-sm">{service.watch_model}</span></div>}
                    {service.watch_movement && <div className="flex items-center gap-1"><span className="text-xs text-slate-500">Movement:</span> {getMovementIcon(service.watch_movement)} <span className="font-semibold text-sm capitalize">{service.watch_movement}</span></div>}
                    {service.watch_condition && <div><span className="text-xs text-slate-500">Condition:</span> <span className="font-semibold text-sm capitalize">{service.watch_condition}</span></div>}
                  </div>
                )}
                {service.serial_number && (
                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <Hash className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-700">Serial: <span className="font-mono font-semibold">{service.serial_number}</span></span>
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Kerusakan</p>
                  <div className="p-3 bg-red-50 rounded-xl border border-red-100 text-sm text-slate-800">{service.issue_description}</div>
                </div>
                {service.request && <div><p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Request Customer</p><div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm">{service.request}</div></div>}
                {service.notes && <div><p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">Catatan</p><div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm">{service.notes}</div></div>}
              </div>
            )}
          </motion.div>

          {/* Initial Condition Photos */}
          {initialPhotos.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <button onClick={() => toggleSection("photos")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg flex items-center justify-center">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900">Foto Kondisi Awal ({initialPhotos.length})</h3>
                </div>
                {expandedSections.photos ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedSections.photos && (
                <div className="p-5 border-t border-slate-100">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {initialPhotos.map((photo, i) => (
                      <motion.div key={photo.id || i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                        className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-square cursor-pointer"
                        onClick={() => setPhotoModal(photo.photo_url)}>
                        <img src={photo.photo_url} alt={"Kondisi Awal " + (i + 1)} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                            <Search className="w-4 h-4 text-slate-800" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Items & Cost */}
          {items.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <button onClick={() => toggleSection("items")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg flex items-center justify-center">
                    <Package className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900">Sparepart & Biaya</h3>
                </div>
                {expandedSections.items ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedSections.items && (
                <div className="p-5 space-y-3 border-t border-slate-100">
                  {items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={"px-2 py-0.5 text-xs font-bold rounded-full border " + (item.item_type === "jasa" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-amber-100 text-amber-700 border-amber-200")}>
                            {item.item_type === "jasa" ? "JASA" : "SPAREPART"}
                          </span>
                          <span className="font-semibold text-sm text-slate-900">{item.name}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{item.quantity} x {fmtRupiah(item.price)}</p>
                      </div>
                      <span className="font-bold text-slate-900">{fmtRupiah(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl shadow-md">
                    <span>Total</span>
                    <span className="text-lg">{fmtRupiah(service.final_cost || service.estimated_cost || 0)}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Timeline Updates */}
          {timeline.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <button onClick={() => toggleSection("timeline")}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm text-slate-900">Timeline Update</h3>
                </div>
                {expandedSections.timeline ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              {expandedSections.timeline && (
                <div className="p-5 space-y-4 max-h-96 overflow-y-auto border-t border-slate-100">
                  {timeline.map((update, i) => (
                    <div key={update.id} className="relative pl-6 pb-4 last:pb-0">
                      {i < timeline.length - 1 && <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-blue-200" />}
                      <div className="absolute left-0 top-1.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white shadow-sm" />
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-3 ml-2 rounded-xl border border-blue-100">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <span className="text-xs text-slate-500">{fmtDate(update.created_at)}</span>
                          <span className={"text-xs font-bold px-2 py-0.5 rounded-full border " + (update.status === "completed" ? "bg-green-100 text-green-700 border-green-200" : update.status === "waiting_sparepart" ? "bg-orange-100 text-orange-700 border-orange-200" : update.status === "in_progress" ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-blue-100 text-blue-700 border-blue-200")}>
                            {update.status === "completed" ? "SELESAI" : update.status === "waiting_sparepart" ? "MENUNGGU SPAREPART" : update.status === "in_progress" ? "DALAM PENGERJAAN" : update.status === "assigned" ? "DITUGASKAN" : update.status === "qc_pending" ? "QUALITY CHECK" : "UPDATE"}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700">{update.message}</p>
                        {update.photo_url && (
                          <img src={update.photo_url} alt="Progress" className="mt-2 rounded-lg border border-slate-200 max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(update.photo_url, "_blank")} />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Completion Message */}
        {service.status === "completed" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-emerald-500 to-green-600 p-5 rounded-2xl text-white shadow-lg">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center border-2 border-white/30">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Service Selesai!</h3>
                <p className="text-sm opacity-90">Jam tangan Anda sudah siap diambil. Bawa invoice dan token ini.</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Feedback Section - Only when service is completed */}
        {service.status !== "completed" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-5 border border-slate-200 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="font-bold text-slate-700">Feedback Belum Tersedia</h3>
            <p className="text-sm text-slate-500 mt-1">Feedback dapat diberikan setelah service selesai.</p>
          </motion.div>
        )}

        {service.status === "completed" && !feedbackAlready && !feedbackSubmitted && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-200">
                <Star className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Beri Penilaian</h3>
              <p className="text-sm text-slate-500 mt-0.5">Bagaimana pengalaman service Anda?</p>
            </div>

            <div className="flex items-center justify-center gap-1.5 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <motion.button key={star} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setFeedbackRating(star)} onMouseEnter={() => setFeedbackHover(star)} onMouseLeave={() => setFeedbackHover(0)}
                  className="focus:outline-none">
                  <Star size={36} className={"transition-all duration-150 " + (star <= (feedbackHover || feedbackRating) ? "text-amber-400 fill-amber-400 drop-shadow-sm" : "text-slate-300")} />
                </motion.button>
              ))}
            </div>
            {(feedbackRating > 0 || feedbackHover > 0) && (
              <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                className={"text-center font-semibold text-sm mt-1 " + ratingColors[feedbackHover || feedbackRating]}>
                {ratingLabels[feedbackHover || feedbackRating]}
              </motion.p>
            )}

            <div className="mt-4">
              <textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="Ceritakan pengalaman Anda (opsional)..." rows={3}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
              <p className="text-xs text-slate-400 text-right mt-1">{feedbackComment.length}/500</p>
            </div>

            <button onClick={handleFeedbackSubmit} disabled={feedbackLoading || feedbackRating === 0}
              className="w-full mt-4 flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200">
              {feedbackLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Kirim Feedback</>}
            </button>
          </motion.div>
        )}

        {/* Feedback Already Submitted */}
        {service.status === "completed" && (feedbackAlready || feedbackSubmitted) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-200 text-center">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="font-bold text-slate-900">Feedback Terkirim</h3>
            <p className="text-sm text-slate-600 mt-1">Terima kasih! Feedback Anda sangat berarti untuk kami.</p>
            {feedbackSubmitted && feedbackRating > 0 && (
              <div className="flex items-center justify-center gap-1 mt-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={20} className={star <= feedbackRating ? "text-amber-400 fill-amber-400" : "text-slate-300"} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Contact */}
        <div className="text-center pt-2 pb-4">
          <p className="text-sm text-slate-500">Butuh bantuan? Hubungi kami di <a href="tel:+62123456789" className="text-blue-600 font-semibold hover:underline">+62 123 456 789</a></p>
        </div>
      </div>

      {/* Photo Modal */}
      {photoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setPhotoModal(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative max-w-2xl w-full">
            <button onClick={() => setPhotoModal(null)} className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
            <img src={photoModal} alt="Photo" className="w-full rounded-2xl shadow-2xl" />
          </motion.div>
        </div>
      )}
    </div>
  );
}
