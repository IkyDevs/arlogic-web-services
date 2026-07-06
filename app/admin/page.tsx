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
const DashboardCharts = dynamic(
  () => import("@/components/admin/DashboardCharts"),
  {
    loading: () => (
      <div className="text-center py-8 text-slate-500">Loading...</div>
    ),
  },
);

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("transaction");
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

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any>({
    transactions: [],
    services: [],
    users: [],
    inventory: [],
  });

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

  // ==================== SEARCH FUNCTIONS ====================

  const performSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults({
        transactions: [],
        services: [],
        users: [],
        inventory: [],
      });
      setShowSearchResults(false);
      return;
    }

    const q = query.toLowerCase();

    // Search in transactions (recentServices/service_orders)
    const transactionsFound = recentServices.filter(
      (s: any) =>
        s.invoice_number?.toLowerCase().includes(q) ||
        s.customer_name?.toLowerCase().includes(q) ||
        s.customer_phone?.toLowerCase().includes(q) ||
        s.watch_brand?.toLowerCase().includes(q) ||
        s.watch_model?.toLowerCase().includes(q),
    );

    // Search in layanan (transactions)
    const layananFound = inventoryItems.filter(
      (i: any) =>
        i.item_name?.toLowerCase().includes(q) ||
        i.category?.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q),
    );

    setSearchResults({
      transactions: transactionsFound,
      services: transactionsFound, // Same as transactions in this context
      users: [], // Users search would need to fetch users
      inventory: layananFound,
    });

    setShowSearchResults(true);
  };

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
        supabase.from("layanan").select("nominal").eq("status", "active"),
      ]);

    const totalRevenue = (revenue.data || []).reduce(
      (sum: number, item: any) => sum + (item.nominal || 0),
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
    { id: "transaction", label: "Transaction", icon: ShoppingCart },
    { id: "services", label: "Service", icon: ClipboardList },
    { id: "sparepart", label: "Request Sparepart", icon: Package },
    { id: "users", label: "Users", icon: Users },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "export", label: "Export", icon: Download },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-slate-600 dark:text-slate-400 font-medium">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0a0a0a] lg:flex">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-container fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#111111] z-50 flex flex-col py-4 sm:py-6 shadow-2xl lg:shadow-none lg:translate-x-0 lg:static lg:z-auto lg:h-screen lg:sticky lg:top-0 transition-transform duration-300 ease-in-out border-r border-gray-200 dark:border-white/5 overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 mb-6 sm:mb-8 flex-shrink-0">
          <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Watch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900">WatchService</h1>
            <p className="text-[10px] text-slate-500">Admin Panel</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden ml-auto p-1.5 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-0.5 px-3 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
              className={`sidebar-item w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-xl transition-all ${
                activeTab === item.id
                  ? "bg-gray-900 text-white"
                  : "text-slate-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-1 px-3 pt-3 border-t border-slate-100 flex-shrink-0">
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
            className={`w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-xl transition-all ${
              !todayAttendance
                ? "bg-green-50 text-green-600 hover:bg-green-100"
                : todayAttendance.check_out
                  ? "text-slate-400 cursor-not-allowed"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {!todayAttendance ? (
              <LogIn className="w-4 h-4 flex-shrink-0" />
            ) : todayAttendance.check_out ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <LogOutIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="truncate">
              {!todayAttendance
                ? "Check In"
                : todayAttendance.check_out
                  ? "Completed"
                  : "Check Out"}
            </span>
          </button>

          {/* Theme Toggle */}
          <div className="px-3 py-2 flex items-center gap-3 text-slate-600">
            <ThemeToggle />
            <span className="text-sm font-medium">Theme</span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 sm:top-4 sm:left-4 z-30 lg:hidden bg-white dark:bg-[#1c1c1c] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 dark:border-white/10"
      >
        <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 px-3 py-3 sm:px-4 sm:py-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-xl px-4 py-3 flex items-center justify-between border border-gray-200 gap-2 sm:gap-4">
            {/* Spacer for mobile menu button */}
            <div className="hidden lg:block w-12" />

            {/* Page Title - Center on mobile */}
            <div className="flex-1 lg:flex-none text-center lg:text-left">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900">
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
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    performSearch(e.target.value);
                  }}
                  onFocus={() => searchQuery && setShowSearchResults(true)}
                  className="pl-9 pr-4 py-2 bg-slate-50 rounded-full text-sm border border-slate-200 focus:outline-none focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 transition-all w-40 md:w-56 lg:w-64"
                />

                {/* Search Results Dropdown */}
                <AnimatePresence>
                  {showSearchResults && searchQuery && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full mt-2 w-96 max-h-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                    >
                      <div className="max-h-96 overflow-y-auto">
                        {(searchResults.transactions.length +
                          searchResults.inventory.length) === 0 ? (
                          <div className="p-6 text-center text-slate-400">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Tidak ada hasil pencarian</p>
                          </div>
                        ) : (
                          <>
                            {/* Transactions Results */}
                            {searchResults.transactions.length > 0 && (
                              <>
                                <div className="p-3 bg-slate-50 border-b border-slate-100 sticky top-0">
                                  <p className="text-xs font-semibold text-slate-600 uppercase">
                                    Service ({searchResults.transactions.length})
                                  </p>
                                </div>
                                {searchResults.transactions.slice(0, 3).map((result: any) => (
                                  <div
                                    key={result.id}
                                    className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-all"
                                    onClick={() => {
                                      setSearchQuery("");
                                      setShowSearchResults(false);
                                      setActiveTab("transaction");
                                    }}
                                  >
                                    <p className="text-sm font-medium text-slate-900">
                                      {result.invoice_number}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {result.customer_name} • {result.customer_phone}
                                    </p>
                                  </div>
                                ))}
                                {searchResults.transactions.length > 3 && (
                                  <div className="p-2 text-center border-b border-slate-100">
                                    <button
                                      onClick={() => {
                                        setSearchQuery("");
                                        setShowSearchResults(false);
                                        setActiveTab("transaction");
                                      }}
                                      className="text-xs text-gray-600 hover:text-gray-900"
                                    >
                                      Lihat semua hasil ({searchResults.transactions.length})
                                    </button>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Inventory Results */}
                            {searchResults.inventory.length > 0 && (
                              <>
                                <div className="p-3 bg-slate-50 border-b border-slate-100 sticky top-0">
                                  <p className="text-xs font-semibold text-slate-600 uppercase">
                                    Inventory ({searchResults.inventory.length})
                                  </p>
                                </div>
                                {searchResults.inventory.slice(0, 3).map((result: any) => (
                                  <div
                                    key={result.id}
                                    className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-all"
                                    onClick={() => {
                                      setSearchQuery("");
                                      setShowSearchResults(false);
                                      setActiveTab("inventory");
                                    }}
                                  >
                                    <p className="text-sm font-medium text-slate-900">
                                      {result.item_name}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {result.category}
                                    </p>
                                  </div>
                                ))}
                                {searchResults.inventory.length > 3 && (
                                  <div className="p-2 text-center">
                                    <button
                                      onClick={() => {
                                        setSearchQuery("");
                                        setShowSearchResults(false);
                                        setActiveTab("inventory");
                                      }}
                                      className="text-xs text-gray-600 hover:text-gray-900"
                                    >
                                      Lihat semua hasil ({searchResults.inventory.length})
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold flex items-center justify-center rounded-full">
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
                        <span className="font-medium text-xs sm:text-sm text-slate-900">
                          Notifikasi
                        </span>
                        <button
                          onClick={markAllRead}
                          className="text-xs text-gray-600 hover:underline"
                        >
                          Baca semua
                        </button>
                      </div>
                      <div className="overflow-y-auto max-h-56 sm:max-h-72">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-slate-400">
                            <Bell className="w-7 h-7 sm:w-8 sm:h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-xs sm:text-sm">
                              Tidak ada notifikasi
                            </p>
                          </div>
                        ) : (
                          notifications.map((notif) => (
                            <div
                              key={notif.id}
                              className={`p-2.5 sm:p-3 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-all ${
                                !notif.is_read ? "bg-gray-50" : ""
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
                                    {new Date(
                                      notif.created_at,
                                    ).toLocaleString()}
                                  </p>
                                </div>
                                {!notif.is_read && (
                                  <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full flex-shrink-0 mt-1" />
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
                <div className="w-8 h-8 sm:w-8 sm:h-8 bg-gray-900 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                  {user?.full_name?.charAt(0) || "A"}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ==================== CONTENT AREA ==================== */}
        <main className="flex-1 p-2 sm:p-3 md:p-4">
          {activeTab === "transaction" && (
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
                      Kelola transaction dan statistik dashboard Anda dengan
                      mudah dan efisien.
                    </p>
                  </div>
                  <div className="flex items-center">
                    <div className="bg-gray-100 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl md:rounded-2xl text-xs sm:text-sm font-medium text-slate-700">
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
                      <span className="text-[10px] sm:text-xs font-medium text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {stat.change}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
                      <div className="w-7 h-7 sm:w-10 sm:h-10 bg-gray-100 rounded-md sm:rounded-lg md:rounded-2xl flex items-center justify-center flex-shrink-0">
                        <stat.icon className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-gray-600" />
                      </div>
                      <p className="text-sm sm:text-xl md:text-2xl font-bold text-slate-900 truncate">
                        {stat.value}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Transaction List */}
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
                    className="bg-gray-900 text-white font-medium px-4 py-2.5 rounded-full hover:bg-gray-800 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm w-full sm:w-auto"
                  >
                    + Tambah Transaksi
                  </button>
                </div>
                <LayananList isAdmin={true} key={refreshLayanan} />
              </div>

              {/* Dashboard Charts */}
              <DashboardCharts
                totalTransactions={recentServices.length}
                totalUsers={stats.totalUsers}
                totalServices={stats.totalServices}
                pendingServices={stats.pendingServices}
                revenue={stats.revenue}
              />
            </div>
          )}

          {activeTab === "sparepart" && <POSection onUpdate={fetchStats} />}

          {activeTab === "users" && <RoleManagement />}

          {activeTab === "inventory" && (
            <InventoryManagement onUpdate={fetchInventory} />
          )}

          {activeTab === "export" && <ExportReports />}
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
