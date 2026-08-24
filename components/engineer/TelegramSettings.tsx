"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  KeyRound, Save, Loader2, RotateCcw, CheckCircle,
  AlertCircle, Wrench, Package, Wallet, Activity, Trash2,
} from "lucide-react";

const TELEGRAM_CHANNEL_LABELS: Record<string, string> = {
  attendance: "Absensi",
  service: "Service",
  layanan: "Layanan / Transaksi",
  inventory: "Inventory",
  stock_transfer: "Stock Transfer",
  closing: "Closing Kas",
  customer: "Customer Baru",
  kaspin: "Kas Pin",
  buku_kas: "Buku Kas",
  teknisi_update: "Update Teknisi",
  qc_update: "Update QC",
  expense: "Pengeluaran / Default",
};

const CHANNEL_GROUPS: Array<{
  label: string;
  icon: typeof Wrench;
  types: string[];
}> = [
  { label: "Operasional", icon: Activity, types: ["attendance", "service", "layanan", "customer"] },
  { label: "Inventori & Gudang", icon: Package, types: ["inventory", "stock_transfer"] },
  { label: "Keuangan & Laporan", icon: Wallet, types: ["closing", "kaspin", "buku_kas", "expense"] },
  { label: "Status & Update", icon: Wrench, types: ["teknisi_update", "qc_update"] },
];

const CHANNEL_TYPES = CHANNEL_GROUPS.flatMap((g) => g.types);

interface ChannelRow {
  channel_type: string;
  branch_id: string | null;
  chat_id: string | null;
  enabled: boolean;
}

interface BranchLite {
  id: string;
  name: string;
  code: string | null;
}

interface CellDraft {
  chat_id: string;
  enabled: boolean;
}

interface Scope {
  id: string; // "global" | branch.id
  name: string;
}

