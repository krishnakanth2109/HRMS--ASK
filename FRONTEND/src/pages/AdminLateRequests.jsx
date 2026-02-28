import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api"; 
import Swal from "sweetalert2";
import { 
  FaCheck, 
  FaTimes, 
  FaUserClock, 
  FaCalendarDay, 
  FaSearch,
  FaCog,
  FaExclamationTriangle,
  FaHistory,
  FaFilter,
  FaCalendarAlt,
  FaUsers,
  FaUser,
  FaEdit,
  FaSync
} from "react-icons/fa";
import AdminAttendanceRequests from "./AdminAttendanceRequests"; // ✅ ADD THIS IMPORT

const AdminLateRequests = () => {
  const [requests, setRequests] = useState([]);
  const [employeeLimits, setEmployeeLimits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingLimits, setLoadingLimits] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: ""
  });
  const [requestType, setRequestType] = useState("PENDING"); 
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showBulkLimitModal, setShowBulkLimitModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [currentEmployeeHistory, setCurrentEmployeeHistory] = useState(null);
  const [limitSettings, setLimitSettings] = useState({
    employeeId: '',
    employeeName: '',
    currentLimit: 5,
    currentUsed: 0,
    newLimit: 5
  });
  const [bulkLimitValue, setBulkLimitValue] = useState(5);

  // ✅ ADDED: State for attendance status correction count
  const [statusCorrectionCount, setStatusCorrectionCount] = useState(0);

  // ✅ UPDATED: Fast fetch for the status correction badge count using the correct backend route
  const fetchStatusCorrectionCount = useCallback(async () => {
    try {
      // Using the confirmed admin route to get the correction requests
      const response = await api.get("/api/attendance/admin/status-correction-requests");
      
      // The backend returns { success: true, data: [...] }
      const allData = response.data?.data || [];
      
      // Filter for PENDING status
      const pendingCount = allData.filter(req => 
        req.status === "PENDING" || req.status === "pending"
      ).length;
      
      setStatusCorrectionCount(pendingCount);
    } catch (err) {
      console.error("Error fetching status correction count:", err);
    }
  }, []);

  // ✅ Fast Fetch: Only fetch pending requests initially
  const fetchPendingRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/attendance/all", {
        params: { status: 'PENDING', type: 'LATE_CORRECTION' }
      });
      
      const allRecords = data.data || [];
      const pendingRequests = [];

      // Optimized loop
      for (const empRecord of allRecords) {
        if (!empRecord.attendance || !Array.isArray(empRecord.attendance)) continue;

        for (const dayLog of empRecord.attendance) {
          if (
            dayLog.lateCorrectionRequest?.hasRequest && 
            dayLog.lateCorrectionRequest?.status === "PENDING"
          ) {
            pendingRequests.push({
              employeeId: empRecord.employeeId,
              employeeName: empRecord.employeeName,
              date: dayLog.date,
              currentPunchIn: dayLog.punchIn,
              requestedTime: dayLog.lateCorrectionRequest.requestedTime,
              reason: dayLog.lateCorrectionRequest.reason,
              status: dayLog.lateCorrectionRequest.status,
            });
          }
        }
      }

      // Sort by date (Newest First)
      pendingRequests.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRequests(pendingRequests);
    } catch (err) {
      console.error("Error fetching requests:", err);
      if (err.code !== "ERR_CANCELED") {
        Swal.fire("Error", "Failed to load requests.", "error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ Fast Fetch: Employee Request Limits
  const fetchEmployeeLimits = async (showLoader = true) => {
    if (showLoader) setLoadingLimits(true);
    try {
      // Fetch all attendance records first
      const { data } = await api.get("/api/attendance/all");
      const allRecords = data.data || [];
      const limitData = [];
      const batchSize = 5;
      
      // Process in batches for better performance
      for (let i = 0; i < allRecords.length; i += batchSize) {
        const batch = allRecords.slice(i, i + batchSize);
        const batchPromises = batch.map(async (empRecord) => {
          if (!empRecord.employeeId) return null;
          
          try {
            // Use cached data if available
            const existingLimit = employeeLimits.find(emp => emp.employeeId === empRecord.employeeId);
            if (existingLimit && !showLoader) {
              return existingLimit;
            }

            const limitResponse = await api.get(`/api/attendance/request-limit/${empRecord.employeeId}`);
            const currentMonth = new Date().toISOString().slice(0, 7);
            const monthData = limitResponse.data.monthlyRequestLimits?.[currentMonth] || { limit: 5, used: 0 };
            
            return {
              employeeId: empRecord.employeeId,
              employeeName: empRecord.employeeName,
              currentLimit: monthData.limit,
              currentUsed: monthData.used,
              remaining: monthData.limit - monthData.used
            };
          } catch (err) {
            console.error(`Error fetching limit for ${empRecord.employeeId}:`, err);
            return {
              employeeId: empRecord.employeeId,
              employeeName: empRecord.employeeName,
              currentLimit: 5,
              currentUsed: 0,
              remaining: 5
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        limitData.push(...batchResults.filter(Boolean));
      }

      setEmployeeLimits(limitData);
    } catch (err) {
      console.error("Error fetching employee limits:", err);
      if (showLoader) {
        Swal.fire("Error", "Failed to load employee limits.", "error");
      }
    } finally {
      if (showLoader) setLoadingLimits(false);
    }
  };

  // ✅ Fast: Fetch employee history (on demand)
  const fetchEmployeeHistory = async (employeeId) => {
    try {
      const { data } = await api.get(`/api/attendance/${employeeId}`);
      const allRecords = data.data || [];
      const historyRequests = [];

      for (const dayLog of allRecords) {
        if (dayLog.lateCorrectionRequest?.hasRequest) {
          historyRequests.push({
            employeeId: employeeId,
            employeeName: allRecords[0]?.employeeName || "Unknown",
            date: dayLog.date,
            currentPunchIn: dayLog.punchIn,
            requestedTime: dayLog.lateCorrectionRequest.requestedTime,
            reason: dayLog.lateCorrectionRequest.reason,
            status: dayLog.lateCorrectionRequest.status,
            adminComment: dayLog.lateCorrectionRequest.adminComment
          });
        }
      }

      historyRequests.sort((a, b) => new Date(b.date) - new Date(a.date));
      return historyRequests;
    } catch (err) {
      console.error("Error fetching employee history:", err);
      return [];
    }
  };

  // Initial Load
  useEffect(() => {
    fetchPendingRequests();
    fetchStatusCorrectionCount(); // ✅ Load count immediately

    // ✅ Background Interval: Keep the status correction badge updated
    const interval = setInterval(() => {
        fetchStatusCorrectionCount();
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [fetchPendingRequests, fetchStatusCorrectionCount]);

  // ✅ OPTIMIZED: Memoize filtering
  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Filter by search text
    if (filterText) {
      const lowerFilter = filterText.toLowerCase();
      filtered = filtered.filter(r => 
        r.employeeName.toLowerCase().includes(lowerFilter) ||
        r.employeeId.includes(lowerFilter) ||
        r.reason.toLowerCase().includes(lowerFilter)
      );
    }

    // Filter by date range
    if (dateRange.startDate) {
      filtered = filtered.filter(r => new Date(r.date) >= new Date(dateRange.startDate));
    }
    if (dateRange.endDate) {
      filtered = filtered.filter(r => new Date(r.date) <= new Date(dateRange.endDate));
    }

    return filtered;
  }, [requests, filterText, dateRange]);

  // ✅ Filter employee limits
  const filteredEmployeeLimits = useMemo(() => {
    if (!filterText) return employeeLimits;
    const lowerFilter = filterText.toLowerCase();
    return employeeLimits.filter(emp => 
      emp.employeeName.toLowerCase().includes(lowerFilter) ||
      emp.employeeId.includes(lowerFilter)
    );
  }, [employeeLimits, filterText]);

  // ✅ Handle employee selection for bulk update
  const handleSelectEmployee = (employeeId) => {
    setSelectedEmployees(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  // ✅ Select all employees
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEmployees([]);
    } else {
      const allIds = filteredEmployeeLimits.map(emp => emp.employeeId);
      setSelectedEmployees(allIds);
    }
    setSelectAll(!selectAll);
  };

  // ✅ Fast: Open Limit Setting Modal (with pre-fetched data)
  const openLimitModal = async (req) => {
    // Show modal immediately with existing data
    const employeeLimit = employeeLimits.find(emp => emp.employeeId === req.employeeId);
    
    if (employeeLimit) {
      setLimitSettings({
        employeeId: req.employeeId,
        employeeName: req.employeeName,
        currentLimit: employeeLimit.currentLimit,
        currentUsed: employeeLimit.currentUsed,
        newLimit: employeeLimit.currentLimit
      });
      setShowLimitModal(true);
    } else {
      // Fallback to API call if not in cache
      try {
        const { data } = await api.get(`/api/attendance/request-limit/${req.employeeId}`);
        const currentMonth = new Date().toISOString().slice(0, 7);
        const monthData = data.monthlyRequestLimits?.[currentMonth] || { limit: 5, used: 0 };
        
        setLimitSettings({
          employeeId: req.employeeId,
          employeeName: req.employeeName,
          currentLimit: monthData.limit,
          currentUsed: monthData.used,
          newLimit: monthData.limit
        });
        setShowLimitModal(true);
      } catch (err) {
        Swal.fire("Error", "Failed to fetch limit data", "error");
      }
    }
  };

  // ✅ Fast: Open History Modal
  const openHistoryModal = async (employeeId, employeeName) => {
    setCurrentEmployeeHistory({
      employeeId,
      employeeName,
      loading: true,
      requests: []
    });
    setShowHistoryModal(true);
    
    const history = await fetchEmployeeHistory(employeeId);
    setCurrentEmployeeHistory({
      employeeId,
      employeeName,
      loading: false,
      requests: history
    });
  };

  // ✅ NEW: Update Request Limit
  const updateRequestLimit = async () => {
    if (limitSettings.newLimit < limitSettings.currentUsed) {
      Swal.fire(
        "Invalid Limit",
        `New limit (${limitSettings.newLimit}) cannot be less than already used requests (${limitSettings.currentUsed})`,
        "warning"
      );
      return;
    }

    Swal.fire({
      title: 'Updating Limit...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      await api.post("/api/attendance/set-request-limit", {
        employeeId: limitSettings.employeeId,
        limit: limitSettings.newLimit
      });

      Swal.fire("Success!", `Request limit updated to ${limitSettings.newLimit} for ${limitSettings.employeeName}`, "success");
      setShowLimitModal(false);
      
      // Update local cache
      setEmployeeLimits(prev => 
        prev.map(emp => 
          emp.employeeId === limitSettings.employeeId
            ? { ...emp, currentLimit: limitSettings.newLimit, remaining: limitSettings.newLimit - emp.currentUsed }
            : emp
        )
      );
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      Swal.fire("Error", errMsg, "error");
    }
  };

// ✅ UPDATED: Bulk Update Request Limits with better error handling
const bulkUpdateRequestLimits = async () => {
  if (selectedEmployees.length === 0) {
    Swal.fire("No Selection", "Please select at least one employee", "warning");
    return;
  }

  if (bulkLimitValue < 0 || bulkLimitValue > 100) {
    Swal.fire("Invalid Value", "Limit must be between 0 and 100", "warning");
    return;
  }

  Swal.fire({
    title: 'Updating Limits...',
    html: `Setting limit to ${bulkLimitValue} for ${selectedEmployees.length} employee(s)`,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const results = [];
    const errors = [];
    
    // Process sequentially to get better error messages
    for (const employeeId of selectedEmployees) {
      try {
        const employee = employeeLimits.find(emp => emp.employeeId === employeeId);
        if (!employee) continue;
        
        // Check if new limit is less than used requests
        if (bulkLimitValue < employee.currentUsed) {
          errors.push({
            employeeId,
            employeeName: employee.employeeName,
            error: `Cannot set limit (${bulkLimitValue}) below already used requests (${employee.currentUsed})`
          });
          continue;
        }
        
        const response = await api.post("/api/attendance/set-request-limit", {
          employeeId,
          limit: bulkLimitValue
        });
        
        results.push({
          employeeId,
          employeeName: employee.employeeName,
          success: true
        });
        
      } catch (err) {
        const employee = employeeLimits.find(emp => emp.employeeId === employeeId);
        errors.push({
          employeeId,
          employeeName: employee?.employeeName || employeeId,
          error: err.response?.data?.message || err.message
        });
      }
    }

    if (errors.length > 0) {
      let errorMessage = `Failed to update ${errors.length} of ${selectedEmployees.length} employees:\n\n`;
      errors.slice(0, 5).forEach((err, index) => {
        errorMessage += `${index + 1}. ${err.employeeName} (${err.employeeId}): ${err.error}\n`;
      });
      
      if (errors.length > 5) {
        errorMessage += `\n... and ${errors.length - 5} more`;
      }
      
      Swal.fire({
        icon: 'warning',
        title: 'Partial Success',
        html: `<div style="text-align: left;">
                <p><strong>Updated:</strong> ${results.length} employee(s)</p>
                <p><strong>Failed:</strong> ${errors.length} employee(s)</p>
                <div style="max-height: 200px; overflow-y: auto; margin-top: 10px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                  <pre style="font-size: 11px; white-space: pre-wrap;">${errorMessage}</pre>
                </div>
              </div>`,
        confirmButtonText: 'OK'
      });
    } else {
      Swal.fire(
        "Success!",
        `Updated limits to ${bulkLimitValue} for ${selectedEmployees.length} employee(s)`,
        "success"
      );
    }
    
    setShowBulkLimitModal(false);
    setSelectedEmployees([]);
    setSelectAll(false);
    
    // Refresh limits data
    fetchEmployeeLimits(false);
    
  } catch (err) {
    Swal.fire("Error", "Failed to update limits. Please check individually.", "error");
  }
};

  // ✅ UPDATED: Handle Approve / Reject with Loading & Optimistic Update
  const handleAction = async (reqItem, action) => {
    const isApprove = action === "APPROVED";
    let adminComment = "";

    // 1. Gather Input / Confirmation
    if (!isApprove) {
      const { value: text } = await Swal.fire({
        input: "textarea",
        inputLabel: "Rejection Reason",
        inputPlaceholder: "Type your reason here...",
        inputAttributes: { "aria-label": "Type your reason here" },
        showCancelButton: true,
        confirmButtonText: "Reject Request",
        confirmButtonColor: "#d33",
        showLoaderOnConfirm: true,
      });
      if (text === undefined) return; // Cancelled
      if (!text) {
        Swal.fire("Required", "Please provide a reason for rejection", "warning");
        return;
      }
      adminComment = text;
    } else {
        const confirm = await Swal.fire({
            title: "Approve Time Change?",
            html: `This will update <b>${reqItem.employeeName}'s</b> First Punch In time to <br/>
                   <b style="color:green; font-size:1.1em">${new Date(reqItem.requestedTime).toLocaleTimeString()}</b>.`,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#10b981",
            confirmButtonText: "Yes, Update Punch In"
        });
        if (!confirm.isConfirmed) return;
    }

    // 2. SHOW LOADING
    Swal.fire({
        title: isApprove ? 'Approving...' : 'Rejecting...',
        html: 'Please wait while we update the attendance records.',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
      // 3. Call API
      await api.post("/api/attendance/approve-correction", {
        employeeId: reqItem.employeeId,
        date: reqItem.date,
        status: action,
        adminComment: adminComment
      });

      // 4. OPTIMISTIC UPDATE
      setRequests(prevRequests => prevRequests.filter(r => 
          !(r.employeeId === reqItem.employeeId && r.date === reqItem.date)
      ));

      // 5. Update employee limits cache if rejected
      if (action === "REJECTED") {
        setEmployeeLimits(prev => 
          prev.map(emp => 
            emp.employeeId === reqItem.employeeId && emp.currentUsed > 0
              ? { ...emp, currentUsed: emp.currentUsed - 1, remaining: emp.remaining + 1 }
              : emp
          )
        );
      }

      // 6. SHOW SUCCESS CONFIRMATION
      Swal.fire(
        isApprove ? "Approved!" : "Rejected",
        isApprove 
          ? "Attendance record has been updated successfully." 
          : "Request has been rejected.",
        "success"
      );

    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      Swal.fire("Error", errMsg, "error");
    }
  };

  // ✅ Get status badge color
  const getStatusBadge = (status) => {
    switch(status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "APPROVED": return "bg-green-100 text-green-800 border-green-200";
      case "REJECTED": return "bg-red-100 text-red-800 border-red-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen font-sans">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
               <FaUserClock className="text-orange-600" /> Employees Attendece Status Correction Requests
            </h2>
            <p className="text-sm text-gray-500 mt-1">
               Manage all late login requests, employee request limits and attendance status correction requests.
            </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setRequestType("PENDING");
              fetchPendingRequests();
            }} 
            className={`text-sm px-4 py-2 rounded-lg transition shadow-sm font-medium ${
              requestType === "PENDING" 
                ? "bg-orange-600 text-white" 
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            Late Login
          </button>
          <button 
            onClick={() => {
              setRequestType("LIMITS");
              fetchEmployeeLimits();
            }} 
            className={`text-sm px-4 py-2 rounded-lg transition shadow-sm font-medium flex items-center gap-2 ${
              requestType === "LIMITS" 
                ? "bg-purple-600 text-white" 
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FaUsers /> Limits
          </button>
          
          {/* ✅ BUTTON: Attendance Status Correction Button with Persistent Count Badge */}
          <button 
            onClick={() => {
                setRequestType("ATTENDANCE_STATUS");
                fetchStatusCorrectionCount();
            }}
            className={`text-sm px-4 py-2 rounded-lg transition shadow-sm font-medium flex items-center gap-2 relative ${
              requestType === "ATTENDANCE_STATUS" 
                ? "bg-blue-600 text-white" 
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
            }`}
          >
            <FaSync /> Attendence Status Correction
            {statusCorrectionCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-6 w-6">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-6 w-6 bg-red-600 border-2 border-white text-white items-center justify-center text-[11px] font-bold">
                        {statusCorrectionCount}
                    </span>
                </span>
            )}
          </button>
        </div>
      </div>

      {/* Search and Filters Bar - Only show for PENDING and LIMITS tabs */}
      {requestType !== "ATTENDANCE_STATUS" && (
        <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Search Input - Takes 5 columns */}
            <div className="md:col-span-5 relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input 
                  type="text" 
                  placeholder="Search by Employee Name, ID, or Reason..." 
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none transition"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
            
            {/* Date Range Inputs - Takes 5 columns */}
            <div className="md:col-span-5 grid grid-cols-2 gap-3">
              <div className="relative">
                <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none transition"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                />
              </div>
              <div className="relative">
                <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="date"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none transition"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                />
              </div>
            </div>

            {/* Action Buttons - Takes 2 columns */}
            <div className="md:col-span-2 flex gap-2">
              {requestType === "LIMITS" && (
                <button
                  onClick={() => setShowBulkLimitModal(true)}
                  className="flex-1 px-3 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center justify-center gap-2 text-sm font-medium"
                  disabled={selectedEmployees.length === 0}
                >
                  <FaCog /> Bulk ({selectedEmployees.length})
                </button>
              )}
              <button
                onClick={() => {
                  setFilterText("");
                  setDateRange({ startDate: "", endDate: "" });
                }}
                className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-100 transition flex items-center justify-center gap-2 text-sm"
              >
                <FaFilter /> Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      {requestType === "ATTENDANCE_STATUS" ? (
        /* ✅ RENDER IMPORTED COMPONENT */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-blue-50 to-white border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
              <FaSync className="text-blue-600" />
              Attendance Status Correction Management
            </h3>
          </div>
          <div className="p-1">
            <AdminAttendanceRequests />
          </div>
        </div>
      ) : loading && requestType === "PENDING" ? (
        <div className="flex flex-col justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-orange-600"></div>
          <p className="mt-4 text-gray-500 font-medium">Loading pending requests...</p>
        </div>
      ) : requestType === "LIMITS" ? (
        /* Employee Limits View */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-800 text-lg">
              Monthly Request Limits
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({filteredEmployeeLimits.length} employees)
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAll}
                className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          </div>
          
          {loadingLimits ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading employee limits...</p>
            </div>
          ) : filteredEmployeeLimits.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No employee limits found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Limit</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Used</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usage</th>
                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredEmployeeLimits.map((emp) => (
                    <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedEmployees.includes(emp.employeeId)}
                          onChange={() => handleSelectEmployee(emp.employeeId)}
                          className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                      </td>
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-gray-900">{emp.employeeName}</p>
                          <p className="text-xs text-gray-500 font-mono">{emp.employeeId}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-purple-700">{emp.currentLimit}</span>
                      </td>
                      <td className="p-3">
                        <span className={`font-bold ${emp.currentUsed > 0 ? 'text-orange-600' : 'text-gray-600'}`}>
                          {emp.currentUsed}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`font-bold ${emp.remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {emp.remaining}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="w-32">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${emp.currentUsed / emp.currentLimit > 0.8 ? 'bg-red-500' : emp.currentUsed / emp.currentLimit > 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min((emp.currentUsed / emp.currentLimit) * 100, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {Math.round((emp.currentUsed / emp.currentLimit) * 100)}% used
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openHistoryModal(emp.employeeId, emp.employeeName)}
                            className="px-3 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition flex items-center gap-1"
                            title="View History"
                          >
                            <FaHistory className="text-xs" /> History
                          </button>
                          <button
                            onClick={() => openLimitModal(emp)}
                            className="px-3 py-1 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg border border-purple-200 transition flex items-center gap-1"
                            title="Edit Limit"
                          >
                            <FaEdit className="text-xs" /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaCheck className="text-green-500 text-2xl" />
            </div>
            <h3 className="text-lg font-bold text-gray-700">No pending requests found!</h3>
            <p className="text-gray-400 mt-1">
              All caught up! No pending late correction requests.
            </p>
        </div>
      ) : (
        /* Pending Requests Card View */
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredRequests.map((req) => (
            <div key={`${req.employeeId}-${req.date}`} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 flex flex-col group">
              
              {/* Card Header */}
              <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg group-hover:text-orange-600 transition-colors">{req.employeeName}</h3>
                  <span className="text-[11px] font-bold text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                    {req.employeeId}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                       <FaCalendarDay />
                       {new Date(req.date).toLocaleDateString("en-GB")}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openHistoryModal(req.employeeId, req.employeeName)}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md border border-blue-200 transition"
                      title="View History"
                    >
                      <FaHistory className="text-[10px]" />
                    </button>
                    <button
                      onClick={() => openLimitModal(req)}
                      className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-md border border-purple-200 transition"
                      title="Manage Request Limit"
                    >
                      <FaEdit className="text-[10px]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-5 flex-1 space-y-4">
                
                {/* Time Comparison Block */}
                <div className="flex items-center justify-between bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                    <div className="text-center">
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">System Recognized</p>
                        <p className="text-red-500 font-mono font-bold text-lg line-through decoration-2 opacity-70">
                            {req.currentPunchIn 
                                ? new Date(req.currentPunchIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                                : "--:--"
                            }
                        </p>
                    </div>
                    <div className="text-orange-300 text-xl font-light">➜</div>
                    <div className="text-center">
                        <p className="text-[10px] text-gray-400 uppercase font-bold mb-1 tracking-wider">Requested Time</p>
                        <p className="text-green-600 font-mono font-bold text-xl bg-green-50 px-2 rounded">
                            {new Date(req.requestedTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                    </div>
                </div>

                {/* Reason Block */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Reason provided</p>
                    <p className="text-sm text-gray-700 italic leading-relaxed">
                        "{req.reason}"
                    </p>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-3 bg-gray-50/50 border-t border-gray-100 flex gap-3">
                <button
                    onClick={() => handleAction(req, "REJECTED")}
                    className="flex-1 flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 py-2.5 rounded-lg font-bold transition text-xs shadow-sm"
                >
                    <FaTimes /> Reject
                </button>
                <button
                    onClick={() => handleAction(req, "APPROVED")}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 py-2.5 rounded-lg font-bold transition text-xs shadow-md shadow-green-200"
                >
                    <FaCheck /> Approve
                </button>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Individual Limit Setting Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaEdit className="text-purple-600" />
                Edit Request Limit
              </h3>
              <button 
                onClick={() => setShowLimitModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-1">Employee</p>
              <p className="font-bold text-gray-800">{limitSettings.employeeName}</p>
              <p className="text-xs text-gray-500 font-mono">{limitSettings.employeeId}</p>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FaExclamationTriangle className="text-purple-600" />
                <p className="text-sm font-bold text-purple-900">Current Month Status</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-purple-600 mb-1">Current Limit</p>
                  <p className="text-2xl font-bold text-purple-900">{limitSettings.currentLimit}</p>
                </div>
                <div>
                  <p className="text-xs text-purple-600 mb-1">Requests Used</p>
                  <p className="text-2xl font-bold text-purple-900">{limitSettings.currentUsed}</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-purple-200 rounded-full h-2">
                  <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min((limitSettings.currentUsed / limitSettings.currentLimit) * 100, 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-purple-700 mt-1 text-center">
                  {limitSettings.currentLimit - limitSettings.currentUsed} requests remaining
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Set New Monthly Limit
              </label>
              <input
                type="number"
                min={limitSettings.currentUsed}
                max="100"
                value={limitSettings.newLimit}
                onChange={(e) => setLimitSettings({...limitSettings, newLimit: parseInt(e.target.value) || 0})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none text-lg font-bold text-center"
              />
              <p className="text-xs text-gray-500 mt-2">
                Minimum: {limitSettings.currentUsed} (already used this month)
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowLimitModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={updateRequestLimit}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold transition shadow-lg"
              >
                Update Limit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden transform transition-all">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaHistory className="text-blue-600" />
                {currentEmployeeHistory?.employeeName}'s Request History
                <span className="text-sm font-normal text-gray-500 ml-2">
                  ID: {currentEmployeeHistory?.employeeId}
                </span>
              </h3>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="overflow-y-auto max-h-[60vh] p-6">
              {currentEmployeeHistory?.loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Loading history...</p>
                </div>
              ) : currentEmployeeHistory?.requests?.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No request history found for this employee.
                </div>
              ) : (
                <div className="space-y-4">
                  {currentEmployeeHistory?.requests?.map((req, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <FaCalendarDay className="text-blue-500" />
                          <span className="font-medium text-gray-900">
                            {new Date(req.date).toLocaleDateString("en-GB")}
                          </span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="text-center bg-white p-3 rounded-lg border">
                          <p className="text-xs text-gray-400 mb-1">Original Time</p>
                          <p className="text-red-500 font-mono font-medium line-through">
                            {req.currentPunchIn 
                              ? new Date(req.currentPunchIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                              : "--:--"
                            }
                          </p>
                        </div>
                        <div className="text-center bg-white p-3 rounded-lg border">
                          <p className="text-xs text-gray-400 mb-1">Requested Time</p>
                          <p className="text-green-600 font-mono font-bold">
                            {new Date(req.requestedTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Employee's Reason</p>
                          <p className="text-sm text-gray-700 bg-white p-3 rounded border">
                            {req.reason}
                          </p>
                        </div>
                        {req.adminComment && (
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Admin Comment</p>
                            <p className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-100">
                              {req.adminComment}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-bold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Limit Setting Modal */}
      {showBulkLimitModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 transform transition-all">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaUsers className="text-purple-600" />
                Bulk Update Request Limits
              </h3>
              <button 
                onClick={() => setShowBulkLimitModal(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">
                You are updating limits for <span className="font-bold text-purple-700">{selectedEmployees.length}</span> selected employee(s).
              </p>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm font-bold text-purple-900 mb-2">⚠️ Important Note</p>
                <p className="text-xs text-purple-700">
                  This will set the same limit value for all selected employees. 
                  The limit cannot be set below the number of requests already used by each employee.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Set New Monthly Limit for All Selected
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={bulkLimitValue}
                onChange={(e) => setBulkLimitValue(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-500 outline-none text-lg font-bold text-center"
              />
              <p className="text-xs text-gray-500 mt-2">
                Value must be between 0 and 100
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkLimitModal(false)}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={bulkUpdateRequestLimits}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-bold transition shadow-lg"
              >
                Update All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLateRequests;