// --- START OF FILE AdminAttendanceRequests.jsx ---

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
        await approveStatusCorrection(payload);
        alert("Request Approved and Attendance Updated.");
      } else {
        await rejectStatusCorrection(payload);
        alert("Request Rejected.");
      }
      fetchRequests(); // Refresh list
    } catch (err) {
      alert("Action failed: " + err.message);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FaUserClock className="text-blue-600" /> Attendance Status Correction Requests
          </h1>
          <button onClick={fetchRequests} className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-lg transition">
            <FaSync /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10">Loading...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
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
                {requests.length > 0 ? requests.map((req, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <p className="font-bold text-gray-800">{req.employeeName}</p>
                      <p className="text-xs text-gray-500">{req.employeeId}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FaCalendarAlt className="text-gray-400"/>
                        <span>{new Date(req.date).toLocaleDateString()}</span>
                      </div>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-bold">
                        {req.currentStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {new Date(req.punchIn).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-lg font-bold text-blue-600">
                        {new Date(req.requestedPunchOut).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
                          title="Approve & Update Attendance"
                        >
                          <FaCheck />
                        </button>
                        <button 
                          onClick={() => handleAction('reject', req)}
                          className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition"
                          title="Reject Request"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-gray-400">
                      No pending status correction requests.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAttendanceRequests;