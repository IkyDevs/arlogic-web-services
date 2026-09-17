"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Watch,
  Settings,
  Battery,
  Smartphone,
  Zap,
  User,
  Phone,
  AlertCircle,
  Camera,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { buildServiceTrackingUrl } from "@/lib/appUrl";
import toast from "react-hot-toast";

const serviceStatusLabels: Record<string, string> = {
  pending: "Menunggu",
  assigned: "Ditugaskan",
  in_progress: "Dalam Pengerjaan",
  req_sparepart_admin: "Request PO",
  po_pending: "PO Pending",
  sparepart_ready: "Sparepart Ready",
  qc_pending: "Quality Check",
  revision_required: "Perlu Revisi",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const movementLabels: Record<string, string> = {
  automatic: "Automatic",
  quartz: "Quartz",
  digital: "Digital",
  analog_digital: "Analog Digital",
  kinetic: "Kinetic",
  smartwatch: "Smartwatch",
  other: "Other",
};

const movementIcons: Record<string, any> = {
  automatic: Settings,
  quartz: Battery,
  digital: Settings,
  analog_digital: Watch,
  kinetic: Zap,
  smartwatch: Smartphone,
};

const getStatusColor = (status: string) => {
  const map: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700 border-slate-200",
    assigned: "bg-blue-100 text-blue-700 border-blue-200",
    in_progress: "bg-purple-100 text-purple-700 border-purple-200",
    req_sparepart_admin: "bg-orange-100 text-orange-700 border-orange-200",
    po_pending: "bg-amber-100 text-amber-700 border-amber-200",
    sparepart_ready: "bg-teal-100 text-teal-700 border-teal-200",
    qc_pending: "bg-indigo-100 text-indigo-700 border-indigo-200",
    revision_required: "bg-rose-100 text-rose-700 border-rose-200",
    completed: "bg-green-100 text-green-200 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };
  return map[status] || map.pending;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
}

interface ServiceData {
  id: string;
  invoice_number: string;
  token: string;
  access_code?: string;
  customer_name: string;
  customer_phone: string;
  watch_brand?: string;
  watch_model?: string;
  device_brand?: string;
  device_model?: string;
  watch_movement?: string;
  category?: string;
  issue_description: string;
  status: string;
  estimated_cost?: number;
  down_payment?: number;
  assigned_teknisi_id?: string;
  created_by?: string;
  created_by_name?: string;
  created_by_role?: string;
  branch_id?: string;
  created_at: string;
  transferred_to_branch_id?: string | null;
  profiles?: { full_name: string } | null;
  _transferInfo?: string | null;
  _photos?: string[];
}

interface DetailModalProps {
  service: ServiceData;
  onClose: () => void;
}

function DetailModal({ service, onClose }: DetailModalProps) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoLabels, setPhotoLabels] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  useEffect(() => {
    const loadPhotos = async () => {
      setLoadingPhotos(true);
      const { data } = await supabase
        .from("service_documentation")
        .select("photo_url, label")
        .eq("service_order_id", service.id)
        .order("created_at", { ascending: true });

      const withUrl = (data || []).filter((d: any) => !!d.photo_url);
      setPhotos(withUrl.map((d: any) => d.photo_url));
      setPhotoLabels(withUrl.map((d: any) => d.label || ""));
      setLoadingPhotos(false);
    };

    loadPhotos();
  }, [service.id, supabase]);

  const magicTrackingUrl = buildServiceTrackingUrl(
    service.invoice_number,
    service.access_code || ""
  );

  const copyToken = () => {
    navigator.clipboard.writeText(service.token);
    setCopiedToken(true);
    toast.success("Token disalin!");
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70]"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-full h-full flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#111111] rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#111111] z-20 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-900 dark:bg-white/10 rounded-xl flex items-center justify-center">
              <Watch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-gray-100">
                Detail Service
              </h2>
              <p className="text-[11px] text-slate-500">
                {service.invoice_number}
              </p>
              {service._transferInfo && (
                <span className="mt-1 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                  🔄 {service._transferInfo}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* QR + Token */}
          <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
            <div className="bg-white dark:bg-slate-800 p-2 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm flex-shrink-0">
              <QRCodeSVG value={magicTrackingUrl} size={72} level="H" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Token Tracking
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <code className="text-sm font-mono font-bold text-slate-900 dark:text-gray-100 truncate">
                  {service.token}
                </code>
                <button
                  onClick={copyToken}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                >
                  {copiedToken ? (
                    <span className="text-xs text-green-600">✓</span>
                  ) : (
                    <span className="text-xs text-slate-400">📋</span>
                  )}
                </button>
              </div>
              <a
                href={magicTrackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-1"
              >
                Buka Tracking Page →
              </a>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500">Customer</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">
                  {service.customer_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/30">
              <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div className="min-w-0">
                <p className="text-[10px] text-slate-500">Phone</p>
                <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 font-mono truncate">
                  {service.customer_phone}
                </p>
              </div>
            </div>
          </div>

          {/* Device Info */}
          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
              Device
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Brand:</span>{" "}
                <span className="font-medium text-slate-900 dark:text-gray-100">
                  {service.watch_brand || service.device_brand || "-"}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Model:</span>{" "}
                <span className="font-medium text-slate-900 dark:text-gray-100">
                  {service.watch_model || service.device_model || "-"}
                </span>
              </div>
              {service.watch_movement && (
                <div className="flex items-center gap-1">
                  <span className="text-slate-500">Tipe:</span>
                  {service.watch_movement &&
                    (() => {
                      const Icon = movementIcons[service.watch_movement] || Watch;
                      return (
                        <Icon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                      );
                    })()}
                  <span className="font-medium">
                    {movementLabels[service.watch_movement]}
                  </span>
                </div>
              )}
              {service.category && (
                <div>
                  <span className="text-slate-500">Kategori:</span>{" "}
                  <span className="font-medium">{service.category}</span>
                </div>
              )}
            </div>
          </div>

          {/* Issue */}
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/30">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">
                  Kendala
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  {service.issue_description}
                </p>
              </div>
            </div>
          </div>

          {/* Photos */}
          {loadingPhotos ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
            </div>
          ) : photos.length > 0 ? (
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">
                Foto ({photos.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, i) => (
                  <div key={i} className="space-y-1">
                    <button
                      onClick={() => {
                        setCurrentPhotoIndex(i);
                        setShowGallery(true);
                      }}
                      className="rounded-xl border border-slate-200 dark:border-white/10 aspect-square overflow-hidden hover:opacity-80 transition-opacity w-full"
                    >
                      <img
                        src={url}
                        alt={`foto-${i}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                    {photoLabels[i] && (
                      <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wide truncate">
                        {photoLabels[i]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Status & Info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
              <p className="text-[10px] text-slate-500">Status</p>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full border mt-0.5 ${getStatusColor(
                  service.status
                )}`}
              >
                {serviceStatusLabels[service.status] || service.status}
              </span>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
              <p className="text-[10px] text-slate-500">Estimasi Biaya</p>
              <p className="text-sm font-bold text-slate-900 dark:text-gray-100">
                {service.estimated_cost
                  ? fmtRupiah(service.estimated_cost)
                  : "-"}
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
              <p className="text-[10px] text-slate-500">Teknisi</p>
              <p className="text-sm font-bold text-slate-900 dark:text-gray-100">
                {(service.profiles as any)?.full_name || "-"}
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
              <p className="text-[10px] text-slate-500">Down Payment</p>
              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {service.down_payment ? fmtRupiah(service.down_payment) : "-"}
              </p>
            </div>
          </div>

          {/* Created By */}
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
            <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">
              Dibuat Oleh
            </p>
            <p className="text-sm font-bold text-indigo-950 dark:text-indigo-100">
              {service.created_by_name
                ? `${service.created_by_name} (${(
                    service.created_by_role || "role N/A"
                  ).toUpperCase()})`
                : service.created_by_role
                ? `Role: ${service.created_by_role.toUpperCase()}`
                : "-"}
            </p>
          </div>

          {/* Created At */}
          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
            <p className="text-[10px] text-slate-500">Dibuat pada</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {new Date(service.created_at).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      </motion.div>
        </div>
      </div>

      {/* Photo Gallery Modal */}
      {showGallery && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
          onClick={() => setShowGallery(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowGallery(false);
            }}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          <div
            className="relative max-w-3xl w-full max-h-[85vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[currentPhotoIndex]}
              alt={`foto-${currentPhotoIndex}`}
              className="max-w-full max-h-[80vh] rounded-xl object-contain"
            />

            {photos.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentPhotoIndex((i) =>
                      i === 0 ? photos.length - 1 : i - 1
                    );
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentPhotoIndex((i) => (i + 1) % photos.length);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/50 rounded-full text-white text-xs">
                  {currentPhotoIndex + 1} / {photos.length}
                </div>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-2">
              {photos.map((url, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentPhotoIndex(i);
                  }}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    i === currentPhotoIndex
                      ? "border-white scale-110"
                      : "border-white/30 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={url}
                    alt={`thumb-${i}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

interface BranchColumnProps {
  branchId: string;
  branchName: string;
  services: ServiceData[];
  loading: boolean;
  onOpenDetail: (svc: ServiceData) => void;
}

function BranchColumn({
  branchId,
  branchName,
  services,
  loading,
  onOpenDetail,
}: BranchColumnProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [limit, setLimit] = useState<number>(100);

  const filtered = useMemo(() => {
    let data = services;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.customer_name?.toLowerCase().includes(q) ||
          s.customer_phone?.includes(q) ||
          s.invoice_number?.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter) {
      data = data.filter((s) => s.status === statusFilter);
    }

    // Sort
    data = [...data].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    // Limit
    if (limit > 0) {
      data = data.slice(0, limit);
    }

    return data;
  }, [services, search, statusFilter, sortOrder, limit]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Column Header */}
      <div className="flex-shrink-0 px-4 py-3 bg-white dark:bg-[#111111] border-b border-slate-200/70 dark:border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-gray-100">
            {branchName}
          </h3>
          <span className="text-[10px] font-medium text-slate-400">
            {filtered.length} / {services.length} service
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 px-3 py-2 bg-white dark:bg-[#111111] border-b border-slate-200/50 dark:border-white/5 space-y-2">
        {/* Row 1: Search + Status */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari..."
              className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-slate-900 dark:focus:border-white/30 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:outline-none"
          >
            <option value="">Semua Status</option>
            <option value="pending">Menunggu</option>
            <option value="assigned">Ditugaskan</option>
            <option value="in_progress">Dikerjakan</option>
            <option value="qc_pending">QC</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>

        {/* Row 2: Sort + Limit */}
        <div className="flex gap-2">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
            className="flex-1 px-2 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:outline-none"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
          </select>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-2 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg text-xs focus:outline-none"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
            <option value={0}>Semua</option>
          </select>
        </div>
      </div>

      {/* Service List - ONLY THIS SCROLLS */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Watch className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p className="text-xs text-slate-400">Tidak ada service</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {filtered.map((svc) => {
              const MoveIcon = svc.watch_movement
                ? movementIcons[svc.watch_movement] || Watch
                : Watch;
              return (
                <button
                  key={svc.id}
                  onClick={() => onOpenDetail(svc)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    {/* Photo Thumbnail */}
                    <div className="flex-shrink-0 w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                      {svc._photos && svc._photos.length > 0 ? (
                        <img
                          src={svc._photos[0]}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Camera className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] font-semibold text-slate-900 dark:text-gray-100">
                          {svc.invoice_number}
                        </span>
                        {svc._transferInfo && (
                          <span className="inline-flex items-center px-1 py-0.5 text-[8px] font-semibold rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                            🔄
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-900 dark:text-gray-100 truncate mt-0.5">
                        {svc.customer_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <MoveIcon className="w-3 h-3 text-slate-400" />
                        <span className="text-[10px] text-slate-500 truncate">
                          {svc.watch_brand || svc.device_brand || "-"}{" "}
                          {svc.watch_model || svc.device_model || ""}
                        </span>
                      </div>
                    </div>

                    {/* Status & Date */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${getStatusColor(
                          svc.status
                        )}`}
                      >
                        {serviceStatusLabels[svc.status] || svc.status}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {fmtDate(svc.created_at)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OwnerServiceView() {
  const supabase = createClient();
  const { branches } = useBranch();
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<ServiceData | null>(
    null
  );

  // Find Jember and Kudus branches
  const jemberBranch = useMemo(
    () =>
      branches.find(
        (b) =>
          b.name.toLowerCase().includes("jember") ||
          b.code?.toLowerCase().includes("jember")
      ),
    [branches]
  );

  const kudusBranch = useMemo(
    () =>
      branches.find(
        (b) =>
          b.name.toLowerCase().includes("kudus") ||
          b.code?.toLowerCase().includes("kudus")
      ),
    [branches]
  );

  // If exact match not found, use first two branches
  const leftBranch = jemberBranch || branches[0];
  const rightBranch = kudusBranch || branches[1];

  const fetchServices = useCallback(async () => {
    setLoading(true);
    try {
      const branchIds = [leftBranch?.id, rightBranch?.id].filter(Boolean);
      if (branchIds.length === 0) {
        setServices([]);
        return;
      }

      // Fetch all services (no limit in query, we handle limit in UI)
      const { data } = await supabase
        .from("service_orders")
        .select("*, profiles:assigned_teknisi_id(full_name)")
        .in("branch_id", branchIds)
        .neq("status", "done")
        .order("created_at", { ascending: false });

      if (data) {
        // Fetch transfer info
        const ids = data.map((s: any) => s.id);
        const { data: timelines } = await supabase
          .from("service_timeline")
          .select("service_order_id, status, details")
          .in("service_order_id", ids)
          .eq("status", "transferred")
          .order("created_at", { ascending: false });

        const transferMap: Record<string, any> = {};
        if (timelines) {
          for (const tl of timelines) {
            if (!transferMap[tl.service_order_id]) {
              transferMap[tl.service_order_id] = tl;
            }
          }
        }

        const allPhotos: any[] = [];
        const chunkSize = 50;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const { data: chunkPhotos } = await supabase
            .from("service_documentation")
            .select("service_order_id, photo_url")
            .in("service_order_id", chunk)
            .order("created_at", { ascending: true });
          if (chunkPhotos) allPhotos.push(...chunkPhotos);
        }

        const photosMap: Record<string, string[]> = {};
        if (allPhotos) {
          for (const p of allPhotos) {
            if (!photosMap[p.service_order_id]) {
              photosMap[p.service_order_id] = [];
            }
            if (p.photo_url) {
              photosMap[p.service_order_id].push(p.photo_url);
            }
          }
        }

        const enriched = data.map((s: any) => ({
          ...s,
          _transferInfo: transferMap[s.id]?.details?.from_branch_name
            ? `Transfer dari ${transferMap[s.id].details.from_branch_name}`
            : null,
          _photos: photosMap[s.id] || [],
        }));

        setServices(enriched);
      }
    } catch (e) {
      console.error("Gagal memuat service:", e);
    } finally {
      setLoading(false);
    }
  }, [supabase, leftBranch?.id, rightBranch?.id]);

  useEffect(() => {
    if (branches.length > 0) {
      fetchServices();
    }
  }, [branches, fetchServices]);

  // Separate services by branch
  const leftServices = useMemo(
    () => services.filter((s) => s.branch_id === leftBranch?.id),
    [services, leftBranch?.id]
  );

  const rightServices = useMemo(
    () => services.filter((s) => s.branch_id === rightBranch?.id),
    [services, rightBranch?.id]
  );

  const handleOpenDetail = useCallback((svc: ServiceData) => {
    setSelectedService({ ...svc });
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200/70 dark:border-white/5 bg-white dark:bg-[#111111]">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-gray-100">
              Service Orders
            </h2>
            <p className="text-[11px] text-slate-400">
              Lihat service per cabang (read-only)
            </p>
          </div>
          <button
            onClick={fetchServices}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Two Column Layout - FIXED, NO PAGE SCROLL */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-200/70 dark:divide-white/5">
        {/* Left Column - Jember */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0 h-full">
          <BranchColumn
            branchId={leftBranch?.id || ""}
            branchName={leftBranch?.name || "Cabang Kiri"}
            services={leftServices}
            loading={loading}
            onOpenDetail={handleOpenDetail}
          />
        </div>

        {/* Right Column - Kudus */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0 h-full">
          <BranchColumn
            branchId={rightBranch?.id || ""}
            branchName={rightBranch?.name || "Cabang Kanan"}
            services={rightServices}
            loading={loading}
            onOpenDetail={handleOpenDetail}
          />
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedService && (
          <DetailModal
            service={selectedService}
            onClose={() => setSelectedService(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
