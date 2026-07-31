"use client";

import { useBranch } from "@/lib/context/BranchContext";
import { MapPin } from "lucide-react";

export default function BranchSelector() {
  const { branches, activeBranchId, setActiveBranchId, isGlobal } = useBranch();

  // Hanya tampil untuk role global (owner/supervisor/engineer) yang tidak punya branch_id
  if (!isGlobal) return null;

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-lg text-xs">
      <MapPin className="w-3.5 h-3.5 text-blue-500" />
      <select
        value={activeBranchId || ""}
        onChange={(e) => setActiveBranchId(e.target.value || null)}
        className="bg-transparent outline-none text-gray-700 dark:text-gray-200 font-medium cursor-pointer"
      >
        <option value="">Semua Cabang</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
