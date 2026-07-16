"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { Search, Clock, ChevronDown, ChevronUp, Watch, Smartphone, Settings, Battery, X, Plus, RotateCw, Copy, Check, User, Phone, Hash, Tag, AlertCircle, FileText, ZoomIn } from "lucide-react";
import toast from "react-hot-toast";

const serviceStatusLabels: Record<string, string> = {
  pending: "Menunggu", assigned: "Ditugaskan", in_progress: "Dalam Pengerjaan",
  req_sparepart_admin: "Request PO", po_pending: "PO Pending",
  sparepart_ready: "Sparepart Ready", qc_pending: "Quality Check",
  revision_required: "Perlu Revisi", completed: "Selesai", cancelled: "Dibatalkan",
};

const movementLabels: Record<string, string> = {
  automatic: "Automatic", quartz: "Quartz", digital: "Digital",
  analog_digital: "Analog Digital", smartwatch: "Smartwatch", other: "Other",
};

const moveOptions = [
  { value: "", label: "Semua Tipe" },
  { value: "automatic", label: "Automatic" },
  { value: "quartz", label: "Quartz" },
  { value: "digital", label: "Digital" },
  { value: "analog_digital", label: "Analog Digital" },
  { value: "smartwatch", label: "Smartwatch" },
];

const movementIcons: Record<string, any> = {
  automatic: Settings, quartz: Battery, digital: Settings,
  analog_digital: Watch, smartwatch: Smartphone,
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function getStatusColor(status: string) {
  const map: Record<string, string> = {
    pending: "bg-slate-100 text-slate-700 border-slate-200",
    assigned: "bg-blue-100 text-blue-700 border-blue-200",
    in_progress: "bg-purple-100 text-purple-700 border-purple-200",
    req_sparepart_admin: "bg-orange-100 text-orange-700 border-orange-200",
    po_pending: "bg-amber-100 text-amber-700 border-amber-200",
    sparepart_ready: "bg-teal-100 text-teal-700 border-teal-200",
    qc_pending: "bg-indigo-100 text-indigo-700 border-indigo-200",
    revision_required: "bg-rose-100 text-rose-700 border-rose-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    cancelled: "bg-red-100 text-red-700 border-red-200",
  };
  return map[status] || map.pending;
}

export default function ServiceList({ onAdd }: { onAdd?: () => void }) {
  const supabase = createClient();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [movementFilter, setMovementFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [servicePhotos, setServicePhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchServices = async () => {
    setLoading(true);
    let q = supabase.from("service_orders").select("*").neq("status", "done").order(sortField, { ascending: sortDir === "asc" });
    if (movementFilter) q = q.eq("watch_movement", movementFilter);
    if (categoryFilter) q = q.eq("category", categoryFilter);
    if (search.trim()) {
      const s = search.trim();
      q = q.or(`customer_name.ilike.%${s}%,customer_phone.ilike.%${s}%,invoice_number.ilike.%${s}%`);
    }
    const { data } = await q.limit(100);
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

  useEffect(() => { fetchServices(); }, [movementFilter, categoryFilter, sortField, sortDir]);
  useEffect(() => { extractCategories(); }, []);

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
      .select("photo_url")
      .eq("service_order_id", svc.id)
      .order("created_at", { ascending: true });
    setServicePhotos((data || []).map((d: any) => d.photo_url));
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
        <button onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-all text-sm shadow-lg shadow-slate-200">
          <Plus className="w-4 h-4" /> Tambah Service
        </button>
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
          <select value={movementFilter} onChange={(e) => setMovementFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all">
            {moveOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition-all">
            <option value="">Semua Kategori</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
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
                <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-900 select-none" onClick={() => toggleSort("created_at")}>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tanggal <SortIcon field="created_at" /></div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">Memuat data...</td></tr>
              ) : services.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12">
                  <div className="text-slate-300"><Watch className="w-10 h-10 mx-auto mb-2 opacity-40" /></div>
                  <p className="text-slate-400">Belum ada service order</p>
                  <button onClick={onAdd} className="mt-3 text-sm text-blue-600 hover:underline font-medium">Tambah service baru</button>
                </td></tr>
              ) : services.map((svc, i) => {
                const MoveIcon = movementIcons[svc.watch_movement] || Watch;
                return (
                  <motion.tr key={svc.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                    className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => openDetail(svc)}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-slate-900">{svc.invoice_number}</span>
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
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(svc.created_at)}</td>
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => { setShowModal(false); setServicePhotos([]); }}>
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
                </div>
              </div>
              <button onClick={() => { setShowModal(false); setServicePhotos([]); }} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* QR + Token */}
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex-shrink-0">
                  <QRCodeSVG value={typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) + "/tracking/" + selectedService.token : ""} size={72} level="H" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Token Tracking</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <code className="text-sm font-mono font-bold text-slate-900 truncate">{selectedService.token}</code>
                    <button onClick={copyToken} className="p-1 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0">
                      {copiedToken ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    </button>
                  </div>
                  <a href={typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) + "/tracking/" + selectedService.token : "#"} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 hover:underline mt-0.5 inline-flex items-center gap-1">
                    Buka Tracking Page →
                  </a>
                </div>
              </div>

              {/* Send to WhatsApp */}
              <button onClick={() => {
                const phone = selectedService.customer_phone?.replace(/\D/g, "");
                const p = phone?.startsWith("0") ? "62" + phone.substring(1) : phone;
                const appUrl = (typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) : "");
                const trackingUrl = appUrl + "/tracking/" + selectedService.token;
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
                    {servicePhotos.map((url, i) => (
                      <img key={i} src={url} alt={"foto-" + i}
                        className="rounded-xl border border-slate-200 aspect-square object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewPhoto(url)} />
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
                <div className="p-3 bg-slate-50 rounded-xl border border-emerald-100">
                  <p className="text-[10px] text-slate-500">Down Payment</p>
                  <p className="text-sm font-bold text-emerald-600">{selectedService.down_payment ? fmtRupiah(selectedService.down_payment) : "-"}</p>
                </div>
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-[10px] text-slate-500">Dibuat pada</p>
                  <p className="text-sm text-slate-700">{new Date(selectedService.created_at).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            </div>
          </motion.div>
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
    </div>
  );
}
