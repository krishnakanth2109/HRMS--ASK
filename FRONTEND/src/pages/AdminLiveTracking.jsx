import React, { useState, useEffect } from "react";
import api, { getEmployees,getIdleTimeForEmployeeByDate, getAttendanceByDateRange } from ".././api";
import {
    FaUserFriends,FaRegClock ,
    FaCircle,
    FaSyncAlt,
    FaDesktop,
    FaClock,
    FaChartPie,
    FaFilePdf,
    FaTimes,
    FaSearch
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement } from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement);

const AdminLiveTracking = () => {
    const [liveData, setLiveData] = useState([]);
    const [employeesMap, setEmployeesMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [refreshCountdown, setRefreshCountdown] = useState(10);

    // Modal State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);

    // Weekly Report State
    const [weeklyOffset, setWeeklyOffset] = useState(0);
    const [weeklyChartData, setWeeklyChartData] = useState(null);
    const [weeklyDataLoading, setWeeklyDataLoading] = useState(false);

    useEffect(() => {
        // Fetch all employees to map IDs to Names once when component loads
        const loadEmployees = async () => {
            try {
                const employees = await getEmployees();
                const map = {};
                employees.forEach(emp => {
                    // Employee ID mapping (handles formatting differences)
                    const empId = emp.employeeId || emp.empId || emp._id;
                    if (empId) map[empId] = emp.name;
                });
                setEmployeesMap(map);
            } catch (err) {
                console.error("Error loading employees mapping:", err);
            }
        };
        loadEmployees();
    }, []);

    const fetchLiveData = async () => {
        try {
            // Added cache-busting timestamp to guarantee fresh data
            const response = await api.get(`/api/idletime/live-status?t=${new Date().getTime()}`);
            const data = response.data || [];
            setLiveData(data);

            // Console log to verify heartbeat detection
            const myStatus = data.find(d => String(d.employeeId).includes("INT2607"));
            if (myStatus) {
                console.log(`[Heartbeat] Pulse from backend: Formatted Date=${new Date().toISOString()} Status=${myStatus.currentStatus} IdleSince=${myStatus.idleSince}`);
            }

            setError(null);
            setLastUpdated(new Date());
            setRefreshCountdown(10);
        } catch (err) {
            console.error("Error fetching live tracking data:", err);
            setError("Failed to fetch live tracking data");
        } finally {
            setLoading(false);
        }
    };

    // Main fetch interval (10 seconds)
    useEffect(() => {
        fetchLiveData();
        const interval = setInterval(() => {
            fetchLiveData();
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    // Countdown visual timer interval (1 second)
    useEffect(() => {
        const timer = setInterval(() => {
            setRefreshCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const getStatusInfo = (record) => {
        const lastPing = new Date(record.lastPing);
        const now = new Date();
        const minutesSincePing = (now - lastPing) / (1000 * 60);

        if (minutesSincePing > 3 || record.currentStatus === "OFFLINE") {
            return {
                text: "Offline",
                color: "text-red-500",
                bg: "bg-red-500/10",
                border: "border-red-500/20"
            };
        }

        if (record.currentStatus === "IDLE") {
            return {
                text: "Idle",
                color: "text-amber-500",
                bg: "bg-amber-500/10",
                border: "border-amber-500/20"
            };
        }

        return {
            text: "Working",
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20"
        };
    };

    const formatTime = (dateString) => {
        if (!dateString) return "N/A";
        return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDuration = (totalSeconds) => {
        if (!totalSeconds && totalSeconds !== 0) return "0h 0m 0s";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = Math.floor(totalSeconds % 60);
        return `${h}h ${m}m ${s}s`;
    };

    const getStatusSummaryCount = (status) => {
        return liveData.filter(record => {
            const info = getStatusInfo(record);
            return info.text.toUpperCase() === status.toUpperCase();
        }).length;
    };

    const [currentTime, setCurrentTime] = useState(new Date());

    // Effect to maintain a "Live" global clock for ticking calculations
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const calculateReportStats = (record, idleData, attData) => {
        const dateStr = String(record.date || "").trim();
        const employeeName = employeesMap[String(record.employeeId).trim()] || "Unknown Employee";

        // 1. Get Stored Idle Time from DB (Completed Sessions)
        const idleTimeline = idleData?.idleTimeline || [];
        const storedIdleSeconds = idleTimeline.reduce((total, span) => total + (span.idleDurationSeconds || 0), 0) || (idleData?.idleDurationSeconds || 0);

        // 2. Calculate "Currently Active" Idle Time (If Status is IDLE)
        let activeIdleExtra = 0;
        if (record.currentStatus === "IDLE" && record.idleSince) {
            const idleStart = new Date(record.idleSince);
            if (idleStart < currentTime) {
                // Calculate how long they have been idle in this CURRENT session
                activeIdleExtra = (currentTime - idleStart) / 1000;
            }
        }

        // Total Idle = Stored (Old) + Active (Ongoing)
        const totalIdleSeconds = storedIdleSeconds + activeIdleExtra;

        let workedSeconds = 0;
        let punchInTime = "N/A";

        if (attData && attData.punchIn) {
            try {
                const OFFICE_START_HOUR = 10;
                const OFFICE_END_HOUR = 18;

                const pIn = new Date(attData.punchIn);
                // Total elapsed time from Punch In to NOW (capped at office hours)
                const pOutRaw = attData.punchOut ? new Date(attData.punchOut) : currentTime;

                const officeStart = new Date(pIn);
                officeStart.setHours(OFFICE_START_HOUR, 0, 0, 0);
                const officeEnd = new Date(pIn);
                officeEnd.setHours(OFFICE_END_HOUR, 0, 0, 0);

                const effectiveStart = new Date(Math.max(pIn, officeStart));
                const effectiveEnd = new Date(Math.min(pOutRaw, officeEnd));

                punchInTime = pIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                if (effectiveStart < officeEnd && effectiveStart < effectiveEnd) {
                    const totalElapsedSecs = (effectiveEnd - effectiveStart) / 1000;

                    // CRITICAL SYNC: 
                    // Worked Time = (Total Elapsed from PunchIn) - (Total Idle Time)
                    workedSeconds = Math.max(0, totalElapsedSecs - totalIdleSeconds);
                }
            } catch (e) {
                console.error("Error calculating working time", e);
            }
        }

        return {
            idleSeconds: totalIdleSeconds,
            workedSeconds: workedSeconds,
            totalElapsedSeconds: (workedSeconds + totalIdleSeconds),
            idleTimeline: idleTimeline,
            punchIn: punchInTime,
            activeIdleExtra: activeIdleExtra,
            storedIdleSeconds: storedIdleSeconds
        };
    };

    // Keep base API data for live ticking
    const [rawReportData, setRawReportData] = useState({ idle: null, attendance: null });

    const fetchReportData = async (record) => {
        const empId = String(record.employeeId || "").trim();
        const dateStr = String(record.date || "").trim();
        const employeeName = employeesMap[empId] || "Unknown Employee";

        try {
            // Fetch both in parallel
            const [idleRes, attRes] = await Promise.all([
                getIdleTimeForEmployeeByDate(empId, dateStr),
                getAttendanceByDateRange(dateStr, dateStr)
            ]);

            // Find matching attendance
            const attData = attRes?.length > 0 ? attRes.find(a =>
                String(a.employeeId || "").trim() === empId ||
                String(a.employeeName || "").toLowerCase().includes(employeeName.toLowerCase())
            ) : null;

            // Store raw results
            setRawReportData({ idle: idleRes, attendance: attData });

            // Initial calculation
            const stats = calculateReportStats(record, idleRes, attData);
            setReportData(stats);

        } catch (err) {
            console.error("Error fetching report data:", err);
            // Fallback
            if (!reportData) {
                setReportData({
                    idleSeconds: 0,
                    workedSeconds: 0,
                    totalElapsedSeconds: 0,
                    idleTimeline: [],
                    punchIn: "N/A"
                });
            }
        } finally {
            setReportLoading(false);
        }
    };

    const fetchWeeklyData = async (empId, empName, offset) => {
        setWeeklyDataLoading(true);
        try {
            const end = new Date();
            end.setDate(end.getDate() - (offset * 7));
            const start = new Date(end);
            start.setDate(end.getDate() - 6);

            const startStr = start.toISOString().split('T')[0];
            const endStr = end.toISOString().split('T')[0];

            const [attRes, idleRes] = await Promise.all([
                getAttendanceByDateRange(startStr, endStr),
                api.get(`/api/idletime/employee/${empId}`)
            ]);

            const allIdle = idleRes.data || [];
            const chartLabels = [];
            const workedData = [];
            const idleData = [];

            let d = new Date(start);
            for (let i = 0; i < 7; i++) {
                const dStr = d.toISOString().split('T')[0];
                chartLabels.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));

                const dailyAtt = attRes?.length > 0 ? attRes.find(a =>
                    (String(a.employeeId || "").trim() === empId || String(a.employeeName || "").toLowerCase().includes(empName.toLowerCase())) && a.date === dStr
                ) : null;

                const dailyIdle = allIdle.find(item => item.date === dStr) || { idleTimeline: [], idleDurationSeconds: 0 };
                const dummyRecord = { date: dStr, employeeId: empId, currentStatus: "OFFLINE", idleSince: null };
                const stats = calculateReportStats(dummyRecord, dailyIdle, dailyAtt);

                workedData.push(parseFloat((stats.workedSeconds / 3600).toFixed(2)));
                idleData.push(parseFloat((stats.idleSeconds / 3600).toFixed(2)));

                d.setDate(d.getDate() + 1);
            }

            setWeeklyChartData({
                labels: chartLabels,
                datasets: [
                    {
                        label: 'Working Hours',
                        data: workedData,
                        borderColor: 'rgba(16, 185, 129, 1)',
                        backgroundColor: 'rgba(16, 185, 129, 0.2)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                    },
                    {
                        label: 'Idle Hours',
                        data: idleData,
                        borderColor: 'rgba(245, 158, 11, 1)',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointBackgroundColor: 'rgba(245, 158, 11, 1)',
                    }
                ]
            });
        } catch (err) {
            console.error("Error fetching weekly data:", err);
            setWeeklyChartData(null);
        } finally {
            setWeeklyDataLoading(false);
        }
    };

    useEffect(() => {
        if (selectedEmployee) {
            fetchWeeklyData(selectedEmployee.employeeId, selectedEmployee.name, weeklyOffset);
        }
    }, [weeklyOffset, selectedEmployee]);

    // "Live Ticker" Effect: Recalculate modal stats every second while modal is open
    useEffect(() => {
        if (selectedEmployee && !reportLoading && rawReportData.idle !== undefined) {
            // Find LATEST state from liveData periodically
            const latestRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim()) || selectedEmployee;
            const stats = calculateReportStats(latestRecord, rawReportData.idle, rawReportData.attendance);
            setReportData(stats);
        }
    }, [currentTime]); // Ticks every second

    const handleViewReport = (record) => {
        const empId = String(record.employeeId || "").trim();
        const latestRecord = liveData.find(r => String(r.employeeId).trim() === empId) || record;
        const employeeName = employeesMap[empId] || "Unknown Employee";

        setSelectedEmployee({ ...latestRecord, name: employeeName, statusInfo: getStatusInfo(latestRecord), employeeId: empId });
        setReportLoading(true);
        setReportData(null);
        setWeeklyOffset(0);
        setRawReportData({ idle: null, attendance: null });
        fetchReportData(latestRecord);
    };

    // Auto-sync status only if modal open
    useEffect(() => {
        if (selectedEmployee && !reportLoading) {
            const currentRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim());
            if (currentRecord) {
                // Keep selectedEmployee sync'd with latest status from liveData (IDLE/WORKING)
                const employeeName = employeesMap[String(currentRecord.employeeId).trim()] || selectedEmployee.name;
                setSelectedEmployee({ ...currentRecord, name: employeeName, statusInfo: getStatusInfo(currentRecord) });
                // We don't call fetchReportData here, the [currentTime] effect handles the tick
                // But we should refresh API data if liveData changed (maybe new finished session)
                fetchReportData(currentRecord);
            }
        }
    }, [liveData]);

    const closeReportModal = () => {
        setSelectedEmployee(null);
        setReportData(null);
    };

    const generatePdf = () => {
        if (!selectedEmployee || !reportData) return;

        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text(`Daily Activity Report`, 14, 22);

        doc.setFontSize(12);
        doc.text(`Date: ${selectedEmployee.date}`, 14, 30);
        doc.text(`Employee: ${selectedEmployee.name} (${selectedEmployee.employeeId})`, 14, 36);
        doc.text(`Current Status: ${selectedEmployee.statusInfo.text}`, 14, 42);

        // Summary Table
        autoTable(doc, {
            startY: 50,
            head: [['Metric', 'Value']],
            body: [
                ['Punch In Time', reportData.punchIn],
                ['Exact Working Time', formatDuration(reportData.workedSeconds)],
                ['Exact Idle Time', formatDuration(reportData.idleSeconds)],
                ['Total Tracked Time', formatDuration(reportData.totalElapsedSeconds)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181] },
            styles: { fontSize: 10 }
        });

        // Idle Timeline Table
        if (reportData.idleTimeline && reportData.idleTimeline.length > 0) {
            const tableData = reportData.idleTimeline.map(interval => [
                new Date(interval.idleStart).toLocaleTimeString(),
                new Date(interval.idleEnd).toLocaleTimeString(),
                formatDuration(interval.idleDurationSeconds)
            ]);

            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 10,
                head: [['Idle Start', 'Idle End', 'Duration']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [245, 158, 11] }
            });
        } else {
            doc.text("No idle sessions recorded for today.", 14, doc.lastAutoTable.finalY + 15);
        }

        doc.save(`Activity_Report_${selectedEmployee.employeeId}_${selectedEmployee.date}.pdf`);
    };

    return (
      <div className="p-6 min-h-screen text-slate-800">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
                    
                    Idle Time & Live Activity Tracking
                    </h1>
                    <p className="text-slate-400 mt-2 flex items-center gap-2">
                        Monitor real-time desktop activity from employees
                    </p>
                </div>

                <button
                    onClick={() => {
                        setLoading(true);
                        fetchLiveData();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-indigo-500/30 rounded-lg transition-all"
                >
                    <FaSyncAlt className={loading ? "animate-spin" : ""} />
                    Auto-Refresh in {refreshCountdown}s
                </button>
            </div>

            {/* Summary Cards */}
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-gray-500 font-medium text-sm">Total Tracked</h3>
      <FaUserFriends className="text-gray-400 text-lg" />
    </div>
    <p className="text-3xl font-semibold text-gray-900">{liveData.length}</p>
  </div>
  
  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-gray-500 font-medium text-sm">Currently Working</h3>
      <FaCircle className="text-emerald-500 text-xs" />
    </div>
    <div className="flex items-center gap-2">
      <p className="text-3xl font-semibold text-gray-900">{getStatusSummaryCount("Working")}</p>
      <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 font-medium rounded-full">Active</span>
    </div>
  </div>
  
  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-gray-500 font-medium text-sm">Currently Idle</h3>
      <FaCircle className="text-amber-500 text-xs" />
    </div>
    <div className="flex items-center gap-2">
      <p className="text-3xl font-semibold text-gray-900">{getStatusSummaryCount("Idle")}</p>
      <span className="text-xs px-2 py-1 bg-amber-50 text-amber-700 font-medium rounded-full">Away</span>
    </div>
  </div>
  
  <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex justify-between items-center mb-2">
      <h3 className="text-gray-500 font-medium text-sm">Offline / Inactive</h3>
      <FaCircle className="text-red-500 text-xs" />
    </div>
    <div className="flex items-center gap-2">
      <p className="text-3xl font-semibold text-gray-900">{getStatusSummaryCount("Offline")}</p>
      <span className="text-xs px-2 py-1 bg-red-50 text-red-700 font-medium rounded-full">Inactive</span>
    </div>
  </div>
</div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-xl mb-6">
                    {error}
                </div>
            )}

            {/* Data Grid */}
  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-md">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                                <th className="p-4 font-semibold w-1/4">Employee</th>
                                <th className="p-4 font-semibold w-1/4">Status</th>
                                <th className="p-4 font-semibold w-1/6">Date</th>
                                <th className="p-4 font-semibold w-1/6">Last Heartbeat</th>
                                <th className="p-4 font-semibold w-1/6 text-center">Actions</th>
                            </tr>
                        </thead>
                     <tbody className="divide-y divide-gray-100">
  {loading && liveData.length === 0 ? (
    <tr>
      <td colSpan="5" className="text-center py-12">
        <div className="flex flex-col items-center justify-center text-gray-400">
          <FaSyncAlt className="animate-spin text-2xl mb-3 text-indigo-500" />
          <span className="text-sm font-medium">Loading data...</span>
        </div>
      </td>
    </tr>
  ) : liveData.length === 0 ? (
    <tr>
      <td colSpan="5" className="text-center py-12">
        <div className="flex flex-col items-center justify-center text-gray-400">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <FaRegClock className="text-xl text-gray-400" />
          </div>
          <span className="text-sm font-medium text-gray-500 mb-1">No data available</span>
          <span className="text-xs text-gray-400">No live tracking data available for today yet. Make sure desktop trackers are running.</span>
        </div>
      </td>
    </tr>
  ) : (
    liveData.map((record) => {
      const statusInfo = getStatusInfo(record);
      const employeeName = employeesMap[record.employeeId] || "Unknown";
      return (
        <tr key={record._id} className="group hover:bg-gray-50/80 transition-colors">
          <td className="px-4 py-3">
            <div className="flex flex-col">
              <span className="font-medium text-gray-900">{employeeName}</span>
              <span className="text-xs text-gray-400 font-mono">{record.employeeId}</span>
            </div>
          </td>
          <td className="px-4 py-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${statusInfo.bg} ${statusInfo.color} border ${statusInfo.border}`}>
              <FaCircle className="text-[8px]" />
              {statusInfo.text}
            </span>
          </td>
          <td className="px-4 py-3">
            <span className="text-sm text-gray-500">{record.date}</span>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FaClock className="text-gray-400 text-xs" />
              {formatTime(record.lastPing)}
            </div>
          </td>
          <td className="px-4 py-3 text-right">
  <button
  onClick={() => handleViewReport(record)}
  className="
             px-4 py-2 
             bg-white 
             text-indigo-600 
             border border-indigo-200 
             rounded-lg 
             text-sm font-semibold 
             flex items-center gap-2 ml-auto
             shadow-sm 
             transition-all duration-200 
             hover:bg-indigo-50 
             hover:border-indigo-300 
             hover:shadow-md 
             hover:-translate-y-0.5"
>
  <FaSearch className="text-indigo-500 text-sm" />
  Details
</button>
          </td>
        </tr>
      );
    })
  )}
</tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Details & Report */}
            {selectedEmployee && (
<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30">
                    <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col">

                        {/* Modal Header */}
                        <div className="sticky top-0 bg-slate-800/95 backdrop-blur border-b border-slate-700 p-6 flex justify-between items-start z-10">
                            <div>
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-3">
                                    <FaChartPie className="text-indigo-400 shrink-0" />
                                    Employee Activity Report
                                </h2>
                                <p className="text-slate-400 mt-1">
                                    {selectedEmployee.name} <span className="text-xs ml-2 px-2 py-0.5 bg-slate-700 rounded-full text-slate-300">{selectedEmployee.employeeId}</span>
                                </p>
                            </div>
                            <button onClick={closeReportModal} className="text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 p-2 rounded-full transition-all">
                                <FaTimes />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            {reportLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                    <FaSyncAlt className="animate-spin text-4xl mb-4 text-indigo-500" />
                                    <p>Loading analytics from database...</p>
                                </div>
                            ) : (
                                reportData && (
                                    <>
                                        {/* Quick Analytics Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                            <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-5 flex flex-col">
                                                <span className="text-emerald-400/80 text-sm font-medium mb-1 uppercase tracking-wider">Exact Working Time</span>
                                                <span className="text-3xl font-bold text-emerald-400">{formatDuration(reportData.workedSeconds)}</span>
                                            </div>
                                            <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-5 flex flex-col">
                                                <span className="text-amber-400/80 text-sm font-medium mb-1 uppercase tracking-wider">Exact Idle Time</span>
                                                <span className="text-3xl font-bold text-amber-400">{formatDuration(reportData.idleSeconds)}</span>
                                            </div>
                                            <div className="bg-slate-700/30 border border-slate-600 rounded-xl p-5 flex flex-col items-center justify-center">
                                                <button
                                                    onClick={generatePdf}
                                                    className="w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-bold shadow-lg transition-all gap-2"
                                                >
                                                    <FaFilePdf /> Download PDF
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
                                            {/* Chart View */}
                                            <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
                                                <h3 className="text-lg font-bold text-slate-300 mb-4 self-start">Activity Ratio (Today)</h3>
                                                <div className="w-48 h-48">
                                                    {reportData.workedSeconds === 0 && reportData.idleSeconds === 0 ? (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-full">No Data</div>
                                                    ) : (
                                                        <Doughnut
                                                            data={{
                                                                labels: ['Working', 'Idle'],
                                                                datasets: [{
                                                                    data: [reportData.workedSeconds, reportData.idleSeconds],
                                                                    backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(245, 158, 11, 0.8)'],
                                                                    borderColor: ['rgba(16, 185, 129, 1)', 'rgba(245, 158, 11, 1)'],
                                                                    borderWidth: 1,
                                                                    cutout: '70%'
                                                                }]
                                                            }}
                                                            options={{
                                                                plugins: {
                                                                    legend: { position: 'bottom', labels: { color: '#cbd5e1' } }
                                                                },
                                                                maintainAspectRatio: false
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {/* Timeline Table */}
                                            <div className="bg-slate-900/50 rounded-xl border border-slate-700 flex flex-col overflow-hidden max-h-72">
                                                <h3 className="text-lg font-bold text-slate-300 p-4 border-b border-slate-700 sticky top-0 bg-slate-900">Idle Intervals log</h3>
                                                <div className="overflow-y-auto">
                                                    {reportData.idleTimeline && reportData.idleTimeline.length > 0 ? (
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="bg-white sticky top-0">
                                                                <tr>
                                                                    <th className="px-4 py-2 text-slate-400 font-medium">Idle Start</th>
                                                                    <th className="px-4 py-2 text-slate-400 font-medium">Idle End</th>
                                                                    <th className="px-4 py-2 text-slate-400 font-medium">Duration</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {reportData.idleTimeline.map((item, idx) => (
                                                                    <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800">
                                                                        <td className="px-4 py-2">{new Date(item.idleStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                                        <td className="px-4 py-2">{new Date(item.idleEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                                        <td className="px-4 py-2 text-amber-500 font-mono">{formatDuration(item.idleDurationSeconds)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    ) : (
                                                        <div className="p-8 text-center text-slate-500">
                                                            <FaClock className="text-4xl mx-auto mb-2 opacity-20" />
                                                            No idle sessions recorded for this user today yet.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Weekly Chart View */}
                                        <div className="bg-slate-900/50 p-6 rounded-xl border border-slate-700 flex flex-col mt-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-bold text-slate-300">Weekly Summary (Past 7 Days)</h3>
                                                <select
                                                    className="bg-slate-800 text-slate-300 border border-slate-600 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 text-sm"
                                                    value={weeklyOffset}
                                                    onChange={(e) => setWeeklyOffset(Number(e.target.value))}
                                                >
                                                    <option value={0}>Current Week</option>
                                                    <option value={1}>1 Week Ago</option>
                                                    <option value={2}>2 Weeks Ago</option>
                                                    <option value={3}>3 Weeks Ago</option>
                                                    <option value={4}>4 Weeks Ago</option>
                                                </select>
                                            </div>

                                            <div className="w-full h-64 relative">
                                                {weeklyDataLoading ? (
                                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-2">
                                                        <FaSyncAlt className="animate-spin text-xl" /> Fetching history...
                                                    </div>
                                                ) : weeklyChartData ? (
                                                    <Line
                                                        data={weeklyChartData}
                                                        options={{
                                                            responsive: true,
                                                            maintainAspectRatio: false,
                                                            plugins: {
                                                                legend: { labels: { color: '#cbd5e1' } },
                                                                tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} hrs` } }
                                                            },
                                                            scales: {
                                                                x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(51, 65, 85, 0.5)' } },
                                                                y: {
                                                                    beginAtZero: true,
                                                                    ticks: { color: '#94a3b8' },
                                                                    grid: { color: 'rgba(51, 65, 85, 0.5)' },
                                                                    title: { display: true, text: 'Hours', color: '#64748b' }
                                                                }
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                                        Data could not be loaded
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLiveTracking;
