"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Shield,
  CheckCircle,
  Loader,
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
import MobileBottomNav from "@/components/ui/MobileBottomNav";

const TransactionManagement = dynamic(() => import("@/components/layanan/TransactionManagement"), {
  loading: () => <div className="text-center py-8 text-slate-500">Loading...</div>,
});
const ServiceList = dynamic(() => import("@/components/admin/ServiceList"), {
  loading: () => <div className="text-center py-8 text-slate-500">Loading...</div>,
});
const ServiceInput = dynamic(() => import("@/components/admin/ServiceInput"), {
  loading: () => <div className="text-center py-8 text-slate-500">Loading...</div>,
});
const RoleManagement = dynamic(() => import("@/components/admin/RoleManagement"), {
  loading: () => <div className="text-center py-8 text-slate-500">Loading...</div>,
});
const DoneService = dynamic(() => import("@/components/admin/DoneService"), {
  loading: () => <div className="text-center py-8 text-slate-500">Loading...</div>,
});

export default function QCDashboard() {
  const [activeTab, setActiveTab] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [teknisiList, setTeknisiList] = useState<string[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
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
      .order("created_at", { ascending: true });

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

  const fetchPendingApprovals = async () => {
    // Cari service yang ada timeline pending_teknisi TANPA timeline pending_approved setelahnya
    const { data: allServices } = await supabase
      .from("service_orders")
      .select("*, profiles:assigned_teknisi_id(full_name)")
      .order("created_at", { ascending: false });

    if (!allServices) return;

    // Ambil semua timeline untuk service-service ini
    const ids = allServices.map(s => s.id);
    const { data: timelines } = await supabase
      .from("service_timeline")
      .select("service_order_id, status, created_at, message")
      .in("service_order_id", ids)
      .in("status", ["pending_teknisi", "pending_approved", "pending_rejected"])
      .order("created_at", { ascending: false });

    if (!timelines) { setPendingApprovals([]); return; }

    // Cari service yang terakhir statusnya pending_teknisi (belum di-approve/reject)
    const latestStatus: Record<string, { status: string; message?: string }> = {};
    for (const t of timelines) {
      if (!latestStatus[t.service_order_id]) {
        latestStatus[t.service_order_id] = { status: t.status, message: t.message };
      }
    }

    const needApproval = allServices.filter(s => {
      if (latestStatus[s.id]?.status !== 'pending_teknisi') return false;
      // Ambil alasan dari timeline message
      const msg = latestStatus[s.id].message || '';
      (s as any)._pendingReason = msg.replace('Ditunda oleh teknisi: ', '');
      return true;
    });
    setPendingApprovals(needApproval);
  };

  useEffect(() => {
    if (activeTab === "all" || activeTab === "pending-approval" || activeTab.startsWith("teknisi_")) {
      fetchPendingApprovals();
    }
  }, [activeTab]);

  const handleApprovePending = async (id: string, approve: boolean) => {
    setApprovingId(id);
    try {
      const res = await fetch("/api/qc/approve-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceOrderId: id, approve }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        fetchPendingApprovals();
        fetchServices();
      } else {
        toast.error(json.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setApprovingId(null);
    }
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

  // Hitung jumlah service qc_pending per teknisi
  const teknisiPendingCount = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const svc of services) {
      const name = svc.teknisi_name;
      counts[name] = (counts[name] || 0) + 1;
    }
    return counts;
  }, [services]);

  const menuItems: { id: string; label: string; icon: any; count?: number }[] = [
    { id: "all", label: "Semua", icon: ClipboardCheck },
    { id: "pending-approval", label: "Pending", icon: Clock, count: pendingApprovals.length },
    { id: "absensi", label: "Absensi", icon: Calendar },
    { id: "customer", label: "Customer", icon: Users },
    { id: "management-transaction", label: "Transaksi", icon: ShoppingCart },
    { id: "done", label: "Done", icon: CheckCircle },
    { id: "service", label: "Service", icon: ClipboardCheck },
    { id: "users", label: "Users", icon: Shield },
  ];

  teknisiList.forEach((name) => {
    const count = teknisiPendingCount[name] || 0;
    menuItems.push({
      id: name,
      label: count > 0 ? `${name} (${count})` : name,
      icon: User,
      count,
    });
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center w-full max-w-lg px-4 space-y-4">
          <div className="bg-white dark:bg-[#1c1c1c] rounded-xl p-6 border border-gray-200 dark:border-white/10 shadow-sm">
            <div className="h-8 w-48 bg-gray-200 dark:bg-white/5 rounded animate-pulse mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-gray-200 dark:bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="space-y-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
          <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
            <Loader className="w-4 h-4 animate-spin" /> Memuat data QC...
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
          if (tabId === "absensi" || tabId === "customer" || tabId === "management-transaction" || tabId === "service" || tabId === "users" || tabId === "pending-approval") {
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
      <div className="flex-1 min-h-screen flex flex-col w-full max-w-full overflow-x-hidden pb-16 lg:pb-0">
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
                {activeTab === "absensi" ? "Rekap absensi staff"
                  : activeTab === "all" ? "Semua Service QC"
                  : activeTab === "pending-approval" ? "Persetujuan Pending Teknisi"
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
          ) : activeTab === "users" ? (
            <RoleManagement />
          ) : activeTab === "done" ? (
            <DoneService />
          ) : activeTab === "pending-approval" ? (
            <div className="space-y-3">
              {pendingApprovals.length === 0 ? (
                <div className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-gray-200 dark:border-white/10 p-8 text-center shadow-sm">
                  <Clock className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm font-medium text-gray-500">Tidak ada pending approval</p>
                </div>
              ) : (
                pendingApprovals.map((svc: any) => (
                  <div key={svc.id} className="bg-white dark:bg-[#1c1c1c] rounded-xl border border-amber-200 dark:border-amber-800 shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-gray-900 text-white text-xs font-mono rounded-md">{svc.invoice_number}</span>
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Pending</span>
                        </div>
                        <p className="text-sm font-medium">{svc.customer_name} • {svc.watch_brand}</p>
                        <p className="text-xs text-gray-500 mt-1">Teknisi: {svc.profiles?.full_name || '-'}</p>
                        <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-2.5 mt-2 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Alasan:</p>
                              <p className="text-sm text-amber-700 dark:text-amber-400">{svc._pendingReason || svc.message || '-'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 mt-1">
                        <button onClick={() => handleApprovePending(svc.id, true)} disabled={approvingId === svc.id}
                          className="px-3 py-1.5 text-xs bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50">
                          {approvingId === svc.id ? '...' : 'Setuju'}
                        </button>
                        <button onClick={() => handleApprovePending(svc.id, false)} disabled={approvingId === svc.id}
                          className="px-3 py-1.5 text-xs bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 disabled:opacity-50">
                          Tolak
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4">
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={() => setShowServiceForm(false)}>
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

      {/* Mobile Bottom Nav */}
      <MobileBottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        homeTabId="all"
        transactionTabId="management-transaction"
        serviceTabId="service"
      />
    </div>
  );
}
