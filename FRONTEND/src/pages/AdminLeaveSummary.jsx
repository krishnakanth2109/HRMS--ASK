import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { saveAs } from "file-saver";
import { getLeaveRequests, getEmployees, getHolidays } from "../api";

// --- HELPER FUNCTIONS ---

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

// Timezone safe formatter
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalize = (d) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
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

  // Month options based on current year
  const allMonths = useMemo(() => getMonthsForYear(), []);

  const fetchHolidays = async () => {
    try {
      const data = await getHolidays();
      const formatted = data.map((h) => ({
        ...h,
        start: normalize(h.startDate),
        end: normalize(h.endDate || h.startDate),
      }));
      setHolidays(formatted);
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setIsLoading(true);
        const [leaves, employees] = await Promise.all([
          getLeaveRequests(),
          getEmployees(),
        ]);
        setAllRequests(leaves);

        const empMap = new Map(
          employees.map((emp) => [emp.employeeId, emp.name])
        );
        setEmployeesMap(empMap);

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

  // --- CORE SANDWICH LOGIC (Matches Employee Side) ---
  const calculateSandwichData = (employeeLeaves, monthFilter) => {
    const approvedLeaves = employeeLeaves.filter(
      (leave) =>
        leave.status === "Approved" &&
        (monthFilter === "All" ||
          isDateInMonth(leave.from, monthFilter) ||
          isDateInMonth(leave.to, monthFilter))
    );

    if (approvedLeaves.length === 0 && holidays.length === 0) {
      return { count: 0, days: 0, details: [] };
    }

    // 1. Build Map of Booked Dates -> IsFullDay
    const bookedMap = new Map();
    approvedLeaves.forEach((leave) => {
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

    // 2. Check Holiday Sandwiches
    holidays.forEach((holiday) => {
      const hStart = new Date(holiday.start);
      const hEnd = new Date(holiday.end);
      
      // We check filter validity for the holiday itself
      // (If holiday is in Nov, and we filter Nov, we count it)
      if (monthFilter !== "All" && !isDateInMonth(formatDate(hStart), monthFilter)) return;

      const dayBefore = formatDate(addDays(hStart, -1));
      const dayAfter = formatDate(addDays(hEnd, 1));

      // Check if both surrounding days exist in map AND are Full Day
      const beforeIsFull = bookedMap.get(dayBefore) === true;
      const afterIsFull = bookedMap.get(dayAfter) === true;

      if (beforeIsFull && afterIsFull) {
        const duration = calculateLeaveDays(hStart, hEnd);
        sandwichCount++;
        sandwichDays += duration;
        sandwichDetails.push(
          `Holiday Sandwich: '${holiday.name}' (${formatDate(hStart)})`
        );
      }
    });

    // 3. Check Weekend Sandwiches (Sat/Mon)
    // We iterate the map entries to find Saturdays
    for (const [dateStr, isFullDay] of bookedMap.entries()) {
      if (!isFullDay) continue;

      const d = new Date(dateStr);
      // Filter check: The Saturday (start of sandwich) should be in the selected month
      if (monthFilter !== "All" && !isDateInMonth(dateStr, monthFilter)) continue;

      if (d.getDay() === 6) { // Saturday
        const mondayStr = formatDate(addDays(d, 2));
        
        // Check if Monday is Full Day
        if (bookedMap.get(mondayStr) === true) {
          sandwichCount++;
          sandwichDays += 1; // Sunday is 1 day
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

    return uniqueEmployees.map(([empId, empName]) => {
      const employeeLeaves = enrichedRequests.filter(
        (req) => req.employeeId === empId
      );

      // Filter leaves based on selection
      const monthFilteredLeaves = employeeLeaves.filter(
        (leave) =>
          selectedMonth === "All" ||
          isDateInMonth(leave.from, selectedMonth) ||
          isDateInMonth(leave.to, selectedMonth)
      );

      // 1. Approved (Normal) Days
      const approvedLeaves = monthFilteredLeaves.filter(
        (leave) => leave.status === "Approved"
      );
      const normalLeaveDays = approvedLeaves.reduce(
        (total, leave) => total + calculateLeaveDays(leave.from, leave.to),
        0
      );

      // 2. Sandwich Days
      const sandwichData = calculateSandwichData(employeeLeaves, selectedMonth);

      // 3. Total Consumed
      const totalConsumed = normalLeaveDays + sandwichData.days;

      // 4. Pending & Extra Calculation
      // Rule: 1 Credit per month. Pending = 1 - Total. Extra = Total - 1.
      const monthlyCredit = 1;
      const pendingLeaves = Math.max(0, monthlyCredit - totalConsumed);
      const extraLeaves = Math.max(0, totalConsumed - monthlyCredit);

      return {
        employeeId: empId,
        employeeName: empName,
        pendingLeaves,
        totalLeaveDays: totalConsumed,
        normalLeaveDays,
        extraLeaves,
        sandwichLeavesCount: sandwichData.count,
        sandwichLeavesDays: sandwichData.days,
        sandwichDetails: sandwichData.details
      };
    });
  }, [enrichedRequests, employeesMap, selectedMonth, holidays]);

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
      "Normal Leaves",
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
    const employeeLeaves = enrichedRequests.filter(
      (req) =>
        req.employeeId === employeeId &&
        (selectedMonth === "All" ||
          isDateInMonth(req.from, selectedMonth) ||
          isDateInMonth(req.to, selectedMonth))
    );

    const sortedLeaves = employeeLeaves.sort(
      (a, b) =>
        new Date(b.requestDate || b.from) -
        new Date(a.requestDate || a.from)
    );

    setEmployeeLeaveHistory(sortedLeaves);
    setSelectedEmployee(
      employeeStats.find((emp) => emp.employeeId === employeeId)
    );
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
                Comprehensive overview of all employee leave data
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
                Showing {filteredEmployeeStats.length} employee
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
              Employee Leave Details
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Click column headers to sort • {filteredEmployeeStats.length} total
              records
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
                    <div className="flex items-center gap-2">
                      Employee ID
                      {sortConfig.key === "employeeId" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("employeeName")}
                    className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-2">
                      Employee Name
                      {sortConfig.key === "employeeName" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("pendingLeaves")}
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center justify-center gap-2">
                      Pending
                      {sortConfig.key === "pendingLeaves" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("totalLeaveDays")}
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center justify-center gap-2">
                      Total Days
                      {sortConfig.key === "totalLeaveDays" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("extraLeaves")}
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center justify-center gap-2">
                      Extra (LOP)
                      {sortConfig.key === "extraLeaves" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("sandwichLeavesDays")}
                    className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center justify-center gap-2">
                      Sandwich Days
                      {sortConfig.key === "sandwichLeavesDays" && (
                        <span>
                          {sortConfig.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
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
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-gray-900">
                            {emp.employeeId}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">
                            {emp.employeeName}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full bg-blue-100 text-blue-800 font-bold text-sm shadow-sm">
                            {emp.pendingLeaves}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex flex-col items-center">
                            <span className="inline-flex items-center justify-center min-w-[3rem] px-3 py-2 rounded-full bg-green-100 text-green-800 font-bold text-sm shadow-sm">
                              {emp.totalLeaveDays}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-1">
                              {emp.normalLeaveDays} Normal + {emp.sandwichLeavesDays} Sandwich
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
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-2xl">🔍</span>
                          </div>
                          <p className="text-lg font-semibold mb-2">
                            No employees found
                          </p>
                          <p className="text-sm">
                            Try adjusting your search or filter criteria
                          </p>
                        </div>
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
                  <strong>Pending Leaves:</strong> 1 (Credit) - Total Consumed.
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                <span>
                  <strong>Total Days:</strong> Approved Days + Sandwich Gap Days.
                </span>
              </div>
              <div className="flex items-center">
                <span className="w-3 h-3 bg-orange-500 rounded-full mr-2"></span>
                <span>
                  <strong>Extra (LOP):</strong> Total Days - 1.
                </span>
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
                      <h3 className="text-2xl font-bold">Leave History</h3>
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
                      <p className="text-xs text-gray-600">Total Days</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">
                        {selectedEmployee.extraLeaves}
                      </p>
                      <p className="text-xs text-gray-600">Extra (LOP)</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {selectedEmployee.sandwichLeavesCount}
                      </p>
                      <p className="text-xs text-gray-600">Sandwich Incidents</p>
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
                  {/* Show Sandwich Alerts First */}
                   {selectedEmployee.sandwichDetails && selectedEmployee.sandwichDetails.length > 0 && (
                      <div className="mb-6 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
                        <div className="flex items-start">
                          <span className="text-orange-600 text-xl mr-2">
                            🥪
                          </span>
                          <div className="flex-1">
                            <p className="font-semibold text-orange-800 mb-2">
                              Sandwich Leaves Detected in Selection
                            </p>
                            {selectedEmployee.sandwichDetails.map(
                              (reason, idx) => (
                                <p
                                  key={idx}
                                  className="text-sm text-orange-700 mb-1"
                                >
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
                      {employeeLeaveHistory.map((leave, index) => (
                        <motion.div
                          key={leave._id || index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition duration-200"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="text-lg font-bold text-gray-900">
                                  {formatDisplayDate(leave.from)}
                                  <span className="mx-2 text-gray-400">→</span>
                                  {formatDisplayDate(leave.to)}
                                </span>
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
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-gray-600 font-semibold">
                                    Leave Type:
                                  </p>
                                  <p className="text-gray-900">
                                    {leave.leaveType || "-"}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-gray-600 font-semibold">
                                    Applied Date:
                                  </p>
                                  <p className="text-gray-900">
                                    {formatDisplayDate(
                                      leave.requestDate || leave.createdAt
                                    )}
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-gray-600 font-semibold">
                                    Reason:
                                  </p>
                                  <p className="text-gray-900">
                                    {leave.reason || "-"}
                                  </p>
                                </div>
                                {leave.halfDaySession && (
                                  <div className="col-span-2">
                                    <p className="text-gray-600 font-semibold">
                                      Half Day Session:
                                    </p>
                                    <p className="text-gray-900">
                                      {leave.halfDaySession}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">📭</span>
                      </div>
                      <p className="text-lg font-semibold mb-2">
                        No leave history found
                      </p>
                      <p className="text-sm">
                        This employee has no leave records for the selected
                        period
                      </p>
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