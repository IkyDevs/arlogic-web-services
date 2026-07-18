"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import {
  Layanan,
  JenisLayanan,
  jenisLayananLabels,
  metodePembayaranLabels,
  leadSourceLabels,
} from "@/types";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Calendar,
  DollarSign,
  FileText,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  TrendingUp,
  Users,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

interface LayananListProps {
  isAdmin?: boolean;
  compact?: boolean;
  dateFilter?: string;
  onEdit?: (layanan: Layanan) => void;
  onStatsUpdate?: (stats: { total: number; totalNominal: number; active: number; completed: number; jenisCount: Record<string, number>; metodeRevenue: Record<string, number> }) => void;
}

interface LayananWithPhoto extends Layanan {
  photo_url?: string;
}

export default function LayananList({
  isAdmin = false,
  compact = false,
  dateFilter,
  onEdit,
  onStatsUpdate,
}: LayananListProps) {
  const { user } = useAuthStore();
  const [layanan, setLayanan] = useState<LayananWithPhoto[]>([]);
  const [displayRows, setDisplayRows] = useState<any[]>([]);
  const [filteredLayanan, setFilteredLayanan] = useState<LayananWithPhoto[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterJenis, setFilterJenis] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMetode, setFilterMetode] = useState("");
  const [filterStaff, setFilterStaff] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalNominal, setTotalNominal] = useState(0);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [photoGalleryIndex, setPhotoGalleryIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const supabase = createClient();

  // Check if user is admin
  const isUserAdmin = user?.role === "admin";

  useEffect(() => {
    fetchLayanan();
    fetchStaffList();
  }, [dateFilter]);

  useEffect(() => {
    filterLayanan();
  }, [
    searchQuery,
    filterJenis,
    filterStatus,
    filterMetode,
    filterStaff,
    startDate,
    endDate,
    layanan,
  ]);

  const fetchStaffList = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("role", ["admin", "teknisi", "supervisor"])
      .order("full_name");
    if (data) setStaffList(data);
  };

  const buildDisplayRows = (data: any[]) => {
    const rows: any[] = [];
    for (const tx of data) {
      rows.push({ ...tx, _isItem: false });
    }
    return rows;
  };

  const fetchLayanan = async () => {
    setLoading(true);
    try {
      let query = supabase.from("layanan").select("*, layanan_items(*)");
      if (dateFilter) {
        query = query
          .gte("created_at", dateFilter + "T00:00:00")
          .lte("created_at", dateFilter + "T23:59:59");
      }
      query = query.order("created_at", { ascending: false }).limit(200);
      const res = await query;
      if (res.error) {
        // Fallback tanpa join jika tabel layanan_items belum ada
        let fallback = supabase.from("layanan").select("*");
        if (dateFilter) {
          fallback = fallback
            .gte("created_at", dateFilter + "T00:00:00")
            .lte("created_at", dateFilter + "T23:59:59");
        }
        const fb = await fallback.order("created_at", { ascending: false }).limit(200);
        if (fb.data) {
          setLayanan(fb.data);
          const rows = buildDisplayRows(fb.data);
          setDisplayRows(rows);
          setFilteredLayanan(rows);
          calculateTotal(rows);
        }
      } else if (res.data) {
        setLayanan(res.data);
        const rows = buildDisplayRows(res.data);
        setDisplayRows(rows);
        setFilteredLayanan(rows);
        calculateTotal(rows);
      }
    } catch (err) {
      console.error("Gagal fetch layanan:", err);
    }
    setLoading(false);
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchLayanan();
    setRefreshing(false);
    toast.success("Data refreshed");
  };

  const emitStats = (data: any[]) => {
    let total = 0, totalRevenue = 0, totalExpenses = 0;
    const jenisCount: Record<string, number> = {};
    const metodeRevenue: Record<string, number> = {};
    let active = 0, completed = 0;
    for (const item of data) {
      if (item.status === "active") active++;
      if (item.status === "completed") completed++;
      const j = item.jenis_layanan || "Lainnya";
      jenisCount[j] = (jenisCount[j] || 0) + 1;
      const nominal = item.nominal || 0;
      total += nominal;
      if (item.jenis_layanan === "pengeluaran") totalExpenses += nominal;
      else totalRevenue += nominal;
      const m = item.metode_pembayaran || "unknown";
      metodeRevenue[m] = (metodeRevenue[m] || 0) + (item.jenis_layanan === "pengeluaran" ? -nominal : nominal);
    }
    const netTotal = totalRevenue - totalExpenses;
    onStatsUpdate?.({ total: data.length, totalNominal: netTotal, active, completed, jenisCount, metodeRevenue });
    setTotalNominal(netTotal);
  };

  const calculateTotal = (data: LayananWithPhoto[]) => {
    emitStats(data);
  };

  const filterLayanan = () => {
    let filtered = [...displayRows];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.customer_name.toLowerCase().includes(query) ||
          item.customer_whatsapp.includes(query) ||
          item.detail_sku?.toLowerCase().includes(query) ||
          item.handled_by_name?.toLowerCase().includes(query),
      );
    }

    if (filterJenis) {
      filtered = filtered.filter((item) => item.jenis_layanan === filterJenis);
    }

    if (filterStatus) {
      filtered = filtered.filter((item) => item.status === filterStatus);
    }

    if (filterMetode) {
      filtered = filtered.filter(
        (item) => item.metode_pembayaran === filterMetode,
      );
    }

    if (filterStaff) {
      filtered = filtered.filter((item) => item.handled_by === filterStaff);
    }

    if (startDate) {
      filtered = filtered.filter(
        (item) => new Date(item.created_at) >= new Date(startDate),
      );
    }

    if (endDate) {
      filtered = filtered.filter(
        (item) => new Date(item.created_at) <= new Date(endDate + "T23:59:59"),
      );
    }

    setFilteredLayanan(filtered);
    calculateTotal(filtered);
  };

  const updateStatus = async (
    id: string,
    status: "cancelled" | "completed",
  ) => {
    const { error } = await supabase
      .from("layanan")
      .update({ status })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(
        `Status updated to ${status === "completed" ? "COMPLETED" : "CANCELLED"}`,
      );
      fetchLayanan();
    }
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Hapus transaksi "${item.customer_name}" (Rp ${Number(item.nominal).toLocaleString("id-ID")})?`)) return;

    // Hapus pesan Telegram jika ada
    if (item.telegram_chat_id && item.telegram_message_id) {
      try {
        await fetch("/api/telegram/delete-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: item.telegram_chat_id,
            message_id: item.telegram_message_id,
          }),
        });
      } catch (e) {
        console.warn("Gagal hapus pesan Telegram:", e);
      }
    }

    const { error } = await supabase.from("layanan").delete().eq("id", item.id);
    if (error) {
      toast.error("Gagal hapus transaksi: " + error.message);
    } else {
      toast.success("Transaksi berhasil dihapus");
      fetchLayanan();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <span className="badge badge-warning">Active</span>;
      case "completed":
        return <span className="badge badge-success">Completed</span>;
      case "cancelled":
        return <span className="badge badge-danger">Cancelled</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const getJenisLayananStyle = (jenis: string) => {
    const styles: Record<string, string> = {
      ambil_jam_service: "badge-info",
      order_online: "badge-warning",
      beli_jam: "badge-success",
      pengeluaran: "badge-danger",
      dp_service: "badge-primary",
      service_langsung: "badge-neutral",
      cashdraw: "badge-success",
    };
    return styles[jenis] || "badge-neutral";
  };

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(nominal);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Customer",
      "WhatsApp",
      "Service Type",
      "Handled By",
      "Payment Method",
      "Lead Source",
      "SKU",
      "Amount",
      "Status",
      "Notes",
    ];
    const rows = filteredLayanan.map((item) => [
      formatDate(item.created_at),
      item.customer_name,
      item.customer_whatsapp,
      jenisLayananLabels[item.jenis_layanan as JenisLayanan] || item.jenis_layanan,
      item.handled_by_name,
      metodePembayaranLabels[item.metode_pembayaran] || item.metode_pembayaran,
      item.lead_source === "tulis_sendiri"
        ? item.lead_source_custom
        : leadSourceLabels[item.lead_source],
      item.detail_sku || "-",
      item.nominal,
      item.status === "active"
        ? "ACTIVE"
        : item.status === "completed"
          ? "COMPLETED"
          : "CANCELLED",
      item.notes || "-",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `transactions_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported!");
  };

  const resetFilters = () => {
    setSearchQuery("");
    setFilterJenis("");
    setFilterStatus("");
    setFilterMetode("");
    setFilterStaff("");
    setStartDate("");
    setEndDate("");
    toast.success("Filters reset");
  };

  const jenisLayananOptions = [
    { value: "ambil_jam_service", label: "Ambil Jam Service" },
    { value: "order_online", label: "Order Online" },
    { value: "beli_jam", label: "Beli Jam" },
    { value: "service_langsung", label: "Service Langsung" },
    { value: "pengeluaran", label: "Pengeluaran" },
    { value: "cashdraw", label: "Cashdraw" },
  ];

  const metodePembayaranOptions = [
    { value: "cash", label: "Cash" },
    { value: "qris", label: "QRIS" },
    { value: "edc", label: "EDC" },
    { value: "transfer", label: "Transfer" },
    { value: "edc_mandiri", label: "EDC Mandiri" },
    { value: "tf_bca", label: "Transfer BCA" },
    { value: "bri", label: "BRI" },
    { value: "kudus", label: "Kudus" },
    { value: "edc_bca", label: "EDC BCA" },
    { value: "tf_mandiri", label: "Transfer Mandiri" },
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center shadow-sm">
        <div className="inline-block w-8 h-8 border border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-slate-400 font-medium">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">


      {/* ==================== SEARCH & FILTER ==================== */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 md:p-5 shadow-sm">
        <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
                placeholder="Name / WA / SKU..."
              />
            </div>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium"
          >
            <Filter className="w-4 h-4" />
            Filters
            {showFilters ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            Export
          </button>

          <button
            onClick={refreshData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
          >
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Service Type
              </label>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              >
                <option value="">All</option>
                {jenisLayananOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Payment Method
              </label>
              <select
                value={filterMetode}
                onChange={(e) => setFilterMetode(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              >
                <option value="">All</option>
                {metodePembayaranOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Staff / Handler
              </label>
              <select
                value={filterStaff}
                onChange={(e) => setFilterStaff(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              >
                <option value="">All</option>
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name} ({staff.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all text-sm"
              />
            </div>
            <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-6 flex justify-end">
              <button
                onClick={resetFilters}
                className="text-sm text-blue-600 hover:underline font-medium"
              >
                Reset Filters
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ==================== TABLE ==================== */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Customer
                </th>
                <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Type
                </th>
                <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Handled
                </th>
                <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Payment
                </th>
                <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Amount
                </th>
                <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Photo
                </th>
                <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                {isUserAdmin && (
                  <th className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLayanan.map((item, index) => (
                <motion.tr
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-slate-50 transition-all"
                >
                  <td className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-xs">
                    <p className="font-medium">
                      {new Date(item.created_at).toLocaleDateString("id-ID")}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(item.created_at).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 whitespace-nowrap">
                    <p className="font-medium text-xs sm:text-sm dark:text-white">{item.customer_name}</p>
                    <p className="text-[10px] sm:text-xs text-slate-400 dark:!text-slate-300">
                      {item.customer_whatsapp}
                    </p>
                    {item.detail_sku && (
                      <p className="text-[10px] text-slate-400 dark:!text-slate-300 mt-0.5 max-w-[180px] whitespace-normal break-words">
                        SKU: {item.detail_sku}
                      </p>
                    )}
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 whitespace-nowrap">
                    <span
                      className={`badge text-[10px] sm:text-xs ${getJenisLayananStyle(item.jenis_layanan)}`}
                    >
                      {jenisLayananLabels[item.jenis_layanan as JenisLayanan] || item.jenis_layanan}
                    </span>
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-xs sm:text-sm whitespace-nowrap">
                    {item.handled_by_name || "-"}
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 text-xs sm:text-sm whitespace-nowrap">
                    {metodePembayaranLabels[item.metode_pembayaran] || item.metode_pembayaran}
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 font-bold text-blue-600 whitespace-nowrap text-xs sm:text-sm md:text-base">
                    {formatRupiah(item.nominal)}
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3 whitespace-nowrap">
                    {(item as any).photo_urls &&
                    (item as any).photo_urls.length > 0 ? (
                      <button
                        onClick={() => {
                          setSelectedPhotos((item as any).photo_urls || []);
                          setPhotoGalleryIndex(0);
                        }}
                        className="px-2 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-xs font-medium"
                        title={`View ${(item as any).photo_urls.length} photos`}
                      >
                        <Eye className="w-3 h-3 inline mr-0.5" />
                        {(item as any).photo_urls.length}
                      </button>
                    ) : (item as any).photo_url ? (
                      <button
                        onClick={() => {
                          setSelectedPhotos([(item as any).photo_url]);
                          setPhotoGalleryIndex(0);
                        }}
                        className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all"
                        title="View Photo"
                      >
                        <Eye className="w-3 h-3" />
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3">
                    {getStatusBadge(item.status)}
                  </td>
                  {isUserAdmin && (
                    <td className="px-2 sm:px-3 md:px-4 py-2.5 sm:py-3">
                      <div className="flex gap-2">
                        {item.status === "active" && (
                          <>
                            <button
                              onClick={() => updateStatus(item.id, "completed")}
                              className="p-1.5 text-[#2ECC71] hover:bg-green-50 rounded-lg transition-all"
                              title="Mark as Completed"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => updateStatus(item.id, "cancelled")}
                              className="p-1.5 text-blue-600 hover:bg-red-50 rounded-lg transition-all"
                              title="Cancel"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => onEdit?.(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Hapus transaksi"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredLayanan.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 font-medium">No transactions found</p>
            <p className="text-sm text-slate-400 mt-1">
              Try adjusting your filters
            </p>
          </div>
        )}
      </div>



      {/* ==================== MODAL PREVIEW PHOTO GALLERY ==================== */}
      {selectedPhotos.length > 0 && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={() => setSelectedPhotos([])}
        >
          <div
            className="max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-xl">
              {/* Main Image */}
              <div className="bg-black flex items-center justify-center min-h-[400px] md:min-h-[500px]">
                <img
                  src={selectedPhotos[photoGalleryIndex]}
                  alt={`Photo ${photoGalleryIndex + 1}`}
                  className="max-w-full max-h-[500px] object-contain"
                />
              </div>

              {/* Navigation */}
              <div className="p-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-slate-900">
                    Photo {photoGalleryIndex + 1} of {selectedPhotos.length}
                  </p>
                  <button
                    onClick={() => setSelectedPhotos([])}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-xs font-medium"
                  >
                    Close
                  </button>
                </div>

                {/* Thumbnail Gallery */}
                {selectedPhotos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedPhotos.map((photo, index) => (
                      <button
                        key={index}
                        onClick={() => setPhotoGalleryIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                          index === photoGalleryIndex
                            ? "border-slate-900"
                            : "border-slate-200 hover:border-slate-400"
                        }`}
                      >
                        <img
                          src={photo}
                          alt={`Thumbnail ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Arrow Navigation */}
                {selectedPhotos.length > 1 && (
                  <div className="flex justify-between items-center mt-3">
                    <button
                      onClick={() =>
                        setPhotoGalleryIndex(
                          photoGalleryIndex === 0
                            ? selectedPhotos.length - 1
                            : photoGalleryIndex - 1,
                        )
                      }
                      className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
                    >
                      ← Previous
                    </button>
                    <span className="text-xs text-slate-400">
                      Use arrow keys or thumbnails to navigate
                    </span>
                    <button
                      onClick={() =>
                        setPhotoGalleryIndex(
                          (photoGalleryIndex + 1) % selectedPhotos.length,
                        )
                      }
                      className="px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition-all text-sm font-medium"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
