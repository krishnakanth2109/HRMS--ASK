import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveAs } from "file-saver";
import {
  FaSearch, FaFileDownload, FaEye, FaTimes,
  FaCalendarAlt, FaFilter, FaUserTie, FaExclamationTriangle
} from "react-icons/fa";
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

// New specific filter check logic
const isDateInFilter = (dateStr, yearFilter, monthFilter) => {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  const y = date.getFullYear().toString();
  const m = String(date.getMonth() + 1).padStart(2, '0');

  if (yearFilter === "All") return true;
  if (yearFilter === y && monthFilter === "All") return true;
  return yearFilter === y && monthFilter === m;
};

// Optimization: Use a simpler formatter for internal logic to avoid locale overhead
const formatYYYYMMDD = (date) => {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`;
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr || dateStr === "-") return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const MONTH_OPTIONS = [
  { value: "01", label: "January" },
  { value: "02", label: "February" },
  { value: "03", label: "March" },
  { value: "04", label: "April" },
  { value: "05", label: "May" },
  { value: "06", label: "June" },
  { value: "07", label: "July" },
  { value: "08", label: "August" },
  { value: "09", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

const AdminLeaveSummary = () => {
  const [allRequests, setAllRequests] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [holidays, setHolidays] = useState([]);

  // NEW: Separated Year and Month state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));

  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [employeeLeaveHistory, setEmployeeLeaveHistory] = useState([]);

  // Attendance & Shifts
  const [rawAttendance, setRawAttendance] = useState([]);
  const [shiftsMap, setShiftsMap] = useState({});

  const fetchHolidays = async () => {
    try {
      const data = await getHolidays();
      setHolidays(data || []);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };

  // 1. Initial data fetch for static/base data (Employees, Shifts)
  useEffect(() => {
    const fetchBaseData = async () => {
      try {
        const [employees, shiftsData] = await Promise.all([
          getEmployees(),
          getAllShifts()
        ]);

        const activeEmployees = employees.filter(emp => emp.isActive !== false);
        const empMap = new Map(activeEmployees.map((emp) => [
          emp.employeeId,
          { name: emp.name, joiningDate: emp.joiningDate }
        ]));
        setEmployeesMap(empMap);

        const sMap = {};
        const dataArr = Array.isArray(shiftsData) ? shiftsData : (shiftsData?.data || []);
        dataArr.forEach(shift => {
          if (shift.employeeId) sMap[shift.employeeId] = shift;
        });
        setShiftsMap(sMap);

        await fetchHolidays();
      } catch (err) {
        console.error("Error fetching base data:", err);
      }
    };
    fetchBaseData();
  }, []);

  // 2. Fetch attendance/leaves only when year changes


  // Outside the component — survives re-renders, cleared only on full unmount
  const yearCache = useRef({});

  useEffect(() => {
    if (!selectedYear) return;

    // ── Opt 3: AbortController — cancel stale requests when year changes ──
    const controller = new AbortController();
    const signal = controller.signal;

    const fetchYearData = async () => {
      // ── Opt 2: Cache hit — skip the network entirely ──────────────────
      if (yearCache.current[selectedYear]) {
        const { leaves, attendance } = yearCache.current[selectedYear];
        setAllRequests(leaves);
        setRawAttendance(attendance);
        return;
      }
      setIsLoading(false);
      try {
        setIsLoading(true);
        setError(null); // ── Opt 4: clear previous error on new attempt ──

        const startRange = `${selectedYear}-01-01`;
        const endRange = `${selectedYear}-12-31`;

        const [leaves, attendanceData] = await Promise.all([
          getLeaveRequests({ signal }),
          getAttendanceByDateRange(startRange, endRange, { signal }),
        ]);

        // ── Opt 3: Don't touch state if this effect was already cleaned up
        if (signal.aborted) return;

        const attendance = Array.isArray(attendanceData) ? attendanceData : [];

        // ── Opt 2: Store result in cache for instant re-visits ────────────
        yearCache.current[selectedYear] = { leaves, attendance };

        // ── Opt 1: startTransition — one render instead of two ───────────
        React.startTransition(() => {
          setAllRequests(leaves);
          setRawAttendance(attendance);
        });

      } catch (err) {
        if (err.name === "AbortError") return; // expected, not an error
        console.error("Error fetching year data:", err);
        setError(err.message); // ── Opt 4: surface it so the UI can show it
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    };

    fetchYearData();

    // ── Cleanup: abort in-flight request if selectedYear changes ─────────
    return () => controller.abort();
  }, [selectedYear]);

  // useEffect(() => {
  //   const fetchYearData = async () => {
  //     if (!selectedYear) return;
  //     try {
  //       setIsLoading(true);
  //       const startRange = `${selectedYear}-01-01`;
  //       const endRange = `${selectedYear}-12-31`;

  //       const [leaves, attendanceData] = await Promise.all([
  //         getLeaveRequests(), // Ideally this would also be filtered by year on backend
  //         getAttendanceByDateRange(startRange, endRange)
  //       ]);

  //       setAllRequests(leaves);
  //       setRawAttendance(Array.isArray(attendanceData) ? attendanceData : []);
  //     } catch (err) {
  //       console.error("Error fetching year-specific data:", err);
  //     } finally {
  //       setIsLoading(false);
  //     }
  //   };

  //   fetchYearData();
  // }, [selectedYear]);

  // Generate last 5 years only
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = 0; i < 5; i++) {
      years.push((currentYear - i).toString());
    }
    return years;
  }, []);

  const enrichedRequests = useMemo(
    () =>
      allRequests.map((req) => ({
        ...req,
        employeeName: employeesMap.get(req.employeeId)?.name || "Unknown",
      })), [allRequests, employeesMap]
  );

  // --- CORE SANDWICH LOGIC ---
  // Optimized Sandwich Logic (O(L + H))
  const calculateSandwichData = (combinedLeaves, yearFilter, monthFilter, currentHolidays) => {
    const bookedMap = new Map();
    const activeLeaves = [];

    // 1. Single pass to filter and map
    combinedLeaves.forEach((leave) => {
      if (isDateInFilter(leave.from, yearFilter, monthFilter) || isDateInFilter(leave.to, yearFilter, monthFilter)) {
        activeLeaves.push(leave);
        const isFullDay = !leave.halfDaySession;
        let curr = new Date(leave.from);
        const end = new Date(leave.to);
        while (curr <= end) {
          bookedMap.set(formatYYYYMMDD(curr), isFullDay);
          curr.setDate(curr.getDate() + 1);
        }
      }
    });

    if (activeLeaves.length === 0 && currentHolidays.length === 0) {
      return { count: 0, days: 0, details: [] };
    }

    let sandwichCount = 0;
    let sandwichDays = 0;
    const sandwichDetails = [];

    // 2. Optimized Holiday Check
    currentHolidays.forEach((holiday) => {
      const hStartStr = formatYYYYMMDD(new Date(holiday.startDate));
      if (!isDateInFilter(hStartStr, yearFilter, monthFilter)) return;

      const hStart = new Date(holiday.startDate);
      const hEnd = holiday.endDate ? new Date(holiday.endDate) : new Date(holiday.startDate);

      const dayBefore = new Date(hStart);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(hEnd);
      dayAfter.setDate(dayAfter.getDate() + 1);

      if (bookedMap.get(formatYYYYMMDD(dayBefore)) === true && bookedMap.get(formatYYYYMMDD(dayAfter)) === true) {
        const duration = calculateLeaveDays(hStart, hEnd);
        sandwichCount++;
        sandwichDays += duration;
        sandwichDetails.push(`Holiday Sandwich: '${holiday.name}'`);
      }
    });

    // 3. Optimized Weekend Check
    for (const [dateStr, isFullDay] of bookedMap.entries()) {
      if (!isFullDay) continue;
      const d = new Date(dateStr);
      if (d.getDay() === 6) { // Saturday
        const monday = new Date(d);
        monday.setDate(monday.getDate() + 2);
        if (bookedMap.get(formatYYYYMMDD(monday)) === true) {
          sandwichCount++;
          sandwichDays += 1;
          sandwichDetails.push(`Weekend Sandwich: Sat-Mon`);
        }
      }
    }

    return { count: sandwichCount, days: sandwichDays, details: sandwichDetails };
  };

  // --- STATS CALCULATION (Per Employee) ---
  const employeeStats = useMemo(() => {
    const uniqueEmployees = Array.from(employeesMap.entries());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // ✅ PRE-CALCULATION: Index holidays for O(1) lookups
    const holidayDatesSet = new Set();
    holidays.forEach(h => {
      let curr = new Date(h.startDate);
      const end = new Date(h.endDate || h.startDate);
      while (curr <= end) {
        holidayDatesSet.add(formatDate(curr));
        curr = addDays(curr, 1);
      }
    });

    // ✅ OPTIMIZATION: Index data by employeeId for O(1) lookups
    const attendanceByEmployee = new Map();
    rawAttendance.forEach(att => {
      if (!attendanceByEmployee.has(att.employeeId)) {
        attendanceByEmployee.set(att.employeeId, new Set());
      }
      if (att.punchIn) {
        attendanceByEmployee.get(att.employeeId).add(formatDate(att.date));
      }
    });

    const leavesByEmployee = new Map();
    enrichedRequests.forEach(req => {
      if (!leavesByEmployee.has(req.employeeId)) {
        leavesByEmployee.set(req.employeeId, []);
      }
      leavesByEmployee.get(req.employeeId).push(req);
    });

    return uniqueEmployees.map(([empId, empInfo]) => {
      const empName = empInfo.name;
      const joiningDateStr = empInfo.joiningDate;
      const joiningDate = joiningDateStr ? new Date(joiningDateStr) : null;
      if (joiningDate) joiningDate.setHours(0, 0, 0, 0);

      const employeeLeaves = leavesByEmployee.get(empId) || [];

      const absents = [];
      const shift = shiftsMap[empId] || { weeklyOffDays: [0] };
      const weeklyOffs = shift.weeklyOffDays || [0];

      const employeePunches = attendanceByEmployee.get(empId) || new Set();

      let loopStart, loopEnd;

      if (selectedYear === "All") {
        const minYear = availableYears.length > 0 ? Math.min(...availableYears) : new Date().getFullYear();
        loopStart = new Date(minYear, 0, 1);
        loopEnd = new Date();
      } else if (selectedMonth === "All") {
        const y = parseInt(selectedYear);
        loopStart = new Date(y, 0, 1);
        loopEnd = new Date(y, 11, 31);
        if (loopEnd > today) loopEnd = new Date();
      } else {
        const y = parseInt(selectedYear);
        const m = parseInt(selectedMonth);
        loopStart = new Date(y, m - 1, 1);
        loopEnd = new Date(y, m, 0);
        if (loopEnd > today) loopEnd = new Date();
      }

      // ✅ FIX: Don't count absents BEFORE joining date
      if (joiningDate && loopStart < joiningDate) {
        loopStart = new Date(joiningDate);
      }

      // If after adjustment, loopStart > loopEnd, it means they joined after the selected range
      if (loopStart > loopEnd) {
        return null; // Skip this employee for this period
      }

      const appliedLeaveDates = new Set();
      employeeLeaves.forEach(l => {
        if (l.status === 'Approved' || l.status === 'Pending') {
          let c = new Date(l.from);
          const e = new Date(l.to);
          while (c <= e) {
            appliedLeaveDates.add(formatDate(c));
            c = addDays(c, 1);
          }
        }
      });

      for (let d = new Date(loopStart); d <= loopEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = formatDate(d);
        const dayOfWeek = d.getDay();

        if (holidayDatesSet.has(dateStr)) continue;
        if (weeklyOffs.includes(dayOfWeek)) continue;
        if (employeePunches.has(dateStr)) continue;
        if (appliedLeaveDates.has(dateStr)) continue;

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
          isDateInFilter(leave.from, selectedYear, selectedMonth) ||
          isDateInFilter(leave.to, selectedYear, selectedMonth)
      );

      // const normalLeaveDays = leavesInMonth.reduce(
      //   (total, leave) => total + calculateLeaveDays(leave.from, leave.to),
      //   0
      // );
      const normalLeaveDays = leavesInMonth.reduce((total, leave) => {
        // Clamp the leave range to the selected period so a Jan-28→Feb-03 leave
        // only counts its January days when January is selected.
        const leaveFrom = new Date(leave.from);
        const leaveTo = new Date(leave.to);
        const clampedFrom = leaveFrom < loopStart ? new Date(loopStart) : leaveFrom;
        const clampedTo = leaveTo > loopEnd ? new Date(loopEnd) : leaveTo;
        return total + calculateLeaveDays(clampedFrom, clampedTo);
      }, 0);
      const absentDaysCount = absents.length;

      // ✅ FIX: Only calculate sandwich for REAL leaves, not system absents
      const sandwichData = calculateSandwichData(approvedLeavesOnly,
        selectedYear,
        selectedMonth,
        holidays
      );

      // ✅ FIX: totalConsumed (Total Days Used) only counts real leaves + their sandwich days
      const totalConsumed = normalLeaveDays + absentDaysCount + sandwichData.days;


      // Basic credit logic, customize as needed
      const monthlyCredit = (selectedMonth === "All" && selectedYear !== "All") ? 12 : 1;
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
    }).filter(Boolean); // Filter out employees who haven't joined yet
  }, [enrichedRequests, employeesMap, selectedYear, selectedMonth, holidays, rawAttendance, shiftsMap, availableYears]);

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

  // Pagination Logic
  const totalPages = Math.ceil(filteredEmployeeStats.length / itemsPerPage);
  const paginatedEmployeeStats = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredEmployeeStats.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredEmployeeStats, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedYear, selectedMonth]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
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
    const rows = filteredEmployeeStats.map((emp) => [
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
    if (!empStats) return;

    const leaves = empStats.rawLeaves.filter(
      (req) =>
        isDateInFilter(req.from, selectedYear, selectedMonth) ||
        isDateInFilter(req.to, selectedYear, selectedMonth)
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-500 font-semibold text-sm">
            Loading employee data...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen font-sans relative">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <FaCalendarAlt className="text-blue-600" /> Employee Leave Statistics
            </h1>
            <p className="text-sm font-medium text-gray-500 mt-1">
              Comprehensive overview including Applied Leaves and Unplanned Absents.
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={exportEmployeeStatsCSV}
            disabled={filteredEmployeeStats.length === 0}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <FaFileDownload size={16} /> Export to CSV
          </motion.button>
        </motion.div>

        {/* Filters Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
            <div className="md:col-span-6 relative">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Search Employees
              </label>
              <FaSearch className="absolute left-4 top-[35px] text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID or Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Filter Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm"
              >
                <option value="">Select Year</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Filter Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                disabled={selectedYear === "All"}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition shadow-sm disabled:opacity-50 disabled:bg-gray-50"
              >
                <option value="All">All Months</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {(searchQuery || selectedYear !== "All" || selectedMonth !== "All") && (
            <div className="mt-4 flex items-center justify-between bg-blue-50/50 p-3 rounded-lg border border-blue-100">
              <div className="text-xs font-semibold text-blue-800 flex items-center gap-2">
                <FaFilter />
                Showing {filteredEmployeeStats.length} employee{filteredEmployeeStats.length !== 1 ? "s" : ""}
                {(selectedYear !== "All" || selectedMonth !== "All") &&
                  ` for ${selectedMonth !== "All" ? MONTH_OPTIONS.find(m => m.value === selectedMonth)?.label + " " : ""}${selectedYear !== "All" ? selectedYear : ""}`}
              </div>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedYear("All");
                  setSelectedMonth("All");
                  setSortConfig({ key: null, direction: "asc" });
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-bold bg-white px-3 py-1.5 rounded-md border border-blue-200 shadow-sm"
              >
                Clear Filters
              </button>
            </div>
          )}
        </motion.div>

        {/* Main Data Table Wrapper (With requested classes) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-gray-50 md:bg-white"
        >
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto custom-scrollbar">
            <table className="min-w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-bold tracking-wider sticky top-0 z-20 shadow-sm">
                <tr>
                  <th onClick={() => handleSort("employeeId")} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition w-20">ID</th>
                  <th onClick={() => handleSort("employeeName")} className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition">Employee</th>
                  <th onClick={() => handleSort("pendingLeaves")} className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition">Pending</th>
                  <th onClick={() => handleSort("totalLeaveDays")} className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition">Total Days Used</th>
                  <th onClick={() => handleSort("extraLeaves")} className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition">Extra (LOP)</th>
                  <th onClick={() => handleSort("sandwichLeavesDays")} className="px-6 py-4 text-center cursor-pointer hover:bg-gray-100 transition">Sandwich Days</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                <AnimatePresence>
                  {paginatedEmployeeStats.length > 0 ? (
                    paginatedEmployeeStats.map((emp, index) => (
                      <motion.tr
                        key={emp.employeeId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ delay: index * 0.01 }}
                        className="hover:bg-gray-50 transition-colors duration-150"
                      >
                        <td className="px-6 py-4 text-xs font-mono text-gray-500">{emp.employeeId}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100">
                              {emp.employeeName.charAt(0)}
                            </div>
                            <span className="font-bold text-gray-800">{emp.employeeName}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${emp.pendingLeaves === 0 ? "bg-red-50 text-red-700 border-red-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                            {emp.pendingLeaves}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center justify-center px-3 py-1 rounded-md bg-green-50 text-green-700 font-bold text-xs shadow-sm border border-green-100">
                              {emp.totalLeaveDays}
                            </span>
                            <span className="text-[9px] text-gray-400 mt-1 uppercase font-semibold">
                              {emp.normalLeaveDays} App + {emp.absentDays} Abs + {emp.sandwichLeavesDays} SW
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${emp.extraLeaves > 0 ? "bg-orange-50 text-orange-700 border-orange-100" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {emp.extraLeaves}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-bold shadow-sm border ${emp.sandwichLeavesDays > 0 ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-gray-50 text-gray-600 border-gray-200"}`}>
                            {emp.sandwichLeavesDays}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => handleViewDetails(emp.employeeId)}
                            className="bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 font-bold px-3 py-1.5 rounded-lg transition duration-200 text-xs flex items-center gap-1.5 mx-auto shadow-sm tooltip-container"
                            title="View detailed history"
                          >
                            <FaEye size={12} /> Details
                          </button>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-400">
                          <FaUserTie size={32} className="mb-3 opacity-20" />
                          <p className="text-sm font-semibold text-gray-500">No employee records found matching your criteria.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Mobile List View */}
          <div className="md:hidden flex flex-col gap-3 p-3 bg-gray-50">
            <AnimatePresence>
              {paginatedEmployeeStats.length > 0 ? (
                paginatedEmployeeStats.map((emp, index) => (
                  <motion.div
                    key={`mobile-${emp.employeeId}`}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ delay: index * 0.01 }}
                    className="bg-white border border-gray-200 rounded-xl p-3.5 flex flex-col gap-2.5 shadow-sm hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-50 text-blue-600 font-bold text-[13px] border border-blue-100 shrink-0">
                          {emp.employeeName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 text-sm">{emp.employeeName}</div>
                          <div className="text-[10px] text-gray-500 font-mono">{emp.employeeId}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleViewDetails(emp.employeeId)}
                        className="bg-gray-50 border border-gray-200 text-gray-500 hover:text-blue-600 hover:bg-blue-50 font-bold px-2.5 py-1.5 rounded-lg transition duration-200 text-[10px] flex items-center gap-1.5 shadow-sm"
                      >
                        <FaEye size={12} /> Details
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-gray-50/80 rounded-xl border border-gray-100 p-2">
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Pend</span>
                        <span className={`text-xs font-black ${emp.pendingLeaves === 0 ? "text-red-500" : "text-blue-600"}`}>
                          {emp.pendingLeaves}
                        </span>
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Total</span>
                        <span className="text-xs font-black text-green-600">
                          {emp.totalLeaveDays}
                        </span>
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">LOP</span>
                        <span className={`text-xs font-black ${emp.extraLeaves > 0 ? "text-orange-500" : "text-gray-600"}`}>
                          {emp.extraLeaves}
                        </span>
                      </div>
                      <div className="w-px h-6 bg-gray-200"></div>
                      <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Sandw</span>
                        <span className={`text-xs font-black ${emp.sandwichLeavesDays > 0 ? "text-purple-600" : "text-gray-600"}`}>
                          {emp.sandwichLeavesDays}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="py-10 text-center bg-gray-50">
                  <FaUserTie size={32} className="mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-semibold text-gray-500">No employee records found matching your criteria.</p>
                </div>
              )}
            </AnimatePresence>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (
                    pageNum === 1 ||
                    pageNum === totalPages ||
                    (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-9 h-9 rounded-lg text-sm font-bold transition-all duration-200 ${currentPage === pageNum
                          ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                          : "text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200"
                          }`}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (
                    pageNum === currentPage - 2 ||
                    pageNum === currentPage + 2
                  ) {
                    return <span key={pageNum} className="px-1 text-gray-400">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              📋 Statistical Legend:
            </h4>
            <div className="flex flex-wrap gap-4 text-[11px] font-medium text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-blue-500 rounded-sm"></span>
                <span><strong className="text-gray-800">Pending:</strong> Monthly Credit - Consumed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-green-500 rounded-sm"></span>
                <span><strong className="text-gray-800">Total:</strong> Applied + Absent + Sandwich</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></span>
                <span><strong className="text-gray-800">Absent:</strong> Unplanned missing punch</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* DETAILS MODAL */}
        <AnimatePresence>
          {showDetailsModal && selectedEmployee && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onClick={() => setShowDetailsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="px-4 md:px-6 py-4 md:py-5 border-b border-gray-200 bg-white flex items-start md:items-center justify-between shrink-0">
                  <div className="flex items-center gap-3 md:gap-4">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg md:text-xl border border-blue-100 shrink-0">
                      {selectedEmployee.employeeName.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg md:text-xl font-bold text-gray-800 leading-tight">{selectedEmployee.employeeName}</h3>
                      <p className="text-[10px] md:text-xs font-mono text-gray-500 mt-0.5">ID: {selectedEmployee.employeeId}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-full transition-colors shrink-0"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>

                {/* Modal Stats Row */}
                <div className="bg-gray-50/80 px-3 md:px-6 py-2.5 md:py-3 border-b border-gray-200 grid grid-cols-5 gap-1.5 md:gap-3 shrink-0">
                  <div className="bg-white py-1.5 px-1 md:px-3 rounded-lg border border-gray-200 flex flex-col items-center justify-center shadow-sm text-center">
                    <p className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate w-full">Pend</p>
                    <p className="text-sm md:text-lg font-black text-blue-600 leading-none">{selectedEmployee.pendingLeaves}</p>
                  </div>
                  <div className="bg-white py-1.5 px-1 md:px-3 rounded-lg border border-gray-200 flex flex-col items-center justify-center shadow-sm text-center">
                    <p className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate w-full">Used</p>
                    <p className="text-sm md:text-lg font-black text-green-600 leading-none">{selectedEmployee.totalLeaveDays}</p>
                  </div>
                  <div className="bg-white py-1.5 px-1 md:px-3 rounded-lg border border-gray-200 flex flex-col items-center justify-center shadow-sm text-center">
                    <p className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate w-full">Extra</p>
                    <p className="text-sm md:text-lg font-black text-orange-600 leading-none">{selectedEmployee.extraLeaves}</p>
                  </div>
                  <div className="bg-white py-1.5 px-1 md:px-3 rounded-lg border border-gray-200 flex flex-col items-center justify-center shadow-sm text-center">
                    <p className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate w-full">Absent</p>
                    <p className="text-sm md:text-lg font-black text-red-600 leading-none">{selectedEmployee.absentDays}</p>
                  </div>
                  <div className="bg-white py-1.5 px-1 md:px-3 rounded-lg border border-gray-200 flex flex-col items-center justify-center shadow-sm text-center">
                    <p className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 truncate w-full">Sandw</p>
                    <p className="text-sm md:text-lg font-black text-purple-600 leading-none">{selectedEmployee.sandwichLeavesDays}</p>
                  </div>
                </div>

                {/* Modal Content Scrollable Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-white custom-scrollbar">
                  {selectedEmployee.sandwichDetails && selectedEmployee.sandwichDetails.length > 0 && (
                    <div className="mb-6 bg-orange-50 border border-orange-200 p-4 rounded-xl shadow-sm">
                      <div className="flex items-start gap-3">
                        <FaExclamationTriangle className="text-orange-500 mt-0.5" size={16} />
                        <div className="flex-1">
                          <p className="font-bold text-orange-800 text-sm mb-1.5">
                            Sandwich Leaves Detected
                          </p>
                          <ul className="space-y-1">
                            {selectedEmployee.sandwichDetails.map((reason, idx) => (
                              <li key={idx} className="text-xs font-medium text-orange-700">
                                • {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {employeeLeaveHistory.length > 0 ? (
                    <div className="space-y-3">
                      <h4 className="font-bold text-sm text-gray-800 mb-3 border-b border-gray-100 pb-2">Leave & Absent Records</h4>
                      {employeeLeaveHistory.map((leave, index) => {
                        const isAbsentRecord = leave.isAbsentRecord;
                        return (
                          <div
                            key={leave._id || index}
                            className={`border p-4 rounded-xl transition hover:shadow-md ${isAbsentRecord ? "bg-red-50/50 border-red-100" : "bg-white border-gray-200"
                              }`}
                          >
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-gray-800">
                                  {formatDisplayDate(leave.from)}
                                  {leave.from !== leave.to && (
                                    <>
                                      <span className="mx-2 text-gray-400 text-xs">to</span>
                                      {formatDisplayDate(leave.to)}
                                    </>
                                  )}
                                </span>
                              </div>
                              {isAbsentRecord ? (
                                <span className="px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider bg-red-100 text-red-800 border border-red-200 shadow-sm">
                                  ABSENT (No Punch)
                                </span>
                              ) : (
                                <span
                                  className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider shadow-sm border ${leave.status === "Approved"
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : leave.status === "Rejected"
                                      ? "bg-red-50 text-red-700 border-red-200"
                                      : leave.status === "Pending"
                                        ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                                        : "bg-gray-50 text-gray-700 border-gray-200"
                                    }`}
                                >
                                  {leave.status}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Type:</span>
                                <span className="font-bold text-gray-700">{leave.leaveType || "Absent"}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">
                                  {isAbsentRecord ? "Detected:" : "Applied:"}
                                </span>
                                <span className="font-medium text-gray-700">
                                  {formatDisplayDate(leave.requestDate || leave.createdAt || leave.from)}
                                </span>
                              </div>
                              <div className="md:col-span-2 bg-white/60 p-2 rounded border border-gray-100 mt-1">
                                <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px] block mb-0.5">Reason:</span>
                                <span className="text-gray-700 italic font-medium">
                                  "{leave.reason || "System marked as absent due to missing punch"}"
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-sm font-semibold">No history records found.</p>
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="bg-gray-50 px-4 md:px-6 py-4 border-t border-gray-200 flex justify-end shrink-0">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="bg-gray-800 hover:bg-gray-900 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition duration-200 shadow-sm"
                  >
                    Close Window
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