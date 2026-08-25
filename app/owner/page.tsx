"use client";

import { useMemo, useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  FileText,
  Star,
  Database,
  Users,
  Search,
  Watch,
  Calendar,
  ChevronDown,
  Menu,
  RefreshCw,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import ThemeToggle from "@/components/ThemeToggle";
import UserAvatar from "@/components/ui/UserAvatar";
import BranchSelector from "@/components/ui/BranchSelector";
import ReportModal from "@/components/ui/ReportModal";
import FeedbackList from "@/components/owner/FeedbackList";
import ClosingApproval from "@/components/admin/ClosingApproval";
import WatchDatabase from "@/components/owner/WatchDatabase";
import CustomerList from "@/components/admin/CustomerList";
import TrackingVisits from "@/components/owner/TrackingVisits";
import WidgetRenderer from "@/components/owner/WidgetRenderer";
import { useOwnerDashboard } from "@/hooks/useOwnerDashboard";
import { WIDGET_ORDER } from "@/constants/owner";
import { formatCompactRupiah } from "@/lib/owner/format";
import type { WidgetContext } from "@/types/owner";

type DateRange = "today" | "week" | "month" | "custom";
type Tab = "dashboard" | "feedback" | "closing" | "watch_db" | "customer" | "tracking";

const rangeLabel: Record<DateRange, string> = {
  today: "Today",
  week: "Week",
  month: "Month",
  custom: "Custom",
};

const menu: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "feedback", label: "Feedback", icon: Star },
  { id: "closing", label: "Closing", icon: FileText },
  { id: "watch_db", label: "Watch DB", icon: Database },
  { id: "customer", label: "Customer", icon: Users },
  { id: "tracking", label: "Tracking", icon: Search },
];

function resolveRange(
  range: DateRange,
  customStart: Date,
  customEnd: Date,
): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "week":
      return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    case "custom":
      return { start: startOfDay(customStart), end: endOfDay(customEnd) };
    default:
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
  }
}

