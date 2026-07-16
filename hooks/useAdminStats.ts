"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface AdminStats {
  totalUsers: number;
  totalServices: number;
  totalInventory: number;
  totalTransactions: number;
  pendingServices: number;
  completedToday: number;
  revenue: number;
  totalExpenses: number;
  revenueGrowth: number;
  avgRating: number;
}

interface TodayStats {
  transactions: number;
  revenue: number;
  expenses: number;
}

interface ChartDataPoint {
  month: string;
  transaction: number;
  service: number;
}

export function useAdminStats() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, totalServices: 0, totalInventory: 0, totalTransactions: 0,
    pendingServices: 0, completedToday: 0, revenue: 0, totalExpenses: 0,
    revenueGrowth: 12.5, avgRating: 4.8,
  });
  const [todayStats, setTodayStats] = useState<TodayStats>({ transactions: 0, revenue: 0, expenses: 0 });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [recentServices, setRecentServices] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);

  const sumNominal = (rows: any[]) =>
    rows.reduce((s: number, item: any) => {
      let total = item.nominal || 0;
      if (item.layanan_items) {
        total += item.layanan_items.reduce((si: number, li: any) => si + (li.nominal || 0), 0);
      }
      return s + total;
    }, 0);

  const fetchTodayStats = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [txCount, txRev, txExp] = await Promise.all([
      supabase.from("layanan").select("*", { count: "exact", head: true })
        .gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59"),
      supabase.from("layanan").select("nominal, layanan_items(nominal)")
        .neq("status", "cancelled").neq("jenis_layanan", "pengeluaran")
        .gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59"),
      supabase.from("layanan").select("nominal, layanan_items(nominal)")
        .neq("status", "cancelled").eq("jenis_layanan", "pengeluaran")
        .gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59"),
    ]);
    setTodayStats({
      transactions: txCount.count || 0,
      revenue: sumNominal(txRev.data || []),
      expenses: sumNominal(txExp.data || []),
    });
  }, []);

  const fetchStats = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [users, services, invCount, invData, pending, completed, revenue, expenses, todayRev, todayExp] =
      await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("service_orders").select("*", { count: "exact", head: true }),
        supabase.from("inventory").select("*", { count: "exact", head: true }),
        supabase.from("inventory").select("store_stock, warehouse_stock"),
        supabase.from("service_orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("service_orders").select("*", { count: "exact", head: true }).eq("status", "completed").gte("completed_at", today),
        supabase.from("layanan").select("nominal").neq("status", "cancelled").neq("jenis_layanan", "pengeluaran"),
        supabase.from("layanan").select("nominal").neq("status", "cancelled").eq("jenis_layanan", "pengeluaran"),
        supabase.from("layanan").select("nominal, layanan_items(nominal)").neq("status", "cancelled")
          .neq("jenis_layanan", "pengeluaran").gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59"),
        supabase.from("layanan").select("nominal, layanan_items(nominal)").neq("status", "cancelled")
          .eq("jenis_layanan", "pengeluaran").gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59"),
      ]);

    const totalStock = (invData.data || []).reduce((s: number, i: any) => s + (i.store_stock || 0) + (i.warehouse_stock || 0), 0);
    setStats({
      totalUsers: users.count || 0, totalServices: services.count || 0, totalInventory: totalStock,
      totalTransactions: 0, pendingServices: pending.count || 0, completedToday: completed.count || 0,
      revenue: sumNominal(todayRev?.data || []), totalExpenses: sumNominal(todayExp?.data || []),
      revenueGrowth: 12.5, avgRating: 4.8,
    });
  }, []);

  const fetchRecentServices = useCallback(async () => {
    const { data } = await supabase.from("service_orders").select("*").order("created_at", { ascending: false }).limit(10);
    if (data) setRecentServices(data);
  }, []);

  const fetchRecentTransactions = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase.from("layanan").select("*")
      .gte("created_at", today + "T00:00:00").lte("created_at", today + "T23:59:59")
      .order("created_at", { ascending: false }).limit(15);
    if (data) setRecentTransactions(data);
  }, []);

  const generateChartData = useCallback(async () => {
    const today = new Date();
    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    const [txData, svcData] = await Promise.all([
      supabase.from("layanan").select("created_at, nominal, id").gte("created_at", sixMonthsAgo.toISOString()).eq("status", "active"),
      supabase.from("service_orders").select("created_at, id").gte("created_at", sixMonthsAgo.toISOString()),
    ]);
    const months: Record<string, ChartDataPoint> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = d.toLocaleDateString("id-ID", { month: "short" });
      months[key] = { month: key, transaction: 0, service: 0 };
    }
    txData.data?.forEach((tx: any) => {
      const key = new Date(tx.created_at).toLocaleDateString("id-ID", { month: "short" });
      if (months[key]) months[key].transaction += 1;
    });
    svcData.data?.forEach((svc: any) => {
      const key = new Date(svc.created_at).toLocaleDateString("id-ID", { month: "short" });
      if (months[key]) months[key].service += 1;
    });
    setChartData(Object.values(months));
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchStats(), fetchRecentServices(), fetchRecentTransactions(),
        fetchTodayStats(), generateChartData()]);
    } catch (err) {
      console.error("Error fetching admin stats:", err);
    } finally {
      setLoading(false);
    }
  }, [fetchStats, fetchRecentServices, fetchRecentTransactions, fetchTodayStats, generateChartData]);

  return { stats, todayStats, chartData, recentServices, recentTransactions, loading, fetchAll, setRecentServices };
}
