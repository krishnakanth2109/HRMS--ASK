// --- START OF FILE WorkModeRequests.jsx ---

import React, { useState, useEffect, useCallback } from "react";
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
  FaLaptopHouse
} from "react-icons/fa";

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const getFormattedDays = (days) => {
  const daysMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  if (!days || days.length === 0) return "No days selected";
  return days.sort((a,b)=>a-b).map(d => daysMap[d]).join(", ");
};

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

const WorkModeRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // Sort: Pending first, then by date (newest first)
  const sortedRequests = [...requests].sort((a, b) => {
    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
    if (a.status !== 'Pending' && b.status === 'Pending') return 1;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  return (
    <div className="p-4 md:p-8 bg-slate-100 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Page Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <FaEnvelopeOpenText className="text-blue-600"/> Work Mode Requests
                </h1>
                <p className="text-slate-500 mt-1">Manage employee WFH / WFO change requests</p>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                    <span className="text-sm font-bold text-slate-500 uppercase mr-2">Pending</span>
                    <span className="text-xl font-bold text-blue-600">{pendingCount}</span>
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

           {!loading && sortedRequests.length === 0 ? (
             <div className="bg-white rounded-2xl p-16 flex flex-col items-center justify-center text-slate-400 shadow-sm border border-slate-200">
               <FaCheckCircle size={48} className="mb-4 opacity-20"/>
               <p className="text-lg font-medium">No requests found.</p>
             </div>
           ) : (
             sortedRequests.map(req => (
               <div key={req._id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col md:flex-row gap-5 items-start">
                  
                  {/* Left: Employee & Request Details */}
                  <div className="flex-1 w-full">
                     <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${req.requestedMode === 'WFH' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>
                                {req.requestedMode === 'WFH' ? <FaLaptopHouse /> : <FaBuilding />}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-lg">{req.employeeName}</h4>
                                <p className="text-xs text-slate-500 font-mono">{req.employeeId} • {req.department}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded uppercase border border-slate-200">
                            {req.requestType}
                          </span>
                          {req.status === 'Approved' && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded flex items-center gap-1">
                                <FaCheckCircle/> Approved
                            </span>
                          )}
                          {req.status === 'Rejected' && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded flex items-center gap-1">
                                <FaTimesCircle/> Rejected
                            </span>
                          )}
                          {req.status === 'Pending' && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded flex items-center gap-1">
                                Pending
                            </span>
                          )}
                        </div>
                     </div>
                     
                     <div className="ml-13 pl-13 md:pl-0 mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Requested Mode</span>
                          <span className={`font-bold ${req.requestedMode === 'WFH' ? 'text-green-600' : 'text-blue-600'}`}>
                            {req.requestedMode === 'WFH' ? 'Work From Home' : 'Work From Office'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider block">Duration / Days</span>
                          <span className="text-slate-700 font-medium">
                            {req.requestType === "Temporary" && req.fromDate && req.toDate && 
                                `${new Date(req.fromDate).toLocaleDateString()} ➔ ${new Date(req.toDate).toLocaleDateString()}`
                            }
                            {req.requestType === "Recurring" && getFormattedDays(req.recurringDays)}
                            {req.requestType === "Permanent" && "Indefinite Change"}
                          </span>
                        </div>
                     </div>
                     
                     {req.reason && (
                        <div className="mt-3 text-sm text-slate-600 italic">
                           <span className="font-semibold text-slate-400 text-xs not-italic mr-1">Reason:</span> 
                           "{req.reason}"
                        </div>
                     )}
                  </div>
                  
                  {/* Right: Actions */}
                  <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto min-w-[120px] justify-end border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-5">
                     {req.status === 'Pending' && (
                       <>
                         <button 
                            onClick={() => handleAction(req._id, "Approved")} 
                            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                         >
                           <FaCheck/> Approve
                         </button>
                         <button 
                            onClick={() => handleAction(req._id, "Rejected")} 
                            className="flex-1 md:flex-none bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                         >
                           <FaTimes/> Reject
                         </button>
                       </>
                     )}
                     <button 
                        onClick={() => handleDelete(req._id)} 
                        className="flex-1 md:flex-none text-slate-400 hover:text-red-500 text-xs flex items-center justify-center md:justify-end gap-1 px-3 py-2 hover:bg-slate-50 rounded transition mt-auto"
                     >
                        <FaTrash size={12}/> Delete
                     </button>
                  </div>
               </div>
             ))
           )}
        </div>
      </div>
    </div>
  );
};

export default WorkModeRequests;