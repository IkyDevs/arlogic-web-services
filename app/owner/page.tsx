'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, Package,
  Users, Clock, Download, Calendar, ChevronDown,
  Printer, FileText, PieChart, BarChart3
} from 'lucide-react';
import RevenueChart from '@/components/owner/RevenueChart';
import PerformanceChart from '@/components/owner/PerformanceChart';
import ExportButton from '@/components/owner/ExportButton';
import { supabase } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';

type DateRange = 'today' | 'week' | 'month' | 'custom';
type PeriodType = 'month' | 'year';

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
  const { user } = useAuthStore();
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [customStartDate, setCustomStartDate] = useState<Date>(subDays(new Date(), 7));
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [comparePeriod, setComparePeriod] = useState<PeriodType>('month');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange, customStartDate, customEndDate]);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case 'week':
        return { start: startOfDay(subWeeks(now, 1)), end: endOfDay(now) };
      case 'month':
        return { start: startOfDay(subMonths(now, 1)), end: endOfDay(now) };
      case 'custom':
        return { start: startOfDay(customStartDate), end: endOfDay(customEndDate) };
      default:
        return { start: startOfDay(subMonths(now, 1)), end: endOfDay(now) };
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    const { start, end } = getDateRange();

    try {
      // Fetch completed services in range
      const { data: services } = await supabase
        .from('service_orders')
        .select(`
          *,
          service_items (*),
          qc_reviews (*)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Fetch technicians attendance
      const { data: attendances } = await supabase
        .from('attendances')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Calculate financials
      const revenue = services?.reduce((sum, service) => {
        const serviceTotal = service.service_items?.reduce((itemSum: number, item: any) =>
          itemSum + (item.price || 0), 0) || 0;
        return sum + serviceTotal;
      }, 0) || 0;

      const expenses = revenue * 0.35; // Estimasi expenses (bisa disesuaikan dengan data real)
      const profit = revenue - expenses;

      const completedServices = services?.filter(s => s.status === 'completed').length || 0;
      const totalServices = services?.length || 0;

      const activeTechnicians = attendances?.filter(a => a.check_out === null).length || 0;

      // Calculate average completion time
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

      // Technician performance
      const technicianPerformance = services
        ?.filter(s => s.teknisi_id)
        .reduce((acc: any[], service) => {
          const existing = acc.find(t => t.id === service.teknisi_id);
          if (existing) {
            existing.completed++;
            existing.revenue += service.service_items?.reduce((sum: number, item: any) =>
              sum + (item.price || 0), 0) || 0;
          } else {
            acc.push({
              id: service.teknisi_id,
              name: service.teknisi_name || 'Unknown',
              completed: 1,
              revenue: service.service_items?.reduce((sum: number, item: any) =>
                sum + (item.price || 0), 0) || 0
            });
          }
          return acc;
        }, []) || [];

      // Monthly comparison
      const previousMonthStart = subMonths(start, 1);
      const previousMonthEnd = subMonths(end, 1);

      const { data: previousServices } = await supabase
        .from('service_orders')
        .select('*')
        .gte('created_at', previousMonthStart.toISOString())
        .lte('created_at', previousMonthEnd.toISOString());

      const previousRevenue = previousServices?.reduce((sum, service) => sum + (service.total_price || 0), 0) || 0;
      const revenueGrowth = previousRevenue === 0 ? 100 : ((revenue - previousRevenue) / previousRevenue) * 100;

      setDashboardData({
        revenue,
        expenses,
        profit,
        completedServices,
        totalServices,
        activeTechnicians,
        averageCompletionTime,
        technicianPerformance,
        monthlyComparison: {
          revenue,
          profit,
          growth: revenueGrowth
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const statsCards = [
    {
      title: 'Total Revenue',
      value: `Rp ${dashboardData?.revenue.toLocaleString() || 0}`,
      change: dashboardData?.monthlyComparison.growth || 0,
      icon: DollarSign,
      color: 'pink',
      trend: (dashboardData?.monthlyComparison.growth || 0) >= 0 ? 'up' : 'down'
    },
    {
      title: 'Net Profit',
      value: `Rp ${dashboardData?.profit.toLocaleString() || 0}`,
      change: 12.5,
      icon: TrendingUp,
      color: 'blue',
      trend: 'up'
    },
    {
      title: 'Completed Services',
      value: `${dashboardData?.completedServices || 0}/${dashboardData?.totalServices || 0}`,
      change: 8.2,
      icon: Package,
      color: 'yellow',
      trend: 'up'
    },
    {
      title: 'Active Technicians',
      value: dashboardData?.activeTechnicians || 0,
      change: -2.4,
      icon: Users,
      color: 'pink',
      trend: 'down'
    },
    {
      title: 'Avg Completion Time',
      value: `${dashboardData?.averageCompletionTime.toFixed(1) || 0} days`,
      change: -5.6,
      icon: Clock,
      color: 'blue',
      trend: 'down'
    }
  ];

  const getColorStyles = (color: string) => {
    switch(color) {
      case 'pink': return 'bg-[#FF6B9D]';
      case 'blue': return 'bg-[#3B82F6]';
      case 'yellow': return 'bg-[#FFDE00]';
      default: return 'bg-[#FF6B9D]';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-black border-t-[#FF6B9D]"></div>
            <p className="mt-4 font-mono font-bold">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-black font-mono mb-2">OWNER DASHBOARD</h1>
            <p className="text-gray-600 font-mono">
              Welcome back, {user?.full_name || 'Owner'}
            </p>
          </div>

          <div className="flex gap-3">
            <ExportButton
              data={dashboardData}
              dateRange={getDateRange()}
            />

            {/* Date Range Selector */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] transition-all font-mono font-bold"
              >
                <Calendar size={18} />
                {dateRange === 'today' && 'Today'}
                {dateRange === 'week' && 'This Week'}
                {dateRange === 'month' && 'This Month'}
                {dateRange === 'custom' && 'Custom Range'}
                <ChevronDown size={16} />
              </button>

              {showDatePicker && (
                <div className="absolute right-0 mt-2 w-64 bg-white border-2 border-black shadow-[8px_8px_0_0_#000] z-10 p-4">
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        setDateRange('today');
                        setShowDatePicker(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#FFDE00] transition-colors font-mono"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => {
                        setDateRange('week');
                        setShowDatePicker(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#FFDE00] transition-colors font-mono"
                    >
                      This Week
                    </button>
                    <button
                      onClick={() => {
                        setDateRange('month');
                        setShowDatePicker(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#FFDE00] transition-colors font-mono"
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => {
                        setDateRange('custom');
                        setShowDatePicker(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-[#FFDE00] transition-colors font-mono"
                    >
                      Custom Range
                    </button>

                    {dateRange === 'custom' && (
                      <div className="mt-3 pt-3 border-t-2 border-black">
                        <label className="block text-sm font-mono mb-1">Start Date</label>
                        <input
                          type="date"
                          value={format(customStartDate, 'yyyy-MM-dd')}
                          onChange={(e) => setCustomStartDate(new Date(e.target.value))}
                          className="w-full px-2 py-1 border-2 border-black mb-2 font-mono"
                        />
                        <label className="block text-sm font-mono mb-1">End Date</label>
                        <input
                          type="date"
                          value={format(customEndDate, 'yyyy-MM-dd')}
                          onChange={(e) => setCustomEndDate(new Date(e.target.value))}
                          className="w-full px-2 py-1 border-2 border-black mb-2 font-mono"
                        />
                        <button
                          onClick={() => {
                            fetchDashboardData();
                            setShowDatePicker(false);
                          }}
                          className="w-full bg-[#3B82F6] text-white py-2 border-2 border-black shadow-[4px_4px_0_0_#000] font-mono font-bold"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        {statsCards.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-6 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[12px_12px_0_0_#000] transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <stat.icon size={24} className={`${getColorStyles(stat.color)} p-1 rounded border-2 border-black`} />
              <span className={`flex items-center gap-1 text-sm font-mono font-bold ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {stat.trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {Math.abs(stat.change)}%
              </span>
            </div>
            <h3 className="text-sm font-mono text-gray-600 mb-2">{stat.title}</h3>
            <p className="text-2xl font-black font-mono">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <RevenueChart
          data={dashboardData}
          dateRange={getDateRange()}
          comparePeriod={comparePeriod}
        />
        <PerformanceChart
          data={dashboardData?.technicianPerformance || []}
          totalServices={dashboardData?.totalServices || 0}
        />
      </div>

      {/* Additional Reports Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Financial Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <DollarSign size={24} className="bg-[#FFDE00] p-1 rounded border-2 border-black" />
            <h2 className="text-2xl font-black font-mono">Financial Summary</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b-2 border-black">
              <span className="font-mono font-bold">Revenue</span>
              <span className="font-mono font-black text-green-600">
                Rp {dashboardData?.revenue.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b-2 border-black">
              <span className="font-mono font-bold">Expenses</span>
              <span className="font-mono font-black text-red-600">
                Rp {dashboardData?.expenses.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b-2 border-black">
              <span className="font-mono font-bold">Gross Profit</span>
              <span className="font-mono font-black text-blue-600">
                Rp {dashboardData?.profit.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-mono font-bold">Profit Margin</span>
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
          <div className="flex items-center gap-2 mb-6">
            <FileText size={24} className="bg-[#FF6B9D] p-1 rounded border-2 border-black" />
            <h2 className="text-2xl font-black font-mono">Quick Actions</h2>
          </div>

          <div className="space-y-3">
            <button className="w-full flex items-center justify-between px-4 py-3 bg-[#3B82F6] text-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] transition-all font-mono font-bold">
              <span>Generate Monthly Report</span>
              <Printer size={18} />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 bg-[#FFDE00] border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] transition-all font-mono font-bold">
              <span>View Detailed Analytics</span>
              <BarChart3 size={18} />
            </button>
            <button className="w-full flex items-center justify-between px-4 py-3 bg-white border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] transition-all font-mono font-bold">
              <span>Export All Data</span>
              <Download size={18} />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
