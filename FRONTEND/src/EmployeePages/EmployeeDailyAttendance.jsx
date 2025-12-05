// --- START OF FILE EmployeeDailyAttendance.jsx ---

import React, { useContext, useEffect, useState, useMemo, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
// UPDATED: Import getShiftByEmployeeId to fetch specific user settings instead of getAllShifts
import { getAttendanceForEmployee, getShiftByEmployeeId } from "../api";

// --- Import Chart.js and React wrapper ---
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
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
  FaCalendarCheck,
  FaUserClock,
  FaExclamationTriangle,
  FaBusinessTime,
  FaStarHalfAlt,
  FaTimesCircle,
  FaFilter
} from "react-icons/fa";

// --- Register Chart.js components ---
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// ==========================================
// HELPER FUNCTIONS (MATCHING DASHBOARD LOGIC)
// ==========================================

const getWorkedStatus = (punchIn, punchOut, apiStatus, fullDayThreshold, halfDayThreshold) => {
  const statusUpper = (apiStatus || "").toUpperCase();
  
  // 1. Check API Status for Leaves/Holidays first
  if (statusUpper === "LEAVE") return "Leave";
  if (statusUpper === "HOLIDAY") return "Holiday";
  // If explicitly marked ABSENT by system/admin and no punch in exists
  if (statusUpper === "ABSENT" && !punchIn) return "Absent";

  // 2. Check for currently working
  if (punchIn && !punchOut) return "Working..";

  // 3. If no punches and not leave/holiday
  if (!punchIn) return "Absent";

  // 4. Calculate Worked Hours
  // Handle case where punchOut is missing (should be covered by "Working.." but safety check)
  const end = punchOut ? new Date(punchOut) : new Date();
  const start = new Date(punchIn);
  const workedMilliseconds = end - start;
  const workedHours = workedMilliseconds / (1000 * 60 * 60);

  // 5. Determine Status based on Admin Assigned Hours
  // Using >= to match Dashboard logic exactly
  if (workedHours >= fullDayThreshold) return "Full Day";
  if (workedHours >= halfDayThreshold) return "Half Day";
  
  return "Absent"; // Worked less than half day threshold
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

// A skeleton component for a better loading state UI
const TableRowSkeleton = () => (
  <tr className="animate-pulse">
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/4"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-3/4"></div></td>
    <td className="px-4 py-4"><div className="h-6 bg-gray-200 rounded-full w-20"></div></td>
    <td className="px-4 py-4"><div className="h-4 bg-gray-200 rounded w-1/2"></div></td>
  </tr>
);

const EmployeeDailyAttendance = () => {
  const { user } = useContext(AuthContext);
  const [attendance, setAttendance] = useState([]);
  const [shiftDetails, setShiftDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'descending' });

  // --- Fetch Data ---
  const loadData = useCallback(async (empId) => {
    setLoading(true);
    
    try {
      // UPDATED: Fetch specific shift details using the correct API endpoint
      // This prevents 403 errors and ensures we get the actual assigned hours
      const [attendanceRes, shiftRes] = await Promise.all([
        getAttendanceForEmployee(empId),
        getShiftByEmployeeId(empId).catch(err => {
            console.warn("Failed to fetch specific shift, using defaults", err);
            return null;
        })
      ]);

      const attendanceData = Array.isArray(attendanceRes) ? attendanceRes : (attendanceRes.data || []);
      setAttendance(attendanceData);
      setShiftDetails(shiftRes);

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
    if (attendance.length === 0) return [new Date().getFullYear()];
    const years = new Set(attendance.map(a => new Date(a.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [attendance]);

  // --- Process Attendance Data (Apply Admin Assigned Hours Logic) ---
  const processedAttendance = useMemo(() => {
    // UPDATED: Get Admin Assigned Hours (Defaults: Full=9, Half=4.5)
    // This matches the logic in EmployeeDashboard.jsx exactly
    const adminFullDayHours = shiftDetails?.fullDayHours || 9;
    const adminHalfDayHours = shiftDetails?.halfDayHours || 4.5;

    return attendance.map(record => {
      // Calculate Statuses dynamically based on Admin Settings
      const dynamicWorkedStatus = getWorkedStatus(
        record.punchIn, 
        record.punchOut, 
        record.status, 
        adminFullDayHours, 
        adminHalfDayHours
      );
      
      const dynamicLoginStatus = calculateLoginStatus(record.punchIn, shiftDetails, record.loginStatus);

      return {
        ...record,
        workedStatus: dynamicWorkedStatus, // Calculated based on configured hours
        loginStatus: dynamicLoginStatus,
      };
    });
  }, [attendance, shiftDetails]);

  // --- Filter & Sort Data ---
  const monthlyFilteredAttendance = useMemo(() => {
    let data = processedAttendance.filter(item => {
      const recordDate = new Date(item.date);
      return recordDate.getFullYear() === selectedDate.getFullYear() &&
        recordDate.getMonth() === selectedDate.getMonth();
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
  }, [processedAttendance, selectedDate, searchTerm, sortConfig]);

  // --- Calculate Stats (Based on Processed Data) ---
  const summaryStats = useMemo(() => {
    const data = monthlyFilteredAttendance;

    const presentDays = data.filter(r => r.punchIn).length;
    
    // Statuses derived from processedAttendance logic
    const fullDays = data.filter(r => r.workedStatus === 'Full Day').length;
    const halfDays = data.filter(r => r.workedStatus === 'Half Day').length;
    
    const leaveDays = data.filter(r => r.workedStatus === 'Leave' || r.workedStatus === 'Holiday').length;
    
    // Absent includes explicit "Absent" string or logic fallbacks
    const absentDays = data.filter(r => r.workedStatus === "Absent" || (r.status === 'ABSENT' && !r.punchIn)).length;

    const lateCount = data.filter(a => a.loginStatus === 'LATE').length;
    const onTimeCount = data.filter(a => a.loginStatus === 'ON_TIME').length;

    return {
      presentDays,
      fullDays,
      halfDays,
      leaveDays,
      absentDays,
      onTimeCount,
      lateCount
    };
  }, [monthlyFilteredAttendance]);

  // --- Chart Data ---
  const graphData = useMemo(() => {
    const monthlyCounts = Array(12).fill(0);
    processedAttendance.forEach(a => {
      const recordDate = new Date(a.date);
      // Count as present if punchIn exists
      if (recordDate.getFullYear() === selectedDate.getFullYear() && a.punchIn) {
        monthlyCounts[recordDate.getMonth()] += 1;
      }
    });

    return {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [{
        label: `Present Days in ${selectedDate.getFullYear()}`,
        data: monthlyCounts,
        backgroundColor: context => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;

          const isSelectedMonth = context.dataIndex === selectedDate.getMonth();
          const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);

          if (isSelectedMonth) {
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.7)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 1)');
          } else {
            gradient.addColorStop(0, 'rgba(165, 207, 255, 0.6)');
            gradient.addColorStop(1, 'rgba(165, 207, 255, 1)');
          }
          return gradient;
        },
        borderRadius: 6,
        borderWidth: 0,
        barThickness: 15,
      }]
    };
  }, [processedAttendance, selectedDate]);

  const graphOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: '#111827',
        titleColor: '#ffffff',
        bodyColor: '#e5e7eb',
        borderColor: '#374151',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => `${context.raw} present day(s)`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: '#6b7280' },
        grid: { color: '#e5e7eb', borderDash: [3, 4] },
        border: { display: false },
      },
      x: {
        ticks: { color: '#6b7280' },
        grid: { display: false },
        border: { display: false },
      }
    }
  };

  const handleYearChange = (e) => setSelectedDate(new Date(parseInt(e.target.value), selectedDate.getMonth()));
  const handleMonthChange = (e) => setSelectedDate(new Date(selectedDate.getFullYear(), parseInt(e.target.value)));
  const requestSort = (key) => setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'ascending' ? 'descending' : 'ascending' }));
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <FaSort className="text-gray-400" />;
    return sortConfig.direction === 'ascending' ? <FaSortUp className="text-blue-600" /> : <FaSortDown className="text-blue-600" />;
  };

  // --- UI Components ---
  const StatCard = ({ icon, title, value, colorClass }) => (
    <div className="flex-1 p-4 bg-white rounded-xl shadow-md flex items-center gap-4 transition-transform transform hover:scale-105">
      <div className={`p-3 rounded-full ${colorClass}`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );

  const WorkedStatusItem = ({ icon, title, value, iconColorClass }) => (
    <div className="flex items-center gap-4 transition-all duration-200 p-2 rounded-lg hover:bg-gray-50">
      {React.cloneElement(icon, { className: `text-3xl flex-shrink-0 ${iconColorClass}` })}
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center mb-6 gap-3">
          <FaRegClock className="text-blue-600 text-3xl" />
          <h1 className="font-bold text-3xl text-gray-800">Your Attendance History</h1>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-4 mb-6 flex flex-col md:flex-row items-center gap-4 md:gap-6">
          <div className="flex items-center gap-2 text-gray-700 font-semibold">
            <FaFilter />
            <span>Filter by Period</span>
          </div>
          <div className="w-full md:w-auto">
            <select id="year-select" value={selectedDate.getFullYear()} onChange={handleYearChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className="w-full md:w-auto">
            <select id="month-select" value={selectedDate.getMonth()} onChange={handleMonthChange} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
              {graphData.labels.map((month, index) => <option key={index} value={index}>{month}</option>)}
            </select>
          </div>
        </div>

        {/* Stats & Chart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
          {/* Summary Column */}
          <div className="lg:col-span-2 p-6 bg-white rounded-xl shadow-md flex flex-col justify-center">
            <h3 className="font-semibold text-lg mb-6 text-gray-800">Monthly Summary</h3>
            <div className="space-y-4">
              <WorkedStatusItem
                icon={<FaBusinessTime />}
                title="Full Days"
                value={summaryStats.fullDays}
                iconColorClass="text-green-500"
              />
              <WorkedStatusItem
                icon={<FaStarHalfAlt />}
                title="Half Days"
                value={summaryStats.halfDays}
                iconColorClass="text-yellow-500"
              />
               <WorkedStatusItem
                icon={<FaTimesCircle />}
                title="Absent"
                value={summaryStats.absentDays}
                iconColorClass="text-red-500"
              />
            </div>
          </div>

          {/* Graph Column */}
          <div className="lg:col-span-3 p-4 bg-white rounded-xl shadow-md">
            <h3 className="font-semibold text-lg mb-2 text-gray-800">Yearly Overview - {selectedDate.getFullYear()}</h3>
            <div className="relative h-64">
              <Bar options={graphOptions} data={graphData} />
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatCard icon={<FaCalendarCheck className="text-white" />} title={`Present Days (${graphData.labels[selectedDate.getMonth()]})`} value={summaryStats.presentDays} colorClass="bg-blue-500" />
          <StatCard icon={<FaUserClock className="text-white" />} title="On Time Arrivals" value={summaryStats.onTimeCount} colorClass="bg-green-500" />
          <StatCard icon={<FaExclamationTriangle className="text-white" />} title="Late Arrivals" value={summaryStats.lateCount} colorClass="bg-red-500" />
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-md">
          <div className="p-4 border-b border-gray-200">
            <div className="relative">
              <FaSearch className="absolute top-1/2 left-4 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder={`Search in records for ${graphData.labels[selectedDate.getMonth()]}...`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100/60">
                <tr className="text-gray-600 uppercase">
                  {['date', 'in', 'out', 'worked', 'status', 'login Status', 'worked status'].map(header => (
                    <th key={header} className="px-4 py-3 text-left" onClick={() => requestSort(header.replace(/\s+/g, '').toLowerCase())}>
                      <div className="flex items-center gap-2 cursor-pointer select-none">
                        <span>{header}</span>
                        {getSortIcon(header.replace(/\s+/g, '').toLowerCase())}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
                ) : monthlyFilteredAttendance.length > 0 ? (
                  monthlyFilteredAttendance.map((a) => {
                    // Styling logic based on calculated status
                    const isAbsent = a.workedStatus === 'Absent' || (a.status === 'ABSENT' && !a.punchIn);
                    const isLeave = a.workedStatus === 'Leave' || a.workedStatus === 'Holiday';
                    const isHalfDay = a.workedStatus === 'Half Day';

                    return (
                      <tr key={a.date} className={`text-gray-800 hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100 last:border-b-0 
                        ${isAbsent ? "bg-red-50/30" : isLeave ? "bg-orange-50/30" : isHalfDay ? "bg-yellow-50/30" : ""}`}>
                        <td className="px-4 py-3 font-medium text-left whitespace-nowrap">
                          {(() => {
                            const d = new Date(a.date);
                            const day = String(d.getDate()).padStart(2, '0');
                            const month = String(d.getMonth() + 1).padStart(2, '0');
                            const year = d.getFullYear();
                            return `${day}-${month}-${year}`;
                          })()}
                        </td>
                        <td className="px-4 py-3 text-left whitespace-nowrap text-green-600 font-medium">{a.punchIn ? new Date(a.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-gray-400">--</span>}</td>
                        <td className="px-4 py-3 text-left whitespace-nowrap text-red-600 font-medium">{a.punchOut ? new Date(a.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-gray-400">--</span>}</td>
                        <td className="px-4 py-3 font-mono text-left whitespace-nowrap text-gray-700">{a.displayTime || <span className="text-gray-400">00:00</span>}</td>
                        <td className="px-4 py-3 text-left whitespace-nowrap">{a.status}</td>
                        <td className="px-4 py-3 text-left whitespace-nowrap">
                          {a.punchIn ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${a.loginStatus === "LATE" ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                              <span className={`h-2 w-2 rounded-full ${a.loginStatus === "LATE" ? "bg-red-500" : "bg-green-500"}`}></span>
                              {a.loginStatus === "LATE" ? "Late" : "On Time"}
                            </span>
                          ) : <span className="text-gray-400">--</span>}
                        </td>
                        <td className="px-4 py-3 capitalize text-left whitespace-nowrap font-medium">
                          <span className={
                            isAbsent ? "text-red-600" :
                            isLeave ? "text-orange-600" :
                            a.workedStatus === "Half Day" ? "text-yellow-600" :
                            a.workedStatus === "Full Day" ? "text-green-600" : "text-gray-600"
                          }>
                            {a.workedStatus}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr><td colSpan="7" className="text-center py-16 text-gray-500">
                    <p className="font-semibold text-lg">No Records Found</p>
                    <p className="text-sm mt-1">No attendance data is available for the selected period.</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDailyAttendance;