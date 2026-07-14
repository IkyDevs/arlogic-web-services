"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LogOut,
  User,
  ClipboardCheck,
  Clock,
  Menu,
  X,
  Watch,
  Bell,
  RefreshCw,
  Search,
  Package,
  Calendar,
  Users,
  ShoppingCart,
} from "lucide-react";
import toast from "react-hot-toast";
import QCSidebar from "@/components/qc/QCSidebar";
import QCStats from "@/components/qc/QCStats";
import QCServiceList from "@/components/qc/QCServiceList";
import QCReviewModal from "@/components/qc/QCReviewModal";
import AttendanceModal from "@/components/teknisi/AttendanceModal";
import AttendanceReport from "@/components/qc/AttendanceReport";
import ThemeToggle from "@/components/ThemeToggle";
import CustomerList from "@/components/admin/CustomerList";

const TransactionManagement = dynamic(() => import("@/components/layanan/TransactionManagement"), {
  loading: () => <div className="text-center py-8 text-slate-500">Loading...</div>,
});
const ServiceList = dynamic(() => import("@/components/admin/ServiceList"), {
  loading: () => <div className="text-center py-8 text-slate-500">Loading...</div>,
});
const ServiceInput = dynamic(() => import("@/components/admin/ServiceInput"), {
  loading: () => <div className="text-center py-8 text-slate-500">Loading...</div>,
});

