import React, { useState, useEffect } from "react";
import api, { getEmployees, getIdleTimeForEmployeeByDate, getAttendanceByDateRange } from "../api";
import {
    FaUserFriends,
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
    const [refreshCountdown, setRefreshCountdown] = useState(3);

    // Modal State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [reportData, setReportData] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);

    // Weekly Report State
    const [weeklyOffset, setWeeklyOffset] = useState(0);
    const [weeklyChartData, setWeeklyChartData] = useState(null);
    const [weeklyDataLoading, setWeeklyDataLoading] = useState(false);

    useEffect(() => {
        const loadEmployees = async () => {
            try {
                const employees = await getEmployees();
                const map = {};
                employees.forEach(emp => {
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
            const response = await api.get(`/api/idletime/live-status?t=${new Date().getTime()}`);
            const data = response.data || [];
            setLiveData(data);
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

    useEffect(() => {
        fetchLiveData();
        const interval = setInterval(() => {
            fetchLiveData();
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setRefreshCountdown((prev) => (prev <= 1 ? 3 : prev - 1));
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
                color: "text-red-600",
                bg: "bg-red-50",
                border: "border-red-200"
            };
        }

        if (record.currentStatus === "IDLE") {
            return {
                text: "Idle",
                color: "text-amber-600",
                bg: "bg-amber-50",
                border: "border-amber-200"
            };
        }

        return {
            text: "Working",
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            border: "border-emerald-200"
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

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const calculateReportStats = (record, idleData, attData) => {
        const dateStr = String(record.date || "").trim();
        const idleTimeline = idleData?.idleTimeline || [];
        const storedIdleSeconds = idleTimeline.reduce((total, span) => total + (span.idleDurationSeconds || 0), 0) || (idleData?.idleDurationSeconds || 0);

        let activeIdleExtra = 0;
        if (record.currentStatus === "IDLE" && record.idleSince) {
            const idleStart = new Date(record.idleSince);
            if (idleStart < currentTime) {
                activeIdleExtra = (currentTime - idleStart) / 1000;
            }
        }

        const totalIdleSeconds = storedIdleSeconds + activeIdleExtra;
        let workedSeconds = 0;
        let punchInTime = "N/A";

        if (attData && attData.punchIn) {
            try {
                const OFFICE_START_HOUR = 10;
                const OFFICE_END_HOUR = 18;
                const pIn = new Date(attData.punchIn);
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

    const [rawReportData, setRawReportData] = useState({ idle: null, attendance: null });

    const fetchReportData = async (record) => {
        const empId = String(record.employeeId || "").trim();
        const dateStr = String(record.date || "").trim();
        const employeeName = employeesMap[empId] || "Loading...";

        try {
            const [idleRes, attRes] = await Promise.all([
                getIdleTimeForEmployeeByDate(empId, dateStr),
                getAttendanceByDateRange(dateStr, dateStr)
            ]);

            const attData = attRes?.length > 0 ? attRes.find(a =>
                String(a.employeeId || "").trim() === empId ||
                String(a.employeeName || "").toLowerCase().includes(employeeName.toLowerCase())
            ) : null;

            setRawReportData({ idle: idleRes, attendance: attData });
            const stats = calculateReportStats(record, idleRes, attData);
            setReportData(stats);
        } catch (err) {
            console.error("Error fetching report data:", err);
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
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
                    },
                    {
                        label: 'Idle Hours',
                        data: idleData,
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3,
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

    useEffect(() => {
        if (selectedEmployee && !reportLoading && rawReportData.idle !== undefined) {
            const latestRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim()) || selectedEmployee;
            const stats = calculateReportStats(latestRecord, rawReportData.idle, rawReportData.attendance);
            setReportData(stats);
        }
    }, [currentTime]);

    const handleViewReport = (record) => {
        const empId = String(record.employeeId || "").trim();
        const latestRecord = liveData.find(r => String(r.employeeId).trim() === empId) || record;
        const employeeName = employeesMap[empId] || "Loading...";

        setSelectedEmployee({ ...latestRecord, name: employeeName, statusInfo: getStatusInfo(latestRecord), employeeId: empId });
        setReportLoading(true);
        setReportData(null);
        setWeeklyOffset(0);
        setRawReportData({ idle: null, attendance: null });
        fetchReportData(latestRecord);
    };

    useEffect(() => {
        if (selectedEmployee && !reportLoading) {
            const currentRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim());
            if (currentRecord) {
                const employeeName = employeesMap[String(currentRecord.employeeId).trim()] || selectedEmployee.name;
                setSelectedEmployee({ ...currentRecord, name: employeeName, statusInfo: getStatusInfo(currentRecord) });
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
        doc.setFontSize(18);
        doc.text(`Daily Activity Report`, 14, 22);
        doc.setFontSize(12);
        doc.text(`Date: ${selectedEmployee.date}`, 14, 30);
        doc.text(`Employee: ${selectedEmployee.name} (${selectedEmployee.employeeId})`, 14, 36);
        doc.text(`Current Status: ${selectedEmployee.statusInfo.text}`, 14, 42);
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
            headStyles: { fillColor: [79, 70, 229] },
        });
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
        }
        doc.save(`Activity_Report_${selectedEmployee.employeeId}_${selectedEmployee.date}.pdf`);
    };

    return (
        <div className="p-6 bg-white min-h-screen text-slate-800">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3">
                        <FaDesktop className="hidden sm:block text-indigo-600" />
                        Live Status Tracker
                    </h1>
                    <p className="text-slate-500 mt-2 flex items-center gap-2">
                        Monitor real-time desktop activity from employees
                    </p>
                </div>

                <button
                    onClick={() => {
                        setLoading(true);
                        fetchLiveData();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-lg shadow-sm transition-all font-medium"
                >
                    <FaSyncAlt className={loading ? "animate-spin" : ""} />
                    Auto-Refresh in {refreshCountdown}s
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-slate-500 font-medium">Total Tracked</h3>
                        <FaUserFriends className="text-slate-400 text-xl" />
                    </div>
                    <p className="text-3xl font-bold text-slate-900">{liveData.length}</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-emerald-700 font-medium">Currently Working</h3>
                        <FaCircle className="text-emerald-500 text-sm" />
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">{getStatusSummaryCount("Working")}</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-5 border border-amber-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-amber-700 font-medium">Currently Idle</h3>
                        <FaCircle className="text-amber-500 text-sm" />
                    </div>
                    <p className="text-3xl font-bold text-amber-600">{getStatusSummaryCount("Idle")}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-5 border border-red-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="text-red-700 font-medium">Offline / Inactive</h3>
                        <FaCircle className="text-red-500 text-sm" />
                    </div>
                    <p className="text-3xl font-bold text-red-600">{getStatusSummaryCount("Offline")}</p>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6">
                    {error}
                </div>
            )}

            {/* Data Grid */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                                <th className="p-4 font-semibold w-1/4">Employee</th>
                                <th className="p-4 font-semibold w-1/4">Status</th>
                                <th className="p-4 font-semibold w-1/6">Date</th>
                                <th className="p-4 font-semibold w-1/6">Last Heartbeat</th>
                                <th className="p-4 font-semibold w-1/6 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && liveData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-8 text-slate-400">
                                        <FaSyncAlt className="animate-spin inline-block mr-2" /> Loading data...
                                    </td>
                                </tr>
                            ) : liveData.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center p-8 text-slate-400">
                                        No live tracking data available for today yet.
                                    </td>
                                </tr>
                            ) : (
                                liveData.map((record) => {
                                    const statusInfo = getStatusInfo(record);
                                    const employeeName = employeesMap[record.employeeId] || "Loading...";
                                    return (
                                        <tr key={record._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-900">{employeeName}</span>
                                                    <span className="text-xs text-slate-500 font-mono mt-0.5">{record.employeeId}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusInfo.bg} ${statusInfo.color} border ${statusInfo.border}`}>
                                                    <FaCircle className="text-[10px]" />
                                                    {statusInfo.text}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-600">
                                                {record.date}
                                            </td>
                                            <td className="p-4 text-slate-600 flex items-center gap-2 mt-2">
                                                <FaClock className="text-slate-400" />
                                                {formatTime(record.lastPing)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => handleViewReport(record)}
                                                    className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-sm transition-all flex items-center gap-2 mx-auto font-medium"
                                                >
                                                    <FaSearch /> Details
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

            {/* Modal */}
            {selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col">
                        
                        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 p-6 flex justify-between items-start z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                                    <FaChartPie className="text-indigo-600 shrink-0" />
                                    Employee Activity Report
                                </h2>
                                <p className="text-slate-500 mt-1">
                                    {selectedEmployee.name} <span className="text-xs ml-2 px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 font-mono">{selectedEmployee.employeeId}</span>
                                </p>
                            </div>
                            <button onClick={closeReportModal} className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-all">
                                <FaTimes />
                            </button>
                        </div>

                        <div className="p-6">
                            {reportLoading ? (
                                <div className="py-20 flex flex-col items-center justify-center text-slate-400">
                                    <FaSyncAlt className="animate-spin text-4xl mb-4 text-indigo-500" />
                                    <p>Loading analytics...</p>
                                </div>
                            ) : (
                                reportData && (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex flex-col">
                                                <span className="text-emerald-700 text-sm font-semibold mb-1 uppercase tracking-wider">Exact Working Time</span>
                                                <span className="text-3xl font-bold text-emerald-600">{formatDuration(reportData.workedSeconds)}</span>
                                            </div>
                                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-5 flex flex-col">
                                                <span className="text-amber-700 text-sm font-semibold mb-1 uppercase tracking-wider">Exact Idle Time</span>
                                                <span className="text-3xl font-bold text-amber-600">{formatDuration(reportData.idleSeconds)}</span>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col items-center justify-center">
                                                <button
                                                    onClick={generatePdf}
                                                    className="w-full flex items-center justify-center py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md transition-all gap-2"
                                                >
                                                    <FaFilePdf /> Download PDF
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-4">
                                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col items-center justify-center">
                                                <h3 className="text-lg font-bold text-slate-800 mb-4 self-start">Activity Ratio (Today)</h3>
                                                <div className="w-48 h-48">
                                                    {reportData.workedSeconds === 0 && reportData.idleSeconds === 0 ? (
                                                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-full">No Data</div>
                                                    ) : (
                                                        <Doughnut
                                                            data={{
                                                                labels: ['Working', 'Idle'],
                                                                datasets: [{
                                                                    data: [reportData.workedSeconds, reportData.idleSeconds],
                                                                    backgroundColor: ['#10b981', '#f59e0b'],
                                                                    borderWidth: 0,
                                                                    cutout: '70%'
                                                                }]
                                                            }}
                                                            options={{
                                                                plugins: {
                                                                    legend: { position: 'bottom', labels: { color: '#475569', font: { weight: '600' } } }
                                                                },
                                                                maintainAspectRatio: false
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-white rounded-xl border border-slate-200 flex flex-col overflow-hidden max-h-72 shadow-sm">
                                                <h3 className="text-lg font-bold text-slate-800 p-4 border-b border-slate-100 sticky top-0 bg-white">Idle Intervals Log</h3>
                                                <div className="overflow-y-auto">
                                                    {reportData.idleTimeline && reportData.idleTimeline.length > 0 ? (
                                                        <table className="w-full text-left text-sm">
                                                            <thead className="bg-slate-50 sticky top-0">
                                                                <tr>
                                                                    <th className="px-4 py-2 text-slate-600 font-semibold">Idle Start</th>
                                                                    <th className="px-4 py-2 text-slate-600 font-semibold">Idle End</th>
                                                                    <th className="px-4 py-2 text-slate-600 font-semibold">Duration</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {reportData.idleTimeline.map((item, idx) => (
                                                                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50">
                                                                        <td className="px-4 py-2 text-slate-700">{new Date(item.idleStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                                        <td className="px-4 py-2 text-slate-700">{new Date(item.idleEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                                                                        <td className="px-4 py-2 text-amber-600 font-mono font-bold">{formatDuration(item.idleDurationSeconds)}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    ) : (
                                                        <div className="p-8 text-center text-slate-400">
                                                            <FaClock className="text-4xl mx-auto mb-2 opacity-20" />
                                                            No idle sessions recorded yet.
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col mt-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-lg font-bold text-slate-800">Weekly Summary (Past 7 Days)</h3>
                                                <select
                                                    className="bg-white text-slate-700 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm"
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

                                            <div className="w-full h-64 relative bg-white p-4 rounded-lg border border-slate-100">
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
                                                                legend: { labels: { color: '#475569', font: { weight: '600' } } },
                                                                tooltip: { backgroundColor: '#1e293b' }
                                                            },
                                                            scales: {
                                                                x: { ticks: { color: '#64748b' }, grid: { display: false } },
                                                                y: {
                                                                    beginAtZero: true,
                                                                    ticks: { color: '#64748b' },
                                                                    grid: { color: '#f1f5f9' },
                                                                    title: { display: true, text: 'Hours', color: '#64748b' }
                                                                }
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 flex items-center justify-center text-slate-400">
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