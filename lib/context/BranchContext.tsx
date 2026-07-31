"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { Branch } from "@/types";

interface BranchContextValue {
  branches: Branch[];
  activeBranchId: string | null;
  activeBranch: Branch | null;
  setActiveBranchId: (id: string | null) => void;
  isGlobal: boolean;
  refreshBranches: () => Promise<void>;
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  activeBranchId: null,
  activeBranch: null,
  setActiveBranchId: () => {},
  isGlobal: false,
  refreshBranches: async () => {},
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const { user } = useAuthStore();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const supabase = createClient();

  const refreshBranches = useCallback(async () => {
    try {
      const { data } = await supabase.from("branches").select("*").order("created_at");
      setBranches((data as Branch[]) || []);
    } catch {
      // ignore
    }
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase.from("branches").select("*").order("created_at");
        if (!cancelled) setBranches((data as Branch[]) || []);
      } catch {
        // ignore
      }
    };
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  // Default cabang aktif:
  // - Role per cabang (ada branch_id) → cabangnya sendiri
  // - Role global (owner/supervisor/engineer) → null = "Semua Cabang" (selector bisa filter)
  const effectiveActiveBranchId = activeBranchId ?? user?.branch_id ?? null;

  const activeBranch = branches.find((b) => b.id === effectiveActiveBranchId) || null;
  const isGlobal = !user?.branch_id;

  return (
    <BranchContext.Provider
      value={{ branches, activeBranchId: effectiveActiveBranchId, activeBranch, setActiveBranchId, isGlobal, refreshBranches }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
