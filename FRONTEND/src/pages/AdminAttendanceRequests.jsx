import React, { useEffect, useState } from "react";
import {
  getAllStatusCorrectionRequests,
  approveStatusCorrection,
  rejectStatusCorrection
} from "../api";
import { FaCheck, FaTimes, FaCalendarAlt, FaUserClock, FaSync } from "react-icons/fa";

const AdminAttendanceRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await getAllStatusCorrectionRequests();
      setRequests(data.data || []);
    } catch (err) {
      console.error("Failed to fetch requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (action, req) => {
    const comment = prompt(`Enter comment for ${action === 'approve' ? 'Approving' : 'Rejecting'}:`);
    if (comment === null) return;

    try {
      const payload = {
        employeeId: req.employeeId,
        date: req.date,
        adminComment: comment
      };

      if (action === 'approve') {
        const response = await approveStatusCorrection(payload);
        alert(`✅ Request Approved! ${response.message || "Attendance Updated."}`);
      
      // Try to trigger a refresh in the employee's view if they're online
      // You can use localStorage events to communicate between tabs
        localStorage.setItem('attendance-update-trigger', Date.now().toString());
      } else {
        await rejectStatusCorrection(payload);
        alert("❌ Request Rejected.");
      }
    
    // Refresh the requests list
      fetchRequests();
    } catch (err) {
      alert("Action failed: " + err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaUserClock className="text-blue-600 shrink-0" /> <span className="truncate">Correction Requests</span>
          </h1>
          <button onClick={fetchRequests} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg border border-blue-200 transition shadow-sm font-medium">
            <FaSync /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-500">Loading requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCheck className="text-green-500 text-2xl" />
            </div>
            <h3 className="text-lg font-bold text-gray-700">All caught up!</h3>
            <p className="text-gray-400 mt-1">No pending status correction requests.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-600">Employee</th>
                    <th className="px-6 py-4 font-semibold text-gray-600">Date & Current Status</th>
                    <th className="px-6 py-4 font-semibold text-gray-600">Punched In</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-blue-600">Requested Punch Out</th>
                    <th className="px-6 py-4 font-semibold text-gray-600">Reason</th>
                    <th className="px-6 py-4 font-semibold text-gray-600 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((req, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-800">{req.employeeName}</p>
                        <p className="text-xs text-gray-500">{req.employeeId}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FaCalendarAlt className="text-gray-400" />
                          <span>{new Date(req.date).toLocaleDateString()}</span>
                        </div>
                        <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-bold">
                          {req.currentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 font-medium">
                        {new Date(req.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-lg font-bold text-blue-600">
                          {(() => {
                            const utcDate = new Date(req.requestedPunchOut);
                            const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                            return istDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                          })()}
                        </p>
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleAction('approve', req)}
                            className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 transition"
                            title="Approve"
                          >
                            <FaCheck />
                          </button>
                          <button
                            onClick={() => handleAction('reject', req)}
                            className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition"
                            title="Reject"
                          >
                            <FaTimes />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid gap-4">
              {requests.map((req, idx) => (
                <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800">{req.employeeName}</p>
                      <p className="text-xs text-gray-500">{req.employeeId}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                        <FaCalendarAlt className="text-gray-400" />
                        {new Date(req.date).toLocaleDateString()}
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-600 text-[10px] rounded-full font-bold">
                        {req.currentStatus}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Punched In</p>
                      <p className="text-sm font-bold text-gray-600">
                        {new Date(req.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-center border-l border-gray-200">
                      <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Requested Out</p>
                      <p className="text-sm font-bold text-blue-600">
                        {(() => {
                          const utcDate = new Date(req.requestedPunchOut);
                          const istDate = new Date(utcDate.getTime() + (5.5 * 60 * 60 * 1000));
                          return istDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        })()}
                      </p>
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Reason</p>
                    <p className="text-sm text-gray-700 italic bg-gray-50/50 p-2 rounded border border-gray-100">
                      "{req.reason}"
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleAction('reject', req)}
                      className="flex-1 flex items-center justify-center gap-2 bg-white text-red-600 border border-red-200 py-2 rounded-lg font-bold text-sm hover:bg-red-50 transition"
                    >
                      <FaTimes /> Reject
                    </button>
                    <button
                      onClick={() => handleAction('approve', req)}
                      className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-green-700 transition shadow-md shadow-green-100"
                    >
                      <FaCheck /> Approve
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminAttendanceRequests;