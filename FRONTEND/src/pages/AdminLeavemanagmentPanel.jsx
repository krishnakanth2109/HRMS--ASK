// --- START OF FILE AdminLeaveManagementPanel.jsx ---
import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import api, {
  getLeaveRequests,
  getEmployees,
  approveLeaveRequestById,
  rejectLeaveRequestById,
  getAttendanceByDateRange,
} from "../api";
import {
  FaFilter,
  FaCalendarAlt,
  FaCheck,
  FaTimes,
  FaUsers,
  FaClock,
  FaSearch,
  FaChevronDown
} from "react-icons/fa";
import { useLocation } from "react-router-dom";
import Swal from "sweetalert2";

// ✅ Helper to ensure URLs are always HTTPS
const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

// ✅ Helper to calculate number of days
const getDayCount = (from, to) => {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return diffDays || 0;
};

// ✅ Date format helper: Short Month DD, YYYY (e.g. Feb 20, 2026)
const formatDateShort = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

// ✅ Date & Time format for "Applied On"
const formatDateTime = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  return `${day}-${month}-${year} ${hours}:${minutes} ${ampm}`;
};

// ✅ Initials Helper
const getInitials = (name) => {
  if (!name) return "U";
  const parts = name.split(" ");
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0][0].toUpperCase();
};

const AdminLeavePanel = () => {
  const location = useLocation();

  const[leaveList, setLeaveList] = useState([]);
  const [employeesMap, setEmployeesMap] = useState(new Map());
  const [loading, setLoading] = useState(true);

  // --- UI States for Filters & Actions ---
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7)); // Default to Present Month
  const [filterDept, setFilterDept] = useState("All");
  const [filterStatus, setFilterStatus] = useState(
    location.state?.defaultStatus || "All"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const[openDropdownId, setOpenDropdownId] = useState(null);
  
  // ✅ Image States
  const [employeeImages, setEmployeeImages] = useState({});

  // Fetch all data
  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      const[leavesData, employeesData] = await Promise.all([
        getLeaveRequests(),
        getEmployees(),
      ]);

      setLeaveList(leavesData);

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
  },[]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Fetch Images
  useEffect(() => {
    const fetchImages = async () => {
      if (leaveList.length === 0) return;
      const uniqueEmployeeIds =[...new Set(leaveList.map(l => l.employeeId))];
      const newImages = {};

      for (const empId of uniqueEmployeeIds) {
        if (empId && !employeeImages[empId]) {
          try {
            const res = await api.get(`/api/profile/${empId}`);
            if (res.data?.profilePhoto?.url) {
              newImages[empId] = getSecureUrl(res.data.profilePhoto.url);
            }
          } catch (err) { }
        }
      }
      if (Object.keys(newImages).length > 0) {
        setEmployeeImages(prev => ({ ...prev, ...newImages }));
      }
    };
    fetchImages();
  }, [leaveList]);

  const enrichedLeaveList = useMemo(() => {
    return leaveList.map((leave) => {
      const emp = employeesMap.get(leave.employeeId);
      return {
        ...leave,
        employeeName: emp?.name || "Unknown",
        department: emp?.experienceDetails?.[0]?.department || "Unassigned",
      };
    });
  }, [leaveList, employeesMap]);

  const allDepartments = useMemo(() => {
    return Array.from(new Set(Array.from(employeesMap.values()).map((emp) => emp?.experienceDetails?.[0]?.department))).filter(Boolean);
  },[employeesMap]);

  // ✅ Filtering Logic (Search, Dept, Status, Month)
  const filteredRequests = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return enrichedLeaveList.filter((req) => {
      const matchDept = filterDept === "All" || req.department === filterDept;
      const matchStatus = filterStatus === "All" || req.status === filterStatus || (filterStatus === "Today" && req.status === "Approved" && today >= req.from && today <= req.to);
      const matchSearch = req.employeeId?.toLowerCase().includes(searchQuery.toLowerCase()) || req.employeeName?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchMonth = filterMonth ? req.from.startsWith(filterMonth) : true;
      return matchDept && matchStatus && matchSearch && matchMonth;
    });
  }, [enrichedLeaveList, filterDept, filterStatus, searchQuery, filterMonth]);


  // ✅ Helper: Admin Punch Out API call
  const adminPunchOut = async (employeeId, dateOfRecord) => {
    const location = await new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error("Geolocation not supported")); return; }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => reject(new Error("Unable to get location")),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
    const punchOutTime = new Date().toISOString();
    const response = await api.post(`/api/attendance/admin-punch-out`, {
      employeeId,
      punchOutTime,
      latitude: location.latitude,
      longitude: location.longitude,
      adminId: 'Admin',
      date: dateOfRecord,
    });
    return response;
  };

  // ✅ EXACT OLD ACTION HANDLER (Approve/Reject + Working Status Punch-out Check)
  const handleAction = async (id, action) => {
    // 1. Close dropdown immediately
    setOpenDropdownId(null);

    const isApprove = action === 'approve';

    // 2. If approving, check if employee is currently working on a day that overlaps today
    if (isApprove) {
      const leave = enrichedLeaveList.find((l) => l._id === id);
      if (leave) {
        const today = new Date().toISOString().slice(0, 10);
        const leaveCoversToday = today >= leave.from && today <= leave.to;

        if (leaveCoversToday) {
          try {
            // Check today's attendance status
            const todayRecords = await getAttendanceByDateRange(today, today);
            const records = Array.isArray(todayRecords) ? todayRecords :[];
            const todayRecord = records.find(
              (r) => r.employeeId === leave.employeeId
            );

            const isWorking = todayRecord && todayRecord.punchIn && !todayRecord.punchOut;

            if (isWorking) {
              // Show custom SweetAlert with 3 action buttons
              const result = await Swal.fire({
                title: `⚠️ ${leave.employeeName} is Currently Working!`,
                html: `<p style="color:#475569;font-size:14px;margin-top:4px;">This employee is punched in today but not punched out yet.<br/>What would you like to do?</p>`,
                icon: 'warning',
                showCancelButton: true,
                showDenyButton: true,
                confirmButtonText: '🕐 Punch Out & Approve',
                denyButtonText: '✅ Approve Only',
                cancelButtonText: '❌ Reject',
                confirmButtonColor: '#3B82F6',
                denyButtonColor: '#10B981',
                cancelButtonColor: '#EF4444',
                reverseButtons: false,
                allowOutsideClick: false,
              });

              if (result.isDismissed && result.dismiss === Swal.DismissReason.backdrop) return;

              if (result.isConfirmed) {
                // Punch Out & Approve
                try {
                  Swal.fire({ title: 'Processing...', text: 'Punching out and approving leave...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                  await adminPunchOut(leave.employeeId, today);
                  await approveLeaveRequestById(id);
                  await fetchAllData();
                  Swal.fire('Done!', `${leave.employeeName} has been punched out and leave approved.`, 'success');
                } catch (err) {
                  console.error("Punch out & approve failed", err);
                  Swal.fire('Error!', err.message || 'Failed to process. Please try again.', 'error');
                }
                return;
              }

              if (result.isDenied) {
                // Approve only
                try {
                  Swal.fire({ title: 'Processing...', text: 'Approving leave...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                  await approveLeaveRequestById(id);
                  await fetchAllData();
                  Swal.fire('Approved!', 'Leave request has been approved.', 'success');
                } catch (err) {
                  console.error("Approve failed", err);
                  Swal.fire('Error!', 'Failed to approve. Please try again.', 'error');
                }
                return;
              }

              if (result.dismiss === Swal.DismissReason.cancel) {
                // Reject
                try {
                  Swal.fire({ title: 'Processing...', text: 'Rejecting leave...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
                  await rejectLeaveRequestById(id);
                  await fetchAllData();
                  Swal.fire('Rejected!', 'Leave request has been rejected.', 'success');
                } catch (err) {
                  console.error("Reject failed", err);
                  Swal.fire('Error!', 'Failed to reject. Please try again.', 'error');
                }
                return;
              }

              // If user closed the dialog somehow, just return
              return;
            }
          } catch (err) {
            console.warn("Could not check today's attendance status:", err);
          }
        }
      }
    }

    // 3. Standard Confirmation Alert (no working conflict or reject action)
    Swal.fire({
      title: isApprove ? 'Approve Request?' : 'Reject Request?',
      text: `Are you sure you want to ${action} this leave request?`,
      icon: isApprove ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonColor: isApprove ? '#10B981' : '#EF4444',
      cancelButtonColor: '#6B7280',
      confirmButtonText: isApprove ? 'Yes, Approve' : 'Yes, Reject'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          Swal.fire({ title: 'Processing...', text: 'Please wait', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
          
          if (isApprove) {
            await approveLeaveRequestById(id);
          } else {
            await rejectLeaveRequestById(id);
          }
          
          await fetchAllData();
          Swal.fire('Success!', `Leave request has been ${action}d.`, 'success');
        } catch (error) {
          console.error("Action failed", error);
          Swal.fire('Error!', 'Failed to update request. Please try again.', 'error');
        }
      }
    });
  };

  // ✅ UI Helpers
  const LeaveTypeBadge = ({ type }) => {
    let bg = "bg-gray-100", text = "text-gray-600";
    const t = (type || "").toLowerCase();
    
    if (t.includes("vacation")) { bg = "bg-blue-100"; text = "text-blue-500"; }
    else if (t.includes("sick")) { bg = "bg-red-100"; text = "text-red-500"; }
    else if (t.includes("personal")) { bg = "bg-purple-100"; text = "text-purple-500"; }

    return (
      <span className={`px-3 py-0.5 rounded-full text-[10px] font-bold ${bg} ${text} ml-2`}>
        {type || "Leave"}
      </span>
    );
  };

  const DecisionBadge = ({ status }) => {
    const isApproved = status === "Approved";
    return (
      <span className={`px-4 py-1.5 rounded-md text-xs font-bold ${isApproved ? "bg-green-100 text-green-500" : "bg-red-100 text-red-500"}`}>
        {status}
      </span>
    );
  };

  // ✅ Splitting Data (using filteredRequests so searching/filtering affects both views)
  const pendingRequests = filteredRequests.filter(l => l.status === "Pending");
  const recentDecisions = filteredRequests.filter(l => l.status !== "Pending");
  
  const totalEmployeesCount = employeesMap.size;
  const approvedCount = filteredRequests.filter(l => l.status === "Approved").length;
  const rejectedCount = filteredRequests.filter(l => l.status === "Rejected").length;

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600"></div>
    </div>
  );

  return (
    <div className="p-6 md:p-8 bg-white min-h-screen font-sans max-w-[1400px] mx-auto relative">
      
      {/* ✅ INVISIBLE BACKDROP TO CLOSE DROPDOWNS */}
      {openDropdownId && (
        <div
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setOpenDropdownId(null)}
        ></div>
      )}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Leave Management</h2>
          <p className="text-slate-500 mt-1 text-sm">Oversee and manage employee leave requests efficiently.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
            <FaCalendarAlt /> Calendar View
          </button>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-b-4 border-b-blue-500">
          <div className="flex flex-col gap-1">
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-2">
              <FaUsers size={14} />
            </div>
            <div className="text-3xl font-bold text-slate-800">{totalEmployeesCount}</div>
            <div className="text-sm font-semibold text-slate-500">Total Employees</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-b-4 border-b-orange-500">
          <div className="flex flex-col gap-1">
            <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 mb-2">
              <FaClock size={14} />
            </div>
            <div className="text-3xl font-bold text-slate-800">{pendingRequests.length}</div>
            <div className="text-sm font-semibold text-slate-500">Pending Request</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-b-4 border-b-green-500">
          <div className="flex flex-col gap-1">
            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-green-500 mb-2">
              <FaCheck size={14} />
            </div>
            <div className="text-3xl font-bold text-slate-800">{approvedCount}</div>
            <div className="text-sm font-semibold text-slate-500">Approved</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-b-4 border-b-red-500">
          <div className="flex flex-col gap-1">
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-2">
              <FaTimes size={14} />
            </div>
            <div className="text-3xl font-bold text-slate-800">{rejectedCount}</div>
            <div className="text-sm font-semibold text-slate-500">Rejected</div>
          </div>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row gap-4 items-center justify-between z-20 relative">
        <div className="flex flex-wrap gap-3 items-center w-full lg:w-auto">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:border-indigo-300 transition-colors">
            <FaFilter className="text-indigo-500" />
            <span className="font-semibold text-sm">Filters:</span>
          </div>

          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
          />

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
          >
            <option value="All">All Departments</option>
            {allDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm cursor-pointer"
          >
            <option value="All">All Status</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Today">On Leave Today</option>
          </select>
        </div>

        <div className="relative w-full lg:w-80">
          <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search Name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-inner"
          />
        </div>
      </div>

      {/* PENDING REQUESTS SECTION */}
      <div className="border border-slate-200 rounded-2xl bg-white mb-10 overflow-hidden shadow-sm">
        <div className="flex justify-between items-center p-6 border-b border-slate-100 bg-slate-50/30">
          <h3 className="text-xl font-bold text-slate-800">Pending Requests</h3>
          <span className="bg-amber-100 text-amber-700 font-bold px-3 py-1 rounded-full text-xs">
            {pendingRequests.length} Pending
          </span>
        </div>
        
        <div className="flex flex-col">
          {pendingRequests.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-medium">No pending leave requests found.</div>
          ) : (
            pendingRequests.map(lv => {
              const profilePic = employeeImages[lv.employeeId];
              return (
                <div key={lv._id} className="p-6 border-b border-slate-100 last:border-0 flex flex-col xl:flex-row justify-between xl:items-center gap-6 hover:bg-slate-50/80 transition duration-150">
                  
                  {/* Info Section */}
                  <div className="flex gap-4 items-start w-full">
                    {/* Avatar */}
                    <div className="w-12 h-12 rounded-full shrink-0 border border-slate-200 overflow-hidden bg-white flex items-center justify-center font-bold text-slate-700">
                      {profilePic ? (
                        <img src={profilePic} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(lv.employeeName)
                      )}
                    </div>
                    
                    <div className="flex flex-col w-full">
                      {/* Name & Dept Header */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        <span className="font-bold text-slate-800 text-base">{lv.employeeName}</span>
                        <span className="text-xs text-slate-400 font-medium">{lv.department}</span>
                        <LeaveTypeBadge type={lv.leaveType} />
                      </div>

                      {/* Date Data Grid */}
                      <div className="grid grid-cols-3 gap-8 mb-4 max-w-sm">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 mb-1">Start Date</span>
                          <span className="text-sm font-semibold text-slate-700">{formatDateShort(lv.from)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 mb-1">End Date</span>
                          <span className="text-sm font-semibold text-slate-700">{formatDateShort(lv.to)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 mb-1">Duration</span>
                          <span className="text-sm font-semibold text-slate-700">{getDayCount(lv.from, lv.to)} Day{getDayCount(lv.from, lv.to)>1?'s':''}</span>
                        </div>
                      </div>

                      {/* Reason Box */}
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-2 w-full xl:max-w-md">
                        <span className="text-xs text-slate-400 block mb-1">Reason</span>
                        <span className="text-sm text-slate-700 font-medium">{lv.reason}</span>
                      </div>
                      
                      {/* Applied On Label - Restored Full Format */}
                      <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mt-1">
                        <FaClock size={10}/> Applied on {formatDateTime(lv.createdAt || lv.appliedDate)}
                      </span>
                    </div>
                  </div>

                  {/* Actions Section */}
                  <div className="flex gap-3 shrink-0">
                    <button 
                      onClick={() => handleAction(lv._id, 'approve')} 
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg font-bold text-sm shadow-sm transition-colors"
                    >
                      <FaCheck /> Approve
                    </button>
                    <button 
                      onClick={() => handleAction(lv._id, 'reject')} 
                      className="flex items-center gap-2 px-5 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white rounded-lg font-bold text-sm shadow-sm transition-colors"
                    >
                      <FaTimes /> Reject
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* RECENT DECISIONS SECTION */}
      <div className="border border-slate-200 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">Recent Decisions</h3>
          <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
            {recentDecisions.length} Processed
          </span>
        </div>
        
        <div className="flex flex-col divide-y divide-slate-100 border-t border-slate-100">
          {recentDecisions.length === 0 ? (
            <div className="py-10 text-center text-slate-500 font-medium">No recent decisions found for the selected filters.</div>
          ) : (
            recentDecisions.map(lv => {
              const profilePic = employeeImages[lv.employeeId];
              const isDropdownOpen = openDropdownId === lv._id;

              return (
                <div key={lv._id} className="py-4 flex flex-col md:flex-row md:justify-between md:items-center gap-4 hover:bg-slate-50/50 transition duration-150 px-2 rounded-lg -mx-2">
                  <div className="flex gap-4 items-center w-full">
                    <div className="w-10 h-10 rounded-full shrink-0 border border-slate-200 overflow-hidden bg-white flex items-center justify-center font-bold text-slate-700">
                      {profilePic ? (
                        <img src={profilePic} alt="" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(lv.employeeName)
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-bold text-slate-800">{lv.employeeName}</span>
                        <LeaveTypeBadge type={lv.leaveType} />
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs font-medium text-slate-400">
                        <span>{formatDateShort(lv.from)} - {formatDateShort(lv.to)} ({getDayCount(lv.from, lv.to)} days)</span>
                        <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="truncate max-w-[200px]" title={lv.reason}>Reason: {lv.reason}</span>
                      </div>
                    </div>
                  </div>

                  {/* Badges & Actions Dropdown */}
                  <div className="flex items-center gap-3 relative shrink-0">
                    <DecisionBadge status={lv.status} />
                    
                    {/* Action Dropdown Toggle Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenDropdownId(isDropdownOpen ? null : lv._id);
                      }}
                      className={`p-2 rounded-md transition-colors border ${isDropdownOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
                      title="Change Status"
                    >
                      <FaChevronDown size={12} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute right-0 top-10 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-40 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-1.5 space-y-1">
                          <button
                            onClick={() => handleAction(lv._id, "approve")}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <FaCheck size={12} /> Mark Approved
                          </button>
                          <button
                            onClick={() => handleAction(lv._id, "reject")}
                            className="w-full text-left px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition-colors"
                          >
                            <FaTimes size={12} /> Mark Rejected
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
    </div>
  );
};

export default AdminLeavePanel;
// --- END OF FILE AdminLeaveManagementPanel.jsx ---