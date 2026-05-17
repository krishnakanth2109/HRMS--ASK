import React, { useState, useEffect } from "react";
import api, { getEmployees, getIdleTimeForEmployeeByDate, getAttendanceByDateRange } from ".././api";
import {
    FaUserFriends, FaRegClock,
    FaCircle,
    FaSyncAlt,
    FaDesktop,
    FaClock,
    FaChartPie,
    FaFilePdf,
    FaTimes,
    FaSearch,
    FaCamera,
    FaExternalLinkAlt,
    FaCalendarAlt,
    FaTrash,
    FaChevronLeft,
    FaChevronRight
} from "react-icons/fa";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement } from "chart.js";
import { Doughnut, Pie, Line, Bar } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement);

const AdminLiveTracking = () => {
    const [liveData, setLiveData] = useState([]);
    const [employeesMap, setEmployeesMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [refreshCountdown, setRefreshCountdown] = useState(10);

    // Modal State
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [reportData, setReportData] = useState(null);
    const [yesterdayIdle, setYesterdayIdle] = useState(0);
    const [dailyChartData, setDailyChartData] = useState(null);
    const [reportLoading, setReportLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('report'); // 'report' | 'screenshots'

    // Weekly Report State
    const [weeklyOffset, setWeeklyOffset] = useState(0);
    const [weeklyChartData, setWeeklyChartData] = useState(null);
    const [weeklyDataLoading, setWeeklyDataLoading] = useState(false);
    const [weeklyTotals, setWeeklyTotals] = useState({ worked: 0, idle: 0 });

    // Screenshots State
    const [screenshots, setScreenshots] = useState([]);
    const [screenshotsLoading, setScreenshotsLoading] = useState(false);
    const [lightboxUrl, setLightboxUrl] = useState(null);

    // Tracker Settings
    const [screenshotInterval, setScreenshotInterval] = useState(1);
    const [savingSettings, setSavingSettings] = useState(false);

    useEffect(() => {
        // Fetch tracker settings
        const fetchSettings = async () => {
            try {
                const res = await api.get('/api/idletime/settings/tracker');
                if (res.data && res.data.screenshotIntervalMinutes) {
                    setScreenshotInterval(res.data.screenshotIntervalMinutes);
                }
            } catch (err) {
                console.error("Error fetching tracker settings:", err);
            }
        };
        fetchSettings();
    }, []);

    const handleSaveSettings = async (newInterval) => {
        try {
            setSavingSettings(true);
            const val = parseInt(newInterval, 10);
            if (val > 0) {
                await api.put('/api/idletime/settings/tracker', { screenshotIntervalMinutes: val });
                setScreenshotInterval(val);
                alert(`Tracker screenshot interval updated to ${val} minutes. It will take effect the next time employees' trackers sync.`);
            }
        } catch (err) {
            console.error("Error saving settings", err);
            alert("Failed to save tracker settings.");
        } finally {
            setSavingSettings(false);
        }
    };

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

    const fetchLiveData = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        try {
            // Added cache-busting timestamp to guarantee fresh data
            const response = await api.get(`/api/idletime/live-status?t=${new Date().getTime()}`);
            const data = response.data || [];
            setLiveData(data);
            setError(null);
            setLastUpdated(new Date());
            setRefreshCountdown(120);
        } catch (err) {
            console.error("Error fetching live tracking data:", err);
            if (!isBackground) setError("Failed to fetch live tracking data");
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    // Main fetch interval (10 seconds)
    useEffect(() => {
        fetchLiveData(false);
        const interval = setInterval(() => {
            fetchLiveData(true);
        }, 100000);
        return () => clearInterval(interval);
    }, []);

    // Countdown visual timer interval (1 second)
    // useEffect(() => {
    //     const timer = setInterval(() => {
    //         setRefreshCountdown((prev) => (prev <= 1 ? 120 : prev - 1));
    //     }, 120000);
    //     return () => clearInterval(timer);
    // }, []);

    // Countdown every second
    useEffect(() => {
        const timer = setInterval(() => {
            setRefreshCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    // Actual refresh every 2 mins
    useEffect(() => {
        const refreshTimer = setInterval(() => {
            fetchData();
        }, 120000);

        return () => clearInterval(refreshTimer);
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
        return new Date(dateString).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
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

        // 1. Get Stored Idle Time from Live DB (Synchronously connected)
        const rawTimeline = record.idleTimeline || [];
        const idleTimeline = rawTimeline.map(interval => {
            const start = new Date(interval.startTime || interval.idleStart);
            const end = new Date(interval.endTime || interval.idleEnd);
            const diffSeconds = (end - start) / 1000;
            return {
                idleStart: start,
                idleEnd: end,
                idleDurationSeconds: diffSeconds
            };
        }).sort((a, b) => a.idleStart - b.idleStart); // Sort in chronological order
        const storedIdleSeconds = idleTimeline.reduce((total, span) => total + (span.idleDurationSeconds || 0), 0);

        let totalIdleSeconds = 0;
        let workedSeconds = 0;
        let punchInTime = "N/A";
        let activeIdleExtra = 0;

        // Ensure we retrieve the punchIn time for the report display
        if (attData && attData.punchIn) {
            punchInTime = new Date(attData.punchIn).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }

        // 2. EXCLUSIVE TRACKER LOGIC
        // Only use the explicitly tracked times sent by the desktop tracker.
        if (record.trackedWorkSeconds !== undefined && record.trackedIdleSeconds !== undefined) {
            workedSeconds = record.trackedWorkSeconds;
            totalIdleSeconds = record.trackedIdleSeconds;

            // Add smooth ticking between backend refreshes (capped at 30s to match heartbeat interval)
            if (record.lastPing && record.currentStatus !== "OFFLINE") {
                const lastPingDate = new Date(record.lastPing);
                if (currentTime > lastPingDate) {
                    const elapsedSincePing = (currentTime - lastPingDate) / 1000;
                    // Cap at 30s — if more time has passed, the tracker is offline/lagging
                    if (elapsedSincePing < 30) {
                        if (record.currentStatus === "WORKING") {
                            workedSeconds += elapsedSincePing;
                        } else if (record.currentStatus === "IDLE") {
                            totalIdleSeconds += elapsedSincePing;
                        }
                    }
                }
            }
        } else {
            // If they are offline or tracker hasn't sent telemetry yet, just show 0 for exact work
            workedSeconds = 0;
            // Still display historical stored idle time for the day if they logged off
            totalIdleSeconds = storedIdleSeconds;
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

    const fetchReportData = async (empId, targetDateStr, liveRecord) => {
        setReportLoading(true);
        const cleanEmpId = String(empId || "").trim();
        const employeeName = employeesMap[cleanEmpId] || (liveRecord && liveRecord.name) || "Unknown Employee";
        const todayStr = new Date().toISOString().split('T')[0];

        try {
            const target = new Date(targetDateStr);
            const yesterday = new Date(target);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            // Fetch target date, yesterday's idle time, and attendance in parallel
            const [idleRes, yesterdayIdleRes, attRes] = await Promise.all([
                getIdleTimeForEmployeeByDate(cleanEmpId, targetDateStr),
                getIdleTimeForEmployeeByDate(cleanEmpId, yesterdayStr),
                getAttendanceByDateRange(targetDateStr, targetDateStr)
            ]);

            // Setup Yesterday's Idle total
            let yIdle = yesterdayIdleRes?.trackedIdleSeconds || 0;
            if (!yIdle && yesterdayIdleRes?.idleTimeline) {
                const yTimeline = yesterdayIdleRes.idleTimeline.map(i => (new Date(i.endTime || i.idleEnd) - new Date(i.startTime || i.idleStart)) / 1000);
                yIdle = yTimeline.reduce((acc, curr) => acc + curr, 0);
            }
            setYesterdayIdle(yIdle);

            // Find matching attendance
            const attData = attRes?.length > 0 ? attRes.find(a =>
                String(a.employeeId || "").trim() === cleanEmpId ||
                String(a.employeeName || "").toLowerCase().includes(employeeName.toLowerCase())
            ) : null;

            // Store raw results
            setRawReportData({ idle: idleRes, attendance: attData });

            // Build the correct record to pass to calculateReportStats.
            // For historical dates, use the data from the DB (idleRes) instead of the stale live record.
            const isToday = targetDateStr === todayStr;
            const record = isToday && liveRecord
                ? liveRecord  // Use live record for real-time ticking today
                : {
                    // For historical dates, reconstruct from the DB idle record
                    date: targetDateStr,
                    employeeId: cleanEmpId,
                    currentStatus: "OFFLINE",
                    idleSince: null,
                    lastPing: idleRes?.lastPing || null,
                    trackedWorkSeconds: idleRes?.trackedWorkSeconds || 0,
                    trackedIdleSeconds: idleRes?.trackedIdleSeconds || 0,
                    idleTimeline: idleRes?.idleTimeline || []
                };

            // Initial calculation
            const stats = calculateReportStats(record, idleRes, attData);
            setReportData(stats);

            // setup hourly chart data
            if (stats && stats.idleTimeline) {
                const hourlyBuckets = Array(24).fill(0).map((_, i) => ({ hour: i, working: 0, idle: 0 }));

                // Process idle segments
                stats.idleTimeline.forEach(seg => {
                    const start = new Date(seg.idleStart);
                    const end = new Date(seg.idleEnd);
                    let curr = new Date(start);

                    while (curr < end) {
                        const h = curr.getHours();
                        const nextH = new Date(curr);
                        nextH.setHours(h + 1, 0, 0, 0);
                        const endOfSegment = end < nextH ? end : nextH;
                        const durationMins = (endOfSegment - curr) / 60000;
                        if (h >= 0 && h < 24) hourlyBuckets[h].idle += durationMins;
                        curr = endOfSegment;
                    }
                });

                // Estimate working hours from punch-in to last-ping
                if (attData && attData.punchIn) {
                    const start = new Date(attData.punchIn);
                    const end = record.lastPing
                        ? new Date(record.lastPing)
                        : (isToday ? new Date() : new Date(targetDateStr + 'T23:59:59'));
                    let curr = new Date(start);

                    while (curr < end) {
                        const h = curr.getHours();
                        const nextH = new Date(curr);
                        nextH.setHours(h + 1, 0, 0, 0);
                        const endOfSegment = end < nextH ? end : nextH;
                        const totalMins = (endOfSegment - curr) / 60000;
                        if (h >= 0 && h < 24) {
                            const idleMins = hourlyBuckets[h].idle;
                            hourlyBuckets[h].working = Math.max(0, totalMins - idleMins);
                        }
                        curr = endOfSegment;
                    }
                }

                // Filter to only show hours with activity
                const activeHours = hourlyBuckets.filter(b => b.working > 0 || b.idle > 0);

                setDailyChartData({
                    labels: activeHours.map(b => `${b.hour}:00`),
                    datasets: [
                        {
                            label: 'Working (mins)',
                            data: activeHours.map(b => parseFloat(b.working.toFixed(1))),
                            borderColor: 'rgba(16, 185, 129, 1)',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                        },
                        {
                            label: 'Idle (mins)',
                            data: activeHours.map(b => parseFloat(b.idle.toFixed(1))),
                            borderColor: 'rgba(245, 158, 11, 1)',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            fill: true,
                            tension: 0.4,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                        }
                    ]
                });
            } else {
                setDailyChartData(null);
            }

        } catch (err) {
            console.error("Error fetching report data:", err);
            setReportData({ idleSeconds: 0, workedSeconds: 0, totalElapsedSeconds: 0, idleTimeline: [], punchIn: "N/A" });
            setDailyChartData(null);
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

            const _allIdleData = (idleRes && idleRes.data) ? idleRes.data : idleRes;
            const allIdle = Array.isArray(_allIdleData) ? _allIdleData : [];
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

                const dailyIdle = allIdle.find(item => item.date === dStr) || {
                    idleTimeline: [],
                    trackedWorkSeconds: 0,
                    trackedIdleSeconds: 0
                };

                const historicalRecord = {
                    date: dStr,
                    employeeId: empId,
                    currentStatus: "OFFLINE",
                    idleSince: null,
                    trackedWorkSeconds: dailyIdle.trackedWorkSeconds || 0,
                    trackedIdleSeconds: dailyIdle.trackedIdleSeconds || 0,
                    idleTimeline: dailyIdle.idleTimeline || []
                };

                const stats = calculateReportStats(historicalRecord, dailyIdle, dailyAtt);

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

            const totalWorked = workedData.reduce((acc, val) => acc + val, 0);
            const totalIdle = idleData.reduce((acc, val) => acc + val, 0);
            setWeeklyTotals({ worked: totalWorked, idle: totalIdle });
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

    // Re-fetch report and screenshots when selectedDate changes
    useEffect(() => {
        if (selectedEmployee) {
            const empId = selectedEmployee.employeeId;
            // For live view of today, pass the live tracker record;
            // for historical dates, pass null so fetchReportData rebuilds from DB
            const todayStr = new Date().toISOString().split('T')[0];
            const liveRecord = selectedDate === todayStr
                ? (liveData.find(r => String(r.employeeId).trim() === String(empId).trim()) || selectedEmployee)
                : null;
            fetchReportData(empId, selectedDate, liveRecord);
            fetchScreenshots(empId, selectedDate);
        }
    }, [selectedDate]);

    // When employee is first selected, also trigger the initial fetch
    useEffect(() => {
        if (selectedEmployee) {
            const empId = selectedEmployee.employeeId;
            const liveRecord = liveData.find(r => String(r.employeeId).trim() === String(empId).trim()) || selectedEmployee;
            fetchReportData(empId, selectedDate, liveRecord);
            fetchScreenshots(empId, selectedDate);
        }
    }, [selectedEmployee]);

    // "Live Ticker" Effect: Recalculate modal stats every second while modal is open
    useEffect(() => {
        if (selectedEmployee && !reportLoading && rawReportData.idle !== undefined) {
            const todayStr = new Date().toISOString().split('T')[0];
            const isToday = selectedDate === todayStr;

            if (isToday) {
                // Find LATEST state from liveData periodically
                const latestRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim()) || selectedEmployee;
                const stats = calculateReportStats(latestRecord, rawReportData.idle, rawReportData.attendance);
                setReportData(stats);
            }
        }
    }, [currentTime]); // Ticks every second

    const fetchScreenshots = async (empId, dateStr) => {
        setScreenshotsLoading(true);
        try {
            const targetDate = dateStr || selectedDate || new Date().toISOString().split('T')[0];
            const res = await api.get(`/api/idletime/screenshots/${empId}?date=${targetDate}`);
            console.log("Screenshot API response:", res.data);
            let data = res.data;
            if (!Array.isArray(data)) {
                if (data && Array.isArray(data.screenshots)) data = data.screenshots;
                else if (data && Array.isArray(data.data)) data = data.data;
                else data = [];
            }
            setScreenshots(data);
        } catch (err) {
            console.error("Error fetching screenshots:", err);
            setScreenshots([]);
        } finally {
            setScreenshotsLoading(false);
        }
    };

    const handleDeleteScreenshot = async (ss) => {
        if (!window.confirm('Delete this screenshot? This action cannot be undone.')) return;
        try {
            const empId = selectedEmployee.employeeId;
            await api.delete(`/api/idletime/screenshots/${empId}`, {
                data: { screenshotUrl: ss.screenshotUrl, date: ss.date, type: ss.type }
            });
            // Optimistically remove from UI
            setScreenshots(prev => prev.filter(s => s.screenshotUrl !== ss.screenshotUrl));
        } catch (err) {
            console.error('Error deleting screenshot:', err);
            alert('Failed to delete screenshot. Please try again.');
        }
    };

    const handleViewReport = (record) => {
        const empId = String(record.employeeId || "").trim();
        const latestRecord = liveData.find(r => String(r.employeeId).trim() === empId) || record;
        const employeeName = employeesMap[empId] || "Unknown Employee";

        const todayStr = new Date().toISOString().split('T')[0];
        const targetDate = record.date || todayStr;

        setSelectedEmployee({ ...latestRecord, name: employeeName, statusInfo: getStatusInfo(latestRecord), employeeId: empId });
        setReportLoading(true);
        setReportData(null);
        setWeeklyOffset(0);
        setRawReportData({ idle: null, attendance: null });
        setActiveTab('report');
        setScreenshots([]);
        setSelectedDate(targetDate);
        // Pass the live record only for today; null for historical dates
        const liveRecord = targetDate === todayStr ? latestRecord : null;
        fetchReportData(empId, targetDate, liveRecord);
        fetchScreenshots(empId, targetDate);
    };

    const handleDateChange = (newDate) => {
        setSelectedDate(newDate);
    };

    const shiftDate = (days) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        const newDateStr = date.toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        if (newDateStr <= todayStr) {
            setSelectedDate(newDateStr);
        }
    };

    // Auto-sync status only if modal open
    useEffect(() => {
        if (selectedEmployee && !reportLoading) {
            const currentRecord = liveData.find(r => String(r.employeeId).trim() === String(selectedEmployee.employeeId).trim());
            if (currentRecord) {
                const employeeName = employeesMap[String(currentRecord.employeeId).trim()] || selectedEmployee.name;
                setSelectedEmployee({ ...currentRecord, name: employeeName, statusInfo: getStatusInfo(currentRecord) });
                // Only auto-refresh report if viewing today (live data changes are irrelevant for past dates)
                const todayStr = new Date().toISOString().split('T')[0];
                if (selectedDate === todayStr) {
                    fetchReportData(currentRecord.employeeId, selectedDate, currentRecord);
                }
            }
        }
    }, [liveData]);

    const closeReportModal = () => {
        setSelectedEmployee(null);
        setReportData(null);
        setScreenshots([]);
        setLightboxUrl(null);
        setActiveTab('report');
    };

    // Close modal on Esc key press
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeReportModal();
            }
        };
        if (selectedEmployee) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [selectedEmployee]);

    const getRowIdleTime = (record) => {
        let total = record.trackedIdleSeconds || 0;
        if (!total && record.idleTimeline) {
            total = record.idleTimeline.reduce((acc, span) => {
                const start = new Date(span.startTime || span.idleStart);
                const end = new Date(span.endTime || span.idleEnd);
                return acc + ((end - start) / 1000);
            }, 0);
        }
        return formatDuration(total);
    };

    const generatePdf = () => {
        if (!selectedEmployee || !reportData) return;

        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text(`Daily Activity Report`, 14, 22);

        doc.setFontSize(12);
        doc.text(`Date: ${selectedDate}`, 14, 30);
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
                ['Total Tracked Time', formatDuration(reportData.totalElapsedSeconds)],
                ["Yesterday's Idle Time", formatDuration(yesterdayIdle)]
            ],
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181] },
            styles: { fontSize: 10 }
        });

        // Idle Timeline Table
        if (reportData.idleTimeline && reportData.idleTimeline.length > 0) {
            const tableData = reportData.idleTimeline.map(interval => [
                new Date(interval.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
                new Date(interval.idleEnd).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
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

        doc.save(`Activity_Report_${selectedEmployee.employeeId}_${selectedDate}.pdf`);
    };

    return (
        <div className="p-6 min-h-screen text-slate-800 bg-slate-50">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
                <div>
                    <h1 className="text-xl md:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-2 md:gap-3 leading-tight">
                        Idle Time & Live Activity Tracking
                    </h1>
                    <p className="text-sm md:text-base text-slate-500 mt-1 md:mt-2 flex items-center gap-2">
                        Monitor real-time desktop activity from employees
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white px-3 py-2 border border-slate-200 rounded-lg shadow-sm">
                        <FaCamera className="text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">Screenshot Interval:</span>
                        <select
                            value={screenshotInterval}
                            onChange={(e) => handleSaveSettings(e.target.value)}
                            disabled={savingSettings}
                            className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none text-indigo-700 font-medium"
                        >
                            <option value={1}>1 Minute</option>
                            <option value={5}>5 Minutes</option>
                            <option value={10}>10 Minutes</option>
                            <option value={15}>15 Minutes</option>
                            <option value={30}>30 Minutes</option>
                            <option value={60}>1 Hour</option>
                        </select>
                    </div>
                    <button
                        onClick={() => {
                            setLoading(true);
                            fetchLiveData(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-lg shadow-sm transition-all font-medium"
                    >
                        <FaSyncAlt className={loading ? "animate-spin text-indigo-400" : "text-indigo-400"} />
                        Auto-Refresh
                    </button>
                </div>
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
                <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-xl mb-6 shadow-sm">
                    {error}
                </div>
            )}

            {/* Data Grid */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-md">
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200 text-gray-700">
                                <th className="p-4 font-semibold w-1/5">Employee</th>
                                <th className="p-4 font-semibold w-1/6">Status</th>
                                <th className="p-4 font-semibold w-1/6">Date</th>
                                <th className="p-4 font-semibold w-1/6">Total Idle Time</th>
                                <th className="p-4 font-semibold w-1/6">Last Heartbeat</th>
                                <th className="p-4 font-semibold w-1/6 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && liveData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-12">
                                        <div className="flex flex-col items-center justify-center text-gray-400">
                                            <FaSyncAlt className="animate-spin text-2xl mb-3 text-indigo-500" />
                                            <span className="text-sm font-medium">Loading data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : liveData.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-12">
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
                                                <span className="text-sm font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-amber-200">
                                                    {getRowIdleTime(record)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                                    <FaClock className="text-gray-400 text-xs" />
                                                    {formatTime(record.lastPing)}
                                                    {/* Active Window Badge */}
                                                    {record.activeWindow && (
                                                        <span className="ml-2 flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold border border-blue-100 max-w-[200px] truncate" title={record.activeWindow}>
                                                            <FaDesktop className="text-[9px]" /> {record.activeWindow}
                                                        </span>
                                                    )}
                                                    {/* Live screenshot indicator for IDLE employees */}
                                                    {record.currentIdleScreenshot && statusInfo.text === 'Idle' && (
                                                        <a
                                                            href={record.currentIdleScreenshot}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            title="View live idle screenshot"
                                                            className="ml-1 flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold hover:bg-amber-200 transition-colors"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            <FaCamera className="text-[10px]" /> Live Shot
                                                        </a>
                                                    )}
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

                {/* Mobile List View */}
                <div className="md:hidden flex flex-col divide-y divide-gray-200">
                    {loading && liveData.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center justify-center text-gray-400">
                            <FaSyncAlt className="animate-spin text-2xl mb-3 text-indigo-500" />
                            <span className="text-sm font-medium">Loading data...</span>
                        </div>
                    ) : liveData.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center justify-center text-gray-400">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                                <FaRegClock className="text-xl text-gray-400" />
                            </div>
                            <span className="text-sm font-medium text-gray-500 mb-1">No data available</span>
                            <span className="text-xs text-gray-400 px-4 text-center">No live tracking data available for today yet. Make sure desktop trackers are running.</span>
                        </div>
                    ) : (
                        liveData.map((record) => {
                            const statusInfo = getStatusInfo(record);
                            const employeeName = employeesMap[record.employeeId] || "Unknown";
                            return (
                                <div key={`mobile-${record._id}`} className="p-4 flex flex-col gap-2 hover:bg-gray-50 transition-colors bg-white">
                                    {/* Top Row: Name and Status */}
                                    <div className="flex justify-between items-start">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-gray-900 text-sm">{employeeName}</span>
                                            <span className="text-[10px] text-gray-400 font-mono mt-0.5">{record.employeeId}</span>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${statusInfo.bg} ${statusInfo.color} border ${statusInfo.border}`}>
                                                {statusInfo.text}
                                            </span>
                                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">
                                                Idle: {getRowIdleTime(record)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bottom Row: Date, Heartbeat, and Action */}
                                    <div className="flex justify-between items-end mt-1">
                                        <div className="flex flex-col gap-1.5 text-[11px] text-gray-500 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <FaCalendarAlt className="text-gray-400" />
                                                {record.date}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <FaClock className="text-gray-400" />
                                                Beat: {formatTime(record.lastPing)}
                                            </div>
                                            {record.currentIdleScreenshot && statusInfo.text === 'Idle' && (
                                                <a
                                                    href={record.currentIdleScreenshot}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    title="View live idle screenshot"
                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold hover:bg-amber-200 transition-colors mt-0.5 w-fit"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <FaCamera /> Live Shot
                                                </a>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleViewReport(record)}
                                            className="px-3 py-1.5 bg-white text-indigo-600 border border-indigo-200 rounded text-[11px] font-bold flex items-center gap-1 hover:bg-indigo-50 transition-colors shadow-sm"
                                        >
                                            <FaSearch /> Details
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {lightboxUrl && (
                <div
                    className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
                    onClick={() => setLightboxUrl(null)}
                >
                    <img src={lightboxUrl} alt="Idle Screenshot" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl border border-slate-700" />
                    <button
                        className="absolute top-4 right-4 text-white bg-slate-700 hover:bg-slate-600 p-2 rounded-full"
                        onClick={() => setLightboxUrl(null)}
                    >
                        <FaTimes />
                    </button>
                </div>
            )}

            {/* Modal for Details & Report */}
            {selectedEmployee && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
                    onClick={closeReportModal}
                >
                    <div
                        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Modal Header */}
                        <div className="bg-white border-b border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center z-10 gap-4 relative">
                            <button
                                onClick={closeReportModal}
                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-all"
                                title="Close"
                            >
                                <FaTimes className="text-xl" />
                            </button>
                            <div>
                                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                                    <FaChartPie className="text-indigo-500 shrink-0" />
                                    Employee Activity Report
                                </h2>
                                <p className="text-slate-500 mt-1 flex items-center gap-2 font-medium flex-wrap">
                                    <span className="text-slate-800">{selectedEmployee.name}</span>
                                    <span className="text-xs px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-slate-600">{selectedEmployee.employeeId}</span>
                                    <span className={`text-xs ml-1 flex items-center gap-1 font-semibold ${selectedEmployee.statusInfo.color}`}>
                                        <FaCircle className="text-[8px]" /> {selectedEmployee.statusInfo.text}
                                    </span>
                                    {selectedEmployee.activeWindow && (
                                        <span className="text-xs ml-2 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-blue-600 font-medium flex items-center gap-1">
                                            <FaDesktop className="text-[10px]" /> {selectedEmployee.activeWindow}
                                        </span>
                                    )}
                                </p>
                                {/* Tab Switcher */}
                                <div className="flex flex-wrap items-center gap-3 mt-3">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setActiveTab('report')}
                                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'report'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                                }`}
                                        >
                                            <FaChartPie className="inline mr-1.5" /> Activity Report
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('screenshots')}
                                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'screenshots'
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                                }`}
                                        >
                                            <FaCamera />
                                            Screenshots
                                            {screenshots.length > 0 && (
                                                <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-white text-xs rounded-full">{screenshots.length}</span>
                                            )}
                                        </button>
                                    </div>

                                    {/* Date Picker */}
                                    <div className="flex items-center gap-0 bg-slate-50 border border-slate-200 rounded-lg shadow-sm hover:border-indigo-300 transition-all overflow-hidden">
                                        <button
                                            onClick={() => shiftDate(-1)}
                                            className="p-2 hover:bg-slate-200 text-slate-500 transition-colors border-r border-slate-200"
                                            title="Previous Day"
                                        >
                                            <FaChevronLeft className="text-[10px]" />
                                        </button>
                                        <div className="flex items-center gap-2 px-3 py-1.5">
                                            <FaCalendarAlt className="text-indigo-500 text-xs" />
                                            <input
                                                type="date"
                                                value={selectedDate}
                                                onChange={(e) => handleDateChange(e.target.value)}
                                                className="text-xs font-bold text-slate-600 outline-none border-none bg-transparent cursor-pointer"
                                                max={new Date().toISOString().split('T')[0]}
                                            />
                                        </div>
                                        <button
                                            onClick={() => shiftDate(1)}
                                            disabled={selectedDate === new Date().toISOString().split('T')[0]}
                                            className="p-2 hover:bg-slate-200 text-slate-500 transition-colors border-l border-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Next Day"
                                        >
                                            <FaChevronRight className="text-[10px]" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Tab Switcher */}
                            {/* <div className="flex gap-2 mt-4 overflow-x-auto pb-1 scrollbar-hide">
                                <button
                                    onClick={() => setActiveTab('report')}
                                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'report'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                        }`}
                                >
                                    <FaChartPie className="inline mr-1.5" /> Activity
                                </button>
                                <button
                                    onClick={() => setActiveTab('screenshots')}
                                    className={`px-3 md:px-4 py-1.5 md:py-2 rounded-lg text-xs md:text-sm font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'screenshots'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                        }`}
                                >
                                    <FaCamera />
                                    Screenshots
                                    {screenshots.length > 0 && (
                                        <span className="ml-1 px-1.5 py-0.5 bg-indigo-500 text-white text-[10px] rounded-full">{screenshots.length}</span>
                                    )}
                                </button>
                            </div> */}
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto bg-slate-50/50">

                            {/* ===== ACTIVITY REPORT TAB ===== */}
                            {activeTab === 'report' && (
                                reportLoading ? (
                                    <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                                        <FaSyncAlt className="animate-spin text-4xl mb-4 text-indigo-500" />
                                        <p className="font-medium">Loading analytics from database...</p>
                                    </div>
                                ) : (
                                    reportData && (
                                        <>
                                            {/* Quick Analytics Cards */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col shadow-sm">
                                                    <span className="text-emerald-700 text-[10px] md:text-xs font-bold mb-1 uppercase tracking-wider">Working</span>
                                                    <span className="text-xl md:text-3xl font-bold text-emerald-600">{formatDuration(reportData.workedSeconds)}</span>
                                                </div>
                                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col shadow-sm">
                                                    <span className="text-amber-700 text-[10px] md:text-xs font-bold mb-1 uppercase tracking-wider">Idle</span>
                                                    <span className="text-xl md:text-3xl font-bold text-amber-600">{formatDuration(reportData.idleSeconds)}</span>
                                                </div>
                                                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col shadow-sm">
                                                    <span className="text-slate-500 text-[10px] md:text-xs font-bold mb-1 uppercase tracking-wider">Yesterday's Idle</span>
                                                    <span className="text-xl md:text-3xl font-bold text-slate-700">{formatDuration(yesterdayIdle)}</span>
                                                </div>
                                                <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm">
                                                    <button
                                                        onClick={generatePdf}
                                                        className="w-full h-full min-h-[40px] flex items-center justify-center py-2 px-2 md:py-3 md:px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-xs md:text-base font-bold shadow-lg transition-all gap-1.5 md:gap-2"
                                                    >
                                                        <FaFilePdf className="text-sm md:text-base" /> <span className="md:inline">PDF</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Daily Performance Section */}
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                                                {/* Daily Activity Trend (Line) */}
                                                <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                                                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                                        <FaRegClock className="text-indigo-500" />
                                                        Day Activity Trend (Hourly)
                                                    </h3>
                                                    <div className="w-full h-56 relative">
                                                        {dailyChartData ? (
                                                            <Line
                                                                data={dailyChartData}
                                                                options={{
                                                                    responsive: true,
                                                                    maintainAspectRatio: false,
                                                                    plugins: {
                                                                        legend: {
                                                                            position: 'top',
                                                                            align: 'end',
                                                                            labels: { boxWidth: 8, usePointStyle: true, pointStyle: 'circle', font: { size: 10 } }
                                                                        },
                                                                        tooltip: {
                                                                            mode: 'index',
                                                                            intersect: false,
                                                                            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} mins` }
                                                                        }
                                                                    },
                                                                    scales: {
                                                                        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
                                                                        y: {
                                                                            beginAtZero: true,
                                                                            ticks: { font: { size: 9 } },
                                                                            title: { display: true, text: 'Mins / Hour', font: { size: 10, weight: '600' } }
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                                                                No trend data for this date
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Activity Ratio (Doughnut) */}
                                                <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center shadow-sm relative group overflow-hidden">
                                                    <div className="w-full flex justify-between items-center mb-6">
                                                        <h3 className="text-lg font-extrabold text-slate-800">Ratio</h3>
                                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">LIVE</span>
                                                    </div>

                                                    <div className="w-full h-52 relative">
                                                        {reportData.workedSeconds === 0 && reportData.idleSeconds === 0 ? (
                                                            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 rounded-full">No Data</div>
                                                        ) : (
                                                            <>
                                                                <Pie
                                                                    data={{
                                                                        labels: ['Working Time', 'Idle Time'],
                                                                        datasets: [{
                                                                            data: [
                                                                                (reportData.workedSeconds / 3600).toFixed(2),
                                                                                (reportData.idleSeconds / 3600).toFixed(2)
                                                                            ],
                                                                            backgroundColor: [
                                                                                'rgba(16, 185, 129, 0.9)',
                                                                                'rgba(245, 158, 11, 0.9)'
                                                                            ],
                                                                            hoverBackgroundColor: [
                                                                                'rgba(16, 185, 129, 1)',
                                                                                'rgba(245, 158, 11, 1)'
                                                                            ],
                                                                            borderColor: '#fff',
                                                                            borderWidth: 1,
                                                                            hoverOffset: 20
                                                                        }]
                                                                    }}
                                                                    plugins={[{
                                                                        id: 'datalabels',
                                                                        afterDatasetsDraw(chart) {
                                                                            const { ctx, data } = chart;
                                                                            ctx.save();
                                                                            const meta = chart.getDatasetMeta(0);
                                                                            meta.data.forEach((element, i) => {
                                                                                const value = data.datasets[0].data[i];
                                                                                if (value > 0.2) { // Only show if segment is large enough
                                                                                    const { x, y } = element.tooltipPosition();
                                                                                    ctx.fillStyle = 'white';
                                                                                    ctx.font = 'bold 12px Inter, sans-serif';
                                                                                    ctx.textAlign = 'center';
                                                                                    ctx.textBaseline = 'middle';
                                                                                    ctx.shadowColor = 'rgba(0,0,0,0.3)';
                                                                                    ctx.shadowBlur = 4;
                                                                                    ctx.fillText(`${value}h`, x, y);
                                                                                }
                                                                            });
                                                                            ctx.restore();
                                                                        }
                                                                    }]}
                                                                    options={{
                                                                        plugins: {
                                                                            legend: {
                                                                                display: true,
                                                                                position: 'bottom',
                                                                                labels: {
                                                                                    boxWidth: 8,
                                                                                    usePointStyle: true,
                                                                                    pointStyle: 'circle',
                                                                                    font: { size: 11, weight: '600' },
                                                                                    padding: 15,
                                                                                    color: '#64748b'
                                                                                }
                                                                            },
                                                                            tooltip: {
                                                                                backgroundColor: '#1e293b',
                                                                                padding: 12,
                                                                                cornerRadius: 10,
                                                                                callbacks: {
                                                                                    label: (ctx) => ` ${ctx.label}: ${ctx.raw} hrs`
                                                                                }
                                                                            }
                                                                        },
                                                                        maintainAspectRatio: false,
                                                                        animation: { animateScale: true, animateRotate: true }
                                                                    }}
                                                                />
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Intervals and Weekly Summary Grid */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                                {/* Timeline Table */}
                                                <div className="bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-sm">
                                                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                                                        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                                            <FaClock className="text-amber-500" />
                                                            Idle Intervals Log
                                                        </h3>
                                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Today</span>
                                                    </div>
                                                    <div className="overflow-y-auto max-h-64">
                                                        {reportData.idleTimeline && reportData.idleTimeline.length > 0 ? (
                                                            <div className="flex flex-col divide-y divide-slate-100">
                                                                {reportData.idleTimeline.map((item, idx) => (
                                                                    <div key={idx} className="grid grid-cols-3 p-3 hover:bg-slate-50 gap-4 text-xs">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-slate-400 text-[9px] uppercase font-bold">Start</span>
                                                                            <span className="text-slate-700 font-semibold">{new Date(item.idleStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="text-slate-400 text-[9px] uppercase font-bold">End</span>
                                                                            <span className="text-slate-700 font-semibold">{new Date(item.idleEnd).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                        </div>
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-slate-400 text-[9px] uppercase font-bold">Duration</span>
                                                                            <span className="text-amber-600 font-bold">{formatDuration(item.idleDurationSeconds)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="p-12 text-center text-slate-400 text-xs italic">
                                                                No idle sessions recorded.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Week Summary Stats Mini-Card (Quick Peek) */}
                                                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg flex flex-col justify-center relative overflow-hidden">
                                                    <div className="relative z-10">
                                                        <h3 className="text-lg font-bold mb-1 opacity-90">Weekly Overview</h3>
                                                        <p className="text-xs opacity-70 mb-6">Aggregate performance for the last 7 days</p>

                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
                                                                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Total Worked</div>
                                                                <div className="text-xl font-black">{weeklyTotals.worked.toFixed(1)}h</div>
                                                            </div>
                                                            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10">
                                                                <div className="text-[10px] uppercase font-bold opacity-60 mb-1">Total Idle</div>
                                                                <div className="text-xl font-black">{weeklyTotals.idle.toFixed(1)}h</div>
                                                            </div>
                                                        </div>

                                                        <div className="mt-6 flex items-center gap-2 text-xs">
                                                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                                                            <span className="font-medium">Tracker syncing active</span>
                                                        </div>
                                                    </div>
                                                    {/* Decorative background icon */}
                                                    <FaChartPie className="absolute -bottom-6 -right-6 text-white/5 text-9xl transform rotate-12" />
                                                </div>
                                            </div>

                                            {/* Weekly Summary Grid */}
                                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                                                {/* Left Column: Stats Summary */}
                                                {/* <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                                                    <div className="flex justify-between items-center mb-6">
                                                        <h3 className="text-lg font-bold text-slate-800">Week Stats</h3>
                                                        <FaChartPie className="text-indigo-400" />
                                                    </div>

                                                    <div className="space-y-4 flex-grow">
                                                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                                                            <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Total Worked</div>
                                                            <div className="text-2xl font-black text-emerald-700">{weeklyTotals.worked.toFixed(1)} <span className="text-sm font-medium opacity-70">hrs</span></div>
                                                            <div className="text-[10px] text-emerald-600/70 mt-1">Avg: {(weeklyTotals.worked / 7).toFixed(1)} hrs / day</div>
                                                        </div>

                                                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                                                            <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Total Idle</div>
                                                            <div className="text-2xl font-black text-amber-700">{weeklyTotals.idle.toFixed(1)} <span className="text-sm font-medium opacity-70">hrs</span></div>
                                                            <div className="text-[10px] text-amber-600/70 mt-1">Avg: {(weeklyTotals.idle / 7).toFixed(1)} hrs / day</div>
                                                        </div>

                                                        <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                                                            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Efficiency</div>
                                                            <div className="text-2xl font-black text-indigo-700">
                                                                {weeklyTotals.worked + weeklyTotals.idle > 0
                                                                    ? ((weeklyTotals.worked / (weeklyTotals.worked + weeklyTotals.idle)) * 100).toFixed(0)
                                                                    : 0}%
                                                            </div>
                                                            <div className="w-full bg-indigo-200 h-1.5 rounded-full mt-2 overflow-hidden">
                                                                <div
                                                                    className="bg-indigo-600 h-full rounded-full transition-all duration-1000"
                                                                    style={{
                                                                        width: `${weeklyTotals.worked + weeklyTotals.idle > 0
                                                                            ? (weeklyTotals.worked / (weeklyTotals.worked + weeklyTotals.idle)) * 100
                                                                            : 0}%`
                                                                    }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="mt-6 pt-4 border-t border-slate-100">
                                                        <p className="text-[10px] text-slate-400 italic">Values based on past 7 days tracking data.</p>
                                                    </div>
                                                </div> */}

                                                {/* Right Column: Line Chart */}
                                                {/* <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                                                    <div className="flex justify-between items-center mb-6">
                                                        <h3 className="text-lg font-bold text-slate-800">Activity Trend</h3>
                                                        <select
                                                            className="bg-slate-50 text-slate-700 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium transition-all"
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
                                                            <div className="absolute inset-0 flex items-center justify-center text-slate-400 gap-2 bg-white/50 backdrop-blur-[1px] z-10 rounded-xl">
                                                                <FaSyncAlt className="animate-spin text-2xl text-indigo-500" />
                                                                <span className="font-medium">Updating Trend...</span>
                                                            </div>
                                                        ) : weeklyChartData ? (
                                                            <Line
                                                                data={weeklyChartData}
                                                                options={{
                                                                    responsive: true,
                                                                    maintainAspectRatio: false,
                                                                    interaction: {
                                                                        mode: 'index',
                                                                        intersect: false,
                                                                    },
                                                                    plugins: {
                                                                        legend: {
                                                                            position: 'top',
                                                                            align: 'end',
                                                                            labels: {
                                                                                usePointStyle: true,
                                                                                pointStyle: 'circle',
                                                                                padding: 20,
                                                                                font: { family: 'Inter, sans-serif', size: 11, weight: '600' },
                                                                                color: '#64748b'
                                                                            }
                                                                        },
                                                                        tooltip: {
                                                                            backgroundColor: '#1e293b',
                                                                            padding: 12,
                                                                            titleFont: { size: 13, weight: 'bold' },
                                                                            bodyFont: { size: 12 },
                                                                            cornerRadius: 8,
                                                                            callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw} hrs` }
                                                                        }
                                                                    },
                                                                    scales: {
                                                                        x: {
                                                                            ticks: { color: '#94a3b8', font: { size: 10 } },
                                                                            grid: { display: false }
                                                                        },
                                                                        y: {
                                                                            beginAtZero: true,
                                                                            ticks: { color: '#94a3b8', font: { size: 10 }, stepSize: 2 },
                                                                            grid: { color: 'rgba(226, 232, 240, 0.4)', strokeDashArray: [4, 4] },
                                                                            title: { display: true, text: 'Hours Captured', color: '#64748b', font: { size: 11, weight: '600' } }
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 border-2 border-dashed border-slate-100 rounded-xl">
                                                                Data could not be loaded
                                                            </div>
                                                        )}
                                                    </div>
                                                </div> */}
                                            </div>
                                        </>
                                    )
                                )
                            )}

                            {/* ===== SCREENSHOTS TAB ===== */}
                            {activeTab === 'screenshots' && (
                                <div>
                                    <div className="flex items-center gap-3 mb-6">
                                        <FaCamera className="text-indigo-500 text-xl" />
                                        <h3 className="text-xl font-bold text-slate-800">Screenshots Log</h3>
                                        <span className="text-xs text-slate-500">(interval dynamically set by admin)</span>
                                    </div>

                                    {screenshotsLoading ? (
                                        <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                                            <FaSyncAlt className="animate-spin text-3xl text-indigo-500" />
                                            <p>Loading screenshots...</p>
                                        </div>
                                    ) : screenshots.length === 0 ? (
                                        <div className="py-16 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-slate-200 rounded-xl bg-white">
                                            <FaCamera className="text-5xl mb-3 opacity-20" />
                                            <p className="font-medium">No screenshots found</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            {screenshots.map((ss, idx) => (
                                                <div key={idx} className={`bg-white border ${ss.type === 'WORKING' ? 'border-emerald-200 hover:border-emerald-400' : 'border-amber-200 hover:border-amber-400'} rounded-xl overflow-hidden transition-all group shadow-sm`}>
                                                    {/* Thumbnail */}
                                                    <div
                                                        className="relative cursor-pointer overflow-hidden h-44"
                                                        onClick={() => setLightboxUrl(ss.screenshotUrl)}
                                                    >
                                                        <img
                                                            src={ss.screenshotUrl}
                                                            alt={`${ss.type} at ${ss.date}`}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/400x180?text=Screenshot+Not+Found'; }}
                                                        />
                                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                                            <FaSearch className="text-white text-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                                                        </div>
                                                        <span className={`absolute top-2 left-2 ${ss.type === 'WORKING' ? 'bg-emerald-500' : 'bg-amber-500'} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}>
                                                            {ss.type || 'IDLE'}
                                                        </span>
                                                        <span className="absolute top-2 right-2 bg-slate-900/70 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
                                                            {new Date(ss.capturedAt || ss.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    {/* Meta info */}
                                                    <div className="p-3 bg-slate-50">
                                                        <div className="flex justify-between items-center">
                                                            <div className="text-sm">
                                                                {ss.type === 'WORKING' ? (
                                                                    <span className="text-emerald-600 font-medium">Working Screenshot</span>
                                                                ) : (
                                                                    <>
                                                                        <span className="text-slate-500">Idle: </span>
                                                                        <span className="text-amber-600 font-mono font-medium">
                                                                            {new Date(ss.idleStart).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                        <span className="text-slate-400 mx-1">→</span>
                                                                        <span className="text-amber-600 font-mono font-medium">
                                                                            {new Date(ss.idleEnd).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <a
                                                                    href={ss.screenshotUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="text-slate-400 hover:text-indigo-500 transition-colors"
                                                                    title="Open full size"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <FaExternalLinkAlt className="text-sm" />
                                                                </a>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleDeleteScreenshot(ss); }}
                                                                    className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                                                                    title="Delete screenshot"
                                                                >
                                                                    <FaTrash className="text-xs" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {ss.type !== 'WORKING' && (
                                                            <p className="text-xs text-slate-400 mt-1">
                                                                Duration: <span className="text-slate-600">{Math.floor((ss.idleDurationSeconds || 0) / 60)}m {Math.round((ss.idleDurationSeconds || 0) % 60)}s</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminLiveTracking;