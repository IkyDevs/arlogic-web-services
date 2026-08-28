"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { motion } from "framer-motion";
import {
  X,
  Package,
  Plus,
  Loader,
  CheckCircle,
  Trash2,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  adjustStoreStock,
  searchStoreStock,
  type StoreStockOption,
} from "@/lib/domain/inventory/service";

interface SparepartEntry {
  key: string;
  sku: string;
  nominal: number;
  inventoryId: string | null;
  quantity: number;
  option: StoreStockOption | null;
}

interface AddSparepartModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: any;
  onSuccess: () => void;
}

export default function AddSparepartModal({
  isOpen,
  onClose,
  service,
  onSuccess,
}: AddSparepartModalProps) {
  const [entries, setEntries] = useState<SparepartEntry[]>([
    { key: "e1", sku: "", nominal: 0, inventoryId: null, quantity: 1, option: null },
  ]);
  const [stock, setStock] = useState<StoreStockOption[]>([]);
  const [query, setQuery] = useState("");
  const [loadingStock, setLoadingStock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();
  const { user } = useAuthStore();

  const branchId = (service?.branch_id ?? null) as string | null;

  useEffect(() => {
    if (!isOpen || !branchId) return;
    let alive = true;
    setLoadingStock(true);
    const t = setTimeout(async () => {
      try {
        const rows = await searchStoreStock(supabase, {
          branchId,
          itemClass: "sparepart",
          query,
        });
        if (alive) setStock(rows);
      } catch (e) {
        console.error("[inventory] gagal muat stok cabang", e);
      } finally {
        if (alive) setLoadingStock(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, branchId, query]);

  useEffect(() => {
    if (isOpen) {
      setEntries([{ key: `e${Date.now()}`, sku: "", nominal: 0, inventoryId: null, quantity: 1, option: null }]);
      setQuery("");
      setSuccess(false);
    }
  }, [isOpen]);

  const addRow = () =>
    setEntries([
      ...entries,
      { key: `e${Date.now()}`, sku: "", nominal: 0, inventoryId: null, quantity: 1, option: null },
    ]);

  const updateEntry = (key: string, patch: Partial<SparepartEntry>) =>
    setEntries(entries.map((e) => (e.key === key ? { ...e, ...patch } : e)));

  const removeEntry = (key: string) => {
    if (entries.length <= 1) return;
    setEntries(entries.filter((e) => e.key !== key));
  };

  const handleSave = async () => {
    const valid = entries.filter((e) => e.sku && e.quantity > 0 && (e.nominal > 0 || e.inventoryId));
    if (valid.length === 0) {
      toast.error("Tambahkan minimal 1 sparepart");
      return;
    }
    for (const e of valid) {
      if (e.inventoryId && e.option && (e.option.quantity ?? 0) < e.quantity) {
        toast.error(
          `Stok ${e.option.item_name} tidak cukup (tersedia ${e.option.quantity})`,
        );
        return;
      }
    }

    setLoading(true);
    try {
      const items = valid.map((e) => ({
        service_order_id: service.id,
        name: e.sku,
        quantity: e.quantity,
        price: e.inventoryId ? (e.option!.price || e.option!.buy_price || 0) : e.nominal,
        item_type: "sparepart" as const,
        inventory_id: e.inventoryId,
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("service_items")
        .insert(items)
        .select();
      if (insertError) throw insertError;

      const catalogItems = valid.filter((e) => e.inventoryId);
      if (catalogItems.length > 0) {
        const applied: Array<{ id: string; delta: number }> = [];
        try {
          for (const e of catalogItems) {
            await adjustStoreStock(supabase, {
              inventoryId: e.inventoryId!,
              branchId,
              delta: -e.quantity,
              source: "technician",
              reason: `Sparepart service ${service.invoice_number ?? ""}`.trim(),
              refType: "service_item",
              refId: inserted?.[valid.indexOf(e)]?.id,
            });
            applied.push({ id: e.inventoryId!, delta: -e.quantity });
          }
        } catch (stockErr: any) {
          for (const a of applied) {
            await adjustStoreStock(supabase, {
              inventoryId: a.id,
              branchId,
              delta: -a.delta,
              source: "technician",
              reason: "Kompensasi gagal simpan sparepart",
            }).catch(() => {});
          }
          if (inserted?.length) {
            await supabase
              .from("service_items")
              .delete()
              .in("id", inserted.map((r: any) => r.id));
          }
          throw new Error(stockErr?.message || "Gagal memotong stok");
        }
      }

      const sparepartDesc = valid
        .map(
          (e) =>
            `• ${e.sku} (${e.quantity}x)${e.inventoryId ? "" : " [manual]"}`,
        )
        .join("\n");
      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: user?.id,
        status: service.status || "in_progress",
        message: `Teknisi menambahkan sparepart:\n${sparepartDesc}`,
        details: {
          action: "add_sparepart",
          spareparts: valid.map((e) => ({
            inventory_id: e.inventoryId,
            name: e.sku,
            qty: e.quantity,
            price: e.inventoryId ? (e.option!.price || e.option!.buy_price || 0) : e.nominal,
          })),
          total_sparepart_cost: valid.reduce(
            (sum, e) =>
              sum +
              (e.inventoryId ? (e.option!.price || e.option!.buy_price || 0) : e.nominal) * e.quantity,
            0,
          ),
        },
      });

      setSuccess(true);
      toast.success(`${valid.length} sparepart berhasil ditambahkan`);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 800);
    } catch (error: any) {
      toast.error(error?.message || "Gagal menyimpan sparepart");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[var(--color-card)] rounded-[var(--radius-card-md)] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--color-card)] z-10 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--color-text)]">
                Tambah Sparepart
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Stok cabang / manual · {service?.invoice_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-[var(--color-text-tertiary)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {success ? (
            <div className="py-12 text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-[var(--color-text)]">
                Sparepart Berhasil Ditambahkan
              </p>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari sparepart (nama / SKU)..."
                  className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-accent)]"
                />
              </div>

              {loadingStock ? (
                <div className="py-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" /> Memuat stok...
                </div>
              ) : (
                <div className="space-y-2">
                  {entries.map((entry, i) => {
                    const matches = query.trim()
                      ? stock.filter((s) =>
                          s.item_name.toLowerCase().includes(query.toLowerCase()) ||
                          (s.sku && s.sku.toLowerCase().includes(query.toLowerCase()))
                        ).slice(0, 20)
                      : stock.slice(0, 20);
                    return (
                    <div
                      key={entry.key}
                      className="p-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase">
                          Item #{i + 1}
                        </span>
                        {entries.length > 1 && (
                          <button
                            onClick={() => removeEntry(entry.key)}
                            className="p-0.5 text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={entry.sku}
                          onChange={(e) => {
                            updateEntry(entry.key, {
                              sku: e.target.value,
                              option: null,
                              inventoryId: null,
                              nominal: 0,
                            });
                            setQuery(e.target.value);
                          }}
                          onFocus={() => setQuery(entry.sku)}
                          placeholder="Cari sparepart (nama / SKU)..."
                          className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-accent)]"
                        />
                        {entry.sku && matches.length > 0 && !entry.option && (
                          <div className="absolute z-30 mt-1 w-full bg-white dark:bg-[#1c1c1c] border border-gray-200 dark:border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                            {matches.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  updateEntry(entry.key, {
                                    sku: s.sku || s.item_name,
                                    option: s,
                                    inventoryId: s.id,
                                    nominal: s.price || s.buy_price || 0,
                                  });
                                  setQuery("");
                                }}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                              >
                                <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                                  {s.item_name}
                                </span>
                                <span className="text-xs font-semibold text-gray-500 flex-shrink-0">
                                  stok {s.quantity}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {entry.inventoryId ? (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={1}
                            max={entry.option?.quantity ?? undefined}
                            value={entry.quantity || ""}
                            onChange={(e) =>
                              updateEntry(entry.key, {
                                quantity: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            placeholder={`Qty (max ${entry.option?.quantity ?? "-"})`}
                            className="w-full px-3 py-1.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none text-center"
                          />
                          <div className="px-3 py-1.5 text-sm text-right text-slate-500 dark:text-slate-300 bg-black/[0.03] dark:bg-white/5 rounded-xl">
                            Rp {(entry.nominal || 0).toLocaleString("id-ID")}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="number"
                            min={1}
                            value={entry.quantity || ""}
                            onChange={(e) =>
                              updateEntry(entry.key, {
                                quantity: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            placeholder="Qty"
                            className="w-full px-3 py-1.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none text-center"
                          />
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">Rp</span>
                            <input
                              type="number"
                              min={0}
                              value={entry.nominal || ""}
                              onChange={(e) =>
                                updateEntry(entry.key, {
                                  nominal: parseInt(e.target.value.replace(/\D/g, "")) || 0,
                                })
                              }
                              placeholder="Harga"
                              className="w-full pl-7 pr-2 py-1.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl focus:outline-none text-right"
                            />
                          </div>
                        </div>
                      )}
                      {entry.inventoryId &&
                        entry.option &&
                        entry.quantity > entry.option.quantity && (
                          <p className="text-[11px] text-red-500">
                            Qty melebihi stok (tersedia {entry.option.quantity})
                          </p>
                        )}
                    </div>
                  );
                  })}

                  <button
                    onClick={addRow}
                    className="w-full py-2 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl border border-dashed border-purple-200 transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {!success && (
          <div className="sticky bottom-0 bg-[var(--color-card)] border-t border-[var(--color-border)] px-6 py-4 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-xl hover:bg-[var(--color-surface)] transition-all"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={
                loading ||
                loadingStock ||
                entries.every((e) => !e.sku)
              }
              className="flex-1 bg-purple-600 text-white font-medium px-4 py-2.5 rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" /> Simpan Sparepart
                </>
              )}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
