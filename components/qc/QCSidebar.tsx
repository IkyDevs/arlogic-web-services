"use client";

import {
  Watch,
  LogOut,
  X,
  LogIn,
  CheckCircle,
  LogOut as LogOutIcon,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

interface QCSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems: any[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  services: any[];
  user: any;
  onLogout: () => void;
  todayAttendance?: any;
  onAttendance?: (type: "check_in" | "check_out") => void;
}

export default function QCSidebar({
  isOpen,
  onClose,
  menuItems,
  activeTab,
  onTabChange,
  user,
  onLogout,
  todayAttendance,
  onAttendance,
}: QCSidebarProps) {
  return (
    <aside
      className={`sidebar-container fixed top-0 left-0 h-full w-64 bg-white dark:bg-[#111111] z-50 flex flex-col py-4 sm:py-6 shadow-2xl lg:shadow-none lg:translate-x-0 lg:static lg:z-auto lg:h-screen lg:sticky lg:top-0 transition-transform duration-300 ease-in-out border-r border-gray-200 dark:border-white/5 overflow-y-auto ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 mb-6 sm:mb-8 flex-shrink-0">
        <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center flex-shrink-0">
          <Watch className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-slate-900">
            WatchService
          </h1>
          <p className="text-[10px] text-slate-500">QC Panel</p>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden ml-auto p-1.5 hover:bg-slate-100 rounded-lg"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>

      {/* User Info */}
      {user && (
        <div className="mx-3 mb-4 flex items-center gap-3 p-2.5 bg-[#F5F5F7]/30 rounded-2xl flex-shrink-0">
          <div className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
            {user?.full_name?.charAt(0) || "Q"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{user?.full_name}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 flex flex-col justify-center gap-0.5 px-3 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`sidebar-item w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-xl transition-all ${
              activeTab === item.id
                ? "bg-gray-900 text-white"
                : "text-slate-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            <item.icon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate flex-1">{item.label}</span>
            {item.count > 0 && (
              <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center leading-tight">
                {item.count}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col gap-1 px-3 pt-3 border-t border-slate-100 flex-shrink-0">
        {/* Attendance */}
        {onAttendance && (
          <button
            onClick={() =>
              onAttendance(
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
                ? "Absen"
                : todayAttendance.check_out
                  ? "Completed"
                  : "Absen Pulang"}
            </span>
          </button>
        )}

        {/* Theme Toggle */}
        <div className="px-3 py-2 flex items-center gap-3 text-slate-600">
          <ThemeToggle />
          <span className="text-sm font-medium">Theme</span>
        </div>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}
