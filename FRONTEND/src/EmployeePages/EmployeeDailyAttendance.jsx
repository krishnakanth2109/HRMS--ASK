// --- START OF FILE EmployeeDailyAttendance.jsx ---

import React, { useContext, useEffect, useState, useMemo, useCallback, useRef } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  getAttendanceForEmployee,
  getShiftByEmployeeId,
  getHolidays,
  getLeaveRequestsForEmployee,
  requestStatusCorrection
} from "../api";

// --- Import Chart.js and React wrapper ---
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// --- Import Icons ---
import {
  FaRegClock,
  FaSearch,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaUserClock,
  FaExclamationTriangle,
  FaStarHalfAlt,
  FaTimesCircle,
  FaFilter,
  FaFileDownload,
  FaListAlt,
  FaTimes,
  FaCheckCircle,
  FaEdit,
  FaHistory,
  FaSignInAlt,
  FaSignOutAlt,
  FaHourglassHalf,
  FaBullseye,
  FaCalendarAlt,
  FaChevronDown, // Added for scroll indicator
  FaArrowRight   // Added for modal button
} from "react-icons/fa";

// --- Register Chart.js components ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const getDaysInMonth = (year, month) => {
  const date = new Date(year, month, 1);
  const days = [];
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

// Convert Date to YYYY-MM-DD for accurate comparison
const toISODateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateLoginStatus = (punchInTime, shiftData, apiStatus) => {
  if (!punchInTime) return "--";
  if (apiStatus === "LATE") return "LATE";

  if (shiftData && shiftData.shiftStartTime) {
    try {
      const punchDate = new Date(punchInTime);
      const [sHour, sMin] = shiftData.shiftStartTime.split(':').map(Number);
      const shiftDate = new Date(punchDate);
      shiftDate.setHours(sHour, sMin, 0, 0);

      const grace = shiftData.lateGracePeriod || 15;
      shiftDate.setMinutes(shiftDate.getMinutes() + grace);

      if (punchDate > shiftDate) return "LATE";
    } catch (e) {
      console.error("Date calc error", e);
    }
  }
  return "ON_TIME";
};

// Helper to format milliseconds to 0h 0m 0s
const formatDuration = (ms) => {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};

const TableRowSkeleton = () => (
  <tr className="animate-pulse border-b border-gray-100">
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-6 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
  </tr>
);

// Summary Card Component
const SummaryCard = ({ title, count, icon, colorClass, bgClass }) => (
  <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-gray-500 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-gray-800">{count}</h3>
      <p className="text-[10px] text-gray-400 mt-1">This month</p>
    </div>
    <div className={`p-3 rounded-xl ${bgClass} ${colorClass} text-xl`}>
      {icon}
    </div>
  </div>
);

// ==========================================
// MAIN COMPONENT
// ==========================================

