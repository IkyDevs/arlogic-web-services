"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { useBranch } from "@/lib/context/BranchContext";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import {
  LayoutDashboard, Users, LogOut, MapPin, ArrowRightLeft,
  CheckCircle2, Loader2, Plus,
  type LucideIcon,
} from "lucide-react";
import ReportModal from "@/components/ui/ReportModal";

type Tab = "overview" | "users";

export default function SupervisorDashboard() {
  const { user, logout } = useAuthStore();
  const { branches } = useBranch();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [showReport, setShowReport] = useState(false);

  const [branchStats, setBranchStats] = useState<Record<string, { services: number; teknisi: number }>>({});
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string; role: string; branch_id: string | null; home_branch_id: string | null; is_stock_approver: boolean | null }>>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Form tambah user
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("teknisi");
  const [newBranch, setNewBranch] = useState("");
  const [creating, setCreating] = useState(false);

  // Rolling teknisi
  const [rollingUserId, setRollingUserId] = useState("");
  const [rollingBranch, setRollingBranch] = useState("");
  const [rollingReason, setRollingReason] = useState("");
  const [rolling, setRolling] = useState(false);

  const fetchOverview = useCallback(async () => {
    if (branches.length === 0) return;
    const stats: Record<string, { services: number; teknisi: number }> = {};
    for (const b of branches) {
      const [{ count: svc }, { count: teks }] = await Promise.all([
        supabase.from("service_orders").select("id", { count: "exact", head: true }).eq("branch_id", b.id),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("branch_id", b.id).eq("role", "teknisi"),
      ]);
      stats[b.id] = { services: svc || 0, teknisi: teks || 0 };
    }
    setBranchStats(stats);
  }, [branches, supabase]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, branch_id, home_branch_id, is_stock_approver")
      .in("role", ["teknisi", "admin", "qc", "supervisor", "engineer", "owner"])
      .order("full_name");
    setUsers(data || []);
    setLoadingUsers(false);
  }, [supabase]);

  useEffect(() => { const t = setTimeout(fetchOverview, 0); return () => clearTimeout(t); }, [fetchOverview]);
  useEffect(() => { if (tab !== "users") return; const t = setTimeout(fetchUsers, 0); return () => clearTimeout(t); }, [tab, fetchUsers]);
  useEffect(() => { if (branches.length > 0 && !newBranch) { const t = setTimeout(() => setNewBranch(branches[0].id), 0); return () => clearTimeout(t); } }, [branches, newBranch]);

  const branchName = (id: string | null) => branches.find((b) => b.id === id)?.name || "-";
  const roleLabel: Record<string, string> = {
    teknisi: "Teknisi", admin: "Admin", qc: "QC", supervisor: "Supervisor", engineer: "Engineer", owner: "Owner",
  };

  const createUser = async () => {
    if (!newEmail.trim() || !newName.trim()) { toast.error("Email & nama wajib diisi"); return; }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.trim(), full_name: newName.trim(), password: newPassword, role: newRole, branch_id: newBranch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat user");
      toast.success("User berhasil dibuat!");
      setNewEmail(""); setNewName(""); setNewPassword("");
      fetchUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setCreating(false);
    }
  };

  const doRolling = async () => {
    if (!rollingUserId || !rollingBranch) { toast.error("Pilih teknisi & cabang tujuan"); return; }
    setRolling(true);
    try {
      const target = users.find((u) => u.id === rollingUserId);
      if (!target) throw new Error("User tidak ditemukan");
      // Catat riwayat rolling
      await supabase.from("branch_assignments").insert({
        profile_id: rollingUserId,
        branch_id: target.branch_id,
        end_date: new Date().toISOString(),
        reason: `Rolling dari ${branchName(target.branch_id)} ke ${branchName(rollingBranch)} - ${rollingReason || "penugasan"}`,
        created_by: user?.id,
      });
      // Update cabang aktif + simpan cabang asal jika belum ada
      const home = target.home_branch_id || target.branch_id;
      await supabase.from("profiles").update({ branch_id: rollingBranch, home_branch_id: home }).eq("id", rollingUserId);
      toast.success("Teknisi berhasil di-rolling!");
      setRollingUserId(""); setRollingBranch(""); setRollingReason("");
      fetchUsers();
      fetchOverview();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Gagal');
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0a0a0a] flex">
      <aside className="w-60 bg-white dark:bg-[#1c1c1c] border-r border-gray-200 dark:border-white/10 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-white/10">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Supervisor Panel</h1>
          <p className="text-xs text-gray-500">Monitor Semua Cabang</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {([
            { id: "overview", label: "Overview", icon: LayoutDashboard },
            { id: "users", label: "Kelola User", icon: Users },
          ] as Array<{ id: Tab; label: string; icon: LucideIcon }>).map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                tab === item.id ? "bg-slate-900 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
          <a
            href="/qc"
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
          >
            <CheckCircle2 className="w-4 h-4" />
            QC Panel
          </a>
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-white/10 space-y-2">
          <p className="text-xs text-gray-500 truncate">{user?.full_name}</p>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {tab === "overview" ? "Monitoring Semua Cabang" : "Kelola User"}
          </h2>
          <button
            onClick={() => setShowReport(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-all text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Lapor
          </button>
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {branches.map((b) => {
              const s = branchStats[b.id] || { services: 0, teknisi: 0 };
              return (
                <motion.div key={b.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">{b.name}</h3>
                    <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500">{b.code}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-blue-600">{s.services}</p>
                      <p className="text-[10px] text-gray-500">Service</p>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-center">
                      <p className="text-xl font-bold text-emerald-600">{s.teknisi}</p>
                      <p className="text-[10px] text-gray-500">Teknisi</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {tab === "users" && (
          <div className="space-y-6">
            {/* Form tambah user */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Tambah User Per Cabang</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama lengkap"
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm" />
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email"
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm" />
                <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Password"
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm" />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm">
                  <option value="teknisi">Teknisi</option>
                  <option value="admin">Admin</option>
                  <option value="qc">QC</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="engineer">Engineer</option>
                </select>
                <select value={newBranch} onChange={(e) => setNewBranch(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm">
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button onClick={createUser} disabled={creating}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Tambah
                </button>
              </div>
            </div>

            {/* Rolling teknisi */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Rolling Teknisi ke Cabang Lain</h3>
              <p className="text-xs text-gray-500 mb-3">Teknisi tetap punya cabang asal (home_branch_id), bisa ditarik kembali kapan saja.</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <select value={rollingUserId} onChange={(e) => setRollingUserId(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm">
                  <option value="">Pilih teknisi</option>
                  {users.filter((u) => u.role === "teknisi").map((u) => (
                    <option key={u.id} value={u.id}>{u.full_name} ({branchName(u.branch_id)})</option>
                  ))}
                </select>
                <select value={rollingBranch} onChange={(e) => setRollingBranch(e.target.value)}
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm">
                  <option value="">Cabang tujuan</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <input value={rollingReason} onChange={(e) => setRollingReason(e.target.value)} placeholder="Alasan (opsional)"
                  className="px-3 py-2.5 bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-xl text-sm" />
                <button onClick={doRolling} disabled={rolling}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                  {rolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                  Rolling
                </button>
              </div>
            </div>

            {/* Daftar user */}
            <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200 dark:border-white/10">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Daftar Staff ({users.length})</h3>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {loadingUsers && <p className="p-4 text-sm text-gray-400">Memuat...</p>}
                {users.map((u) => (
                  <div key={u.id} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{u.full_name}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded text-gray-500">{roleLabel[u.role] || u.role}</span>
                      <span className="text-[10px] font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded text-blue-600">
                        {branchName(u.branch_id)}
                        {u.branch_id !== u.home_branch_id && u.home_branch_id && " (rolling)"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <ReportModal open={showReport} onClose={() => setShowReport(false)} currentModule="Supervisor Panel" />
    </div>
  );
}
