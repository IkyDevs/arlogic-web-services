"use client";

import { useState, useRef, useEffect } from "react";
import {
  Printer,
  X,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  RotateCcw,
  Send,
  Loader2,
} from "lucide-react";
import { formatRupiah } from "@/lib/domain/shared/formatters";
import { useBranch } from "@/lib/context/BranchContext";
import { toPng } from "html-to-image";
import toast from "react-hot-toast";

interface NotaItem {
  id: string;
  serviceName: string;
  sku: string;
  qty: number;
  nominal: number;
}

interface NotaSummaryModalProps {
  transaction: any;
  onClose: () => void;
}

export default function NotaSummaryModal({
  transaction,
  onClose,
}: NotaSummaryModalProps) {
  const { branches, activeBranch } = useBranch();
  const printRef = useRef<HTMLDivElement>(null);

  // Match branch from transaction or active branch
  const txBranch = transaction?.branch_id
    ? branches.find((b) => b.id === transaction.branch_id)
    : activeBranch;

  // ── Default State ──────────────────────────────────────────────────────────
  const [storeName, setStoreName] = useState(
    txBranch?.name || "Arlogic Jember",
  );
  const [storeAddress, setStoreAddress] = useState(
    txBranch?.address || "Jl. S.Parman 16 Sumbersari Jember",
  );
  const [storeWebsite, setStoreWebsite] = useState("www.arlogic.id");
  const [storeNpwp, setStoreNpwp] = useState("10419402026073116 5814");

  const createdDate = transaction?.created_at
    ? new Date(transaction.created_at)
    : new Date();

  const [receiptNo, setReceiptNo] = useState(
    transaction?.invoice_number ||
      (transaction?.id
        ? transaction.id.slice(0, 12)
        : `TX-${Date.now().toString().slice(-6)}`),
  );
  const [dateStr, setDateStr] = useState(
    `${createdDate.getDate()}/${createdDate.getMonth() + 1}/${createdDate.getFullYear()}`,
  );
  const [timeStr, setTimeStr] = useState(
    createdDate
      .toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      .replace(/:/g, "."),
  );
  const [kasirName, setKasirName] = useState(
    transaction?.handled_by_name || "Admin",
  );
  const [custName, setCustName] = useState(
    transaction?.customer_name || "Pelanggan",
  );

  // ── Items Initialization ────────────────────────────────────────────────
  const initialItems: NotaItem[] = (() => {
    if (
      transaction?.items &&
      Array.isArray(transaction.items) &&
      transaction.items.length > 0
    ) {
      const list: NotaItem[] = [];
      transaction.items.forEach((it: any, idx: number) => {
        const sName = (it.jenis_layanan || "Layanan").toUpperCase();
        if (it.skus && Array.isArray(it.skus) && it.skus.length > 0) {
          it.skus.forEach((s: any, sIdx: number) => {
            list.push({
              id: `${idx}-${sIdx}-${Date.now()}`,
              serviceName: sName,
              sku: s.sku || "PROD-ITEM",
              qty: s.qty || 1,
              nominal: s.nominal || 0,
            });
          });
        } else {
          list.push({
            id: `${idx}-${Date.now()}`,
            serviceName: sName,
            sku: it.detail_sku || "SERVICE-ITEM",
            qty: 1,
            nominal: it.nominal || 0,
          });
        }
      });
      return list;
    }
    // Fallback if item is single service
    return [
      {
        id: `1-${Date.now()}`,
        serviceName: (
          transaction?.jenis_layanan ||
          transaction?.category ||
          "PERBAIKAN JAM"
        ).toUpperCase(),
        sku: transaction?.watch_brand
          ? `${transaction.watch_brand}-${transaction.watch_model || "ITEM"}`
          : "AC2825BH",
        qty: 1,
        nominal: transaction?.total || transaction?.estimated_cost || 0,
      },
    ];
  })();

  const [items, setItems] = useState<NotaItem[]>(initialItems);

  // Calculate totals
  const subtotal = items.reduce(
    (sum, item) => sum + item.qty * item.nominal,
    0,
  );
  const total = subtotal;

  const [paymentMethod, setPaymentMethod] = useState(
    transaction?.split_payment
      ? "Split Payment"
      : transaction?.metode_pembayaran
        ? transaction.metode_pembayaran === "cash"
          ? "Cash"
          : transaction.metode_pembayaran.toUpperCase()
        : "Cash",
  );

  const [points, setPoints] = useState(Math.floor(total / 10000) || 25);
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor");

  // Add Item
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        serviceName: "LAYANAN TAMBAHAN",
        sku: "ITEM-NEW",
        qty: 1,
        nominal: 50000,
      },
    ]);
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Update Item
  const handleUpdateItem = (id: string, field: keyof NotaItem, value: any) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    );
  };

  // Print Handler
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Nota #${receiptNo}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              line-height: 1.3;
              margin: 0;
              padding: 10px;
              color: #000;
              background: #fff;
              width: 78mm;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .uppercase { text-transform: uppercase; }
            .divider {
              border-top: 1px dashed #000;
              margin: 8px 0;
            }
            .flex-between {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .item-row {
              margin-bottom: 4px;
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const [sendingTelegram, setSendingTelegram] = useState(false);

  const handleSendTelegram = async () => {
    if (!printRef.current) return;
    setSendingTelegram(true);
    const toastId = toast.loading(
      "Memproses Nota PNG & mengunggah ke Telegram...",
    );

    try {
      console.log("[DEBUG] Starting convertToImage...");
      const dataUrl = await toPng(printRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });
      console.log("[DEBUG] PNG dataUrl generated, length:", dataUrl.length);

      // Convert dataURL to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      console.log("[DEBUG] Blob created, size:", blob.size, "type:", blob.type);

      const formData = new FormData();
      formData.append("file", blob, `nota-${receiptNo}.png`);
      formData.append(
        "caption",
        `📋 <b>NOTA TRANSAKSI #${receiptNo}</b>\n\n🏪 <b>Cabang:</b> ${storeName}\n👤 <b>Customer:</b> ${custName}\n👤 <b>Kasir:</b> ${kasirName}\n💰 <b>Total:</b> Rp${total.toLocaleString("id-ID")}\n💳 <b>Bayar:</b> ${paymentMethod}\n⭐️ <b>Poin:</b> +${points}\n📅 <b>Tanggal:</b> ${dateStr} ${timeStr}\n\n<i>Dibuat otomatis via Arlogic System</i>`,
      );
      formData.append("branch_code", txBranch?.code || "");
      formData.append("branch_name", storeName);

      console.log(
        "[DEBUG] FormData prepared, sending to /api/telegram/send-nota...",
      );
      const apiRes = await fetch("/api/telegram/send-nota", {
        method: "POST",
        body: formData,
      });

      console.log("[DEBUG] API response status:", apiRes.status);
      const data = await apiRes.json();
      console.log("[DEBUG] API response data:", data);

      if (!apiRes.ok || !data.success) {
        throw new Error(
          data.error ||
            data.tg_response?.description ||
            "Gagal mengunggah nota ke Telegram",
        );
      }

      toast.success("Nota PNG berhasil dikirim ke Telegram Channel!", {
        id: toastId,
      });
    } catch (err: any) {
      console.error("[ERROR] Gagal kirim nota PNG ke Telegram:", err);
      toast.error(`❌ ${err.message || "Gagal mengirim nota ke Telegram"}`, {
        id: toastId,
      });
    } finally {
      setSendingTelegram(false);
    }
  };

  // Group items by serviceName for thermal display
  const groupedItems = items.reduce(
    (acc, item) => {
      const key = item.serviceName || "LAYANAN";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, NotaItem[]>,
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Buat & Cetak Nota (Receipt Editor)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile Tab Switcher */}
            <div className="flex sm:hidden border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden p-0.5 bg-slate-200 dark:bg-slate-800">
              <button
                onClick={() => setActiveTab("editor")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md ${activeTab === "editor" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
              >
                Edit
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md ${activeTab === "preview" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}
              >
                Preview
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-6">
          {/* Left Column: Editor Form */}
          <div
            className={`sm:col-span-7 space-y-5 ${activeTab === "editor" ? "block" : "hidden sm:block"}`}
          >
            {/* Store Information Header */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                🏪 Data Cabang Toko
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Nama Cabang
                  </label>
                  <input
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Website
                  </label>
                  <input
                    type="text"
                    value={storeWebsite}
                    onChange={(e) => setStoreWebsite(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Alamat Cabang
                  </label>
                  <input
                    type="text"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    NPWP
                  </label>
                  <input
                    type="text"
                    value={storeNpwp}
                    onChange={(e) => setStoreNpwp(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Metadata Transaction */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                👤 Metadata Transaksi & Pelanggan
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    No. Nota
                  </label>
                  <input
                    type="text"
                    value={receiptNo}
                    onChange={(e) => setReceiptNo(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Tanggal
                  </label>
                  <input
                    type="text"
                    value={dateStr}
                    onChange={(e) => setDateStr(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Jam
                  </label>
                  <input
                    type="text"
                    value={timeStr}
                    onChange={(e) => setTimeStr(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Nama Kasir
                  </label>
                  <input
                    type="text"
                    value={kasirName}
                    onChange={(e) => setKasirName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Nama Customer
                  </label>
                  <input
                    type="text"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Editable Items & SKUs */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  🛒 Item & SKU Transaksi
                </h3>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Item
                </button>
              </div>

              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                {items.map((it, index) => (
                  <div
                    key={it.id}
                    className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 relative group"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-semibold text-slate-400 uppercase">
                          Kategori / Layanan
                        </label>
                        <input
                          type="text"
                          value={it.serviceName}
                          onChange={(e) =>
                            handleUpdateItem(
                              it.id,
                              "serviceName",
                              e.target.value.toUpperCase(),
                            )
                          }
                          className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:outline-none uppercase font-bold"
                          placeholder="PASANG JARUM / GANTI BATERAI"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-semibold text-slate-400 uppercase">
                          SKU / Item Code
                        </label>
                        <input
                          type="text"
                          value={it.sku}
                          onChange={(e) =>
                            handleUpdateItem(
                              it.id,
                              "sku",
                              e.target.value.toUpperCase(),
                            )
                          }
                          className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:outline-none uppercase font-mono"
                          placeholder="AC2825BH"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                      <div className="w-20">
                        <label className="block text-[9px] font-semibold text-slate-400 uppercase">
                          Qty
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={it.qty}
                          onChange={(e) =>
                            handleUpdateItem(
                              it.id,
                              "qty",
                              parseInt(e.target.value) || 1,
                            )
                          }
                          className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:outline-none font-bold"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-[9px] font-semibold text-slate-400 uppercase">
                          Harga (Rp)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={it.nominal}
                          onChange={(e) =>
                            handleUpdateItem(
                              it.id,
                              "nominal",
                              parseInt(e.target.value) || 0,
                            )
                          }
                          className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded focus:outline-none font-bold text-emerald-600 dark:text-emerald-400"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(it.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg mt-3"
                        title="Hapus Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment & Points */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                💳 Metode Pembayaran & Poin
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Metode Pembayaran
                  </label>
                  <input
                    type="text"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                    placeholder="Cash / QRIS / Transfer"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                    Poin Bertambah
                  </label>
                  <input
                    type="number"
                    value={points}
                    onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:outline-none font-bold text-blue-600"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Thermal Receipt Preview */}
          <div
            className={`sm:col-span-5 flex flex-col ${activeTab === "preview" ? "block" : "hidden sm:flex"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                🖨️ Live Thermal Preview
              </p>
              <span className="text-[10px] font-medium text-slate-400">
                80mm Receipt Format
              </span>
            </div>

            {/* Thermal Receipt Paper Card */}
            <div className="flex-1 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-300 dark:border-slate-700 flex justify-center items-start shadow-inner overflow-y-auto">
              <div
                ref={printRef}
                className="w-full max-w-[280px] p-4  text-[11px] leading-tight shadow-md border border-slate-200 select-none"
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  backgroundColor: "#ffffff",
                  color: "#000000",
                }}
              >
                {/* Logo & Header */}
                <div className="text-center space-y-1 mb-2">
                  <div className="flex justify-center mb-1">
                    <img
                      src="/logo.png"
                      alt="Arlogic Logo"
                      className="h-8 w-auto brightness-0 object-contain"
                    />
                  </div>
                  <p className="font-bold text-sm tracking-wide uppercase">
                    {storeName}
                  </p>
                  <p className="text-[10px] text-slate-600">{storeAddress}</p>
                  <p className="text-[10px] text-slate-600">{storeWebsite}</p>
                  <p className="text-[9px] text-slate-500">NPWP: {storeNpwp}</p>
                </div>

                <div className="border-t border-dashed border-black my-2" />

                {/* Metadata */}
                <div className="space-y-1 text-[10px]">
                  <div className="flex justify-between">
                    <span>No: {receiptNo}</span>
                    <span>{dateStr}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{timeStr}</span>
                    <span>Kasir: {kasirName}</span>
                  </div>
                  <div>
                    <span>Cust: {custName}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-black my-2" />

                {/* Items Grouped */}
                <div className="space-y-3 my-2">
                  {Object.entries(groupedItems).map(
                    ([sName, sItems]: [string, NotaItem[]]) => (
                      <div key={sName} className="space-y-1">
                        <p className="font-bold uppercase text-[11px]">
                          {sName}
                        </p>
                        {sItems.map((it) => (
                          <div
                            key={it.id}
                            className="flex justify-between text-[10px]"
                          >
                            <span>
                              {it.qty} x {it.sku}
                            </span>
                            <span>Rp{it.nominal.toLocaleString("id-ID")}</span>
                          </div>
                        ))}
                      </div>
                    ),
                  )}
                </div>

                <div className="border-t border-dashed border-black my-2" />

                {/* Totals */}
                <div className="space-y-1 text-[10px] my-2">
                  <div className="flex justify-between">
                    <span>Sub Total</span>
                    <span>Rp{subtotal.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between font-bold text-[12px] pt-1">
                    <span>Total</span>
                    <span>Rp{total.toLocaleString("id-ID")}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>Bayar ({paymentMethod})</span>
                    <span>Rp{total.toLocaleString("id-ID")}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-black my-2" />

                {/* Points */}
                <div className="text-center text-[10px] py-1">
                  <span>Poin Bertambah: {points}</span>
                </div>

                <div className="border-t border-dashed border-black my-2" />

                {/* Footer Message */}
                <div className="text-center space-y-1 pt-1 text-[10px]">
                  <p className="font-bold">Terima kasih!</p>
                  <p className="text-[9px] leading-tight">
                    Barang yang sudah dibeli
                    <br />
                    tidak dapat tukar / dikembalikan.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Batal
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={sendingTelegram}
              onClick={handleSendTelegram}
              className="px-4 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {sendingTelegram ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Kirim Nota PNG ke Telegram</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" /> Cetak / Print Nota
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
