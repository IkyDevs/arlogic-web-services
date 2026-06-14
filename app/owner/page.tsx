'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Users, Clock, Calendar, ChevronDown, BarChart3,
  LogOut, Watch, Menu, X, LayoutDashboard,
  FileText, Star, Database, QrCode, Bell
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const RevenueChart = dynamic(() => import('@/components/owner/RevenueChart'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white shadow-[8px_8px_0_0_#000]">LOADING CHART...</div>
});
const PerformanceChart = dynamic(() => import('@/components/owner/PerformanceChart'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white shadow-[8px_8px_0_0_#000]">LOADING CHART...</div>
});
const ExportButton = dynamic(() => import('@/components/owner/ExportButton'), {
  loading: () => <div className="px-4 py-2 border-2 border-black font-mono">Loading...</div>
});
const WatchDatabase = dynamic(() => import('@/components/owner/WatchDatabase'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white">LOADING...</div>
});
const FeedbackList = dynamic(() => import('@/components/owner/FeedbackList'), {
  loading: () => <div className="border-2 border-black p-8 text-center font-mono bg-white">LOADING...</div>
});

type DateRange = 'today' | 'week' | 'month' | 'custom';
type PeriodType = 'month' | 'year';
type ActiveTab = 'overview' | 'revenue' | 'performance' | 'feedback' | 'watch_db';

interface DashboardData {
  revenue: number;
  expenses: number;
  profit: number;
  completedServices: number;
  totalServices: number;
  activeTechnicians: number;
  averageCompletionTime: number;
  technicianPerformance: any[];
  monthlyComparison: {
    revenue: number;
    profit: number;
    growth: number;
  };
}

export default function OwnerDashboard() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [customStartDate, setCustomStartDate] = useState<Date>(subDays(new Date(), 7));
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparePeriod, setComparePeriod] = useState<PeriodType>('month');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
    fetchUnreadCount();
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [dateRange, customStartDate, customEndDate]);

  const getDateRangeValues = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return { start: startOfDay(subWeeks(now, 1)), end: endOfDay(now) };
      case 'month': return { start: startOfDay(subMonths(now, 1)), end: endOfDay(now) };
      case 'custom': return { start: startOfDay(customStartDate), end: endOfDay(customEndDate) };
      default: return { start: startOfDay(subMonths(now, 1)), end: endOfDay(now) };
    }
  };

  const fetchUnreadCount = async () => {
    if (!user?.id) return;
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setUnreadCount(count || 0);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    const { start, end } = getDateRangeValues();

    try {
      const { data: services } = await supabase
        .from('service_orders')
        .select('*, service_items(*)')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const { data: attendances } = await supabase
        .from('attendances')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      const { data: techProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'teknisi');

      const revenue = services?.reduce((sum, service) => {
        const serviceTotal = service.service_items?.reduce((itemSum: number, item: any) =>
          itemSum + (Number(item.price) * (item.quantity || 1) || 0), 0) || 0;
        return sum + serviceTotal;
      }, 0) || 0;

      const expenses = revenue * 0.35;
      const profit = revenue - expenses;
      const completedServices = services?.filter(s => s.status === 'completed').length || 0;
      const totalServices = services?.length || 0;
      const activeTechnicians = new Set(attendances?.filter(a => !a.check_out).map(a => a.teknisi_id)).size;

      const completionTimes = services
        ?.filter(s => s.completed_at && s.created_at)
        .map(s => {
          const created = new Date(s.created_at);
          const completed = new Date(s.completed_at);
          return (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }) || [];

      const averageCompletionTime = completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : 0;

      const techMap: Record<string, any> = {};
      services?.filter(s => s.assigned_teknisi_id).forEach(service => {
        const techId = service.assigned_teknisi_id;
        const techName = techProfiles?.find(t => t.id === techId)?.full_name || 'Unknown';
        const serviceRevenue = service.service_items?.reduce((sum: number, item: any) =>
          sum + (Number(item.price) * (item.quantity || 1) || 0), 0) || 0;

        if (!techMap[techId]) {
          techMap[techId] = { id: techId, name: techName, completed: 0, revenue: 0 };
        }
        if (service.status === 'completed') techMap[techId].completed++;
        techMap[techId].revenue += serviceRevenue;
      });

      const technicianPerformance = Object.values(techMap);

      const previousStart = subMonths(start, 1);
      const previousEnd = subMonths(end, 1);
      const { data: previousServices } = await supabase
        .from('service_orders')
        .select('*, service_items(*)')
        .gte('created_at', previousStart.toISOString())
        .lte('created_at', previousEnd.toISOString());

      const previousRevenue = previousServices?.reduce((sum, service) => {
        return sum + (service.service_items?.reduce((s: number, i: any) =>
          s + (Number(i.price) * (i.quantity || 1) || 0), 0) || 0);
      }, 0) || 0;

      const revenueGrowth = previousRevenue === 0 ? 100
        : ((revenue - previousRevenue) / previousRevenue) * 100;

      setDashboardData({
        revenue, expenses, profit, completedServices, totalServices,
        activeTechnicians, averageCompletionTime, technicianPerformance,
        monthlyComparison: { revenue, profit, growth: revenueGrowth }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    router.push('/login');
    toast.success('Logged out successfully');
  };

  const menuItems: { id: ActiveTab; label: string; icon: any; color: string }[] = [
    { id: 'overview', label: 'OVERVIEW', icon: LayoutDashboard, color: 'pink' },
    { id: 'revenue', label: 'REVENUE', icon: DollarSign, color: 'yellow' },
    { id: 'performance', label: 'PERFORMANCE', icon: BarChart3, color: 'blue' },
    { id: 'feedback', label: 'FEEDBACK', icon: Star, color: 'pink' },
    { id: 'watch_db', label: 'WATCH DB', icon: Database, color: 'yellow' },
  ];

  const statsCards = [
    {
      title: 'TOTAL REVENUE',
      value: `Rp ${(dashboardData?.revenue || 0).toLocaleString('id-ID')}`,
      change: dashboardData?.monthlyComparison.growth || 0,
      icon: DollarSign,
      color: 'pink',
    },
    {
      title: 'NET PROFIT',
      value: `Rp ${(dashboardData?.profit || 0).toLocaleString('id-ID')}`,
      change: 12.5,
      icon: TrendingUp,
      color: 'blue',
    },
    {
      title: 'SERVICES',
      value: `${dashboardData?.completedServices || 0}/${dashboardData?.totalServices || 0}`,
      change: 8.2,
      icon: Package,
      color: 'yellow',
    },
    {
      title: 'ACTIVE TEKNISI',
      value: dashboardData?.activeTechnicians || 0,
      change: 0,
      icon: Users,
      color: 'pink',
    },
    {
      title: 'AVG. DURATION',
      value: `${(dashboardData?.averageCompletionTime || 0).toFixed(1)} days`,
      change: -5.6,
      icon: Clock,
      color: 'blue',
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-72 bg-white border-r-2 border-black z-50 transform transition-transform duration-200 flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="p-5 border-b-2 border-black">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-[#FF6B9D] flex items-center justify-center border-2 border-black">
                <Watch className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter">WATCH<span className="text-[#FF6B9D]">SERV</span></h1>
                <p className="text-[10px] font-mono uppercase">Owner Panel</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 border-2 border-black">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 p-3 border-2 border-black bg-[#FFDE00]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-black flex items-center justify-center text-[#FFDE00] font-black text-sm border-2 border-black">
                {user?.full_name?.charAt(0) || 'O'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-sm truncate">{user?.full_name}</p>
                <p className="text-[10px] font-mono truncate">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const colorMap = {
              pink: activeTab === item.id ? 'bg-[#FF6B9D] text-white' : 'bg-white text-black hover:bg-[#FF6B9D]/10',
              yellow: activeTab === item.id ? 'bg-[#FFDE00] text-black' : 'bg-white text-black hover:bg-[#FFDE00]/30',
              blue: activeTab === item.id ? 'bg-[#3B82F6] text-white' : 'bg-white text-black hover:bg-[#3B82F6]/10',
            };
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                className={`w-full text-left px-3 py-2.5 font-black text-sm flex items-center gap-3 border-2 border-black transition-all ${colorMap[item.color as keyof typeof colorMap]} ${activeTab === item.id ? 'shadow-[3px_3px_0px_0px_black]' : ''}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t-2 border-black">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-2.5 font-black text-sm flex items-center gap-3 border-2 border-black bg-black text-white hover:bg-gray-800 transition-all"
          >
            <LogOut className="w-4 h-4" />
            LOGOUT
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="lg:ml-72">
        {/* Top Bar */}
        <div className="sticky top-0 bg-white border-b-2 border-black z-30">
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 border-2 border-black bg-[#FFDE00] shadow-[3px_3px_0_0_#000]"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-2xl font-black tracking-tighter">
                  {menuItems.find(m => m.id === activeTab)?.label}
                </h2>
                <p className="text-xs font-mono">{format(new Date(), 'EEEE, dd MMMM yyyy')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notification Bell */}
              <button
                onClick={() => router.push('/owner')}
                className="relative p-2 border-2 border-black bg-white shadow-[3px_3px_0_0_#000] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#FF6B9D] border border-black text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Date Range */}
              <div className="relative">
                <button
                  onClick={() => setShowDatePicker(!showDatePicker)}
                  className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-mono font-bold text-sm"
                >
                  <Calendar size={16} />
                  {dateRange === 'today' && 'Today'}
                  {dateRange === 'week' && 'This Week'}
                  {dateRange === 'month' && 'This Month'}
                  {dateRange === 'custom' && 'Custom'}
                  <ChevronDown size={14} />
                </button>

                <AnimatePresence>
                  {showDatePicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute right-0 mt-2 w-64 bg-white border-2 border-black shadow-[8px_8px_0_0_#000] z-10 p-3"
                    >
                      {(['today', 'week', 'month', 'custom'] as DateRange[]).map(range => (
                        <button
                          key={range}
                          onClick={() => { setDateRange(range); if (range !== 'custom') setShowDatePicker(false); }}
                          className={`w-full text-left px-3 py-2 hover:bg-[#FFDE00] font-mono text-sm transition-colors ${dateRange === range ? 'bg-[#FFDE00] font-bold' : ''}`}
                        >
                          {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'Custom Range'}
                        </button>
                      ))}

                      {dateRange === 'custom' && (
                        <div className="mt-3 pt-3 border-t-2 border-black space-y-2">
                          <div>
                            <label className="block text-xs font-mono mb-1 font-bold">Start Date</label>
                            <input
                              type="date"
                              value={format(customStartDate, 'yyyy-MM-dd')}
                              onChange={(e) => setCustomStartDate(new Date(e.target.value))}
                              className="w-full px-2 py-1 border-2 border-black font-mono text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-mono mb-1 font-bold">End Date</label>
                            <input
                              type="date"
                              value={format(customEndDate, 'yyyy-MM-dd')}
                              onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                              className="w-full px-2 py-1 border-2 border-black font-mono text-sm"
                            />
                          </div>
                          <button
                            onClick={() => { fetchDashboardData(); setShowDatePicker(false); }}
                            className="w-full bg-[#3B82F6] text-white py-2 border-2 border-black shadow-[3px_3px_0_0_#000] font-mono font-bold text-sm"
                          >
                            Apply
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <ExportButton data={dashboardData} dateRange={getDateRangeValues()} />
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-[#FF6B9D]" />
                      <p className="mt-4 font-mono font-bold">Loading...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
                      {statsCards.map((stat, i) => {
                        const isPositive = stat.change >= 0;
                        const bgMap = { pink: 'bg-[#FF6B9D]', blue: 'bg-[#3B82F6]', yellow: 'bg-[#FFDE00]' };
                        return (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="bg-white border-2 border-black shadow-[6px_6px_0_0_#000] p-5 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0_0_#000] transition-all"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className={`w-9 h-9 ${bgMap[stat.color as keyof typeof bgMap]} border-2 border-black flex items-center justify-center`}>
                                <stat.icon className="w-4 h-4 text-white" />
                              </div>
                              {stat.change !== 0 && (
                                <span className={`flex items-center gap-0.5 text-xs font-mono font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                                  {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                  {Math.abs(stat.change).toFixed(1)}%
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-wide mb-1">{stat.title}</p>
                            <p className="text-xl font-black font-mono leading-tight">{stat.value}</p>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Charts Row */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-8">
                      <RevenueChart data={dashboardData} dateRange={getDateRangeValues()} comparePeriod={comparePeriod} />
                      <PerformanceChart data={dashboardData?.technicianPerformance || []} totalServices={dashboardData?.totalServices || 0} />
                    </div>

                    {/* Bottom Row */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Financial Summary */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-6"
                      >
                        <div className="flex items-center gap-2 mb-5">
                          <div className="w-8 h-8 bg-[#FFDE00] border-2 border-black flex items-center justify-center">
                            <DollarSign className="w-4 h-4" />
                          </div>
                          <h2 className="text-xl font-black font-mono">FINANCIAL SUMMARY</h2>
                        </div>
                        <div className="space-y-3">
                          {[
                            { label: 'Revenue', value: dashboardData?.revenue || 0, color: 'text-green-600' },
                            { label: 'Expenses (est.)', value: dashboardData?.expenses || 0, color: 'text-red-600' },
                            { label: 'Gross Profit', value: dashboardData?.profit || 0, color: 'text-blue-600' },
                          ].map((item, i) => (
                            <div key={i} className="flex justify-between items-center pb-3 border-b-2 border-black last:border-0 last:pb-0">
                              <span className="font-mono font-bold text-sm">{item.label}</span>
                              <span className={`font-mono font-black ${item.color}`}>
                                Rp {item.value.toLocaleString('id-ID')}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center pt-2">
                            <span className="font-mono font-bold text-sm">Profit Margin</span>
                            <span className="font-mono font-black text-[#FF6B9D]">
                              {dashboardData?.revenue ? ((dashboardData.profit / dashboardData.revenue) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                        </div>
                      </motion.div>

                      {/* Quick Actions */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-6"
                      >
                        <div className="flex items-center gap-2 mb-5">
                          <div className="w-8 h-8 bg-[#FF6B9D] border-2 border-black flex items-center justify-center">
                            <FileText className="w-4 h-4 text-white" />
                          </div>
                          <h2 className="text-xl font-black font-mono">QUICK ACTIONS</h2>
                        </div>
                        <div className="space-y-3">
                          <button
                            onClick={() => setActiveTab('revenue')}
                            className="w-full flex items-center justify-between px-4 py-3 bg-[#3B82F6] text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-mono font-bold text-sm"
                          >
                            <span>Revenue Analytics</span>
                            <DollarSign size={16} />
                          </button>
                          <button
                            onClick={() => setActiveTab('performance')}
                            className="w-full flex items-center justify-between px-4 py-3 bg-[#FFDE00] border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-mono font-bold text-sm"
                          >
                            <span>Team Performance</span>
                            <BarChart3 size={16} />
                          </button>
                          <button
                            onClick={() => setActiveTab('feedback')}
                            className="w-full flex items-center justify-between px-4 py-3 bg-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all font-mono font-bold text-sm"
                          >
                            <span>Customer Feedback</span>
                            <Star size={16} />
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'revenue' && (
              <motion.div key="revenue" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <RevenueChart data={dashboardData} dateRange={getDateRangeValues()} comparePeriod={comparePeriod} />
              </motion.div>
            )}

            {activeTab === 'performance' && (
              <motion.div key="performance" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <PerformanceChart
                  data={dashboardData?.technicianPerformance || []}
                  totalServices={dashboardData?.totalServices || 0}
                />
              </motion.div>
            )}

            {activeTab === 'feedback' && (
              <motion.div key="feedback" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <FeedbackList />
              </motion.div>
            )}

            {activeTab === 'watch_db' && (
              <motion.div key="watch_db" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <WatchDatabase />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
