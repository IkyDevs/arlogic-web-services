'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Download, FileSpreadsheet, FileText, Calendar,
  Users, Package, ClipboardList, ChevronDown, X
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { id } from 'date-fns/locale';
import toast from 'react-hot-toast';

type ReportType = 'attendance' | 'inventory' | 'services';
type DateRangeType = 'today' | 'week' | 'month' | 'custom';

export default function ExportReports() {
  const supabase = createClient();
  const [reportType, setReportType] = useState<ReportType>('attendance');
  const [dateRange, setDateRange] = useState<DateRangeType>('month');
  const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEnd, setCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [exporting, setExporting] = useState(false);

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today': return { start: startOfDay(now), end: endOfDay(now) };
      case 'week': return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case 'month': return { start: startOfDay(subMonths(now, 1)), end: endOfDay(now) };
      case 'custom': return { start: startOfDay(new Date(customStart)), end: endOfDay(new Date(customEnd)) };
    }
  };

  const exportAttendanceExcel = async () => {
    const { start, end } = getDateRange();
    const { data: attendances } = await supabase
      .from('attendances')
      .select('*, profiles(full_name)')
      .gte('check_in', start.toISOString())
      .lte('check_in', end.toISOString())
      .order('check_in', { ascending: false });

    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const rows = [
      ['ATTENDANCE REPORT'],
      [`Period: ${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`],
      [`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['#', 'Name', 'Date', 'Check In', 'Check Out', 'Duration', 'Status'],
    ];

    attendances?.forEach((att, i) => {
      const checkIn = att.check_in ? new Date(att.check_in) : null;
      const checkOut = att.check_out ? new Date(att.check_out) : null;
      const duration = checkIn && checkOut
        ? `${Math.floor((checkOut.getTime() - checkIn.getTime()) / 3600000)}h ${Math.floor(((checkOut.getTime() - checkIn.getTime()) % 3600000) / 60000)}m`
        : '-';

      rows.push([
        (i + 1).toString(),
        (att as any).profiles?.full_name || 'Unknown',
        checkIn ? format(checkIn, 'dd/MM/yyyy') : '-',
        checkIn ? format(checkIn, 'HH:mm') : '-',
        checkOut ? format(checkOut, 'HH:mm') : '-',
        duration,
        att.check_out ? 'Complete' : 'Checked In'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    XLSX.writeFile(wb, `attendance_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast.success('Attendance report exported!');
  };

  const exportInventoryExcel = async () => {
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .order('item_name', { ascending: true });

    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const rows = [
      ['INVENTORY REPORT'],
      [`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['#', 'SKU', 'Item Name', 'Unit', 'Store Stock', 'Warehouse Stock', 'Total', 'Min Stock', 'Status'],
    ];

    inventory?.forEach((item, i) => {
      const total = item.store_stock + item.warehouse_stock;
      const status = total <= item.min_stock ? 'LOW STOCK' : total <= item.min_stock * 2 ? 'WARNING' : 'OK';
      rows.push([
        (i + 1).toString(),
        item.sku,
        item.item_name,
        item.unit,
        item.store_stock.toString(),
        item.warehouse_stock.toString(),
        total.toString(),
        item.min_stock.toString(),
        status,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 4 }, { wch: 15 }, { wch: 30 }, { wch: 8 },
      { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 10 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
    XLSX.writeFile(wb, `inventory_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast.success('Inventory report exported!');
  };

  const exportServicesExcel = async () => {
    const { start, end } = getDateRange();
    const { data: services } = await supabase
      .from('service_orders')
      .select('*, service_items(*)')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false });

    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();

    const rows = [
      ['SERVICE ORDERS REPORT'],
      [`Period: ${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`],
      [`Generated: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['#', 'Invoice', 'Customer', 'Phone', 'Watch Brand', 'Watch Model', 'Status', 'Revenue', 'Created At'],
    ];

    services?.forEach((svc, i) => {
      const revenue = (svc as any).service_items?.reduce((sum: number, item: any) =>
        sum + (Number(item.price) * (item.quantity || 1)), 0) || 0;

      rows.push([
        (i + 1).toString(),
        svc.invoice_number,
        svc.customer_name,
        svc.customer_phone,
        (svc as any).watch_brand || svc.device_brand || '-',
        (svc as any).watch_model || svc.device_model || '-',
        svc.status.toUpperCase(),
        `Rp ${revenue.toLocaleString('id-ID')}`,
        format(new Date(svc.created_at), 'dd/MM/yyyy HH:mm'),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 4 }, { wch: 22 }, { wch: 20 }, { wch: 15 },
      { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Services');
    XLSX.writeFile(wb, `services_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast.success('Services report exported!');
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      switch (reportType) {
        case 'attendance': await exportAttendanceExcel(); break;
        case 'inventory': await exportInventoryExcel(); break;
        case 'services': await exportServicesExcel(); break;
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setExporting(false);
    }
  };

  const reportOptions = [
    { type: 'attendance' as ReportType, label: 'ATTENDANCE REPORT', icon: Users, color: 'bg-[#4DB2FF]', desc: 'Staff check-in/out history' },
    { type: 'inventory' as ReportType, label: 'INVENTORY REPORT', icon: Package, color: 'bg-amber-500', textColor: 'text-black', desc: 'Current stock levels' },
    { type: 'services' as ReportType, label: 'SERVICES REPORT', icon: ClipboardList, color: 'bg-[#4DB2FF]', desc: 'Service orders history' },
  ];

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-amber-500 border border-slate-200 flex items-center justify-center shadow-sm">
          <Download className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-black font-mono">EXPORT REPORTS</h2>
          <p className="text-xs font-mono">Download data as Excel spreadsheet</p>
        </div>
      </div>

      {/* Report Type Selection */}
      <div className="mb-6">
        <label className="block text-xs font-black uppercase mb-3">Select Report Type</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {reportOptions.map(opt => (
            <button
              key={opt.type}
              onClick={() => setReportType(opt.type)}
              className={`p-4 border border-slate-200 text-left transition-all ${
                reportType === opt.type
                  ? 'shadow-sm translate-x-0 translate-y-0'
                  : 'hover:shadow-sm  '
              } ${reportType === opt.type ? opt.color : 'bg-white'}`}
            >
              <opt.icon className={`w-5 h-5 mb-2 ${reportType === opt.type && opt.type !== 'inventory' ? 'text-white' : ''}`} />
              <p className={`font-black text-xs ${reportType === opt.type && opt.type !== 'inventory' ? 'text-white' : ''}`}>
                {opt.label}
              </p>
              <p className={`text-[10px] font-mono mt-0.5 ${reportType === opt.type && opt.type !== 'inventory' ? 'text-white/80' : 'text-slate-500'}`}>
                {opt.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Date Range (not for inventory) */}
      {reportType !== 'inventory' && (
        <div className="mb-6">
          <label className="block text-xs font-black uppercase mb-3">Date Range</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['today', 'week', 'month', 'custom'] as DateRangeType[]).map(r => (
              <button
                key={r}
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 border border-slate-200 font-mono font-bold text-xs transition-all ${
                  dateRange === r ? 'bg-black text-white shadow-sm' : 'bg-white hover:bg-slate-100'
                }`}
              >
                {r === 'today' ? 'Today' : r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : 'Custom'}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono mb-1">Start Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 font-mono text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-mono mb-1">End Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 font-mono text-sm focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full flex items-center justify-center gap-3 py-4 bg-teal-600 text-white border border-slate-200 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            EXPORTING...
          </>
        ) : (
          <>
            <FileSpreadsheet className="w-5 h-5" />
            EXPORT TO EXCEL
          </>
        )}
      </button>

      <p className="text-center text-[10px] font-mono text-slate-400 mt-3">
        File will be downloaded automatically as .xlsx
      </p>
    </div>
  );
}
