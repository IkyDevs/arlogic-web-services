"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Clock, Search, Download, ChevronDown, ChevronUp, Calendar } from "lucide-react";

type FilterPeriod = "hari" | "minggu" | "bulan" | "tahun";

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("id-ID", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function calcDuration(checkIn: string, checkOut: string | null): string {
  if (!checkOut) return "-";
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}j ${mins}m`;
}

export default function AttendanceReport() {
  const supabase = createClient();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("hari");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("check_in");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const getDateRange = () => {
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    if (filterPeriod === "minggu") start.setDate(now.getDate() - 7);
    else if (filterPeriod === "bulan") start.setMonth(now.getMonth() - 1);
    else if (filterPeriod === "tahun") start.setFullYear(now.getFullYear() - 1);
    return { start: start.toISOString(), end: now.toISOString() };
  };

  const fetchAttendance = async () => {
    setLoading(true);
    const { start, end } = getDateRange();
    const { data } = await supabase
      .from("attendances")
      .select("*, profiles:teknisi_id(full_name)")
      .gte("check_in", start)
      .lte("check_in", end)
      .order(sortField, { ascending: sortDir === "asc" });

    if (data) setRecords(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchAttendance();
  }, [filterPeriod, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const filtered = search.trim()
    ? records.filter((r) =>
        r.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
      )
    : records;

  const exportCSV = () => {
    const headers = ["Tanggal", "Staff", "Check In", "Check Out", "Durasi", "Status"];
    const rows = filtered.map((r) => [
      fmtDate(r.check_in),
      r.profiles?.full_name || "-",
      fmtTime(r.check_in),
      r.check_out ? fmtTime(r.check_out) : "-",
      calcDuration(r.check_in, r.check_out),
      !r.check_out ? "Active" : r.is_overtime ? "Lembur" : "Selesai",
    ]);
    const csv = [headers, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `absensi_${filterPeriod}_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Laporan Absensi</h1>
            <p className="text-sm text-slate-500">Rekap absensi semua staff</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={fetchAttendance}
            className="flex items-center gap-2 px-3 py-2 text-sm border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
            <Clock className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {(["hari", "minggu", "bulan", "tahun"] as FilterPeriod[]).map((p) => (
              <button key={p} onClick={() => setFilterPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterPeriod === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                {p === "hari" ? "Harian" : p === "minggu" ? "Mingguan" : p === "bulan" ? "Bulanan" : "Tahunan"}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari staff..." className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-900 select-none" onClick={() => toggleSort("check_in")}>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tanggal <SortIcon field="check_in" /></div>
                </th>
                <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-900 select-none" onClick={() => { setSortField("profiles.full_name"); setSortDir((d) => d === "asc" ? "desc" : "asc"); }}>
                  <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Staff <SortIcon field="profiles.full_name" /></div>
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Check In</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Check Out</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Durasi</th>
                <th className="px-4 py-3 text-center text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Tidak ada data absensi</p>
                </td></tr>
              ) : filtered.map((r, i) => (
                <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(r.check_in)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.profiles?.full_name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{fmtTime(r.check_in)}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{r.check_out ? fmtTime(r.check_out) : "-"}</td>
                  <td className="px-4 py-3 text-center text-sm text-slate-700">{calcDuration(r.check_in, r.check_out)}</td>
                  <td className="px-4 py-3 text-center">
                    {!r.check_out ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border bg-yellow-100 text-yellow-700 border-yellow-200">Active</span>
                    ) : r.is_overtime ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border bg-orange-100 text-orange-700 border-orange-200">Lembur</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full border bg-green-100 text-green-700 border-green-200">Selesai</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            Menampilkan {filtered.length} dari {records.length} absensi
          </div>
        )}
      </div>
    </div>
  );
}
