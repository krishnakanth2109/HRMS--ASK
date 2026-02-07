// --- START OF FILE PunchOutRequests.jsx ---

import React, { useState, useEffect, useCallback } from "react";
// ⚠️ CHECK THIS IMPORT PATH:
// If this file is in 'src/pages', use '../api'
// If this file is in 'src/components', use '../api'
import api from "../api"; 
import { 
  FaBell, FaCheckCircle, FaBan, FaCheck, FaTrash, FaSyncAlt 
} from "react-icons/fa";

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const formatDateDMY = (dateInput) => {
  if (!dateInput) return "--";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const normalizeDateStr = (dateInput) => {
  const d = new Date(dateInput);
  return d.toISOString().split('T')[0];
};

const getCurrentLocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      resolve({ latitude: 0, longitude: 0 });
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error("Location access denied or failed", error);
          resolve({ latitude: 0, longitude: 0 });
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  });
};

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

const PunchOutRequests = () => {
  const [requests, setRequests] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch Requests
  const fetchPunchOutRequests = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");

    try {
      const response = await api.get('/api/punchoutreq/all');
      
      if (Array.isArray(response.data)) {
        setRequests(response.data);
      } else if (response.data && Array.isArray(response.data.data)) {
         setRequests(response.data.data);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error("Error fetching requests", error);
      setErrorMsg("Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial Fetch
  useEffect(() => {
    fetchPunchOutRequests();
  }, [fetchPunchOutRequests]);

  // Handle Approve / Reject
  const handleRequestAction = async (requestId, status, request) => {
    try {
      if (status === 'Approved') {
        if (!request) { alert("Request details not found!"); return; }

        const targetDate = normalizeDateStr(request.originalDate);
        const adminLocation = await getCurrentLocation();

        let punchOutSuccessful = false;
        try {
          const response = await api.post(`/api/attendance/admin-punch-out`, {
            employeeId: request.employeeId,
            punchOutTime: request.requestedPunchOut,
            latitude: adminLocation.latitude, 
            longitude: adminLocation.longitude, 
            adminId: 'Admin',
            date: targetDate
          });

          if (response.status === 200 || response.status === 201 || response.data?.success) {
            punchOutSuccessful = true;
          } else {
             throw new Error(response.data?.message || "Punch out request completed but indicated failure.");
          }
        } catch (punchOutError) {
          const errMsg = punchOutError.response?.data?.message || punchOutError.message;
          alert(`Punch Out Failed: ${errMsg}`);
          return; 
        }

        if (punchOutSuccessful) {
            await api.post('/api/punchoutreq/action', { requestId, status });
            // Update UI
            setRequests((prev) => 
                prev.map((req) => req._id === requestId ? { ...req, status: 'Approved' } : req)
            );
            alert(`✅ Request Approved!`);
        }

      } else {
        // Handle Rejection
        await api.post('/api/punchoutreq/action', { requestId, status });
        setRequests((prev) => 
             prev.map((req) => req._id === requestId ? { ...req, status: 'Rejected' } : req)
        );
        alert(`Request ${status} Successfully`);
      }
    } catch (error) {
      alert("Action failed: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDeleteRequest = async (requestId) => {
    if (!window.confirm("Delete this request permanently?")) return;
    try {
        await api.delete(`/api/punchoutreq/delete/${requestId}`);
        setRequests((prev) => prev.filter(req => req._id !== requestId));
    } catch (error) {
        alert("Delete failed: " + (error.response?.data?.message || error.message));
    }
  };

  const sortedRequests = Array.isArray(requests) 
    ? [...requests].sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate))
    : [];

  const pendingCount = sortedRequests.filter(r => r.status === 'Pending').length;

  return (
    <div className="p-4 md:p-8 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FaBell className="text-blue-600" /> Punch Out Requests
                </h1>
                <p className="text-slate-500 mt-1">Manage employee punch-out correction requests</p>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                    <span className="text-sm font-bold text-slate-500 uppercase mr-2">Pending</span>
                    <span className="text-xl font-bold text-blue-600">{pendingCount}</span>
                </div>
                <button 
                    onClick={fetchPunchOutRequests} 
                    className="p-2 bg-white text-slate-600 rounded-lg hover:bg-slate-50 border border-slate-200 shadow-sm transition-colors"
                    title="Refresh Data"
                >
                    <FaSyncAlt className={loading ? "animate-spin" : ""} />
                </button>
            </div>
        </div>
        
        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden min-h-[500px]">
          
          <div className="overflow-x-auto">
             <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Shift Date</th>
                    <th className="px-6 py-4">Requested Out Time</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading && !requests.length && (
                      <tr><td colSpan="6" className="text-center py-10 text-slate-500">Loading requests...</td></tr>
                  )}

                  {errorMsg && (
                      <tr><td colSpan="6" className="text-center py-10 text-red-500 font-bold">{errorMsg}</td></tr>
                  )}

                  {!loading && sortedRequests.length === 0 ? (
                     <tr>
                        <td colSpan="6" className="text-center py-20">
                            <div className="flex flex-col items-center justify-center text-slate-400">
                                <FaCheckCircle className="text-4xl text-green-100 mb-4" />
                                <p className="font-medium">No requests found.</p>
                            </div>
                        </td>
                     </tr>
                  ) : (
                    sortedRequests.map((req) => (
                    <tr key={req._id || Math.random()} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{req.employeeName || "Unknown"}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{req.employeeId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium">
                        {formatDateDMY(req.originalDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <span className="bg-blue-50 text-blue-700 py-1 px-3 rounded-md font-mono font-semibold">
                            {req.requestedPunchOut ? new Date(req.requestedPunchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 italic max-w-xs truncate" title={req.reason}>
                        "{req.reason}"
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                          {req.status === 'Approved' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold">
                                <FaCheckCircle /> Approved
                            </span>
                          ) : req.status === 'Rejected' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
                                <FaBan /> Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
                                Pending
                            </span>
                          )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {req.status === 'Pending' && (
                            <>
                              <button 
                                onClick={() => handleRequestAction(req._id, 'Approved', req)}
                                className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all shadow-sm"
                                title="Approve"
                              >
                                <FaCheck size={14} />
                              </button>
                              <button 
                                onClick={() => handleRequestAction(req._id, 'Rejected', req)}
                                className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                                title="Reject"
                              >
                                <FaBan size={14} />
                              </button>
                            </>
                          )}
                           <button 
                                onClick={() => handleDeleteRequest(req._id)}
                                className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-600 hover:text-white transition-all shadow-sm"
                                title="Delete"
                           >
                                <FaTrash size={12} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  )))}
                </tbody>
              </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PunchOutRequests;