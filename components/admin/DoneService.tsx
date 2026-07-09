"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { CheckCircle, Phone, User, Watch, Hash, Package, Wallet, Clock, ExternalLink, Search } from "lucide-react";

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function DoneService() {
  const supabase = createClient();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchDone = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_orders")
      .select("*, items:service_items(*)")
      .eq("status", "completed")
      .order("done_date", { ascending: false });

    if (data) setServices(data);
    setLoading(false);
  };

  useEffect(() => { fetchDone(); }, []);

  const contactWA = (phone: string, name: string, invoice: string, kekurangan: number) => {
    let p = phone.replace(/\D/g, "");
    if (p.startsWith("0")) p = "62" + p.substring(1);
    const msg = encodeURIComponent(
      `Halo ${name},\n\n` +
      `Kami informasikan bahwa service untuk invoice ${invoice} telah selesai dan siap diambil.\n\n` +
      `Total biaya service: Rp ${kekurangan.toLocaleString("id-ID")}\n\n` +
      `Silakan datang ke toko untuk pengambilan.\n` +
      `Terima kasih.\n- Arlogic Watch Service`
    );
    window.open(`https://wa.me/${p}?text=${msg}`, "_blank");
  };

  const filtered = search.trim()
    ? services.filter((s) =>
        s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
        s.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
        s.customer_phone?.includes(search)
      )
    : services;

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

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12 text-slate-400">Memuat...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium">Tidak ada service selesai</p>
          </div>
        ) : filtered.map((svc, i) => {
          const items = svc.items || [];
          const totalCost = items.length > 0
            ? items.reduce((s: number, it: any) => s + (parseFloat(it.price) || 0) * (it.quantity || 1), 0)
            : svc.final_cost || svc.estimated_cost || 0;
          return (
            <motion.div key={svc.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 bg-gray-900 text-white text-xs font-mono rounded-md">{svc.invoice_number}</span>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-medium rounded-full border border-emerald-200">COMPLETED</span>
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
                <button onClick={() => contactWA(svc.customer_phone, svc.customer_name, svc.invoice_number, totalCost)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-all text-sm flex-shrink-0">
                  <Phone className="w-4 h-4" />
                  Hubungi Customer
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
