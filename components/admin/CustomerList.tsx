"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Users, Search, Phone, ShoppingCart, Watch, Upload, X, CheckCircle, AlertCircle, Loader2, Download, FileSpreadsheet, Edit, Mail, MapPin, Briefcase, FileText, Clock, CreditCard, Hash } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import { getStatusColor } from "@/types";

const paymentLabels: Record<string, string> = {
  cash: "Cash", qris: "QRIS", edc: "EDC", transfer: "Transfer", tf_bca: "TF BCA", tf_mandiri: "TF Mandiri",
  edc_bca: "EDC BCA", edc_mandiri: "EDC Mandiri", bri: "BRI", kudus: "Kudus",
};

function fmtRupiah(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function CustomerList() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<any>(null);
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sortBy, setSortBy] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [customerFilter, setCustomerFilter] = useState<string>("pernah_transaksi");
  const [pointMin, setPointMin] = useState("");
  const [pointMax, setPointMax] = useState("");
  const [periodFilter, setPeriodFilter] = useState("all");
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; phase: string } | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [showCustomerDetail, setShowCustomerDetail] = useState(false);
  const [customerDetailMode, setCustomerDetailMode] = useState<"transaksi" | "service">("transaksi");
  const [customerDetailData, setCustomerDetailData] = useState<any[]>([]);
  const [customerDetailLoading, setCustomerDetailLoading] = useState(false);
  const [customerDetailPhone, setCustomerDetailPhone] = useState("");
  const [selectedDetailItem, setSelectedDetailItem] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 100;

  const fetchCustomers = async (append = false, searchQuery = "") => {
    if (!append && !searchQuery) setLoading(true);
    else setLoadingMore(true);
    try {
      const from = append ? page * PAGE_SIZE : 0;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("customers")
        .select("id, name, phone, point", { count: "exact" })
        .order("created_at", { ascending: false });

      if (searchQuery) {
        const q = searchQuery.replace(/\D/g, "");
        query = query.or(`name.ilike.%${searchQuery}%,phone.ilike.%${q}%`);
      }

      if (!searchQuery) query = query.range(from, to);

      const { data, count } = await query;

      const phones = (data || []).map((c) => c.phone).filter(Boolean);
      let layananCounts: Record<string, number> = {};
      let serviceCounts: Record<string, number> = {};

      if (phones.length > 0) {
        const [layananRes, serviceRes] = await Promise.all([
          supabase.from("layanan").select("customer_whatsapp").in("customer_whatsapp", phones),
          supabase.from("service_orders").select("customer_phone").in("customer_phone", phones),
        ]);

        for (const r of layananRes.data || []) {
          const p = r.customer_whatsapp || "";
          layananCounts[p] = (layananCounts[p] || 0) + 1;
        }
        for (const r of serviceRes.data || []) {
          const p = r.customer_phone || "";
          serviceCounts[p] = (serviceCounts[p] || 0) + 1;
        }
      }

      const list = (data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        point: c.point || 0,
        profesi: c.profesi || "",
        email: c.email || "",
        alamat: c.alamat || "",
        layananCount: layananCounts[c.phone] || 0,
        serviceCount: serviceCounts[c.phone] || 0,
      }));

      if (append) {
        setCustomers(prev => [...prev, ...list]);
      } else {
        setCustomers(list);
      }
      if (count != null) setTotalCount(count);
      if (!searchQuery) {
        setHasMore(count != null ? from + PAGE_SIZE < count : (data?.length || 0) === PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (e: any) {
      console.error("Fetch customers error:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    setPage(p => p + 1);
    fetchCustomers(true, "");
  };

  useEffect(() => { fetchCustomers(false, ""); }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!search.trim()) {
      if (customers.length === 0) fetchCustomers(false, "");
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const q = search.trim();
      const qDigits = q.replace(/\D/g, "");
      let query = supabase
        .from("customers")
        .select("id, name, phone, point, profesi, email, alamat");
      if (qDigits) {
        query = query.or(`name.ilike.%${q}%,phone.ilike.%${qDigits}%`);
      } else {
        query = query.ilike("name", `%${q}%`);
      }
      const { data } = await query.limit(50);
      const phones = (data || []).map((c: any) => c.phone).filter(Boolean);
      let layananCounts: Record<string, number> = {};
      let serviceCounts: Record<string, number> = {};
      if (phones.length > 0) {
        const [layananRes, serviceRes] = await Promise.all([
          supabase.from("layanan").select("customer_whatsapp").in("customer_whatsapp", phones),
          supabase.from("service_orders").select("customer_phone").in("customer_phone", phones),
        ]);
        for (const r of layananRes.data || []) {
          const p = r.customer_whatsapp || "";
          layananCounts[p] = (layananCounts[p] || 0) + 1;
        }
        for (const r of serviceRes.data || []) {
          const p = r.customer_phone || "";
          serviceCounts[p] = (serviceCounts[p] || 0) + 1;
        }
      }
      setCustomers((data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        point: c.point || 0,
        profesi: c.profesi || "",
        email: c.email || "",
        alamat: c.alamat || "",
        layananCount: layananCounts[c.phone] || 0,
        serviceCount: serviceCounts[c.phone] || 0,
      })));
      setSearching(false);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search]);

  const handleEdit = (c: any) => {
    setEditData({ ...c });
    setShowEdit(true);
  };

  const openCustomerDetail = async (phone: string, mode: "transaksi" | "service") => {
    setCustomerDetailPhone(phone);
    setCustomerDetailMode(mode);
    setShowCustomerDetail(true);
    setCustomerDetailLoading(true);
    setSelectedDetailItem(null);
    try {
      if (mode === "transaksi") {
        const { data } = await supabase.from("layanan").select("*").eq("customer_whatsapp", phone).order("created_at", { ascending: false });
        setCustomerDetailData(data || []);
      } else {
        const { data } = await supabase.from("service_orders").select("*").eq("customer_phone", phone).order("created_at", { ascending: false });
        setCustomerDetailData(data || []);
      }
    } catch (e: any) {
      console.error("Fetch customer detail error:", e);
      setCustomerDetailData([]);
    } finally {
      setCustomerDetailLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!editData?.id) return;
    const payload: any = {};
    if (editData.name?.trim()) payload.name = editData.name.trim();
    if (editData.phone?.trim()) payload.phone = editData.phone.trim().replace(/\D/g, "");
    if (editData.point != null) payload.point = parseInt(editData.point) || 0;
    payload.profesi = editData.profesi?.trim() || null;
    payload.email = editData.email?.trim() || null;
    payload.alamat = editData.alamat?.trim() || null;
    const { error } = await supabase.from("customers").update(payload).eq("id", editData.id);
    if (error) { toast.error("Gagal update: " + error.message); return; }
    toast.success("Customer diperbarui");
    setShowEdit(false);
    setEditData(null);
    fetchCustomers(false, "");
  };

  function parseRows(data: (string | number)[][]): { name: string; phone: string; point: number }[] {
    if (data.length === 0) return [];
    const rows: { name: string; phone: string; point: number }[] = [];
    let start = 0;
    if (data.length > 1 && data[1] && String(data[1][0]).includes("Abaikan kolom")) start = 2;
    for (let i = start; i < data.length; i++) {
      const row = data[i];
      if (row.length < 4) continue;
      let name = String(row[2] || "").trim().replace(/^CS\s*/i, "");
      let phone = String(row[3] || "").replace(/\D/g, "");
      const point = parseInt(String(row[7] || "0")) || 0;
      if (!phone.startsWith("62") && phone.startsWith("0")) phone = "62" + phone.substring(1);
      const last4 = phone.slice(-4);
      const baseName = name.endsWith(` ${last4}`) ? name : `${name} ${last4}`;
      name = baseName.startsWith("CS ") ? baseName : `CS ${baseName}`;
      if (name && phone.length >= 10) rows.push({ name, phone, point });
    }
    return rows;
  }

  function downloadTemplateCSV() {
    const csv = "nama,nomor_wa,point\nJohn Doe,081234567890,100\nJane Smith,628123456789,50";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_import_customer.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplateXLS() {
    const wb = XLSX.utils.book_new();
    const data = [["nama", "nomor_wa", "point"], ["John Doe", "081234567890", 100], ["Jane Smith", "628123456789", 50]];
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "template_import_customer.xlsx");
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImportProgress(null);
    setImporting(true);
    try {
      let rows: { name: string; phone: string; point: number }[] = [];
      const isExcel = file.name.endsWith(".xls") || file.name.endsWith(".xlsx");
      if (isExcel) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: (string | number)[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        rows = parseRows(data);
      } else {
        const text = await file.text();
        const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
        const data = lines.map(l => l.split(",").map(p => p.trim().replace(/^"|"$/g, "")));
        rows = parseRows(data);
      }
      if (rows.length === 0) { toast.error("Tidak ada data valid di file"); setImporting(false); return; }

      setImportProgress({ current: 0, total: rows.length, phase: "Mengambil data pelanggan..." });

      const phones = rows.map(r => r.phone);
      const { data: existingCustomers } = await supabase.from("customers").select("phone, id, point").in("phone", phones);
      const existingMap = new Map((existingCustomers || []).map(c => [c.phone, c]));

      const BATCH_SIZE = 50;
      let added = 0, skipped = 0;
      const errors: string[] = [];
      const toInsert: { name: string; phone: string; point: number }[] = [];
      const toUpdate: { id: string; point: number }[] = [];

      setImportProgress({ current: 0, total: rows.length, phase: "Menyortir data..." });

      for (const row of rows) {
        const existing = existingMap.get(row.phone);
        if (existing) {
          if (row.point > 0) toUpdate.push({ id: existing.id, point: row.point });
          skipped++;
        } else {
          toInsert.push(row);
        }
      }

      for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
        const batch = toInsert.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from("customers").insert(batch);
        if (error) {
          if (error.code === "23505") {
            let insertedCount = 0;
            for (const row of batch) {
              const { error: insertErr } = await supabase.from("customers").insert(row);
              if (insertErr && insertErr.code !== "23505") errors.push(`${row.name}: ${insertErr.message}`);
              else insertedCount++;
            }
            added += insertedCount;
          } else {
            errors.push(`Batch ${i}-${i + batch.length}: ${error.message}`);
          }
        } else {
          added += batch.length;
        }
        setImportProgress({ current: i + batch.length, total: rows.length, phase: "Menyimpan pelanggan baru..." });
        await new Promise(r => setTimeout(r, 0));
      }

      for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(u =>
          supabase.from("customers").update({ point: u.point }).eq("id", u.id)
        ));
      }

      setImportProgress({ current: rows.length, total: rows.length, phase: "Selesai" });
      setImportResult({ added, skipped, errors });
    } catch (err: any) {
      toast.error("Gagal membaca file: " + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const filteredSorted = useMemo(() => {
    if (!search.trim()) {
      let list = [...customers];
      // Default filter: pernah transaksi
      if (customerFilter === "pernah_transaksi") list = list.filter(c => c.layananCount > 0 || c.serviceCount > 0);
      else if (customerFilter === "minggu_ini") {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        list = list.filter(c => c.layananCount > 0 || c.serviceCount > 0);
      }
      else if (customerFilter === "bulan_ini") {
        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        list = list.filter(c => c.layananCount > 0 || c.serviceCount > 0);
      }
      if (pointMin) list = list.filter(c => (c.point || 0) >= parseInt(pointMin));
      if (pointMax) list = list.filter(c => (c.point || 0) <= parseInt(pointMax));
      list.sort((a, b) => {
        let cmp = 0;
        if (sortBy === "name") cmp = a.name.localeCompare(b.name);
        else if (sortBy === "point") cmp = (a.point || 0) - (b.point || 0);
        else if (sortBy === "total") cmp = (a.layananCount + a.serviceCount) - (b.layananCount + b.serviceCount);
        return sortDir === "asc" ? cmp : -cmp;
      });
      return list;
    }
    return customers;
  }, [customers, sortBy, sortDir, pointMin, pointMax, periodFilter, search, customerFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-gray-100">Data Customer</h1>
            <p className="text-sm text-slate-500 dark:text-gray-400">
              {search.trim()
                ? `${customers.length} hasil ditemukan`
                : `${totalCount.toLocaleString("id-ID")} customer terdaftar`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-gray-400">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={() => fetchCustomers(false, search)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-gray-400">
            <Search className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau nomor WhatsApp..." autoFocus
              className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-[#1c1c1c] text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10">
              <option value="pernah_transaksi">Pernah Transaksi</option>
              <option value="semua">Semua Customer</option>
              <option value="minggu_ini">Minggu Ini</option>
              <option value="bulan_ini">Bulan Ini</option>
            </select>
            <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10">
              <option value="all">Semua Waktu</option>
              <option value="week">Minggu Ini</option>
              <option value="month">Bulan Ini</option>
            </select>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10">
              <option value="name">Nama</option>
              <option value="point">Point</option>
              <option value="total">Total Transaksi</option>
            </select>
            <button onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
              className="px-2.5 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-all bg-white">
              {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
            </button>
            <input type="number" placeholder="Point min" value={pointMin} onChange={(e) => setPointMin(e.target.value)}
              className="w-20 px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
            <input type="number" placeholder="Point max" value={pointMax} onChange={(e) => setPointMax(e.target.value)}
              className="w-20 px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Nama</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">WhatsApp</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Point</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Transaksi</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Service</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 dark:text-gray-500">Memuat data...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 dark:text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Tidak ada customer</p>
                </td></tr>
              ) : filteredSorted.map((c, i) => (
                <motion.tr key={c.phone + c.name + i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-gray-900 font-bold text-xs">
                        {(c.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-medium text-slate-900 dark:text-gray-100">{c.name}</span>
                        {c.profesi && <p className="text-[10px] text-slate-400">{c.profesi}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.phone ? (
                      <div>
                        <a href={`https://wa.me/${c.phone.replace(/^0/, "62")}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline">
                          <Phone className="w-3.5 h-3.5" />
                          <span className="font-mono text-sm">{c.phone}</span>
                        </a>
                        {c.email && <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" />{c.email}</p>}
                      </div>
                    ) : <span className="text-slate-400 dark:text-gray-500">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-amber-600">{c.point || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openCustomerDetail(c.phone, "transaksi")}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-all cursor-pointer">
                      <ShoppingCart className="w-3 h-3" />{c.layananCount}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => openCustomerDetail(c.phone, "service")}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-all cursor-pointer">
                      <Watch className="w-3 h-3" />{c.serviceCount}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-gray-100">{c.layananCount + c.serviceCount}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleEdit(c)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-all" title="Edit">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between text-xs text-slate-400 dark:text-gray-500">
              <span>Menampilkan {customers.length} customer</span>
              {hasMore && !search.trim() && (
                <button onClick={loadMore} disabled={loadingMore}
                  className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg hover:bg-slate-700 transition-all disabled:opacity-50">
                  {loadingMore ? "Memuat..." : "Muat lebih banyak"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Import CSV Modal */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => { if (!importing) setShowImport(false); }}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                  <Upload className="w-4 h-4 text-white dark:text-gray-900" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Import Customer</h2>
                  <p className="text-xs text-gray-500">Upload file .csv / .xls / .xlsx</p>
                </div>
              </div>
              <button onClick={() => { if (!importing) setShowImport(false); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Kolom: <code className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-xs">nama</code>, <code className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-xs">nomor_wa</code>, <code className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-xs">point</code>.
                Nomor WhatsApp bisa dengan awalan 0 atau 62.
              </p>
              <div className="border-2 border-dashed border-gray-300 dark:border-white/20 rounded-xl p-6 text-center">
                <input ref={fileInputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={handleCSVImport} />
                {importResult ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 text-emerald-600">
                      <CheckCircle className="w-8 h-8" />
                      <span className="font-semibold">Import Selesai</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{importResult.added}</p>
                        <p className="text-xs text-emerald-600">Ditambahkan</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-center">
                        <p className="text-2xl font-bold text-slate-600">{importResult.skipped}</p>
                        <p className="text-xs text-slate-500">Sudah Ada</p>
                      </div>
                    </div>
                    {importResult.errors.length > 0 && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800 text-xs text-red-600 max-h-24 overflow-y-auto">
                        {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
                      </div>
                    )}
                    <button onClick={() => { setShowImport(false); setImportResult(null); fetchCustomers(false, ""); }}
                      className="w-full py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all text-sm">
                      Selesai
                    </button>
                  </div>
                ) : (
                  <>
                    {importing ? (
                      <div className="py-4 space-y-3">
                        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-400" />
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{importProgress?.phase || "Mengimpor data..."}</p>
                        {importProgress && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>{importProgress.current} / {importProgress.total}</span>
                              <span>{Math.round(importProgress.current / importProgress.total * 100)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2 overflow-hidden">
                              <div className="bg-gray-900 dark:bg-white h-2 rounded-full transition-all duration-300"
                                style={{ width: `${importProgress.current / importProgress.total * 100}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Klik untuk pilih file</p>
                        <button onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-700 transition-all text-sm">
                          Pilih File
                        </button>
                        <p className="text-xs text-gray-400 mt-2 space-x-3">
                          <a href="#" onClick={(e) => { e.preventDefault(); downloadTemplateCSV(); }} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                            <Download className="w-3 h-3" /> Template CSV
                          </a>
                          <a href="#" onClick={(e) => { e.preventDefault(); downloadTemplateXLS(); }} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                            <FileSpreadsheet className="w-3 h-3" /> Template XLS
                          </a>
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {showCustomerDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowCustomerDetail(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${customerDetailMode === "transaksi" ? "bg-blue-600" : "bg-amber-600"}`}>
                  {customerDetailMode === "transaksi" ? <ShoppingCart className="w-4 h-4 text-white" /> : <Watch className="w-4 h-4 text-white" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    {customerDetailMode === "transaksi" ? "Riwayat Transaksi" : "Riwayat Service"}
                  </h2>
                  <p className="text-xs text-gray-500">{customerDetailPhone}</p>
                </div>
              </div>
              <button onClick={() => setShowCustomerDetail(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {customerDetailLoading ? (
                <div className="text-center py-8 text-slate-400">Memuat...</div>
              ) : customerDetailData.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p>Tidak ada {customerDetailMode === "transaksi" ? "transaksi" : "service"}</p>
                </div>
              ) : customerDetailData.map((item, i) => (
                <motion.div key={item.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedDetailItem(item)}
                  className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900 dark:text-gray-100">
                          {customerDetailMode === "transaksi" ? (item as any).customer_name : (item as any).invoice_number}
                        </span>
                        {customerDetailMode === "service" && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${getStatusColor((item as any).status)}`}>
                            {(item as any).status}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                        <span>{fmtDate((item as any).created_at)}</span>
                        {customerDetailMode === "transaksi" && (
                          <span className="font-semibold text-blue-600">{fmtRupiah((item as any).nominal || 0)}</span>
                        )}
                        {customerDetailMode === "service" && (
                          <span className="font-semibold text-blue-600">{fmtRupiah((item as any).estimated_cost || (item as any).final_cost || 0)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      )}

      {/* Detail Item Modal */}
      {selectedDetailItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[55] p-4" onClick={() => setSelectedDetailItem(null)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white dark:text-gray-900" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Detail</h2>
                  <p className="text-xs text-gray-500">{(selectedDetailItem as any).id?.slice(0, 8) || "-"}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDetailItem(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {customerDetailMode === "transaksi" ? (
                <>
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Customer</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{(selectedDetailItem as any).customer_name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{(selectedDetailItem as any).customer_whatsapp}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Nominal</p>
                      <p className="font-bold text-emerald-600 text-lg">{fmtRupiah((selectedDetailItem as any).nominal || 0)}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Jenis</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{(selectedDetailItem as any).jenis_layanan}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Pembayaran</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{paymentLabels[(selectedDetailItem as any).metode_pembayaran] || (selectedDetailItem as any).metode_pembayaran}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Staff</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{(selectedDetailItem as any).handled_by_name || "-"}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 rounded-xl border border-amber-100 dark:border-amber-800">
                    <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900 rounded-xl flex items-center justify-center">
                      <Watch className="w-5 h-5 text-amber-600 dark:text-amber-300" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Invoice</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{(selectedDetailItem as any).invoice_number}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{(selectedDetailItem as any).customer_name} - {(selectedDetailItem as any).customer_phone}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Estimasi</p>
                      <p className="font-bold text-emerald-600 text-lg">{fmtRupiah((selectedDetailItem as any).estimated_cost || 0)}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Brand</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{(selectedDetailItem as any).watch_brand || "-"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Model</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{(selectedDetailItem as any).watch_model || "-"}</p>
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Teknisi</p>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{(selectedDetailItem as any).assigned_teknisi_name || "-"}</p>
                    </div>
                  </div>
                </>
              )}
              <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Waktu</p>
                <p className="text-sm text-gray-700 dark:text-gray-300">{fmtDate((selectedDetailItem as any).created_at)}</p>
              </div>
              {(() => {
                const item = selectedDetailItem as any;
                let urls: string[] = [];
                if (item.photo_urls && Array.isArray(item.photo_urls)) urls = item.photo_urls;
                else if (typeof item.photo_urls === "string") { try { urls = JSON.parse(item.photo_urls); } catch { urls = item.photo_urls ? [item.photo_urls] : []; } }
                else if (item.photo_url) urls = [item.photo_url];
                return urls.length > 0 ? (
                  <div>
                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Foto</p>
                    <div className="grid grid-cols-3 gap-2">
                      {urls.map((url: string, i: number) => (
                        <img key={i} src={url} alt={"foto-" + i}
                          className="rounded-lg border border-gray-200 aspect-square object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => window.open(url, "_blank")} />
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
              {(selectedDetailItem as any).notes && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-100 dark:border-amber-800">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Catatan</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{(selectedDetailItem as any).notes}</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEdit && editData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowEdit(false)}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                  <Edit className="w-4 h-4 text-white dark:text-gray-900" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Edit Customer</h2>
                  <p className="text-xs text-gray-500">Perbarui data customer</p>
                </div>
              </div>
              <button onClick={() => setShowEdit(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nama</label>
                <input type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-[#1c1c1c] dark:border-white/10 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">WhatsApp</label>
                <input type="text" value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-[#1c1c1c] dark:border-white/10 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Point</label>
                <input type="number" min="0" value={editData.point} onChange={(e) => setEditData({ ...editData, point: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-[#1c1c1c] dark:border-white/10 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Briefcase className="w-3 h-3" /> Profesi <span className="text-gray-400 font-normal lowercase">(opsional)</span>
                </label>
                <input type="text" value={editData.profesi || ""} onChange={(e) => setEditData({ ...editData, profesi: e.target.value })}
                  placeholder="Karyawan, Wirausaha, dll"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-[#1c1c1c] dark:border-white/10 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email <span className="text-gray-400 font-normal lowercase">(opsional)</span>
                </label>
                <input type="email" value={editData.email || ""} onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  placeholder="customer@email.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:bg-[#1c1c1c] dark:border-white/10 dark:text-gray-100" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Alamat <span className="text-gray-400 font-normal lowercase">(opsional)</span>
                </label>
                <textarea value={editData.alamat || ""} onChange={(e) => setEditData({ ...editData, alamat: e.target.value })}
                  placeholder="Jl. contoh no. 123"
                  rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none dark:bg-[#1c1c1c] dark:border-white/10 dark:text-gray-100" />
              </div>
              <button onClick={handleEditSave}
                className="w-full py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all text-sm">
                Simpan Perubahan
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}