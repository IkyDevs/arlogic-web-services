"use client";

import Image from "next/image";
import { Profile } from "@/types";
import { useBranch } from "@/lib/context/BranchContext";

const ROLE_COLOR: Record<string, string> = {
  admin: "bg-blue-600",
  teknisi: "bg-cyan-600",
  supervisor: "bg-purple-600",
  owner: "bg-amber-500",
  qc: "bg-emerald-600",
  engineer: "bg-pink-600",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  teknisi: "Teknisi",
  supervisor: "Supervisor",
  owner: "Owner",
  qc: "QC",
  engineer: "Engineer",
  customer: "Customer",
};

interface UserAvatarProps {
  user: Profile | null;
  showName?: boolean;
  showRole?: boolean;
}

export default function UserAvatar({ user, showName = true, showRole = true }: UserAvatarProps) {
  const { branches } = useBranch();
  const initial = user?.full_name?.charAt(0) || "U";
  const color = (user?.role && ROLE_COLOR[user.role]) || "bg-slate-600";
  const roleLabel = (user?.role && ROLE_LABEL[user.role]) || "";

  // Role + kode cabang (contoh: ADMIN JBR, TEKNISI KDS)
  const branch = user?.branch_id ? branches.find((b) => b.id === user.branch_id) : null;
  const fullRoleLabel = roleLabel
    ? `${roleLabel}${branch?.code ? ` ${branch.code}` : ""}`.toUpperCase()
    : "";

  return (
    <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-gray-200 dark:border-white/10 flex-shrink-0">
      {/* Nama + role (kiri) — selalu tampil */}
      {showName && (
        <div className="min-w-0 text-right leading-tight">
          <p className="text-[11px] sm:text-xs font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[90px] sm:max-w-[110px]">
            {user?.full_name || "User"}
          </p>
          {showRole && fullRoleLabel && (
            <p className="text-[8px] sm:text-[9px] text-gray-400 uppercase tracking-wider">{fullRoleLabel}</p>
          )}
        </div>
      )}
      {/* Avatar (kanan) */}
      {user?.avatar_url ? (
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 flex-shrink-0">
          <Image
            src={user.avatar_url}
            alt={user.full_name || "User"}
            fill
            sizes="36px"
            unoptimized
            className="rounded-full object-cover border border-gray-200 dark:border-white/10"
          />
        </div>
      ) : (
        <div className={`w-8 h-8 sm:w-9 sm:h-9 ${color} rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0`}>
          {initial}
        </div>
      )}
    </div>
  );
}

