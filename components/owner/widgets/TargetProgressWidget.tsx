"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Target, X } from "lucide-react";
import toast from "react-hot-toast";
import WidgetShell from "./WidgetShell";
import { formatRupiah } from "@/lib/owner/format";
import type { BusinessSettings, DashboardSnapshot } from "@/types/owner";

export default function TargetProgressWidget({
  snapshot,
  updateSettings,
}: {
  snapshot: DashboardSnapshot;
  updateSettings: (
    patch: Partial<Pick<BusinessSettings, "monthly_revenue_target" | "daily_target" | "sla_days">>,
  ) => Promise<void>;
}) {
  const { target, settings } = snapshot;
  const error = snapshot.error.target;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [monthly, setMonthly] = useState(String(settings.monthly_revenue_target));
  const [daily, setDaily] = useState(String(settings.daily_target));
  const [sla, setSla] = useState(String(settings.sla_days));

  const openEdit = () => {
    setMonthly(String(settings.monthly_revenue_target));
    setDaily(String(settings.daily_target));
    setSla(String(settings.sla_days));
    setEditing(true);
  };

  const save = async () => {
    const monthlyN = Number(monthly);
    const dailyN = Number(daily);
    const slaN = Number(sla);
    if (!Number.isFinite(monthlyN) || monthlyN <= 0) {
      toast.error("Target bulanan harus angka > 0");
      return;
    }
    if (!Number.isFinite(dailyN) || dailyN <= 0) {
      toast.error("Target harian harus angka > 0");
      return;
    }
    if (!Number.isFinite(slaN) || slaN < 1 || slaN > 90) {
      toast.error("SLA harus 1–90 hari");
      return;
    }
    setSaving(true);
    try {
      await updateSettings({
        monthly_revenue_target: Math.round(monthlyN),
        daily_target: Math.round(dailyN),
        sla_days: Math.round(slaN),
      });
      toast.success("Target disimpan");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal simpan target");
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <WidgetShell title="Target Revenue" state="error" errorMessage={error} />;
  }
  return (
    <WidgetShell
      title="Target Revenue"
      subtitle="Target bulanan · bisa diubah owner"
      state="success"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center flex-shrink-0">
            <Target className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-slate-900 truncate">
              {formatRupiah(target.target)}
            </p>
            <p className="text-xs text-slate-400">
              Tercapai {formatRupiah(target.achieved)} · Sisa{" "}
              {formatRupiah(target.remaining)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={editing ? () => setEditing(false) : openEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
          aria-label={editing ? "Batal ubah target" : "Ubah target"}
        >
          {editing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
          {editing ? "Batal" : "Ubah"}
        </button>
      </div>

      {editing && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="block text-xs text-slate-500">
            Target bulanan (Rp)
            <input
              type="number"
              min={1}
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Target harian (Rp)
            <input
              type="number"
              min={1}
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </label>
          <label className="block text-xs text-slate-500">
            SLA (hari)
            <input
              type="number"
              min={1}
              max={90}
              value={sla}
              onChange={(e) => setSla(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="sm:col-span-3 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan target"}
          </button>
        </div>
      )}

      <div className="mt-4">
        <div
          className="h-2.5 rounded-full bg-slate-100 overflow-hidden"
          role="progressbar"
          aria-valuenow={target.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progress target revenue"
        >
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-teal-500"
            initial={{ width: 0 }}
            animate={{ width: `${target.progressPct}%` }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">
            {target.progressPct}%
          </span>
          <span className="text-xs text-slate-400">
            {target.etaDays > 0
              ? `Diperkirakan tercapai dalam ${target.etaDays} hari`
              : target.remaining === 0
                ? "Target tercapai"
                : "Performa belum cukup untuk estimasi"}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          SLA aktif: {settings.sla_days} hari · target harian {formatRupiah(settings.daily_target)}
        </p>
      </div>
    </WidgetShell>
  );
}
