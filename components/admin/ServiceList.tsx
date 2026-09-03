"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildServiceTrackingUrl } from "@/lib/appUrl";
import { useBranchScope } from "@/lib/context/useBranchScope";
import { useBranch } from "@/lib/context/BranchContext";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Search, Clock, ChevronDown, ChevronUp, Watch, Smartphone, Settings, Battery, Zap, X, Plus, RotateCw, Copy, Check, User, Phone, Hash, Tag, AlertCircle, FileText, ZoomIn, Edit, UserCheck, ShieldAlert, Trash2, AlertTriangle, Loader2, ArrowRightLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";
import ServiceInput from "@/components/admin/ServiceInput";
import TransferServiceModal from "@/components/admin/TransferServiceModal";

const serviceStatusLabels: Record<string, string> = {
  pending: "Menunggu", assigned: "Ditugaskan", in_progress: "Dalam Pengerjaan",
  req_sparepart_admin: "Request PO", po_pending: "PO Pending",
  sparepart_ready: "Sparepart Ready", qc_pending: "Quality Check",
  revision_required: "Perlu Revisi", completed: "Selesai", cancelled: "Dibatalkan",
};

const movementLabels: Record<string, string> = {
  automatic: "Automatic", quartz: "Quartz", digital: "Digital",
  analog_digital: "Analog Digital", kinetic: "Kinetic", smartwatch: "Smartwatch", other: "Other",
};

const moveOptions = [
  { value: "", label: "Semua Tipe" },
  { value: "automatic", label: "Automatic" },
  { value: "quartz", label: "Quartz" },
  { value: "digital", label: "Digital" },
  { value: "analog_digital", label: "Analog Digital" },
  { value: "kinetic", label: "Kinetic" },
  { value: "smartwatch", label: "Smartwatch" },
];

const movementIcons: Record<string, any> = {
  automatic: Settings, quartz: Battery, digital: Settings,
  analog_digital: Watch, kinetic: Zap, smartwatch: Smartphone,
};

