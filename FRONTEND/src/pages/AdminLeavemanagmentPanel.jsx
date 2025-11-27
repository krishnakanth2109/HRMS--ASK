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
import { 
  FaCheck, 
  FaTimes, 
  FaSearch, 
  FaCalendarAlt, 
  FaClipboardList, 
  FaHourglassHalf, 
  FaCheckCircle, 
  FaTimesCircle 
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

const AdminLeavePanel = () => {
  const [leaveList, setLeaveList] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(null);

  // --- UI States ---
  // Initialize month to current YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMoreId, setShowMoreId] = useState(null);
  const [snackbar, setSnackbar] = useState("");

  // NEW STATES FOR POPUP
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null); // "Approved" or "Rejected"
  const [selectedLeaveId, setSelectedLeaveId] = useState(null);

  // --- Helper Snackbar Function ---
  const showSnackbar = (msg) => {
    setSnackbar(msg);
    setTimeout(() => setSnackbar(""), 1800);
  };

  // ✅ Fetch leaves & employees
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const [leavesData, employeesData] = await Promise.all([
        getLeaveRequests(),
        getEmployees(),
      ]);

      setLeaveList(leavesData);

      const newEmployeesMap = new Map(
        employeesData.map((emp) => [emp.employeeId, emp])
      );
      setEmployeesMap(newEmployeesMap);
    } catch (err) {
      console.error("Admin Panel Data Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ✅ Enriched leave list (Removed Department Logic)
  const enrichedLeaveList = useMemo(() => {
    return leaveList.map((leave) => {
      const emp = employeesMap.get(leave.employeeId);
      return {
        ...leave,
        employeeName: emp?.name || "Unknown",
        // department field removed from UI logic
      };
    });
  }, [leaveList, employeesMap]);

  // ✅ Filtering: Month -> Status -> Search
  const filteredRequests = useMemo(() => {
    return enrichedLeaveList.filter((req) => {
      // 1. Month Filter (Compare YYYY-MM of 'from' date)
      const leaveMonth = req.from ? req.from.substring(0, 7) : "";
      const matchesMonth = leaveMonth === selectedMonth;

      // 2. Status Filter
      const matchesStatus =
        filterStatus === "All" || req.status === filterStatus;

      // 3. Search Filter
      const matchesSearch =
        req.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.employeeName.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesMonth && matchesStatus && matchesSearch;
    });
  }, [enrichedLeaveList, selectedMonth, filterStatus, searchQuery]);

  // ✅ Calculate Stats for the CURRENTLY SELECTED MONTH (Filtered List)
  const stats = useMemo(() => {
    return {
      total: filteredRequests.length,
      pending: filteredRequests.filter((r) => r.status === "Pending").length,
      approved: filteredRequests.filter((r) => r.status === "Approved").length,
      rejected: filteredRequests.filter((r) => r.status === "Rejected").length,
    };
  }, [filteredRequests]);

  // OPEN CONFIRM POPUP
  const openConfirm = (id, actionType) => {
    setSelectedLeaveId(id);
    setConfirmAction(actionType);
    setConfirmOpen(true);
  };

  // CONFIRMATION HANDLER
  const handleConfirmAction = async () => {
    const id = selectedLeaveId;
    const status = confirmAction;

    setConfirmOpen(false);
    setStatusUpdating(id);

    try {
      if (status === "Approved") {
        await approveLeaveRequestById(id);
      } else if (status === "Rejected") {
        await rejectLeaveRequestById(id);
      }

      await fetchAllData();

      showSnackbar(
        status === "Approved"
          ? "Leave approved successfully."
          : "Leave rejected successfully."
      );
    } catch (err) {
      console.error("Status Update Error:", err);
      showSnackbar("Failed to update leave status.");
    } finally {
      setStatusUpdating(null);
    }
  };

  const toggleShowMore = (id) => {
    setShowMoreId((prev) => (prev === id ? null : id));
  };

  const statusBadge = (status) => {
    let color = "bg-gray-100 text-gray-600 border-gray-200";
    if (status === "Pending") color = "bg-amber-50 text-amber-700 border-amber-200 border";
    if (status === "Approved") color = "bg-emerald-50 text-emerald-700 border-emerald-200 border";
    if (status === "Rejected") color = "bg-red-50 text-red-700 border-red-200 border";
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${color}`}>
        {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg font-semibold text-gray-500 animate-pulse">
          Loading leave requests...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Admin Leave Panel</h2>
            <p className="text-gray-500 text-sm mt-1">Manage and review employee leave requests</p>
          </div>
          
          {/* Month Filter */}
          <div className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <div className="bg-indigo-100 p-2 rounded text-indigo-600">
              <FaCalendarAlt />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-bold text-gray-400 uppercase">Filter by Month</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-sm font-semibold text-gray-700 focus:outline-none bg-transparent cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Stats Containers (Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total */}
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-blue-500 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase">Total Requests</p>
              <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-full text-blue-500">
              <FaClipboardList size={20} />
            </div>
          </div>

          {/* Pending */}
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-amber-500 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase">Pending</p>
              <p className="text-2xl font-bold text-gray-800">{stats.pending}</p>
            </div>
            <div className="bg-amber-50 p-3 rounded-full text-amber-500">
              <FaHourglassHalf size={20} />
            </div>
          </div>

          {/* Approved */}
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-emerald-500 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase">Approved</p>
              <p className="text-2xl font-bold text-gray-800">{stats.approved}</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-full text-emerald-500">
              <FaCheckCircle size={20} />
            </div>
          </div>

          {/* Rejected */}
          <div className="bg-white p-5 rounded-xl shadow-sm border-l-4 border-red-500 flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase">Rejected</p>
              <p className="text-2xl font-bold text-gray-800">{stats.rejected}</p>
            </div>
            <div className="bg-red-50 p-3 rounded-full text-red-500">
              <FaTimesCircle size={20} />
            </div>
          </div>
        </div>

        {/* Controls: Search & Status Tabs */}
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4 mb-6">
          {/* Status Tabs */}
          <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-200 flex overflow-x-auto max-w-full">
            {["All", "Pending", "Approved", "Rejected"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-5 py-2 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${
                  filterStatus === s
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-80">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search Name or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white shadow-sm"
            />
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-bold tracking-wider">
                <tr>
                  <th className="p-4 border-b">Emp ID</th>
                  <th className="p-4 border-b">Name</th>
                  <th className="p-4 border-b">From</th>
                  <th className="p-4 border-b">To</th>
                  <th className="p-4 border-b">Type</th>
                  <th className="p-4 border-b">Reason</th>
                  <th className="p-4 border-b">Status</th>
                  <th className="p-4 border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRequests.length > 0 ? (
                  filteredRequests.map((lv) => (
                    <React.Fragment key={lv._id}>
                      <tr className={`hover:bg-gray-50 transition duration-150 ${showMoreId === lv._id ? 'bg-gray-50' : ''}`}>
                        <td className="p-4 font-medium text-gray-700">{lv.employeeId}</td>
                        <td className="p-4 font-semibold text-gray-800">{lv.employeeName}</td>
                        <td className="p-4 text-gray-600 whitespace-nowrap">{lv.from}</td>
                        <td className="p-4 text-gray-600 whitespace-nowrap">{lv.to}</td>
                        <td className="p-4">
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100">
                            {lv.leaveType}
                          </span>
                        </td>
                        <td className="p-4 text-gray-600 max-w-xs truncate" title={lv.reason}>
                          {lv.reason}
                        </td>
                        <td className="p-4">{statusBadge(lv.status)}</td>

                        <td className="p-4 flex justify-end gap-2">
                          <button
                            onClick={() => toggleShowMore(lv._id)}
                            className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded text-xs font-semibold transition"
                          >
                            {showMoreId === lv._id ? "Hide" : "Details"}
                          </button>

                          {/* APPROVE */}
                          <button
                            onClick={() => openConfirm(lv._id, "Approved")}
                            title="Approve"
                            className="bg-emerald-100 text-emerald-600 p-2 rounded hover:bg-emerald-200 transition flex items-center justify-center"
                          >
                            <FaCheck size={12} />
                          </button>

                          {/* REJECT */}
                          <button
                            onClick={() => openConfirm(lv._id, "Rejected")}
                            title="Reject"
                            className="bg-red-100 text-red-600 p-2 rounded hover:bg-red-200 transition flex items-center justify-center"
                          >
                            <FaTimes size={12} />
                          </button>
                        </td>
                      </tr>

                      {/* Dropdown Details */}
                      <AnimatePresence>
                        {showMoreId === lv._id && (
                          <motion.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="bg-gray-50/50"
                          >
                            <td colSpan="8" className="p-4 border-b border-gray-200">
                              <div className="bg-white p-4 rounded-lg shadow-inner border border-gray-200 ml-4 border-l-4 border-l-indigo-500">
                                <h4 className="font-bold text-gray-700 mb-3 text-xs uppercase tracking-wide">
                                  Daily Breakdown
                                </h4>
                                {lv.details?.length ? (
                                  <div className="overflow-hidden rounded-md border border-gray-200">
                                    <table className="min-w-full text-left text-xs">
                                      <thead className="bg-gray-100 text-gray-600">
                                        <tr>
                                          <th className="px-4 py-2 font-semibold">Date</th>
                                          <th className="px-4 py-2 font-semibold">Category</th>
                                          <th className="px-4 py-2 font-semibold">Type</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {lv.details.map((d, i) => (
                                          <tr key={i} className="bg-white">
                                            <td className="px-4 py-2 text-gray-700">{d.date}</td>
                                            <td className="px-4 py-2 text-gray-600">{d.leavecategory}</td>
                                            <td className="px-4 py-2 text-gray-600">{d.leaveDayType}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <p className="text-gray-500 text-sm italic">
                                    No daily breakdown details provided.
                                  </p>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center py-12 text-gray-400">
                      <div className="flex flex-col items-center justify-center">
                        <FaClipboardList className="text-4xl mb-3 opacity-20" />
                        <p>No leave requests found for this month.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CONFIRM POPUP */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-96 p-6 rounded-2xl shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <h3 className={`text-xl font-bold mb-2 ${confirmAction === 'Approved' ? 'text-emerald-600' : 'text-red-600'}`}>
                Confirm {confirmAction}
              </h3>

              <p className="text-gray-600 mb-8 leading-relaxed">
                Are you sure you want to <span className="font-bold">{confirmAction.toLowerCase()}</span> this leave request?
                <br /><span className="text-xs text-gray-400">This action cannot be undone easily.</span>
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmOpen(false)}
                  className="px-5 py-2 rounded-lg text-gray-600 hover:bg-gray-100 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmAction}
                  className={`px-5 py-2 rounded-lg text-white font-medium shadow-md transition transform active:scale-95 ${
                    confirmAction === "Approved" 
                      ? "bg-emerald-600 hover:bg-emerald-700" 
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  Yes, {confirmAction}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Snackbar */}
      <AnimatePresence>
        {snackbar && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-xl z-50 text-white font-medium flex items-center gap-2 ${
              snackbar.toLowerCase().includes("rejected") || snackbar.toLowerCase().includes("failed")
                ? "bg-red-600"
                : "bg-emerald-600"
            }`}
          >
            {snackbar.toLowerCase().includes("rejected") ? <FaTimesCircle /> : <FaCheckCircle />}
            {snackbar}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminLeavePanel;