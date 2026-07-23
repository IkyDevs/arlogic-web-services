"use client";

import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  ClipboardList,
  Package,
  Clock,
  FileText,
  CheckCircle,
  MessageSquare,
  Download,
  Watch,
  LogIn,
  LogOut,
  LogOut as LogOutIcon,
  Menu,
  X,
  CheckCircle as CheckCircleIcon,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const menuItems = [
  { id: "transaction", label: "Dashboard", icon: LayoutDashboard },
  { id: "customer", label: "Pelanggan", icon: Users },
  { id: "management-transaction", label: "Transaksi", icon: ShoppingCart },
  { id: "services", label: "Service", icon: ClipboardList },
  { id: "sparepart", label: "Request Sparepart", icon: Package },
  { id: "attendance", label: "Absensi", icon: Clock },
  { id: "users", label: "Pengguna", icon: Users },
  { id: "inventory", label: "Inventaris", icon: Package },
  { id: "closing", label: "Closing", icon: FileText },
  { id: "done", label: "Selesai", icon: CheckCircle },
  { id: "template", label: "Template", icon: MessageSquare },
  { id: "export", label: "Ekspor", icon: Download },
];

interface AdminSidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  todayAttendance: any;
  handleAttendance: (type: "check_in" | "check_out") => void;
  handleLogout: () => void;
  doneCount: number; // Added doneCount prop
}

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  todayAttendance,
  handleAttendance,
  handleLogout,
  doneCount, // Destructure doneCount
}: AdminSidebarProps) {
  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`sidebar-container fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#111111] z-50 flex flex-col py-4 sm:py-6 shadow-2xl lg:shadow-none lg:translate-x-0 lg:static lg:z-auto lg:h-screen lg:sticky lg:top-0 transition-transform duration-300 ease-in-out border-r border-gray-200 dark:border-white/5 overflow-y-auto ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
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

        <nav className="flex-1 flex flex-col justify-center gap-0.5 px-3 overflow-y-auto">
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
              {item.id === "done" && doneCount > 0 && (
                <span className="ml-auto bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {doneCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-1 px-3 pt-3 border-t border-slate-100 flex-shrink-0">
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
              <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
            ) : (
              <LogOutIcon className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="truncate">
              {!todayAttendance
                ? "Absen"
                : todayAttendance.check_out
                  ? "Completed"
                  : "Absen Pulang"}
            </span>
          </button>

          <div className="px-3 py-2 flex items-center gap-3 text-slate-600">
            <ThemeToggle />
            <span className="text-sm font-medium">Theme</span>
          </div>

          <button
            onClick={handleLogout}
            aria-label="Keluar dari aplikasi"
            className="w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>
    </>
  );
}
