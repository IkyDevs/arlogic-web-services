"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { CheckCircle, Phone, User, Watch, Hash, Package, Wallet, Clock, ExternalLink, Search, CheckCheck, History, X, Camera, ChevronDown, ChevronRight, Image as ImageIcon, DollarSign, Wrench, Shield, Calendar, FileText, Award, ZoomIn, Download } from "lucide-react";
import toast from "react-hot-toast";

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const statusBadge: Record<string, { label: string; color: string }> = {
  pending: { label: "Menunggu", color: "bg-yellow-100 text-yellow-700" },
  assigned: { label: "Ditugaskan", color: "bg-blue-100 text-blue-700" },
  in_progress: { label: "Dikerjakan", color: "bg-purple-100 text-purple-700" },
  qc_pending: { label: "QC", color: "bg-orange-100 text-orange-700" },
  completed: { label: "Selesai", color: "bg-green-100 text-green-700" },
  cancelled: { label: "Batal", color: "bg-red-100 text-red-700" },
};

export default function DoneService() {
  const supabase = createClient();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [pendingServices, setPendingServices] = useState<any[]>([]);
  const [historyServices, setHistoryServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedService, setSelectedService] = useState<any>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({ info: true, items: true, timeline: true, photos: true });
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const [pendingRes, historyRes] = await Promise.all([
      supabase.from("service_orders").select("*, items:service_items(*)").eq("status", "completed").order("done_date", { ascending: false }).limit(100),
      supabase.from("service_orders").select("*, items:service_items(*)").eq("status", "done").order("done_date", { ascending: false }).limit(50),
    ]);
    if (pendingRes.data) setPendingServices(pendingRes.data);
    if (historyRes.data) setHistoryServices(historyRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openDetail = async (svc: any) => {
    setSelectedService(svc);
    setDetailData(null);
    setDetailLoading(true);
    const [timelineRes, docsRes, profileRes, itemsRes, dpRes] = await Promise.all([
      supabase.from("service_timeline").select("*").eq("service_order_id", svc.id).order("created_at", { ascending: true }),
      supabase.from("service_documentation").select("*").eq("service_order_id", svc.id).order("created_at", { ascending: true }),
      svc.assigned_teknisi_id ? supabase.from("profiles").select("full_name, role").eq("id", svc.assigned_teknisi_id).single() : Promise.resolve(null),
      supabase.from("service_items").select("*").eq("service_order_id", svc.id),
      supabase.from("layanan").select("nominal").eq("detail_sku", `DP - Invoice ${svc.invoice_number}`).maybeSingle(),
    ]);
    const dpFromLayanan = dpRes?.data?.nominal || 0;
    const dpFinal = dpFromLayanan > 0 ? dpFromLayanan : (Number(svc?.down_payment) || 0);
    console.log("📦 DoneService items:", { fromDb: itemsRes.data?.length, fromSvc: svc.items?.length, svcItems: svc.items, dbItems: itemsRes.data });
    const finalItems = (itemsRes.data && itemsRes.data.length > 0) ? itemsRes.data : (svc.items || []);
    setDetailData({
      timeline: timelineRes.data || [],
      docs: docsRes.data || [],
      teknisi: profileRes?.data || null,
      items: finalItems,
      dpNominal: dpFinal,
    });
    setDetailLoading(false);
  };

  const toggleSection = (s: keyof typeof expandedSections) => setExpandedSections((p) => ({ ...p, [s]: !p[s] }));

  // ── Detail Modal ──
  const DetailModal = () => {
    if (!selectedService || !detailData) return null;
    const svc = selectedService;
    const { timeline, docs, teknisi, items, dpNominal } = detailData;
    const dpValue = dpNominal || Number(svc?.down_payment) || 0;
    const subtotal = items.reduce((s: number, i: any) => s + (Number(i.price) || 0) * (i.quantity || 1), 0);
    // final_cost sudah termasuk diskon & DP dari QCReviewModal
    const remaining = svc.final_cost
      ? Math.max(0, svc.final_cost - dpValue)
      : Math.max(0, (subtotal || svc.estimated_cost || 0) - dpValue - (svc.discount || 0));

    const beforePhotos = docs.filter((d: any) => d.stage === "initial_condition");
    const duringPhotos = docs.filter((d: any) => d.stage && d.stage !== "initial_condition" && d.stage !== "final_condition");
    const afterPhotos = docs.filter((d: any) => d.stage === "final_condition");

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4" onClick={() => setSelectedService(null)}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200"
          onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Detail Service</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-mono text-slate-400">{svc.invoice_number}</span>
                  <span className="text-[10px] text-slate-300">•</span>
                  <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${statusBadge[svc.status]?.color || "bg-slate-100 text-slate-700"}`}>{statusBadge[svc.status]?.label || svc.status}</span>
                </div>
              </div>
            </div>
            <button onClick={() => setSelectedService(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {detailLoading ? (
            <div className="p-12 text-center">
              <div className="inline-block w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="mt-3 text-slate-400">Memuat detail...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Customer & Watch */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center"><User className="w-3.5 h-3.5 text-white" /></div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</h4>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{svc.customer_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{svc.customer_phone}</p>
                  <p className="text-xs text-slate-400 mt-1">{fmtDate(svc.created_at)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-slate-700 rounded-lg flex items-center justify-center"><Watch className="w-3.5 h-3.5 text-white" /></div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jam Tangan</h4>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{svc.watch_brand || svc.device_brand || "-"}{svc.watch_model ? ` ${svc.watch_model}` : ""}</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {svc.watch_movement && <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600">{svc.watch_movement}</span>}
                    {svc.watch_condition && <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600">{svc.watch_condition}</span>}
                    {svc.serial_number && <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600">{svc.serial_number}</span>}
                  </div>
                </div>
              </div>

              {/* Teknisi */}
              {teknisi && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center"><Wrench className="w-3.5 h-3.5 text-white" /></div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Teknisi</h4>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center"><User className="w-5 h-5 text-purple-600" /></div>
                    <div>
                      <p className="font-semibold text-slate-900">{teknisi.full_name}</p>
                      <p className="text-xs text-slate-500">{teknisi.role}</p>
                    </div>
                    {svc.start_date && (
                      <div className="ml-auto text-right">
                        <p className="text-xs text-slate-400">Mulai</p>
                        <p className="text-sm font-medium text-slate-900">{fmtDate(svc.start_date)}</p>
                      </div>
                    )}
                    {svc.done_date && (
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Selesai</p>
                        <p className="text-sm font-medium text-slate-900">{fmtDate(svc.done_date)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Service Details */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center"><FileText className="w-3.5 h-3.5 text-white" /></div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Service Details</h4>
                </div>
                <div className="space-y-2">
                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Issue</p>
                    <p className="text-sm text-slate-800">{svc.issue_description}</p>
                  </div>
                  {svc.request && <div className="bg-white rounded-lg p-3 border border-slate-200"><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Request</p><p className="text-sm text-slate-800">{svc.request}</p></div>}
                  {svc.notes && <div className="bg-white rounded-lg p-3 border border-slate-200"><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Catatan</p><p className="text-sm text-slate-800">{svc.notes}</p></div>}
                  {svc.completion_notes && <div className="bg-white rounded-lg p-3 border border-slate-200"><p className="text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Completion Notes</p><p className="text-sm text-slate-800">{svc.completion_notes}</p></div>}
                  {svc.qc_submit_notes && (
                    <div className="bg-white rounded-lg p-3 border border-l-4 border-l-amber-400 border-slate-200">
                      <p className="text-[10px] text-amber-600 uppercase tracking-wider mb-0.5 font-semibold">Catatan Teknisi</p>
                      <p className="text-sm text-slate-800">{svc.qc_submit_notes}</p>
                    </div>
                  )}
                  {(svc.warranty_months || svc.warranty_expiry) && (
                    <div className="flex items-center gap-3 text-xs text-slate-500 pt-1">
                      <Award className="w-3.5 h-3.5" />
                      {svc.warranty_months && <span>Garansi {svc.warranty_months} bulan</span>}
                      {svc.warranty_expiry && <span>Exp: {fmtDate(svc.warranty_expiry)}</span>}
                    </div>
                  )}
                </div>
              </div>

              {/* Items & Payment */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <button onClick={() => toggleSection("items")} className="w-full flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center"><Package className="w-3.5 h-3.5 text-white" /></div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Items & Pembayaran</h4>
                  </div>
                  {expandedSections.items ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedSections.items && (
                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">Tidak ada item</p>
                    ) : items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-white rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md ${item.item_type === "jasa" ? "bg-pink-100 text-pink-700" : "bg-purple-100 text-purple-700"}`}>
                            {item.item_type === "jasa" ? "JASA" : "SPR"}
                          </span>
                          <span className="text-sm font-medium text-slate-900">{item.name}</span>
                          <span className="text-xs text-slate-400">{item.quantity}x</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-900">{fmtRupiah((Number(item.price) || 0) * (item.quantity || 1))}</span>
                      </div>
                    ))}
                    <div className="space-y-1 p-3 bg-white rounded-lg border border-slate-200">
                      <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-semibold">{fmtRupiah(subtotal)}</span></div>
                      {dpValue > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">DP</span><span className="font-semibold text-emerald-600">-{fmtRupiah(dpValue)}</span></div>}
                      {svc.discount > 0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Diskon</span><span className="font-semibold text-red-500">-{fmtRupiah(svc.discount)}</span></div>}
                      <div className="h-px bg-slate-200" />
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-slate-700">Sisa yang harus dibayar</span>
                        <span className="text-lg font-bold text-emerald-600">{remaining === 0 ? "LUNAS" : fmtRupiah(remaining)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <button onClick={() => toggleSection("timeline")} className="w-full flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-slate-600 rounded-lg flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-white" /></div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Aktivitas ({timeline.length})</h4>
                  </div>
                  {expandedSections.timeline ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                </button>
                {expandedSections.timeline && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {timeline.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3">Tidak ada aktivitas</p>
                    ) : timeline.map((ev: any, i: number) => (
                      <div key={ev.id} className="flex items-start gap-3 p-2.5 bg-white rounded-lg border border-slate-200">
                        <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] text-slate-400 font-mono">{fmtDate(ev.created_at)}</span>
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded-full ${statusBadge[ev.status]?.color || "bg-slate-100 text-slate-700"}`}>{statusBadge[ev.status]?.label || ev.status}</span>
                          </div>
                          <p className="text-sm text-slate-700">{ev.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Photos */}
              {docs.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <button onClick={() => toggleSection("photos")} className="w-full flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-rose-600 rounded-lg flex items-center justify-center"><Camera className="w-3.5 h-3.5 text-white" /></div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dokumentasi ({docs.length})</h4>
                    </div>
                    {expandedSections.photos ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>
                  {expandedSections.photos && (
                    <div className="space-y-3">
                      {beforePhotos.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-medium">Sebelum ({beforePhotos.length})</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {beforePhotos.map((p: any) => (
                              <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer" onClick={() => setPreviewPhoto(p.photo_url)}>
                                <img src={p.photo_url} alt="Before" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {duringPhotos.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-medium">Proses ({duringPhotos.length})</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {duringPhotos.map((p: any) => (
                              <div key={`${p.id}`} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer" onClick={() => setPreviewPhoto(p.photo_url)}>
                                <img src={p.photo_url} alt="During" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {afterPhotos.length > 0 && (
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5 font-medium">Sesudah ({afterPhotos.length})</p>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {afterPhotos.map((p: any) => (
                              <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-white cursor-pointer" onClick={() => setPreviewPhoto(p.photo_url)}>
                                <img src={p.photo_url} alt="After" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Photo Preview */}
        {previewPhoto && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[80] p-4" onClick={() => setPreviewPhoto(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setPreviewPhoto(null)} className="absolute -top-10 right-0 text-white/70 hover:text-white flex items-center gap-2">
                <Download className="w-4 h-4" onClick={() => window.open(previewPhoto, "_blank")} />
                <X className="w-5 h-5" />
              </button>
              <img src={previewPhoto} alt="Preview" className="max-w-full max-h-[80vh] rounded-xl shadow-2xl" />
            </motion.div>
          </div>
        )}
      </div>
    );
  };

  const markDone = async (id: string) => {
    const { error } = await supabase.from("service_orders").update({ status: "done" }).eq("id", id);
    if (error) { toast.error("Gagal update status: " + error.message); return; }
    toast.success("Service dipindahkan ke riwayat");
    fetchData();
  };

  const contactWA = async (svc: any) => {
    let p = svc.customer_phone.replace(/\D/g, "");
    if (p.startsWith("0")) p = "62" + p.substring(1);
    
    const items = svc.items || [];
    const spareparts = items.filter((i: any) => i.item_type === "sparepart");
    const jasa = items.filter((i: any) => i.item_type === "jasa");
    const finalTotal = svc.final_cost || 0;
    const discount = svc.discount || 0;
    const { data: dpData } = await supabase.from("layanan").select("nominal")
      .eq("detail_sku", `DP - Invoice ${svc.invoice_number}`).maybeSingle();
    const dp = dpData?.nominal || 0;
    const kekurangan = finalTotal - dp;

    const messageLines: string[] = [];
    messageLines.push(`Assalamu'alaikum..`);
    messageLines.push(`Selamat malam kak ${svc.customer_name}, saya Siqi dari Arlogic ex. Juragan7am mau menginformasikan kalau jam tangannya sudah lolos Quality Control dan sudah bisa diambil. Untuk rician biaya kekurangan nya sebagai berikut`);
    messageLines.push(`- RICIAN SERVICE`);
    if (spareparts.length > 0) messageLines.push(`- sparepart : ${spareparts.map((i: any) => i.name).join(", ")}`);
    if (jasa.length > 0) messageLines.push(`- jasa : ${jasa.map((i: any) => i.name).join(", ")}`);
    if (dp > 0) messageLines.push(`- dp : ${fmtRupiah(dp)}`);
    if (finalTotal > 0) messageLines.push(`- total : ${fmtRupiah(finalTotal)}`);
    if (discount > 0) messageLines.push(`- discount : ${fmtRupiah(discount)}`);
    if (kekurangan > 0) messageLines.push(`- kekurangan : ${fmtRupiah(kekurangan)}`);
    messageLines.push(`😊`);
    const msg = encodeURIComponent(messageLines.join("\n"));
    window.open(`https://wa.me/${p}?text=${msg}`, "_blank");
  };

  const currentData = tab === "pending" ? pendingServices : historyServices;
  const filtered = search.trim()
    ? currentData.filter((s) =>
        s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
        s.customer_phone?.includes(search)
      )
    : currentData;

  const renderCard = (svc: any, i: number, showDone: boolean) => {
    const items = svc.items || [];
    const totalCost = svc.final_cost || (items.length > 0
      ? items.reduce((s: number, it: any) => s + (parseFloat(it.price) || 0) * (it.quantity || 1), 0)
      : svc.estimated_cost || 0);
    return (
      <motion.div key={svc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-slate-300 transition-all"
        onClick={() => openDetail(svc)}>
        <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 bg-gray-900 text-white text-xs font-mono rounded-md">{svc.invoice_number}</span>
              {tab === "pending" ? (
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-medium rounded-full border border-emerald-200">COMPLETED</span>
              ) : (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full border border-slate-200">SUDAH DIAMBIL</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <span className="flex items-center gap-1.5"><User className="w-4 h-4 text-slate-400" /><span className="font-medium text-slate-900">{svc.customer_name}</span></span>
              <span className="flex items-center gap-1.5"><Hash className="w-4 h-4 text-slate-400" /><span className="text-slate-600">{svc.customer_phone}</span></span>
              {svc.watch_brand && <span className="flex items-center gap-1.5"><Watch className="w-4 h-4 text-slate-400" /><span className="text-slate-600">{svc.watch_brand}</span></span>}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
              {svc.issue_description && <span className="line-clamp-1">{svc.issue_description}</span>}
              {items.length > 0 && (
                <span className="flex items-center gap-1"><Package className="w-3 h-3" />{items.length} item</span>
              )}
              <span className="font-semibold text-emerald-600">{fmtRupiah(totalCost)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
             <button onClick={() => contactWA(svc)}
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-all text-sm flex-shrink-0">
              <Phone className="w-4 h-4" />
              <span className="hidden sm:inline">Hubungi</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
            {showDone && (
              <button onClick={() => markDone(svc.id)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-700 transition-all text-sm flex-shrink-0">
                <CheckCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Selesai</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Done Service</h1>
            <p className="text-sm text-slate-500">Service selesai QC, siap pengambilan</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / invoice..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900" />
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm w-fit">
        <button onClick={() => setTab("pending")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === "pending" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
          <Clock className="w-4 h-4" />
          Belum Diambil
          {pendingServices.length > 0 && <span className="ml-1 text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{pendingServices.length}</span>}
        </button>
        <button onClick={() => setTab("history")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${tab === "history" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
          <History className="w-4 h-4" />
          Riwayat
          {historyServices.length > 0 && <span className="ml-1 text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{historyServices.length}</span>}
        </button>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">{tab === "pending" ? "Tidak ada service siap diambil" : "Belum ada riwayat"}</p>
          </div>
        ) : filtered.map((svc, i) => renderCard(svc, i, tab === "pending"))}
      </div>

      <DetailModal />
    </div>
  );
}
