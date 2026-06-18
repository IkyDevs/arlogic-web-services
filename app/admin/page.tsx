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
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import LayananForm from "@/components/layanan/LayananForm";
import LayananList from "@/components/layanan/LayananList";
import AdminAttendanceModal from "@/components/admin/AdminAttendanceModal";
import CategoryManager from "@/components/admin/CategoryManager";
import InventoryFilter from "@/components/admin/InventoryFilter";
import InventoryCard from "@/components/admin/InventoryCard";
import POSection from "@/components/admin/POSection";
import QRCodeGenerator from "@/components/admin/QRCodeGenerator";

// Dynamic imports
const RoleManagement = dynamic(
  () => import("@/components/admin/RoleManagement"),
  {
    loading: () => (
      <div className="text-center py-8 text-gray-500">Loading...</div>
    ),
  },
);
const InventoryManagement = dynamic(
  () => import("@/components/admin/InventoryManagement"),
  {
    loading: () => (
      <div className="text-center py-8 text-gray-500">Loading...</div>
    ),
  },
);
const ServiceInput = dynamic(() => import("@/components/admin/ServiceInput"), {
  loading: () => (
    <div className="text-center py-8 text-gray-500">Loading...</div>
  ),
});
const ExportReports = dynamic(
  () => import("@/components/admin/ExportReports"),
  {
    loading: () => (
      <div className="text-center py-8 text-gray-500">Loading...</div>
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
  const [attendanceType, setAttendanceType] = useState<
    "check_in" | "check_out"
  >("check_in");

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
      0,
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
      `Attendance ${attendanceType === "check_in" ? "check in" : "check out"} successful!`,
    );
  };

  const getAttendanceStatus = () => {
    if (!todayAttendance)
      return {
        text: "Not Checked In",
        color: "text-red-500",
        bg: "bg-red-50",
        icon: "⭕",
      };
    if (!todayAttendance.check_out)
      return {
        text: "Checked In",
        color: "text-yellow-600",
        bg: "bg-yellow-50",
        icon: "✅",
      };
    return {
      text: "Completed",
      color: "text-green-600",
      bg: "bg-green-50",
      icon: "✓",
    };
  };

  const attendanceStatus = getAttendanceStatus();

  // ==================== NOTIFICATION FUNCTIONS ====================

  const markNotificationRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
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
    } else {
      toast.success(
        "Token berhasil dinonaktifkan! Customer tidak bisa tracking lagi.",
      );
      fetchRecentServices();
    }
  };

  const handleInventoryFilter = (filters: {
    category: string;
    search: string;
  }) => {
    setInventoryFilter(filters);
    fetchInventory();
  };

  useEffect(() => {
    fetchAllData();
  }, []);

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
    { id: "overview", label: "BERANDA", icon: LayoutDashboard },
    { id: "services", label: "SERVICE BARU", icon: ClipboardList },
    { id: "layanan", label: "TRANSAKSI", icon: ShoppingCart },
    { id: "users", label: "PENGGUNA", icon: Users },
    { id: "inventory", label: "INVENTORI", icon: Package },
    { id: "export", label: "LAPORAN", icon: Download },
  ];

  // Close dropdown when clicking outside
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-[#E94560] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-gray-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ==================== SIDEBAR ==================== */}
      <div
        className={`fixed left-0 top-0 h-full w-64 bg-white border-r border-[#E9ECEF] z-40 transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      >
        <div className="p-4 border-b border-[#E9ECEF]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-[#1A1A2E] rounded-lg flex items-center justify-center">
                <Watch className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#1A1A2E]">
                  Watch<span className="text-[#E94560]">Service</span>
                </h1>
                <p className="text-[10px] text-gray-400">Management System</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 p-2.5 bg-[#FAFAFA] rounded-lg">
            <div className="w-9 h-9 bg-[#1A1A2E] rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.full_name?.charAt(0) || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Attendance Status */}
          <div className={`mt-3 p-2 rounded-lg ${attendanceStatus.bg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <span>{attendanceStatus.icon}</span>
                <span className={attendanceStatus.color}>
                  {attendanceStatus.text}
                </span>
              </div>
              <span className="text-[10px] text-gray-400">Admin</span>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-0.5">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-lg transition-all ${
                activeTab === item.id
                  ? "bg-[#1A1A2E] text-white"
                  : "text-[#1A1A2E] hover:bg-gray-100"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}

          <div className="pt-2 mt-2 border-t border-[#E9ECEF] space-y-2">
            {/* Attendance Button */}
            <button
              onClick={() =>
                handleAttendance(
                  todayAttendance && !todayAttendance.check_out
                    ? "check_out"
                    : "check_in",
                )
              }
              disabled={!!todayAttendance?.check_out}
              className={`w-full py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                !todayAttendance
                  ? "bg-green-500 hover:bg-green-600 text-white"
                  : todayAttendance.check_out
                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                    : "bg-yellow-500 hover:bg-yellow-600 text-white"
              }`}
            >
              {!todayAttendance ? (
                <>
                  <LogIn className="w-4 h-4" />
                  Check In
                </>
              ) : todayAttendance.check_out ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Completed
                </>
              ) : (
                <>
                  <LogOutIcon className="w-4 h-4" />
                  Check Out
                </>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-lg text-[#E94560] hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Keluar
            </button>
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#E9ECEF] text-center">
          <p className="text-[10px] text-gray-400">Watch Service v2.0</p>
        </div>
      </div>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 lg:hidden bg-white p-2 rounded-lg shadow-sm border border-[#E9ECEF]"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-[#E9ECEF] z-20">
          <div className="px-6 py-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#1A1A2E]">
                {menuItems.find((m) => m.id === activeTab)?.label}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date().toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchAllData}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>

              {/* Notification */}
              <div className="relative notification-container">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 hover:bg-gray-100 rounded-lg transition-all"
                >
                  <Bell className="w-4 h-4 text-gray-400" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#E94560] text-white text-[9px] font-bold flex items-center justify-center rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 max-h-96 bg-white rounded-xl shadow-lg border border-[#E9ECEF] z-50 overflow-hidden">
                    <div className="p-3 border-b border-[#E9ECEF] flex justify-between items-center sticky top-0 bg-white">
                      <span className="font-medium text-sm">Notifikasi</span>
                      <button
                        onClick={markAllRead}
                        className="text-xs text-[#E94560] hover:underline"
                      >
                        Baca semua
                      </button>
                    </div>
                    <div className="overflow-y-auto max-h-72">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-400">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">Tidak ada notifikasi</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-3 border-b border-[#E9ECEF] cursor-pointer hover:bg-gray-50 transition-all ${!notif.is_read ? "bg-blue-50" : ""}`}
                            onClick={() => markNotificationRead(notif.id)}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {notif.title}
                                </p>
                                <p className="text-xs text-gray-500 line-clamp-2">
                                  {notif.message}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {new Date(notif.created_at).toLocaleString()}
                                </p>
                              </div>
                              {!notif.is_read && (
                                <div className="w-2 h-2 bg-[#E94560] rounded-full flex-shrink-0 mt-1" />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-[#E94560] px-3 py-1 rounded-full text-white text-xs font-medium">
                ADMIN
              </div>
            </div>
          </div>
        </header>

        {/* ==================== CONTENT AREA ==================== */}
        <main className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Welcome Banner */}
              <div className="bg-white rounded-xl border border-[#E9ECEF] p-5 shadow-sm">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-[#1A1A2E]">
                      Halo, {user?.full_name?.split(" ")[0]}! 👋
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Kelola service center Anda dengan mudah dan efisien.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-[#FAFAFA] px-4 py-2 rounded-lg text-sm font-medium border border-[#E9ECEF]">
                      <span className="mr-2">📅</span>{" "}
                      {new Date().toLocaleDateString("id-ID", {
                        month: "long",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Total Service
                    </span>
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      +{stats.revenueGrowth}%
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {stats.totalServices}
                  </p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Pendapatan
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#E94560]">
                    {formatRupiah(stats.revenue)}
                  </p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Pengguna
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#1A1A2E]">
                    {stats.totalUsers}
                  </p>
                </div>

                <div className="stat-card">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Pending
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-[#E94560]">
                    {stats.pendingServices}
                  </p>
                </div>
              </div>

              {/* PO Section - Menggunakan Komponen Terpisah */}
              <POSection onUpdate={fetchStats} />

              {/* Service List with QR & Token */}
              <div className="bg-white rounded-xl border border-[#E9ECEF] shadow-sm overflow-hidden">
                <div className="p-4 border-b border-[#E9ECEF] flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-5 h-5 text-[#E94560]" />
                    <h3 className="font-semibold text-[#1A1A2E]">
                      Daftar Service
                    </h3>
                    <span className="bg-[#E94560] text-white text-xs px-2 py-0.5 rounded-full">
                      {recentServices.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab("services")}
                    className="text-sm text-[#E94560] hover:underline font-medium"
                  >
                    + Tambah Service
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#F8F9FA]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Invoice
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Customer
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Device
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Token & QR
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E9ECEF]">
                      {recentServices.map((service) => (
                        <tr
                          key={service.id}
                          className="hover:bg-gray-50 transition-all"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-sm font-medium">
                              {service.invoice_number}
                            </span>
                            <p className="text-xs text-gray-400">
                              {formatDate(service.created_at)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-sm">
                              {service.customer_name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {service.customer_phone}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm">
                              {service.watch_brand || service.device_brand}
                            </p>
                            <p className="text-xs text-gray-400">
                              {service.watch_model || service.device_model}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`badge ${
                                service.status === "pending"
                                  ? "badge-warning"
                                  : service.status === "completed"
                                    ? "badge-success"
                                    : service.status === "in_progress"
                                      ? "badge-info"
                                      : service.status === "req_sparepart_admin"
                                        ? "badge-warning"
                                        : service.status === "po_pending"
                                          ? "badge-warning"
                                          : service.status === "sparepart_ready"
                                            ? "badge-success"
                                            : "badge-neutral"
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
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openQRModal(service)}
                                className="p-1.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#0F3460] transition-all"
                                title="Lihat QR Code"
                              >
                                <QrCode className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => copyToken(service.token)}
                                className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                                title="Salin Token"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <span className="text-xs font-mono text-gray-500 truncate max-w-[60px]">
                                {service.token}
                              </span>
                              {service.token_expires_at &&
                                new Date(service.token_expires_at) <
                                  new Date() && (
                                  <span className="text-xs text-red-500 font-medium">
                                    Expired
                                  </span>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {!service.token_expires_at ||
                            new Date(service.token_expires_at) > new Date() ? (
                              <button
                                onClick={() => markTokenExpired(service.id)}
                                className="text-xs text-red-500 hover:text-red-700 font-medium"
                              >
                                Nonaktifkan Token
                              </button>
                            ) : (
                              <span className="text-xs text-gray-400">
                                Token Nonaktif
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {recentServices.length === 0 && (
                  <div className="p-8 text-center text-gray-400">
                    <Watch className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Belum ada service</p>
                    <button
                      onClick={() => setActiveTab("services")}
                      className="text-[#E94560] hover:underline text-sm mt-1"
                    >
                      Tambah service sekarang
                    </button>
                  </div>
                )}
              </div>
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
              <div className="mb-5 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-[#1A1A2E]">
                    Manajemen Transaksi
                  </h3>
                  <p className="text-sm text-gray-500">
                    Input dan kelola transaksi layanan customer
                  </p>
                </div>
                <button
                  onClick={() => setShowLayananForm(true)}
                  className="bg-[#E94560] text-white font-medium px-4 py-2 rounded-lg hover:bg-[#c73d54] transition-all flex items-center gap-2 text-sm"
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <LayananForm
            onSuccess={handleLayananSuccess}
            onClose={() => setShowLayananForm(false)}
          />
        </div>
      )}

      {/* Attendance Modal */}
      <AdminAttendanceModal
        isOpen={showAttendance}
        onClose={() => setShowAttendance(false)}
        onSuccess={handleAttendanceSuccess}
        type={attendanceType}
        existingAttendance={todayAttendance}
      />
    </div>
  );
}
