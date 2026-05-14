// --- START OF FILE WorkModeRequests.jsx ---

import React, { useState, useEffect, useCallback, useMemo } from "react";
// ⚠️ CHECK THIS IMPORT PATH:
// If this file is in 'src/pages', use '../api'
// If this file is in 'src/components', use '../api'
import api from "../api";
import Swal from "sweetalert2";
import {
  FaEnvelopeOpenText,
  FaCheckCircle,
  FaTimesCircle,
  FaTrash,
  FaCheck,
  FaTimes,
  FaSyncAlt,
  FaBuilding,
  FaLaptopHouse,
  FaChevronLeft,
  FaChevronRight
} from "react-icons/fa";

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const getFormattedDays = (days) => {
  const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (!days || days.length === 0) return "No days selected";
  return days.sort((a, b) => a - b).map(d => daysMap[d]).join(", ");
};

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

const WorkModeRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handlePrevMonth = () => {
    const [year, month] = filterMonth.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    setFilterMonth(`${y}-${m}`);
    setCurrentPage(1);
  };

  const handleNextMonth = () => {
    const [year, month] = filterMonth.split("-").map(Number);
    const date = new Date(year, month, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    setFilterMonth(`${y}-${m}`);
    setCurrentPage(1);
  };

  // Fetch Requests
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/admin/requests");
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching requests:", err);
      // Optional: Swal.fire("Error", "Failed to load requests", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Handle Approve / Reject
  const handleAction = async (requestId, action) => {
    try {
      await api.put("/api/admin/requests/action", { requestId, action });
      Swal.fire({
        title: "Success",
        text: `Request ${action}`,
        icon: "success",
        timer: 1500,
        showConfirmButton: false
      });

      // Update local state immediately for better UX
      setRequests(prev => prev.map(req =>
        req._id === requestId ? { ...req, status: action } : req
      ));
    } catch (err) {
      Swal.fire("Error", "Action failed", "error");
    }
  };

  // Handle Delete
  const handleDelete = async (requestId) => {
    Swal.fire({
      title: "Delete Request?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.delete(`/api/admin/requests/${requestId}`);
          Swal.fire("Deleted!", "Request has been deleted.", "success");
          setRequests(prev => prev.filter(req => req._id !== requestId));
        } catch (err) {
          Swal.fire("Error", "Delete failed", "error");
        }
      }
    });
  };

  // Filter: Month & Sort: Pending first, then by date (newest first)
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = [...requests];

    if (filterMonth) {
      filtered = filtered.filter(req => {
        const date = req.createdAt || req.requestedDate;
        return date && date.startsWith(filterMonth);
      });
    }

    return filtered.sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [requests, filterMonth]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedRequests.length / itemsPerPage);
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedRequests.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedRequests, currentPage]);

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  return (
    <div className="p-4 md:p-8 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">

        {/* Page Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FaEnvelopeOpenText className="text-blue-600" /> Work Mode Requests
            </h1>
            <p className="text-slate-500 mt-1">Manage employee WFH / WFO change requests</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
              <span className="text-sm font-bold text-slate-500 uppercase mr-2">Pending</span>
              <span className="text-xl font-bold text-blue-600">{pendingCount}</span>
            </div>

            {/* Month Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-all"
              >
                <FaChevronLeft size={10} />
              </button>
              <input
                type="month"
                value={filterMonth}
                onChange={(e) => { setFilterMonth(e.target.value); setCurrentPage(1); }}
                className="bg-transparent border-none text-xs outline-none font-bold text-slate-700 w-[110px]"
              />
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-all"
              >
                <FaChevronRight size={10} />
              </button>
            </div>
            <button
              onClick={fetchRequests}
              className="p-2 bg-white text-slate-600 rounded-lg hover:bg-slate-50 border border-slate-200 shadow-sm transition-colors"
              title="Refresh Data"
            >
              <FaSyncAlt className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 gap-4">
          {loading && !requests.length && (
            <div className="text-center py-20 text-slate-500">Loading requests...</div>
          )}

          {!loading && paginatedRequests.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center text-slate-400 shadow-sm border border-slate-200">
              <FaCheckCircle size={48} className="mb-4 opacity-20" />
              <p className="text-lg font-medium">No requests found.</p>
            </div>
          ) : (
            paginatedRequests.map(req => (
              <div key={req._id} className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col md:flex-row gap-4 md:gap-5 items-start">

                {/* Left: Employee & Request Details */}
                <div className="flex-1 w-full">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 md:w-12 md:h-12 rounded-full shrink-0 flex items-center justify-center text-lg md:text-xl font-bold ${req.requestedMode === 'WFH' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                        {req.requestedMode === 'WFH' ? <FaLaptopHouse /> : <FaBuilding />}
                      </div>
                      <div className="flex flex-col">
                        <h4 className="font-bold text-slate-800 text-base md:text-lg">{req.employeeName}</h4>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[10px] md:text-xs text-slate-500 font-mono">{req.employeeId}</p>
                            <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                            <p className="text-[10px] md:text-xs text-slate-500">{req.department}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0 ml-2">
                      <div className="flex flex-col md:flex-row items-end gap-1.5">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[9px] md:text-[10px] font-bold rounded uppercase border border-slate-200 tracking-wider">
                            {req.requestType}
                          </span>
                          {req.status === 'Approved' && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 text-[9px] md:text-[10px] font-bold rounded flex items-center gap-1 uppercase tracking-wider">
                              <FaCheckCircle /> Approved
                            </span>
                          )}
                          {req.status === 'Rejected' && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 text-[9px] md:text-[10px] font-bold rounded flex items-center gap-1 uppercase tracking-wider">
                              <FaTimesCircle /> Rejected
                            </span>
                          )}
                          {req.status === 'Pending' && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[9px] md:text-[10px] font-bold rounded flex items-center gap-1 uppercase tracking-wider">
                              Pending
                            </span>
                          )}
                          {req.status === 'Withdrawn' && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-[9px] md:text-[10px] font-bold rounded flex items-center gap-1 uppercase tracking-wider">
                              Withdrawn
                            </span>
                          )}
                      </div>
                      {req.isEdited && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 text-[9px] md:text-[10px] font-bold rounded flex items-center gap-1 border border-blue-100 uppercase tracking-wider">
                          <FaSyncAlt size={8} /> Edited
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                        Requested Mode
                      </span>
                      <span
                        className={`font-bold text-xs md:text-sm ${req.requestedMode === "WFH" ? "text-green-600" : "text-blue-600"
                          }`}
                      >
                        {req.requestedMode === "WFH" ? "Work From Home" : "Work From Office"}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">Duration / Days</span>
                      <span className="text-slate-700 font-medium text-xs md:text-sm">
                        {req.requestType === "Temporary" && req.fromDate && req.toDate &&
                          `${new Date(req.fromDate).toLocaleDateString()} ➔ ${new Date(req.toDate).toLocaleDateString()}`
                        }
                        {req.requestType === "Recurring" && getFormattedDays(req.recurringDays)}
                        {req.requestType === "Permanent" && "Indefinite Change"}
                      </span>
                    </div>
                  </div>

                  {req.reason && (
                    <div className="mt-3 text-xs md:text-sm text-slate-600 italic bg-slate-50/50 p-2 md:p-0 md:bg-transparent rounded border border-slate-100 md:border-0">
                      <span className="font-semibold text-slate-400 text-[10px] md:text-xs not-italic mr-1.5 uppercase tracking-wider">Reason:</span>
                      "{req.reason}"
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto min-w-[120px] justify-end border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5 mt-2 md:mt-0">
                  {req.status === 'Pending' && (
                    <>
                      <button
                        onClick={() => handleAction(req._id, "Approved")}
                        className="flex-1 md:flex-none bg-[#10B981] hover:bg-[#059669] text-white px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <FaCheck /> Approve
                      </button>
                      <button
                        onClick={() => handleAction(req._id, "Rejected")}
                        className="flex-1 md:flex-none bg-[#EF4444] hover:bg-[#DC2626] text-white px-3 md:px-4 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <FaTimes /> Reject
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(req._id)}
                    className={`${req.status !== 'Pending' ? 'flex-1' : 'w-auto'} md:w-full md:flex-none text-slate-400 hover:text-red-500 text-xs flex items-center justify-center md:justify-end gap-1 px-3 py-2 hover:bg-slate-50 border border-slate-200 md:border-0 rounded-lg md:rounded transition mt-0 md:mt-auto bg-white md:bg-transparent`}
                  >
                    <FaTrash size={12} /> <span className="md:inline">Delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2 pb-8">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all text-slate-600 shadow-sm"
            >
              <FaChevronLeft size={12} />
            </button>

            <div className="flex items-center gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                    currentPage === i + 1
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-all text-slate-600 shadow-sm"
            >
              <FaChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkModeRequests;