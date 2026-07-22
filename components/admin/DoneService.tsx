"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { CheckCircle, Phone, User, Watch, Hash, Package, Wallet, Clock, ExternalLink, Search, CheckCheck, History } from "lucide-react";
import toast from "react-hot-toast";

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function DoneService() {
  const supabase = createClient();
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [pendingServices, setPendingServices] = useState<any[]>([]);
  const [historyServices, setHistoryServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

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

    // Fix 2.2: Get total and discount from svc.final_cost and svc.discount
    const finalTotal = svc.final_cost || 0;
    const discount = svc.discount || 0;

    // Fix 2.1: Fetch DP from layanan table
    const { data: dpData } = await supabase.from("layanan").select("nominal")
      .eq("detail_sku", `DP - Invoice ${svc.invoice_number}`).maybeSingle();
    const dp = dpData?.nominal || 0;

    const kekurangan = finalTotal - dp;

    const messageLines: string[] = [];
    messageLines.push(`Assalamu'alaikum..`);
    messageLines.push(`Selamat malam kak ${svc.customer_name}, saya Siqi dari Arlogic ex. Juragan7am mau menginformasikan kalau jam tangannya sudah lolos Quality Control dan sudah bisa diambil. Untuk rician biaya kekurangan nya sebagai berikut`);
    messageLines.push(`- RICIAN SERVICE`);

    if (spareparts.length > 0) {
      messageLines.push(`- sparepart : ${spareparts.map((i: any) => i.name).join(", ")}`);
    }
    if (jasa.length > 0) {
      messageLines.push(`- jasa : ${jasa.map((i: any) => i.name).join(", ")}`);
    }
    if (dp > 0) {
      messageLines.push(`- dp : ${fmtRupiah(dp)}`);
    }
    if (finalTotal > 0) {
      messageLines.push(`- total : ${fmtRupiah(finalTotal)}`);
    }
    if (discount > 0) {
      messageLines.push(`- discount : ${fmtRupiah(discount)}`);
    }
    if (kekurangan > 0) {
      messageLines.push(`- kekurangan : ${fmtRupiah(kekurangan)}`);
    }
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
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
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
          <div className="flex items-center gap-2">
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
    </div>
  );
}
