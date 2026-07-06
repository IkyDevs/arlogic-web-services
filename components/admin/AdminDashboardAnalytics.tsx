"use client";

import { useMemo, useEffect, useState } from "react";
import {
  AreaChart,
  Area,
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
} from "recharts";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Users,
  ShoppingCart,
  Clock,
  ArrowUp,
  ArrowDown,
  Box,
} from "lucide-react";

interface AdminDashboardAnalyticsProps {
  totalTransactions?: number;
  totalUsers?: number;
  totalServices?: number;
  totalInventory?: number;
  pendingServices?: number;
  revenue?: number;
  revenueGrowth?: number;
  isDark?: boolean;
  chartData?: any[];
  recentTransactions?: any[];
}

export default function AdminDashboardAnalytics({
  totalTransactions = 0,
  totalUsers = 0,
  totalServices = 0,
  totalInventory = 0,
  pendingServices = 0,
  revenue = 0,
  revenueGrowth = 12.5,
  isDark = false,
  chartData: externalChartData = [],
  recentTransactions = [],
}: AdminDashboardAnalyticsProps) {
  // Gunakan data real dari props (chartData dari API)
  // chartData berisi data transaction per bulan dari database
  const chartData = useMemo(
    () =>
      externalChartData && externalChartData.length > 0
        ? externalChartData
        : [],
    [externalChartData],
  );

  const pieData = useMemo(
    () => [
      { name: "Transaction", value: totalTransactions || 1 },
      { name: "Users", value: totalUsers || 1 },
      { name: "Services", value: totalServices || 1 },
      { name: "Pending", value: pendingServices || 1 },
    ],
    [totalTransactions, totalUsers, totalServices, pendingServices],
  );

  const COLORS = {
    light: ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B"],
    dark: ["#60A5FA", "#34D399", "#A78BFA", "#FBBF24"],
  };

  const bgColor = isDark ? "#1c1c1c" : "#FFFFFF";
  const textColor = isDark ? "#F1F5F9" : "#1E293B";
  const gridColor = isDark ? "#334155" : "#E2E8F0";
  const tooltipBg = isDark ? "#0F172A" : "#FFFFFF";

  const StatCard = ({
    label,
    value,
    icon: Icon,
    trend,
    bgGradient,
  }: {
    label: string;
    value: number | string;
    icon: any;
    trend?: number;
    bgGradient: string;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${bgGradient} rounded-lg md:rounded-xl p-2.5 md:p-3 lg:p-4 border ${
        isDark
          ? "border-slate-700 shadow-lg shadow-slate-900/50"
          : "border-slate-200 shadow-lg shadow-slate-900/5"
      } backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between mb-1.5 md:mb-2">
        <div>
          <p
            className={`text-[10px] md:text-xs font-medium mb-0.5 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          >
            {label}
          </p>
          <p
            className={`text-lg md:text-xl lg:text-2xl font-bold ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            {value}
          </p>
        </div>
        <div
          className={`p-1 md:p-1.5 rounded-lg ${
            isDark ? "bg-slate-800" : "bg-white/50"
          }`}
        >
          <Icon
            className={`w-3.5 h-3.5 md:w-4 md:h-4 lg:w-5 lg:h-5 ${
              isDark ? "text-slate-300" : "text-slate-600"
            }`}
          />
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 text-[9px] md:text-xs">
          {trend > 0 ? (
            <ArrowUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-green-500" />
          ) : (
            <ArrowDown className="w-2.5 h-2.5 md:w-3 md:h-3 text-red-500" />
          )}
          <span
            className={`font-semibold ${
              trend > 0 ? "text-green-500" : "text-red-500"
            }`}
          >
            {Math.abs(trend)}%
          </span>
          <span className={`${isDark ? "text-slate-400" : "text-slate-500"}`}>
            vs bulan lalu
          </span>
        </div>
      )}
    </motion.div>
  );

  return (
    <div
      className={`${isDark ? "bg-slate-900" : "bg-slate-50"} p-2 md:p-4 lg:p-6`}
    >
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-3 md:mb-5 lg:mb-6"
      >
        <h1
          className={`text-xl md:text-2xl lg:text-3xl font-bold mb-0.5 md:mb-1 ${
            isDark ? "text-white" : "text-slate-900"
          }`}
        >
          Dashboard Utama
        </h1>
        <p
          className={`text-xs md:text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}
        >
          Analisa data transaction, pengguna, dan service secara real-time
        </p>
      </motion.div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 gap-2 md:gap-3 lg:gap-4 mb-4 md:mb-6 lg:mb-8">
        <StatCard
          label="Total Transaction"
          value={totalTransactions}
          icon={ShoppingCart}
          trend={revenueGrowth}
          bgGradient={
            isDark
              ? "bg-gradient-to-br from-blue-900/30 to-blue-800/20"
              : "bg-gradient-to-br from-blue-50 to-blue-100/50"
          }
        />
        <StatCard
          label="Total Users"
          value={totalUsers}
          icon={Users}
          trend={8}
          bgGradient={
            isDark
              ? "bg-gradient-to-br from-green-900/30 to-green-800/20"
              : "bg-gradient-to-br from-green-50 to-green-100/50"
          }
        />
        <StatCard
          label="Total Services"
          value={totalServices}
          icon={ShoppingCart}
          trend={5}
          bgGradient={
            isDark
              ? "bg-gradient-to-br from-purple-900/30 to-purple-800/20"
              : "bg-gradient-to-br from-purple-50 to-purple-100/50"
          }
        />
        <StatCard
          label="Total Inventory"
          value={totalInventory}
          icon={Box}
          trend={3}
          bgGradient={
            isDark
              ? "bg-gradient-to-br from-amber-900/30 to-amber-800/20"
              : "bg-gradient-to-br from-amber-50 to-amber-100/50"
          }
        />
      </div>

      {/* Revenue & Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-5 mb-3 md:mb-5 lg:mb-6">
        {/* Revenue Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={`lg:col-span-1 rounded-lg md:rounded-xl p-3 md:p-4 lg:p-5 border ${
            isDark
              ? "bg-gradient-to-br from-slate-800 to-slate-800 border-slate-700 shadow-lg shadow-slate-900/50"
              : "bg-gradient-to-br from-slate-900 to-slate-800 border-slate-800 shadow-lg shadow-slate-900/10"
          }`}
        >
          <div className="mb-3 md:mb-4">
            <p className="text-slate-300 text-[10px] md:text-xs font-medium mb-0.5 md:mb-1">
              💰 Total Pendapatan
            </p>
            <p className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
              }).format(revenue)}
            </p>
          </div>

          <div className="space-y-2 md:space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-300 text-[10px] md:text-xs">
                  Pertumbuhan
                </span>
                <span className="text-green-400 font-semibold text-[10px] md:text-xs">
                  +{revenueGrowth}%
                </span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-1 md:h-1.5">
                <div
                  className="bg-gradient-to-r from-green-400 to-emerald-500 h-1 md:h-1.5 rounded-full"
                  style={{ width: `${Math.min(revenueGrowth, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-3 md:mt-4 pt-2.5 md:pt-3 border-t border-slate-700">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <TrendingUp className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="text-[10px] md:text-xs font-medium">
                Trending Naik
              </span>
            </div>
          </div>
        </motion.div>

        {/* Area Chart - Transaction Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`lg:col-span-2 rounded-lg md:rounded-xl p-3 md:p-4 lg:p-5 border ${
            isDark
              ? "bg-slate-800 border-slate-700 shadow-lg shadow-slate-900/50"
              : "bg-white border-slate-200 shadow-lg shadow-slate-900/5"
          }`}
        >
          <h3
            className={`text-sm md:text-base font-bold mb-2 md:mb-3 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            📈 Trend Transaction & Service
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSvc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="month"
                stroke={isDark ? "#94A3B8" : "#64748B"}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke={isDark ? "#94A3B8" : "#64748B"}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${isDark ? "#475569" : "#E2E8F0"}`,
                  borderRadius: "8px",
                  color: textColor,
                  fontSize: 11,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="transaction"
                stroke="#3B82F6"
                fillOpacity={1}
                fill="url(#colorTx)"
                name="Transaction"
              />
              <Area
                type="monotone"
                dataKey="service"
                stroke="#10B981"
                fillOpacity={1}
                fill="url(#colorSvc)"
                name="Service"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 lg:gap-5">
        {/* Transaction List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`rounded-lg md:rounded-xl p-3 md:p-4 lg:p-5 border ${
            isDark
              ? "bg-slate-800 border-slate-700 shadow-lg shadow-slate-900/50"
              : "bg-white border-slate-200 shadow-lg shadow-slate-900/5"
          }`}
        >
          <h3
            className={`text-sm md:text-base font-bold mb-2.5 md:mb-3 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            📋 Daftar Transaction Terbaru
          </h3>
          <div className="space-y-1.5 md:space-y-2 max-h-80 md:max-h-96 overflow-y-auto">
            {recentTransactions && recentTransactions.length > 0 ? (
              recentTransactions.slice(0, 10).map((tx: any, index: number) => (
                <motion.div
                  key={tx.id || index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`p-2 md:p-3 rounded-lg border ${
                    isDark
                      ? "bg-slate-700/50 border-slate-600 hover:border-slate-500"
                      : "bg-slate-50 border-slate-200 hover:border-slate-300"
                  } transition-all`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-semibold text-xs md:text-sm truncate ${
                          isDark ? "text-white" : "text-slate-900"
                        }`}
                      >
                        {tx.customer_name}
                      </p>
                      <p
                        className={`text-[9px] md:text-xs mt-0.5 ${
                          isDark ? "text-slate-400" : "text-slate-500"
                        }`}
                      >
                        {tx.jenis_layanan || tx.service_type}
                      </p>
                      <p
                        className={`text-[9px] md:text-xs mt-0.5 ${
                          isDark ? "text-slate-500" : "text-slate-400"
                        }`}
                      >
                        {new Date(tx.created_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className={`font-bold text-xs md:text-sm ${
                          isDark ? "text-emerald-400" : "text-emerald-600"
                        }`}
                      >
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          minimumFractionDigits: 0,
                        }).format(tx.nominal || 0)}
                      </p>
                      <span
                        className={`inline-block text-[8px] md:text-[10px] px-1 md:px-1.5 py-0.5 mt-0.5 rounded-full font-medium ${
                          tx.metode_pembayaran === "cash"
                            ? isDark
                              ? "bg-blue-900/30 text-blue-300"
                              : "bg-blue-100 text-blue-700"
                            : isDark
                              ? "bg-purple-900/30 text-purple-300"
                              : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {tx.metode_pembayaran || "N/A"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div
                className={`p-4 md:p-6 text-center ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                <p className="text-xs md:text-sm">Belum ada transaction</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Pie Chart - Data Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`rounded-lg md:rounded-xl p-3 md:p-4 lg:p-5 border ${
            isDark
              ? "bg-slate-800 border-slate-700 shadow-lg shadow-slate-900/50"
              : "bg-white border-slate-200 shadow-lg shadow-slate-900/5"
          }`}
        >
          <h3
            className={`text-sm md:text-base font-bold mb-2.5 md:mb-3 ${
              isDark ? "text-white" : "text-slate-900"
            }`}
          >
            🥧 Distribusi Data
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS.light[index % COLORS.light.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: `1px solid ${isDark ? "#475569" : "#E2E8F0"}`,
                  borderRadius: "8px",
                  color: textColor,
                  fontSize: 11,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