const statusOptions = [
  { value: "", label: "Semua Status" },
  { value: "pending", label: "Menunggu" },
  { value: "assigned", label: "Ditugaskan" },
  { value: "in_progress", label: "Dalam Pengerjaan" },
  { value: "qc_pending", label: "Quality Check" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

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
}

const statusFilterOptions = [
  { value: "", label: "Semua Status" },
  { value: "pending", label: "Menunggu" },
  { value: "assigned", label: "Ditugaskan" },
  { value: "in_progress", label: "Dalam Pengerjaan" },
  { value: "qc_pending", label: "QC Pending" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

export default function ServiceList({ onAdd, readOnly = false, branchId: branchIdProp }: { onAdd?: () => void; readOnly?: boolean; branchId?: string | null }) {
  const supabase = createClient();
  const { user } = useAuthStore();
  const scopeBranchId = useBranchScope().branchId;
  const branchId = branchIdProp ?? scopeBranchId;
  const { branches } = useBranch();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [movementFilter, setMovementFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [teknisiOptions, setTeknisiOptions] = useState<{ id: string; name: string }[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [teknisiFilter, setTeknisiFilter] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [servicePhotos, setServicePhotos] = useState<string[]>([]);
  const [servicePhotoLabels, setServicePhotoLabels] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [deletingService, setDeletingService] = useState<any>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [transferService, setTransferService] = useState<any>(null);

  async function handleDeleteService() {
    if (!deletingService) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_order_id: deletingService.id }),
      });
      const data = await res.json().catch(() => ({}) as any);
      if (!res.ok) throw new Error(data.error || "Gagal menghapus service");
      toast.success(`Service ${data.deleted?.invoice_number || deletingService.invoice_number} dihapus permanen`);
      setDeletingService(null);
      setDeleteConfirmText("");
      fetchServices();
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus service");
    } finally {
      setDeleting(false);
    }
  }

  const magicTrackingUrl = () => {
    if (!selectedService) return "";
    return buildServiceTrackingUrl(selectedService.invoice_number, selectedService.access_code);
  };

  useEffect(() => {
    if (user?.id) {
      supabase.from("profiles").select("role, full_name").eq("id", user.id).single().then(({ data }) => {
        if (data) setCurrentUserProfile(data);
      });
    }
  }, [user?.id]);

  const canEditService = (svc: any) => {
    if (!user) return false;
    if (svc.created_by && svc.created_by === user.id) return true;
    if (svc.created_by_role && currentUserProfile?.role && svc.created_by_role === currentUserProfile.role) return true;
    if (!svc.created_by && !svc.created_by_role) return true;
    return false;
  };

  const fetchServices = async () => {
    setLoading(true);
    let q = supabase.from("service_orders").select("*, profiles:assigned_teknisi_id(full_name)").neq("status", "done").order(sortField, { ascending: sortDir === "asc" });
    if (branchFilter) q = q.eq("branch_id", branchFilter);
    else if (branchId) q = q.eq("branch_id", branchId);
    if (statusFilter) q = q.eq("status", statusFilter);
    if (movementFilter) q = q.eq("watch_movement", movementFilter);
    if (categoryFilter) q = q.eq("category", categoryFilter);
    if (brandFilter) q = q.eq("watch_brand", brandFilter);
    if (teknisiFilter) q = q.eq("assigned_teknisi_id", teknisiFilter);
    if (dateStart) q = q.gte("created_at", dateStart + "T00:00:00");
    if (dateEnd) q = q.lte("created_at", dateEnd + "T23:59:59.999");
    if (search.trim()) {
      const s = search.trim();
      q = q.or(`customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,invoice_number.ilike.%${s}%`);
    }
    const { data } = await q.limit(100);
    if (data && data.length > 0) {
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
      for (const s of data) {
        const tl = transferMap[s.id];
        s._transferInfo = tl?.details?.from_branch_name
          ? `Transfer dari ${tl.details.from_branch_name}`
          : tl ? "Transfer dari cabang lain" : null;
      }
    }
    if (data) setServices(data);
    setLoading(false);
  };

  const extractCategories = async () => {
    const { data } = await supabase.from("service_orders").select("category").not("category", "is", null);
    if (data) {
      const cats = [...new Set(data.map((r: any) => r.category).filter(Boolean))] as string[];
      setCategories(cats.sort());
    }
  };

  const extractBrands = async () => {
    const { data } = await supabase.from("service_orders").select("watch_brand").not("watch_brand", "is", null);
    if (data) {
      const bs = [...new Set(data.map((r: any) => r.watch_brand).filter(Boolean))] as string[];
      setBrands(bs.sort());
    }
  };

  const extractTeknisi = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").eq("role", "teknisi").order("full_name");
    if (data) {
      setTeknisiOptions((data as { id: string; full_name: string }[]).map((t) => ({ id: t.id, name: t.full_name || "-" })));
    }
  };

  useEffect(() => { fetchServices(); }, [movementFilter, categoryFilter, statusFilter, branchFilter, branchId, brandFilter, teknisiFilter, dateStart, dateEnd, sortField, sortDir]);
  useEffect(() => { extractCategories(); extractBrands(); extractTeknisi(); }, []);

  // Auto-refresh ketika service baru ditambahkan (Add Service)
  useEffect(() => {
    const handler = () => {
      fetchServices();
      // Detail sedang terbuka → refetch foto juga (upload background selesai belakangan)
      if (showModal && selectedService) openDetail(selectedService);
    };
    window.addEventListener("new-service", handler);
    return () => window.removeEventListener("new-service", handler);
  }, [movementFilter, categoryFilter, statusFilter, branchFilter, branchId, brandFilter, teknisiFilter, dateStart, dateEnd, sortField, sortDir, showModal, selectedService]);

  useEffect(() => {
    const timer = setTimeout(() => fetchServices(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const openDetail = async (svc: any) => {
    setSelectedService(svc);
    setShowModal(true);
    setLoadingPhotos(true);
    const { data } = await supabase
      .from("service_documentation")
      .select("photo_url, label")
      .eq("service_order_id", svc.id)
      .order("created_at", { ascending: true });
    const withUrl = (data || []).filter((d: any) => !!d.photo_url);
    setServicePhotos(withUrl.map((d: any) => d.photo_url));
    setServicePhotoLabels(withUrl.map((d: any) => d.label || ""));
    setLoadingPhotos(false);
  };

  const copyToken = () => {
    if (!selectedService?.token) return;
    navigator.clipboard.writeText(selectedService.token);
    setCopiedToken(true);
    toast.success("Token disalin!");
    setTimeout(() => setCopiedToken(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">Daftar Service</h1>
          <p className="text-sm text-slate-500 mt-0.5">Kelola semua service order</p>
        </div>
        {!readOnly && (
          <button onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all text-sm shadow-lg shadow-slate-200">
            <Plus className="w-4 h-4" /> Tambah Service
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / WA / invoice..." className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all" />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="w-3.5 h-3.5 text-slate-400" /></button>}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all">
            {statusFilterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={movementFilter} onChange={(e) => setMovementFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all">
            {moveOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all">
            <option value="">Semua Kategori</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all">
            <option value="">Semua Brand</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select value={teknisiFilter} onChange={(e) => setTeknisiFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all">
            <option value="">Semua Teknisi</option>
            {teknisiOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all">
            <option value="">Semua Cabang</option>
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all" />
          <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-900 select-none" onClick={() => toggleSort("invoice_number")}>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Invoice <SortIcon field="invoice_number" /></div>
                </th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-900 select-none" onClick={() => toggleSort("customer_name")}>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Customer <SortIcon field="customer_name" /></div>
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Brand / Model</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tipe</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Dibuat Oleh</th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-900 select-none" onClick={() => toggleSort("created_at")}>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tanggal <SortIcon field="created_at" /></div>
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Memuat data...</td></tr>
              ) : services.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12">
                  <div className="text-slate-300"><Watch className="w-10 h-10 mx-auto mb-2 opacity-40" /></div>
                  <p className="text-slate-400">Belum ada service order</p>
                  {!readOnly && <button onClick={onAdd} className="mt-3 text-sm text-blue-600 hover:underline font-medium">Tambah service baru</button>}
                </td></tr>
              ) : services.map((svc, i) => {
                const MoveIcon = movementIcons[svc.watch_movement] || Watch;
                const allowed = canEditService(svc);
                return (
                  <motion.tr key={svc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openDetail(svc)}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-900">{svc.invoice_number}</span>
                      {(svc as any)._transferInfo && (
                        <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                          🔄 {(svc as any)._transferInfo}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 text-sm">{svc.customer_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{svc.customer_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-800">{(svc.watch_brand || svc.device_brand || "") + " " + (svc.watch_model || svc.device_model || "")}</div>
                      {svc.serial_number && <div className="text-[10px] text-slate-400 font-mono">SN: {svc.serial_number}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {svc.watch_movement ? (
                        <div className="flex items-center gap-1.5">
                          <MoveIcon className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs text-slate-700">{movementLabels[svc.watch_movement] || svc.watch_movement}</span>
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {svc.category ? <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-200">{svc.category}</span> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusColor(svc.status)}`}>{serviceStatusLabels[svc.status] || svc.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {svc.created_by_name || svc.created_by_role ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900">{svc.created_by_name || "User"}</span>
                          <span className="text-[10px] text-indigo-600 font-semibold uppercase">{svc.created_by_role || "Role N/A"}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(svc.created_at)}</td>
                    <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                      {readOnly ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              if (allowed) {
                                setEditingService(svc);
                              } else {
                                toast.error(`Hanya ${svc.created_by_role ? `role ${svc.created_by_role.toUpperCase()}` : "pembuat service"} yang berhak mengedit service ini!`);
                              }
                            }}
                            title={allowed ? "Edit Service Order" : `Hanya ${svc.created_by_role || 'pembuat'} yang berhak edit`}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                              allowed
                                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                            }`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          {(currentUserProfile?.role === "admin" || currentUserProfile?.role === "engineer") ? (
                            <button
                              onClick={() => {
                                setDeletingService(svc);
                                setDeleteConfirmText("");
                              }}
                              title="Hapus Service Permanen"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border bg-red-50 text-red-600 border-red-200 hover:bg-red-100 transition-all"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus
                            </button>
                          ) : (
                            <button
                              disabled
                              title="Hanya role ADMIN atau ENGINEER yang berhak menghapus service"
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed opacity-60"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && services.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">Menampilkan {services.length} service</div>
        )}
      </div>

      <div className="flex justify-center">
        <button onClick={fetchServices} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors font-medium">
          <RotateCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Service Detail Modal */}
      {showModal && selectedService && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => { setShowModal(false); setServicePhotos([]); setServicePhotoLabels([]); }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-white z-20 flex items-center justify-between px-5 py-4 border-b border-slate-200 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
                  <Watch className="w-4 h-4 text-white" />
                </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Detail Service</h2>
                <p className="text-[11px] text-slate-500">{selectedService.invoice_number}</p>
                {(selectedService as any)._transferInfo && (
                  <span className="mt-1 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                    🔄 {(selectedService as any)._transferInfo}
                  </span>
                )}
              </div>
              </div>
              <button onClick={() => { setShowModal(false); setServicePhotos([]); setServicePhotoLabels([]); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* QR + Token */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
                  <QRCodeSVG value={typeof window !== "undefined" ? magicTrackingUrl() : ""} size={72} level="H" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Token Tracking</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <code className="text-sm font-mono font-bold text-slate-900 truncate">{selectedService.token}</code>
                    <button onClick={copyToken} className="p-1 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0">
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </div>
                  <a href={typeof window !== "undefined" ? magicTrackingUrl() : "#"} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-1">
                    Buka Tracking Page →
                  </a>
                </div>
              </div>

              {/* Send to WhatsApp */}
              <button onClick={() => {
                const phone = selectedService.customer_phone?.replace(/\D/g, "");
                const p = phone?.startsWith("0") ? "62" + phone.substring(1) : phone;
                const trackingUrl = magicTrackingUrl();
                const qrImgUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(trackingUrl)}`;
                const msg = encodeURIComponent(
                  `Halo ${selectedService.customer_name},\n\n` +
                  `Berikut adalah informasi tracking untuk service anda:\n\n` +
                  `📋 Invoice: ${selectedService.invoice_number}\n` +
                  `🔗 Link Tracking: ${trackingUrl}\n` +
                  `🔑 Token: ${selectedService.token}\n` +
                  `📱 QR: ${qrImgUrl}\n\n` +
                  `Gunakan token atau scan QR code di atas untuk memantau status service anda.\n\n` +
                  `Terima kasih.\n- Arlogic Watch Service`
                );
                window.open(`https://wa.me/${p}?text=${msg}`, "_blank");
              }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-all text-sm">
                <Phone className="w-4 h-4" />
                Kirim ke WhatsApp
              </button>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <User className="w-4 h-4 text-blue-600" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500">Customer</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">{selectedService.customer_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <Phone className="w-4 h-4 text-blue-600" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-500">Phone</p>
                    <p className="text-sm font-semibold text-slate-900 font-mono truncate">{selectedService.customer_phone}</p>
                  </div>
                </div>
              </div>

              {/* Device Info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Device</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-slate-500">Brand:</span> <span className="font-medium text-slate-900">{selectedService.watch_brand || selectedService.device_brand || "-"}</span></div>
                  <div><span className="text-slate-500">Model:</span> <span className="font-medium text-slate-900">{selectedService.watch_model || selectedService.device_model || "-"}</span></div>
                  {selectedService.watch_movement && <div className="flex items-center gap-1"><span className="text-slate-500">Movement:</span> {React.createElement(movementIcons[selectedService.watch_movement] || Watch, { className: "w-3.5 h-3.5 text-slate-600" })}<span className="font-medium">{movementLabels[selectedService.watch_movement]}</span></div>}
                  {selectedService.category && <div><span className="text-slate-500">Kategori:</span> <span className="font-medium">{selectedService.category}</span></div>}
                </div>
              </div>

              {/* Photos */}
              {servicePhotos.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-2">Foto</p>
                  <div className="grid grid-cols-3 gap-2">
                    {servicePhotos.filter(Boolean).map((url, i) => (
                      <div key={i} className="space-y-1">
                        <img src={url} alt={"foto-" + i}
                          className="rounded-xl border border-slate-200 aspect-square object-cover cursor-pointer hover:opacity-80 transition-opacity w-full"
                          onClick={() => setPreviewPhoto(url)} />
                        {servicePhotoLabels[i] && (
                          <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wide truncate">{servicePhotoLabels[i]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issue */}
              <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Kendala</p>
                    <p className="text-sm text-slate-800">{selectedService.issue_description}</p>
                  </div>
                </div>
              </div>

              {/* Status & Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full border mt-0.5 ${getStatusColor(selectedService.status)}`}>{serviceStatusLabels[selectedService.status] || selectedService.status}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-500">Estimasi Biaya</p>
                  <p className="text-sm font-bold text-slate-900">{selectedService.estimated_cost ? fmtRupiah(selectedService.estimated_cost) : "-"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-500">Teknisi</p>
                  <p className="text-sm font-bold text-slate-900">{(selectedService.profiles as any)?.full_name || "-"}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-emerald-100">
                  <p className="text-[10px] text-slate-500">Down Payment</p>
                  <p className="text-sm font-bold text-emerald-600">{selectedService.down_payment ? fmtRupiah(selectedService.down_payment) : "-"}</p>
                </div>
                <div className="col-span-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">Dibuat Oleh</p>
                    <p className="text-sm font-bold text-indigo-950">
                      {selectedService.created_by_name ? `${selectedService.created_by_name} (${(selectedService.created_by_role || 'role N/A').toUpperCase()})` : (selectedService.created_by_role ? `Role: ${selectedService.created_by_role.toUpperCase()}` : "-")}
                    </p>
                  </div>
                  <UserCheck className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-500">Dibuat pada</p>
                  <p className="text-sm text-slate-700">{new Date(selectedService.created_at).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                {selectedService.status === "pending" && !selectedService.assigned_teknisi_id && (
                  <button
                    onClick={() => setTransferService(selectedService)}
                    className="col-span-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 font-medium rounded-xl hover:bg-blue-100 border border-blue-200 transition-all text-sm"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Transfer ke Cabang Lain
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Service Confirmation Modal */}
      {deletingService && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4" onClick={() => setDeletingService(null)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full shadow-2xl border border-red-200 dark:border-red-900/50" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hapus Service Permanen</h3>
                <p className="text-[11px] text-slate-500">Tindakan ini tidak bisa dibatalkan</p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                <p className="text-sm font-bold text-slate-900">{deletingService.customer_name}</p>
                <p className="text-xs font-mono text-slate-500 mt-0.5">{deletingService.invoice_number}</p>
                <span className={`inline-flex mt-2 px-2 py-0.5 text-[10px] font-bold rounded-full border ${serviceStatusLabels[deletingService.status] ? "" : ""} ${deletingService.status === "cancelled" ? "bg-red-100 text-red-700 border-red-200" : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                  {serviceStatusLabels[deletingService.status] || deletingService.status}
                </span>
              </div>

              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4">
                <li>Timeline, foto dokumentasi, rincian item, garansi &amp; feedback <b>dihapus permanen</b></li>
                <li>Transaksi DP yang ter-link otomatis <b>lepas</b> dan bisa dipilih kembali di Add Service</li>
                <li>Data tidak dapat dikembalikan</li>
              </ul>

              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1.5">
                  Ketik <span className="font-mono font-bold text-red-600">{deletingService.invoice_number}</span> untuk konfirmasi:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deletingService.invoice_number}
                  autoFocus
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/10 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && deleteConfirmText.trim().toUpperCase() === String(deletingService.invoice_number).toUpperCase()) {
                      handleDeleteService();
                    }
                  }}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setDeletingService(null); setDeleteConfirmText(""); }}
                  disabled={deleting}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteService}
                  disabled={deleting || deleteConfirmText.trim().toUpperCase() !== String(deletingService.invoice_number).toUpperCase()}
                  className="px-4 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 inline-flex items-center gap-2"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Hapus Permanen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Service Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[80] p-3 sm:p-4 overflow-y-auto" onClick={() => setEditingService(null)}>
          <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl p-4 sm:p-6 shadow-2xl border border-slate-200 dark:border-white/10" onClick={(e) => e.stopPropagation()}>
            <ServiceInput
              variant="modal"
              editData={editingService}
              onClose={() => setEditingService(null)}
              onSuccess={() => {
                setEditingService(null);
                fetchServices();
              }}
            />
          </div>
        </div>
      )}

      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={() => setPreviewPhoto(null)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="relative max-w-3xl w-full max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewPhoto(null)}
              className="absolute -top-3 -right-3 z-10 p-1.5 bg-gray-900 text-white rounded-full hover:bg-gray-700 transition-colors shadow-lg">
              <X className="w-4 h-4" />
            </button>
            <img src={previewPhoto} alt="Preview"
              className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain bg-black/40" />
          </motion.div>
        </div>
      )}

      {transferService && (
        <TransferServiceModal
          service={transferService}
          onClose={() => setTransferService(null)}
          onSuccess={() => {
            setTransferService(null);
            fetchServices();
          }}
        />
      )}
    </div>
  );
}
