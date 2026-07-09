"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, Users, ShoppingCart, Clock, ArrowUp, ArrowDown, Box, Phone, Wallet, User as UserIcon, Banknote } from "lucide-react";

const COLORS_LIGHT = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6", "#F97316"];
const COLORS_DARK = ["#60A5FA", "#34D399", "#A78BFA", "#FBBF24", "#F87171", "#F472B6", "#2DD4BF", "#FB923C"];

const paymentLabels: Record<string, string> = {
  cash: "Cash", qris: "QRIS", tf_bca: "TF BCA", tf_mandiri: "TF Mandiri",
  edc_bca: "EDC BCA", edc_mandiri: "EDC Mandiri", bri: "BRI", kudus: "Kudus",
};

const paymentIcons: Record<string, any> = {
  cash: Banknote, qris: Wallet, tf_bca: Phone, tf_mandiri: Phone,
  edc_bca: ShoppingCart, edc_mandiri: ShoppingCart, bri: Banknote, kudus: Banknote,
};

const jenisLabels: Record<string, string> = {
  service_langsung: "Service Langsung", dp_service: "DP Service", ambil_jam_service: "Ambil Jam",
  order_online: "Order Online", beli_jam: "Beli Jam", pengeluaran: "Pengeluaran",
};

interface AdminDashboardAnalyticsProps {
  totalTransactions?: number; totalUsers?: number; totalServices?: number;
  totalInventory?: number; pendingServices?: number; revenue?: number;
  totalExpenses?: number; todayTransactions?: number; todayRevenue?: number; todayExpenses?: number;
  revenueGrowth?: number; isDark?: boolean;
  chartData?: any[]; recentTransactions?: any[];
  onTransactionClick?: (tx: any) => void;
  onNavigate?: (tab: string) => void;
}

function formatRupiah(v: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v);
}

