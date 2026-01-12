import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveAs } from "file-saver";
import { 
  getLeaveRequests, 
  getEmployees, 
  getHolidays, 
  getAttendanceByDateRange, 
  getAllShifts            
} from "../api";

// --- HELPER FUNCTIONS ---

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Robust Date Formatter (YYYY-MM-DD)
// Uses local time to ensure consistency with the loop generator
const formatDate = (dateInput) => {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateLeaveDays = (from, to) => {
  if (!from || !to) return 0;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  fromDate.setUTCHours(0, 0, 0, 0);
  toDate.setUTCHours(0, 0, 0, 0);
  const diffTime = Math.abs(toDate - fromDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays;
};

const getMonthsForYear = () => {
  const year = new Date().getFullYear();
  const options = [];
  for (let i = 0; i < 12; i++) {
    const month = String(i + 1).padStart(2, '0');
    options.push(`${year}-${month}`);
  }
  return options;
};

const getCurrentMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
};

const isDateInMonth = (dateStr, monthFilter) => {
  if (!dateStr || !monthFilter || monthFilter === "All") return true;
  const date = new Date(dateStr);
  const [year, month] = monthFilter.split("-");
  return (
    date.getFullYear() === parseInt(year) &&
    date.getMonth() + 1 === parseInt(month)
  );
};

const formatMonth = (monthStr) => {
  if (!monthStr || monthStr === "All") return "All Months";
  const [year, month] = monthStr.split("-");
  return `${new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  })} ${year}`;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr || dateStr === "-") return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const AdminLeaveSummary = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [holidays, setHolidays] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [employeeLeaveHistory, setEmployeeLeaveHistory] = useState([]);

  // Attendance & Shifts
  const [rawAttendance, setRawAttendance] = useState([]);
  const [shiftsMap, setShiftsMap] = useState({});

  const allMonths = useMemo(() => getMonthsForYear(), []);

  const fetchHolidays = async () => {
    try {
      const data = await getHolidays();
      // Only keep raw data, we will format inside the logic to ensure consistency
      setHolidays(data || []);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const year = new Date().getFullYear();
        const startOfYear = `${year}-01-01`;
        const todayStr = new Date().toISOString().split('T')[0];

        const [leaves, employees, attendanceData, shiftsData] = await Promise.all([
          getLeaveRequests(),
          getEmployees(),
          getAttendanceByDateRange(startOfYear, todayStr),
          getAllShifts()
        ]);

        setAllRequests(leaves);
        setRawAttendance(Array.isArray(attendanceData) ? attendanceData : []);

        // Filter only active employees (isActive !== false)
        const activeEmployees = employees.filter(emp => emp.isActive !== false);
        
        const empMap = new Map(
          activeEmployees.map((emp) => [emp.employeeId, emp.name])
        );
        setEmployeesMap(empMap);

        const sMap = {};
        if (Array.isArray(shiftsData)) {
            shiftsData.forEach(shift => {
                if (shift.employeeId) sMap[shift.employeeId] = shift;
            });
        } else if (shiftsData?.data) {
             shiftsData.data.forEach(shift => {
                if (shift.employeeId) sMap[shift.employeeId] = shift;
            });
        }
        setShiftsMap(sMap);

        await fetchHolidays();
      } catch (err) {
        console.error("Error fetching summary data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, []);

  const enrichedRequests = useMemo(
    () =>
      allRequests.map((req) => ({
        ...req,
        employeeName: employeesMap.get(req.employeeId) || "Unknown",
      })),
    [allRequests, employeesMap]
  );

  // --- CORE SANDWICH LOGIC ---
  const calculateSandwichData = (combinedLeaves, monthFilter) => {
    const activeLeaves = combinedLeaves.filter(
      (leave) =>
        (monthFilter === "All" ||
          isDateInMonth(leave.from, monthFilter) ||
          isDateInMonth(leave.to, monthFilter))
    );

    if (activeLeaves.length === 0 && holidays.length === 0) {
      return { count: 0, days: 0, details: [] };
    }

    const bookedMap = new Map();
    activeLeaves.forEach((leave) => {
      const isFullDay = !leave.halfDaySession;
      let curr = new Date(leave.from);
      const end = new Date(leave.to);
      while (curr <= end) {
        bookedMap.set(formatDate(curr), isFullDay);
        curr = addDays(curr, 1);
      }
    });

    let sandwichCount = 0;
    let sandwichDays = 0;
    const sandwichDetails = [];

    // Check Holiday Sandwiches using String Comparison
    holidays.forEach((holiday) => {
      // Use formatDate to get string YYYY-MM-DD
      const hStartStr = formatDate(holiday.startDate);
      const hEndStr = formatDate(holiday.endDate || holiday.startDate);

      // Check if holiday falls in selected month
      if (monthFilter !== "All" && !isDateInMonth(hStartStr, monthFilter)) return;

      const hStart = new Date(hStartStr);
      const hEnd = new Date(hEndStr);
      
      const dayBeforeStr = formatDate(addDays(hStart, -1));
      const dayAfterStr = formatDate(addDays(hEnd, 1));

      const beforeIsFull = bookedMap.get(dayBeforeStr) === true;
      const afterIsFull = bookedMap.get(dayAfterStr) === true;

      if (beforeIsFull && afterIsFull) {
        const duration = calculateLeaveDays(hStart, hEnd);
        sandwichCount++;
        sandwichDays += duration;
        sandwichDetails.push(
          `Holiday Sandwich: '${holiday.name}' (${hStartStr})`
        );
      }
    });

    // Check Weekend Sandwiches (Sat/Mon)
    for (const [dateStr, isFullDay] of bookedMap.entries()) {
      if (!isFullDay) continue;

      const d = new Date(dateStr);
      if (monthFilter !== "All" && !isDateInMonth(dateStr, monthFilter)) continue;

      if (d.getDay() === 6) { // Saturday
        const mondayStr = formatDate(addDays(d, 2));
        if (bookedMap.get(mondayStr) === true) {
          sandwichCount++;
          sandwichDays += 1;
          sandwichDetails.push(
            `Weekend Sandwich: Sat (${dateStr}) & Mon (${mondayStr})`
          );
        }
      }
    }

    return { count: sandwichCount, days: sandwichDays, details: sandwichDetails };
  };

  // --- STATS CALCULATION (Per Employee) ---
  const employeeStats = useMemo(() => {
    const uniqueEmployees = Array.from(employeesMap.entries());
    const today = new Date(); 
    today.setHours(0,0,0,0);

    return uniqueEmployees.map(([empId, empName]) => {
      const employeeLeaves = enrichedRequests.filter(
        (req) => req.employeeId === empId
      );

      const absents = [];
      const shift = shiftsMap[empId] || { weeklyOffDays: [0] }; 
      const weeklyOffs = shift.weeklyOffDays || [0];

      // Use Set of Strings for Punches
      const employeePunches = new Set(
        rawAttendance
          .filter(r => r.employeeId === empId && r.punchIn)
          .map(r => formatDate(r.date))
      );

      let loopStart, loopEnd;
      const currentYear = new Date().getFullYear();

      if (selectedMonth === "All") {
          loopStart = new Date(currentYear, 0, 1);
          loopEnd = new Date(); 
      } else {
          const [y, m] = selectedMonth.split('-');
          loopStart = new Date(parseInt(y), parseInt(m) - 1, 1);
          loopEnd = new Date(parseInt(y), parseInt(m), 0);
          if (loopEnd > today) loopEnd = new Date(); 
      }

      const appliedLeaveDates = new Set();
      employeeLeaves.forEach(l => {
          if(l.status === 'Approved' || l.status === 'Pending') {
              let c = new Date(l.from);
              const e = new Date(l.to);
              while(c <= e) {
                  appliedLeaveDates.add(formatDate(c));
                  c = addDays(c, 1);
              }
          }
      });

      // Loop through dates
      for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
          const dateStr = formatDate(d); // YYYY-MM-DD
          const dayOfWeek = d.getDay();

          // ✅ FIXED HOLIDAY CHECK: String Comparison
          const isHol = holidays.some(h => {
             const startStr = formatDate(h.startDate);
             const endStr = formatDate(h.endDate || h.startDate);
             return dateStr >= startStr && dateStr <= endStr;
          });

          if (isHol) continue; // It's a holiday, don't mark absent
          if (weeklyOffs.includes(dayOfWeek)) continue; // Weekly off
          if (employeePunches.has(dateStr)) continue; // Present
          if (appliedLeaveDates.has(dateStr)) continue; // Applied Leave

          absents.push({
              _id: `absent-${empId}-${dateStr}`,
              from: dateStr,
              to: dateStr,
              status: "Approved", 
              leaveType: "Absent (System)",
              reason: "Not Logged In",
              isAbsentRecord: true
          });
      }

      const approvedLeavesOnly = employeeLeaves.filter(
        (leave) => leave.status === "Approved"
      );
      
      const leavesInMonth = approvedLeavesOnly.filter(
          (leave) =>
            selectedMonth === "All" ||
            isDateInMonth(leave.from, selectedMonth) ||
            isDateInMonth(leave.to, selectedMonth)
      );

      // Combine for Sandwich Calculation
      const combinedForStats = [...leavesInMonth, ...absents];

      const normalLeaveDays = leavesInMonth.reduce(
        (total, leave) => total + calculateLeaveDays(leave.from, leave.to),
        0
      );

      const absentDaysCount = absents.length;
      
      // Calculate sandwich using mixed list (leaves + absents)
      const sandwichData = calculateSandwichData([...approvedLeavesOnly, ...absents], selectedMonth);

      const totalConsumed = normalLeaveDays + absentDaysCount + sandwichData.days;
      
      const monthlyCredit = 1;
      const pendingLeaves = Math.max(0, monthlyCredit - totalConsumed);
      const extraLeaves = Math.max(0, totalConsumed - monthlyCredit);

      return {
        employeeId: empId,
        employeeName: empName,
        pendingLeaves,
        totalLeaveDays: totalConsumed,
        normalLeaveDays, 
        absentDays: absentDaysCount, 
        extraLeaves,
        sandwichLeavesCount: sandwichData.count,
        sandwichLeavesDays: sandwichData.days,
        sandwichDetails: sandwichData.details,
        rawLeaves: employeeLeaves,
        rawAbsents: absents 
      };
    });
  }, [enrichedRequests, employeesMap, selectedMonth, holidays, rawAttendance, shiftsMap]);

  const filteredEmployeeStats = useMemo(() => {
    let filtered = [...employeeStats];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (emp) =>
          emp.employeeId.toLowerCase().includes(query) ||
          emp.employeeName.toLowerCase().includes(query)
      );
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (typeof aVal === "string") {
          return sortConfig.direction === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        return sortConfig.direction === "asc" ? aVal - bVal : bVal - aVal;
      });
    }

    return filtered;
  }, [employeeStats, searchQuery, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction:
        prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const exportEmployeeStatsCSV = () => {
    const headers = [
      "Employee ID",
      "Employee Name",
      "Pending Leaves",
      "Total Leave Days",
      "Applied Leaves",
      "Absent Days", 
      "Extra Leaves (LOP)",
      "Sandwich Count",
      "Sandwich Days",
    ];
    const rows = filteredEmployeeStats.map((emp) =>
      [
        emp.employeeId,
        `"${emp.employeeName}"`,
        emp.pendingLeaves,
        emp.totalLeaveDays,
        emp.normalLeaveDays,
        emp.absentDays,
        emp.extraLeaves,
        emp.sandwichLeavesCount,
        emp.sandwichLeavesDays,
      ].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    saveAs(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `employee_leave_stats_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const handleViewDetails = (employeeId) => {
    const empStats = employeeStats.find((emp) => emp.employeeId === employeeId);
    if(!empStats) return;

    const leaves = empStats.rawLeaves.filter(
        (req) =>
          selectedMonth === "All" ||
          isDateInMonth(req.from, selectedMonth) ||
          isDateInMonth(req.to, selectedMonth)
    );
    
    const mergedHistory = [...leaves, ...empStats.rawAbsents].sort(
      (a, b) =>
        new Date(b.from) - new Date(a.from)
    );

    setEmployeeLeaveHistory(mergedHistory);
    setSelectedEmployee(empStats);
    setShowDetailsModal(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-blue-800 font-semibold text-lg">
            Loading employee data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                📊 Employee Leave Statistics
              </h1>
              <p className="text-gray-600">
                Comprehensive overview including Leaves and Absents..
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportEmployeeStatsCSV}
              disabled={filteredEmployeeStats.length === 0}
              className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold px-8 py-3 rounded-xl shadow-lg transition duration-200 mt-4 lg:mt-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📥 Export to CSV
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔍 Search Employees
              </label>
              <input
                type="text"
                placeholder="Search by ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                📅 Filter by Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition duration-200"
              >
                <option value="All">All Months</option>
                {allMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(searchQuery || selectedMonth !== "All") && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing {filteredEmployeeStats.length} active employee
                {filteredEmployeeStats.length !== 1 ? "s" : ""}
                {selectedMonth !== "All" &&
                  ` for ${formatMonth(selectedMonth)}`}
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedMonth("All");
                  setSortConfig({ key: null, direction: "asc" });
                }}
                className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
              >
                Clear Filters
              </button>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-xl font-bold text-gray-900">
              Employee Leave Details...
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Includes Applied Leaves + Unplanned Absents
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleSort("employeeId")}
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    ID
                  </th>
                  <th
                    onClick={() => handleSort("employeeName")}
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    Name
                  </th>
                  <th
                    onClick={() => handleSort("pendingLeaves")}
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    Pending
                  </th>
                  <th
                    onClick={() => handleSort("totalLeaveDays")}
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    Total Days
                  </th>
                  <th
                    onClick={() => handleSort("extraLeaves")}
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    Extra (LOP)
                  </th>
                  <th
                    onClick={() => handleSort("sandwichLeavesDays")}
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    Sandwich Days
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <AnimatePresence>
                  {filteredEmployeeStats.length > 0 ? (
                    filteredEmployeeStats.map((emp, index) => (
                      <motion.tr
                        key={emp.employeeId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-blue-50 transition duration-150"
                      >
                        <td className="px-6 py-4 text-sm font-bold text-gray-900">{emp.employeeId}</td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{emp.employeeName}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full font-bold text-sm shadow-sm ${emp.pendingLeaves === 0 ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}`}>
                            {emp.pendingLeaves}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full bg-green-100 text-green-800 font-bold text-sm shadow-sm">
                              {emp.totalLeaveDays}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-1 whitespace-nowrap">
                              {emp.normalLeaveDays} Applied + {emp.absentDays} Absent + {emp.sandwichLeavesDays} SW
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full font-bold text-sm shadow-sm ${
                              emp.extraLeaves > 0
                                ? "bg-orange-100 text-orange-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {emp.extraLeaves}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full font-bold text-sm shadow-sm ${
                              emp.sandwichLeavesDays > 0
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {emp.sandwichLeavesDays}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleViewDetails(emp.employeeId)}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg transition duration-200 text-sm"
                          >
                            View Details
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                         No active employees found
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">
              📋 Legend:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600">
              <div className="flex items-center">
                <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                <span>
                  <strong>Pending:</strong> 1 (Credit) - (Applied + Absent + Sandwich).
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                <span>
                  <strong>Total Days:</strong> Sum of Approved Leaves, Unplanned Absents, and Sandwich Days.
                </span>
              </div>
              <div className="flex items-center">
                 <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                 <span><strong>Absent:</strong> Working days with no punch and no leave request.</span>
              </div>
            </div>
          </div>
        </motion.div>

        <AnimatePresence>
          {showDetailsModal && selectedEmployee && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowDetailsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-white">
                      <h3 className="text-2xl font-bold">Leave & Absent History</h3>
                      <p className="text-blue-100 text-sm mt-1">
                        {selectedEmployee.employeeName} (
                        {selectedEmployee.employeeId})
                      </p>
                    </div>
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="text-white hover:text-gray-200 text-3xl font-bold transition"
                    >
                      ×
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                  <div className="grid grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        {selectedEmployee.pendingLeaves}
                      </p>
                      <p className="text-xs text-gray-600">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {selectedEmployee.totalLeaveDays}
                      </p>
                      <p className="text-xs text-gray-600">Total Consumed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {selectedEmployee.extraLeaves}
                      </p>
                      <p className="text-xs text-gray-600">Extra (LOP)</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-500">
                        {selectedEmployee.absentDays}
                      </p>
                      <p className="text-xs text-gray-600">Unplanned Absent</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {selectedEmployee.sandwichLeavesDays}
                      </p>
                      <p className="text-xs text-gray-600">Sandwich Days</p>
                    </div>
                  </div>
                </div>

                <div className="overflow-y-auto max-h-[60vh] p-6">
                   {selectedEmployee.sandwichDetails && selectedEmployee.sandwichDetails.length > 0 && (
                      <div className="mb-6 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
                        <div className="flex items-start">
                          <span className="text-orange-600 text-xl mr-2">🥪</span>
                          <div className="flex-1">
                            <p className="font-semibold text-orange-800 mb-2">
                              Sandwich Leaves Detected
                            </p>
                            {selectedEmployee.sandwichDetails.map(
                              (reason, idx) => (
                                <p key={idx} className="text-sm text-orange-700 mb-1">
                                  • {reason}
                                </p>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {employeeLeaveHistory.length > 0 ? (
                    <div className="space-y-4">
                      {employeeLeaveHistory.map((leave, index) => {
                          const isAbsentRecord = leave.isAbsentRecord;
                          return (
                            <motion.div
                              key={leave._id || index}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.05 }}
                              className={`border rounded-xl p-5 hover:shadow-lg transition duration-200 ${
                                  isAbsentRecord ? "bg-red-50 border-red-200" : "bg-white border-gray-200"
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="text-lg font-bold text-gray-900">
                                      {formatDisplayDate(leave.from)}
                                      {leave.from !== leave.to && (
                                          <>
                                            <span className="mx-2 text-gray-400">→</span>
                                            {formatDisplayDate(leave.to)}
                                          </>
                                      )}
                                    </span>
                                    {isAbsentRecord ? (
                                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                                            ABSENT (No Punch)
                                        </span>
                                    ) : (
                                        <span
                                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                            leave.status === "Approved"
                                              ? "bg-green-100 text-green-800"
                                              : leave.status === "Rejected"
                                              ? "bg-red-100 text-red-800"
                                              : leave.status === "Pending"
                                              ? "bg-yellow-100 text-yellow-800"
                                              : "bg-gray-100 text-gray-800"
                                          }`}
                                        >
                                          {leave.status}
                                        </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-600 font-semibold">Type:</p>
                                      <p className="text-gray-900">{leave.leaveType || "Absent"}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-600 font-semibold">
                                        {isAbsentRecord ? "Detected Date:" : "Applied Date:"}
                                      </p>
                                      <p className="text-gray-900">
                                        {formatDisplayDate(leave.requestDate || leave.createdAt || leave.from)}
                                      </p>
                                    </div>
                                    <div className="col-span-2">
                                      <p className="text-gray-600 font-semibold">Reason:</p>
                                      <p className="text-gray-900 italic">
                                        "{leave.reason || "System marked as absent due to missing punch"}"
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg font-semibold mb-2">No records found</p>
                    </div>
                  )}
                </div>
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="bg-gray-600 hover:bg-gray-700 text-white font-semibold px-6 py-2 rounded-lg transition duration-200"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminLeaveSummary;