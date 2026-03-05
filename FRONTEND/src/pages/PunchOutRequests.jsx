
// --- START OF FILE PunchOutRequests.jsx ---

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Swal from "sweetalert2";

// ⚠️ CHECK THIS IMPORT PATH:
import api from "../api"; 
import { 
  FaBell, FaCheckCircle, FaBan, FaCheck, FaTrash, FaSyncAlt, FaFilter 
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
  
  // Filter states
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

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
      Swal.fire("Error", "Failed to load requests", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Filtered and Sorted Logic
  const filteredAndSortedRequests = useMemo(() => {
    let filtered = [...requests];
    
    if (filterEmployee) {
      filtered = filtered.filter(r => 
        (r.employeeName?.toLowerCase().includes(filterEmployee.toLowerCase())) ||
        (r.employeeId?.toLowerCase().includes(filterEmployee.toLowerCase()))
      );
    }
    if (filterStatus) {
      filtered = filtered.filter(r => r.status === filterStatus);
    }
    
    return filtered.sort((a, b) => new Date(b.requestDate) - new Date(a.requestDate));
  }, [requests, filterEmployee, filterStatus]);

  // Initial Fetch
  useEffect(() => {
    fetchPunchOutRequests();
  }, [fetchPunchOutRequests]);

  // Handle Approve / Reject
  const handleRequestAction = async (requestId, status, request) => {
    const confirmResult = await Swal.fire({
      title: `Are you sure?`,
      text: `Do you want to ${status.toLowerCase()} this request?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: status === 'Approved' ? '#10b981' : '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: `Yes, ${status} it!`
    });

    if (!confirmResult.isConfirmed) return;

    Swal.fire({
      title: 'Processing...',
      text: `Please wait while we ${status.toLowerCase()} the request.`,
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    try {
      if (status === 'Approved') {
        if (!request) { 
          Swal.fire("Error", "Request details not found!", "error");
          return; 
        }

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
          Swal.fire("Punch Out Failed", errMsg, "error");
          return; 
        }

        if (punchOutSuccessful) {
            await api.post('/api/punchoutreq/action', { requestId, status });
            setRequests((prev) => prev.map((req) => req._id === requestId ? { ...req, status: 'Approved' } : req));
            Swal.fire("✅ Approved!", "The punch-out has been recorded.", "success");
        }
      } else {
        await api.post('/api/punchoutreq/action', { requestId, status });
        setRequests((prev) => prev.map((req) => req._id === requestId ? { ...req, status: 'Rejected' } : req));
        Swal.fire("Rejected", `Request ${status} successfully.`, "success");
      }
    } catch (error) {
      Swal.fire("Action Failed", (error.response?.data?.message || error.message), "error");
    }
  };

  const handleDeleteRequest = async (requestId) => {
    const confirmDelete = await Swal.fire({
      title: 'Delete Request?',
      text: "This action cannot be undone!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    });

    if (!confirmDelete.isConfirmed) return;

    Swal.fire({
        title: 'Deleting...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
    });

    try {
        await api.delete(`/api/punchoutreq/delete/${requestId}`);
        setRequests((prev) => prev.filter(req => req._id !== requestId));
        Swal.fire("Deleted!", "The request has been removed.", "success");
    } catch (error) {
        Swal.fire("Delete Failed", (error.response?.data?.message || error.message), "error");
    }
  };

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  return (
    <div className="p-4 md:p-8 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <FaBell className="text-blue-600" /> Punch Out Requests
                    </h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                        <span className="text-sm font-bold text-slate-500 uppercase mr-2">Pending</span>
                        <span className="text-xl font-bold text-blue-600">{pendingCount}</span>
                    </div>
                    <button onClick={fetchPunchOutRequests} className="p-2 bg-white text-slate-600 rounded-lg hover:bg-slate-50 border border-slate-200 shadow-sm transition-colors">
                        <FaSyncAlt className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* Filter UI */}
            <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 text-slate-600 font-semibold">
                    <FaFilter size={14} /> <span>Filters:</span>
                </div>
                <input 
                    type="text" 
                    placeholder="Search Name or ID..." 
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:w-64"
                    onChange={(e) => setFilterEmployee(e.target.value)}
                />
                <select 
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                </select>
            </div>
        </div>
        
        {/* Main Content Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden min-h-[500px]">
          <div className="overflow-x-auto">
             <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase font-bold text-xs tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Request Date/Time</th>
                    <th className="px-6 py-4">Shift Date</th>
                    <th className="px-6 py-4">Requested Out Time</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAndSortedRequests.map((req) => (
                    <tr key={req._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{req.employeeName || "Unknown"}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{req.employeeId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-slate-600">{new Date(req.requestDate).toLocaleDateString('en-GB')}</div>
                        <div className="text-xs text-slate-400 font-mono">{new Date(req.requestDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{formatDateDMY(req.originalDate)}</td>
                      <td className="px-6 py-4">
                         <span className="bg-blue-50 text-blue-700 py-1 px-3 rounded-md font-mono font-semibold">
                            {req.requestedPunchOut ? new Date(req.requestedPunchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 italic max-w-xs truncate" title={req.reason}>"{req.reason}"</td>
                      <td className="px-6 py-4 text-center">
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
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {req.status === 'Pending' && (
                            <>
                              <button onClick={() => handleRequestAction(req._id, 'Approved', req)} className="w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all" title="Approve"><FaCheck size={14} /></button>
                              <button onClick={() => handleRequestAction(req._id, 'Rejected', req)} className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all" title="Reject"><FaBan size={14} /></button>
                            </>
                          )}
                          <button onClick={() => handleDeleteRequest(req._id)} className="w-8 h-8 flex items-center justify-center bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-600 hover:text-white transition-all" title="Delete"><FaTrash size={12} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PunchOutRequests;