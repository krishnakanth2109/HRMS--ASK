import React, { useContext, useState, useMemo, useRef } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";

// The component only needs the LeaveRequestContext as all data logic is now handled there.
import { LeaveRequestContext } from "../context/LeaveRequestContext";

// --- Constants ---
const COLORS = { Approved: "#22c55e", Rejected: "#ef4444", Pending: "#f59e0b" };
const STATUS_FILTERS = ["All", "Pending", "Approved", "Rejected"];

// --- Helper UI Components for a Cleaner Structure ---
const StatCard = ({ title, value, colorClass }) => (
  <div className="bg-white p-6 rounded-lg shadow-md flex flex-col justify-center items-center text-center">
    <p className={`text-4xl font-bold ${colorClass}`}>{value}</p>
    <p className="text-sm font-medium text-gray-600 mt-2">{title}</p>
  </div>
);

// --- Main AdminLeaveSummary Component ---
const AdminLeaveSummary = () => {
  // 1. Get the "backend" function and global lists from the context.
  const { getLeaveSummary, allMonths, allDepartments } = useContext(LeaveRequestContext);

  // 2. Manage state ONLY for the UI filters.
  const [statusFilter, setStatusFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");

  // Logic to set the default selected month.
  // It calculates the current month in 'YYYY-MM' format.
  const currentMonthISO = new Date().toISOString().slice(0, 7);
  // It then checks if this month exists in the available data. If yes, it's the default.
  // If not (e.g., no leaves in the current month), it defaults to 'All' to show some data.
  const [selectedMonth, setSelectedMonth] = useState(
    allMonths.includes(currentMonthISO) ? currentMonthISO : "All"
  );
  
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef(null);

  // 3. Call the "backend" function with the current filters.
  // useMemo ensures this only re-runs when a filter changes.
  const { summaryStats, filteredRequests } = useMemo(() =>
    getLeaveSummary({ selectedMonth, departmentFilter, statusFilter }),
    [selectedMonth, departmentFilter, statusFilter, getLeaveSummary]
  );

  // 4. Derive chart data from the already processed summaryStats.
  const chartData = useMemo(() =>
    Object.entries(summaryStats)
      .filter(([key, value]) => key !== 'Total' && value > 0)
      .map(([name, value]) => ({ name, value })),
    [summaryStats]
  );

  // --- Export Functions ---
  const exportPDF = async () => {
    setIsExporting(true);
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      let tableStartY = 40;

      pdf.setFontSize(20).setFont(undefined, 'bold').text("Leave Summary Report", pdfWidth / 2, 20, { align: "center" });
      pdf.setFontSize(10).setFont(undefined, 'normal').text(`Generated on: ${new Date().toLocaleDateString()}`, pdfWidth / 2, 28, { align: "center" });

      if (chartRef.current && chartData.length > 0) {
        try {
          const canvas = await html2canvas(chartRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = 170;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          pdf.addImage(imgData, 'PNG', (pdfWidth - imgWidth) / 2, 40, imgWidth, imgHeight);
          tableStartY = 45 + imgHeight;
        } catch (chartError) {
          console.warn("Could not capture chart for PDF export. Proceeding with table only.", chartError);
        }
      }
      
      autoTable(pdf, {
        startY: tableStartY,
        head: [['ID', 'Employee Name', 'Department', 'From', 'To', 'Status']],
        body: filteredRequests.map(req => [req.id, req.employeeName, req.department, req.from, req.to, req.status]),
        theme: 'grid',
        headStyles: { fillColor: [41, 128, 185] },
      });

      pdf.save(`leave_summary_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("A critical error occurred during PDF generation:", err);
      alert("A critical error occurred while generating the PDF. Please check the console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  const exportCSV = () => {
    try {
      const headers = ["Request ID", "Employee Name", "Department", "From", "To", "Status", "Is Active"];
      const rows = filteredRequests.map(req =>
        [req.id, `"${req.employeeName}"`, `"${req.department}"`, req.from, req.to, req.status, req.isActive].join(",")
      );
      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `leave_summary_${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      console.error("CSV Export Failed:", err);
      alert("An error occurred while generating the CSV file.");
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Leave Summary Dashboard</h1>
            <p className="mt-1 text-gray-500">Aggregated leave statistics across the organization.</p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <button onClick={exportCSV} disabled={isExporting || filteredRequests.length === 0} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 shadow font-semibold transition disabled:bg-gray-400 disabled:cursor-not-allowed">Export CSV</button>
            <button onClick={exportPDF} disabled={isExporting || filteredRequests.length === 0} className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 shadow font-semibold transition disabled:bg-gray-400 disabled:cursor-not-allowed">
              {isExporting ? 'Generating PDF...' : 'Export PDF'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-white rounded-lg shadow-md">
          <div>
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-full p-2 mt-1 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
              {STATUS_FILTERS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Department</label>
            <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="w-full p-2 mt-1 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="All">All Departments</option>
              {allDepartments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Month</label>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-2 mt-1 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="All">All Time</option>
              {allMonths.map(month => <option key={month} value={month}>{new Date(`${month}-02`).toLocaleString('default', { month: 'long', year: 'numeric' })}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Requests" value={summaryStats.Total} colorClass="text-blue-600" />
            <StatCard title="Approved" value={summaryStats.Approved} colorClass="text-green-500" />
            <StatCard title="Rejected" value={summaryStats.Rejected} colorClass="text-red-500" />
            <StatCard title="Pending" value={summaryStats.Pending} colorClass="text-amber-500" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div ref={chartRef} className="lg:col-span-1 bg-white p-6 rounded-lg shadow-md">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">Status Distribution</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {chartData.map(entry => <Cell key={entry.name} fill={COLORS[entry.name]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="text-center py-20 text-gray-500">No data for selected filters.</div>}
            </div>

            <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md overflow-x-auto">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Leave Requests</h3>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-3 text-left font-semibold text-gray-600">Employee</th>
                    <th className="p-3 text-left font-semibold text-gray-600">Department</th>
                    <th className="p-3 text-left font-semibold text-gray-600">Dates</th>
                    <th className="p-3 text-left font-semibold text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map(req => (
                    <tr key={req.id} className={`border-t border-gray-200 ${!req.isActive ? "bg-gray-200 opacity-70" : "hover:bg-gray-50"}`}>
                      <td className="p-3 font-medium text-gray-800">{req.employeeName}{!req.isActive && <span className="ml-2 text-xs font-semibold text-red-700">(Inactive)</span>}</td>
                      <td className="p-3 text-gray-600">{req.department}</td>
                      <td className="p-3 text-gray-600">{`${req.from} to ${req.to}`}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          req.status === 'Approved' ? 'bg-green-100 text-green-800' :
                          req.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>{req.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredRequests.length === 0 && <div className="text-center py-10 text-gray-500">No requests match the current filters.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLeaveSummary;