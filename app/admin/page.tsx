"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Users,
  LogOut,
  Clock,
  Menu,
  X,
  Watch,
  Zap,
  Target,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Download,
  Bell,
  ShoppingCart,
  RefreshCw,
  Eye,
  Calendar,
  DollarSign,
  Star,
  Activity,
  Settings,
  QrCode,
  Copy,
  Box,
  User,
  LogIn,
  LogOut as LogOutIcon,
  Camera,
  Search,
  ChevronRight,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import LayananForm from "@/components/layanan/LayananForm";
import LayananList from "@/components/layanan/LayananList";
import AttendanceModal from "@/components/teknisi/AttendanceModal";
import CategoryManager from "@/components/admin/CategoryManager";
import InventoryFilter from "@/components/admin/InventoryFilter";
import InventoryCard from "@/components/admin/InventoryCard";
import POSection from "@/components/admin/POSection";
import QRCodeGenerator from "@/components/admin/QRCodeGenerator";
import ThemeToggle from "@/components/ThemeToggle";

// Dynamic imports
const RoleManagement = dynamic(
  () => import("@/components/admin/RoleManagement"),
  {
    loading: () => (
      <div className="text-center py-8 text-slate-500">Loading...</div>
    ),
  },
);
const InventoryManagement = dynamic(
  () => import("@/components/admin/InventoryManagement"),
  {
    loading: () => (
      <div className="text-center py-8 text-slate-500">Loading...</div>
    ),
  },
);
const ServiceInput = dynamic(() => import("@/components/admin/ServiceInput"), {
  loading: () => (
    <div className="text-center py-8 text-slate-500">Loading...</div>
  ),
});
const ExportReports = dynamic(
  () => import("@/components/admin/ExportReports"),
  {
    loading: () => (
      <div className="text-center py-8 text-slate-500">Loading...</div>
    ),
  },
);

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLayananForm, setShowLayananForm] = useState(false);
  const [refreshLayanan, setRefreshLayanan] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showQRModal, setShowQRModal] = useState(false);

  // Attendance
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceType, setAttendanceType] = useState<"check_in" | "check_out">(
    "check_in"
  );

  // Inventory
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<any[]>([]);
  const [inventoryFilter, setInventoryFilter] = useState({
    category: "",
    search: "",
  });
  const [loadingInventory, setLoadingInventory] = useState(false);

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalServices: 0,
    totalInventory: 0,
    pendingServices: 0,
    completedToday: 0,
    revenue: 0,
    revenueGrowth: 12.5,
    avgRating: 4.8,
  });

  const [recentServices, setRecentServices] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const supabase = createClient();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  // ==================== FETCH FUNCTIONS ====================

  const fetchStats = async () => {
    const today = new Date().toISOString().split("T")[0];

    const [users, services, inventory, pending, completed, revenue] =
      await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("service_orders")
          .select("*", { count: "exact", head: true }),
        supabase.from("inventory").select("*", { count: "exact", head: true }),
        supabase
          .from("service_orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("service_orders")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("completed_at", today),
        supabase
          .from("service_orders")
          .select("final_cost")
          .eq("status", "completed"),
      ]);

    const totalRevenue = (revenue.data || []).reduce(
      (sum: number, item: any) => sum + (item.final_cost || 0),
      0
    );

    setStats({
      totalUsers: users.count || 0,
      totalServices: services.count || 0,
      totalInventory: inventory.count || 0,
      pendingServices: pending.count || 0,
      completedToday: completed.count || 0,
      revenue: totalRevenue,
      revenueGrowth: 12.5,
      avgRating: 4.8,
    });
  };

  const fetchRecentServices = async () => {
    const { data } = await supabase
      .from("service_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) setRecentServices(data);
  };

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user?.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    }
  };

  const fetchInventory = async () => {
    setLoadingInventory(true);
    try {
      let query = supabase
        .from("inventory")
        .select("*")
        .order("created_at", { ascending: false });

      if (inventoryFilter.search) {
        query = query.ilike("item_name", `%${inventoryFilter.search}%`);
      }
      if (inventoryFilter.category) {
        query = query.eq("category", inventoryFilter.category);
      }

      const { data } = await query;
      if (data) {
        setInventoryItems(data);
        setFilteredInventory(data);
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoadingInventory(false);
    }
  };

  // ==================== ATTENDANCE FUNCTIONS ====================

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

  const handleAttendance = (type: "check_in" | "check_out") => {
    if (type === "check_in" && todayAttendance) {
      toast.error("You already checked in today!");
      return;
    }
    if (type === "check_out" && !todayAttendance) {
      toast.error("You need to check in first!");
      return;
    }
    if (type === "check_out" && todayAttendance?.check_out) {
      toast.error("You already checked out today!");
      return;
    }

    setAttendanceType(type);
    setShowAttendance(true);
  };

  const handleAttendanceSuccess = () => {
    checkTodayAttendance();
    fetchStats();
    toast.success(
      `Attendance ${attendanceType === "check_in" ? "check in" : "check out"} successful!`
    );
  };

  const getAttendanceStatus = () => {
    if (!todayAttendance)
      return {
        text: "Not Checked In",
        color: "text-red-500",
        bg: "bg-red-50",
        icon: "❌",
      };
    if (!todayAttendance.check_out)
      return {
        text: "Checked In",
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: "⏳",
      };
    return {
      text: "Completed",
      color: "text-green-600",
      bg: "bg-green-50",
      icon: "✅",
    };
  };

  // ==================== NOTIFICATION FUNCTIONS ====================

  const markNotificationRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user?.id)
      .eq("is_read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
    toast.success("Semua notifikasi ditandai dibaca");
  };

  // ==================== OTHER FUNCTIONS ====================

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchStats(),
        fetchRecentServices(),
        fetchNotifications(),
        fetchInventory(),
        checkTodayAttendance(),
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLayananSuccess = () => {
    setShowLayananForm(false);
    setRefreshLayanan((prev) => prev + 1);
    toast.success("Layanan berhasil ditambahkan!");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push("/login");
    toast.success("Logged out");
  };

  const openQRModal = (service: any) => {
    setSelectedService(service);
    setShowQRModal(true);
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success("Token disalin!");
  };

  const markTokenExpired = async (serviceId: string) => {
    const { error } = await supabase
      .from("service_orders")
      .update({ token_expires_at: new Date().toISOString() })
      .eq("id", serviceId);

    if (error) {
      toast.error("Gagal menonaktifkan token");
      return;
    }

    toast.success("Token berhasil dinonaktifkan");
    fetchRecentServices();
  };

  const attendanceStatus = getAttendanceStatus();

  // ==================== EFFECTS ====================

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showNotifications && !target.closest(".notification-container")) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (sidebarOpen && !target.closest(".sidebar-container")) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [sidebarOpen]);

  const formatRupiah = (nominal: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(nominal);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const menuItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "services", label: "Service", icon: ClipboardList },
    { id: "layanan", label: "Transaction", icon: ShoppingCart },
    { id: "users", label: "Users", icon: Users },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "export", label: "Export", icon: Download },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#A8D7FF] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-[#4DB2FF] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-slate-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#A8D7FF]">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-20 bg-white z-50 flex flex-col items-center py-4 sm:py-6 shadow-2xl lg:shadow-none lg:translate-x-0 lg:static lg:z-auto lg:h-auto lg:w-auto transition-transform duration-300 ease-in-out ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#4DB2FF] rounded-2xl flex items-center justify-center mb-6 sm:mb-8">
          <Watch className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col items-center gap-2 sm:gap-3 px-2 sm:px-3 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
              className={`sidebar-item w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
                activeTab === item.id
                  ? "bg-[#FFD65A] text-black shadow-md"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col items-center gap-2 sm:gap-3 px-2 sm:px-3">
          {/* Attendance */}
          <button
            onClick={() =>
              handleAttendance(
                todayAttendance && !todayAttendance.check_out
                  ? "check_out"
                  : "check_in"
              )
            }
            disabled={!!todayAttendance?.check_out}
            className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all ${
              !todayAttendance
                ? "bg-[#3CCF91] text-white hover:bg-[#2db87d]"
                : todayAttendance.check_out
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-[#FFD65A] text-black hover:bg-[#f5c94a]"
            }`}
            title={todayAttendance?.check_out ? "Completed" : "Attendance"}
          >
            {!todayAttendance ? (
              <LogIn className="w-5 h-5" />
            ) : todayAttendance.check_out ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <LogOutIcon className="w-5 h-5" />
            )}
          </button>

          {/* Theme Toggle */}
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer">
            <ThemeToggle />
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
            title="Keluar"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 sm:top-4 sm:left-4 z-30 lg:hidden bg-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg border border-slate-200"
      >
        <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 min-h-screen flex flex-col w-full max-w-full overflow-x-hidden lg:ml-64">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 px-3 py-3 sm:px-4 sm:py-4">
          <div className="bg-white/80 backdrop-blur-xl rounded-xl sm:rounded-2xl md:rounded-3xl px-3 py-2.5 sm:px-5 sm:py-3.5 flex items-center justify-between shadow-sm gap-2 sm:gap-4">
            {/* Spacer for mobile menu button */}
            <div className="hidden lg:block w-12" />

            {/* Page Title - Center on mobile */}
            <div className="flex-1 lg:flex-none text-center lg:text-left">
              <h1 className="text-lg sm:text-lg md:text-xl font-bold text-slate-900">
                {menuItems.find((m) => m.id === activeTab)?.label}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-2 md:gap-3">
              {/* Search - hidden on small mobile */}
              <div className="hidden md:flex items-center relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-9 pr-4 py-2 bg-slate-50 rounded-full text-sm border border-slate-200 focus:outline-none focus:border-[#4DB2FF] focus:ring-2 focus:ring-[#4DB2FF]/10 transition-all w-40 md:w-56 lg:w-64"
                />
              </div>

              {/* Refresh */}
              <button
                onClick={fetchAllData}
                className="p-2 hover:bg-slate-100 rounded-lg transition-all flex-shrink-0"
              >
                <RefreshCw className="w-5 h-5 text-slate-400" />
              </button>

              {/* Notification */}
              <div className="relative notification-container flex-shrink-0">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 hover:bg-slate-100 rounded-lg transition-all"
                >
                  <Bell className="w-5 h-5 text-slate-400" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#FF5F87] text-white text-[9px] font-bold flex items-center justify-center rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {showNotifications && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-72 sm:w-80 max-h-80 sm:max-h-96 bg-white rounded-xl sm:rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                    >
                      <div className="p-3 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
                        <span className="font-medium text-xs sm:text-sm text-slate-900">Notifikasi</span>
                        <button
                          onClick={markAllRead}
                          className="text-xs text-[#4DB2FF] hover:underline"
                        >
                          Baca semua
                        </button>
                      </div>
                      <div className="overflow-y-auto max-h-56 sm:max-h-72">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-400">
                            <Bell className="w-7 h-7 sm:w-8 sm:h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-xs sm:text-sm">Tidak ada notifikasi</p>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-2.5 sm:p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-all ${
                                !notif.is_read ? "bg-[#e6f4ff]" : ""
                              }`}
                              onClick={() => markNotificationRead(notif.id)}
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs sm:text-sm font-medium truncate text-slate-900">
                                    {notif.title}
                                  </p>
                                  <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2">
                                    {notif.message}
                                  </p>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    {new Date(notif.created_at).toLocaleString()}
                                  </p>
                                </div>
                                {!notif.is_read && (
                                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#FF5F87] rounded-full flex-shrink-0 mt-1" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Profile */}
              <div className="flex items-center pl-1.5 sm:pl-2 border-l border-slate-200 flex-shrink-0">
                <div className="w-8 h-8 sm:w-8 sm:h-8 bg-[#4DB2FF] rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                  {user?.full_name?.charAt(0) || "A"}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ==================== CONTENT AREA ==================== */}
        <main className="flex-1 p-2 sm:p-3 md:p-4">
          {activeTab === "overview" && (
            <div className="space-y-3 sm:space-y-4 md:space-y-5">
              {/* Welcome Banner */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl sm:rounded-2xl md:rounded-[24px] border border-slate-200 p-3 sm:p-5 md:p-6 shadow-sm"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                  <div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 truncate">
                      Halo, {user?.full_name?.split(" ")[0]}! 👋
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      Kelola service center Anda dengan mudah dan efisien.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-[#DCEEFF] px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl md:rounded-2xl text-xs sm:text-sm font-medium text-slate-700">
                      <span className="mr-1.5">📅</span>
                      {new Date().toLocaleDateString("id-ID", {
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                {[
                  {
                    label: "Total Service",
                    value: stats.totalServices,
                    change: `+${stats.revenueGrowth}%`,
                    positive: true,
                    icon: ClipboardList,
                  },
                  {
                    label: "Pendapatan",
                    value: formatRupiah(stats.revenue),
                    change: "+8%",
                    positive: true,
                    icon: DollarSign,
                  },
                  {
                    label: "Pengguna",
                    value: stats.totalUsers,
                    change: "+2%",
                    positive: true,
                    icon: Users,
                  },
                  {
                    label: "Pending",
                    value: stats.pendingServices,
                    change: "0%",
                    positive: true,
                    icon: Clock,
                  },
                ].map((stat, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white rounded-lg sm:rounded-xl md:rounded-[24px] border border-slate-200 p-2.5 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between mb-1 sm:mb-3">
                      <span className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider truncate mr-1">
                        {stat.label}
                      </span>
                      <span className="text-[10px] sm:text-xs font-medium text-[#4DB2FF] bg-[#e6f4ff] px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {stat.change}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                      <div className="w-7 h-7 sm:w-10 sm:h-10 bg-[#DCEEFF] rounded-md sm:rounded-lg md:rounded-2xl flex items-center justify-center flex-shrink-0">
                        <stat.icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-[#4DB2FF]" />
                      </div>
                      <p className="text-sm sm:text-xl md:text-2xl font-bold text-slate-900 truncate">
                        {stat.value}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* PO Section */}
              <POSection onUpdate={fetchStats} />

              {/* Service List with QR & Token */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-xl sm:rounded-2xl md:rounded-[24px] border border-slate-200 shadow-sm overflow-hidden"
              >
                <div className="p-3 sm:p-4 md:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-[#DCEEFF] rounded-lg sm:rounded-xl flex items-center justify-center">
                      <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4DB2FF]" />
                    </div>
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900">Daftar Service</h3>
                    <span className="bg-[#4DB2FF] text-white text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium">
                      {recentServices.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab("services")}
                    className="text-xs sm:text-sm text-[#4DB2FF] hover:underline font-medium w-full sm:w-auto text-left sm:text-right"
                  >
                    + Tambah Service
                  </button>
                </div>

                <div className="overflow-x-auto -mx-1">
                  <div className="inline-block min-w-full align-middle">
                    <table className="w-full min-w-[640px]">
                      <thead>
                        <tr>
                          <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Invoice
                          </th>
                          <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Customer
                          </th>
                          <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Device
                          </th>
                          <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Token & QR
                          </th>
                          <th className="px-3 py-2.5 sm:px-5 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {recentServices.map((service) => (
                          <tr
                            key={service.id}
                            className="hover:bg-slate-50/50 transition-all"
                          >
                            <td className="px-3 py-3 sm:px-5 sm:py-4">
                              <span className="font-mono text-xs sm:text-sm font-medium text-slate-900">
                                {service.invoice_number}
                              </span>
                              <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
                                {formatDate(service.created_at)}
                              </p>
                            </td>
                            <td className="px-3 py-3 sm:px-5 sm:py-4">
                              <p className="font-medium text-xs sm:text-sm text-slate-900">
                                {service.customer_name}
                              </p>
                              <p className="text-[10px] sm:text-xs text-slate-400">
                                {service.customer_phone}
                              </p>
                            </td>
                            <td className="px-3 py-3 sm:px-5 sm:py-4">
                              <p className="text-xs sm:text-sm text-slate-900">
                                {service.watch_brand || service.device_brand}
                              </p>
                              <p className="text-[10px] sm:text-xs text-slate-400">
                                {service.watch_model || service.device_model}
                              </p>
                            </td>
                            <td className="px-3 py-3 sm:px-5 sm:py-4">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                                  service.status === "pending"
                                    ? "bg-yellow-50 text-yellow-700"
                                    : service.status === "completed"
                                      ? "bg-emerald-50 text-emerald-700"
                                      : service.status === "in_progress"
                                        ? "bg-[#DCEEFF] text-[#4DB2FF]"
                                        : service.status === "req_sparepart_admin"
                                          ? "bg-yellow-50 text-yellow-700"
                                          : service.status === "po_pending"
                                            ? "bg-yellow-50 text-yellow-700"
                                            : service.status === "sparepart_ready"
                                              ? "bg-emerald-50 text-emerald-700"
                                              : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {service.status === "req_sparepart_admin"
                                  ? "Request PO"
                                  : service.status === "po_pending"
                                    ? "PO"
                                    : service.status === "sparepart_ready"
                                      ? "Ready"
                                      : service.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 sm:px-5 sm:py-4">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <button
                                  onClick={() => openQRModal(service)}
                                  className="p-1.5 bg-[#4DB2FF] text-white rounded-lg hover:bg-[#3aa0f5] transition-all flex-shrink-0"
                                  title="Lihat QR Code"
                                >
                                  <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </button>
                                <button
                                  onClick={() => copyToken(service.token)}
                                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all flex-shrink-0"
                                  title="Salin Token"
                                >
                                  <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                                </button>
                                <span className="text-[10px] sm:text-xs font-mono text-slate-500 truncate max-w-[50px] sm:max-w-[60px]">
                                  {service.token}
                                </span>
                                {service.token_expires_at &&
                                  new Date(service.token_expires_at) <
                                    new Date() && (
                                    <span className="text-[10px] sm:text-xs text-red-500 font-medium">
                                      Expired
                                    </span>
                                  )}
                              </div>
                            </td>
                            <td className="px-3 py-3 sm:px-5 sm:py-4">
                              {!service.token_expires_at ||
                              new Date(service.token_expires_at) > new Date() ? (
                                <button
                                  onClick={() => markTokenExpired(service.id)}
                                  className="text-[10px] sm:text-xs text-red-500 hover:text-red-700 font-medium"
                                >
                                  Nonaktifkan
                                </button>
                              ) : (
                                <span className="text-[10px] sm:text-xs text-slate-400">
                                  Nonaktif
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {recentServices.length === 0 && (
                  <div className="p-6 sm:p-8 text-center text-slate-400">
                    <Watch className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-30" />
                    <p className="text-xs sm:text-sm">Belum ada service</p>
                    <button
                      onClick={() => setActiveTab("services")}
                      className="text-[#4DB2FF] hover:underline text-xs sm:text-sm mt-1"
                    >
                      Tambah service sekarang
                    </button>
                  </div>
                )}
              </motion.div>
            </div>
          )}

          {activeTab === "services" && <ServiceInput />}

          {activeTab === "users" && <RoleManagement />}

          {activeTab === "inventory" && (
            <InventoryManagement onUpdate={fetchInventory} />
          )}

          {activeTab === "export" && <ExportReports />}

          {/* Layanan Tab */}
          {activeTab === "layanan" && (
            <div>
              <div className="mb-4 sm:mb-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                    Manajemen Transaksi
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-500">
                    Input dan kelola transaksi layanan customer
                  </p>
                </div>
                <button
                  onClick={() => setShowLayananForm(true)}
                  className="bg-[#4DB2FF] text-white font-medium px-4 py-2.5 rounded-full hover:bg-[#3aa0f5] transition-all flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto"
                >
                  + Tambah Transaksi
                </button>
              </div>
              <LayananList isAdmin={true} key={refreshLayanan} />
            </div>
          )}
        </main>
      </div>

      {/* QR Code Generator Modal */}
      {showQRModal && selectedService && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <QRCodeGenerator
            invoiceNumber={selectedService.invoice_number}
            token={selectedService.token}
            customerName={selectedService.customer_name}
            customerPhone={selectedService.customer_phone}
            onClose={() => {
              setShowQRModal(false);
              setSelectedService(null);
            }}
          />
        </div>
      )}

      {/* Layanan Form Modal */}
      {showLayananForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <LayananForm
            onSuccess={handleLayananSuccess}
            onClose={() => setShowLayananForm(false)}
          />
        </div>
      )}

      {/* Attendance Modal */}
      <AttendanceModal
        isOpen={showAttendance}
        onClose={() => setShowAttendance(false)}
        onSuccess={handleAttendanceSuccess}
        type={attendanceType}
        existingAttendance={todayAttendance}
      />
    </div>
  );
}
