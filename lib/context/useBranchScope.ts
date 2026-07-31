"use client";

import { useAuthStore } from "@/stores/authStore";
import { useBranch } from "@/lib/context/BranchContext";

interface BranchScope {
  /** branch_id yang harus dipakai sebagai filter query (null = tanpa filter / semua cabang) */
  branchId: string | null;
  /** true jika role per cabang (selalu scoped ke cabangnya) */
  isScoped: boolean;
  /** helper untuk memakai di supabase .match() — kosong jika tidak ada filter */
  match: Record<string, string>;
}

/**
 * Central branch scoping — semua komponen pakai ini untuk filter data per cabang.
 *
 * Role per cabang (admin/teknisi/qc) → selalu scoped ke user.branch_id.
 * Role global (owner/supervisor/engineer) → pakai activeBranchId dari selector;
 *   null = lihat SEMUA cabang.
 */
export function useBranchScope(): BranchScope {
  const { user } = useAuthStore();
  const { activeBranchId } = useBranch();

  const branchId = user?.branch_id ?? activeBranchId ?? null;

  return {
    branchId,
    isScoped: !!user?.branch_id,
    match: branchId ? { branch_id: branchId } : {},
  };
}