export default function TelegramSettings() {
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenMasked, setTokenMasked] = useState<string | null>(null);
  const [tokenUpdatedAt, setTokenUpdatedAt] = useState<string | null>(null);
  const [savedChannels, setSavedChannels] = useState<ChannelRow[]>([]);
  const [branches, setBranches] = useState<BranchLite[]>([]);
  const [envDefaults, setEnvDefaults] = useState<Record<string, Record<string, string>>>({});
  const [userBranchId, setUserBranchId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, CellDraft>>({});

  const scopes: Scope[] = useMemo(
    () => [{ id: "global", name: "Global" }, ...branches.map((b) => ({ id: b.id, name: b.name }))],
    [branches],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/engineer/telegram-settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat pengaturan");
      setTokenMasked(data.bot_token_masked || null);
      setTokenUpdatedAt(data.bot_token_updated_at || null);
      setSavedChannels(data.channels || []);
      setBranches(data.branches || []);
      setEnvDefaults(data.env_defaults || {});
      setUserBranchId(
        data.user_branch_id && (data.branches || []).some((b: BranchLite) => b.id === data.user_branch_id)
          ? data.user_branch_id
          : null,
      );
    } catch (e: any) {
      toast.error(e.message || "Gagal memuat pengaturan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function cellKey(type: string, scopeId: string) {
    return `${type}|${scopeId}`;
  }

  function getSaved(type: string, scopeId: string): ChannelRow | undefined {
    const branchId = scopeId === "global" ? null : scopeId;
    return savedChannels.find(
      (c) => c.channel_type === type && (c.branch_id || null) === branchId,
    );
  }

  function getCell(type: string, scopeId: string): CellDraft {
    return (
      drafts[cellKey(type, scopeId)] ||
      (() => {
        const saved = getSaved(type, scopeId);
        return { chat_id: saved?.chat_id || "", enabled: saved?.enabled ?? true };
      })()
    );
  }

  function setCell(type: string, scopeId: string, patch: Partial<CellDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [cellKey(type, scopeId)]: { ...getCell(type, scopeId), ...patch },
    }));
  }

  function isDirty(type: string, scopeId: string): boolean {
    const draft = getCell(type, scopeId);
    const saved = getSaved(type, scopeId);
    if (saved) {
      return (saved.chat_id || "").trim() !== draft.chat_id.trim() || saved.enabled !== draft.enabled;
    }
    return draft.chat_id.trim() !== "";
  }

  async function saveCell(type: string, scopeId: string) {
    const key = cellKey(type, scopeId);
    const cell = getCell(type, scopeId);
    const chatId = cell.chat_id.trim();
    const branchId = scopeId === "global" ? null : scopeId;

    setSavingKey(key);
    try {
      // 1) Validasi dulu: kirim pesan test ke channel tujuan
      let testOk = true;
      if (chatId) {
        const testRes = await fetch("/api/engineer/telegram-test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel_type: type, branch_id: branchId, chat_id: chatId }),
        });
        const testData = await testRes.json().catch(() => ({}) as any);
        if (!testRes.ok || !testData.success) {
          testOk = false;
          throw new Error(testData.error || "Bot gagal mengirim pesan test ke channel ini");
        }
      } else {
        // Kolom dikosongkan + simpan = hapus konfigurasi cell ini (tanpa test)
        testOk = true;
      }

      // 2) Baru simpan
      const res = await fetch("/api/engineer/telegram-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channels: [{ channel_type: type, branch_id: branchId, chat_id: chatId || null, enabled: cell.enabled }],
        }),
      });
      const data = await res.json().catch(() => ({}) as any);
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");

      await load();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      toast.success(
        chatId
          ? `✅ Tersimpan — pesan test terkirim ke ${chatId}`
          : "Konfigurasi channel dihapus",
      );
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan channel");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveToken(value: string | null) {
    setTokenSaving(true);
    try {
      const res = await fetch("/api/engineer/telegram-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bot_token: value }),
      });
      const data = await res.json();
      if (!res.ok || !data.bot_token_saved) {
        throw new Error(data.error || "Server melaporkan token tidak tersimpan");
      }
      setTokenInput("");
      await load();
      toast.success(value ? "✅ Bot token tersimpan & terverifikasi di database" : "Bot token dihapus");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan token");
    } finally {
      setTokenSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-full">
      {/* Bot Token */}
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5 space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 leading-tight">Bot Token</h3>
            <p className="text-[11px] text-gray-500">Kredensial bot dari @BotFather — kunci semua notifikasi Telegram</p>
          </div>
        </div>

        {tokenMasked ? (
          <div className="flex items-center gap-3 p-3.5 bg-emerald-50/80 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex-wrap">
            <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              Bot token aktif · <code className="font-mono">{tokenMasked}</code>
            </span>
            {tokenUpdatedAt && (
              <span className="text-[11px] text-emerald-600/70 ml-auto">
                Diperbarui {new Date(tokenUpdatedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3.5 bg-red-50/80 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="w-7 h-7 bg-red-500 rounded-full flex items-center justify-center shrink-0">
              <AlertCircle className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
              Belum ada bot token — notifikasi Telegram tidak akan terkirim. Isi token dulu sebelum menambah channel.
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder={tokenMasked ? `Terisi (${tokenMasked}) — isi baru untuk mengganti` : "123456:ABC-DEF... dari @BotFather"}
            className="flex-1 px-3 py-2.5 bg-gray-50 dark:bg-[#141414] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
          <button
            onClick={() => tokenInput.trim() && saveToken(tokenInput.trim())}
            disabled={tokenSaving || !tokenInput.trim()}
            className="px-5 py-2.5 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            {tokenSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            Simpan
          </button>
        </div>
        {tokenMasked && (
          <button
            onClick={() => saveToken(null)}
            disabled={tokenSaving}
            className="text-xs text-red-500 hover:text-red-600 hover:underline flex items-center gap-1 disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" /> Hapus token
          </button>
        )}
      </div>

      {/* Matrix Channels */}
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-5 space-y-4">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-gray-100">Channel per Cabang</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Klik <Save className="inline w-3 h-3 -mt-0.5 text-emerald-600" /> pada tiap sel untuk menyimpan — bot akan
            mengirim pesan test lebih dulu; hanya chat ID yang valid yang tersimpan.
            Teks abu-abu samar = nilai env lama yang masih jalan.
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 overflow-hidden animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex gap-2 items-center">
                <div className="w-44 h-8 rounded-lg bg-gray-100 dark:bg-white/5 shrink-0" />
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="flex-1 min-w-[190px] h-8 rounded-lg bg-gray-100 dark:bg-white/5" />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto relative rounded-xl border border-gray-100 dark:border-white/5 -mx-1">
            <table className="w-full min-w-max text-sm border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 dark:bg-[#191919] text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 py-2.5 pr-4 pl-4 border-b border-r border-gray-200 dark:border-white/10">
                    Channel
                  </th>
                  {scopes.map((s) => (
                    <th key={s.id} className="pb-2.5 pt-2.5 px-2 text-xs font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#191919]">
                      <span className="inline-flex items-center gap-1.5">
                        {s.name}
                        {userBranchId && s.id === userBranchId && (
                          <span className="text-[9px] bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full">cabangmu</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CHANNEL_GROUPS.map((group) => (
                  <Fragment key={group.label}>
                    <tr>
                      <td
                        colSpan={scopes.length + 1}
                        className="sticky left-0 z-10 bg-slate-50 dark:bg-white/[0.03] px-4 py-1.5 border-y border-gray-100 dark:border-white/5"
                      >
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                          <group.icon className="w-3 h-3" />
                          {group.label}
                        </span>
                      </td>
                    </tr>
                    {group.types.map((type) => (
                      <tr key={type} className="group/row hover:bg-blue-50/30 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="sticky left-0 z-10 bg-white dark:bg-[#1c1c1c] group-hover/row:bg-blue-50/40 dark:group-hover/row:bg-transparent pl-4 pr-4 py-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap text-[13px] border-l-2 border-l-transparent group-hover/row:border-l-blue-500 transition-colors">
                          {TELEGRAM_CHANNEL_LABELS[type]}
                        </td>
                        {scopes.map((s) => {
                          const cell = getCell(type, s.id);
                          const envVal = envDefaults[s.id]?.[type];
                          const key = cellKey(type, s.id);
                          const hasValue = cell.chat_id.trim() !== "";
                          const dirty = isDirty(type, s.id);
                          const isSaving = savingKey === key;
                          const isSavedCell = hasValue && !dirty && !!getSaved(type, s.id)?.enabled;
                          return (
                            <td key={s.id} className={`px-2 py-2 align-top min-w-[185px] border-b border-gray-50 dark:border-white/5 ${isSavedCell ? "bg-emerald-50/25 dark:bg-emerald-900/5" : ""}`}>
                              <input
                                value={cell.chat_id}
                                onChange={(e) => setCell(type, s.id, { chat_id: e.target.value })}
                                placeholder={envVal || "@channel / -100..."}
                                title={envVal ? `Nilai aktif dari env: ${envVal}` : undefined}
                                className={`w-full px-2.5 py-1.5 bg-white dark:bg-[#141414] border rounded-lg text-xs font-mono placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 transition-all ${
                                  dirty
                                    ? "border-amber-300 dark:border-amber-700 focus:ring-amber-500/15 focus:border-amber-500"
                                    : isSavedCell
                                      ? "border-emerald-300 dark:border-emerald-700 focus:ring-emerald-500/15 focus:border-emerald-500"
                                      : "border-gray-200 dark:border-white/10 focus:ring-blue-500/15 focus:border-blue-500"
                                }`}
                              />
                              <div className="flex items-center justify-between gap-1 mt-1">
                                <label className={`flex items-center gap-1 text-[10px] cursor-pointer select-none transition-colors ${cell.enabled ? "text-gray-600 dark:text-gray-400" : "text-gray-300 dark:text-gray-600"}`}>
                                  <input
                                    type="checkbox"
                                    checked={cell.enabled}
                                    onChange={(e) => setCell(type, s.id, { enabled: e.target.checked })}
                                    className="accent-blue-600 w-3 h-3"
                                  />
                                  aktif
                                  {dirty && (
                                    <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" title="Belum disimpan" />
                                  )}
                                </label>
                                {hasValue || dirty ? (
                                  <button
                                    onClick={() => saveCell(type, s.id)}
                                    disabled={savingKey !== null}
                                    title={hasValue ? "Simpan + kirim pesan test ke channel ini" : "Kosongkan & hapus konfigurasi sel ini"}
                                    className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
                                      hasValue
                                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                                        : "bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40"
                                    }`}
                                  >
                                    {isSaving ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : hasValue ? (
                                      <Save className="w-3 h-3" />
                                    ) : (
                                      <Trash2 className="w-3 h-3" />
                                    )}
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 flex items-center gap-3 flex-wrap pt-1">
          <span><Save className="inline w-3 h-3 -mt-0.5 text-emerald-600" /> simpan + tes kirim otomatis</span>
          <span><Trash2 className="inline w-3 h-3 -mt-0.5 text-red-400" /> hapus konfigurasi sel</span>
          <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 align-middle" /> belum disimpan</span>
        </p>
      </div>
    </div>
  );
}