export default function OwnerDashboard() {
  const { user, logout } = useAuthStore();
  const supabase = createClient();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [range, setRange] = useState<DateRange>("month");
  const [customStart, setCustomStart] = useState<Date>(() => subDays(new Date(), 7));
  const [customEnd, setCustomEnd] = useState<Date>(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const dateRange = useMemo(
    () => resolveRange(range, customStart, customEnd),
    [range, customStart, customEnd],
  );

  const { snapshot, loading, error, refresh, updateSettings } = useOwnerDashboard({
    dateRange,
  });

  const ctx: WidgetContext | null = snapshot
    ? { snapshot, dateRange, refresh, updateSettings }
    : null;

  const manualRefresh = () => {
    setRefreshing(true);
    refresh();
    window.setTimeout(() => setRefreshing(false), 800);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push("/login");
  };

  const isLoading = loading && !snapshot;
  const isError = !loading && !snapshot && error !== null;

  return (
    <div className="min-h-screen bg-[#eef4fa] dark:bg-[#0a0a0a]">
      <div
        className={`fixed inset-y-0 left-0 w-64 bg-white dark:bg-[#111111] border-r border-slate-200/70 dark:border-white/5 z-40 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } flex flex-col`}
      >
        <div className="p-4 border-b border-slate-200/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-slate-900 rounded-xl flex items-center justify-center">
              <Watch className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-gray-100">WatchService</h1>
              <p className="text-[11px] text-slate-500">Owner Panel</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 hover:bg-slate-100 rounded-lg"
            aria-label="Tutup menu"
          >
            ✕
          </button>
        </div>

        <div className="mx-3 mt-3 flex items-center gap-2.5 p-2 bg-slate-50 rounded-2xl">
          <div className="w-8 h-8 bg-slate-900 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
            {user?.full_name?.charAt(0) || "O"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-xs truncate dark:text-gray-100">{user?.full_name}</p>
            <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {menu.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 font-medium text-sm flex items-center gap-3 rounded-xl transition-all ${
                tab === item.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/70"
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200/70 space-y-1">
          <button
            onClick={() => setShowReport(true)}
            className="w-full text-left px-3 py-2 text-sm font-medium text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
          >
            Lapor bug / fitur
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-md border-b border-slate-200/70">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 dark:text-gray-100 truncate">
                {menu.find((m) => m.id === tab)?.label}
              </h2>
              {tab === "dashboard" && snapshot && (
                <p className="text-[11px] text-slate-400 truncate">
                  Hari ini{" "}
                  <span className="font-semibold text-slate-600">
                    {formatCompactRupiah(snapshot.stats.todayRevenue)}
                  </span>{" "}
                  · Health {snapshot.health.score} · {snapshot.stats.activeServices} aktif
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {tab === "dashboard" && (
                <>
                  <div className="hidden sm:flex gap-1">
                    {(["today", "week", "month", "custom"] as DateRange[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r)}
                        aria-pressed={range === r}
                        className={`px-2.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                          range === r
                            ? "bg-slate-900 text-white"
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {rangeLabel[r]}
                      </button>
                    ))}
                  </div>
                  {range === "custom" && (
                    <div className="relative">
                      <button
                        onClick={() => setPickerOpen(!pickerOpen)}
                        className="flex items-center gap-1 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        {format(dateRange.start, "dd MMM")}–{format(dateRange.end, "dd MMM")}
                        <ChevronDown className="w-3 h-3" />
                      </button>
                      {pickerOpen && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-50 p-3 space-y-2">
                          <label className="block text-xs text-slate-400">
                            Start
                            <input
                              type="date"
                              value={format(customStart, "yyyy-MM-dd")}
                              onChange={(e) => setCustomStart(new Date(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm mt-1"
                            />
                          </label>
                          <label className="block text-xs text-slate-400">
                            End
                            <input
                              type="date"
                              value={format(customEnd, "yyyy-MM-dd")}
                              onChange={(e) => setCustomEnd(new Date(e.target.value))}
                              className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm mt-1"
                            />
                          </label>
                          <button
                            onClick={() => setPickerOpen(false)}
                            className="w-full bg-slate-900 text-white py-1.5 rounded-lg text-sm"
                          >
                            Terapkan
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={manualRefresh}
                    disabled={refreshing}
                    aria-label="Refresh data"
                    className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${refreshing ? "animate-spin" : ""}`} />
                  </button>
                </>
              )}
              <BranchSelector />
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
                aria-label="Buka menu"
              >
                <Menu className="w-4 h-4" />
              </button>
              <UserAvatar user={user} />
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          {tab === "feedback" && <FeedbackList />}
          {tab === "closing" && <ClosingApproval />}
          {tab === "watch_db" && <WatchDatabase />}
          {tab === "customer" && <CustomerList />}
          {tab === "tracking" && <TrackingVisits />}

          {tab === "dashboard" && isLoading && (
            <div className="space-y-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-[#111111] rounded-2xl border border-slate-200/70 p-5"
                >
                  <div className="h-3.5 w-1/3 rounded-full bg-slate-200 animate-pulse mb-3" />
                  <div className="h-24 rounded-xl bg-slate-100 animate-pulse" />
                </div>
              ))}
            </div>
          )}
          {tab === "dashboard" && isError && (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
              <p className="text-sm text-slate-500">{error}</p>
              <button
                onClick={manualRefresh}
                className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium"
              >
                Coba lagi
              </button>
            </div>
          )}
          {tab === "dashboard" && ctx && (
            <div className="space-y-4 sm:space-y-6 pb-10">
              <div className="sm:hidden flex gap-1.5 flex-wrap">
                {(["today", "week", "month", "custom"] as DateRange[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                      range === r
                        ? "bg-slate-900 text-white"
                        : "bg-white border border-slate-200 text-slate-600"
                    }`}
                  >
                    {rangeLabel[r]}
                  </button>
                ))}
              </div>
              {WIDGET_ORDER.map((id) => (
                <WidgetRenderer key={id} id={id} ctx={ctx} />
              ))}
              <p className="text-xs text-slate-400 text-center pt-2">
                Terakhir diperbarui {ctx.snapshot.lastUpdated.toLocaleTimeString("id-ID")}
              </p>
            </div>
          )}
        </main>
      </div>

      <ReportModal
        open={showReport}
        onClose={() => setShowReport(false)}
        currentModule="Owner Panel"
      />
    </div>
  );
}
