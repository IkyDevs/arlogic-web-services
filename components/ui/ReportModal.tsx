"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useBranch } from "@/lib/context/BranchContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { Bug, Lightbulb, Send, X, Loader2 } from "lucide-react";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  currentModule?: string;
}

export default function ReportModal({ open, onClose, currentModule = "" }: ReportModalProps) {
  const { user } = useAuthStore();
  const { activeBranchId } = useBranch();
  const supabase = createClient();
  const [reportType, setReportType] = useState<"bug" | "feature" | "other">("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Judul dan deskripsi wajib diisi");
      return;
    }
    setLoading(true);
    try {
      await supabase.from("reports").insert({
        report_type: reportType,
        title: title.trim(),
        description: description.trim(),
        module: currentModule,
        priority,
        branch_id: activeBranchId,
        created_by: user?.id,
        status: "new",
      });
      toast.success("Laporan terkirim! Terima kasih atas masukannya.");
      setTitle("");
      setDescription("");
      setReportType("bug");
      setPriority("medium");
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal kirim laporan');
    } finally {
      setLoading(false);
    }
  };

  const types = [
    { id: "bug", label: "Bug", icon: Bug, desc: "Ada yang error / tidak berfungsi" },
    { id: "feature", label: "Request Fitur", icon: Lightbulb, desc: "Ide / permintaan fitur baru" },
    { id: "other", label: "Lainnya", icon: X, desc: "Laporan lain" },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[90] p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-[#1c1c1c] rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 dark:border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Lapor</h3>
            <p className="text-xs text-gray-500">Temukan bug atau punya ide? Laporkan di sini.</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Tipe laporan */}
          <div className="grid grid-cols-3 gap-2">
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setReportType(t.id)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  reportType === t.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-gray-200 dark:border-white/10 hover:border-slate-400"
                }`}
              >
                <t.icon className="w-4 h-4 mx-auto mb-1" />
                <p className="text-[10px] font-semibold">{t.label}</p>
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Judul</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ringkasan singkat..."
              maxLength={80}
              className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Deskripsi</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Jelaskan detail masalah / permintaan..."
              rows={4}
              className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Prioritas</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
              className="w-full px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm"
            >
              <option value="low">Rendah</option>
              <option value="medium">Sedang</option>
              <option value="high">Tinggi</option>
            </select>
          </div>

          {currentModule && (
            <p className="text-[10px] text-gray-400">Modul: {currentModule}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-gray-100 font-semibold rounded-xl text-sm"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-gray-900 font-semibold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Kirim Laporan
          </button>
        </div>
      </motion.div>
    </div>
  );
}
