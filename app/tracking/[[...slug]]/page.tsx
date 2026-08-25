"use client";

import { use, useState, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPlayableVideo } from "@/lib/media-utils";
import SmartMedia from "@/components/ui/SmartMedia";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "next-themes";
import ServiceCostBreakdown from "@/components/ui/ServiceCostBreakdown";
import "./glacier.css";
import {
  CheckCircle, Clock, Wrench, UserCheck, Package, Smartphone,
  DollarSign, AlertCircle, Phone, Watch, Settings, Battery, Zap, ChevronRight,
  ChevronDown, Star, Shield, Copy, Check, Camera,
  Hash, X, Send, Search, User, Sun, Moon,
} from "lucide-react";
import toast from "react-hot-toast";

const supabase = createClient();

const subscribeNoop = () => () => {};

const statusSteps = [
  { status: "pending", label: "Pesanan Diterima", icon: Clock, desc: "Pesanan service telah diterima", color: "from-slate-500 to-slate-600" },
  { status: "assigned", label: "Ditugaskan ke Teknisi", icon: UserCheck, desc: "Service ditugaskan ke teknisi", color: "from-sky-500 to-cyan-400" },
  { status: "in_progress", label: "Sedang Dikerjakan", icon: Wrench, desc: "Service sedang dalam pengerjaan", color: "from-sky-400 to-blue-500" },
  { status: "waiting_sparepart", label: "Menunggu Sparepart", icon: Package, desc: "Menunggu sparepart", color: "from-amber-500 to-orange-500" },
  { status: "qc_pending", label: "Quality Check", icon: Shield, desc: "Pengecekan kualitas akhir", color: "from-cyan-400 to-teal-400" },
  { status: "completed", label: "Service Selesai", icon: CheckCircle, desc: "Siap diambil", color: "from-emerald-400 to-teal-300" },
];

const statusColors: Record<string, string> = {
  pending: "gl-chip gl-chip-neutral",
  assigned: "gl-chip gl-chip-info",
  in_progress: "gl-chip gl-chip-purple",
  waiting_sparepart: "gl-chip gl-chip-warn",
  qc_pending: "gl-chip gl-chip-cyan",
  completed: "gl-chip gl-chip-success",
  cancelled: "gl-chip gl-chip-danger",
};

const ratingLabels = ["", "Very Unsatisfied", "Unsatisfied", "Neutral", "Satisfied", "Very Satisfied"];

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function maskPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `•••• ••• ${last4}`;
}

function GlacierThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Hydration-safe "mounted" tanpa setState di effect
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const isDark = resolvedTheme !== "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="gl-theme-toggle"
      aria-label={isDark ? "Aktifkan Light Mode" : "Aktifkan Dark Mode"}
      title={isDark ? "Aktifkan Light Mode" : "Aktifkan Dark Mode"}
    >
      {!mounted ? <span className="w-4 h-4 block" /> : isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function getMovementIcon(m: string) {
  switch (m) {
    case "automatic": return <Settings className="w-4 h-4" />;
    case "quartz": return <Battery className="w-4 h-4" />;
    case "digital": return <Settings className="w-4 h-4" />;
    case "analog_digital": return <Watch className="w-4 h-4" />;
    case "kinetic": return <Zap className="w-4 h-4" />;
    case "smartwatch": return <Smartphone className="w-4 h-4" />;
    default: return <Watch className="w-4 h-4" />;
  }
}

export function TrackingContent({ slug, branchName, presetService }: { slug?: string[]; branchName?: string; presetService?: any }) {
  const [token, setToken] = useState("");
  const [service, setService] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [initialPhotos, setInitialPhotos] = useState<any[]>([]);
  const [qcPhotos, setQCPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState(false);
  const [queuePosition, setQueuePosition] = useState<{ position: number; total: number; currentWork: string | null; currentWorkPos: number | null } | null>(null);
  const [expandedSections, setExpandedSections] = useState({ device: true, items: false, timeline: true, photos: false });
  interface PhotoModalState {
  url: string;
  media_type?: string | null;
}
  const [photoModal, setPhotoModal] = useState<PhotoModalState | null>(null);
  const [branchContact, setBranchContact] = useState<{ name: string; phone: string } | null>(null);
  const [trackingRequestName, setTrackingRequestName] = useState("");
  const [trackingRequestInvoice, setTrackingRequestInvoice] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Feedback state
  const finalItems = useMemo(() => items, [items]);
  const sparepartItems = useMemo(() => finalItems.filter((i: any) => i.item_type === "sparepart"), [finalItems]);
  const jasaItems = useMemo(() => finalItems.filter((i: any) => i.item_type === "jasa"), [finalItems]);
  const totalSparepart = useMemo(() => sparepartItems.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 1), 0), [sparepartItems]);
  const totalJasa = useMemo(() => jasaItems.reduce((s: number, i: any) => s + (i.price || 0) * (i.quantity || 1), 0), [jasaItems]);
  const grandTotal = totalSparepart + totalJasa;
  const dp = service?.down_payment || 0;
  const discount = service?.discount || 0;
  const remaining = Math.max(0, grandTotal - dp - discount);
  const isLunas = remaining <= 0;

  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackAlready, setFeedbackAlready] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackRatings, setFeedbackRatings] = useState({ kepuasan: 0, layanan: 0, kualitas: 0 });
  const [feedbackHover, setFeedbackHover] = useState<{ row: string | null; value: number }>({ row: null, value: 0 });
  const [feedbackComment, setFeedbackComment] = useState("");
  const [teknisiName, setTeknisiName] = useState("");
  const branchIdFromPath = branchName || (slug && slug.length > 1 ? slug[0] : null);
  const tokenFromPath = branchName ? undefined : slug && slug.length > 1 ? slug[1] : slug?.[0];
  const branchDatabaseId = branchIdFromPath && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(branchIdFromPath)
    ? branchIdFromPath
    : null;

  const currentStep = useMemo(() => {
    if (!service) return 0;
    const idx = statusSteps.findIndex((s) => s.status === service.status);
    return idx >= 0 ? idx : 0;
  }, [service]);

  const loadBranchContact = async ({ branchId, branchCode, branchName }: { branchId?: string | null; branchCode?: string | null; branchName?: string | null }) => {
    const identifier = branchCode ? `branch=${encodeURIComponent(branchCode)}` : branchName ? `name=${encodeURIComponent(branchName)}` : branchId ? `id=${encodeURIComponent(branchId)}` : null;
    if (!identifier) {
      setBranchContact(null);
      return;
    }

    try {
      const response = await fetch(`/api/public/branch-contact?${identifier}`);
      if (!response.ok) throw new Error();
      const branch = await response.json();
      setBranchContact({ name: branch.name, phone: branch.phone });
    } catch {
      setBranchContact(null);
    }
  };

  const adminWhatsAppUrl = useMemo(() => {
    if (!branchContact) return null;
    const digits = branchContact.phone.replace(/\D/g, "");
    const phone = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
    if (!phone) return null;

    const message = `Halo admin ${branchContact.name}, saya membutuhkan bantuan terkait service ${service?.invoice_number || ""}.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [branchContact, service?.invoice_number]);

  const trackingRequestWhatsAppUrl = useMemo(() => {
    if (!branchContact) return null;
    const digits = branchContact.phone.replace(/\D/g, "");
    const phone = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
    if (!phone) return null;

    const customerName = trackingRequestName.trim() || "[nama customer]";
    const invoiceNumber = trackingRequestInvoice.trim() || "[nomor invoice]";
    const message = `Halo Admin ${branchContact.name}, saya ${customerName}. Saya ingin mengakses web tracking untuk invoice ${invoiceNumber}. Mohon bantu kirimkan token tracking saya. Terima kasih.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [branchContact, trackingRequestInvoice, trackingRequestName]);

  // Auto-load from URL path if token is present
  useEffect(() => {
    const branchCode = new URLSearchParams(window.location.search).get("branch");
    if (branchCode) void loadBranchContact({ branchCode });
    else if (branchIdFromPath) {
      void loadBranchContact(branchDatabaseId ? { branchId: branchIdFromPath } : { branchName: branchIdFromPath });
    }

    const urlToken = tokenFromPath;
    if (urlToken && urlToken !== "tracking") {
      setToken(urlToken.toUpperCase());
      const t = setTimeout(() => {
        setToken(urlToken.toUpperCase());
        trackServiceFromUrl(urlToken.toUpperCase());
      }, 50);
      return () => clearTimeout(t);
    }
  }, []);

  const hydrateService = async (data: any, logToken: string) => {
    void loadBranchContact({ branchId: data.branch_id });

    if (data.status === 'pending' || data.status === 'assigned' || data.status === 'in_progress') {
      const { data: queue } = await supabase
        .from("service_orders")
        .select("id, status, created_at, assigned_teknisi_id")
        .eq("branch_id", data.branch_id)
        .in("status", ["pending", "assigned", "in_progress"])
        .order("created_at", { ascending: true });

      if (queue) {
        const pos = queue.findIndex(s => s.id === data.id);
        const currentWork = queue.find(s => s.status === 'in_progress') || queue.find(s => s.status === 'assigned');
        const currentWorkPos = currentWork ? queue.findIndex(s => s.id === currentWork.id) + 1 : null;
        let currentWorkName = null;
        if (currentWork?.assigned_teknisi_id) {
          const { data: p } = await supabase.from("profiles").select("full_name").eq("id", currentWork.assigned_teknisi_id).single();
          currentWorkName = p?.full_name || null;
        }
        setQueuePosition({ position: pos + 1, total: queue.length, currentWork: currentWorkName, currentWorkPos });
      }
    }

    if (data.assigned_teknisi_id) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", data.assigned_teknisi_id).single();
      setTeknisiName(profile?.full_name || "");
    }

    const [itemsRes, timelineRes, docsRes, qcDocsRes, feedbackRes] = await Promise.all([
      data.status === "completed"
        ? supabase.from("service_items").select("*").eq("service_order_id", data.id).eq("is_final", true)
        : Promise.resolve({ data: [] }),
      supabase.from("service_timeline").select("*").eq("service_order_id", data.id).order("created_at", { ascending: true }),
      supabase.from("service_documentation").select("*").eq("service_order_id", data.id).eq("stage", "initial_condition"),
      supabase.from("service_documentation").select("*").eq("service_order_id", data.id).eq("stage", "qc"),
      supabase.from("feedbacks").select("id").eq("service_order_id", data.id).maybeSingle(),
     ]);
     if (itemsRes.data) setItems(itemsRes.data);
     if (timelineRes.data) setTimeline(timelineRes.data);
     if (docsRes.data) setInitialPhotos(docsRes.data);
     if (qcDocsRes.data) setQCPhotos(qcDocsRes.data);
     if (feedbackRes.data) setFeedbackAlready(true);

    await supabase.from("tracking_logs").insert({
      service_order_id: data.id,
      token: logToken,
    });
  };

  const trackServiceFromUrl = async (t: string) => {
    setLoading(true); setError("");
    try {
      let serviceQuery = supabase.from("service_orders").select("*").eq("token", t);
      if (branchDatabaseId) serviceQuery = serviceQuery.eq("branch_id", branchDatabaseId);
      const { data, error: fetchError } = await serviceQuery.single();
      if (fetchError || !data) { setError("Token tidak valid."); setLoading(false); return; }
      if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) { setError("Token sudah kadaluarsa."); setLoading(false); return; }
      setService(data);
      await hydrateService(data, t);
    } catch (e) { setError("Gagal mengambil informasi service"); }
    setLoading(false);
  };

  // Mode magic link: service sudah divalidasi oleh halaman /track/{invoice}/{code}
  useEffect(() => {
    if (!presetService) return;
    setService(presetService);
    setLoading(true);
    void hydrateService(presetService, presetService.token || "");
  }, []);

  // A11y photo viewer: Escape menutup modal + fokus masuk ke dialog
  useEffect(() => {
    if (!photoModal) return;
    modalRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhotoModal(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [photoModal]);

  const trackService = async () => {
    if (!token.trim()) { setError("Masukkan token tracking"); return; }
    setLoading(true); setError(""); setService(null);
    try {
      const normalizedToken = token.trim().toUpperCase();
      let serviceQuery = supabase.from("service_orders").select("*").eq("token", normalizedToken);
      if (branchDatabaseId) serviceQuery = serviceQuery.eq("branch_id", branchDatabaseId);
      const { data, error: fetchError } = await serviceQuery.single();
      if (fetchError || !data) { setError("Token tidak valid. Silakan cek kembali."); setLoading(false); return; }
      if (data.token_expires_at && new Date(data.token_expires_at) < new Date()) { setError("Token sudah kadaluarsa."); setLoading(false); return; }

      // Token valid → arahkan ke URL permanen service ini
      if (data.access_code && data.invoice_number) {
        router.replace(`/track/${encodeURIComponent(data.invoice_number)}/${data.access_code}`);
        setLoading(false);
        return;
      }

      setService(data);
      await hydrateService(data, normalizedToken);
    } catch (e) { setError("Gagal mengambil informasi service"); }
    setLoading(false);
  };

  const copyToken = () => {
    navigator.clipboard.writeText(service?.token || token);
    setCopiedId(true); toast.success("Token disalin!");
    setTimeout(() => setCopiedId(false), 2000);
  };

  const toggleSection = (s: keyof typeof expandedSections) => setExpandedSections((p) => ({ ...p, [s]: !p[s] }));

  // Rata-rata 3 dimensi (skala 5, 1 desimal) — sumber: rating_detail di DB
  const feedbackAverage = useMemo(() => {
    const sum = feedbackRatings.kepuasan + feedbackRatings.layanan + feedbackRatings.kualitas;
    return Math.round((sum / 3) * 10) / 10;
  }, [feedbackRatings]);

  const handleFeedbackSubmit = async () => {
    const { kepuasan, layanan, kualitas } = feedbackRatings;
    if (kepuasan === 0 || layanan === 0 || kualitas === 0) { toast.error("Lengkapi semua penilaian (kepuasan, layanan, kualitas)"); return; }
    if (!service) return;
    setFeedbackLoading(true);
    try {
      const { error: insertError } = await supabase.from("feedbacks").insert({
        service_order_id: service.id, customer_name: service.customer_name,
        rating: Math.round(feedbackAverage),
        rating_detail: { kepuasan, layanan, kualitas },
        comment: feedbackComment.trim() || null,
        teknisi_id: service.assigned_teknisi_id || null,
        branch_id: service.branch_id || null,
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
          message: service.customer_name + " rated service " + service.invoice_number + " with " + feedbackAverage.toFixed(1) + "/5 stars",
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

  if (!service && presetService) {
    return (
      <div className="glacier min-h-screen flex items-center justify-center p-4">
        <GlacierThemeToggle />
        <div className="w-8 h-8 border-2 border-[#7dd3fc] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="glacier min-h-screen flex items-center justify-center p-4">
        <GlacierThemeToggle />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="gl-card w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-sky-400/25 to-cyan-500/10 border border-[color:var(--gl-border-strong)] rounded-xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_32px_rgba(125,211,252,0.15)]">
              <Watch className="w-8 h-8 gl-ice" />
            </div>
              <h1 className="text-2xl font-bold text-[color:var(--gl-text)] tracking-tight">ARLOGIC SERVICE TRACKER</h1>
            <p className="text-sm gl-t2 mt-1">Masukkan kode token tracking Anda</p>
          </div>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 gl-t3 pointer-events-none" />
              <input type="text" value={token} onChange={(e) => setToken(e.target.value.toUpperCase())}
                placeholder="Masukkan token tracking"
                aria-label="Token tracking"
                className="gl-input pl-9 pr-4 py-3 font-mono"
                onKeyDown={(e) => e.key === "Enter" && trackService()} />
            </div>
            {error && <p role="alert" className="text-red-400 text-sm flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
            <button onClick={trackService} disabled={loading}
              className="gl-btn-primary w-full font-semibold py-3 rounded-xl flex items-center justify-center gap-2">
              {loading ? <div className="w-5 h-5 border-2 border-[#7dd3fc] border-t-transparent rounded-full animate-spin" />
                : <><Search className="w-4 h-4" />                 Lacak Sekarang</>}
            </button>
          </div>
          <div className="gl-inset mt-6 p-4">
            <p className="text-xs gl-t2 text-center">Token diberikan saat membuat service. Jika belum menerima token, hubungi admin cabang.</p>
            {trackingRequestWhatsAppUrl ? (
              <div className="mt-3 space-y-2">
                <input
                  type="text"
                  value={trackingRequestName}
                  onChange={(event) => setTrackingRequestName(event.target.value)}
                  placeholder="Nama customer"
                  aria-label="Nama customer"
                  className="gl-input px-3 py-2 text-xs"
                />
                <input
                  type="text"
                  value={trackingRequestInvoice}
                  onChange={(event) => setTrackingRequestInvoice(event.target.value.toUpperCase())}
                  placeholder="Nomor invoice"
                  aria-label="Nomor invoice"
                  className="gl-input px-3 py-2 text-xs font-mono"
                />
                <a
                  href={trackingRequestWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gl-btn-wa mx-auto flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Hubungi admin via WhatsApp
                </a>
              </div>
            ) : adminWhatsAppUrl ? (
              <a
                href={adminWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gl-btn-wa mx-auto mt-3 flex w-fit items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold"
              >
                <Phone className="h-3.5 w-3.5" />
                Hubungi admin
              </a>
            ) : (
              <p className="mt-2 text-center text-[11px] gl-t3">Buka melalui link tracking cabang untuk menghubungi admin.</p>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="glacier min-h-screen">
      <GlacierThemeToggle />
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-5">
        {/* Header Card */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="gl-card overflow-hidden">
          <div className="grid md:grid-cols-3">
            <div className="p-5 text-center border-b gl-bd md:border-b-0">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-10 h-10 bg-gradient-to-br from-sky-400/25 to-cyan-500/10 border border-[color:var(--gl-border-strong)] rounded-xl flex items-center justify-center">
                  <Watch className="w-5 h-5 gl-ice" />
                </div>
                  <span className="text-lg font-bold text-[color:var(--gl-text)]">Arlogic Watch Service</span>
                </div>
                <p className="text-xs gl-t2">Pusat Layanan Service</p>
            </div>
            <div className="p-5 text-center border-b md:border-b-0 gl-bd md:border-l">
              <p className="text-[11px] font-semibold uppercase gl-t3 tracking-wider">Invoice</p>
              <p className="text-lg font-bold font-mono text-[color:var(--gl-text)]">{service.invoice_number}</p>
              <p className="text-xs gl-t2 mt-1">{fmtDate(service.created_at)}</p>
            </div>
            <div className="p-5 text-center md:border-l gl-bd">
              <p className="text-[11px] font-semibold uppercase gl-t3 tracking-wider">Status</p>
              <div className="mt-1">
                <span className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full border ${statusColors[service.status] || statusColors.pending}`}>
                  {service.status === "qc_pending" ? "Quality Check" : service.status === "waiting_sparepart" ? "Menunggu Sparepart" : service.status === "in_progress" ? "Dikerjakan" : service.status === "assigned" ? "Ditugaskan" : service.status === "completed" ? "Selesai" : service.status === "cancelled" ? "Dibatalkan" : service.status}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* QR Code + Token */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
          className="gl-card p-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-semibold uppercase gl-t3 tracking-wider flex items-center gap-2 justify-center sm:justify-start">
                Scan QR Code untuk Lacak Service</p>
              <p className="text-sm gl-t2 mt-1">Scan dengan camera HP untuk akses cepat</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="border gl-bd p-2 bg-white rounded-xl shadow-sm">
                <QRCodeSVG value={typeof window !== "undefined" ? window.location.origin + "/tracking" : ""} size={72} level="H" />
                <p className="text-[10px] text-slate-500 mt-1 text-center">Scan untuk lacak</p>
              </div>
              <div>
                <p className="text-xs gl-t2">Token</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="px-2 py-1 bg-[color:var(--gl-surface-inset)] border gl-bd rounded-lg font-mono text-sm text-[color:var(--gl-text)]">{service.token}</code>
                  <button onClick={copyToken} aria-label="Salin token" className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-[color:var(--gl-accent-soft)] rounded-lg transition-all">
                    {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 gl-t3" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Queue Position - only for active services */}
        {queuePosition && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className="gl-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-sky-400/25 to-cyan-500/15 border border-[color:var(--gl-border-strong)] rounded-xl flex items-center justify-center">
                  <span className="font-bold text-sm gl-ice">#{queuePosition.position}</span>
                </div>
                <div>
                  <p className="text-xs gl-t2">Antrian Anda</p>
                  <p className="font-bold text-[color:var(--gl-text)]">Posisi {queuePosition.position} dari {queuePosition.total}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs gl-t2">Sedang dikerjakan</p>
                <p className="font-semibold text-sm text-[color:var(--gl-text)]">
                  {queuePosition.currentWork
                    ? `Antrian #${queuePosition.currentWorkPos} oleh ${queuePosition.currentWork}`
                    : 'Mohon Bersabar ya'}
                </p>
              </div>
            </div>
            <div className="mt-3 bg-[color:var(--gl-surface-inset)] rounded-full h-2 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-sky-400 to-cyan-300 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (queuePosition.position / queuePosition.total) * 100)}%` }} />
            </div>
          </motion.div>
        )}

        {/* Progress Steps */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="gl-card p-5">
          <h2 className="text-base font-bold text-[color:var(--gl-text)] mb-5 flex items-center gap-2">
            <Clock className="w-5 h-5 gl-ice" /> Progress Service
          </h2>
          <div className="relative">
            {statusSteps.map((step, index) => {
              const isCompleted = index <= currentStep;
              const isCurrent = index === currentStep;
              const stepDesc =
                step.status === "pending"
                  ? service.created_by_name
                    ? `Pesanan service telah diterima oleh ${service.created_by_name}${service.created_by_role ? ` (${String(service.created_by_role).toUpperCase()})` : ""}`
                    : step.desc
                  : step.status === "assigned" && teknisiName
                    ? `Service ditugaskan ke teknisi — ${teknisiName}`
                    : step.desc;
              return (
                <div key={step.status} className="relative flex items-start gap-4 pb-8 last:pb-0">
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl border-2 z-10 relative transition-all ${isCompleted ? "bg-gradient-to-br " + step.color + " text-white border-transparent shadow-[0_0_16px_rgba(125,211,252,0.25)]" : "bg-[color:var(--gl-surface-inset)] gl-t3 border-[color:var(--gl-border)]"}`}>
                      {isCompleted ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
                    </div>
                    {index < statusSteps.length - 1 && (
                      <div className={`absolute top-10 left-5 w-0.5 h-8 ${isCompleted ? "bg-sky-400/70" : "bg-[color:var(--gl-border)]"}`} />
                    )}
                  </div>
                  <div className={`flex-1 pt-1.5 ${isCurrent ? "bg-[color:var(--gl-accent-soft)] -mx-3 p-3 rounded-xl border border-[color:var(--gl-border)]" : ""}`}>
                    <h3 className={`font-semibold text-sm ${isCompleted ? "text-[color:var(--gl-text)]" : "gl-t2"}`}>{step.label}</h3>
                    <p className="text-xs gl-t3 mt-0.5">{stepDesc}</p>
                    {isCurrent && service.status === "in_progress" && (
                      <p className="text-xs text-sky-300 mt-1 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse" />Sedang dikerjakan...</p>
                    )}
                    {isCurrent && service.status === "waiting_sparepart" && (
                      <p className="text-xs text-amber-300 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Menunggu konfirmasi sparepart</p>
                    )}
                    {isCurrent && service.status === "completed" && (
                      <p className="text-xs text-emerald-300 mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" />Siap diambil!</p>
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
            className="gl-card overflow-hidden">
            <button onClick={() => toggleSection("device")} aria-expanded={expandedSections.device} aria-controls="gl-panel-device"
              className="w-full flex items-center justify-between p-4 gl-hover-row rounded-t-xl">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[color:var(--gl-accent-soft)] border border-[color:var(--gl-border)] rounded-lg flex items-center justify-center">
                  <Smartphone className="w-4 h-4 gl-ice" />
                </div>
                <h3 className="font-semibold text-sm text-[color:var(--gl-text)]">Informasi Service</h3>
              </div>
              {expandedSections.device ? <ChevronDown className="w-4 h-4 gl-t3" /> : <ChevronRight className="w-4 h-4 gl-t3" />}
            </button>
            {expandedSections.device && (
              <div id="gl-panel-device" className="p-5 space-y-4 border-t gl-bd">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-[color:var(--gl-accent-soft)] border border-[color:var(--gl-border)] rounded-xl">
                    <User className="w-5 h-5 gl-ice flex-shrink-0" />
                    <div>
                      <p className="text-xs gl-t2">Customer</p>
                      <p className="font-semibold text-[color:var(--gl-text)]">{service.customer_name}</p>
                      <p className="text-sm gl-t2">{maskPhone(service.customer_phone)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-violet-400/10 border border-violet-400/20 rounded-xl">
                    <Watch className="w-5 h-5 text-violet-300 flex-shrink-0" />
                    <div>
                      <p className="text-xs gl-t2">Device</p>
                      <p className="font-semibold text-[color:var(--gl-text)]">{service.watch_brand || service.device_brand}{service.device_model ? " " + service.device_model : ""}</p>
                      <p className="text-xs gl-t3 capitalize">{service.device_type}</p>
                    </div>
                  </div>
                </div>
                {service.watch_movement && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-amber-400/5 border border-amber-400/15 rounded-xl">
                    {service.watch_brand && <div><span className="text-xs gl-t2">Brand:</span> <span className="font-semibold text-sm text-[color:var(--gl-text)]">{service.watch_brand}</span></div>}
                    {service.watch_model && <div><span className="text-xs gl-t2">Model:</span> <span className="font-semibold text-sm text-[color:var(--gl-text)]">{service.watch_model}</span></div>}
                    {service.watch_year && <div><span className="text-xs gl-t2">Tahun:</span> <span className="font-semibold text-sm text-[color:var(--gl-text)]">{service.watch_year}</span></div>}
                    {service.watch_movement && <div className="flex items-center gap-1"><span className="text-xs gl-t2">Movement:</span> <span className="gl-ice">{getMovementIcon(service.watch_movement)}</span> <span className="font-semibold text-sm capitalize text-[color:var(--gl-text)]">{service.watch_movement}</span></div>}
                    {service.watch_condition && <div><span className="text-xs gl-t2">Condition:</span> <span className="font-semibold text-sm capitalize text-[color:var(--gl-text)]">{service.watch_condition}</span></div>}
                    {service.category && <div><span className="text-xs gl-t2">Kategori:</span> <span className="font-semibold text-sm capitalize text-[color:var(--gl-text)]">{service.category}</span></div>}
                  </div>
                )}
                {service.serial_number && (
                  <div className="flex items-center gap-2 p-3 gl-inset">
                    <Hash className="w-4 h-4 gl-t3" />
                    <span className="text-sm gl-t2">Serial: <span className="font-mono font-semibold text-[color:var(--gl-text)]">{service.serial_number}</span></span>
                  </div>
                )}
                {service.watch_accessories?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-3 gl-inset">
                    <span className="text-xs gl-t2 w-full">Aksesoris:</span>
                    {service.watch_accessories.map((acc: string, i: number) => (
                      <span key={i} className="text-[10px] bg-[color:var(--gl-surface-inset)] border gl-bd px-2 py-0.5 rounded-md gl-t2">
                        {acc}
                      </span>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold gl-t2 mb-1 uppercase tracking-wider">Kerusakan</p>
                  <div className="p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-sm text-[color:var(--gl-text)]">{service.issue_description}</div>
                </div>
                {service.request && <div><p className="text-xs font-semibold gl-t2 mb-1 uppercase tracking-wider">Request Customer</p><div className="p-3 bg-[color:var(--gl-accent-soft)] border border-[color:var(--gl-border)] rounded-xl text-sm text-[color:var(--gl-text)]">{service.request}</div></div>}
                {service.notes && <div><p className="text-xs font-semibold gl-t2 mb-1 uppercase tracking-wider">Catatan</p><div className="p-3 gl-inset text-sm text-[color:var(--gl-text)]">{service.notes}</div></div>}
              </div>
            )}
          </motion.div>

          {/* Teknisi Info */}
          {teknisiName && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }}
              className="gl-card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-400/25 to-purple-500/15 border border-[color:var(--gl-border-strong)] rounded-xl flex items-center justify-center">
                  <Wrench className="w-5 h-5 text-violet-300" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase gl-t3 tracking-wider">Technician</p>
                  <p className="font-semibold text-[color:var(--gl-text)]">{teknisiName}</p>
                  <p className="text-xs gl-t3">Master Horologist — Assigned to your service</p>
                  {service.start_date && <p className="text-xs gl-t3">Mulai: {fmtDate(service.start_date)}</p>}
                </div>
                {service.work_duration && (
                  <div className="ml-auto text-right">
                    <p className="text-xs gl-t2">Durasi</p>
                    <p className="font-semibold text-sm text-[color:var(--gl-text)]">{service.work_duration}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Initial Condition Photos */}
          {initialPhotos.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              className="gl-card overflow-hidden">
              <button onClick={() => toggleSection("photos")} aria-expanded={expandedSections.photos} aria-controls="gl-panel-photos"
                className="w-full flex items-center justify-between p-4 gl-hover-row rounded-t-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-400/10 border border-emerald-400/20 rounded-lg flex items-center justify-center">
                    <Camera className="w-4 h-4 text-emerald-300" />
                  </div>
                  <h3 className="font-semibold text-sm text-[color:var(--gl-text)]">Foto Kondisi Awal ({initialPhotos.length})</h3>
                </div>
                {expandedSections.photos ? <ChevronDown className="w-4 h-4 gl-t3" /> : <ChevronRight className="w-4 h-4 gl-t3" />}
              </button>
              {expandedSections.photos && (
                <div id="gl-panel-photos" className="p-5 border-t gl-bd">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {initialPhotos.map((photo, i) => (
                      <motion.button key={photo.id || i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                        type="button" aria-label={"Perbesar foto kondisi awal " + (i + 1)}
                        className="gl-media-frame relative group aspect-square cursor-pointer block w-full"
                        onClick={() => setPhotoModal({ url: photo.photo_url, media_type: photo.media_type })}>
                        {isPlayableVideo(photo.media_type, photo.photo_url) ? (
                          <video src={photo.photo_url} className="w-full h-full object-cover" />
                        ) : (
                          <img src={photo.photo_url} alt={"Kondisi Awal " + (i + 1)} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center pointer-events-none">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                            <Search className="w-4 h-4 text-slate-800" />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Before & After Photos - only when completed */}
          {(service.status === 'completed' || service.status === 'done') && qcPhotos.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
              className="gl-card p-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-emerald-400/10 border border-emerald-400/20 rounded-lg flex items-center justify-center">
                    <Camera className="w-4 h-4 text-emerald-300" />
                  </div>
                  <h3 className="font-semibold text-sm text-[color:var(--gl-text)]">Before &amp; After</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {initialPhotos.length > 0 && (
                    <div>
                      <p className="text-xs font-medium gl-t2 mb-2">Kondisi Awal</p>
                      {isPlayableVideo(initialPhotos[0].media_type, initialPhotos[0].photo_url) ? (
                        <video src={initialPhotos[0].photo_url} className="gl-media-frame w-full aspect-square object-cover cursor-pointer" onClick={() => setPhotoModal({ url: initialPhotos[0].photo_url, media_type: 'video' })} />
                      ) : (
                        <img src={initialPhotos[0].photo_url} alt="Before" loading="lazy"
                          className="gl-media-frame w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setPhotoModal({ url: initialPhotos[0].photo_url, media_type: initialPhotos[0].media_type })} />
                      )}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium gl-t2 mb-2">Hasil Service</p>
                    {qcPhotos.length > 0 && (
                      isPlayableVideo(qcPhotos[0].media_type, qcPhotos[0].photo_url) ? (
                        <video src={qcPhotos[0].photo_url} className="gl-media-frame w-full aspect-square object-cover cursor-pointer" onClick={() => setPhotoModal({ url: qcPhotos[0].photo_url, media_type: 'video' })} />
                      ) : (
                        <img src={qcPhotos[0].photo_url} alt="After" loading="lazy"
                          className="gl-media-frame w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => setPhotoModal({ url: qcPhotos[0].photo_url, media_type: qcPhotos[0].media_type })} />
                      )
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Items & Cost - always show if exists (source: service_items = QC approved final) */}
          {/* Rincian Biaya — menggunakan ServiceCostBreakdown */}
          {(service.status === "completed" || service.status === "done") && finalItems.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="gl-card p-4">
              <ServiceCostBreakdown items={finalItems} dp={dp} discount={discount} variant="glacier" />
            </motion.div>
          )}

          {/* Rincian Pembayaran (legacy fallback — tanpa items) */}
          {(service.status === "completed" || service.status === "done") && finalItems.length === 0 && (service.down_payment > 0 || service.discount > 0) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
              className="gl-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-emerald-400/10 border border-emerald-400/20 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-emerald-300" />
                </div>
                <h3 className="font-semibold text-sm text-[color:var(--gl-text)]">Rincian Pembayaran</h3>
              </div>
              <div className="space-y-2">
                {service.down_payment > 0 && (
                  <div className="flex justify-between text-sm"><span className="gl-t2">DP</span><span className="font-semibold text-emerald-400 tabular-nums">-{fmtRupiah(service.down_payment)}</span></div>
                )}
                {service.discount > 0 && (
                  <div className="flex justify-between text-sm"><span className="gl-t2">Diskon</span><span className="font-semibold text-red-400 tabular-nums">-{fmtRupiah(service.discount)}</span></div>
                )}
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[color:var(--gl-text)]">Sisa yang harus dibayar</span>
                  <span className={`font-bold text-lg tabular-nums ${remaining === 0 ? 'text-emerald-400' : 'text-[color:var(--gl-text)]'}`}>
                    {remaining === 0 ? 'LUNAS' : fmtRupiah(remaining)}
                  </span>
                </div>
                {remaining === 0 && (
                  <p className="text-xs text-emerald-300 font-medium flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3" />Pembayaran LUNAS</p>
                )}
              </div>
            </motion.div>
          )}

          {/* Timeline Updates */}
          {timeline.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="gl-card overflow-hidden">
              <button onClick={() => toggleSection("timeline")} aria-expanded={expandedSections.timeline} aria-controls="gl-panel-timeline"
                className="w-full flex items-center justify-between p-4 gl-hover-row rounded-t-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[color:var(--gl-accent-soft)] border border-[color:var(--gl-border)] rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 gl-ice" />
                  </div>
                  <h3 className="font-semibold text-sm text-[color:var(--gl-text)]">Update Progress</h3>
                </div>
                {expandedSections.timeline ? <ChevronDown className="w-4 h-4 gl-t3" /> : <ChevronRight className="w-4 h-4 gl-t3" />}
              </button>
              {expandedSections.timeline && (
                <div id="gl-panel-timeline" className="p-5 space-y-4 max-h-96 overflow-y-auto border-t gl-bd">
                  {timeline.map((update, i) => (
                    <div key={update.id} className="relative pl-6 pb-4 last:pb-0">
                      {i < timeline.length - 1 && <div className="absolute left-2 top-4 bottom-0 w-0.5 bg-sky-400/30" />}
                      <div className="absolute left-0 top-1.5 w-3 h-3 bg-[#7dd3fc] rounded-full border-2 border-[color:var(--gl-bg)] shadow-[0_0_8px_rgba(125,211,252,0.5)]" />
                      <div className="bg-[color:var(--gl-surface-inset)] border border-[color:var(--gl-border)] p-3 ml-2 rounded-xl">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <span className="text-xs gl-t3">{fmtDate(update.created_at)}</span>
                          <span className={"gl-chip " + (update.status === "completed" ? "gl-chip-success" : update.status === "waiting_sparepart" ? "gl-chip-warn" : update.status === "in_progress" ? "gl-chip-purple" : update.status === "assigned" ? "gl-chip-info" : update.status === "qc_pending" ? "gl-chip-cyan" : "gl-chip-neutral")}>
                            {update.status === "completed" ? "SELESAI" : update.status === "waiting_sparepart" ? "MENUNGGU SPAREPART" : update.status === "in_progress" ? "DALAM PENGERJAAN" : update.status === "assigned" ? "DITUGASKAN" : update.status === "qc_pending" ? "QUALITY CHECK" : "UPDATE"}
                          </span>
                        </div>
                        <p className="text-sm text-[color:var(--gl-text)]">{update.message}</p>
                        {update.photo_url && (
                          <SmartMedia
                            src={update.photo_url}
                            mediaType={update.details?.media_type}
                            imgClassName="mt-2 rounded-lg border border-[color:var(--gl-border)] max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            videoClassName="mt-2 rounded-lg border border-[color:var(--gl-border)] max-h-48 w-full object-contain bg-black/60"
                            imgOnClick={() => window.open(update.photo_url, "_blank")}
                          />
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
            className="bg-gradient-to-r from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 p-5 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/15">
                <CheckCircle className="w-6 h-6 text-emerald-300" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[color:var(--gl-text)]">Service Selesai!</h3>
                <p className="text-sm gl-t2">Jam tangan Anda sudah siap diambil. Bawa invoice dan token ini.</p>
                {(service.warranty_months || service.warranty_expiry) && (
                  <div className="flex items-center gap-3 mt-2 text-xs gl-ok-text">
                    <span>Garansi: {service.warranty_months ? `${service.warranty_months} bulan` : ""}</span>
                    {service.warranty_expiry && <span>Exp: {fmtDate(service.warranty_expiry)}</span>}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Feedback Section - Only when service is completed */}
        {service.status !== "completed" && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="gl-card p-5 text-center">
            <div className="w-12 h-12 gl-inset flex items-center justify-center mx-auto mb-3">
              <Clock className="w-6 h-6 gl-t3" />
            </div>
              <h3 className="font-bold text-[color:var(--gl-text)]">Penilaian Belum Tersedia</h3>
            <p className="text-sm gl-t2 mt-1">Penilaian dapat diberikan setelah service selesai.</p>
          </motion.div>
        )}

        {service.status === "completed" && !feedbackAlready && !feedbackSubmitted && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="gl-card p-5">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-400/25 to-orange-500/10 border border-amber-400/30 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-[0_0_24px_rgba(251,191,36,0.15)]">
                <Star className="w-6 h-6 text-amber-400" />
              </div>
                  <h3 className="text-base font-bold text-[color:var(--gl-text)]">Beri Nilai</h3>
                  <p className="text-sm gl-t2 mt-0.5">Bagaimana pengalaman service Anda?</p>
            </div>

            <div className="space-y-4 py-2">
              {([
                { key: "kepuasan", label: "Kepuasan" },
                { key: "layanan", label: "Layanan" },
                { key: "kualitas", label: "Kualitas Service" },
              ] as const).map(({ key, label }) => {
                const value = feedbackRatings[key];
                const shown = feedbackHover.row === key ? feedbackHover.value : value;
                return (
                  <div key={key} className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                    <div className="min-w-[9rem]">
                      <p className="text-sm font-semibold text-[color:var(--gl-text)]">{label}</p>
                      <p aria-live="polite" className="text-xs gl-t3 h-4">{shown > 0 ? ratingLabels[shown] : "Wajib diisi"}</p>
                    </div>
                    <div className="flex items-center gap-1" role="radiogroup" aria-label={`Rating ${label}`}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <motion.button key={star} whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} type="button"
                          role="radio" aria-checked={value === star} aria-label={`${label}: ${star} bintang dari 5`}
                          onClick={() => setFeedbackRatings((p) => ({ ...p, [key]: star }))}
                          onMouseEnter={() => setFeedbackHover({ row: key, value: star })}
                          onMouseLeave={() => setFeedbackHover({ row: null, value: 0 })}>
                          <Star size={28} className={"transition-all duration-150 " + (star <= shown ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.35)]" : "text-[color:var(--gl-text-muted)]")} />
                        </motion.button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 gl-inset px-3 py-2 flex items-center justify-between">
              <span className="text-xs gl-t2">Rata-rata penilaian Anda</span>
              <span className="text-sm font-bold text-[color:var(--gl-accent-strong)] tabular-nums">{feedbackAverage.toFixed(1)} / 5</span>
            </div>

            <div className="mt-4">
              <textarea value={feedbackComment} onChange={(e) => setFeedbackComment(e.target.value)} aria-label="Komentar feedback"
                placeholder="Ceritakan pengalaman Anda (opsional)..." rows={3}
                className="gl-input px-3 py-2.5 text-sm resize-none" />
              <p className="text-xs gl-t3 text-right mt-1">{feedbackComment.length}/500</p>
            </div>

            <button onClick={handleFeedbackSubmit} disabled={feedbackLoading || feedbackAverage === 0}
              className="gl-btn-primary w-full mt-4 flex items-center justify-center gap-2 py-2.5 font-semibold rounded-xl">
              {feedbackLoading ? <div className="w-4 h-4 border-2 border-[#7dd3fc] border-t-transparent rounded-full animate-spin" /> :                 <><Send className="w-4 h-4" /> Kirim Penilaian</>}
            </button>
          </motion.div>
        )}

        {/* Feedback Already Submitted */}
        {service.status === "completed" && (feedbackAlready || feedbackSubmitted) && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-amber-400/10 to-orange-500/5 border border-amber-400/25 rounded-xl p-5 text-center">
            <div className="w-12 h-12 bg-amber-400/10 border border-amber-400/25 rounded-xl flex items-center justify-center mx-auto mb-3">
              <CheckCircle className="w-6 h-6 text-amber-400" />
            </div>
              <h3 className="font-bold text-[color:var(--gl-text)]">Penilaian Terkirim</h3>
            <p className="text-sm gl-t2 mt-1">Terima kasih! Penilaian Anda sangat berarti untuk kami.</p>
            {feedbackSubmitted && feedbackAverage > 0 && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <span className="text-sm font-bold text-[color:var(--gl-accent-strong)] tabular-nums">{feedbackAverage.toFixed(1)}</span>
                <div className="relative inline-flex">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} size={20} className="text-[color:var(--gl-text-muted)]" />
                    ))}
                  </div>
                  <div className="absolute inset-0 overflow-hidden" style={{ width: `${(feedbackAverage / 5) * 100}%` }}>
                    <div className="flex items-center gap-0.5 w-max">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} size={20} className="text-amber-400 fill-amber-400 flex-shrink-0" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Contact */}
        <div className="text-center pt-2 pb-4">
          <p className="text-sm gl-t2">Butuh bantuan terkait service ini?</p>
          {adminWhatsAppUrl ? (
            <a
              href={adminWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gl-btn-wa mt-2 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
            >
              <Phone className="h-4 w-4" />
              Hubungi admin
            </a>
          ) : (
            <p className="mt-1 text-xs gl-t3">Kontak admin untuk cabang ini belum tersedia.</p>
          )}
        </div>
      </div>

      {/* Photo Modal */}
      {photoModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setPhotoModal(null)}>
          <motion.div ref={modalRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Pratinjau dokumentasi service"
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative max-w-2xl w-full focus:outline-none">
            <button onClick={() => setPhotoModal(null)} aria-label="Tutup pratinjau" className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors">
              <X className="w-6 h-6" />
            </button>
            <SmartMedia
              src={photoModal.url}
              mediaType={photoModal.media_type}
              imgClassName="w-full rounded-xl shadow-2xl"
              videoClassName="w-full rounded-xl shadow-2xl bg-black"
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

function TrackingRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/tracking");
  }, [router]);
  return (
    <div className="glacier min-h-screen flex items-center justify-center p-4">
      <div className="w-8 h-8 border-2 border-[#7dd3fc] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function TrackingPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  if (slug && slug.length > 0) return <TrackingRedirect />;
  return <TrackingContent />;
}
