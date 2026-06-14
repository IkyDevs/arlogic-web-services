'use client';

import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Area, ComposedChart
} from 'recharts';
import { TrendingUp, Calendar, DollarSign, PieChart } from 'lucide-react';

interface RevenueChartProps {
  data: any;
  dateRange: { start: Date; end: Date };
  comparePeriod: 'month' | 'year';
}

export default function RevenueChart({ data, dateRange, comparePeriod }: RevenueChartProps) {
  const [chartType, setChartType] = useState<'revenue' | 'profit' | 'comparison'>('revenue');
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    generateChartData();
  }, [dateRange, comparePeriod, chartType]);

  const generateChartData = () => {
    // Mock data for charts - In real implementation, fetch from database
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = new Date().getFullYear();
    const lastYear = currentYear - 1;

    if (chartType === 'revenue') {
      const revenueData = months.map((month, index) => ({
        month,
        revenue: Math.floor(Math.random() * 50000000) + 20000000,
        expenses: Math.floor(Math.random() * 30000000) + 10000000,
      }));
      setChartData(revenueData);
    } else if (chartType === 'profit') {
      const profitData = months.map((month, index) => ({
        month,
        profit: Math.floor(Math.random() * 20000000) + 5000000,
        margin: Math.floor(Math.random() * 40) + 20,
      }));
      setChartData(profitData);
    } else {
      const comparisonData = months.map((month, index) => ({
        month,
        [currentYear]: Math.floor(Math.random() * 50000000) + 20000000,
        [lastYear]: Math.floor(Math.random() * 40000000) + 15000000,
      }));
      setChartData(comparisonData);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-4">
          <p className="font-mono font-bold mb-2">{label}</p>
          {payload.map((p: any, index: number) => (
            <p key={index} className="font-mono text-sm" style={{ color: p.color }}>
              {p.name}: Rp {p.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const ProfitTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-4">
          <p className="font-mono font-bold mb-2">{label}</p>
          <p className="font-mono text-sm text-green-600">
            Profit: Rp {payload[0]?.value.toLocaleString()}
          </p>
          <p className="font-mono text-sm text-blue-600">
            Margin: {payload[1]?.value}%
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <DollarSign size={24} className="bg-[#FF6B9D] p-1 rounded border-2 border-black" />
          <h2 className="text-2xl font-black font-mono">Revenue Analytics</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setChartType('revenue')}
            className={`px-3 py-1 border-2 border-black font-mono font-bold transition-all ${
              chartType === 'revenue'
                ? 'bg-[#FF6B9D] text-white shadow-[4px_4px_0_0_#000]'
                : 'bg-white hover:shadow-[4px_4px_0_0_#000]'
            }`}
          >
            Revenue
          </button>
          <button
            onClick={() => setChartType('profit')}
            className={`px-3 py-1 border-2 border-black font-mono font-bold transition-all ${
              chartType === 'profit'
                ? 'bg-[#FF6B9D] text-white shadow-[4px_4px_0_0_#000]'
                : 'bg-white hover:shadow-[4px_4px_0_0_#000]'
            }`}
          >
            Profit
          </button>
          <button
            onClick={() => setChartType('comparison')}
            className={`px-3 py-1 border-2 border-black font-mono font-bold transition-all ${
              chartType === 'comparison'
                ? 'bg-[#FF6B9D] text-white shadow-[4px_4px_0_0_#000]'
                : 'bg-white hover:shadow-[4px_4px_0_0_#000]'
            }`}
          >
            YoY Comparison
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        {chartType === 'revenue' && (
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#000" strokeWidth={1} />
            <XAxis dataKey="month" stroke="#000" fontSize={12} fontWeight="bold" />
            <YAxis stroke="#000" fontSize={12} fontWeight="bold" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="revenue" fill="#FF6B9D" stroke="#000" strokeWidth={2} />
            <Area type="monotone" dataKey="expenses" fill="#FFDE00" stroke="#000" strokeWidth={2} />
          </ComposedChart>
        )}

        {chartType === 'profit' && (
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#000" strokeWidth={1} />
            <XAxis dataKey="month" stroke="#000" fontSize={12} fontWeight="bold" />
            <YAxis yAxisId="left" stroke="#000" fontSize={12} fontWeight="bold" />
            <YAxis yAxisId="right" orientation="right" stroke="#3B82F6" fontSize={12} fontWeight="bold" />
            <Tooltip content={<ProfitTooltip />} />
            <Legend />
            <Bar yAxisId="left" dataKey="profit" fill="#3B82F6" stroke="#000" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="margin" stroke="#FFDE00" strokeWidth={3} dot={{ stroke: '#000', strokeWidth: 2 }} />
          </ComposedChart>
        )}

        {chartType === 'comparison' && (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#000" strokeWidth={1} />
            <XAxis dataKey="month" stroke="#000" fontSize={12} fontWeight="bold" />
            <YAxis stroke="#000" fontSize={12} fontWeight="bold" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey={new Date().getFullYear()} stroke="#FF6B9D" strokeWidth={3} dot={{ stroke: '#000', strokeWidth: 2 }} />
            <Line type="monotone" dataKey={new Date().getFullYear() - 1} stroke="#FFDE00" strokeWidth={3} dot={{ stroke: '#000', strokeWidth: 2 }} />
          </LineChart>
        )}
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-black">
        <div className="text-center">
          <p className="text-sm font-mono text-gray-600">Total Revenue</p>
          <p className="text-xl font-black font-mono text-[#FF6B9D]">
            Rp {(chartData.reduce((sum, item) => sum + (item.revenue || item.profit || 0), 0)).toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm font-mono text-gray-600">Average Monthly</p>
          <p className="text-xl font-black font-mono text-[#3B82F6]">
            Rp {Math.floor(chartData.reduce((sum, item) => sum + (item.revenue || item.profit || 0), 0) / (chartData.length || 1)).toLocaleString()}
          </p>
        </div>
        <div className="text-center">
          <p className="text-sm font-mono text-gray-600">Growth Rate</p>
          <p className="text-xl font-black font-mono text-green-600 flex items-center justify-center gap-1">
            <TrendingUp size={18} />
            23.5%
          </p>
        </div>
      </div>
    </div>
  );
}
