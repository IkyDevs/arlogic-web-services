"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Wrench,
  Loader,
  CheckCircle,
  AlertCircle,
  Search,
  DollarSign,
  Sparkles,
  Trash2,
  Plus,
} from "lucide-react";
import toast from "react-hot-toast";

interface SelectedJasa {
  id: string;
  name: string;
  price: number;
  default_price: number;
  notes?: string;
}

interface AddJasaModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: any;
  onSuccess: () => void;
}

export default function AddJasaModal({
  isOpen,
  onClose,
  service,
  onSuccess,
}: AddJasaModalProps) {
  const [selectedJasaList, setSelectedJasaList] = useState<SelectedJasa[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [allJasa, setAllJasa] = useState<any[]>([]);
  const [loadingJasa, setLoadingJasa] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isNewJasa, setIsNewJasa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const supabase = createClient();
  const { user } = useAuthStore();

  useEffect(() => {
    if (isOpen) {
      loadAllJasa();
      setSelectedJasaList([]);
      setSearchQuery("");
    } else {
      setSelectedJasaList([]);
      setSearchQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadAllJasa = async () => {
    setLoadingJasa(true);
    try {
      const { data } = await supabase
        .from("service_jasa")
        .select("*")
        .order("name");

      if (data) {
        setAllJasa(data);
        console.log("📦 Loaded jasa from DB:", data.length);
      }
    } catch (error) {
      console.error("Error loading jasa:", error);
    } finally {
      setLoadingJasa(false);
    }
  };

  const filteredJasa = useMemo(() => {
    if (!searchQuery.trim()) {
      return allJasa.slice(0, 20);
    }
    const query = searchQuery.toLowerCase().trim();
    return allJasa.filter((item) => item.name.toLowerCase().includes(query));
  }, [allJasa, searchQuery]);

  const hasExactMatch = useMemo(() => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase().trim();
    return allJasa.some((item) => item.name.toLowerCase() === query);
  }, [allJasa, searchQuery]);

  const isJasaAlreadySelected = (jasaId: string) => {
    return selectedJasaList.some((item) => item.id === jasaId);
  };

  const addJasaToList = (item: any, price?: number) => {
    if (isJasaAlreadySelected(item.id)) {
      toast.error(`"${item.name}" sudah ditambahkan`);
      return;
    }

    const newJasa: SelectedJasa = {
      id: item.id,
      name: item.name,
      price: price || item.default_price || 0,
      default_price: item.default_price || 0,
      notes: "",
    };

    setSelectedJasaList([...selectedJasaList, newJasa]);
    setSearchQuery("");
    setShowDropdown(false);
    toast.success(`"${item.name}" ditambahkan`);
  };

  const removeJasaFromList = (index: number) => {
    const removed = selectedJasaList[index];
    setSelectedJasaList(selectedJasaList.filter((_, i) => i !== index));
    toast.success(`"${removed.name}" dihapus dari daftar`);
  };

  // UPDATE: Simpan harga ke database dengan CRUD
  const updateJasaPrice = async (jasaId: string, newPrice: number) => {
    try {
      console.log("📤 Updating price to DB:", jasaId, newPrice);

      const { error } = await supabase
        .from("service_jasa")
        .update({ default_price: newPrice })
        .eq("id", jasaId);

      if (error) throw error;

      // Update local state
      setAllJasa((prev) =>
        prev.map((item) =>
          item.id === jasaId ? { ...item, default_price: newPrice } : item,
        ),
      );

      console.log("✅ Price updated in DB:", newPrice);

      // Update selected item price in list
      setSelectedJasaList((prev) =>
        prev.map((item) =>
          item.id === jasaId
            ? { ...item, price: newPrice, default_price: newPrice }
            : item,
        ),
      );
    } catch (error: any) {
      console.error("❌ Error updating jasa price:", error);
      toast.error("Gagal update harga default");
    }
  };

  // CREATE Jasa Baru dengan harga
  const createNewJasa = async () => {
    if (!searchQuery.trim()) {
      toast.error("Masukkan nama jasa terlebih dahulu");
      return;
    }

    const existing = allJasa.find(
      (item) => item.name.toLowerCase() === searchQuery.toLowerCase().trim(),
    );

    if (existing) {
      addJasaToList(existing);
      return;
    }

    setIsCreating(true);
    try {
      // Dapatkan harga dari input (default 0)
      const price = 0; // Default 0, akan diisi user nanti

      const newJasa = {
        name: searchQuery.trim(),
        default_price: price,
        description: "Jasa baru ditambahkan oleh teknisi",
      };

      console.log("📤 Creating new jasa:", newJasa);

      const { data, error } = await supabase
        .from("service_jasa")
        .insert([newJasa])
        .select()
        .single();

      if (error) throw error;

      // Tambahkan ke local state
      setAllJasa((prev) => [...prev, data]);

      // Tambahkan ke list dengan harga 0
      addJasaToList(data, 0);

      toast.success(`Jasa "${data.name}" berhasil dibuat! Silakan set harga.`);
      console.log("✅ New jasa created:", data);
    } catch (error: any) {
      console.error("❌ Error creating jasa:", error);
      toast.error(error.message);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle price change dengan format
  const handlePriceChange = (index: number, value: string) => {
    // Hapus titik dan karakter non-digit
    const cleanValue = value.replace(/\./g, "").replace(/[^0-9]/g, "");
    const newPrice = cleanValue === "" ? 0 : parseInt(cleanValue) || 0;

    // Update di list
    const updatedList = [...selectedJasaList];
    updatedList[index].price = newPrice;
    setSelectedJasaList(updatedList);

    // Jika jasa sudah ada di database dan harga > 0, update database
    const jasa = updatedList[index];
    if (jasa.id && newPrice > 0) {
      // Cek apakah harga berbeda dari default
      const currentDefault =
        allJasa.find((item) => item.id === jasa.id)?.default_price || 0;
      if (newPrice !== currentDefault) {
        updateJasaPrice(jasa.id, newPrice);
      }
    }
  };

  const getTotalPrice = () => {
    return selectedJasaList.reduce((total, item) => total + item.price, 0);
  };

  // Format harga dengan titik
  const formatPrice = (price: number) => {
    return price ? price.toLocaleString("id-ID") : "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedJasaList.length === 0) {
      toast.error("Tambahkan minimal 1 jasa");
      return;
    }

    const zeroPrice = selectedJasaList.some((item) => item.price <= 0);
    if (zeroPrice) {
      toast.error("Semua jasa harus memiliki harga");
      return;
    }

    setLoading(true);

    try {
      // Save semua jasa ke service_items
      for (const jasa of selectedJasaList) {
        const { error: itemError } = await supabase
          .from("service_items")
          .insert({
            service_order_id: service.id,
            item_type: "jasa",
            name: jasa.name,
            quantity: 1,
            price: jasa.price,
          });

        if (itemError) throw itemError;
      }

      const jasaNames = selectedJasaList.map((j) => j.name).join(", ");
      await supabase.from("service_timeline").insert({
        service_order_id: service.id,
        teknisi_id: user?.id,
        status: "in_progress",
        message: `Menambahkan ${selectedJasaList.length} jasa: ${jasaNames} (Total Rp ${getTotalPrice().toLocaleString()})`,
        details: {
          action: "add_jasa_multiple",
          jasa_list: selectedJasaList,
          total: getTotalPrice(),
        },
      });

      setSuccess(true);
      toast.success(`${selectedJasaList.length} jasa berhasil ditambahkan!`);

      setTimeout(() => {
        onSuccess();
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (error: any) {
      console.error("❌ Submit error:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md lg:max-w-lg p-6 sm:p-8 text-center border border-slate-200"
        >
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-2">
            JASA DITAMBAHKAN!
          </h3>
          <p className="text-slate-500 mb-4">
            {selectedJasaList.length} jasa berhasil ditambahkan.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm md:max-w-md lg:max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-200"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-200 p-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Wrench className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              TAMBAH JASA
            </h3>
            <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
              {selectedJasaList.length} terpilih
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Search */}
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-slate-900 mb-1">
              Cari Jasa
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowDropdown(true)}
                placeholder="Ketik nama jasa..."
                className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 transition-all"
                autoComplete="off"
              />
              {loadingJasa && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown &&
              searchQuery &&
              filteredJasa.length > 0 &&
              !loadingJasa && (
                <div className="absolute z-50 w-full mt-1">
                  <div className="bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {filteredJasa.map((item) => {
                      const isSelected = isJasaAlreadySelected(item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (!isSelected) {
                              addJasaToList(item);
                            } else {
                              toast.error(`"${item.name}" sudah di daftar`);
                            }
                          }}
                          className={`px-3 py-2.5 cursor-pointer transition-all border-b border-slate-200 last:border-0 ${
                            isSelected
                              ? "bg-slate-100 opacity-60"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-slate-400">
                                Default: Rp{" "}
                                {item.default_price?.toLocaleString() || 0}
                              </p>
                            </div>
                            {isSelected ? (
                              <span className="text-xs text-green-600">
                                ✓ Ditambahkan
                              </span>
                            ) : (
                              <span className="text-xs text-blue-600">
                                + Tambah
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            {/* Create New */}
            {showDropdown &&
              searchQuery &&
              filteredJasa.length === 0 &&
              !loadingJasa &&
              !hasExactMatch && (
                <div className="absolute z-50 w-full mt-1">
                  <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-4">
                    <div className="text-center">
                      <p className="text-sm text-slate-500 mb-2">
                        Jasa "{searchQuery}" tidak ditemukan
                      </p>
                      <button
                        type="button"
                        onClick={createNewJasa}
                        disabled={isCreating}
                        className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isCreating ? (
                          <Loader className="w-4 h-4 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4" />
                        )}
                        Buat & Tambahkan "{searchQuery}"
                      </button>
                      <p className="text-xs text-slate-400 mt-2">
                        Harga default: Rp 0 (akan diisi)
                      </p>
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Selected Jasa List */}
          {selectedJasaList.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 border-b border-slate-200">
                <p className="text-xs font-medium text-slate-500">
                  DAFTAR JASA ({selectedJasaList.length})
                </p>
              </div>
              <div className="divide-y divide-slate-200 max-h-48 overflow-y-auto">
                {selectedJasaList.map((jasa, index) => (
                  <div
                    key={index}
                    className="p-3 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{jasa.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">Rp</span>
                          <input
                            type="text"
                            value={formatPrice(jasa.price)}
                            onChange={(e) =>
                              handlePriceChange(index, e.target.value)
                            }
                            className="w-28 px-2 py-0.5 text-sm border border-slate-200 rounded focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeJasaFromList(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-slate-50 px-3 py-2 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm font-medium">Total</span>
                <span className="text-lg font-bold text-blue-600">
                  Rp {formatPrice(getTotalPrice())}
                </span>
              </div>
            </div>
          )}

          {/* Service Info */}
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
              Informasi Service
            </p>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-medium truncate">
                  {service.customer_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-mono text-xs">
                  {service.invoice_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Device:</span>
                <span className="truncate">
                  {service.watch_brand || service.device_brand}
                </span>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || selectedJasaList.length === 0}
            className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                MENAMBAHKAN...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                TAMBAHKAN {selectedJasaList.length} JASA
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
