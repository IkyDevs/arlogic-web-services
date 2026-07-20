"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { DollarSign, ShoppingCart, TrendingUp, BarChart3, PieChartIcon, Users, Wallet, X, Search, Phone, FileText, Receipt, Edit, Banknote } from "lucide-react";
import LayananList from "./LayananList";
import PengeluaranForm from "./PengeluaranForm";
import CashdrawForm from "./CashdrawForm";
import LayananForm from "./LayananForm";

const paymentColors: Record<string, string> = { cash: "#10B981", qris: "#3B82F6", edc: "#F59E0B", transfer: "#6B7280", tf_bca: "#8B5CF6", tf_mandiri: "#8B5CF6", edc_bca: "#F59E0B", edc_mandiri: "#F59E0B", bri: "#EC4899", kudus: "#EF4444", split_payment: "#A855F7" };
const paymentLabels: Record<string, string> = { cash: "Cash", qris: "QRIS", edc: "EDC", transfer: "Transfer", tf_bca: "TF BCA", tf_mandiri: "TF Mandiri", edc_bca: "EDC BCA", edc_mandiri: "EDC Mandiri", bri: "BRI", kudus: "Kudus", split_payment: "Split Payment" };

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

export default function TransactionManagement({ isDark = false }: { isDark?: boolean }) {
  const supabase = createClient();
  const [allData, setAllData] = useState<any[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<"hari" | "bulan" | "tahun">("hari");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [stats, setStats] = useState({ total: 0, totalNominal: 0, active: 0, completed: 0, jenisCount: {} as Record<string, number>, metodeRevenue: {} as Record<string, number> });
  const [filterModal, setFilterModal] = useState<{ title: string; filtered: any[] } | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCashdrawForm, setShowCashdrawForm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);

  const fetchAll = async () => {
    const { data } = await supabase
      .from("layanan")
      .select("*, layanan_items(*)")
      .order("created_at", { ascending: false });
    if (data) {
      // Expand: setiap extra item (layanan_items) jadi row terpisah
      const expanded = data.flatMap((tx) => {
        const items = (tx as any).layanan_items || [];
        if (items.length === 0) return [tx];
        const extraRows = items.map((item: any) => ({
          ...tx,
          jenis_layanan: item.jenis_layanan,
          detail_sku: item.detail_sku,
          notes: item.notes,
          nominal: item.nominal,
          _isExtraItem: true,
        }));
        return [tx, ...extraRows];
      });
      setAllData(expanded);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredData = useMemo(() => {
    if (filterPeriod === "hari") return allData.filter((d) => d.created_at?.startsWith(selectedDate));
    const now = new Date();
    if (filterPeriod === "bulan") {
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return allData.filter((d) => d.created_at?.startsWith(month));
    }
    return allData.filter((d) => d.created_at?.startsWith(String(now.getFullYear())));
  }, [allData, filterPeriod, selectedDate]);

  const openFilterModal = useCallback((title: string, filterFn: (item: any) => boolean) => {
    setFilterModal({ title, filtered: filteredData.filter(filterFn) });
  }, [filteredData]);

  const handleEdit = useCallback((item: any) => { setEditData(item); setShowEditForm(true); }, []);

  const analytics = useMemo(() => {
    const data = filteredData;
    let totalRevenue = 0, totalExpenses = 0;
    const jenisCount: Record<string, number> = {};
    const metodeRevenue: Record<string, number> = {};
    const metodeCount: Record<string, number> = {};
    const staffStats: Record<string, { count: number; revenue: number }> = {};
    for (const item of data) {
      const j = item.jenis_layanan || "Lainnya";
      jenisCount[j] = (jenisCount[j] || 0) + 1;
      const nominal = item.nominal || 0;
      const isExpense = j === "pengeluaran";
      if (isExpense) totalExpenses += nominal; else totalRevenue += nominal;
      const m = item.metode_pembayaran || "unknown";
      metodeRevenue[m] = (metodeRevenue[m] || 0) + (isExpense ? -nominal : nominal);
      metodeCount[m] = (metodeCount[m] || 0) + 1;
      const staff = item.handled_by_name || "Unknown";
      if (!staffStats[staff]) staffStats[staff] = { count: 0, revenue: 0 };
      staffStats[staff].count++;
      staffStats[staff].revenue += isExpense ? 0 : nominal;
    }
    return { total: data.length, totalRevenue, totalExpenses, netRevenue: totalRevenue - totalExpenses, active: data.filter(i => i.status === "active").length, completed: data.filter(i => i.status === "completed").length, jenisCount, metodeRevenue, metodeCount, staffStats };
  }, [filteredData]);

  const topStaff = useMemo(() => Object.entries(analytics.staffStats).sort(([, a], [, b]) => b.count - a.count).slice(0, 5), [analytics.staffStats]);

  const BarItem = ({ label, value, pct, onClick }: { label: string; value: string | number; pct: number; onClick?: () => void }) => (
    <div className={`flex items-center gap-1.5 md:gap-2 ${onClick ? "cursor-pointer hover:bg-slate-100 rounded px-1 md:px-1.5 -mx-1 transition-colors" : ""}`} onClick={onClick}>
      {onClick && <Search className="w-2.5 h-2.5 md:w-3 md:h-3 text-slate-300 flex-shrink-0" />}
      <span className="text-[10px] md:text-sm text-slate-600 truncate flex-1">{label}</span>
      <span className="text-[10px] md:text-sm font-semibold text-slate-900 flex-shrink-0">{value}</span>
      <span className="text-[9px] md:text-xs text-slate-400 w-7 md:w-8 text-right flex-shrink-0">{pct}%</span>
    </div>
  );

  const FilterModal = () => {
    if (!filterModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setFilterModal(null)}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl border border-slate-200"
          onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white z-20 flex items-center justify-between px-5 py-4 border-b border-slate-200 rounded-t-2xl">
            <h2 className="text-sm font-bold text-slate-900">{filterModal.title}</h2>
            <button onClick={() => setFilterModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="p-5 space-y-2 max-h-[calc(85vh-70px)] overflow-y-auto">
            {filterModal.filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Tidak ada transaksi</p>
            ) : (() => {
              const uniqueJenis = new Set(filterModal.filtered.map((t) => t.jenis_layanan));
              const singleJenis = uniqueJenis.size === 1;
              return filterModal.filtered.map((tx, i) => {
              const isExpense = tx.jenis_layanan === "pengeluaran";
              return (
                <div key={`${tx.id}-${i}`} className={`p-3 rounded-xl border ${isExpense ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${isExpense ? "text-red-700" : "text-slate-900"}`}>
                      {isExpense ? <Receipt className="w-3.5 h-3.5 inline mr-1" /> : null}{tx.customer_name}
                    </span>
                    <span className={`text-xs font-medium ${isExpense ? "text-red-600" : "text-emerald-600"}`}>{fmtRupiah(tx.nominal || 0)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                    {!isExpense && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{tx.customer_whatsapp || "-"}</span>}
                    <span>{tx.jenis_layanan}</span>
                    <span>{new Date(tx.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    {tx.handled_by_name && <span>{tx.handled_by_name}</span>}
                  </div>
                  {singleJenis && tx.detail_sku && (
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                      <span className="font-medium text-slate-700">SKU: {tx.detail_sku}</span>
                      <span className="text-emerald-600 font-medium">{fmtRupiah(tx.nominal || 0)}</span>
                    </div>
                  )}
                </div>
              );
            });
            })()}
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col gap-2 overflow-hidden min-h-0">
      {/* ── Desktop top: Total Pendapatan (kiri) + Buttons + Filter (kanan) ── */}
      <div className="hidden sm:flex items-start justify-between gap-4 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Total Pendapatan</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{fmtRupiah(analytics.totalRevenue)}</p>
          <div className="flex items-center gap-2 text-xs mt-0.5">
            <span className={`font-semibold ${analytics.netRevenue >= 0 ? "text-emerald-600" : "text-red-600"}`}>Net: {fmtRupiah(analytics.netRevenue)}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Peng: {fmtRupiah(analytics.totalExpenses)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowAddForm(true)}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 flex items-center gap-1.5 shadow-sm transition-all">
              <FileText className="w-3.5 h-3.5" />+ Transaksi
            </button>
            <button onClick={() => setShowExpenseForm(true)}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5 shadow-sm transition-all">
              <Receipt className="w-3.5 h-3.5" />Pengeluaran
            </button>
            <button onClick={() => setShowCashdrawForm(true)}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 shadow-sm transition-all">
              <Banknote className="w-3.5 h-3.5" />Cashdraw
            </button>
          </div>
          <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm">
            {(["hari", "bulan", "tahun"] as const).map((p) => (
              <button key={p} onClick={() => { setFilterPeriod(p); if (p === "hari") setSelectedDate(new Date().toISOString().split("T")[0]); }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${filterPeriod === p ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                {p === "hari" ? "Harian" : p === "bulan" ? "Bulanan" : "Tahunan"}
              </button>
            ))}
            {filterPeriod === "hari" && (
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                className="ml-0.5 px-1.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/10 w-[110px]" />
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile top ── */}
      <div className="sm:hidden space-y-2 flex-shrink-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Pendapatan</p>
        <p className="text-xl font-bold text-slate-900">{fmtRupiah(analytics.totalRevenue)}</p>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`font-semibold ${analytics.netRevenue >= 0 ? "text-emerald-600" : "text-red-600"}`}>Net: {fmtRupiah(analytics.netRevenue)}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Peng: {fmtRupiah(analytics.totalExpenses)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => setShowAddForm(true)}
            className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-gray-900 text-white hover:bg-gray-700 flex items-center justify-center gap-1.5 shadow-sm">
            <FileText className="w-3.5 h-3.5" />Transaksi
          </button>
          <button onClick={() => setShowExpenseForm(true)}
            className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 flex items-center justify-center gap-1.5 shadow-sm">
            <Receipt className="w-3.5 h-3.5" />Pengeluaran
          </button>
          <button onClick={() => setShowCashdrawForm(true)}
            className="flex-1 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center gap-1.5 shadow-sm">
            <Banknote className="w-3.5 h-3.5" />Cashdraw
          </button>
        </div>
        <div className="flex items-center gap-1 bg-white rounded-lg border border-slate-200 p-0.5 shadow-sm w-fit">
          {(["hari", "bulan", "tahun"] as const).map((p) => (
            <button key={p} onClick={() => { setFilterPeriod(p); if (p === "hari") setSelectedDate(new Date().toISOString().split("T")[0]); }}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${filterPeriod === p ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
              {p === "hari" ? "Harian" : p === "bulan" ? "Bulanan" : "Tahunan"}
            </button>
          ))}
          {filterPeriod === "hari" && (
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="ml-0.5 px-1.5 py-1.5 text-xs border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-slate-900/10" />
          )}
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 flex-shrink-0">
        {[
          { label: "Pemasukan", value: fmtRupiah(analytics.totalRevenue), color: "green" },
          { label: "Pengeluaran", value: fmtRupiah(analytics.totalExpenses), color: "red" },
          { label: "Transaksi", value: analytics.total, color: "blue" },
          { label: "Net", value: fmtRupiah(analytics.netRevenue), color: analytics.netRevenue >= 0 ? "green" : "red" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg md:rounded-xl py-2 md:py-4 px-3 md:px-5 border border-slate-200 shadow-sm">
            <p className="text-[10px] md:text-xs font-medium text-slate-400 uppercase">{card.label}</p>
            <p className={`text-sm md:text-lg font-bold ${card.color === "red" ? "text-red-600" : "text-slate-900"}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Category cards row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 flex-shrink-0">
        <div className="bg-white rounded-lg md:rounded-xl py-2 md:py-4 px-3 md:px-5 border border-slate-200 shadow-sm">
          <p className="text-[10px] md:text-sm font-bold text-blue-600 uppercase mb-1 md:mb-2">Jenis Layanan</p>
          <div className="space-y-0.5 md:space-y-1">
            {Object.entries(analytics.jenisCount).sort(([, a], [, b]) => b - a).slice(0, 4).map(([key, val]) => {
              const pct = analytics.total > 0 ? Math.round(val / analytics.total * 100) : 0;
              return <BarItem key={key} label={key} value={val} pct={pct} onClick={() => openFilterModal(`Jenis Layanan: ${key}`, (item) => (item.jenis_layanan || "Lainnya") === key)} />;
            })}
          </div>
        </div>
        <div className="bg-white rounded-lg md:rounded-xl py-2 md:py-4 px-3 md:px-5 border border-slate-200 shadow-sm">
          <p className="text-[10px] md:text-sm font-bold text-indigo-600 uppercase mb-1 md:mb-2">Status</p>
          <div className="grid grid-cols-3 gap-1.5 md:gap-2">
            <div className="text-center md:text-left py-1.5 md:py-3 px-1 md:px-2 bg-slate-50 rounded border border-slate-200">
              <p className="text-sm md:text-lg font-bold text-slate-900">{analytics.total}</p>
              <p className="text-[9px] md:text-xs text-slate-400">Total</p>
            </div>
            <div className="text-center md:text-left py-1.5 md:py-3 px-1 md:px-2 bg-amber-50 rounded border border-amber-200 cursor-pointer hover:bg-amber-100"
              onClick={() => openFilterModal("Waiting (Aktif)", (item) => item.status === "active")}>
              <p className="text-sm md:text-lg font-bold text-amber-700">{analytics.active}</p>
              <p className="text-[9px] md:text-xs text-amber-600">Active</p>
            </div>
            <div className="text-center md:text-left py-1.5 md:py-3 px-1 md:px-2 bg-green-50 rounded border border-green-200 cursor-pointer hover:bg-green-100"
              onClick={() => openFilterModal("Done (Selesai)", (item) => item.status === "completed")}>
              <p className="text-sm md:text-lg font-bold text-green-700">{analytics.completed}</p>
              <p className="text-[9px] md:text-xs text-green-600">Done</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg md:rounded-xl py-2 md:py-4 px-3 md:px-5 border border-slate-200 shadow-sm">
          <p className="text-[10px] md:text-sm font-bold text-purple-600 uppercase mb-1 md:mb-2">Staff</p>
          <div className="space-y-0.5 md:space-y-1">
            {(() => {
              const totalStaffCount = Object.values(analytics.staffStats).reduce((s, x) => s + x.count, 0);
              return topStaff.map(([name, data]) => (
                <BarItem key={name} label={name} value={`${data.count}`} pct={totalStaffCount > 0 ? Math.round(data.count / totalStaffCount * 100) : 0}
                  onClick={() => openFilterModal(`Staff: ${name}`, (item) => (item.handled_by_name || "Unknown") === name)} />
              ));
            })()}
          </div>
        </div>
        <div className="bg-white rounded-lg md:rounded-xl py-2 md:py-4 px-3 md:px-5 border border-slate-200 shadow-sm">
          <p className="text-[10px] md:text-sm font-bold text-emerald-600 uppercase mb-1 md:mb-2">Method</p>
          <div className="space-y-0.5 md:space-y-1">
            {Object.entries(analytics.metodeRevenue).sort(([, a], [, b]) => b - a).slice(0, 4).map(([key, val]) => {
              const totalMethodCount = Object.values(analytics.metodeCount).reduce((s, v) => s + v, 0);
              const methodCount = analytics.metodeCount[key] || 0;
              const pct = totalMethodCount > 0 ? Math.round(methodCount / totalMethodCount * 100) : 0;
              return <BarItem key={key} label={paymentLabels[key] || key} value={fmtRupiah(Number(val))} pct={pct}
                onClick={() => openFilterModal(`Method: ${paymentLabels[key] || key}`, (item) => (item.metode_pembayaran || "unknown") === key)} />;
            })}
          </div>
        </div>
      </div>

      {/* ── Daftar Transaksi (fills remaining space, scrolls internally) ── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-slate-900">Daftar Transaksi</h3>
            </div>
            <span className="text-[10px] font-medium text-slate-400">{analytics.total} total</span>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <LayananList isAdmin={true} compact={false} dateFilter={filterPeriod === "hari" ? selectedDate : undefined} onStatsUpdate={(s) => setStats(s)} onEdit={handleEdit} />
          </div>
        </div>
      </div>

      <FilterModal />
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
          <LayananForm onSuccess={() => { setShowAddForm(false); fetchAll(); }} onClose={() => setShowAddForm(false)} />
        </div>
      )}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
          <PengeluaranForm onSuccess={() => { setShowExpenseForm(false); fetchAll(); }} onClose={() => setShowExpenseForm(false)} />
        </div>
      )}
      {showEditForm && editData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
          {editData.jenis_layanan === "pengeluaran" ? (
            <PengeluaranForm initialData={editData} onSuccess={() => { setShowEditForm(false); setEditData(null); fetchAll(); }} onClose={() => { setShowEditForm(false); setEditData(null); }} />
          ) : (
            <LayananForm initialData={editData} onSuccess={() => { setShowEditForm(false); setEditData(null); fetchAll(); }} onClose={() => { setShowEditForm(false); setEditData(null); }} />
          )}
        </div>
      )}
      {showCashdrawForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
          <CashdrawForm onSuccess={() => { setShowCashdrawForm(false); fetchAll(); }} onClose={() => setShowCashdrawForm(false)} />
        </div>
      )}
    </div>
  );
}
