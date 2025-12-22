import React, { useState, useEffect } from "react";
import api from "../api"; // Assuming your axios instance is here
import Swal from "sweetalert2";
import { 
  FaCheck, 
  FaTimes, 
  FaClock, 
  FaUserClock, 
  FaCalendarDay, 
  FaExclamationCircle,
  FaSearch
} from "react-icons/fa";

const AdminLateRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterText, setFilterText] = useState("");

  // ✅ Fetch all attendance and filter for pending requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/attendance/all");
      const allRecords = data.data || [];
      
      const pendingRequests = [];

      allRecords.forEach((empRecord) => {
        if (empRecord.attendance && Array.isArray(empRecord.attendance)) {
          empRecord.attendance.forEach((dayLog) => {
            // Check if there is a pending request
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
                shiftStart: "09:00", // You might want to fetch actual shift if available, or assume default
              });
            }
          });
        }
      });

      // Sort by date (newest first)
      pendingRequests.sort((a, b) => new Date(b.date) - new Date(a.date));
      setRequests(pendingRequests);
    } catch (err) {
      console.error("Error fetching requests:", err);
      Swal.fire("Error", "Failed to load requests.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // ✅ Handle Approve / Reject
  const handleAction = async (reqItem, action) => {
    const isApprove = action === "APPROVED";
    
    // For rejection, ask for a comment
    let adminComment = "";
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

    try {
      await api.post("/api/attendance/approve-correction", {
        employeeId: reqItem.employeeId,
        date: reqItem.date,
        status: action,
        adminComment: adminComment
      });

      Swal.fire(
        isApprove ? "Approved!" : "Rejected",
        isApprove 
          ? "Attendance record has been updated successfully." 
          : "Request has been rejected.",
        "success"
      );
      
      // Refresh list
      fetchRequests();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      Swal.fire("Error", errMsg, "error");
    }
  };

  // Helper to filter
  const filteredRequests = requests.filter(r => 
    r.employeeName.toLowerCase().includes(filterText.toLowerCase()) ||
    r.employeeId.includes(filterText)
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaUserClock className="text-orange-600" /> Late Login Requests
            </h2>
            <p className="text-sm text-gray-500 mt-1">
            Employees requesting correction for "Late" login status.
            </p>
        </div>
        <button 
            onClick={fetchRequests} 
            className="text-sm bg-white border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-100 transition"
        >
            Refresh List
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 relative max-w-md">
        <FaSearch className="absolute left-3 top-3 text-gray-400" />
        <input 
            type="text" 
            placeholder="Search by Employee Name or ID..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-200 outline-none transition"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600"></div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-100">
            <FaCheck className="mx-auto text-green-200 text-5xl mb-4" />
            <h3 className="text-lg font-semibold text-gray-600">All caught up!</h3>
            <p className="text-gray-400">No pending late correction requests.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredRequests.map((req, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow duration-200 flex flex-col">
              
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{req.employeeName}</h3>
                  <span className="text-xs text-gray-500 font-mono bg-gray-200 px-2 py-0.5 rounded">
                    {req.employeeId}
                  </span>
                </div>
                <div className="text-right">
                    <div className="flex items-center gap-1 text-sm text-gray-600 font-medium">
                        <FaCalendarDay className="text-blue-500" />
                        {new Date(req.date).toLocaleDateString("en-GB")}
                    </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 space-y-4">
                
                {/* Time Comparison */}
                <div className="flex items-center justify-between bg-orange-50 p-3 rounded-lg border border-orange-100">
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">System Time</p>
                        <p className="text-red-600 font-mono font-bold text-lg line-through decoration-2">
                            {req.currentPunchIn 
                                ? new Date(req.currentPunchIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) 
                                : "--:--"
                            }
                        </p>
                    </div>
                    <div className="text-orange-400 text-xl">➔</div>
                    <div className="text-center">
                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Requested</p>
                        <p className="text-green-600 font-mono font-bold text-xl">
                            {new Date(req.requestedTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </p>
                    </div>
                </div>

                {/* Reason */}
                <div>
                    <p className="text-xs text-gray-400 font-bold uppercase mb-1">Employee Reason</p>
                    <div className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md italic border-l-4 border-gray-300">
                        "{req.reason}"
                    </div>
                </div>
              </div>

              {/* Footer / Actions */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                <button
                    onClick={() => handleAction(req, "REJECTED")}
                    className="flex-1 flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 py-2 rounded-lg font-semibold transition text-sm shadow-sm"
                >
                    <FaTimes /> Reject
                </button>
                <button
                    onClick={() => handleAction(req, "APPROVED")}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white hover:bg-green-700 py-2 rounded-lg font-semibold transition text-sm shadow-md"
                >
                    <FaCheck /> Approve
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminLateRequests;