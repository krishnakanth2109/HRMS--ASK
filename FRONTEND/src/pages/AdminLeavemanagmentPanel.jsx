// --- START OF FILE AdminLeaveManagementPanel.jsx ---
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  getLeaveRequests,
  getEmployees,
  approveLeaveRequestById,
  rejectLeaveRequestById,
} from "../api";
import { FaCheck, FaTimes, FaFilter, FaCalendarAlt, FaUndo } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

const AdminLeavePanel = () => {
  const location = useLocation();

  const [leaveList, setLeaveList] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(null);

  // --- UI States ---
  const [filterDept, setFilterDept] = useState("All");
  const [filterStatus, setFilterStatus] = useState(
    location.state?.defaultStatus || "All"
  );
  
  // --- Date Filter States ---
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [showMoreId, setShowMoreId] = useState(null);
  const [snackbar, setSnackbar] = useState("");

  // Confirm Popup
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [selectedLeaveId, setSelectedLeaveId] = useState(null);

  const showSnackbar = (msg) => {
    setSnackbar(msg);
    setTimeout(() => setSnackbar(""), 1800);
  };

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesData, employeesData] = await Promise.all([
        getLeaveRequests(),
        getEmployees(),
      ]);

      setLeaveList(leavesData);

      // FIX: Create map using BOTH employeeId & _id
      const map = new Map();
      employeesData.forEach((emp) => {
        if (emp.employeeId) map.set(emp.employeeId, emp);
        if (emp._id) map.set(emp._id, emp);
      });

      setEmployeesMap(map);
    } catch (err) {
      console.error("Admin Panel Data Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // FIX: Get department from experienceDetails[0].department
  const enrichedLeaveList = useMemo(() => {
    return leaveList.map((leave) => {
      const emp = employeesMap.get(leave.employeeId);

      return {
        ...leave,
        employeeName: emp?.name || "Unknown",
        department:
          emp?.experienceDetails?.[0]?.department || "Unassigned",
      };
    });
  }, [leaveList, employeesMap]);

  const allDepartments = useMemo(() => {
    return Array.from(
      new Set(
        Array.from(employeesMap.values()).map(
          (emp) => emp?.experienceDetails?.[0]?.department
        )
      )
    ).filter(Boolean);
  }, [employeesMap]);

  // Filter logic (including today and Date Ranges)
  const filteredRequests = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return enrichedLeaveList.filter((req) => {
      // 1. Department Filter
      const matchDept =
        filterDept === "All" || req.department === filterDept;

      // 2. Status Filter
      const matchStatus =
        filterStatus === "All" ||
        req.status === filterStatus ||
        (filterStatus === "Today" &&
          req.status === "Approved" &&
          today >= req.from &&
          today <= req.to);

      // 3. Search Filter
      const matchSearch =
        req.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.employeeName?.toLowerCase().includes(searchQuery.toLowerCase());

      // 4. Date Range Filter
      // Logic: A leave overlaps with the filter range if:
      // (LeaveStart <= FilterEnd) AND (LeaveEnd >= FilterStart)
      let matchDate = true;
      if (filterDateFrom || filterDateTo) {
        const leaveStart = req.from;
        const leaveEnd = req.to;
        const filterStart = filterDateFrom || "0000-01-01"; // Default to very old if empty
        const filterEnd = filterDateTo || "9999-12-31";     // Default to future if empty

        matchDate = leaveStart <= filterEnd && leaveEnd >= filterStart;
      }

      return matchDept && matchStatus && matchSearch && matchDate;
    });
  }, [enrichedLeaveList, filterDept, filterStatus, searchQuery, filterDateFrom, filterDateTo]);

  // Today on leave count
  const todayOnLeave = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    return enrichedLeaveList.filter(
      (req) =>
        req.status === "Approved" &&
        today >= req.from &&
        today <= req.to
    ).length;
  }, [enrichedLeaveList]);

  // Approve / Reject
  const openConfirm = (id, actionType) => {
    setSelectedLeaveId(id);
    setConfirmAction(actionType);
    setConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    try {
      setStatusUpdating(selectedLeaveId);
      setConfirmOpen(false);

      if (confirmAction === "Approved") {
        await approveLeaveRequestById(selectedLeaveId);
      } else {
        await rejectLeaveRequestById(selectedLeaveId);
      }

      await fetchAllData();
      showSnackbar(`Leave ${confirmAction.toLowerCase()} successfully.`);
    } catch {
      showSnackbar("Failed to update leave.");
    } finally {
      setStatusUpdating(null);
    }
  };

  const statusBadge = (status) => {
    let color = "bg-gray-200 text-gray-700";
    if (status === "Pending") color = "bg-yellow-100 text-yellow-700";
    if (status === "Approved") color = "bg-green-100 text-green-700";
    if (status === "Rejected") color = "bg-red-100 text-red-700";
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold ${color}`}>
        {status}
      </span>
    );
  };

  const clearDateFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  if (loading)
    return <div className="p-6 text-center text-lg">Loading...</div>;

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold mb-6 text-emerald-900">
        Leave Management (Admin Panel)
      </h2>

      {/* STAT CARDS */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white shadow-lg rounded-xl p-6 flex items-center gap-4 border-l-8 border-red-600">
          <div className="bg-red-100 text-red-600 p-3 rounded-full text-2xl">
            <FaCalendarAlt />
          </div>
          <div>
            <h3 className="text-gray-600 font-semibold text-sm">On Leave Today</h3>
            <p className="text-3xl font-extrabold text-gray-800">
              {todayOnLeave}
            </p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-6 flex items-center gap-4 border-l-8 border-green-600">
          <div className="bg-green-100 text-green-600 p-3 rounded-full text-2xl">
            ✔
          </div>
          <div>
            <h3 className="text-gray-600 font-semibold text-sm">Approved</h3>
            <p className="text-3xl font-extrabold text-gray-800">
              {filteredRequests.filter((r) => r.status === "Approved").length}
            </p>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-6 flex items-center gap-4 border-l-8 border-yellow-600">
          <div className="bg-yellow-100 text-yellow-600 p-3 rounded-full text-2xl">
            ⏳
          </div>
          <div>
            <h3 className="text-gray-600 font-semibold text-sm">Pending</h3>
            <p className="text-3xl font-extrabold text-gray-800">
              {filteredRequests.filter((r) => r.status === "Pending").length}
            </p>
          </div>
        </div>
      </div>

      {/* FILTERS CONTAINER */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded shadow-sm border">
          <FaFilter className="text-blue-600" />
          
          {/* Department Select */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="border px-2 py-1 rounded text-sm bg-white"
          >
            <option value="All">All Departments</option>
            {allDepartments.map((dept) => (
              <option key={dept}>{dept}</option>
            ))}
          </select>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-2 p-2 bg-gray-50 rounded shadow-sm border">
          <span className="text-sm font-semibold text-gray-600 flex items-center gap-1">
             <FaCalendarAlt /> Date:
          </span>
          <input
            type="date"
            className="border px-2 py-1 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            title="Start Date"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            className="border px-2 py-1 rounded text-sm outline-none focus:ring-1 focus:ring-blue-500"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            title="End Date"
          />
          {(filterDateFrom || filterDateTo) && (
            <button 
              onClick={clearDateFilters}
              className="text-red-500 hover:text-red-700 ml-1"
              title="Clear Date Filter"
            >
              <FaUndo size={14} />
            </button>
          )}
        </div>

        {/* Status Buttons */}
        <div className="flex flex-wrap gap-2">
          {["All", "Pending", "Approved", "Rejected", "Today"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded text-sm font-semibold transition ${
                filterStatus === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-blue-100 text-gray-700"
              }`}
            >
              {s === "Today" ? "On Leave Today" : s}
            </button>
          ))}
        </div>
      </div>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search by Name or Employee ID"
        className="border px-4 py-2 rounded mb-4 w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* SUMMARY */}
      <div className="mb-4 bg-gray-50 p-3 rounded-xl shadow flex flex-wrap gap-4 text-sm font-semibold text-gray-700">
        <span>Total: <span className="text-blue-600">{filteredRequests.length}</span></span>
        <span>Approved: <span className="text-green-600">{filteredRequests.filter((r) => r.status === "Approved").length}</span></span>
        <span>Pending: <span className="text-yellow-600">{filteredRequests.filter((r) => r.status === "Pending").length}</span></span>
        <span>Rejected: <span className="text-red-600">{filteredRequests.filter((r) => r.status === "Rejected").length}</span></span>
      </div>

      {/* TABLE */}
      <div className="overflow-x-auto bg-white rounded-xl shadow">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left text-gray-600 uppercase tracking-wider">
              <th className="p-4 font-semibold">ID</th>
              <th className="p-4 font-semibold">Name</th>
              <th className="p-4 font-semibold">Dept</th>
              <th className="p-4 font-semibold">From</th>
              <th className="p-4 font-semibold">To</th>
              <th className="p-4 font-semibold">Type</th>
              <th className="p-4 font-semibold">Reason</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200">
            {filteredRequests.length ? (
              filteredRequests.map((lv) => (
                <React.Fragment key={lv._id}>
                  <tr className="hover:bg-blue-50 transition">
                    <td className="p-4 font-medium text-gray-900">{lv.employeeId}</td>
                    <td className="p-4 text-gray-700">{lv.employeeName}</td>
                    <td className="p-4 text-gray-600">{lv.department}</td>
                    <td className="p-4 whitespace-nowrap">{lv.from}</td>
                    <td className="p-4 whitespace-nowrap">{lv.to}</td>
                    <td className="p-4">{lv.leaveType}</td>
                    <td className="p-4 max-w-xs truncate" title={lv.reason}>{lv.reason}</td>
                    <td className="p-4">{statusBadge(lv.status)}</td>

                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() =>
                          setShowMoreId(showMoreId === lv._id ? null : lv._id)
                        }
                        className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded text-xs"
                      >
                        {showMoreId === lv._id ? "Hide" : "Details"}
                      </button>

                      {lv.status === "Pending" && (
                        <>
                          <button
                            onClick={() => openConfirm(lv._id, "Approved")}
                            className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded"
                            title="Approve"
                          >
                            <FaCheck />
                          </button>

                          <button
                            onClick={() => openConfirm(lv._id, "Rejected")}
                            className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded"
                            title="Reject"
                          >
                            <FaTimes />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>

                  {showMoreId === lv._id && (
                    <tr className="bg-gray-50">
                      <td colSpan="9" className="p-4">
                        <div className="bg-white p-4 rounded shadow border border-gray-200">
                          <h4 className="font-semibold mb-2 text-gray-700">
                            Leave Day Details
                          </h4>

                          {lv.details?.length ? (
                            <table className="min-w-full text-sm border">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="px-3 py-2 border">Date</th>
                                  <th className="px-3 py-2 border">Category</th>
                                  <th className="px-3 py-2 border">Type</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lv.details.map((d, i) => (
                                  <tr key={i}>
                                    <td className="px-3 py-2 border">{d.date}</td>
                                    <td className="px-3 py-2 border">{d.leavecategory}</td>
                                    <td className="px-3 py-2 border">{d.leaveDayType}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-gray-500 italic">No detailed breakdown available.</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center p-8 text-gray-500">
                  <div className="flex flex-col items-center">
                    <FaCalendarAlt className="text-4xl text-gray-300 mb-2" />
                    <p>No leave requests found matching your filters.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CONFIRM POPUP */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-96 p-6 rounded-xl shadow-2xl"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <h3 className="text-xl font-bold mb-4 text-indigo-700">
                Confirm {confirmAction}
              </h3>

              <p className="text-gray-700 mb-6">
                Are you sure you want to{" "}
                <b className={confirmAction === "Approved" ? "text-green-600" : "text-red-600"}>
                  {confirmAction}
                </b>{" "}
                this leave request?
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200 font-medium"
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleConfirmAction}
                  className={`px-4 py-2 rounded text-white font-medium shadow-md ${
                     confirmAction === "Approved" 
                     ? "bg-green-600 hover:bg-green-700" 
                     : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  Yes, Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {snackbar && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-800 text-white rounded-full shadow-lg z-50"
        >
          {snackbar}
        </motion.div>
      )}
    </div>
  );
};

export default AdminLeavePanel;
// --- END OF FILE AdminLeaveManagementPanel.jsx ---