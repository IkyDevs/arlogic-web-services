"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "framer-motion";
import { Clock, CheckCircle, LogIn, LogOut, Calendar, Users, UserCheck, Timer, Play, Square, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import AttendanceModal from "@/components/teknisi/AttendanceModal";

function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function fmtTime(d: string | Date) {
  return new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function AttendanceDashboard({
  user,
  todayAttendance,
  onAttendanceChange,
}: {
  user: any;
  todayAttendance: any;
  onAttendanceChange: () => void;
}) {
  const supabase = createClient();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<"check_in" | "check_out">("check_in");
  const [allAttendances, setAllAttendances] = useState<any[]>([]);
  const [staffCount, setStaffCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<any>(null);
  const checkInRef = useRef<number>(0);

  // Live counter — ticks every second
  useEffect(() => {
    if (todayAttendance && !todayAttendance.check_out) {
      checkInRef.current = new Date(todayAttendance.check_in).getTime();
      const tick = () => setElapsed(Math.floor((Date.now() - checkInRef.current) / 1000));
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => clearInterval(timerRef.current);
    }
    setElapsed(0);
  }, [todayAttendance]);

  const fetchAttendances = async () => {
    setLoading(true);
    const [attRes, staffRes] = await Promise.all([
      supabase.from("attendances").select("*, profiles:teknisi_id(full_name)").order("check_in", { ascending: false }).limit(50),
      supabase.from("profiles").select("id", { count: "exact", head: true }).in("role", ["admin", "teknisi", "supervisor", "owner"]),
    ]);
    if (attRes.data) setAllAttendances(attRes.data);
    if (staffRes.count !== null) setStaffCount(staffRes.count);
    setLoading(false);
  };

  useEffect(() => {
    fetchAttendances();
  }, []);

  const handleAttendance = (type: "check_in" | "check_out") => {
    if (type === "check_in" && todayAttendance) { toast.error("Sudah check in hari ini!"); return; }
    if (type === "check_out" && !todayAttendance) { toast.error("Check in dulu!"); return; }
    if (type === "check_out" && todayAttendance?.check_out) { toast.error("Sudah check out!"); return; }
    setModalType(type);
    setShowModal(true);
  };

  const handleSuccess = () => {
    setShowModal(false);
    onAttendanceChange();
    fetchAttendances();
    toast.success(modalType === "check_in" ? "Check in berhasil!" : "Check out berhasil!");
  };

  const todayEntries = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return allAttendances.filter((a) => a.check_in?.startsWith(today));
  }, [allAttendances]);

  const todayTotalMinutes = useMemo(() => {
    let total = todayEntries.reduce((sum, a) => {
      if (a.check_in && a.check_out) {
        return sum + Math.floor((new Date(a.check_out).getTime() - new Date(a.check_in).getTime()) / 60000);
      }
      return sum;
    }, 0);
    if (todayAttendance && !todayAttendance.check_out && checkInRef.current > 0) {
      total += Math.floor((Date.now() - checkInRef.current) / 60000);
    }
    return total;
  }, [todayEntries, todayAttendance, elapsed]);

  const attendanceCount = useMemo(() => {
    const month = new Date().toISOString().slice(0, 7);
    return allAttendances.filter((a) => a.check_in?.startsWith(month) && a.check_out).length;
  }, [allAttendances]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Absensi</h1>
        <p className="text-sm text-slate-500 mt-0.5">Management absensi staff dan timer real-time</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-50 to-blue-100/60 rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-slate-500">Hadir Hari Ini</p>
              <p className="text-xl lg:text-2xl font-bold text-slate-900 mt-0.5">{todayEntries.length}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/50"><UserCheck className="w-4 h-4 text-blue-600" /></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-slate-500">Total Jam Hari Ini</p>
              <p className="text-xl lg:text-2xl font-bold text-slate-900 mt-0.5">{fmtDuration(todayTotalMinutes)}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/50"><Timer className="w-4 h-4 text-emerald-600" /></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-50 to-purple-100/60 rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-slate-500">Absensi Bulan Ini</p>
              <p className="text-xl lg:text-2xl font-bold text-slate-900 mt-0.5">{attendanceCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/50"><Calendar className="w-4 h-4 text-purple-600" /></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-gradient-to-br from-amber-50 to-amber-100/60 rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] md:text-xs font-medium text-slate-500">Total Staff</p>
              <p className="text-xl lg:text-2xl font-bold text-slate-900 mt-0.5">{staffCount}</p>
            </div>
            <div className="p-2 rounded-lg bg-white/50"><Users className="w-4 h-4 text-amber-600" /></div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Check-in/out + Timer Card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm lg:col-span-1">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" /> Status Absensi
          </h3>

          <div className={`rounded-xl p-4 mb-4 border text-center ${todayAttendance && !todayAttendance.check_out ? "bg-emerald-50 border-emerald-200" : todayAttendance?.check_out ? "bg-slate-50 border-slate-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              {todayAttendance && !todayAttendance.check_out ? (
                <><Play className="w-5 h-5 text-emerald-600" /><span className="font-bold text-emerald-700">Sedang Bekerja</span></>
              ) : todayAttendance?.check_out ? (
                <><Square className="w-5 h-5 text-slate-500" /><span className="font-bold text-slate-600">Selesai</span></>
              ) : (
                <><Clock className="w-5 h-5 text-amber-600" /><span className="font-bold text-amber-700">Belum Check In</span></>
              )}
            </div>

            {/* Live Timer */}
            {todayAttendance && !todayAttendance.check_out && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-1">Durasi Bekerja</p>
                <p className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                  {String(Math.floor(elapsed / 3600)).padStart(2, "0")}:{String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                </p>
                <p className="text-xs text-slate-400 mt-1">Check in: {fmtTime(todayAttendance.check_in)}</p>
              </div>
            )}
            {todayAttendance?.check_out && (
              <p className="text-xs text-slate-500 mt-2">Check in: {fmtTime(todayAttendance.check_in)} &rarr; Check out: {fmtTime(todayAttendance.check_out)}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={() => handleAttendance("check_in")} disabled={!!todayAttendance}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all disabled:opacity-40 text-sm">
              <LogIn className="w-4 h-4" /> Check In
            </button>
            <button onClick={() => handleAttendance("check_out")} disabled={!todayAttendance || !!todayAttendance?.check_out}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-white font-medium rounded-xl hover:bg-slate-900 transition-all disabled:opacity-40 text-sm">
              <LogOut className="w-4 h-4" /> Check Out
            </button>
          </div>
        </motion.div>

        {/* Attendance List */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" /> Riwayat Absensi
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2.5 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Staff</th>
                  <th className="text-left py-2.5 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Tanggal</th>
                  <th className="text-left py-2.5 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Check In</th>
                  <th className="text-left py-2.5 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Check Out</th>
                  <th className="text-left py-2.5 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Durasi</th>
                  <th className="text-left py-2.5 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading...</td></tr>
                ) : allAttendances.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">Belum ada absensi</td></tr>
                ) : allAttendances.slice(0, 20).map((att, i) => {
                  const duration = att.check_in && att.check_out
                    ? Math.floor((new Date(att.check_out).getTime() - new Date(att.check_in).getTime()) / 60000)
                    : 0;
                  const isActive = att.check_in && !att.check_out;
                  return (
                    <motion.tr key={att.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-slate-800 rounded-full flex items-center justify-center text-white font-semibold text-[10px]">
                            {(att.profiles?.full_name || "?").charAt(0)}
                          </div>
                          <span className="font-medium text-slate-900 text-xs">{att.profiles?.full_name || "Unknown"}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-xs text-slate-600">{fmtDate(att.check_in)}</td>
                      <td className="py-2.5 px-2 text-xs font-mono text-slate-700">{fmtTime(att.check_in)}</td>
                      <td className="py-2.5 px-2 text-xs font-mono text-slate-700">{att.check_out ? fmtTime(att.check_out) : "-"}</td>
                      <td className="py-2.5 px-2 text-xs font-semibold text-slate-900">{duration > 0 ? fmtDuration(duration) : "-"}</td>
                      <td className="py-2.5 px-2">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Aktif
                          </span>
                        ) : att.check_out ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle className="w-3 h-3" /> Selesai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                            - 
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Attendance Modal */}
      <AttendanceModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        type={modalType}
        existingAttendance={todayAttendance}
      />
    </div>
  );
}