function formatTime(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function getPaymentColor(method: string, isDark: boolean) {
  const map: Record<string, string> = isDark
    ? { cash: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50", qris: "bg-blue-900/40 text-blue-300 border-blue-700/50", tf_bca: "bg-purple-900/40 text-purple-300 border-purple-700/50", tf_mandiri: "bg-purple-900/40 text-purple-300 border-purple-700/50", edc_bca: "bg-amber-900/40 text-amber-300 border-amber-700/50", edc_mandiri: "bg-amber-900/40 text-amber-300 border-amber-700/50", bri: "bg-cyan-900/40 text-cyan-300 border-cyan-700/50", kudus: "bg-pink-900/40 text-pink-300 border-pink-700/50" }
    : { cash: "bg-emerald-100 text-emerald-700 border-emerald-200", qris: "bg-blue-100 text-blue-700 border-blue-200", tf_bca: "bg-purple-100 text-purple-700 border-purple-200", tf_mandiri: "bg-purple-100 text-purple-700 border-purple-200", edc_bca: "bg-amber-100 text-amber-700 border-amber-200", edc_mandiri: "bg-amber-100 text-amber-700 border-amber-200", bri: "bg-cyan-100 text-cyan-700 border-cyan-200", kudus: "bg-pink-100 text-pink-700 border-pink-200" };
  return map[method] || (isDark ? "bg-slate-700 text-slate-300 border-slate-600" : "bg-slate-100 text-slate-600 border-slate-200");
}

export default function AdminDashboardAnalytics({
  totalTransactions = 0, totalUsers = 0, totalServices = 0, totalInventory = 0,
  pendingServices = 0, revenue = 0, totalExpenses = 0,
  todayTransactions = 0, todayRevenue = 0, todayExpenses = 0,
  revenueGrowth = 12.5,
  isDark = false, chartData: externalChartData = [], recentTransactions = [],
  onTransactionClick, onNavigate,
}: AdminDashboardAnalyticsProps) {

  const chartData = useMemo(() => externalChartData?.length ? externalChartData : [], [externalChartData]);

  const { paymentDist, serviceTypeDist } = useMemo(() => {
    const pm: Record<string, number> = {};
    const st: Record<string, number> = {};
    for (const tx of recentTransactions) {
      const m = tx.metode_pembayaran || "unknown";
      pm[m] = (pm[m] || 0) + 1;
      const j = tx.jenis_layanan || tx.service_type || "unknown";
      st[j] = (st[j] || 0) + 1;
    }
    return {
      paymentDist: Object.entries(pm).map(([k, v]) => ({ name: paymentLabels[k] || k, value: v })),
      serviceTypeDist: Object.entries(st).map(([k, v]) => ({ name: jenisLabels[k] || k, value: v })),
    };
  }, [recentTransactions]);

  const revenueByType = useMemo(() => {
    const byType: Record<string, number> = {};
    for (const tx of recentTransactions) {
      const j = jenisLabels[tx.jenis_layanan] || tx.jenis_layanan || "Lainnya";
      byType[j] = (byType[j] || 0) + (tx.nominal || 0);
    }
    return Object.entries(byType)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [recentTransactions]);

  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;
  const tooltipBg = isDark ? "#0F172A" : "#FFFFFF";
  const textColor = isDark ? "#F1F5F9" : "#1E293B";
  const gridColor = isDark ? "#334155" : "#E2E8F0";
  const cardBorder = isDark ? "border-slate-700/50" : "border-slate-200";
  const cardBg = isDark ? "bg-slate-800/80" : "bg-white";
  const labelCls = `text-[10px] md:text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`;

  const StatCard = ({ label, value, icon: Icon, gradient, onClick }: { label: string; value: number | string; icon: any; gradient: string; onClick?: () => void }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={`${gradient} rounded-xl p-4 border ${cardBorder} shadow-sm backdrop-blur-sm ${onClick ? "cursor-pointer hover:scale-[1.02] active:scale-[0.98]" : ""} transition-all`}
      onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <p className={labelCls}>{label}</p>
          <p className={`text-xl lg:text-2xl font-bold mt-0.5 ${isDark ? "text-white" : "text-slate-900"}`}>{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${isDark ? "bg-black/20" : "bg-white/50"}`}>
          <Icon className={`w-4 h-4 ${isDark ? "text-slate-300" : "text-slate-600"}`} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className={`space-y-4 md:space-y-5 ${isDark ? "text-white" : "text-slate-900"}`}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl md:text-2xl lg:text-3xl font-bold">Dashboard Utama</h1>
        <p className={`text-xs md:text-sm mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          Analisa data transaction, pengguna, dan service secara real-time
        </p>
      </motion.div>

      {/* Stat Cards — click to navigate */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Transaksi Hari Ini" value={todayTransactions} icon={ShoppingCart}
          gradient={isDark ? "bg-gradient-to-br from-blue-900/40 to-blue-800/20" : "bg-gradient-to-br from-blue-50 to-blue-100/60"}
          onClick={() => onNavigate?.("management-transaction")} />
        <StatCard label="Total Users" value={totalUsers} icon={Users}
          gradient={isDark ? "bg-gradient-to-br from-green-900/40 to-green-800/20" : "bg-gradient-to-br from-green-50 to-green-100/60"}
          onClick={() => onNavigate?.("users")} />
        <StatCard label="Total Services" value={totalServices} icon={Box}
          gradient={isDark ? "bg-gradient-to-br from-purple-900/40 to-purple-800/20" : "bg-gradient-to-br from-purple-50 to-purple-100/60"}
          onClick={() => onNavigate?.("services")} />
        <StatCard label="Pending Service" value={pendingServices} icon={Clock}
          gradient={isDark ? "bg-gradient-to-br from-amber-900/40 to-amber-800/20" : "bg-gradient-to-br from-amber-50 to-amber-100/60"}
          onClick={() => onNavigate?.("services")} />
      </div>

      {/* Revenue + Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={`lg:col-span-1 ${cardBg} rounded-xl p-4 md:p-5 border ${cardBorder} shadow-sm bg-gradient-to-br ${isDark ? "from-slate-800 to-slate-900" : "from-slate-900 to-slate-800"} text-white cursor-pointer hover:scale-[1.01] transition-all`}
          onClick={() => onNavigate?.("management-transaction")}>
          <p className="text-slate-300 text-xs font-medium mb-1">Pendapatan Hari Ini</p>
          <p className="text-xl md:text-2xl lg:text-3xl font-bold">{formatRupiah(todayRevenue - todayExpenses)}</p>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <span className="text-emerald-400">Masuk: {formatRupiah(todayRevenue)}</span>
            <span className="text-red-400">Keluar: {formatRupiah(todayExpenses)}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1 mt-2 flex">
            <div className="bg-emerald-500 h-1 rounded-l-full transition-all" style={{ width: todayRevenue + todayExpenses > 0 ? `${todayRevenue / (todayRevenue + todayExpenses) * 100}%` : "100%" }} />
            {todayExpenses > 0 && <div className="bg-red-500 h-1 rounded-r-full transition-all" style={{ width: `${todayExpenses / (todayRevenue + todayExpenses) * 100}%` }} />}
          </div>

          {/* Payment method breakdown */}
          {paymentDist.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-700/50 space-y-2">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Per Metode Pembayaran</p>
              {(() => {
                const totalTx = paymentDist.reduce((s, x) => s + x.value, 0);
                return paymentDist.sort((a, b) => b.value - a.value).slice(0, 4).map((item, i) => {
                  const pct = totalTx > 0 ? Math.round(item.value / totalTx * 100) : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-[11px] text-slate-300">{item.name}</span>
                        <span className="text-[11px] text-slate-200 font-semibold">{item.value} trans</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1">
                        <div className="h-1 rounded-full transition-all" style={{ width: pct + "%", backgroundColor: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B"][i] }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className={`lg:col-span-2 ${cardBg} rounded-xl p-4 md:p-5 border ${cardBorder} shadow-sm`}>
          <h3 className={`text-sm md:text-base font-bold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
            Trend Transaction & Service
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="svcGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" stroke={isDark ? "#94A3B8" : "#64748B"} tick={{ fontSize: 11 }} />
              <YAxis stroke={isDark ? "#94A3B8" : "#64748B"} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${isDark ? "#475569" : "#E2E8F0"}`, borderRadius: "8px", color: textColor, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="transaction" stroke="#3B82F6" fillOpacity={1} fill="url(#txGrad)" name="Transaction" strokeWidth={2} />
              <Area type="monotone" dataKey="service" stroke="#10B981" fillOpacity={1} fill="url(#svcGrad)" name="Service" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom: Transaction List + Pie Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Transactions - Enriched */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className={`lg:col-span-2 ${cardBg} rounded-xl p-4 md:p-5 border ${cardBorder} shadow-sm`}>
          <h3 className={`text-sm md:text-base font-bold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>
            Transaksi Terbaru
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto">
            {recentTransactions.length > 0 ? recentTransactions.slice(0, 12).map((tx: any, i: number) => {
              const PaymentIcon = paymentIcons[tx.metode_pembayaran] || Banknote;
              return (
                <motion.div key={tx.id || i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className={`p-3 rounded-lg border transition-all hover:shadow-sm cursor-pointer ${isDark ? "bg-slate-700/40 border-slate-600/50 hover:border-slate-500" : "bg-slate-50 border-slate-200 hover:border-slate-300"}`}
                  onClick={() => onTransactionClick?.(tx)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm truncate ${isDark ? "text-white" : "text-slate-900"}`}>{tx.customer_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${getPaymentColor(tx.metode_pembayaran, isDark)}`}>
                          {paymentLabels[tx.metode_pembayaran] || tx.metode_pembayaran}
                        </span>
                      </div>
                      <div className={`flex items-center gap-3 mt-1 text-[11px] flex-wrap ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{tx.customer_whatsapp || "-"}</span>
                        <span>{formatTime(tx.created_at)}</span>
                        {tx.handled_by_name && <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" />{tx.handled_by_name}</span>}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-sm ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>{formatRupiah(tx.nominal || 0)}</p>
                      <p className={`text-[10px] mt-0.5 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{jenisLabels[tx.jenis_layanan] || tx.jenis_layanan || ""}</p>
                    </div>
                  </div>
                </motion.div>
              );
            }) : (
              <div className={`p-8 text-center ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Belum ada transaksi</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Right Column: Analysis */}
        <div className="space-y-4">
          {/* Service Type Revenue */}
          {revenueByType.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className={`${cardBg} rounded-xl p-4 md:p-5 border ${cardBorder} shadow-sm`}>
              <h3 className={`text-sm font-bold mb-3 ${isDark ? "text-white" : "text-slate-900"}`}>Revenue per Jenis Layanan</h3>
              <div className="space-y-2">
                {revenueByType.slice(0, 6).map((item, i) => {
                  const total = revenueByType.reduce((s, x) => s + x.value, 0);
                  const pct = total > 0 ? Math.round(item.value / total * 100) : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between items-center mb-0.5">
                        <span className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>{item.name}</span>
                        <span className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{formatRupiah(item.value)}</span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: pct + "%", backgroundColor: colors[i % colors.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Payment Method Distribution */}
          {paymentDist.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className={`${cardBg} rounded-xl p-4 md:p-5 border ${cardBorder} shadow-sm`}>
              <h3 className={`text-sm font-bold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>Metode Pembayaran</h3>
              <div className="space-y-1.5">
                {paymentDist.sort((a, b) => b.value - a.value).slice(0, 5).map((item, i) => {
                  const total = paymentDist.reduce((s, x) => s + x.value, 0);
                  return (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                      <span className={`text-xs flex-1 ${isDark ? "text-slate-300" : "text-slate-600"}`}>{item.name}</span>
                      <span className={`text-xs font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>{item.value}</span>
                      <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>({Math.round(item.value / total * 100)}%)</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
