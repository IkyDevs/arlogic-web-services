'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Legend
} from 'recharts';
import { Users, CheckCircle, Star, Target, Award } from 'lucide-react';

interface PerformanceChartProps {
  data: any[];
  totalServices: number;
}

export default function PerformanceChart({ data, totalServices }: PerformanceChartProps) {
  const [viewType, setViewType] = useState<'bar' | 'pie' | 'radar'>('bar');

  const completionRate = totalServices > 0
    ? (data.reduce((sum, t) => sum + t.completed, 0) / totalServices) * 100
    : 0;

  const topPerformer = data.sort((a, b) => b.completed - a.completed)[0];

  const pieData = data.map(tech => ({
    name: tech.name,
    value: tech.completed,
    revenue: tech.revenue
  }));

  const COLORS = ['#FF6B9D', '#FFDE00', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];

  const radarData = [
    { subject: 'Speed', A: 85, fullMark: 100 },
    { subject: 'Quality', A: 92, fullMark: 100 },
    { subject: 'Customer Satisfaction', A: 88, fullMark: 100 },
    { subject: 'Efficiency', A: 78, fullMark: 100 },
    { subject: 'Problem Solving', A: 95, fullMark: 100 },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-4">
          <p className="font-mono font-bold mb-2">{label}</p>
          <p className="font-mono text-sm text-[#FF6B9D]">
            Completed: {payload[0]?.value} services
          </p>
          {payload[0]?.payload.revenue && (
            <p className="font-mono text-sm text-[#3B82F6]">
              Revenue: Rp {payload[0]?.payload.revenue.toLocaleString()}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-4">
          <p className="font-mono font-bold">{payload[0].name}</p>
          <p className="font-mono text-sm">Services: {payload[0].value}</p>
          <p className="font-mono text-sm">Revenue: Rp {payload[0].payload.revenue.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white border-2 border-black shadow-[8px_8px_0_0_#000] p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Users size={24} className="bg-[#3B82F6] p-1 rounded border-2 border-black" />
          <h2 className="text-2xl font-black font-mono">Performance Metrics</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setViewType('bar')}
            className={`px-3 py-1 border-2 border-black font-mono font-bold transition-all ${
              viewType === 'bar'
                ? 'bg-[#3B82F6] text-white shadow-[4px_4px_0_0_#000]'
                : 'bg-white hover:shadow-[4px_4px_0_0_#000]'
            }`}
          >
            Bar
          </button>
          <button
            onClick={() => setViewType('pie')}
            className={`px-3 py-1 border-2 border-black font-mono font-bold transition-all ${
              viewType === 'pie'
                ? 'bg-[#3B82F6] text-white shadow-[4px_4px_0_0_#000]'
                : 'bg-white hover:shadow-[4px_4px_0_0_#000]'
            }`}
          >
            Pie
          </button>
          <button
            onClick={() => setViewType('radar')}
            className={`px-3 py-1 border-2 border-black font-mono font-bold transition-all ${
              viewType === 'radar'
                ? 'bg-[#3B82F6] text-white shadow-[4px_4px_0_0_#000]'
                : 'bg-white hover:shadow-[4px_4px_0_0_#000]'
            }`}
          >
            Radar
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        {viewType === 'bar' && (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#000" strokeWidth={1} />
            <XAxis dataKey="name" stroke="#000" fontSize={12} fontWeight="bold" />
            <YAxis stroke="#000" fontSize={12} fontWeight="bold" />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="completed" fill="#FF6B9D" stroke="#000" strokeWidth={2} radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}

        {viewType === 'pie' && (
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
              outerRadius={150}
              fill="#8884d8"
              dataKey="value"
              stroke="#000"
              strokeWidth={2}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        )}

        {viewType === 'radar' && (
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
            <PolarGrid stroke="#000" />
            <PolarAngleAxis dataKey="subject" stroke="#000" fontSize={12} fontWeight="bold" />
            <Radar name="Team Average" dataKey="A" stroke="#FF6B9D" fill="#FF6B9D" fillOpacity={0.3} strokeWidth={2} />
            <Tooltip />
            <Legend />
          </RadarChart>
        )}
      </ResponsiveContainer>

      {/* Performance Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t-2 border-black">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            <CheckCircle size={18} className="text-green-600" />
            <p className="text-sm font-mono font-bold">Completion Rate</p>
          </div>
          <p className="text-2xl font-black font-mono text-green-600">
            {completionRate.toFixed(1)}%
          </p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            <Star size={18} className="text-yellow-600" />
            <p className="text-sm font-mono font-bold">Top Performer</p>
          </div>
          <p className="text-lg font-black font-mono">
            {topPerformer?.name || 'N/A'}
          </p>
          <p className="text-xs font-mono text-gray-600">
            {topPerformer?.completed} services completed
          </p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-2">
            <Award size={18} className="text-blue-600" />
            <p className="text-sm font-mono font-bold">Avg Per Tech</p>
          </div>
          <p className="text-2xl font-black font-mono text-[#3B82F6]">
            {(totalServices / (data.length || 1)).toFixed(1)}
          </p>
          <p className="text-xs font-mono text-gray-600">services each</p>
        </div>
      </div>
    </div>
  );
}