export default function QCDashboard() {
  const [activeTab, setActiveTab] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [teknisiList, setTeknisiList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [sparepartSearch, setSparepartSearch] = useState("");
  const [sparepartResults, setSparepartResults] = useState<any[]>([]);
  const [sparepartSearching, setSparepartSearching] = useState(false);
  const [showSparepartResults, setShowSparepartResults] = useState(false);

  // Service form
  const [showServiceForm, setShowServiceForm] = useState(false);

  // Attendance
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceType, setAttendanceType] = useState<
    "check_in" | "check_out"
  >("check_in");

  const supabase = createClient();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    fetchServices();
    fetchTeknisiList();
    checkTodayAttendance();
  }, []);

  // Close sidebar when clicking outside
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

  const searchSparepart = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSparepartResults([]);
        setShowSparepartResults(false);
        return;
      }

      setSparepartSearching(true);
      try {
        const { data } = await supabase
          .from("inventory")
          .select("*")
          .or(`item_name.ilike.%${query}%,sku.ilike.%${query}%`)
          .limit(10);

        setSparepartResults(data || []);
        setShowSparepartResults(true);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setSparepartSearching(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      searchSparepart(sparepartSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [sparepartSearch, searchSparepart]);

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

  const fetchTeknisiList = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("role", "teknisi")
      .order("full_name");

    if (data) {
      const names = data.map((t) => t.full_name).filter(Boolean) as string[];
      setTeknisiList(names);
    }
  };

  const fetchServices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("service_orders")
      .select("*, profiles:assigned_teknisi_id(full_name)")
      .eq("status", "qc_pending")
      .order("created_at", { ascending: false });

    if (data) {
      const mapped = data.map((s: any) => ({
        ...s,
        teknisi_name: s.profiles?.full_name || "-",
      }));
      setServices(mapped);
      setFilteredServices(mapped);
    }
    setLoading(false);
  };

  const filterByTeknisi = (teknisiName: string) => {
    if (teknisiName === "all") {
      setFilteredServices(services);
      setActiveTab("all");
    } else {
      const filtered = services.filter((s) => s.teknisi_name === teknisiName);
      setFilteredServices(filtered);
      setActiveTab(teknisiName);
    }
  };

  const viewServiceDetails = (service: any) => {
    setSelectedService(service);
    setShowDetailModal(true);
  };

  const handleReviewComplete = () => {
    setShowDetailModal(false);
    setSelectedService(null);
    fetchServices();
  };

  const handleAttendanceSuccess = () => {
    checkTodayAttendance();
    toast.success(
      `Attendance ${attendanceType === "check_in" ? "check in" : "check out"} successful!`,
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push("/login");
    toast.success("Logged out");
  };

  // ==================== ATTENDANCE ====================

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
    setAttendanceType(type);
    setShowAttendance(true);
  };

  // ==================== END ATTENDANCE ====================

  const menuItems: { id: string; label: string; icon: any }[] = [
    { id: "all", label: "Semua", icon: ClipboardCheck },
    { id: "absensi", label: "Absensi", icon: Calendar },
    { id: "customer", label: "Customer", icon: Users },
    { id: "management-transaction", label: "Transaksi", icon: ShoppingCart },
    { id: "service", label: "Service", icon: ClipboardCheck },
  ];

  teknisiList.forEach((name) => {
    menuItems.push({
      id: name,
      label: name,
      icon: User,
    });
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-slate-600 dark:text-slate-400 font-medium">
            Loading...
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
      <QCSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        menuItems={menuItems}
        activeTab={activeTab}
        onTabChange={(tabId) => {
          if (tabId === "absensi" || tabId === "customer" || tabId === "management-transaction" || tabId === "service") {
            setActiveTab(tabId);
          } else if (tabId === "all") {
            filterByTeknisi("all");
          } else {
            filterByTeknisi(tabId);
          }
          setSidebarOpen(false);
        }}
        services={services}
        user={user}
        onLogout={handleLogout}
        todayAttendance={todayAttendance}
        onAttendance={handleAttendance}
      />

      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-3 left-3 sm:top-4 sm:left-4 z-30 lg:hidden bg-white dark:bg-[#1c1c1c] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 dark:border-white/10"
      >
        <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
      </button>

      {/* Main Content */}
      <div className="flex-1 min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 px-3 py-3 sm:px-4 sm:py-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-xl px-4 py-3 flex items-center justify-between border border-gray-200 gap-2 sm:gap-4">
            {/* Spacer for mobile menu button */}
            <div className="hidden lg:block w-12" />

            {/* Page Title - Center on mobile */}
            <div className="flex-1 lg:flex-none text-center lg:text-left">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-900">
                QC Dashboard
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTab === "absensi"
                  ? "Rekap absensi staff"
                  : activeTab === "all"
                    ? "Semua service"
                    : `Teknisi: ${activeTab}`}
              </p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              {/* Refresh */}
              <button
                onClick={fetchServices}
                className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-all flex-shrink-0"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              </button>

              {/* Notification */}
              <button
                onClick={() =>
                  toast("Notifikasi belum tersedia", { icon: "🔔" })
                }
                className="relative p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg sm:rounded-xl transition-all flex-shrink-0"
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-red-500 rounded-full flex-shrink-0" />
              </button>

              {/* Profile */}
              <div className="flex items-center pl-1.5 sm:pl-2 border-l border-slate-200 flex-shrink-0">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-900 rounded-full flex items-center justify-center text-white font-semibold text-xs sm:text-sm">
                  {user?.full_name?.charAt(0) || "Q"}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-2 sm:p-3 md:p-4">
          {activeTab === "customer" ? (
            <CustomerList />
          ) : activeTab === "absensi" ? (
            <AttendanceReport />
          ) : activeTab === "management-transaction" ? (
            <TransactionManagement isDark={false} />
          ) : activeTab === "service" ? (
            <ServiceList onAdd={() => setShowServiceForm(true)} />
          ) : (
            <>
              <QCStats
                services={services}
                filteredServices={filteredServices}
                teknisiList={teknisiList}
              />

              {/* Service List */}
              <div className="mt-3 sm:mt-4 md:mt-6">
                <QCServiceList
                  services={filteredServices}
                  onViewDetails={viewServiceDetails}
                />
              </div>
            </>
          )}
        </main>
      </div>

      {/* Review Modal */}
      {showDetailModal && selectedService && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl md:rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex justify-between items-center sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 sm:w-8 sm:h-8 bg-slate-900 rounded-md sm:rounded-lg flex items-center justify-center">
                  <ClipboardCheck className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <h3 className="text-sm sm:text-base md:text-lg font-semibold text-slate-900">
                  QC Review
                </h3>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1.5 sm:p-2 hover:bg-slate-100 rounded-lg transition-all"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              <QCReviewModal
                service={selectedService}
                onClose={() => setShowDetailModal(false)}
                onComplete={handleReviewComplete}
                reviewerId={user?.id}
                reviewerName={user?.full_name}
              />
            </div>
          </div>
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

      {/* Service Input Modal */}
      {showServiceForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowServiceForm(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#1c1c1c] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 dark:border-white/10"
            onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white dark:bg-[#1c1c1c] z-20 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-white/10 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center">
                  <Watch className="w-4 h-4 text-white dark:text-gray-900" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">New Watch Service</h2>
                  <p className="text-xs text-gray-500">Create service order for timepiece</p>
                </div>
              </div>
              <button onClick={() => setShowServiceForm(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <ServiceInput variant="modal" />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
