// ─── Service Status Domain (Single Source of Truth) ────────────────
// Definisi kanonis warna/grup status service untuk seluruh dashboard
// (supervisor, admin, qc). Sebelumnya terpusat de-facto di
// components/supervisor/BranchStatsCard.tsx; file itu kini melakukan
// re-export agar import lama tetap berjalan (backward compatible).

export interface ServiceStatusMeta {
  /** Kunci grup ringkas untuk UI */
  key: string;
  /** Label pendek untuk badge/chart */
  label: string;
  /** Kelas Tailwind untuk badge */
  cls: string;
  /** Hex color untuk chart (donut/bar) */
  color: string;
  /** Nilai kolom `service_orders.status` yang digabung ke grup ini */
  match: string[];
}

/**
 * Urutan menentukan urutan render legend/donut/table.
 * Jangan mengubah nilai warna tanpa cek seluruh consumer.
 */
export const SERVICE_STATUS_META: ServiceStatusMeta[] = [
  {
    key: "pending",
    label: "Pending",
    color: "#94a3b8",
    cls: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    match: ["pending"],
  },
  {
    key: "digarap",
    label: "Digarap",
    color: "#3b82f6",
    cls: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    match: ["assigned", "in_progress"],
  },
  {
    key: "nunggu",
    label: "Nunggu",
    color: "#f59e0b",
    cls: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    match: ["waiting_sparepart", "sparepart_ready"],
  },
  {
    key: "qc",
    label: "QC",
    color: "#8b5cf6",
    cls: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
    match: ["qc_pending", "revision_required"],
  },
  {
    key: "selesai",
    label: "Selesai",
    color: "#10b981",
    cls: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    match: ["completed"],
  },
  {
    key: "batal",
    label: "Batal",
    color: "#ef4444",
    cls: "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    match: ["cancelled"],
  },
];

/** Status yang dihitung sebagai "sedang dikerjakan teknisi".
 * Sengaja TIDAK termasuk `revision_required` — mempertahankan semantik
 * beban aktif pada dashboard lama. */
export const TEKNISI_ACTIVE_STATUSES = [
  "assigned",
  "in_progress",
  "waiting_sparepart",
  "sparepart_ready",
  "qc_pending",
] as const;

/** Status yang membuat service order masih terbuka (belum final). */
export const OPEN_SERVICE_STATUSES = [
  "pending",
  "assigned",
  "in_progress",
  "waiting_sparepart",
  "sparepart_ready",
  "qc_pending",
  "revision_required",
] as const;

/** Label tampilan per nilai status mentah (granular). */
export const SERVICE_STATUS_DETAIL_LABELS: Record<string, string> = {
  pending: "Pending",
  assigned: "Diambil",
  in_progress: "Digarap",
  waiting_sparepart: "Tunggu Sparepart",
  sparepart_ready: "Sparepart Siap",
  qc_pending: "QC Pending",
  revision_required: "Revisi",
  completed: "Selesai",
  cancelled: "Batal",
};

export function countStatus(
  status: Record<string, number>,
  keys: readonly string[],
): number {
  return keys.reduce((sum, k) => sum + (status[k] || 0), 0);
}

export function statusTotal(status: Record<string, number>): number {
  return Object.values(status).reduce((a, b) => a + b, 0);
}
