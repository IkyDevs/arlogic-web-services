"use client";

import { motion } from "framer-motion";
import {
  X,
  User,
  ShoppingCart,
  Package,
  Receipt,
  FileText,
} from "lucide-react";
import type { TransactionData } from "@/lib/domain/transaction/types";
import {
  jenisLayananLabels,
  metodePembayaranLabels,
} from "@/lib/domain/transaction/enums";
import { formatRupiah, formatDate } from "@/lib/domain/shared/formatters";
import {
  calculateTransactionTotal,
  getPaymentStatus,
  calculateRemaining,
} from "@/lib/domain/transaction/service";

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionData;
}

export default function TransactionDetailModal({
  isOpen,
  onClose,
  transaction,
}: TransactionDetailModalProps) {
  if (!isOpen) return null;

  const isExpense = transaction.items?.some(
    (i) => i.jenis_layanan === "pengeluaran",
  );
  const grandTotal = calculateTransactionTotal(transaction.items || []);
  const remaining = calculateRemaining(grandTotal, 0, 0);
  const paymentStatus = getPaymentStatus(remaining);

  return (
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
        <div
          className={`sticky top-0 z-20 flex items-center justify-between px-5 py-4 border-b rounded-t-2xl ${
            isExpense
              ? "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50"
              : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${isExpense ? "bg-red-600" : "bg-slate-900 dark:bg-white"}`}
            >
              {isExpense ? (
                <Receipt className="w-4 h-4 text-white" />
              ) : (
                <ShoppingCart className="w-4 h-4 text-white dark:text-slate-900" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
                {isExpense ? "Detail Pengeluaran" : "Detail Transaksi"}
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                ID: {transaction.id?.slice(0, 8) || "-"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-gray-400 dark:text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Customer Info */}
          <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 rounded-xl border border-blue-100 dark:border-blue-900/50">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-blue-600 dark:text-blue-300" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Customer
              </p>
              <p className="font-semibold text-gray-900 dark:text-slate-100">
                {transaction.customer_name}
              </p>
              {transaction.customer_whatsapp && (
                <p className="text-sm text-gray-600 dark:text-slate-400">
                  {transaction.customer_whatsapp}
                </p>
              )}
            </div>
          </div>

          {/* Service Items (Multi Jenis Layanan → SKU) */}
          {transaction.items?.map((item, idx) => (
            <div
              key={idx}
              className="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden"
            >
              <div className="bg-gray-50 dark:bg-slate-800/50 px-4 py-2 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-gray-500 dark:text-slate-400" />
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {jenisLayananLabels[item.jenis_layanan] || item.jenis_layanan}
                </p>
              </div>
              <div className="p-3 space-y-2">
                {item.skus.map((sku, skuIdx) => (
                  <div
                    key={skuIdx}
                    className="flex items-center justify-between p-2 bg-white dark:bg-slate-800/30 rounded-lg border border-gray-100 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-slate-300" />
                      <span className="text-sm text-gray-700 dark:text-slate-300">
                        {sku.sku || "-"}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                      {formatRupiah(sku.nominal)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-700">
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    Subtotal
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
                    {formatRupiah(
                      item.skus.reduce((s, sku) => s + (sku.nominal || 0), 0),
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

          {/* Grand Total */}
          <div className="flex items-center justify-between p-4 bg-slate-900 dark:bg-slate-700 rounded-xl">
            <span className="text-sm font-semibold text-white dark:text-slate-100">
              Grand Total
            </span>
            <span className="text-lg font-bold text-white dark:text-slate-100">
              {formatRupiah(grandTotal)}
            </span>
          </div>

          {/* Detail Info Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Pembayaran
              </p>
              <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">
                {metodePembayaranLabels[transaction.metode_pembayaran] ||
                  transaction.metode_pembayaran}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Status
              </p>
              <p
                className={`font-semibold text-sm ${paymentStatus === "lunas" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}
              >
                {paymentStatus === "lunas" ? "LUNAS" : "BELUM LUNAS"}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Staff
              </p>
              <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">
                {transaction.handled_by_name || "-"}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                Waktu
              </p>
              <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm">
                {transaction.created_at
                  ? formatDate(transaction.created_at, "short")
                  : "-"}
              </p>
            </div>
          </div>

          {/* Split Payment */}
          {transaction.split_payment && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/50">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Split Payment
              </p>
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-slate-300">
                    {metodePembayaranLabels[
                      transaction.metode_pembayaran_1 || ""
                    ] || transaction.metode_pembayaran_1}
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-slate-100">
                    {formatRupiah(transaction.nominal_1 || 0)}
                  </span>
                </div>
                {transaction.metode_pembayaran_2 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-slate-300">
                      {metodePembayaranLabels[
                        transaction.metode_pembayaran_2
                      ] || transaction.metode_pembayaran_2}
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-slate-100">
                      {formatRupiah(transaction.nominal_2 || 0)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {transaction.notes && (
            <div className="p-3 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700">
              <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                Catatan
              </p>
              <p className="text-sm text-gray-700 dark:text-slate-300">
                {transaction.notes}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
