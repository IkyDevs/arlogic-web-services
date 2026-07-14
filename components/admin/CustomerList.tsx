"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Users, Search, Phone, ShoppingCart, Watch, Upload, X, CheckCircle, AlertCircle, Loader2, Download, FileSpreadsheet } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

export default function CustomerList() {
  const supabase = createClient();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ added: number; skipped: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("customers")
        .select("name, phone, point")
        .order("created_at", { ascending: false })
        .limit(200);

      // Count transactions & services for each customer
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

      const list = (data || []).map((c) => ({
        name: c.name,
        phone: c.phone,
        point: c.point || 0,
        layananCount: layananCounts[c.phone] || 0,
        serviceCount: serviceCounts[c.phone] || 0,
      }));

      setCustomers(list);
    } catch (e: any) {
      console.error("Fetch customers error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, []);

  const filtered = search.trim()
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search.replace(/\D/g, ""))
      )
    : customers;

  function parseRows(data: (string | number)[][]): { name: string; phone: string; point: number }[] {
    if (data.length === 0) return [];
    const rows: { name: string; phone: string; point: number }[] = [];
    let start = 0;
    // Lewati baris instruksi (baris 1 = petunjuk kolom, bukan header)
    if (data.length > 1 && data[1] && String(data[1][0]).includes("Abaikan kolom")) start = 2;
    for (let i = start; i < data.length; i++) {
      const row = data[i];
      if (row.length < 4) continue;
      const name = String(row[2] || "").trim();
      let phone = String(row[3] || "").replace(/\D/g, "");
      const point = parseInt(String(row[7] || "0")) || 0;
      if (!phone.startsWith("62") && phone.startsWith("0")) phone = "62" + phone.substring(1);
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
      let added = 0, skipped = 0;
      const errors: string[] = [];
      for (const row of rows) {
        const { data: existing } = await supabase.from("customers").select("id").eq("phone", row.phone).maybeSingle();
        if (existing) {
          if (row.point > 0) {
            await supabase.from("customers").update({ point: row.point }).eq("id", existing.id);
          }
          skipped++; continue;
        }
        const { error } = await supabase.from("customers").insert({ name: row.name, phone: row.phone, point: row.point });
        if (error) { errors.push(`${row.name}: ${error.message}`); }
        else added++;
      }
      setImportResult({ added, skipped, errors });
    } catch (err: any) {
      toast.error("Gagal membaca file: " + err.message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
            <p className="text-sm text-slate-500 dark:text-gray-400">{customers.length} customer terdaftar</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-gray-400">
            <Upload className="w-4 h-4" /> Import CSV
          </button>
          <button onClick={fetchCustomers}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-gray-400">
            <Search className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-slate-200 dark:border-white/10 p-4 shadow-sm">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau nomor WhatsApp..." autoFocus
            className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm bg-white dark:bg-[#1c1c1c] text-slate-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-900/10 dark:focus:ring-white/10" />
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
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Service Jam</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400 dark:text-gray-500">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400 dark:text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Tidak ada customer</p>
                </td></tr>
              ) : filtered.map((c, i) => (
                <motion.tr key={c.phone || c.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center text-white dark:text-gray-900 font-bold text-xs">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-gray-100">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.phone ? (
                      <a href={`https://wa.me/${c.phone.replace(/^0/, "62")}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 hover:underline">
                        <Phone className="w-3.5 h-3.5" />
                        <span className="font-mono text-sm">{c.phone}</span>
                      </a>
                    ) : <span className="text-slate-400 dark:text-gray-500">-</span>}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-amber-600">
                    {c.point || 0}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <ShoppingCart className="w-3 h-3" />
                      {c.layananCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      <Watch className="w-3 h-3" />
                      {c.serviceCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-slate-900 dark:text-gray-100">
                    {c.layananCount + c.serviceCount}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-400 dark:text-gray-500">
            Menampilkan {filtered.length} dari {customers.length} customer
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
                  <p className="text-xs text-gray-500">Upload file CSV</p>
                </div>
              </div>
              <button onClick={() => { if (!importing) setShowImport(false); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Format file: <code className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-xs">.csv</code> atau <code className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-xs">.xls / .xlsx</code><br />
                Kolom: <code className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-xs">nama</code> dan <code className="bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded text-xs">nomor_wa</code> (dengan atau tanpa header).<br />
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
                    <button onClick={() => { setShowImport(false); setImportResult(null); fetchCustomers(); }}
                      className="w-full py-2.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 transition-all text-sm">
                      Selesai
                    </button>
                  </div>
                ) : (
                  <>
                    {importing ? (
                      <div className="py-4">
                        <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-400" />
                        <p className="text-sm text-gray-500">Mengimpor data...</p>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Klik untuk pilih file CSV</p>
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
    </div>
  );
}
