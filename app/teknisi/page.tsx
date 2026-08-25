"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { hasDraft } from "@/lib/draftStorage";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/ui/NotificationBell";
import ReportModal from "@/components/ui/ReportModal";
import UserAvatar from "@/components/ui/UserAvatar";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
  LogOut,
  Bell,
  Clock,
  Menu,
  X,
  Watch,
  Zap,
  Award,
  Shield,
  UserCheck,
  User,
  FileWarning,
  Eye,
  Wrench,
  Search as SearchIcon,
  Star,
  Users,
  Package,
  AlertCircle,
  FileText,
  Box,
  Activity,
  ArrowRightLeft,
  Cpu,
  Search,
  LogIn,
  CheckCircle,
  ClipboardCheck,
} from "lucide-react";
import AttendanceModal from "@/components/teknisi/AttendanceModal";
import CustomerList from "@/components/admin/CustomerList";
import TeknisiStockView from "@/components/teknisi/TeknisiStockView";
import TeknisiTransferView from "@/components/teknisi/TeknisiTransferView";
import QCProcessView from "@/components/teknisi/QCProcessView";
import QueueList from "@/components/teknisi/QueueList";
import ProgressUpdate from "@/components/teknisi/ProgressUpdate";
import LayananForm from "@/components/layanan/LayananForm";
import TransactionManagement from "@/components/layanan/TransactionManagement";
import KaspinUpdate from "@/components/teknisi/KaspinUpdate";
import DoneService from "@/components/admin/DoneService";
import ThemeToggle from "@/components/ThemeToggle";
import MobileBottomNav from "@/components/ui/MobileBottomNav";
import toast from "react-hot-toast";

import dynamic from "next/dynamic";

const ServiceTimeline = dynamic(
  () => import("@/components/teknisi/ServiceTimeline"),
  {
    loading: () => (
      <div className="text-center py-8 text-[var(--color-text-tertiary)]">Loading...</div>
    ),
  },
);
const AttendanceDashboard = dynamic(
  () => import("@/components/admin/AttendanceDashboard"),
  {
    loading: () => (
      <div className="text-center py-8 text-[var(--color-text-tertiary)]">Loading...</div>
    ),
  },
);
const ServiceInput = dynamic(() => import("@/components/admin/ServiceInput"), {
  loading: () => (
    <div className="text-center py-8 text-[var(--color-text-tertiary)]">Loading...</div>
  ),
});
const ServiceList = dynamic(() => import("@/components/admin/ServiceList"), {
  loading: () => (
    <div className="text-center py-8 text-[var(--color-text-tertiary)]">Loading...</div>
  ),
});

export default function TeknisiDashboard() {
  const [activeTab, setActiveTab] = useState("queue");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceType, setAttendanceType] = useState<
    "check_in" | "check_out"
  >("check_in");
  const [showLayananForm, setShowLayananForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<
    "hari" | "bulan" | "tahun" | undefined
  >("hari");
  const [layananDate, setLayananDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [stats, setStats] = useState({
    completedToday: 0,
    completedThisMonth: 0,
    inProgress: 0,
    pendingQueue: 0,
    averageTime: 2.5,
    rating: 0,
    totalEarnings: 0,
    attendance: 0,
    completionRate: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sparepartSearch, setSparepartSearch] = useState("");
  const [sparepartResults, setSparepartResults] = useState<any[]>([]);
  const [sparepartSearching, setSparepartSearching] = useState(false);
  const [showSparepartResults, setShowSparepartResults] = useState(false);

  // Close sparepart search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".sparepart-search-container")) {
        setShowSparepartResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { user } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".sparepart-search-container")) {
        setShowSparepartResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const checkTodayAttendance = async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("attendances")
      .select("*")
      .eq("teknisi_id", user?.id)
      .gte("check_in", today)
      .lte("check_in", today + " 23:59:59")
      .order("check_in", { ascending: false })
      .limit(1)
      .single();

    setTodayAttendance(data || null);
  };

  const fetchStats = async () => {
    const today = new Date().toISOString().split("T")[0];
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).toISOString();

    // Get teknisi's completed orders this month
    const { data: completedOrders } = await supabase
      .from("service_orders")
      .select("id, final_cost")
      .eq("assigned_teknisi_id", user?.id)
      .eq("status", "completed");

    // Get service items for these orders
    const orderIds = completedOrders?.map((o) => o.id) || [];
    const { data: items } =
      orderIds.length > 0
        ? await supabase
            .from("service_items")
            .select("price, quantity, item_type, service_order_id")
            .in("service_order_id", orderIds)
        : { data: [] };

    const totalEarnings = (items || []).reduce(
      (sum: number, item: any) =>
        sum + (item.price || 0) * (item.quantity || 1),
      0,
    );

    // Counts using updated_at for this month
    const thisMonthCompleted = (completedOrders || []).filter((o) => {
      // Try completed_at first, fall back to any date-based filter
      return true; // already filtered by status=completed
    }).length;

    const [
      completedTodayCount,
      inProgressCount,
      pendingQueueCount,
      ratingData,
      attendanceData,
    ] = await Promise.all([
      supabase
        .from("service_orders")
        .select("*", { count: "exact", head: true })
        .eq("assigned_teknisi_id", user?.id)
        .eq("status", "completed")
        .gte("updated_at", today),
      supabase
        .from("service_orders")
        .select("*", { count: "exact", head: true })
        .eq("assigned_teknisi_id", user?.id)
        .in("status", ["assigned", "in_progress"]),
      supabase
        .from("service_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("feedbacks").select("rating").eq("teknisi_id", user?.id),
      supabase
        .from("attendances")
        .select("*", { count: "exact", head: true })
        .eq("teknisi_id", user?.id)
        .gte("check_in", startOfMonth),
    ]);

    // Compute real rating
    const ratings = ratingData.data || [];
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((s: number, r: any) => s + (r.rating || 0), 0) /
          ratings.length
        : 0;

    // Compute real attendance (days with check_in this month / total work days)
    const attendanceDays = attendanceData.count || 0;
    const workDaysThisMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0,
    ).getDate();
    const attendancePct =
      workDaysThisMonth > 0
        ? Math.round((attendanceDays / workDaysThisMonth) * 100)
        : 0;

    // Completion rate
    const totalJobs = thisMonthCompleted + (inProgressCount.count || 0);
    const completionRate =
      totalJobs > 0 ? Math.round((thisMonthCompleted / totalJobs) * 100) : 0;

    setStats({
      completedToday: completedTodayCount.count || 0,
      completedThisMonth: thisMonthCompleted,
      inProgress: inProgressCount.count || 0,
      pendingQueue: pendingQueueCount.count || 0,
      averageTime: 2.5,
      rating: avgRating || 0,
      totalEarnings: totalEarnings,
      attendance: attendancePct,
      completionRate: completionRate,
    });
  };

  const fetchRecentActivities = async () => {
    const { data } = await supabase
      .from("activity_logs")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false })
      .limit(5);

    if (data) {
      const formatted = data.map((log) => ({
        id: log.id,
        message: log.action.replace(/_/g, " ").toLowerCase(),
        time: getRelativeTime(log.created_at),
        details: log.details,
      }));
      setRecentActivities(formatted);
    }
  };

  const fetchAllData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        await Promise.all([
          checkTodayAttendance(),
          fetchStats(),
          fetchRecentActivities(),
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
        if (!silent) toast.error("Gagal memuat data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user],
  );

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(() => fetchAllData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-open draft modal ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const check = async () => {
      if (hasDraft("layanan", user.id)) {
        setActiveTab("layanan");
        setTimeout(() => setShowLayananForm(true), 300);
      } else if (hasDraft("pengeluaran", user.id)) {
        setActiveTab("layanan");
        setTimeout(() => window.dispatchEvent(new CustomEvent("open-expense-form")), 600);
      } else if (hasDraft("service", user.id)) {
        setActiveTab("service");
        setTimeout(() => setShowServiceForm(true), 300);
      }
    };
    check();
  }, [user?.id]);

  const getRelativeTime = (date: string) => {
    const now = new Date();
    const past = new Date(date);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Baru saja";
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return past.toLocaleDateString();
  };

  const handleAttendance = (type: "check_in" | "check_out") => {
    if (type === "check_in" && todayAttendance) {
      toast.error("Anda sudah check in hari ini!");
      return;
    }
    if (type === "check_out" && !todayAttendance) {
      toast.error("Anda harus check in dulu!");
      return;
    }
    if (type === "check_out" && todayAttendance?.check_out) {
      toast.error("Anda sudah check out hari ini!");
      return;
    }

    setAttendanceType(type);
    setShowAttendance(true);
  };

  const handleAttendanceSuccess = () => {
    checkTodayAttendance();
    fetchRecentActivities();
    toast.success(
      `Absensi ${attendanceType === "check_in" ? "masuk" : "pulang"} berhasil!`,
    );
  };

  const handleLayananSuccess = () => {
    setShowLayananForm(false);
    toast.success("Layanan berhasil ditambahkan!");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    toast.success("Logout berhasil");
  };

  const getAttendanceStatus = () => {
    if (!todayAttendance)
      return {
        text: "Belum Absen",
        color: "text-red-500",
        bg: "bg-red-50",
        icon: "❌",
      };
    if (!todayAttendance.check_out)
      return {
        text: "Checked In",
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: "✅",
      };
    return {
      text: "Selesai",
      color: "text-green-600",
      bg: "bg-green-50",
      icon: "✓",
    };
  };

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(nominal);
  };

  const attendanceStatus = getAttendanceStatus();

  const menuItems = [
    { id: "queue", label: "Antrean & Proyek", icon: ClipboardList },
    { id: "pending", label: "Pending", icon: Clock },
    { id: "stats", label: "Performa", icon: TrendingUp },
    { id: "absensi", label: "Absensi", icon: Clock },
    { id: "stock", label: "Stock Toko", icon: Package },
    { id: "customer", label: "Customer", icon: Users },
    { id: "kaspin", label: "Kaspin", icon: Package },
    { id: "service", label: "List Service", icon: Wrench },
    { id: "layanan", label: "Transaksi", icon: FileText },
    { id: "done", label: "Done", icon: CheckCircle },
    { id: "qc-process", label: "QC Process", icon: ClipboardCheck },
    ...(user?.is_stock_approver
      ? [{ id: "transfer", label: "Transfer", icon: ArrowRightLeft }]
      : []),
    ...(user?.is_engineer
      ? [{ id: "engineer", label: "Engineer", icon: Cpu }]
      : []),
  ];

  const NAV_GROUPS = [
    { title: "Workspace", ids: ["queue", "pending", "stats", "absensi"] },
    { title: "Operasi", ids: ["stock", "customer", "kaspin", "layanan"] },
    { title: "Quality", ids: ["qc-process", "done", "transfer", "engineer"] },
    { title: "Personal", ids: ["service"] },
  ];

  if (loading) {
    return (
<div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[var(--color-accent-teal)] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-[var(--color-text-secondary)] font-medium">
          Loading dashboard...
        </p>
      </div>
    </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] lg:flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-container fixed top-0 left-0 h-full w-[240px] bg-[var(--color-sidebar)] z-50 flex flex-col py-4 sm:py-5 shadow-2xl lg:shadow-none lg:translate-x-0 lg:static lg:z-auto lg:h-screen lg:sticky lg:top-0 transition-transform duration-300 ease-in-out border-r border-[var(--color-border)] overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 mb-4 flex-shrink-0">
          <div className="w-10 h-10 bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)] rounded-xl flex items-center justify-center flex-shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-[var(--color-text)] leading-tight">
              WatchService
            </h1>
            <p className="text-[10px] text-[var(--color-text-tertiary)]">
              Teknisi Panel
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto p-1.5 hover:bg-[var(--color-surface)] rounded-lg"
          >
            <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV_GROUPS.map((group) => {
            const items = group.ids
              .map((id) => menuItems.find((m) => m.id === id))
              .filter(Boolean) as typeof menuItems;
            if (items.length === 0) return null;
            return (
              <div key={group.title} className="mb-1">
                <p className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-tertiary)]">
                  {group.title}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.id === "engineer") {
                          router.push("/engineer");
                          return;
                        }
                        setActiveTab(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full h-10 px-3 text-[13px] font-medium flex items-center gap-3 rounded-lg transition-colors ${
                        activeTab === item.id
                          ? "bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)]"
                          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                      }`}
                    >
                      <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-1.5 px-3 pt-4 pb-2 border-t border-[var(--color-border)] flex-shrink-0">
          {/* Attendance */}
          <button
            onClick={() =>
              handleAttendance(
                todayAttendance && !todayAttendance.check_out
                  ? "check_out"
                  : "check_in",
              )
            }
            disabled={!!todayAttendance?.check_out}
            className={`w-full h-10 px-3 text-[13px] font-medium flex items-center gap-3 rounded-lg transition-colors ${
              !todayAttendance
                ? "bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)] hover:bg-[var(--color-accent-teal-soft)]/60"
                : todayAttendance.check_out
                  ? "text-[var(--color-text-tertiary)] cursor-not-allowed"
                  : "bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-elevated)]"
            }`}
          >
            {!todayAttendance ? (
              <LogIn className="w-[18px] h-[18px] flex-shrink-0" />
            ) : todayAttendance.check_out ? (
              <CheckCircle className="w-[18px] h-[18px] flex-shrink-0" />
            ) : (
              <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            )}
            <span className="truncate">
              {!todayAttendance
                ? "Absen"
                : todayAttendance.check_out
                  ? "Completed"
                  : "Absen Pulang"}
            </span>
          </button>

          {/* Theme Toggle */}
          <div className="px-3 py-2 flex items-center gap-3 text-[var(--color-text-secondary)]">
            <ThemeToggle />
            <span className="text-[13px] font-medium">Theme</span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full h-10 px-3 text-[13px] font-medium flex items-center gap-3 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors"
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 sm:top-4 sm:left-4 z-30 lg:hidden bg-[var(--color-card)] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg border border-[var(--color-border)]"
      >
        <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--color-text)]" />
      </button>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 min-h-screen flex flex-col w-full max-w-full overflow-x-hidden pb-16 lg:pb-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 px-3 py-3 sm:px-4 sm:py-4">
          <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl sm:rounded-2xl px-4 py-3 sm:px-5 flex items-center justify-between gap-2 sm:gap-4">
            {/* Spacer for mobile menu button */}
            <div className="hidden lg:block w-12" />

            {/* Greeting - Center on mobile */}
            <div className="flex-1 min-w-0 text-center lg:text-left px-1">
              <h1 className="text-[15px] sm:text-lg font-bold text-[var(--color-text)] leading-tight truncate">
                Selamat pagi, {user?.full_name || "Teknisi"} 👋
              </h1>
              <p className="text-xs sm:text-[13px] text-[var(--color-text-secondary)] truncate hidden sm:block">
                Berikut pekerjaan yang perlu kamu selesaikan hari ini.
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              {/* Notification */}
              <div className="notification-trigger">
                              {/* Lapor */}
              <button
                onClick={() => setShowReport(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--color-warning-bg)] text-[var(--color-warning)] rounded-lg hover:opacity-80 transition-opacity text-xs font-semibold flex-shrink-0"
                title="Lapor bug / request fitur"
              >
                <FileWarning className="w-4 h-4" />
                <span className="hidden sm:inline">Lapor</span>
              </button>

                <NotificationBell open={showNotifications} setOpen={setShowNotifications} />
              </div>

              {/* Profile */}
              <UserAvatar user={user} />
            </div>
          </div>
        </header>

        {/* ==================== CONTENT ==================== */}
        <main className="flex-1 p-2 sm:p-3 md:p-4">
          <AnimatePresence mode="wait">
            {activeTab === "queue" && (
              <motion.div
                key="queue"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-3 sm:space-y-4 md:space-y-5"
              >
                {/* Queue List Component */}
                <QueueList
                  teknisiId={user?.id || ""}
                  onTakeProject={(service) => setSelectedService(service)}
                />

                {/* Recent Activity */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl p-4 sm:p-5"
                >
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)] rounded-lg flex items-center justify-center">
                      <Activity className="w-4 h-4" />
                    </div>
                    <h3 className="font-semibold text-sm sm:text-base text-[var(--color-text)]">
                      Aktivitas Terbaru
                    </h3>
                  </div>
                  <div className="relative">
                    <div
                      className="absolute left-[7px] top-2 bottom-8 w-px bg-[var(--color-border)]"
                      aria-hidden="true"
                    />
                    <div className="space-y-1">
                    {recentActivities.map((activity, i) => (
                      <div
                        key={activity.id}
                        onClick={() => {
                          if (activity.details) {
                            setSelectedActivity(activity);
                            setShowActivityModal(true);
                          }
                        }}
                        className={`relative flex items-start gap-3 p-2 rounded-lg ${
                          activity.details
                            ? "cursor-pointer hover:bg-[var(--color-surface)] transition-colors"
                            : ""
                        }`}
                      >
                        <span
                          className="absolute left-[6px] top-[15px] w-[6px] h-[6px] rounded-full bg-[var(--color-accent-teal)] ring-4 ring-[var(--color-accent-teal-soft)]"
                          aria-hidden="true"
                        />
                        <div className="flex-1 min-w-0 ml-8">
                          <p className="text-xs sm:text-sm text-[var(--color-text)] truncate">
                            {activity.message}
                          </p>
                          <p className="text-[10px] sm:text-xs text-[var(--color-text-tertiary)]">
                            {activity.time}
                          </p>
                        </div>
                        {activity.details && (
                          <div className="text-[10px] text-[var(--color-accent-teal)] flex-shrink-0 font-medium">
                            Detail →
                          </div>
                        )}
                      </div>
                    ))}
                    {recentActivities.length === 0 && (
                      <div className="text-center py-6 text-[var(--color-text-tertiary)]">
                        <p className="text-xs sm:text-sm">
                          Belum ada aktivitas
                        </p>
                      </div>
                    )}
                    </div>
                  </div>
                </motion.div>

                {/* Activity Detail Modal */}
                {showActivityModal && selectedActivity && (
                  <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
                    onClick={() => setShowActivityModal(false)}
                  >
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-[var(--color-card)] rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl border border-[var(--color-border)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="sticky top-0 bg-[var(--color-card)] z-20 flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)] rounded-t-2xl">
                        <h2 className="text-sm font-bold text-[var(--color-text)]">
                          Detail Aktivitas
                        </h2>
                        <button
                          onClick={() => setShowActivityModal(false)}
                          className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
                        </button>
                      </div>
                      <div className="p-5 space-y-3">
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {selectedActivity.time}
                        </p>
                        <p className="text-sm font-medium text-[var(--color-text)] capitalize">
                          {selectedActivity.message}
                        </p>

                        {/* Customer Info */}
                        {selectedActivity.details?.customer_name && (
                          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-800 p-3 space-y-1.5">
                            <div className="flex items-center gap-2 text-sm">
                              <User className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-gray-900 dark:text-gray-100">
                                {selectedActivity.details.customer_name}
                              </span>
                            </div>
                            {selectedActivity.details.customer_phone && (
                              <p className="text-xs text-gray-500 pl-6">
                                WA: {selectedActivity.details.customer_phone}
                              </p>
                            )}
                            <div className="flex items-center gap-3 pl-6 text-xs text-gray-500 flex-wrap">
                              {selectedActivity.details.watch_brand && (
                                <span>
                                  Brand: {selectedActivity.details.watch_brand}
                                </span>
                              )}
                              {selectedActivity.details.serial_number && (
                                <span>
                                  Serial:{" "}
                                  {selectedActivity.details.serial_number}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Invoice */}
                        {selectedActivity.details?.invoice && (
                          <div className="bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-3">
                            <p className="text-xs text-gray-500">Invoice</p>
                            <p className="text-sm font-mono font-semibold text-gray-900 dark:text-gray-100">
                              {selectedActivity.details.invoice}
                            </p>
                          </div>
                        )}

                        {/* Photos */}
                        {selectedActivity.details?.photo_urls &&
                          Array.isArray(selectedActivity.details.photo_urls) &&
                          selectedActivity.details.photo_urls.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                Foto Jam
                              </p>
                              <div className="grid grid-cols-3 gap-2">
                                {selectedActivity.details.photo_urls
                                  .slice(0, 6)
                                  .map((url: string, i: number) => (
                                    <img
                                      key={i}
                                      src={url}
                                      alt={"foto-" + i}
                                      className="rounded-lg border border-gray-200 dark:border-white/10 aspect-square object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => window.open(url, "_blank")}
                                    />
                                  ))}
                              </div>
                            </div>
                          )}

                        {/* Items Before */}
                        {selectedActivity.details?.items_before &&
                          Array.isArray(
                            selectedActivity.details.items_before,
                          ) &&
                          selectedActivity.details.items_before.length > 0 && (
                            <div className="bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-3 space-y-1.5">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                Item Sebelum Revisi
                              </p>
                              {selectedActivity.details.items_before.map(
                                (item: any, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className={`px-1 py-0.5 text-[10px] font-medium rounded ${item.item_type === "jasa" ? "bg-pink-100 text-pink-700" : "bg-purple-100 text-purple-700"}`}
                                      >
                                        {item.item_type === "jasa"
                                          ? "JASA"
                                          : "SPR"}
                                      </span>
                                      <span className="truncate text-gray-700 dark:text-gray-300">
                                        {item.name}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        x{item.quantity}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                                      Rp{" "}
                                      {Number(item.price).toLocaleString(
                                        "id-ID",
                                      )}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          )}

                        {/* Items After */}
                        {selectedActivity.details?.items_after &&
                          Array.isArray(selectedActivity.details.items_after) &&
                          selectedActivity.details.items_after.length > 0 && (
                            <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-3 space-y-1.5">
                              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
                                Item Setelah Revisi
                              </p>
                              {selectedActivity.details.items_after.map(
                                (item: any, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span
                                        className={`px-1 py-0.5 text-[10px] font-medium rounded ${item.item_type === "jasa" ? "bg-pink-100 text-pink-700" : "bg-purple-100 text-purple-700"}`}
                                      >
                                        {item.item_type === "jasa"
                                          ? "JASA"
                                          : "SPR"}
                                      </span>
                                      <span className="truncate text-gray-700 dark:text-gray-300">
                                        {item.name}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        x{item.quantity}
                                      </span>
                                    </div>
                                    <span className="font-semibold text-emerald-700">
                                      Rp{" "}
                                      {Number(item.price).toLocaleString(
                                        "id-ID",
                                      )}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          )}

                        {/* Changes Summary */}
                        {selectedActivity.details?.changes &&
                          Array.isArray(selectedActivity.details.changes) && (
                            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800 p-3 space-y-1.5">
                              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                                Perubahan oleh QC:
                              </p>
                              {selectedActivity.details.changes.map(
                                (change: string, i: number) => (
                                  <div
                                    key={i}
                                    className="flex items-start gap-2 text-sm"
                                  >
                                    <span className="text-amber-500 mt-0.5">
                                      •
                                    </span>
                                    <span className="text-gray-700 dark:text-gray-300">
                                      {change}
                                    </span>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                      </div>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === "pending" && (
              <motion.div
                key="pending"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <QueueList
                  teknisiId={user?.id || ""}
                  onTakeProject={(service) => setSelectedService(service)}
                  forcedTab="pending"
                />
              </motion.div>
            )}

            {activeTab === "stats" && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid md:grid-cols-2 gap-3 sm:gap-4 md:gap-6"
              >
                {/* Performance Stats */}
                <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-white/10">
                    <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-white dark:text-gray-900" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Metrik Performa
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {/* Completion Rate */}
                    <div>
                      <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-gray-600 dark:text-gray-400">
                          Completion Rate
                        </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {stats.completionRate}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-900 rounded-full"
                          style={{ width: stats.completionRate + "%" }}
                        />
                      </div>
                    </div>

                    {/* Average Service Time */}
                    <div>
                      <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-gray-600 dark:text-gray-400">
                          Rata-rata Waktu Service
                        </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {stats.averageTime} hari
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gray-900 rounded-full"
                          style={{
                            width: Math.min(stats.averageTime * 25, 100) + "%",
                          }}
                        />
                      </div>
                    </div>

                    {/* Customer Rating */}
                    <div>
                      <div className="flex justify-between text-sm font-medium mb-1">
                        <span className="text-gray-600 dark:text-gray-400">
                          Rating Customer
                        </span>
                        <span className="text-gray-900 dark:text-gray-100">
                          {stats.rating > 0 ? stats.rating.toFixed(1) : "-"} /
                          5.0
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-5 h-5 ${star <= Math.round(stats.rating) ? "fill-amber-400 text-amber-500" : "text-gray-300 dark:text-gray-600"}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Summary row */}
                    <div className="pt-3 border-t border-gray-200 dark:border-white/10">
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {stats.completedThisMonth}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase">
                            Selesai
                          </p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-emerald-600">
                            {formatRupiah(stats.totalEarnings)}
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase">
                            Pendapatan
                          </p>
                        </div>
                        <div>
                          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {stats.attendance}%
                          </p>
                          <p className="text-[10px] text-gray-400 uppercase">
                            Kehadiran
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Achievements */}
                <div className="bg-white dark:bg-[#1c1c1c] rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-white/10">
                    <div className="w-8 h-8 bg-gray-900 dark:bg-white rounded-lg flex items-center justify-center">
                      <Award className="w-4 h-4 text-white dark:text-gray-900" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Pencapaian
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div
                      className={`text-center p-3 rounded-xl border ${stats.completedThisMonth >= 1 ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200 dark:bg-white/5 dark:border-white/10"}`}
                    >
                      <Zap
                        className={`w-8 h-8 mx-auto mb-1.5 ${stats.completedThisMonth >= 1 ? "text-emerald-600" : "text-gray-400"}`}
                      />
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        First Service
                      </p>
                      <p className="text-[10px] text-gray-500">
                        Selesaikan 1 service
                      </p>
                    </div>
                    <div
                      className={`text-center p-3 rounded-xl border ${stats.completedThisMonth >= 10 ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200 dark:bg-white/5 dark:border-white/10"}`}
                    >
                      <Shield
                        className={`w-8 h-8 mx-auto mb-1.5 ${stats.completedThisMonth >= 10 ? "text-emerald-600" : "text-gray-400"}`}
                      />
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        Quality Expert
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {stats.completedThisMonth}/10 service
                      </p>
                    </div>
                    <div
                      className={`text-center p-3 rounded-xl border ${stats.rating >= 4.5 ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200 dark:bg-white/5 dark:border-white/10"}`}
                    >
                      <Star
                        className={`w-8 h-8 mx-auto mb-1.5 ${stats.rating >= 4.5 ? "text-amber-500 fill-amber-500" : "text-gray-400"}`}
                      />
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        Top Rated
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {stats.rating > 0 ? stats.rating.toFixed(1) : "-"} / 5.0
                        rating
                      </p>
                    </div>
                    <div
                      className={`text-center p-3 rounded-xl border ${stats.totalEarnings >= 1000000 ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200 dark:bg-white/5 dark:border-white/10"}`}
                    >
                      <Award
                        className={`w-8 h-8 mx-auto mb-1.5 ${stats.totalEarnings >= 1000000 ? "text-amber-500" : "text-gray-400"}`}
                      />
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                        Earned Rp 1jt
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {stats.totalEarnings >= 1000000
                          ? "Tercapai!"
                          : formatRupiah(stats.totalEarnings)}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "absensi" && (
              <motion.div
                key="absensi"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <AttendanceDashboard
                  user={user}
                  todayAttendance={todayAttendance}
                  onAttendanceChange={() => {
                    checkTodayAttendance();
                    fetchRecentActivities();
                  }}
                />
              </motion.div>
            )}

            {activeTab === "stock" && (
              <motion.div key="stock" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <TeknisiStockView />
              </motion.div>
            )}

            {activeTab === "transfer" && (
              <motion.div key="transfer" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <TeknisiTransferView />
              </motion.div>
            )}

            {activeTab === "customer" && (              <motion.div
                key="customer"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <CustomerList />
              </motion.div>
            )}

            {activeTab === "kaspin" && (
              <motion.div
                key="kaspin"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <KaspinUpdate />
              </motion.div>
            )}

            {activeTab === "service" && (
              <motion.div key="service" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <ServiceList onAdd={() => setShowServiceForm(true)} />
              </motion.div>
            )}
            {activeTab === "layanan" && (
              <motion.div
                key="layanan"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <TransactionManagement />
              </motion.div>
            )}
            {activeTab === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <DoneService />
              </motion.div>
            )}

            {activeTab === "qc-process" && (
              <motion.div
                key="qc-process"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <QCProcessView />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Progress Update Modal */}
      {selectedService && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={() => setSelectedService(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--color-card)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[var(--color-card)] z-20 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)] rounded-xl flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">
                    Update Service
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {selectedService.invoice_number}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ProgressUpdate
                service={selectedService}
                onUpdate={() => {
                  setSelectedService(null);
                  fetchAllData();
                }}
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* Attendance Modal */}
      {showAttendance && (
        <AttendanceModal
          isOpen={showAttendance}
          onClose={() => {
            if (todayAttendance || user?.role === "owner")
              setShowAttendance(false);
          }}
          type={attendanceType}
          onSuccess={() => {
            setShowAttendance(false);
            checkTodayAttendance();
            fetchStats();
          }}
          existingAttendance={todayAttendance}
        />
      )}

      {/* Service Input Modal */}
      {showServiceForm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4"
          onClick={() => setShowServiceForm(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--color-card)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-[var(--color-card)] z-20 flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[var(--color-accent-teal-soft)] text-[var(--color-accent-teal)] rounded-xl flex items-center justify-center">
                  <Watch className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--color-text)]">
                    New Watch Service
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Create service order for timepiece
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowServiceForm(false)}
                className="p-1.5 hover:bg-[var(--color-surface)] rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-[var(--color-text-secondary)]" />
              </button>
            </div>
            {/* Modal Content */}
            <div className="p-6">
              <ServiceInput variant="modal" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Layanan Form Modal */}
      {showLayananForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
          <div className="bg-[var(--color-card)] rounded-xl sm:rounded-2xl md:rounded-3xl shadow-2xl w-full max-w-sm md:max-w-lg max-h-[90vh] overflow-y-auto border border-[var(--color-border)]">
            <LayananForm
              onSuccess={handleLayananSuccess}
              onClose={() => setShowLayananForm(false)}
            />
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        homeTabId="queue"
        transactionTabId="layanan"
        serviceTabId="service"
      />
      {/* Lapor Modal */}
      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        currentModule="Teknisi Panel"
      />
    </div>
  );
}