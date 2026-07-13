"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, ShoppingCart, TrendingUp, BarChart3, PieChartIcon, Users, Wallet, Target, Activity, X, Search, Phone, Clock as ClockIcon, CheckCircle, Plus, FileText, Receipt, Edit } from "lucide-react";
import LayananList from "./LayananList";
import PengeluaranForm from "./PengeluaranForm";
import LayananForm from "./LayananForm";

const paymentColors: Record<string, string> = { cash: "#10B981", qris: "#3B82F6", transfer: "#6B7280", tf_bca: "#8B5CF6", tf_mandiri: "#8B5CF6", edc_bca: "#F59E0B", edc_mandiri: "#F59E0B", bri: "#EC4899", kudus: "#EF4444" };
const paymentLabels: Record<string, string> = { cash: "Cash", qris: "QRIS", transfer: "Transfer", tf_bca: "TF BCA", tf_mandiri: "TF Mandiri", edc_bca: "EDC BCA", edc_mandiri: "EDC Mandiri", bri: "BRI", kudus: "Kudus" };
const jenisColors = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#F97316"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function TransactionManagement({ isDark = false }: { isDark?: boolean }) {
  const supabase = createClient();
  const [expanded, setExpanded] = useState(false);
  const [allData, setAllData] = useState<any[]>([]);
  const [filterPeriod, setFilterPeriod] = useState<"hari" | "bulan" | "tahun">("hari");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [stats, setStats] = useState({ total: 0, totalNominal: 0, active: 0, completed: 0, jenisCount: {} as Record<string, number>, metodeRevenue: {} as Record<string, number> });
  const [filterModal, setFilterModal] = useState<{ title: string; filtered: any[] } | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);

  const fetchAll = async () => {
    const { data } = await supabase.from("layanan").select("*").order("created_at", { ascending: false });
    if (data) setAllData(data);
  };

  useEffect(() => { fetchAll(); }, []);

  // Filter data by period
  const filteredData = useMemo(() => {
    if (filterPeriod === "hari") {
      return allData.filter((d) => d.created_at?.startsWith(selectedDate));
    }
    const now = new Date();
    if (filterPeriod === "bulan") {
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      return allData.filter((d) => d.created_at?.startsWith(month));
    }
    const year = String(now.getFullYear());
    return allData.filter((d) => d.created_at?.startsWith(year));
  }, [allData, filterPeriod, selectedDate]);

  const openFilterModal = useCallback((title: string, filterFn: (item: any) => boolean) => {
    setFilterModal({ title, filtered: filteredData.filter(filterFn) });
  }, [filteredData]);

  const handleEdit = useCallback((item: any) => {
    setEditData(item);
    setShowEditForm(true);
  }, []);

  const handleEditSuccess = async () => {
    setShowEditForm(false);
    setEditData(null);
    await fetchAll();
  };

  const handleEditClose = () => {
    setShowEditForm(false);
    setEditData(null);
  };

  const analytics = useMemo(() => {
    const data = filteredData;
    const total = data.length;
    const totalNominal = data.reduce((s, i) => s + (i.nominal || 0), 0);
    const active = data.filter((i) => i.status === "active").length;
    const completed = data.filter((i) => i.status === "completed").length;
    let totalRevenue = 0, totalExpenses = 0;
    const jenisCount: Record<string, number> = {};
    const metodeRevenue: Record<string, number> = {};
    const metodeCount: Record<string, number> = {};
    const staffStats: Record<string, { count: number; revenue: number }> = {};
    const leadSource: Record<string, number> = {};
    const monthlyRevenue: Record<string, number> = {};
    const dailyTx: Record<string, number> = {};
    const monthlyRev: Record<string, number> = {};
    const today = new Date().toISOString().split("T")[0];
    let todayCount = 0;

    for (const item of data) {
      const j = item.jenis_layanan || "Lainnya";
      jenisCount[j] = (jenisCount[j] || 0) + 1;
      const m = item.metode_pembayaran || "unknown";
      const nominal = item.nominal || 0;
      const isExpense = j === "pengeluaran";
      if (isExpense) totalExpenses += nominal;
      else totalRevenue += nominal;
      metodeRevenue[m] = (metodeRevenue[m] || 0) + nominal;
      metodeCount[m] = (metodeCount[m] || 0) + 1;
      const staff = item.handled_by_name || "Unknown";
      if (!staffStats[staff]) staffStats[staff] = { count: 0, revenue: 0 };
      staffStats[staff].count++;
      staffStats[staff].revenue += isExpense ? 0 : nominal;
      const ls = item.lead_source || "Lainnya";
      leadSource[ls] = (leadSource[ls] || 0) + 1;
      const date = new Date(item.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      monthlyRevenue[monthKey] = (monthlyRevenue[monthKey] || 0) + (isExpense ? -nominal : nominal);
      monthlyRev[monthKey] = (monthlyRev[monthKey] || 0) + (isExpense ? -nominal : nominal);
      const dayKey = item.created_at?.split("T")[0];
      if (dayKey) dailyTx[dayKey] = (dailyTx[dayKey] || 0) + 1;
      if (dayKey === today) todayCount++;
    }

    const netRevenue = totalRevenue - totalExpenses;
    const avgValue = total > 0 ? totalNominal / total : 0;

    return {
      total, totalNominal, totalRevenue, totalExpenses, netRevenue, active, completed, avgValue,
      jenisCount, metodeRevenue, metodeCount, staffStats, leadSource,
      monthlyRevenue, dailyTx, todayCount, monthlyRev,
    };
  }, [filteredData]);

  const topStaff = useMemo(() =>
    Object.entries(analytics.staffStats).sort(([, a], [, b]) => b.count - a.count).slice(0, 5),
  [analytics.staffStats]);

  const monthlyChartData = useMemo(() => {
    const entries = Object.entries(analytics.monthlyRevenue).sort(([a], [b]) => a.localeCompare(b));
    return entries.slice(-12).map(([key, val]) => {
      const parts = key.split("-");
      return { month: monthNames[parseInt(parts[1]) - 1] + " " + parts[0].slice(2), revenue: val };
    });
  }, [analytics.monthlyRevenue]);

  const dailyChartData = useMemo(() => {
    const entries = Object.entries(analytics.dailyTx).sort(([a], [b]) => a.localeCompare(b));
    const days = filterPeriod === "hari" ? 1 : filterPeriod === "bulan" ? 30 : 365;
    return entries.slice(-Math.min(days, entries.length)).map(([key, val]) => {
      const d = new Date(key + "T00:00:00");
      return { date: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), count: val };
    });
  }, [analytics.dailyTx, filterPeriod]);

  const gridColor = isDark ? "#334155" : "#E2E8F0";
  const tooltipBg = isDark ? "#0F172A" : "#FFFFFF";

  const BarItem = ({ label, value, pct, onClick }: { label: string; value: string | number; pct: number; onClick?: () => void }) => (
    <div className={`flex items-center gap-2 ${onClick ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg px-1.5 -mx-1.5 transition-colors" : ""}`} onClick={onClick}>
      {onClick && <Search className="w-3 h-3 text-slate-300 flex-shrink-0" />}
      <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate flex-1">{label}</span>
      <span className="text-[11px] font-semibold text-slate-900 dark:text-white flex-shrink-0">{value}</span>
      <span className="text-[10px] text-slate-400 w-8 text-right flex-shrink-0">{pct}%</span>
    </div>
  );

  const FilterModal = () => {
    if (!filterModal) return null;
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setFilterModal(null)}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-[#1c1c1c] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10"
          onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10 rounded-t-2xl">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">{filterModal.title}</h2>
            <button onClick={() => setFilterModal(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="p-5 space-y-2 max-h-[calc(85vh-70px)] overflow-y-auto">
            {filterModal.filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Tidak ada transaksi</p>
            ) : filterModal.filtered.map((tx, i) => (
              <div key={tx.id || i} className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white">{tx.customer_name}</span>
                  <span className="text-xs font-medium text-emerald-600">{fmtRupiah(tx.nominal || 0)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{tx.customer_whatsapp || "-"}</span>
                  <span>{tx.jenis_layanan}</span>
                  <span>{fmtDate(tx.created_at)}</span>
                  {tx.handled_by_name && <span>{tx.handled_by_name}</span>}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Top: Total Pendapatan + Filter Hari/Bulan/Tahun */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Total Pendapatan</p>
            <p className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{fmtRupiah(analytics.totalRevenue)}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium ${analytics.netRevenue >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                Net: {fmtRupiah(analytics.netRevenue)}
              </span>
              <span className="text-[10px] text-slate-400">| Pengeluaran: {fmtRupiah(analytics.totalExpenses)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 p-1 shadow-sm">
          {(["hari", "bulan", "tahun"] as const).map((p) => (
            <button key={p} onClick={() => { setFilterPeriod(p); if (p === "hari") setSelectedDate(new Date().toISOString().split("T")[0]); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${filterPeriod === p ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-900 dark:hover:text-white"}`}>
              {p === "hari" ? "Harian" : p === "bulan" ? "Bulanan" : "Tahunan"}
            </button>
          ))}
          {filterPeriod === "hari" && (
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="ml-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-white/10 rounded-lg bg-white dark:bg-[#1c1c1c] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          )}
          <button onClick={() => setShowExpenseForm(true)}
            className="ml-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5 shadow-sm">
            <Receipt className="w-3.5 h-3.5" />
            Pengeluaran
          </button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Total Transaksi", value: analytics.total, icon: ShoppingCart, color: "blue" },
          { label: "Transaksi Aktif", value: analytics.active, icon: ClockIcon, color: "amber" },
          { label: "Transaksi Selesai", value: analytics.completed, icon: CheckCircle, color: "green" },
          { label: "Rata-rata", value: fmtRupiah(Math.round(analytics.avgValue)), icon: DollarSign, color: "purple" },
        ].map((card, i) => {
          const gradients: Record<string, string> = {
            blue: "from-blue-50 to-blue-100/60", amber: "from-amber-50 to-amber-100/60",
            green: "from-green-50 to-green-100/60", purple: "from-purple-50 to-purple-100/60",
          };
          const colors: Record<string, string> = { blue: "#2563EB", amber: "#D97706", green: "#16A34A", purple: "#9333EA" };
          return (
            <motion.div key={card.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`bg-gradient-to-br ${gradients[card.color]} rounded-xl p-4 border border-slate-200 shadow-sm`}>
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium text-slate-500 truncate">{card.label}</p>
                  <p className="text-lg font-bold text-slate-900 mt-0.5">{card.value}</p>
                </div>
                <div className="p-2 rounded-lg bg-white/50 flex-shrink-0 ml-2">
                  <card.icon className="w-4 h-4" style={{ color: colors[card.color] }} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.div key="split" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT: Charts & Analysis — 2/3 */}
            <div className="lg:col-span-2 space-y-4">
              {/* Revenue + Daily charts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2">Revenue Bulanan</h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={monthlyChartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="month" stroke="#94A3B8" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis stroke="#94A3B8" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000000 ? (v / 1000000).toFixed(1) + "jt" : v >= 1000 ? (v / 1000).toFixed(0) + "rb" : v} />
                      <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${gridColor}`, borderRadius: "8px", fontSize: 11 }} formatter={(v: any) => fmtRupiah(Number(v))} />
                      <Area type="monotone" dataKey="revenue" stroke="#3B82F6" fillOpacity={1} fill="url(#revGrad)" strokeWidth={2} dot={{ r: 3, fill: "#3B82F6" }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-2">
                    Aktivitas {filterPeriod === "hari" ? `Harian (${new Date(selectedDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })})` : filterPeriod === "bulan" ? "30 Hari" : "Tahunan"}
                  </h3>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={dailyChartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                      <defs><linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.8} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                      <XAxis dataKey="date" stroke="#94A3B8" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(dailyChartData.length / 7) - 1)} />
                      <YAxis stroke="#94A3B8" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${gridColor}`, borderRadius: "8px", fontSize: 11 }} />
                      <Area type="monotone" dataKey="count" stroke="#10B981" fillOpacity={1} fill="url(#actGrad)" strokeWidth={2} dot={{ r: 2, fill: "#10B981" }} name="Transaksi" />
                    </AreaChart>
                  </ResponsiveContainer>
                </motion.div>
              </div>

              {/* 5 clickable category cards with mini charts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* JENIS LAYANAN */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Jenis Layanan</h3>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(analytics.jenisCount).sort(([, a], [, b]) => b - a).slice(0, 6).map(([key, val]) => {
                      const pct = analytics.total > 0 ? Math.round(val / analytics.total * 100) : 0;
                      return (
                        <BarItem key={key} label={key} value={val} pct={pct}
                          onClick={() => openFilterModal(`Jenis Layanan: ${key}`, (item) => (item.jenis_layanan || "Lainnya") === key)} />
                      );
                    })}
                  </div>
                </motion.div>

                {/* STATUS TRANSAKSI */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <PieChartIcon className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Status Transaksi</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-center">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{analytics.total}</p>
                      <p className="text-[10px] text-slate-500">Total</p>
                    </div>
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 text-center cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                      onClick={() => openFilterModal("Waiting (Aktif)", (item) => item.status === "active")}>
                      <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{analytics.active}</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">Waiting</p>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 text-center cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                      onClick={() => openFilterModal("Done (Selesai)", (item) => item.status === "completed")}>
                      <p className="text-lg font-bold text-green-700 dark:text-green-300">{analytics.completed}</p>
                      <p className="text-[10px] text-green-600 dark:text-green-400">Done</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 flex">
                    {(() => {
                      const total = analytics.total || 1;
                      return <>
                        <div className="bg-amber-500 h-2 rounded-l-full transition-all" style={{ width: `${analytics.active / total * 100}%` }} />
                        <div className="bg-green-500 h-2 rounded-r-full transition-all" style={{ width: `${analytics.completed / total * 100}%` }} />
                      </>;
                    })()}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center">
                    {analytics.active} waiting &middot; {analytics.completed} done &middot; klik untuk detail
                  </p>
                </motion.div>

                {/* HANDLE (Staff) */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Handle (Staff)</h3>
                  </div>
                  
                  <div className="space-y-1">
                    {topStaff.map(([name, data]) => (
                      <BarItem key={name} label={name} value={`${data.count} tx`} pct={Math.round(data.count / (topStaff[0]?.[1].count || 1) * 100)}
                        onClick={() => openFilterModal(`Staff: ${name}`, (item) => (item.handled_by_name || "Unknown") === name)} />
                    ))}
                  </div>
                </motion.div>

                {/* METHOD PEMBAYARAN */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Method Pembayaran</h3>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(analytics.metodeRevenue).sort(([, a], [, b]) => b - a).slice(0, 6).map(([key, val]) => {
                      const pct = analytics.totalNominal > 0 ? Math.round(val / analytics.totalNominal * 100) : 0;
                      return (
                        <BarItem key={key} label={paymentLabels[key] || key} value={fmtRupiah(val)} pct={pct}
                          onClick={() => openFilterModal(`Method: ${paymentLabels[key] || key}`, (item) => (item.metode_pembayaran || "unknown") === key)} />
                      );
                    })}
                  </div>
                </motion.div>
              </div>

              {/* LEAD SOURCE */}
              {Object.keys(analytics.leadSource).length > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl p-4 border border-slate-200 dark:border-white/10 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-rose-600" />
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">Lead Source</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                    {Object.entries(analytics.leadSource).sort(([, a], [, b]) => b - a).slice(0, 8).map(([key, val]) => {
                      const pct = analytics.total > 0 ? Math.round(val / analytics.total * 100) : 0;
                      return (
                        <div key={key} className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          onClick={() => openFilterModal(`Lead Source: ${key}`, (item) => (item.lead_source || "Lainnya") === key)}>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{val}</p>
                          <p className="text-[10px] text-slate-500 truncate">{key}</p>
                          <p className="text-[10px] text-slate-400">{pct}%</p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>

            {/* RIGHT: Transaction List */}
            <motion.div layout className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col h-full" transition={{ type: "spring", stiffness: 300, damping: 30 }}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-slate-500" />
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">Daftar Transaksi</h3>
                </div>
                <span className="text-[10px] font-medium text-slate-400">{analytics.total} total</span>
              </div>
              <div className="flex-1 overflow-y-auto min-h-[600px] lg:min-h-0 lg:max-h-[1120px]">
                <LayananList isAdmin={true} compact={true} dateFilter={filterPeriod === "hari" ? selectedDate : undefined} onStatsUpdate={(s) => setStats(s)} onEdit={handleEdit} />
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 md:px-5 py-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Semua Transaksi</h3>
              </div>
              <span className="text-xs text-slate-400">{analytics.total} total</span>
            </div>
            <LayananList isAdmin={true} compact={false} dateFilter={filterPeriod === "hari" ? selectedDate : undefined} onStatsUpdate={(s) => setStats(s)} onEdit={handleEdit} />
          </motion.div>
        )}
      </AnimatePresence>

      <FilterModal />
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <PengeluaranForm
            onSuccess={() => {
              setShowExpenseForm(false);
              fetchAll();
            }}
            onClose={() => setShowExpenseForm(false)}
          />
        </div>
      )}
      {showEditForm && editData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          {editData.jenis_layanan === "pengeluaran" ? (
            <PengeluaranForm
              initialData={editData}
              onSuccess={handleEditSuccess}
              onClose={handleEditClose}
            />
          ) : (
            <LayananForm
              initialData={editData}
              onSuccess={handleEditSuccess}
              onClose={handleEditClose}
            />
          )}
        </div>
      )}
    </div>
  );
}