"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Users, Search, Phone, ShoppingCart, Watch } from "lucide-react";

export default function CustomerList() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("customers")
        .select("name, phone")
        .order("created_at", { ascending: false })
        .limit(200);

      // Count transactions & services for each customer
      const phones = (data || []).map((c) => c.phone).filter(Boolean);
      let layananCounts: Record<string, number> = {};
      let serviceCounts: Record<string, number> = {};

      if (phones.length > 0) {
        const [layananRes, serviceRes] = await Promise.all([
          supabase.from("layanan").select("customer_whatsapp").in("customer_whatsapp", phones),
          supabase.from("service_orders").select("customer_phone").in("customer_phone", phones),
        ]);

        for (const r of layananRes.data || []) {
          const p = r.customer_whatsapp || "";
          layananCounts[p] = (layananCounts[p] || 0) + 1;
        }
        for (const r of serviceRes.data || []) {
          const p = r.customer_phone || "";
          serviceCounts[p] = (serviceCounts[p] || 0) + 1;
        }
      }

      const list = (data || []).map((c) => ({
        name: c.name,
        phone: c.phone,
        layananCount: layananCounts[c.phone] || 0,
        serviceCount: serviceCounts[c.phone] || 0,
      }));

      setCustomers(list);
    } catch (e: any) {
      console.error("Fetch customers error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = search.trim()
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search.replace(/\D/g, ""))
      )
    : customers;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-gray-100">Data Customer</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400">{customers.length} customer terdaftar</p>
          </div>
        </div>
        <button onClick={fetchCustomers}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-gray-400">
          <Search className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 p-4 shadow-sm">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor WhatsApp..." autoFocus
            className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-[#1c1c1c] text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Nama</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">WhatsApp</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Transaksi</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Service Jam</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400 dark:text-gray-500">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400 dark:text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Tidak ada customer</p>
                </td></tr>
              ) : filtered.map((c, i) => (
                <motion.tr key={c.phone || c.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-gray-900 font-bold text-xs">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-gray-100">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.phone ? (
                      <a href={`https://wa.me/${c.phone.replace(/^0/, "62")}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="font-mono text-sm">{c.phone}</span>
                      </a>
                    ) : <span className="text-slate-400 dark:text-gray-500">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <ShoppingCart className="w-3 h-3" />
                      {c.layananCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Watch className="w-3 h-3" />
                      {c.serviceCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-gray-100">
                    {c.layananCount + c.serviceCount}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-400 dark:text-gray-500">
            Menampilkan {filtered.length} dari {customers.length} customer
          </div>
        )}
      </div>
    </div>
  );
}
