"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { X, AlertTriangle, Loader } from "lucide-react"
import toast from "react-hot-toast"
import { createClient } from "@/lib/supabase/client"

interface QCRecallModalProps {
  service: any
  qcId: string
  onClose: () => void
  onSuccess: () => void
}

export default function QCRecallModal({ service, qcId, onClose, onSuccess }: QCRecallModalProps) {
  const [reason, setReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const supabase = createClient()

  const handleRecall = async () => {
    if (!reason.trim()) {
      toast.error("Alasan recall wajib diisi")
      return
    }
    setSubmitting(true)
    try {
      await supabase.from("qc_recalls").insert({
        service_order_id: service.id,
        qc_id: qcId,
        reason: reason.trim(),
      })

      await supabase
        .from("service_orders")
        .update({
          status: "revision_required",
          qc_recalled: true,
          qc_recalled_at: new Date().toISOString(),
          qc_recall_reason: reason.trim(),
        })
        .eq("id", service.id)

      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: qcId,
        status: "qc_recalled",
        message: `QC Recall — ${reason.trim()}`,
        details: { action: "qc_recall", qc_id: qcId, reason: reason.trim(), timestamp: new Date().toISOString() },
      })

      toast.success("Service berhasil di-recall ke teknisi")
      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Gagal recall service")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-white/10 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">QC Recall</h2>
            <p className="text-xs text-gray-500">{service.invoice_number} — {service.customer_name}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              Service ini sudah di-Approve oleh QC. Dengan melakukan recall, status akan dikembalikan ke "Perlu Revisi" dan teknisi harus mengirim ulang ke QC.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Alasan Recall</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all resize-none"
              placeholder="Jelaskan alasan recall..."
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5">
              Batal
            </button>
            <button onClick={handleRecall} disabled={submitting || !reason.trim()}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Loader className="w-4 h-4 animate-spin" /> Memproses...</> : "Recall"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}