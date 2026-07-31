"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";
import { CheckCircle2, History, Loader2, Package } from "lucide-react";

interface Transfer {
  id: string;
  inventory_id: string;
  from_location: string;
  to_location: string;
  quantity: number;
  notes: string | null;
  status: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  inventory?: { item_name: string; sku: string } | null;
}

export default function TeknisiTransferView() {
  const { user } = useAuthStore();
    const supabase = createClient();
  const [pending, setPending] = useState<Transfer[]>([]);
  const [history, setHistory] = useState<Transfer[]>([]);
  const [tab, setTab] = useState<"pending" | "history">("pending");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("stock_transfers")
        .select("*, inventory:inventory_id(id, item_name, sku)")
        .order("created_at", { ascending: false })
        .limit(50);
      const list = (data as Transfer[]) || [];
      setPending(list.filter((t) => t.status === "pending"));
      setHistory(list.filter((t) => t.status !== "pending"));
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { const t = setTimeout(fetchTransfers, 0); return () => clearTimeout(t); }, [fetchTransfers]);

  const confirmTransfer = async (id: string) => {
    setConfirmingId(id);
    try {
      await supabase
        .from("stock_transfers")
        .update({ status: "confirmed", confirmed_by: user?.id, confirmed_at: new Date().toISOString() })
        .eq("id", id);
      toast.success("Transferan dikonfirmasi!");
      fetchTransfers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal konfirmasi transfer');
    } finally {
      setConfirmingId(null);
    }
  };

  const fmtDate = (d: string) => new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTab("pending")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "pending" ? "bg-slate-900 text-white" : "bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 text-gray-600"}`}
        >
          Transferan Masuk ({pending.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold ${tab === "history" ? "bg-slate-900 text-white" : "bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 text-gray-600"}`}
        >
          <History className="w-4 h-4 inline mr-1" />
          Riwayat ({history.length})
        </button>
      </div>

      {loading && <p className="text-gray-400 text-sm">Memuat...</p>}

      {tab === "pending" && (
        <div className="space-y-2">
          {pending.length === 0 && !loading && (
            <div className="text-center py-10 text-gray-400">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Tidak ada transferan yang perlu dikonfirmasi
            </div>
          )}
          {pending.map((t) => (
            <div key={t.id} className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.inventory?.item_name || "Barang"}</p>
                <p className="text-xs text-gray-500">
                  SKU {t.inventory?.sku || "-"} · qty <b>{t.quantity}</b> · {t.from_location} → {t.to_location}
                </p>
                {t.notes && <p className="text-xs text-gray-400 mt-0.5">{t.notes}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(t.created_at)}</p>
              </div>
              <button
                onClick={() => confirmTransfer(t.id)}
                disabled={confirmingId === t.id}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex-shrink-0"
              >
                {confirmingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Konfirmasi
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-2">
          {history.length === 0 && !loading && <p className="text-gray-400 text-sm">Belum ada riwayat.</p>}
          {history.map((t) => (
            <div key={t.id} className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{t.inventory?.item_name || "Barang"}</p>
                <p className="text-xs text-gray-500">qty {t.quantity} · {t.from_location} → {t.to_location}</p>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.status === "confirmed" ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                  {t.status}
                </span>
                <p className="text-[10px] text-gray-400 mt-1">{t.confirmed_at ? fmtDate(t.confirmed_at) : fmtDate(t.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
