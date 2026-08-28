"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import dynamic from "next/dynamic";

const TransactionManagement = dynamic(
  () => import("@/components/layanan/TransactionManagement"),
  {
    loading: () => (
      <div className="text-center py-10 text-slate-500">Memuat transaksi...</div>
    ),
    ssr: false,
  },
);
const ServiceList = dynamic(() => import("@/components/admin/ServiceList"), {
  loading: () => (
    <div className="text-center py-10 text-slate-500">Memuat service...</div>
  ),
  ssr: false,
});

export interface ModalBranch {
  id: string | null;
  name: string;
}

interface MonitoringModalProps {
  open: boolean;
  branch: ModalBranch;
  onClose: () => void;
}

function MonitoringModalShell({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-2 sm:p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#f8fafc] dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] overflow-hidden flex flex-col"
          >
            <div className="flex-shrink-0 px-4 sm:px-5 py-3 border-b border-gray-200 dark:border-white/10 flex items-center justify-between gap-3 bg-white dark:bg-[#1c1c1c]">
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 truncate">
                  {title}
                </h3>
                <p className="text-[11px] text-gray-400">{subtitle}</p>
              </div>
              <button
                onClick={onClose}
                aria-label="Tutup"
                className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <X className="w-4 h-4 text-gray-400" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function SupervisorTransactionsModal({
  open,
  branch,
  onClose,
}: MonitoringModalProps) {
  return (
    <MonitoringModalShell
      open={open}
      title={`Transaksi — ${branch.name}`}
      subtitle="Read-only · klik item untuk detail lengkap"
      onClose={onClose}
    >
      <TransactionManagement readOnly branchId={branch.id} />
    </MonitoringModalShell>
  );
}

export function SupervisorServicesModal({
  open,
  branch,
  onClose,
}: MonitoringModalProps) {
  return (
    <MonitoringModalShell
      open={open}
      title={`Service — ${branch.name}`}
      subtitle="Read-only · klik baris untuk Detail Service"
      onClose={onClose}
    >
      <ServiceList readOnly branchId={branch.id} />
    </MonitoringModalShell>
  );
}
