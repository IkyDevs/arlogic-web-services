"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ShoppingCart, FileText, Receipt, Banknote, Phone } from "lucide-react";
import LayananList from "./LayananList";
import PengeluaranForm from "./PengeluaranForm";
import CashdrawForm from "./CashdrawForm";
import LayananForm from "./LayananForm";
import { useTransactionStore } from "@/stores/transaction-store";
import { realtimeService } from "@/lib/realtime";
import { formatRupiah } from "@/lib/transaction-service";
import { computeAnalytics } from "@/lib/domain/transaction/service";
import { jenisLayananLabels } from "@/lib/domain/transaction/enums";
import { useBranchScope } from "@/lib/context/useBranchScope";
import BranchSelector from "@/components/ui/BranchSelector";
import { PeriodFilter, type PeriodValue, DEFAULT_PERIOD } from "@/components/filters/PeriodFilter";

const paymentLabels: Record<string, string> = {
  cash: "Cash", qris: "QRIS", edc: "EDC", transfer: "Transfer",
  tf_bca: "TF BCA", tf_mandiri: "TF Mandiri", edc_bca: "EDC BCA",
  edc_mandiri: "EDC Mandiri", bri: "BRI", kudus: "Kudus", split_payment: "Split Payment",
};

// Cache untuk hasil fetch
type CacheKey = string;
interface CacheEntry {
  transactions: any[];
  analytics: any;
  timestamp: number;
}
const transactionCache = new Map<CacheKey, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 menit

function getCacheKey(periodValue: PeriodValue, branchId?: string | null): CacheKey {
  const periodStr = periodValue.type === "hari" ? periodValue.date :
    periodValue.type === "bulan" ? periodValue.month :
    periodValue.type === "tahun" ? periodValue.year :
    periodValue.type === "custom" ? `${periodValue.range?.start}-${periodValue.range?.end}` :
    "default";
  return `${branchId || 'all'}-${periodValue.type}-${periodStr}`;
}

