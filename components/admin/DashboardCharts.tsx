"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { motion } from "framer-motion";
import { TrendingUp, Users, ShoppingCart, Clock } from "lucide-react";

interface DashboardChartsProps {
  totalTransactions?: number;
  totalUsers?: number;
  totalServices?: number;
  pendingServices?: number;
  revenue?: number;
}

export default function DashboardCharts({
  totalTransactions = 0,
  totalUsers = 0,
  totalServices = 0,
  pendingServices = 0,
  revenue = 0,
}: DashboardChartsProps) {
  // Data untuk Chart
  const chartData = useMemo(
    () => [
      {
        name: "Transaction",
        value: totalTransactions,
        icon: ShoppingCart,
        color: "#3B82F6",
        bgColor: "#EFF6FF",
      },
      {
        name: "Users",
        value: totalUsers,
        icon: Users,
        color: "#10B981",
        bgColor: "#F0FDF4",
      },
      {
        name: "Services",
        value: totalServices,
        icon: ShoppingCart,
        color: "#8B5CF6",
        bgColor: "#FAF5FF",
      },
      {
        name: "Pending",
        value: pendingServices,
        icon: Clock,
        color: "#F59E0B",
        bgColor: "#FFFBF0",
      },
    ],
    [totalTransactions, totalUsers, totalServices, pendingServices],
  );

  // Data untuk Bar Chart (Overview)
  const barChartData = useMemo(
    () => [
      {
        label: "Transaction",
        value: totalTransactions,
        fill: "#3B82F6",
      },
      {
        label: "Users",
        value: totalUsers,
        fill: "#10B981",
      },
      {
        label: "Services",
        value: totalServices,
        fill: "#8B5CF6",
      },
      {
        label: "Pending",
        value: pendingServices,
        fill: "#F59E0B",
      },
    ],
    [totalTransactions, totalUsers, totalServices, pendingServices],
  );

  // Data untuk Pie Chart (Distribution)
  const pieChartData = useMemo(
    () => [
      {
        name: "Transaction",
        value: totalTransactions,
        fill: "#3B82F6",
      },
      {
        name: "Users",
        value: totalUsers,
        fill: "#10B981",
      },
      {
        name: "Services",
        value: totalServices,
        fill: "#8B5CF6",
      },
      {
        name: "Pending",
        value: pendingServices,
        fill: "#F59E0B",
      },
    ],
    [totalTransactions, totalUsers, totalServices, pendingServices],
  );

  // Custom Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 rounded-lg shadow-lg border border-slate-200">
          <p className="text-sm font-medium text-slate-900">
            {payload[0].payload.label || payload[0].name}
          </p>
          <p className="text-sm font-bold text-slate-700">
            {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  const totalAllData =
    totalTransactions + totalUsers + totalServices + pendingServices;

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-4">
        {chartData.map((item, index) => (
          <motion.div
            key={item.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white rounded-lg sm:rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all"
          >
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center mb-2 sm:mb-3 flex-shrink-0"
              style={{ backgroundColor: item.bgColor }}
            >
              <item.icon
                className="w-5 h-5 sm:w-6 sm:h-6"
                style={{ color: item.color }}
              />
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
              {item.name}
            </p>
            <p className="text-lg sm:text-2xl font-bold text-slate-900">
              {item.value}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-5">
        {/* Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl border border-slate-200 p-3 sm:p-4 md:p-5 shadow-sm"
        >
          <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 sm:mb-4">
            📊 Overview Statistik
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: "#64748B" }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12, fill: "#64748B" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                fill="#3B82F6"
                radius={[8, 8, 0, 0]}
                isAnimationActive
              >
                {barChartData.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Pie Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl border border-slate-200 p-3 sm:p-4 md:p-5 shadow-sm"
        >
          <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 sm:mb-4">
            🥧 Distribusi Data
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                isAnimationActive
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`pie-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value}`} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Summary Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl border border-slate-200 p-3 sm:p-4 md:p-5 shadow-sm"
      >
        <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-3 sm:mb-4">
          📈 Ringkasan Data
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg border border-blue-200">
            <p className="text-xs sm:text-sm text-blue-600 font-medium mb-1">
              Total Transaksi
            </p>
            <p className="text-xl sm:text-2xl font-bold text-blue-900">
              {totalTransactions}
            </p>
          </div>

          <div className="p-3 sm:p-4 bg-gradient-to-br from-green-50 to-green-100/50 rounded-lg border border-green-200">
            <p className="text-xs sm:text-sm text-green-600 font-medium mb-1">
              Total Pengguna
            </p>
            <p className="text-xl sm:text-2xl font-bold text-green-900">
              {totalUsers}
            </p>
          </div>

          <div className="p-3 sm:p-4 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg border border-purple-200">
            <p className="text-xs sm:text-sm text-purple-600 font-medium mb-1">
              Total Service
            </p>
            <p className="text-xl sm:text-2xl font-bold text-purple-900">
              {totalServices}
            </p>
          </div>

          <div className="p-3 sm:p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-lg border border-amber-200">
            <p className="text-xs sm:text-sm text-amber-600 font-medium mb-1">
              Service Pending
            </p>
            <p className="text-xl sm:text-2xl font-bold text-amber-900">
              {pendingServices}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Revenue Card */}
      {revenue > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg sm:rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-6 text-white shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs sm:text-sm font-medium text-slate-300 uppercase tracking-wide mb-1">
                💰 Total Pendapatan
              </p>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold">
                {new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                  minimumFractionDigits: 0,
                }).format(revenue)}
              </p>
            </div>
            <TrendingUp className="w-12 h-12 sm:w-14 sm:h-14 opacity-20" />
          </div>
        </motion.div>
      )}
    </div>
  );
}
