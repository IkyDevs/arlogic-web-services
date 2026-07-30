"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw,
  X,
  Plus,
  Camera,
} from "lucide-react";
import toast from "react-hot-toast";
import { useTransactionStore } from "@/stores/transaction-store";
import { realtimeService } from "@/lib/realtime";
import {
  formatRupiah,
  mapLegacyTransaction,
  calculateTransactionTotal,
  type TransactionData,
  type TransactionServiceItem,
  type SKUItem,
} from "@/lib/transaction-service";
import {
  jenisLayananLabels,
  metodePembayaranLabels,
  leadSourceLabels,
} from "@/types";

interface LayananListProps {
  isAdmin?: boolean;
  compact?: boolean;
  dateFilter?: string;
  onEdit?: (layanan: any) => void;
}

const jenisLayananOptions = [
  { value: "ambil_jam_service", label: "Ambil Jam Service" },
  { value: "order_online", label: "Order Online" },
  { value: "beli_jam", label: "Beli Jam" },
  { value: "service_langsung", label: "Service Langsung" },
  { value: "pengeluaran", label: "Pengeluaran" },
  { value: "cashdraw", label: "Cashdraw" },
];

function getJenisStyle(jenis: string): string {
  const styles: Record<string, string> = {
    ambil_jam_service: "bg-blue-100 text-blue-700 border-blue-200",
    order_online: "bg-amber-100 text-amber-700 border-amber-200",
    beli_jam: "bg-emerald-100 text-emerald-700 border-emerald-200",
    dp_service: "bg-purple-100 text-purple-700 border-purple-200",
    service_langsung: "bg-slate-100 text-slate-700 border-slate-200",
    pengeluaran: "bg-red-100 text-red-700 border-red-200",
    cashdraw: "bg-emerald-100 text-emerald-700 border-emerald-200",
  };
  return styles[jenis] || "bg-slate-100 text-slate-700 border-slate-200";
}

function PhotoGalleryModal({
  photos,
  onClose,
}: {
  photos: string[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-slate-950 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
            Foto Transaksi
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400 dark:text-slate-500" />
          </button>
        </div>
        <div className="p-4">
          <div className="bg-black flex items-center justify-center min-h-[300px] rounded-xl overflow-hidden">
            <img
              src={photos[index]}
              alt={`Foto ${index + 1}`}
              className="max-w-full max-h-[500px] object-contain"
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-500 dark:text-slate-400">
              Foto {index + 1} dari {photos.length}
            </span>
            <div className="flex gap-2">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  className={`w-12 h-12 rounded-lg overflow-hidden border-2 ${i === index ? "border-gray-900 dark:border-white" : "border-gray-200 dark:border-slate-700"} hover:border-gray-400 dark:hover:border-slate-500 transition-all`}
                >
                  <img
                    src={p}
                    alt={`thumb-${i}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
          {photos.length > 1 && (
            <div className="flex justify-between mt-3">
              <button
                onClick={() =>
                  setIndex((i) => (i === 0 ? photos.length - 1 : i - 1))
                }
                className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                ← Previous
              </button>
              <button
                onClick={() => setIndex((i) => (i + 1) % photos.length)}
                className="px-4 py-2 bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-lg text-xs font-medium hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function TransactionDetailModal({
  transaction,
  onClose,
}: {
  transaction: TransactionData;
  onClose: () => void;
}) {
  const total = calculateTransactionTotal(transaction.items || []);
  const photos = transaction.photo_urls || [];
  const [showPhoto, setShowPhoto] = useState(false);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white dark:bg-slate-950 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                Detail Transaksi
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {transaction.customer_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-400 dark:text-slate-500" />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50">
              <div>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Customer
                </p>
                <p className="font-semibold text-gray-900 dark:text-slate-100">
                  {transaction.customer_name}
                </p>
                {transaction.customer_whatsapp && (
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {transaction.customer_whatsapp}
                  </p>
                )}
              </div>
            </div>

            {transaction.items?.map((item, i) => (
              <div
                key={i}
                className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden"
              >
                <div
                  className={`px-4 py-2 border-b border-gray-200 dark:border-slate-700 ${getJenisStyle(item.jenis_layanan)}`}
                >
                  <span className="text-xs font-bold uppercase">
                    {jenisLayananLabels[
                      item.jenis_layanan as keyof typeof jenisLayananLabels
                    ] || item.jenis_layanan}
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  {item.skus?.map((sku, j) => (
                    <div
                      key={j}
                      className="flex items-center justify-between py-1 border-b border-gray-100 dark:border-slate-700 last:border-0"
                    >
                      <span className="text-sm text-gray-700 dark:text-slate-300">
                        {sku.sku || "-"}
                      </span>
                      <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {formatRupiah(sku.nominal)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-slate-700">
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">
                      Subtotal
                    </span>
                    <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                      {formatRupiah(
                        item.skus?.reduce((s, sku) => s + sku.nominal, 0) || 0,
                      )}
                    </span>
                  </div>
                  {item.notes && (
                    <div className="flex items-start gap-2 pt-2 border-t border-gray-100 dark:border-slate-700 mt-2">
                      <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                          Catatan
                        </p>
                        <p className="text-sm text-gray-700 dark:text-slate-300 break-words">
                          {item.notes}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between p-4 bg-slate-900 dark:bg-slate-700 rounded-xl">
              <span className="text-sm font-bold text-white dark:text-slate-100 uppercase">
                Grand Total
              </span>
              <span className="text-lg font-bold text-white dark:text-slate-100">
                {formatRupiah(total)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Pembayaran
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {transaction.split_payment
                    ? "Split Payment"
                    : metodePembayaranLabels[
                        transaction.metode_pembayaran as keyof typeof metodePembayaranLabels
                      ] || transaction.metode_pembayaran}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Staff
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {transaction.handled_by_name || "-"}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Status
                </p>
                <p
                  className={`text-sm font-semibold ${transaction.status === "active" ? "text-amber-600 dark:text-amber-400" : transaction.status === "completed" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                >
                  {transaction.status?.toUpperCase()}
                </p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Waktu
                </p>
                <p className="text-xs font-semibold text-gray-900 dark:text-slate-100">
                  {new Date(transaction.created_at || "").toLocaleDateString(
                    "id-ID",
                    {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    },
                  )}
                </p>
              </div>
            </div>

            {photos.length > 0 && (
              <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Foto ({photos.length})
                </p>
                <div className="flex gap-2 overflow-x-auto">
                  {photos.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => setShowPhoto(true)}
                      className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 flex-shrink-0 hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={p}
                        alt={`foto-${i}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {transaction.split_payment && (
              <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-900/50 space-y-1">
                <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider font-semibold">
                  Split Payment
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-300">
                    {metodePembayaranLabels[
                      transaction.metode_pembayaran_1 as keyof typeof metodePembayaranLabels
                    ] || transaction.metode_pembayaran_1}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {formatRupiah(transaction.nominal_1 || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-300">
                    {metodePembayaranLabels[
                      transaction.metode_pembayaran_2 as keyof typeof metodePembayaranLabels
                    ] || transaction.metode_pembayaran_2}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {formatRupiah(transaction.nominal_2 || 0)}
                  </span>
                </div>
              </div>
            )}

            <div className="text-center">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 dark:bg-slate-700 text-white dark:text-slate-100 font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 transition-all text-sm"
              >
                Tutup
              </button>
            </div>
          </div>
        </motion.div>
      </div>
      {showPhoto && (
        <PhotoGalleryModal
          photos={photos}
          onClose={() => setShowPhoto(false)}
        />
      )}
    </>
  );
}

export default function LayananList({
  isAdmin = false,
  compact = false,
  dateFilter,
  onEdit,
}: LayananListProps) {
  const { transactions, loading, updateStatus, remove } = useTransactionStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterJenis, setFilterJenis] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMetode, setFilterMetode] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [detailTx, setDetailTx] = useState<TransactionData | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [photoGallery, setPhotoGallery] = useState<string[] | null>(null);

  const filtered = useMemo(() => {
    let data = transactions;
    if (dateFilter) {
      data = data.filter((d) => d.created_at?.startsWith(dateFilter));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (t) =>
          t.customer_name.toLowerCase().includes(q) ||
          t.customer_whatsapp?.includes(q) ||
          t.items?.some(
            (i) =>
              i.jenis_layanan.toLowerCase().includes(q) ||
              i.skus?.some((s) => s.sku.toLowerCase().includes(q)),
          ),
      );
    }
    if (filterJenis) {
      data = data.filter((t) =>
        t.items?.some((i) => i.jenis_layanan === filterJenis),
      );
    }
    if (filterStatus) {
      data = data.filter((t) => t.status === filterStatus);
    }
    if (filterMetode) {
      data = data.filter((t) => t.metode_pembayaran === filterMetode);
    }
    return data;
  }, [
    transactions,
    dateFilter,
    searchQuery,
    filterJenis,
    filterStatus,
    filterMetode,
  ]);

  const handleDelete = async (item: TransactionData) => {
    const total = calculateTransactionTotal(item.items || []);
    console.log('[DEBUG:LayananList] handleDelete START', {
      item_id: item.id,
      customer_name: item.customer_name,
      telegram_chat_id: (item as any).telegram_chat_id,
      telegram_message_id: (item as any).telegram_message_id,
      upload_status: (item as any).upload_status,
      photo_urls: (item as any).photo_urls,
      will_delete_telegram: !!((item as any).telegram_chat_id && (item as any).telegram_message_id),
    });
    if (
      !confirm(
        `Hapus transaksi "${item.customer_name}" (${formatRupiah(total)})?`,
      )
    )
      return;

    if ((item as any).telegram_chat_id && (item as any).telegram_message_id) {
      try {
        console.log('[DEBUG:LayananList] Calling delete-message API', {
          chat_id: (item as any).telegram_chat_id,
          message_id: (item as any).telegram_message_id,
        });
        const deleteRes = await fetch("/api/telegram/delete-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: (item as any).telegram_chat_id,
            message_id: (item as any).telegram_message_id,
          }),
        });
        const deleteData = await deleteRes.text();
        console.log('[DEBUG:LayananList] delete-message response', {
          status: deleteRes.status,
          body: deleteData,
        });
      } catch (e) {
        console.error('[DEBUG:LayananList] delete-message FAILED', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
    } else {
      console.log('[DEBUG:LayananList] SKIP delete-message - missing chat_id or message_id', {
        chat_id: (item as any).telegram_chat_id,
        message_id: (item as any).telegram_message_id,
      });
    }
    try {
      console.log('[DEBUG:LayananList] Calling store.remove', { id: item.id });
      await remove(item.id!);
      toast.success("Transaksi berhasil dihapus");
    } catch (err: any) {
      toast.error("Gagal hapus: " + err.message);
    }
  };

  const handleStatusUpdate = async (
    id: string,
    status: "completed" | "cancelled",
  ) => {
    try {
      await updateStatus(id, status);
      toast.success(`Status updated to ${status.toUpperCase()}`);
    } catch (err: any) {
      toast.error("Gagal update status: " + err.message);
    }
  };

  const handleExport = () => {
    const headers = [
      "Date",
      "Customer",
      "WhatsApp",
      "Service Types",
      "Handled By",
      "Payment",
      "Lead Source",
      "SKUs",
      "Amount",
      "Status",
    ];
    const rows = filtered.map((tx) => [
      new Date(tx.created_at || "").toLocaleDateString("id-ID"),
      tx.customer_name,
      tx.customer_whatsapp,
      tx.items
        ?.map(
          (i) =>
            jenisLayananLabels[
              i.jenis_layanan as keyof typeof jenisLayananLabels
            ] || i.jenis_layanan,
        )
        .join(", ") || "",
      tx.handled_by_name,
      tx.split_payment
        ? "Split Payment"
        : metodePembayaranLabels[
            tx.metode_pembayaran as keyof typeof metodePembayaranLabels
          ] || tx.metode_pembayaran,
      tx.lead_source === "tulis_sendiri"
        ? tx.lead_source_custom
        : leadSourceLabels[tx.lead_source as keyof typeof leadSourceLabels],
      tx.items
        ?.flatMap((i) => i.skus?.map((s) => s.sku))
        .filter(Boolean)
        .join(", ") || "-",
      calculateTransactionTotal(tx.items || []),
      tx.status?.toUpperCase(),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  };

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
            <span>Filters</span>
            {showFilters ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-sm font-medium"
          >
            Export
          </button>
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3"
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
                {jenisLayananOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
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
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="">All</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                Payment
              </label>
              <select
                value={filterMetode}
                onChange={(e) => setFilterMetode(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="">All</option>
                {Object.entries(metodePembayaranLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customer / SKU
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                  Handled
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  Lead Source
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider hidden md:table-cell">
                  Payment
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Photo
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                {isAdmin && (
                  <th className="px-3 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.map((tx, idx) => {
                const total = calculateTransactionTotal(tx.items || []);
                const isExpanded = expandedRows.has(tx.id!);
                const allJenis =
                  tx.items?.map(
                    (i) =>
                      jenisLayananLabels[
                        i.jenis_layanan as keyof typeof jenisLayananLabels
                      ] || i.jenis_layanan,
                  ) || [];
                const allSkus = tx.items?.flatMap((i) => i.skus || []) || [];
                const showExpand =
                  (tx.items?.length || 0) > 1 || allSkus.length > 1;
                const photos = tx.photo_urls || [];

                return (
                  <motion.tr
                    key={tx.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`hover:bg-slate-50 transition-all ${isExpanded ? "bg-slate-50" : ""}`}
                  >
                    <td className="px-3 py-3 text-xs">
                      <p className="font-medium">
                        {new Date(tx.created_at || "").toLocaleDateString(
                          "id-ID",
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(tx.created_at || "").toLocaleTimeString(
                          "id-ID",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-xs sm:text-sm">
                        {tx.customer_name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {tx.customer_whatsapp}
                      </p>
                      <div className="mt-1 space-y-0.5">
                        {allSkus.length > 0 &&
                          (isExpanded ? (
                            allSkus.map((s, i) => (
                              <p
                                key={i}
                                className="text-[10px] text-slate-500 leading-tight"
                              >
                                • {s.sku || "-"}{" "}
                                <span className="text-blue-500 font-medium">
                                  {formatRupiah(s.nominal)}
                                </span>
                              </p>
                            ))
                          ) : (
                            <p className="text-[10px] text-slate-500 truncate max-w-[200px]">
                              • {allSkus[0]?.sku || "-"}{" "}
                              {allSkus.length > 1 &&
                                `+${allSkus.length - 1} lainnya`}
                            </p>
                          ))}
                      </div>
                    </td>
                    <td
                      className="px-3 py-3 cursor-pointer"
                      onClick={() => setDetailTx(tx)}
                    >
                      <div className="flex flex-col gap-0.5">
                        {isExpanded ? (
                          allJenis.map((j, i) => (
                            <span
                              key={i}
                              className={`badge text-[10px] ${getJenisStyle(tx.items?.[i]?.jenis_layanan || "")}`}
                            >
                              {j}
                            </span>
                          ))
                        ) : (
                          <span
                            className={`badge text-[10px] ${getJenisStyle(tx.items?.[0]?.jenis_layanan || "")}`}
                          >
                            {allJenis[0]}
                            {allJenis.length > 1
                              ? ` +${allJenis.length - 1}`
                              : ""}
                          </span>
                        )}
                      </div>
                      {showExpand && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRows((prev) => {
                              const n = new Set(prev);
                              n.has(tx.id!) ? n.delete(tx.id!) : n.add(tx.id!);
                              return n;
                            });
                          }}
                          className="text-[10px] text-blue-500 hover:underline mt-1 flex items-center gap-0.5"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                          {isExpanded ? "Sembunyikan" : "Expand"}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs hidden sm:table-cell">
                      {tx.handled_by_name || "-"}
                    </td>
                    <td className="px-3 py-3 text-xs hidden md:table-cell">
                      <span className="text-slate-600 font-medium">
                        {tx.lead_source === "tulis_sendiri"
                          ? tx.lead_source_custom
                          : leadSourceLabels[
                              tx.lead_source as keyof typeof leadSourceLabels
                            ] || tx.lead_source}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs hidden md:table-cell">
                      {tx.split_payment ? (
                        <button
                          onClick={() => setDetailTx(tx)}
                          className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all text-xs font-medium border border-purple-200 cursor-pointer"
                        >
                          Split Payment
                        </button>
                      ) : (
                        metodePembayaranLabels[
                          tx.metode_pembayaran as keyof typeof metodePembayaranLabels
                        ] || tx.metode_pembayaran
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-blue-600 text-xs sm:text-sm whitespace-nowrap">
                      {formatRupiah(total)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {photos.length > 0 ? (
                        <button
                          onClick={() => setPhotoGallery(photos)}
                          className="px-2 py-1 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all text-[10px] font-medium flex items-center gap-1 mx-auto"
                        >
                          <Camera className="w-3 h-3" /> {photos.length}
                        </button>
                      ) : tx.upload_status === 'FAILED' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Failed
                        </span>
                      ) : tx.upload_status === 'UPLOADING' || tx.upload_status === 'PENDING' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          Processing
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`badge text-[10px] ${tx.status === "active" ? "badge-warning" : tx.status === "completed" ? "badge-success" : "badge-danger"}`}
                      >
                        {tx.status?.toUpperCase()}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-3 py-3">
                        <div className="flex gap-1 justify-center">
                          <button
                            onClick={() => setDetailTx(tx)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {tx.status === "active" && (
                            <>
                              <button
                                onClick={() =>
                                  handleStatusUpdate(tx.id!, "completed")
                                }
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                title="Complete"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleStatusUpdate(tx.id!, "cancelled")
                                }
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                title="Cancel"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => onEdit?.(tx)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Edit"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-400 font-medium">No transactions found</p>
          </div>
        )}
      </div>

      {detailTx && (
        <TransactionDetailModal
          transaction={detailTx}
          onClose={() => setDetailTx(null)}
        />
      )}
      {photoGallery && (
        <PhotoGalleryModal
          photos={photoGallery}
          onClose={() => setPhotoGallery(null)}
        />
      )}
    </div>
  );
}
