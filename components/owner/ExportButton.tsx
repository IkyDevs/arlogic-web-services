'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// Dynamic imports untuk menghindari SSR issues
const dynamicImport = async () => {
  const XLSX = await import('xlsx');
  const jsPDF = (await import('jspdf')).default;
  const autoTable = (await import('jspdf-autotable')).default;
  return { XLSX, jsPDF, autoTable };
};

interface ExportButtonProps {
  data: any;
  dateRange: { start: Date; end: Date };
}

export default function ExportButton({ data, dateRange }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [exporting, setExporting] = useState(false);

  const formatCurrency = (value: number) => {
    return `Rp ${(value || 0).toLocaleString('id-ID')}`;
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      const { XLSX } = await dynamicImport();
      const workbook = XLSX.utils.book_new();

      // Financial Summary Sheet
      const financialData = [
        ['OWNER DASHBOARD REPORT'],
        [`Period: ${format(dateRange.start, 'dd MMMM yyyy', { locale: id })} - ${format(dateRange.end, 'dd MMMM yyyy', { locale: id })}`],
        [`Generated: ${format(new Date(), 'dd MMMM yyyy HH:mm:ss', { locale: id })}`],
        [],
        ['FINANCIAL SUMMARY'],
        ['Metric', 'Amount'],
        ['Total Revenue', formatCurrency(data?.revenue || 0)],
        ['Total Expenses', formatCurrency(data?.expenses || 0)],
        ['Net Profit', formatCurrency(data?.profit || 0)],
        ['Profit Margin', data?.revenue ? `${((data.profit / data.revenue) * 100).toFixed(2)}%` : '0%'],
        [],
        ['SERVICE STATISTICS'],
        ['Metric', 'Value'],
        ['Completed Services', data?.completedServices || 0],
        ['Total Services', data?.totalServices || 0],
        ['Completion Rate', data?.totalServices ? `${((data.completedServices / data.totalServices) * 100).toFixed(2)}%` : '0%'],
        ['Active Technicians', data?.activeTechnicians || 0],
        ['Average Completion Time', `${data?.averageCompletionTime?.toFixed(2) || 0} days`],
      ];

      const financialSheet = XLSX.utils.aoa_to_sheet(financialData);

      // Styling untuk sheet
      financialSheet['!cols'] = [{ wch: 20 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, financialSheet, 'Financial Summary');

      // Technician Performance Sheet
      if (data?.technicianPerformance && data.technicianPerformance.length > 0) {
        const techData = [
          ['TECHNICIAN PERFORMANCE REPORT'],
          [],
          ['Technician Name', 'Services Completed', 'Revenue Generated']
        ];

        data.technicianPerformance.forEach((tech: any) => {
          techData.push([tech.name || 'Unknown', tech.completed || 0, formatCurrency(tech.revenue || 0)]);
        });

        const techSheet = XLSX.utils.aoa_to_sheet(techData);
        techSheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(workbook, techSheet, 'Technician Performance');
      }

      // Save file
      const fileName = `owner_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Gagal mengekspor file Excel. Pastikan Anda telah menginstall library xlsx.');
    } finally {
      setExporting(false);
      setShowMenu(false);
    }
  };

  const exportToPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF, autoTable } = await dynamicImport();
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('OWNER DASHBOARD REPORT', pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Period: ${format(dateRange.start, 'dd MMMM yyyy', { locale: id })} - ${format(dateRange.end, 'dd MMMM yyyy', { locale: id })}`,
        pageWidth / 2,
        30,
        { align: 'center' }
      );
      doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, pageWidth / 2, 37, { align: 'center' });

      // Financial Summary
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('FINANCIAL SUMMARY', 14, 55);

      const financialData = [
        ['Metric', 'Amount'],
        ['Total Revenue', formatCurrency(data?.revenue || 0)],
        ['Total Expenses', formatCurrency(data?.expenses || 0)],
        ['Net Profit', formatCurrency(data?.profit || 0)],
        ['Profit Margin', data?.revenue ? `${((data.profit / data.revenue) * 100).toFixed(2)}%` : '0%'],
      ];

      autoTable(doc, {
        startY: 60,
        head: [financialData[0]],
        body: financialData.slice(1),
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: [255, 111, 157], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
        bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
        alternateRowStyles: { fillColor: [255, 222, 0] as [number, number, number] },
      });

      // Service Statistics
      let finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('SERVICE STATISTICS', 14, finalY);

      const serviceData = [
        ['Metric', 'Value'],
        ['Completed Services', (data?.completedServices || 0).toString()],
        ['Total Services', (data?.totalServices || 0).toString()],
        ['Completion Rate', data?.totalServices ? `${((data.completedServices / data.totalServices) * 100).toFixed(2)}%` : '0%'],
        ['Active Technicians', (data?.activeTechnicians || 0).toString()],
        ['Average Completion Time', `${data?.averageCompletionTime?.toFixed(2) || 0} days`],
      ];

      autoTable(doc, {
        startY: finalY + 5,
        head: [serviceData[0]],
        body: serviceData.slice(1),
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 3, font: 'helvetica' },
        headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
        bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
      });

      // Technician Performance
      if (data?.technicianPerformance && data.technicianPerformance.length > 0) {
        finalY = (doc as any).lastAutoTable.finalY + 20;

        // Check if need new page
        if (finalY > 250) {
          doc.addPage();
          finalY = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('TECHNICIAN PERFORMANCE', 14, finalY);

        const techData = [
          ['Technician Name', 'Services Completed', 'Revenue Generated'],
          ...data.technicianPerformance.map((tech: any) => [
            tech.name || 'Unknown',
            (tech.completed || 0).toString(),
            formatCurrency(tech.revenue || 0)
          ])
        ];

        autoTable(doc, {
          startY: finalY + 5,
          head: [techData[0]],
          body: techData.slice(1),
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 3, font: 'helvetica' },
          headStyles: { fillColor: [255, 222, 0], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.3, lineColor: [0, 0, 0] },
          bodyStyles: { lineWidth: 0.3, lineColor: [0, 0, 0] },
          alternateRowStyles: { fillColor: [255, 111, 157] as [number, number, number] },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 40 },
            2: { cellWidth: 50 }
          }
        });
      }

      // Save PDF
      const fileName = `owner_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Gagal mengekspor file PDF. Pastikan Anda telah menginstall library jspdf dan jspdf-autotable.');
    } finally {
      setExporting(false);
      setShowMenu(false);
    }
  };

  const printReport = () => {
    setExporting(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Mohon izinkan pop-up untuk mencetak laporan');
        setExporting(false);
        setShowMenu(false);
        return;
      }

      const currentDate = format(new Date(), 'dd MMMM yyyy HH:mm:ss', { locale: id });
      const periodStart = format(dateRange.start, 'dd MMMM yyyy', { locale: id });
      const periodEnd = format(dateRange.end, 'dd MMMM yyyy', { locale: id });

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Owner Dashboard Report</title>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', 'Monaco', monospace;
              padding: 40px;
              margin: 0;
              background: white;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 3px solid black;
              padding-bottom: 20px;
            }
            h1 {
              font-size: 28px;
              font-weight: bold;
              margin-bottom: 10px;
              letter-spacing: -1px;
            }
            .subtitle {
              font-size: 14px;
              margin-top: 5px;
              color: #333;
            }
            .section {
              margin-bottom: 30px;
              border: 2px solid black;
              padding: 20px;
              page-break-inside: avoid;
              background: white;
            }
            .section-title {
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 15px;
              background: #FF6B9D;
              display: inline-block;
              padding: 5px 15px;
              border: 2px solid black;
              letter-spacing: -0.5px;
            }
            .section-title.blue {
              background: #3B82F6;
              color: white;
            }
            .section-title.yellow {
              background: #FFDE00;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 15px;
            }
            th, td {
              border: 2px solid black;
              padding: 10px;
              text-align: left;
            }
            th {
              background: #FFDE00;
              font-weight: bold;
              font-size: 14px;
            }
            td {
              font-size: 13px;
            }
            .metric-label {
              font-weight: bold;
              background: #f5f5f5;
              width: 40%;
            }
            .metric-value {
              font-weight: normal;
            }
            .footer {
              text-align: center;
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid black;
              font-size: 11px;
              color: #666;
            }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              background: #FFDE00;
              border: 1px solid black;
              font-size: 11px;
              font-weight: bold;
            }
            @media print {
              body {
                padding: 20px;
              }
              .section {
                break-inside: avoid;
              }
              .no-break {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🏪 OWNER DASHBOARD REPORT</h1>
            <div class="subtitle">
              <span class="badge">Period: ${periodStart} - ${periodEnd}</span>
            </div>
            <div class="subtitle">Generated: ${currentDate}</div>
          </div>

          <div class="section no-break">
            <div class="section-title">💰 FINANCIAL SUMMARY</div>
            <table>
              <tr>
                <th>Metric</th>
                <th>Amount</th>
              </tr>
              <tr>
                <td class="metric-label">Total Revenue</td>
                <td class="metric-value">${formatCurrency(data?.revenue || 0)}</td>
              </tr>
              <tr>
                <td class="metric-label">Total Expenses</td>
                <td class="metric-value">${formatCurrency(data?.expenses || 0)}</td>
              </tr>
              <tr>
                <td class="metric-label">Net Profit</td>
                <td class="metric-value">${formatCurrency(data?.profit || 0)}</td>
              </tr>
              <tr>
                <td class="metric-label">Profit Margin</td>
                <td class="metric-value">${data?.revenue ? ((data.profit / data.revenue) * 100).toFixed(2) : 0}%</td>
              </tr>
            </table>
          </div>

          <div class="section no-break">
            <div class="section-title blue">📊 SERVICE STATISTICS</div>
            <table>
              <tr>
                <th>Metric</th>
                <th>Value</th>
              </tr>
              <tr>
                <td class="metric-label">Completed Services</td>
                <td class="metric-value">${data?.completedServices || 0}</td>
              </tr>
              <tr>
                <td class="metric-label">Total Services</td>
                <td class="metric-value">${data?.totalServices || 0}</td>
              </tr>
              <tr>
                <td class="metric-label">Completion Rate</td>
                <td class="metric-value">${data?.totalServices ? ((data.completedServices / data.totalServices) * 100).toFixed(2) : 0}%</td>
              </tr>
              <tr>
                <td class="metric-label">Active Technicians</td>
                <td class="metric-value">${data?.activeTechnicians || 0}</td>
              </tr>
              <tr>
                <td class="metric-label">Average Completion Time</td>
                <td class="metric-value">${data?.averageCompletionTime?.toFixed(2) || 0} days</td>
              </tr>
            </table>
          </div>

          ${data?.technicianPerformance && data.technicianPerformance.length > 0 ? `
          <div class="section no-break">
            <div class="section-title yellow">👨‍🔧 TECHNICIAN PERFORMANCE</div>
            <table>
              <thead>
                <tr>
                  <th>Technician Name</th>
                  <th>Services Completed</th>
                  <th>Revenue Generated</th>
                </tr>
              </thead>
              <tbody>
                ${data.technicianPerformance.map((tech: any) => `
                  <tr>
                    <td class="metric-label">${tech.name || 'Unknown'}</td>
                    <td class="metric-value">${tech.completed || 0}</td>
                    <td class="metric-value">${formatCurrency(tech.revenue || 0)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            <p>This report is generated automatically by Service Management System</p>
            <p>© ${new Date().getFullYear()} - All Rights Reserved</p>
          </div>
        </body>
        </html>
      `);

      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();

    } catch (error) {
      console.error('Error printing report:', error);
      alert('Gagal mencetak laporan');
    } finally {
      setExporting(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="flex items-center gap-2 px-4 py-2 bg-[#FFDE00] border-2 border-black shadow-[4px_4px_0_0_#000] hover:shadow-[2px_2px_0_0_#000] transition-all font-mono font-bold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Download size={18} />
            <span>Export Report</span>
          </>
        )}
      </button>

      {showMenu && !exporting && (
        <div className="absolute right-0 mt-2 w-64 bg-white border-2 border-black shadow-[8px_8px_0_0_#000] z-20">
          <div className="p-2">
            <button
              onClick={exportToExcel}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#FFDE00] transition-colors font-mono text-left"
            >
              <FileSpreadsheet size={18} />
              <span>Export to Excel</span>
            </button>
            <button
              onClick={exportToPDF}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#FFDE00] transition-colors font-mono text-left"
            >
              <FileText size={18} />
              <span>Export to PDF</span>
            </button>
            <button
              onClick={printReport}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#FFDE00] transition-colors font-mono text-left"
            >
              <Printer size={18} />
              <span>Print Report</span>
            </button>
            <hr className="my-2 border-black" />
            <button
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 transition-colors font-mono text-left text-gray-600"
            >
              <X size={18} />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