const EmployeeDailyAttendance = () => {
  const { user } = useContext(AuthContext);

  // State
  const [attendance, setAttendance] = useState([]);
  const [shiftDetails, setShiftDetails] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'descending' });

  // Request Modals
  const [showRequestsModal, setShowRequestsModal] = useState(false);
  const [showCorrectionHistoryModal, setShowCorrectionHistoryModal] = useState(false);

  // Correction Submission Modal State
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [correctionData, setCorrectionData] = useState({ date: "", punchIn: "", currentStatus: "" });
  const [requestedPunchOut, setRequestedPunchOut] = useState("");
  const [statusReason, setStatusReason] = useState("");

  // --- NEW: Live Timer State ---
  const [liveTimer, setLiveTimer] = useState("0h 0m 0s");

  // --- NEW: Scroll Indicator State ---
  const tableContainerRef = useRef(null);
  const [showScrollArrow, setShowScrollArrow] = useState(false);

  // --- Fetch Data ---
  const loadData = useCallback(async (empId) => {
    setLoading(true);
    try {
      const [attendanceRes, shiftRes, holidaysRes, leavesRes] = await Promise.all([
        getAttendanceForEmployee(empId),
        getShiftByEmployeeId(empId).catch(() => null),
        getHolidays().catch(() => []),
        getLeaveRequestsForEmployee(empId).catch(() => [])
      ]);

      const attendanceData = Array.isArray(attendanceRes) ? attendanceRes : (attendanceRes.data || []);
      setAttendance(attendanceData);
      setShiftDetails(shiftRes);

      const hData = Array.isArray(holidaysRes) ? holidaysRes : (holidaysRes.data || []);
      setHolidays(hData);

      const lData = Array.isArray(leavesRes) ? leavesRes : (leavesRes.data || []);
      setLeaves(lData);

    } catch (err) {
      console.error("Error loading data:", err);
      setAttendance([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.employeeId) {
      loadData(user.employeeId);
    } else {
      setLoading(false);
    }
  }, [user, loadData]);

  // --- Extract Available Years ---
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    if (attendance.length === 0) return [currentYear];
    const years = new Set(attendance.map(a => new Date(a.date).getFullYear()));
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [attendance]);

  // --- Process Data for Calendar Table ---
  const processedCalendarData = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = toISODateString(today);

    const adminFullDayHours = shiftDetails?.fullDayHours || 9;
    const adminHalfDayHours = shiftDetails?.halfDayHours || 4.5;
    const weeklyOffDays = shiftDetails?.weeklyOffDays || [0];

    return daysInMonth.map(dayDate => {
      const currentDateISO = toISODateString(dayDate);
      const isFuture = dayDate > today;
      const dayOfWeek = dayDate.getDay();

      const record = attendance.find(a => toISODateString(a.date) === currentDateISO);

      // Check Holiday
      const activeHoliday = holidays.find(h => {
        const start = new Date(h.startDate);
        const end = new Date(h.endDate || h.startDate);
        const hStartLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const hEndLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const currLocal = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
        return currLocal >= hStartLocal && currLocal <= hEndLocal;
      });

      // Check Leave
      const activeLeave = leaves.find(l => {
        if (l.status !== 'Approved') return false;
        const start = new Date(l.from);
        const end = new Date(l.to);
        const lStartLocal = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const lEndLocal = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const currLocal = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
        return currLocal >= lStartLocal && currLocal <= lEndLocal;
      });

      const isWeekOff = weeklyOffDays.includes(dayOfWeek);

      let finalStatus = "Absent";
      let loginStatus = "--";
      let displayTime = "00:00";
      let statusDetails = null;

      if (record && record.punchIn) {
        const end = record.punchOut ? new Date(record.punchOut) : new Date();
        const start = new Date(record.punchIn);
        const workedHours = (end - start) / (1000 * 60 * 60);

        if (workedHours >= adminFullDayHours) finalStatus = "Full Day";
        else if (workedHours >= adminHalfDayHours) finalStatus = "Half Day";
        else finalStatus = "Absent";

        if (!record.punchOut && currentDateISO === todayISO) finalStatus = "Working";
        displayTime = record.displayTime || "00:00";
        loginStatus = calculateLoginStatus(record.punchIn, shiftDetails, record.loginStatus);
      } else {
        if (activeLeave) {
          finalStatus = "Leave";
          statusDetails = activeLeave.reason;
        } else if (activeHoliday) {
          finalStatus = "Holiday";
          statusDetails = activeHoliday.name;
        } else if (isWeekOff) {
          finalStatus = "Week Off";
        } else if (isFuture) {
          finalStatus = "Upcoming";
        } else {
          finalStatus = "Absent";
        }
      }

      return {
        date: dayDate.toISOString(),
        dayObj: dayDate,
        punchIn: record?.punchIn || null,
        punchOut: record?.punchOut || null,
        displayTime,
        status: record?.status || finalStatus.toUpperCase(),
        loginStatus,
        workedStatus: finalStatus,
        details: statusDetails,
        statusCorrectionRequest: record?.statusCorrectionRequest || { hasRequest: false },
        lateCorrectionRequest: record?.lateCorrectionRequest || { hasRequest: false }
      };
    });
  }, [selectedDate, attendance, shiftDetails, holidays, leaves]);

  // --- Filter Logic ---
  const filteredData = useMemo(() => {
    let data = [...processedCalendarData];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    data = data.filter(item => {
      const d = new Date(item.date);
      return d <= today && item.workedStatus !== "Upcoming";
    });

    if (searchTerm) {
      data = data.filter(item =>
        Object.values(item).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    if (sortConfig.key) {
      data.sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [processedCalendarData, searchTerm, sortConfig]);

  // --- Calculate Yearly Stats for Graph ---
  const yearlyStats = useMemo(() => {
    const year = selectedDate.getFullYear();
    const statsPerMonth = Array(12).fill(null).map(() => ({
      present: 0,
      absent: 0,
      fullDay: 0,
      halfDay: 0,
      leave: 0,
      holidays: 0
    }));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const adminFullDayHours = shiftDetails?.fullDayHours || 9;
    const adminHalfDayHours = shiftDetails?.halfDayHours || 4.5;
    const weeklyOffDays = shiftDetails?.weeklyOffDays || [0];

    for (let m = 0; m < 12; m++) {
      const days = getDaysInMonth(year, m);
      days.forEach(dayDate => {
        if (dayDate > today) return;
        const currentDateISO = toISODateString(dayDate);
        const dayOfWeek = dayDate.getDay();
        const record = attendance.find(a => toISODateString(a.date) === currentDateISO);

        const isHoliday = holidays.some(h => {
          const s = new Date(h.startDate); s.setHours(0, 0, 0, 0);
          const e = new Date(h.endDate || h.startDate); e.setHours(23, 59, 59, 999);
          return dayDate >= s && dayDate <= e;
        });
        const isLeave = leaves.some(l => {
          if (l.status !== 'Approved') return false;
          const s = new Date(l.from); s.setHours(0, 0, 0, 0);
          const e = new Date(l.to); e.setHours(23, 59, 59, 999);
          return dayDate >= s && dayDate <= e;
        });
        const isWeekOff = weeklyOffDays.includes(dayOfWeek);

        if (record && record.punchIn) {
          statsPerMonth[m].present++;
          const end = record.punchOut ? new Date(record.punchOut) : new Date();
          const start = new Date(record.punchIn);
          const workedHours = (end - start) / (1000 * 60 * 60);

          if (workedHours >= adminFullDayHours) statsPerMonth[m].fullDay++;
          else if (workedHours >= adminHalfDayHours) statsPerMonth[m].halfDay++;
        } else if (isLeave || (record && record.status === "LEAVE")) {
          statsPerMonth[m].leave++;
        } else {
          if (isHoliday) statsPerMonth[m].holidays++;
          else if (isWeekOff) { /* WeekOff */ }
          else statsPerMonth[m].absent++;
        }
      });
    }
    return statsPerMonth;
  }, [selectedDate, attendance, shiftDetails, holidays, leaves]);

  // --- Summary Stats for the Cards & Donut ---
  const summaryStats = useMemo(() => {
    const m = selectedDate.getMonth();
    const stats = yearlyStats[m];
    const currentMonthData = processedCalendarData.filter(d => d.workedStatus !== "Upcoming");
    const weekOffs = currentMonthData.filter(d => d.workedStatus === "Week Off").length;
    const absentTotal = stats.absent + stats.leave;

    return {
      presentDays: stats.present,
      fullDays: stats.fullDay,
      halfDays: stats.halfDay,
      leaveDays: stats.leave,
      absentDays: absentTotal,
      holidayCount: stats.holidays,
      weekOffs: weekOffs,
      lateCount: processedCalendarData.filter(a => a.loginStatus === 'LATE' && a.workedStatus !== "Upcoming").length,
      onTimeCount: processedCalendarData.filter(a => a.loginStatus === 'ON_TIME' && a.workedStatus !== "Upcoming").length
    };
  }, [yearlyStats, selectedDate, processedCalendarData]);

  // --- Today's Specific Data ---
  const todayRecord = useMemo(() => {
    const todayISO = toISODateString(new Date());
    return processedCalendarData.find(d => toISODateString(d.date) === todayISO) || {
      punchIn: null,
      punchOut: null,
      displayTime: "00:00",
      loginStatus: "--"
    };
  }, [processedCalendarData]);

  // --- NEW: Live Timer Effect ---
  useEffect(() => {
    let interval;
    const updateTimer = () => {
      if (todayRecord.punchIn) {
        const start = new Date(todayRecord.punchIn);
        const end = todayRecord.punchOut ? new Date(todayRecord.punchOut) : new Date();
        setLiveTimer(formatDuration(end - start));
      } else {
        setLiveTimer("0h 0m 0s");
      }
    };

    updateTimer(); // Initial call
    if (todayRecord.punchIn && !todayRecord.punchOut) {
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [todayRecord]);

  // --- Chart Data Configuration ---
  const barGraphData = useMemo(() => {
    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Present',
          data: yearlyStats.map(s => s.present),
          backgroundColor: '#10b981', // Emerald 500
          borderRadius: 3,
          barThickness: 10,
        },
        {
          label: 'Absent',
          data: yearlyStats.map(s => s.absent + s.leave),
          backgroundColor: '#ef4444', // Red 500
          borderRadius: 3,
          barThickness: 10,
        }
      ]
    };
  }, [yearlyStats]);

  const donutData = {
    labels: ['Present', 'Absent', 'Late', 'Holidays/Off'],
    datasets: [
      {
        data: [
          summaryStats.presentDays,
          summaryStats.absentDays,
          summaryStats.lateCount,
          summaryStats.weekOffs + summaryStats.holidayCount
        ],
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#cbd5e1'],
        borderWidth: 0,
        hoverOffset: 4
      },
    ],
  };

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: {
        position: "right",
        labels: {
          boxWidth: 10,      // 🔹 smaller color box
          boxHeight: 10,
          padding: 10,       // 🔹 space between items
          font: {
            size: 11,        // 🔥 REDUCE TEXT SIZE (default ~14)
            weight: "500"
          }
        }
      }
    }
  };


  // --- HISTORY LOGIC ---
  const lateRequestsHistory = useMemo(() => {
    const selectedMonth = selectedDate.getMonth();
    return attendance.filter(record => {
      const recordDate = new Date(record.date);
      return record.lateCorrectionRequest?.hasRequest &&
        recordDate.getMonth() === selectedMonth;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendance, selectedDate]);

  const statusCorrectionHistory = useMemo(() => {
    return attendance.filter(record =>
      record.statusCorrectionRequest?.hasRequest
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [attendance]);

  // --- NEW: Scroll Detection Logic ---
  const handleScroll = () => {
    if (tableContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current;
      // Show arrow if we are not at bottom and there is scrollable content
      setShowScrollArrow(scrollTop + clientHeight < scrollHeight - 10);
    }
  };

  useEffect(() => {
    handleScroll(); // check initially
    window.addEventListener('resize', handleScroll);
    return () => window.removeEventListener('resize', handleScroll);
  }, [filteredData]);


  // --- Handlers ---
  const handleYearChange = (e) => setSelectedDate(new Date(parseInt(e.target.value), selectedDate.getMonth()));
  const handleMonthChange = (e) => setSelectedDate(new Date(selectedDate.getFullYear(), parseInt(e.target.value)));

  const requestSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="text-gray-300" />;
    return sortConfig.direction === 'ascending' ? <FaSortUp className="text-blue-600" /> : <FaSortDown className="text-blue-600" />;
  };

  const openCorrectionModal = (record) => {
    setCorrectionData({
      date: toISODateString(record.date),
      punchIn: record.punchIn,
      currentStatus: record.workedStatus
    });
    setRequestedPunchOut("");
    setStatusReason("");
    setShowStatusModal(true);
  };

  const submitStatusCorrection = async () => {
    if (!requestedPunchOut || !statusReason) return alert("Please provide both time and reason.");
    try {
      await requestStatusCorrection({
        employeeId: user.employeeId,
        date: correctionData.date,
        requestedPunchOut: requestedPunchOut,
        reason: statusReason
      });
      alert("Request submitted successfully!");
      setShowStatusModal(false);
      loadData(user.employeeId);
    } catch (error) {
      alert(error.response?.data?.message || "Failed to submit request");
    }
  };

  const handleExport = () => {
    if (filteredData.length === 0) return alert("No data to export.");
    const monthName = barGraphData.labels[selectedDate.getMonth()];
    const fileName = `Attendance_${monthName}_${selectedDate.getFullYear()}_${user.name.replace(/\s+/g, '_')}.csv`;
    const headers = ["Date", "Day", "Punch In", "Punch Out", "Worked Hours", "Status", "Login Status", "Remarks"];
    const rows = filteredData.map(item => [
      toISODateString(item.date),
      new Date(item.date).toLocaleDateString('en-US', { weekday: 'short' }),
      item.punchIn ? new Date(item.punchIn).toLocaleTimeString() : "--",
      item.punchOut ? new Date(item.punchOut).toLocaleTimeString() : "--",
      item.displayTime,
      item.workedStatus,
      item.loginStatus,
      item.details || ""
    ].join(","));
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = fileName;
    link.click();
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 min-h-screen font-sans text-gray-800">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* --- Header Section --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Have a Great Day, {user?.name?.split(' ')[0] || "Employee"}!</h1>
            <p className="text-gray-500 text-sm mt-1">Here's Your attendance overview for {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-100">
            <select value={selectedDate.getMonth()} onChange={handleMonthChange} className="bg-transparent text-sm font-semibold outline-none cursor-pointer hover:text-blue-600">
              {barGraphData.labels.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={selectedDate.getFullYear()} onChange={handleYearChange} className="bg-transparent text-sm font-semibold outline-none cursor-pointer hover:text-blue-600 border-l pl-3">
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* --- Top Summary Cards --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <SummaryCard title="Present Days" count={summaryStats.presentDays} icon={<FaCheckCircle />} colorClass="text-green-600" bgClass="bg-green-100" />
          <SummaryCard title="Full Days" count={summaryStats.fullDays} icon={<FaBullseye />} colorClass="text-pink-600" bgClass="bg-pink-100" />
          <SummaryCard title="Half Days" count={summaryStats.halfDays} icon={<FaStarHalfAlt />} colorClass="text-yellow-600" bgClass="bg-yellow-100" />
          <SummaryCard title="Absent Days" count={summaryStats.absentDays} icon={<FaTimesCircle />} colorClass="text-red-600" bgClass="bg-red-100" />
          <SummaryCard title="On Time" count={summaryStats.onTimeCount} icon={<FaUserClock />} colorClass="text-blue-600" bgClass="bg-blue-100" />
          <SummaryCard title="Late Arrivals" count={summaryStats.lateCount} icon={<FaExclamationTriangle />} colorClass="text-orange-600" bgClass="bg-orange-100" />
        </div>

        {/* --- Middle Section: Today Status & Mini Calendar --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Today's Status (UPDATED UI & LIVE TIMER) */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-gray-800">Today's Status</h3>
              <p className="text-gray-400 text-xs mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Punch In */}
              <div className="bg-gray-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center hover:bg-green-50/50 transition-colors group">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-green-100 text-green-600 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                  <FaSignInAlt />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Punch In</p>
                <p className="text-lg md:text-xl font-bold text-gray-900 mt-1">
                  {todayRecord.punchIn ? new Date(todayRecord.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                </p>
              </div>

              {/* Punch Out */}
              <div className="bg-gray-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center hover:bg-blue-50/50 transition-colors group">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                  <FaSignOutAlt />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Punch Out</p>
                <p className="text-lg md:text-xl font-bold text-gray-900 mt-1">
                  {todayRecord.punchOut ? new Date(todayRecord.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "----"}
                </p>
              </div>

              {/* Working (Live Timer) */}
              <div className="bg-gray-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center hover:bg-blue-50/50 transition-colors group">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-500 text-white flex items-center justify-center text-xl mb-3 shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                  <FaHourglassHalf />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Working</p>
                <p className="text-lg md:text-xl font-bold text-gray-900 mt-1 font-mono">{liveTimer}</p>
              </div>

              {/* Target */}
              <div className="bg-gray-50 rounded-2xl p-4 md:p-6 flex flex-col items-center justify-center hover:bg-purple-50/50 transition-colors group">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">
                  <FaBullseye />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Target</p>
                <p className="text-lg md:text-xl font-bold text-gray-900 mt-1">
                  {shiftDetails?.fullDayHours || 9}h 00m
                </p>
              </div>
            </div>
          </div>

          {/* Right: Mini Calendar */}
          {/* Right: Mini Calendar */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                <span key={d} className="text-[10px] font-bold text-gray-400 uppercase">{d}</span>
              ))}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-7 gap-1 text-center flex-1">
              {(() => {
                const days = getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth());
                const startDay = days[0].getDay();
                const slots = [];

                for (let i = 0; i < startDay; i++) slots.push(<div key={`empty-${i}`} className="h-8"></div>);

                days.forEach(d => {
                  const dISO = toISODateString(d);
                  const data = processedCalendarData.find(p => toISODateString(p.date) === dISO);
                  let bg = "hover:bg-gray-100 text-gray-600";

                  if (toISODateString(new Date()) === dISO) bg = "bg-blue-600 text-white shadow-md font-bold";
                  else if (data?.workedStatus === 'Full Day') bg = "bg-green-100 text-green-700 font-semibold";
                  else if (data?.workedStatus === 'Absent') bg = "bg-red-50 text-red-500";
                  else if (data?.workedStatus === 'Half Day') bg = "bg-yellow-50 text-yellow-600";

                  slots.push(
                    <div key={dISO} className={`h-8 w-8 mx-auto flex items-center justify-center rounded-lg text-xs cursor-default transition-colors ${bg}`}>
                      {d.getDate()}
                    </div>
                  );
                });

                return slots;
              })()}
            </div>

            {/* ✅ LEGEND (NOW PART OF CARD) */}
            <div className="mt-4 pt-3 border-t flex flex-wrap gap-3 text-[11px] text-gray-600 justify-center">
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-600"></span> Today
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-green-100 border border-green-300"></span> Full Day
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-yellow-50 border border-yellow-300"></span> Half Day
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-red-50 border border-red-300"></span> Absent
              </div>
            </div>
          </div>

        </div>

        {/* --- Charts Section --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Monthly Donut */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
            <h3 className="text-gray-800 font-bold mb-4">Monthly Overview</h3>
            <div className="relative h-48 w-full flex-1">
              <Doughnut data={donutData} options={donutOptions} />
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pr-12 md:pr-16 lg:pr-12">
                <span className="text-3xl font-bold text-gray-800">{getDaysInMonth(selectedDate.getFullYear(), selectedDate.getMonth()).length}</span>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Days</span>
              </div>
            </div>
          </div>

          {/* Yearly Bar */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-800 font-bold">Yearly Overview - {selectedDate.getFullYear()}</h3>
              <div className="flex gap-4 text-xs">
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Present</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Absent</div>
              </div>
            </div>
            <div className="h-48 w-full">
              <Bar
                data={barGraphData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    x: { grid: { display: false }, border: { display: false } },
                    y: { display: true, border: { display: false }, grid: { borderDash: [4, 4] }, ticks: { stepSize: 5 } }
                  },
                  plugins: { legend: { display: false } }
                }}
              />
            </div>
          </div>
        </div>

        {/* --- Table Section (UPDATED: Scrollable with Indicator) --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-gray-800 text-lg">Attendance Records</h3>
              <p className="text-gray-400 text-xs mt-1">{selectedDate.toLocaleString('default', { month: 'long' })} {selectedDate.getFullYear()}</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-48"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button onClick={handleExport} className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-100 transition">
                <FaFileDownload /> <span className="hidden md:inline">Export CSV</span>
              </button>

              {/* Action Menu for History */}
              <div className="flex gap-1">
                <button
                  onClick={() => setShowRequestsModal(true)}
                  className="px-3 py-2 text-orange-600 bg-orange-50 rounded-lg hover:bg-orange-100 text-sm font-medium"
                >
                  Late Requests History
                </button>

                <button
                  onClick={() => setShowCorrectionHistoryModal(true)}
                  className="px-3 py-2 text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 text-sm font-medium"
                >
                  Attendence Correction History
                </button>

              </div>
            </div>
          </div>

          {/* Fixed Header */}
          <div className="border-b border-gray-100 bg-gray-50/50 pr-[6px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-400 uppercase font-bold">
                <tr>
                  {['Date', 'Check In', 'Check Out', 'Hours Worked', 'Status', 'Login Status', 'Day Type'].map((h, i) => (
                    <th key={i} className="px-6 py-4 font-semibold tracking-wider cursor-pointer hover:text-blue-600" onClick={() => requestSort(h.replace(' ', '').toLowerCase())}>
                      <div className="flex items-center gap-1">{h} {getSortIcon(h.replace(' ', '').toLowerCase())}</div>
                    </th>
                  ))}
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable Body */}
          <div className="relative group">
            <div
              ref={tableContainerRef}
              onScroll={handleScroll}
              className="max-h-[400px] overflow-y-auto"
              style={{ scrollbarWidth: 'thin' }}
            >
              <table className="w-full text-sm text-left">
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)
                  ) : filteredData.length > 0 ? (
                    filteredData.map((row) => {
                      const isWeekend = row.workedStatus === 'Week Off';
                      const isAbsent = row.workedStatus === 'Absent';
                      const isPending = row.statusCorrectionRequest?.hasRequest && row.statusCorrectionRequest?.status === 'PENDING';

                      return (
                        <tr key={row.date} className="hover:bg-gray-50/50 transition-colors group">
                          <td className="px-6 py-4 w-[14.2%]">
                            <p className="font-bold text-gray-700">{new Date(row.date).getDate()} {new Date(row.date).toLocaleString('default', { month: 'short', year: 'numeric' })}</p>
                            <p className="text-xs text-gray-400 hidden group-hover:block">{new Date(row.date).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                          </td>
                          <td className="px-6 py-4 w-[14.2%] font-medium text-gray-600">
                            {row.punchIn ? new Date(row.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--"}
                          </td>
                          <td className="px-6 py-4 w-[14.2%] font-medium text-gray-600">
                            {row.punchOut ? new Date(row.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--"}
                          </td>
                          <td className="px-6 py-4 w-[14.2%] font-bold text-gray-800">{row.displayTime}</td>
                          <td className="px-6 py-4 w-[14.2%]">
                            {row.workedStatus === "Working" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                                <FaRegClock className="animate-spin-slow" /> Working
                              </span>
                            ) : row.workedStatus === "Full Day" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600 border border-green-100">
                                <FaCheckCircle /> Completed
                              </span>
                            ) : isAbsent ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">
                                <FaTimesCircle /> Absent
                              </span>
                            ) : (
                              <span className="text-gray-500 font-medium">{row.workedStatus}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 w-[14.2%]">
                            {row.loginStatus === 'LATE' ? (
                              <span className="text-red-500 font-bold text-xs">Late</span>
                            ) : row.punchIn ? (
                              <span className="text-green-500 font-bold text-xs">On-Time</span>
                            ) : <span className="text-gray-300">--</span>}
                          </td>
                          <td className="px-6 py-4 w-[14.2%]">
                            <div className="flex items-center justify-between">
                              <span className={`px-3 py-1 rounded-md text-xs font-bold ${isWeekend ? "bg-gray-100 text-gray-500" :
                                  isAbsent ? "bg-red-50 text-red-500" :
                                    row.workedStatus === "Half Day" ? "bg-yellow-50 text-yellow-600" :
                                      "bg-blue-50 text-blue-600"
                                }`}>
                                {isWeekend ? "Weekend" : row.workedStatus === "Full Day" ? "Full Day" : row.workedStatus}
                              </span>

                              {/* Correction Action */}
                              {(row.punchIn && (isAbsent || row.workedStatus === 'Half Day') && !isPending) && (
                                <button onClick={() => openCorrectionModal(row)} className="text-gray-400 hover:text-blue-600 ml-2" title="Request Correction">
                                  <FaEdit />
                                </button>
                              )}
                              {isPending && <span className="text-[10px] text-orange-500 font-semibold ml-2">Pending</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan="7" className="text-center py-10 text-gray-400">No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Scroll Indicator */}
            {showScrollArrow && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur shadow-lg border border-gray-100 rounded-full p-2 text-blue-600 animate-bounce cursor-pointer z-10" onClick={() => tableContainerRef.current.scrollBy({ top: 100, behavior: 'smooth' })}>
                <FaChevronDown />
              </div>
            )}
          </div>
        </div>

        {/* --- MODALS (IMPROVED UI & DATA MAPPING) --- */}

        {/* Late Request History */}
        {showRequestsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 flex justify-between items-center text-white">
                <h3 className="text-lg font-bold flex items-center gap-2"><FaUserClock /> Late Requests History</h3>
                <button onClick={() => setShowRequestsModal(false)} className="hover:bg-white/20 p-2 rounded-full transition"><FaTimes /></button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="overflow-y-auto p-0 flex-1 bg-gray-50">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 text-xs uppercase sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Punch In</th>
                      <th className="px-6 py-4">Reason</th>
                      <th className="px-6 py-4">Admin Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {lateRequestsHistory.length > 0 ? (
                      lateRequestsHistory.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-bold text-gray-700">{new Date(row.date).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold border ${row.lateCorrectionRequest.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-200' :
                                row.lateCorrectionRequest.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
                                  'bg-yellow-50 text-yellow-600 border-yellow-200'
                              }`}>{row.lateCorrectionRequest.status}</span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">{row.punchIn ? new Date(row.punchIn).toLocaleTimeString() : '--'}</td>
                          <td className="px-6 py-4 max-w-xs truncate text-gray-500" title={row.lateCorrectionRequest.reason}>{row.lateCorrectionRequest.reason}</td>
                          <td className="px-6 py-4 italic text-gray-400">{row.lateCorrectionRequest.adminComment || "--"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="text-center py-12 text-gray-400">No late requests found in history.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Correction History */}
        {showCorrectionHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 flex justify-between items-center text-white">
                <h3 className="text-lg font-bold flex items-center gap-2"><FaHistory /> Attendance Correction Requests</h3>
                <button onClick={() => setShowCorrectionHistoryModal(false)} className="hover:bg-white/20 p-2 rounded-full transition"><FaTimes /></button>
              </div>

              <div className="overflow-y-auto p-0 flex-1 bg-gray-50">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 text-xs uppercase sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Correction Time</th>
                      <th className="px-6 py-4">Reason</th>
                      <th className="px-6 py-4">Admin Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {statusCorrectionHistory.length > 0 ? (
                      statusCorrectionHistory.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-6 py-4 font-bold text-gray-700">{new Date(row.date).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold border ${row.statusCorrectionRequest.status === 'APPROVED' ? 'bg-green-50 text-green-600 border-green-200' :
                                row.statusCorrectionRequest.status === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' :
                                  'bg-yellow-50 text-yellow-600 border-yellow-200'
                              }`}>{row.statusCorrectionRequest.status}</span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-blue-600 font-bold">{row.statusCorrectionRequest.requestedPunchOut}</td>
                          <td className="px-6 py-4 max-w-xs truncate text-gray-500" title={row.statusCorrectionRequest.reason}>{row.statusCorrectionRequest.reason}</td>
                          <td className="px-6 py-4 italic text-gray-400">{row.statusCorrectionRequest.adminComment || "--"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="5" className="text-center py-12 text-gray-400">No correction history found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Submit Correction Modal */}
        {showStatusModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fade-in-down">
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-lg font-bold text-gray-800">Request Status Correction</h3>
                <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600"><FaTimes /></button>
              </div>

              <p className="text-sm text-gray-600 mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                You are currently marked as <span className="font-bold text-red-500">{correctionData.currentStatus}</span> for <span className="font-bold text-gray-800">{new Date(correctionData.date).toLocaleDateString()}</span>.
                Please provide your correct punch-out time to request a Full Day.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Correct Punch Out Time</label>
                  <input
                    type="time"
                    value={requestedPunchOut}
                    onChange={(e) => setRequestedPunchOut(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Reason</label>
                  <textarea
                    rows="3"
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Explain discrepancy..."
                    className="w-full border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none resize-none transition bg-gray-50 focus:bg-white"
                  ></textarea>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button onClick={() => setShowStatusModal(false)} className="flex-1 px-4 py-3 rounded-xl text-gray-600 font-bold hover:bg-gray-100 transition">Cancel</button>
                <button onClick={submitStatusCorrection} className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition flex justify-center items-center gap-2">Submit <FaArrowRight /></button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default EmployeeDailyAttendance;