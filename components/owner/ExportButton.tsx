'use client'

import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Printer, X, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'

// Dynamic imports untuk menghindari SSR issues
const dynamicImport = async () => {
  const XLSX = await import('xlsx')
  const jsPDF = (await import('jspdf')).default
  const autoTable = (await import('jspdf-autotable')).default
  return { XLSX, jsPDF, autoTable }
}

interface ExportButtonProps {
  data: any
  dateRange: { start: Date; end: Date }
}

export default function ExportButton({ data, dateRange }: ExportButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [exporting, setExporting] = useState(false)

  const formatCurrency = (value: number) => {
    return `Rp ${(value || 0).toLocaleString('id-ID')}`
  }

  const exportToExcel = async () => {
    setExporting(true)
    try {
      const { XLSX } = await dynamicImport()
      const workbook = XLSX.utils.book_new()

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
      ]

      const financialSheet = XLSX.utils.aoa_to_sheet(financialData)
      financialSheet['!cols'] = [{ wch: 25 }, { wch: 30 }]
      XLSX.utils.book_append_sheet(workbook, financialSheet, 'Financial Summary')

      // Technician Performance Sheet
      if (data?.technicianPerformance && data.technicianPerformance.length > 0) {
        const techData = [
          ['TECHNICIAN PERFORMANCE'],
          [],
          ['Technician Name', 'Services Completed', 'Revenue Generated']
        ]

        data.technicianPerformance.forEach((tech: any) => {
          techData.push([tech.name || 'Unknown', tech.completed || 0, formatCurrency(tech.revenue || 0)])
        })

        const techSheet = XLSX.utils.aoa_to_sheet(techData)
        techSheet['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 25 }]
        XLSX.utils.book_append_sheet(workbook, techSheet, 'Technician Performance')
      }

      const fileName = `owner_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`
      XLSX.writeFile(workbook, fileName)

    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Gagal mengekspor file Excel.')
    } finally {
      setExporting(false)
      setShowMenu(false)
    }
  }

  const exportToPDF = async () => {
    setExporting(true)
    try {
      const { jsPDF, autoTable } = await dynamicImport()
      const doc = new jsPDF()
      const pageWidth = doc.internal.pageSize.getWidth()

      // Header
      doc.setFontSize(20)
      doc.setFont('helvetica', 'bold')
      doc.text('OWNER DASHBOARD REPORT', pageWidth / 2, 20, { align: 'center' })

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(
        `Period: ${format(dateRange.start, 'dd MMMM yyyy', { locale: id })} - ${format(dateRange.end, 'dd MMMM yyyy', { locale: id })}`,
        pageWidth / 2,
        28,
        { align: 'center' }
      )
      doc.text(`Generated: ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: id })}`, pageWidth / 2, 34, { align: 'center' })

      // Financial Summary
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('FINANCIAL SUMMARY', 14, 50)

      const financialData = [
        ['Metric', 'Amount'],
        ['Total Revenue', formatCurrency(data?.revenue || 0)],
        ['Total Expenses', formatCurrency(data?.expenses || 0)],
        ['Net Profit', formatCurrency(data?.profit || 0)],
        ['Profit Margin', data?.revenue ? `${((data.profit / data.revenue) * 100).toFixed(2)}%` : '0%'],
      ]

      autoTable(doc, {
        startY: 55,
        head: [financialData[0]],
        body: financialData.slice(1),
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 4, font: 'helvetica' },
        headStyles: {
          fillColor: [26, 26, 46],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        bodyStyles: { lineWidth: 0.3, lineColor: [200, 200, 200] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      })

      // Service Statistics
      let finalY = (doc as any).lastAutoTable.finalY + 15

      if (finalY > 250) {
        doc.addPage()
        finalY = 20
      }

      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('SERVICE STATISTICS', 14, finalY)

      const serviceData = [
        ['Metric', 'Value'],
        ['Completed Services', (data?.completedServices || 0).toString()],
        ['Total Services', (data?.totalServices || 0).toString()],
        ['Completion Rate', data?.totalServices ? `${((data.completedServices / data.totalServices) * 100).toFixed(2)}%` : '0%'],
        ['Active Technicians', (data?.activeTechnicians || 0).toString()],
        ['Average Completion Time', `${data?.averageCompletionTime?.toFixed(2) || 0} days`],
      ]

      autoTable(doc, {
        startY: finalY + 5,
        head: [serviceData[0]],
        body: serviceData.slice(1),
        theme: 'plain',
        styles: { fontSize: 10, cellPadding: 4, font: 'helvetica' },
        headStyles: {
          fillColor: [26, 26, 46],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          lineWidth: 0.5,
          lineColor: [0, 0, 0]
        },
        bodyStyles: { lineWidth: 0.3, lineColor: [200, 200, 200] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      })

      // Technician Performance
      if (data?.technicianPerformance && data.technicianPerformance.length > 0) {
        finalY = (doc as any).lastAutoTable.finalY + 15

        if (finalY > 250) {
          doc.addPage()
          finalY = 20
        }

        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('TECHNICIAN PERFORMANCE', 14, finalY)

        const techData = [
          ['Technician', 'Completed', 'Revenue'],
          ...data.technicianPerformance.map((tech: any) => [
            tech.name || 'Unknown',
            (tech.completed || 0).toString(),
            formatCurrency(tech.revenue || 0)
          ])
        ]

        autoTable(doc, {
          startY: finalY + 5,
          head: [techData[0]],
          body: techData.slice(1),
          theme: 'plain',
          styles: { fontSize: 9, cellPadding: 4, font: 'helvetica' },
          headStyles: {
            fillColor: [26, 26, 46],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            lineWidth: 0.5,
            lineColor: [0, 0, 0]
          },
          bodyStyles: { lineWidth: 0.3, lineColor: [200, 200, 200] },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 35 },
            2: { cellWidth: 55 }
          }
        })
      }

      doc.save(`owner_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`)

    } catch (error) {
      console.error('Error exporting to PDF:', error)
      alert('Gagal mengekspor file PDF.')
    } finally {
      setExporting(false)
      setShowMenu(false)
    }
  }

  const printReport = () => {
    setExporting(true)
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        alert('Mohon izinkan pop-up untuk mencetak laporan')
        setExporting(false)
        setShowMenu(false)
        return
      }

      const currentDate = format(new Date(), 'dd MMMM yyyy HH:mm:ss', { locale: id })
      const periodStart = format(dateRange.start, 'dd MMMM yyyy', { locale: id })
      const periodEnd = format(dateRange.end, 'dd MMMM yyyy', { locale: id })

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Owner Dashboard Report</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              padding: 30px;
              margin: 0;
              background: #f8fafc;
              color: #1e293b;
            }
            .report-container {
              max-width: 1000px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              border-radius: 12px;
              box-shadow: 0 4px 16px rgba(0,0,0,0.06);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #e2e8f0;
            }
            h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
              color: #1e293b;
            }
            h1 span { color: #2563eb; }
            .subtitle {
              font-size: 14px;
              color: #6C757D;
              margin-top: 4px;
            }
            .badge {
              display: inline-block;
              padding: 4px 12px;
              background: #2563eb;
              color: white;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
            }
            .section {
              margin-bottom: 24px;
              background: white;
              border: 1px solid #e2e8f0;
              border-radius: 10px;
              padding: 20px 24px;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 16px;
              font-weight: 700;
              margin-bottom: 16px;
              color: #1e293b;
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .section-title .icon { font-size: 20px; }
            table {
              width: 100%;
              border-collapse: collapse;
            }
            th {
              text-align: left;
              padding: 10px 12px;
              background: #F8F9FA;
              font-weight: 600;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #6C757D;
              border-bottom: 2px solid #e2e8f0;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #F1F3F5;
              font-size: 14px;
            }
            .metric-label { font-weight: 500; color: #1e293b; }
            .metric-value { font-weight: 600; }
            .metric-value.revenue { color: #2563eb; }
            .metric-value.profit { color: #2ECC71; }
            .metric-value.expense { color: #E74C3C; }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 2px solid #e2e8f0;
              font-size: 12px;
              color: #ADB5BD;
            }
            @media (max-width: 640px) {
              body { padding: 16px; }
              .report-container { padding: 20px; }
              .section { padding: 16px; }
              table { font-size: 13px; }
              th, td { padding: 8px 10px; }
              h1 { font-size: 22px; }
            }
            @media print {
              body { background: white; padding: 0; }
              .report-container { box-shadow: none; padding: 20px; }
              .section { break-inside: avoid; border-color: #ddd; }
            }
          </style>
        </head>
        <body>
          <div class="report-container">
            <div class="header">
              <h1>Watch<span>Service</span> Report</h1>
              <div class="subtitle">
                Period: <strong>${periodStart}</strong> — <strong>${periodEnd}</strong>
              </div>
              <div class="subtitle" style="font-size:12px;color:#ADB5BD;margin-top:4px;">
                Generated: ${currentDate}
              </div>
            </div>

            <!-- Financial Summary -->
            <div class="section">
              <div class="section-title">
                <span class="icon">💰</span> Financial Summary
              </div>
              <table>
                <thead><tr><th>Metric</th><th>Amount</th></tr></thead>
                <tbody>
                  <tr><td class="metric-label">Total Revenue</td><td class="metric-value revenue">${formatCurrency(data?.revenue || 0)}</td></tr>
                  <tr><td class="metric-label">Total Expenses</td><td class="metric-value expense">${formatCurrency(data?.expenses || 0)}</td></tr>
                  <tr><td class="metric-label">Net Profit</td><td class="metric-value profit">${formatCurrency(data?.profit || 0)}</td></tr>
                  <tr><td class="metric-label">Profit Margin</td><td class="metric-value">${data?.revenue ? ((data.profit / data.revenue) * 100).toFixed(2) : 0}%</td></tr>
                </tbody>
              </table>
            </div>

            <!-- Service Statistics -->
            <div class="section">
              <div class="section-title">
                <span class="icon">📊</span> Service Statistics
              </div>
              <table>
                <thead><tr><th>Metric</th><th>Value</th></tr></thead>
                <tbody>
                  <tr><td class="metric-label">Completed Services</td><td class="metric-value">${data?.completedServices || 0}</td></tr>
                  <tr><td class="metric-label">Total Services</td><td class="metric-value">${data?.totalServices || 0}</td></tr>
                  <tr><td class="metric-label">Completion Rate</td><td class="metric-value">${data?.totalServices ? ((data.completedServices / data.totalServices) * 100).toFixed(2) : 0}%</td></tr>
                  <tr><td class="metric-label">Active Technicians</td><td class="metric-value">${data?.activeTechnicians || 0}</td></tr>
                  <tr><td class="metric-label">Avg. Completion Time</td><td class="metric-value">${data?.averageCompletionTime?.toFixed(2) || 0} days</td></tr>
                </tbody>
              </table>
            </div>

            ${data?.technicianPerformance && data.technicianPerformance.length > 0 ? `
            <!-- Technician Performance -->
            <div class="section">
              <div class="section-title">
                <span class="icon">👨‍🔧</span> Technician Performance
              </div>
              <table>
                <thead><tr><th>Technician</th><th>Completed</th><th>Revenue</th></tr></thead>
                <tbody>
                  ${data.technicianPerformance.map((tech: any) => `
                    <tr>
                      <td class="metric-label">${tech.name || 'Unknown'}</td>
                      <td class="metric-value">${tech.completed || 0}</td>
                      <td class="metric-value revenue">${formatCurrency(tech.revenue || 0)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            ` : ''}

            <div class="footer">
              <p>This report is generated automatically by WatchService Management System</p>
              <p style="margin-top:4px;">© ${new Date().getFullYear()} — All Rights Reserved</p>
            </div>
          </div>
        </body>
        </html>
      `)

      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      printWindow.close()

    } catch (error) {
      console.error('Error printing report:', error)
      alert('Gagal mencetak laporan')
    } finally {
      setExporting(false)
      setShowMenu(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={exporting}
        className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 transition-all text-xs sm:text-sm font-medium disabled:opacity-50"
      >
        {exporting ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-white border-t-transparent" />
            <span className="hidden xs:inline">Exporting...</span>
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden xs:inline">Export</span>
            <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 opacity-70" />
          </>
        )}
      </button>

      {showMenu && !exporting && (
        <div className="absolute right-0 mt-2 w-48 sm:w-56 bg-white rounded-xl border border-slate-200 shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            <button
              onClick={exportToExcel}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-sm text-slate-900"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-900" />
              <span>Excel (.xlsx)</span>
            </button>
            <button
              onClick={exportToPDF}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-sm text-slate-900"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>PDF (.pdf)</span>
            </button>
            <button
              onClick={printReport}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-sm text-slate-900"
            >
              <Printer className="w-4 h-4 text-slate-900" />
              <span>Print</span>
            </button>
            <div className="border-t border-slate-200 my-1" />
            <button
              onClick={() => setShowMenu(false)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-sm text-slate-400"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
