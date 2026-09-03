"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import { ArrowRightLeft, MapPin, Loader2, X, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

interface TransferServiceModalProps {
  service: {
    id: string;
    invoice_number: string;
    customer_name: string;
    branch_id?: string | null;
    status: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function TransferServiceModal({ service, onClose, onSuccess }: TransferServiceModalProps) {
  const supabase = createClient();
  const { branches } = useBranch();
  const [targetBranchId, setTargetBranchId] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const targetBranch = branches.find((b) => b.id === targetBranchId);
  const sourceBranch = branches.find((b) => b.id === service.branch_id);
  const canSubmit = targetBranchId && targetBranchId !== service.branch_id && !submitting;

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleTransfer = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/transfer-service", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceOrderId: service.id,
          targetBranchId,
          reason: reason.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message || "Service berhasil dipindahkan");
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Gagal memindahkan service");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[90] p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Transfer Service</h3>
              <p className="text-[11px] text-slate-500">Pindahkan ke cabang lain</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <p className="text-sm font-bold text-slate-900">{service.customer_name}</p>
            <p className="text-xs font-mono text-slate-500 mt-0.5">{service.invoice_number}</p>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="flex-1 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-center">
              <MapPin className="w-3.5 h-3.5 mx-auto mb-1 text-slate-400" />
              <span className="text-xs font-medium text-slate-700">{sourceBranch?.name || "Tanpa Cabang"}</span>
            </div>
            <ArrowRightLeft className="w-4 h-4 text-blue-500 shrink-0" />
            <div className="flex-1 p-2.5 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <MapPin className="w-3.5 h-3.5 mx-auto mb-1 text-blue-500" />
              <span className="text-xs font-medium text-blue-700">{targetBranch?.name || "Pilih cabang"}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Cabang Tujuan *</label>
            <select
              value={targetBranchId}
              onChange={(e) => setTargetBranchId(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
            >
              <option value="">Pilih cabang tujuan...</option>
              {branches
                .filter((b) => b.id !== service.branch_id)
                .map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1.5">Alasan Transfer</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Contoh: Teknisi spesialis ada di cabang tujuan..."
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700">Service akan dipindahkan ke antrian cabang tujuan. Status tetap <b>pending</b>.</p>
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleTransfer}
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
              Transfer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