function getCachedData(key: CacheKey): CacheEntry | null {
  const entry = transactionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_DURATION) {
    transactionCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedData(key: CacheKey, transactions: any[], analytics: any) {
  transactionCache.set(key, { transactions, analytics, timestamp: Date.now() });
}

// Loading animation component
function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-900 animate-spin" />
        <div className="absolute inset-0 w-12 h-12 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" style={{ animationDuration: '1.5s' }} />
      </div>
      <div className="flex flex-col items-center space-y-1">
        <p className="text-sm font-medium text-slate-600 animate-pulse">Memuat data...</p>
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

export default function TransactionManagement({ isDark = false, readOnly = false, branchId: branchIdProp, defaultBranchId }: { isDark?: boolean; readOnly?: boolean; branchId?: string | null; defaultBranchId?: string | null }) {
  const { transactions, analytics, fetch, loading } = useTransactionStore();
  const scopeBranchId = useBranchScope().branchId;
  const branchId = branchIdProp ?? scopeBranchId;
  
  // Period filter state
  const [periodValue, setPeriodValue] = useState<PeriodValue>(DEFAULT_PERIOD);
  
  // UI states
  const [filterModal, setFilterModal] = useState<{ title: string; filtered: any[]; filterKey?: string; filterType?: string } | null>(null);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>("");
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCashdrawForm, setShowCashdrawForm] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  
  // Refs
  const fetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isInitialMount = useRef(true);

  // Convert PeriodValue to fetch params
  const getFetchParams = useCallback((value: PeriodValue) => {
    switch (value.type) {
      case "hari":
        return { dateFilter: value.date };
      case "bulan":
        return { monthFilter: value.month };
      case "tahun":
        return { yearFilter: value.year };
      case "custom":
        if (value.range?.start && value.range?.end) {
          return { customRange: value.range };
        }
        return {};
      default:
        return {};
    }
  }, []);

  // Debounced fetch with cache
  const fetchWithPeriod = useCallback((value: PeriodValue) => {
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    
    fetchTimeoutRef.current = setTimeout(async () => {
      const cacheKey = getCacheKey(value, branchId);
      
      // Check cache first
      const cached = getCachedData(cacheKey);
      if (cached) {
        useTransactionStore.setState({ 
          transactions: cached.transactions, 
          analytics: cached.analytics,
          loading: false 
        });
        return;
      }
      
      try {
        const params = getFetchParams(value);
        await fetch(
          params.dateFilter,
          branchId,
          params.monthFilter,
          params.yearFilter,
          params.customRange
        );
        
        // Cache the result
        const state = useTransactionStore.getState();
        setCachedData(cacheKey, state.transactions, state.analytics);
      } catch (err) {
        console.error("Fetch error:", err);
        toast.error("Gagal memuat data");
      }
    }, 300);
  }, [fetch, branchId, getFetchParams]);

  // Handle period change
  const handlePeriodChange = useCallback((value: PeriodValue) => {
    setPeriodValue(value);
    fetchWithPeriod(value);
  }, [fetchWithPeriod]);

  // Initial fetch
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchWithPeriod(DEFAULT_PERIOD);
    }
    
    const cleanup = realtimeService;
    const ids = [
      cleanup.subscribe("layanan", "INSERT", () => {
        transactionCache.clear();
        fetchWithPeriod(periodValue);
      }),
      cleanup.subscribe("layanan", "UPDATE", () => {
        transactionCache.clear();
        fetchWithPeriod(periodValue);
      }),
      cleanup.subscribe("layanan", "DELETE", () => {
        transactionCache.clear();
        fetchWithPeriod(periodValue);
      }),
    ];
    return () => ids.forEach((id) => cleanup.unsubscribe(id));
  }, [fetchWithPeriod, periodValue]);

  // Listen retry upload
  useEffect(() => {
    const handler = (e: any) => {
      const txId = e.detail?.txId;
      if (!txId) return;
      const tx = useTransactionStore.getState().transactions.find((t: any) => t.id === txId);
      if (tx) {
        setEditData(tx);
        setShowEditForm(true);
        toast.success("Foto akan di-upload ulang. Klik Simpan untuk melanjutkan.", { duration: 4000 });
      }
    };
    window.addEventListener("layanan-retry-upload", handler);
    return () => window.removeEventListener("layanan-retry-upload", handler);
  }, []);

  // Auto-open popup pengeluaran bila ada draft tersimpan
  useEffect(() => {
    const handler = () => setShowExpenseForm(true);
    window.addEventListener("open-expense-form", handler);
    return () => window.removeEventListener("open-expense-form", handler);
  }, []);

  const filteredTransactions = useMemo(() => transactions, [transactions]);
  const filteredAnalytics = useMemo(() => computeAnalytics(filteredTransactions), [filteredTransactions]);

  const BarItem = ({ label, value, pct, onClick }: { label: string; value: string | number; pct: number; onClick?: () => void }) => (
    <div className={`flex items-center gap-1.5 md:gap-2 ${onClick ? "cursor-pointer hover:bg-slate-100 rounded px-1 md:px-1.5 -mx-1 transition-colors" : ""}`} onClick={onClick}>
      {onClick && <Search className="w-2.5 h-2.5 md:w-3 md:h-3 text-slate-300 flex-shrink-0" />}
      <span className="text-[10px] md:text-sm text-slate-600 truncate flex-1">{label}</span>
      <span className="text-[10px] md:text-sm font-semibold text-slate-900 flex-shrink-0">{value}</span>
      <span className="text-[9px] md:text-xs text-slate-400 w-7 md:w-8 text-right flex-shrink-0">{pct}%</span>
    </div>
  );

  const openFilterModal = useCallback((title: string, filterFn: (item: any) => boolean, statusFilter?: string) => {
    setFilterModal({ title, filtered: filteredTransactions.filter(filterFn) });
    if (statusFilter) {
      setActiveStatusFilter(statusFilter);
    }
  }, [filteredTransactions]);

  const handleEdit = useCallback((item: any) => {
    setEditData(item);
    setShowEditForm(true);
  }, []);

  const topStaff = useMemo(
    () => Object.entries(filteredAnalytics.staffStats)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 5),
    [filteredAnalytics.staffStats],
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
            ) : filterModal.filtered.map((tx, i) => {
              const isExpense = tx.items?.some((it: any) => it.jenis_layanan === "pengeluaran");
              return (
                <div key={`${tx.id}-${i}`} className={`p-3 rounded-xl border ${isExpense ? "border-red-200 bg-red-50" : "border-slate-200 bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`font-semibold text-sm ${isExpense ? "text-red-700" : "text-slate-900"}`}>{tx.customer_name}</span>
                    <span className={`text-xs font-medium ${isExpense ? "text-red-600" : "text-emerald-600"}`}>{formatRupiah(
                      filterModal.filterType === 'jenis' && filterModal.filterKey
                        ? tx.items?.filter((it: any) => it.jenis_layanan === filterModal.filterKey)
                          .reduce((s: number, it: any) => s + it.skus.reduce((ss: number, sk: any) => ss + (sk.nominal || 0), 0), 0) || 0
                        : filterModal.filterType === 'metode' && filterModal.filterKey && tx.split_payment
                          ? (tx.metode_pembayaran_1 === filterModal.filterKey ? (tx.nominal_1 || 0) : 0)
                            + (tx.metode_pembayaran_2 === filterModal.filterKey ? (tx.nominal_2 || 0) : 0)
                          : tx.items?.reduce((s: number, it: any) => s + it.skus.reduce((ss: number, sk: any) => ss + (sk.nominal || 0), 0), 0) || 0
                    )}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                    {!isExpense && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{tx.customer_whatsapp || "-"}</span>}
                    <span>{tx.items?.map((it: any) => it.jenis_layanan).join(", ") || tx.jenis_layanan}</span>
                    <span>{new Date(tx.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    {tx.handled_by_name && <span>{tx.handled_by_name}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Desktop Header */}
      <div className="hidden sm:flex items-start justify-between gap-4 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Total Pendapatan</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{formatRupiah(filteredAnalytics.totalRevenue)}</p>
          <div className="flex items-center gap-2 text-xs mt-0.5">
            <span className={`font-semibold ${filteredAnalytics.netRevenue >= 0 ? "text-emerald-600" : "text-red-600"}`}>Net: {formatRupiah(filteredAnalytics.netRevenue)}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Peng: {formatRupiah(filteredAnalytics.totalExpenses)}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {!readOnly && (
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
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {!branchIdProp && <BranchSelector />}
            <PeriodFilter
              value={periodValue}
              onChange={handlePeriodChange}
              showReset={true}
            />
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <div className="sm:hidden space-y-2 flex-shrink-0">
        <p className="text-[10px] font-semibold text-slate-400 uppercase">Total Pendapatan</p>
        <p className="text-xl font-bold text-slate-900">{formatRupiah(filteredAnalytics.totalRevenue)}</p>
        <div className="flex items-center gap-2 text-[11px]">
          <span className={`font-semibold ${filteredAnalytics.netRevenue >= 0 ? "text-emerald-600" : "text-red-600"}`}>Net: {formatRupiah(filteredAnalytics.netRevenue)}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500">Peng: {formatRupiah(filteredAnalytics.totalExpenses)}</span>
        </div>
        
        {/* Mobile Filter */}
        <div className="flex items-center gap-2">
          <PeriodFilter
            value={periodValue}
            onChange={handlePeriodChange}
            showReset={true}
          />
        </div>
        
        {!readOnly && (
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
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 flex-shrink-0">
        {[
          { label: "Pemasukan", value: formatRupiah(filteredAnalytics.totalRevenue), color: "green" },
          { label: "Pengeluaran", value: formatRupiah(filteredAnalytics.totalExpenses), color: "red" },
          { label: "Transaksi", value: filteredAnalytics.total, color: "blue" },
          { label: "Net", value: formatRupiah(filteredAnalytics.netRevenue), color: filteredAnalytics.netRevenue >= 0 ? "green" : "red" },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg md:rounded-xl py-2 md:py-4 px-3 md:px-5 border border-slate-200 shadow-sm">
            <p className="text-[10px] md:text-xs font-medium text-slate-400 uppercase">{card.label}</p>
            <p className={`text-sm md:text-lg font-bold ${card.color === "red" ? "text-red-600" : "text-slate-900"}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Analytics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3 flex-shrink-0">
        <div className="bg-white rounded-lg md:rounded-xl py-2 md:py-4 px-3 md:px-5 border border-slate-200 shadow-sm">
          <p className="text-[10px] md:text-sm font-bold text-blue-600 uppercase mb-1 md:mb-2">Jenis Layanan</p>
          <div className="space-y-0.5 md:space-y-1">
            {Object.entries(filteredAnalytics.jenisCount).sort(([, a], [, b]) => b - a).slice(0, 4).map(([key, val]) => {
              const revenue = filteredAnalytics.jenisRevenue?.[key] || 0;
              const pct = filteredAnalytics.total > 0 ? Math.round(Number(val) / filteredAnalytics.total * 100) : 0;
              const label = jenisLayananLabels[key] || key;
              return <BarItem key={key} label={`${label} (${val}x)`} value={formatRupiah(Number(revenue))} pct={pct}
                onClick={() => setFilterModal({
                  title: `Jenis: ${label}`,
                  filtered: filteredTransactions.filter((item) => {
                    if (item.items?.length) return item.items.some((it: any) => it.jenis_layanan === key);
                    return (item as any).jenis_layanan === key;
                  }),
                  filterKey: key,
                  filterType: 'jenis',
                })} />;
            })}
          </div>
        </div>
        <div className="bg-white rounded-lg md:rounded-xl py-2 md:py-4 px-3 md:px-5 border border-slate-200 shadow-sm">
          <p className="text-[10px] md:text-sm font-bold text-indigo-600 uppercase mb-1 md:mb-2">Status</p>
          <div className="grid grid-cols-3 gap-1.5 md:gap-2">
            <div className="text-center md:text-left py-1.5 md:py-3 px-1 md:px-2 bg-slate-50 rounded border border-slate-200">
              <p className="text-sm md:text-lg font-bold text-slate-900">{filteredAnalytics.total}</p>
              <p className="text-[9px] md:text-xs text-slate-400">Total</p>
            </div>
            <div className="text-center md:text-left py-1.5 md:py-3 px-1 md:px-2 bg-amber-50 rounded border border-amber-200 cursor-pointer hover:bg-amber-100"
              onClick={() => openFilterModal("Waiting (Aktif)", (item) => item.status === "active", "active")}>
              <p className="text-sm md:text-lg font-bold text-amber-700">{filteredAnalytics.active}</p>
              <p className="text-[9px] md:text-xs text-amber-600">Active</p>
            </div>
            <div className="text-center md:text-left py-1.5 md:py-3 px-1 md:px-2 bg-green-50 rounded border border-green-200 cursor-pointer hover:bg-green-100"
              onClick={() => openFilterModal("Done (Selesai)", (item) => item.status === "completed", "completed")}>
              <p className="text-sm md:text-lg font-bold text-green-700">{filteredAnalytics.completed}</p>
              <p className="text-[9px] md:text-xs text-green-600">Done</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg md:rounded-xl py-2 md:py-4 px-3 md:px-5 border border-slate-200 shadow-sm">
          <p className="text-[10px] md:text-sm font-bold text-purple-600 uppercase mb-1 md:mb-2">Staff</p>
          <div className="space-y-0.5 md:space-y-1">
            {(() => {
              const totalStaffCount = Object.values(filteredAnalytics.staffStats).reduce((s, x) => s + x.count, 0);
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
            {Object.entries(filteredAnalytics.metodeRevenue).sort(([, a], [, b]) => Number(b) - Number(a)).slice(0, 4).map(([key, val]) => {
              const totalMethodCount = Object.values(filteredAnalytics.metodeCount).reduce((s, v) => s + v, 0);
              const methodCount = filteredAnalytics.metodeCount[key] || 0;
              const pct = totalMethodCount > 0 ? Math.round(methodCount / totalMethodCount * 100) : 0;
              return <BarItem key={key} label={paymentLabels[key] || key} value={formatRupiah(Number(val))} pct={pct}
                onClick={() => setFilterModal({
                  title: `Method: ${paymentLabels[key] || key}`,
                  filtered: filteredTransactions.filter((item) => {
                    if (item.split_payment) {
                      return item.metode_pembayaran_1 === key || item.metode_pembayaran_2 === key;
                    }
                    return (item.metode_pembayaran || "unknown") === key;
                  }),
                  filterKey: key,
                  filterType: 'metode',
                })} />;
            })}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="w-full">
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-slate-500" />
              <h3 className="text-xs font-bold text-slate-900">Daftar Transaksi</h3>
            </div>
            <span className="text-[10px] font-medium text-slate-400">{filteredAnalytics.total} total</span>
          </div>
          <div className="w-full">
            {loading ? (
              <LoadingSpinner />
            ) : (
              <LayananList isAdmin={true} readOnly={readOnly} compact={false} statusFilter={activeStatusFilter} onEdit={readOnly ? undefined : handleEdit} />
            )}
          </div>
        </div>
      </div>

      <FilterModal />
      
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
          <LayananForm onSuccess={() => setShowAddForm(false)} onClose={() => setShowAddForm(false)} defaultBranchId={defaultBranchId} />
        </div>
      )}
      {showExpenseForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
          <PengeluaranForm onSuccess={() => setShowExpenseForm(false)} onClose={() => setShowExpenseForm(false)} />
        </div>
      )}
      {showEditForm && editData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
          {editData.items?.[0]?.jenis_layanan === "pengeluaran" || editData.jenis_layanan === "pengeluaran" ? (
            <PengeluaranForm initialData={editData} onSuccess={() => { setShowEditForm(false); setEditData(null); }} onClose={() => { setShowEditForm(false); setEditData(null); }} />
          ) : (
            <LayananForm initialData={editData} onSuccess={() => { setShowEditForm(false); setEditData(null); }} onClose={() => { setShowEditForm(false); setEditData(null); }} defaultBranchId={defaultBranchId} />
          )}
        </div>
      )}
      {showCashdrawForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
          <CashdrawForm onSuccess={() => setShowCashdrawForm(false)} onClose={() => setShowCashdrawForm(false)} />
        </div>
      )}
    </div>
  );
}
