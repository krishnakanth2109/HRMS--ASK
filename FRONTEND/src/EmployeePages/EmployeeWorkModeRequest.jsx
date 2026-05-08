import React, { useState, useEffect, useContext, useCallback } from "react";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import Swal from "sweetalert2";
import { 
  FaPaperPlane, 
  FaHistory, 
  FaCalendarAlt, 
  FaClock, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaHourglassHalf,
  FaBuilding,
  FaLaptopHouse,
  FaInfinity,
  FaSyncAlt,
  FaCalendarDay,
  FaInfoCircle,
  FaEdit,
  FaTrash,
  FaUndo
} from "react-icons/fa";

const EmployeeWorkModeRequest = () => {
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  
  // Office Config State for Dynamic Status Calculation
  const [officeConfig, setOfficeConfig] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Form State
  const [requestType, setRequestType] = useState("Temporary");
  const [requestedMode, setRequestedMode] = useState("WFH");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [reason, setReason] = useState("");
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState(null);
  const [editRequestType, setEditRequestType] = useState("");
  const [editRequestedMode, setEditRequestedMode] = useState("");
  const [editFromDate, setEditFromDate] = useState("");
  const [editToDate, setEditToDate] = useState("");
  const [editSelectedDays, setEditSelectedDays] = useState([]);
  const [editReason, setEditReason] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);

  const daysOfWeek = [
    { id: 1, label: "Mon" }, { id: 2, label: "Tue" }, { id: 3, label: "Wed" },
    { id: 4, label: "Thu" }, { id: 5, label: "Fri" }, { id: 6, label: "Sat" }, { id: 0, label: "Sun" }
  ];

  useEffect(() => {
    if (user?.employeeId) {
      fetchRequests();
      fetchOfficeSettings();
    }
  }, [user]);

  const fetchRequests = async () => {
    try {
      // ✅ FIX: Updated URL to match adminRoutes structure
      const { data } = await api.get(`/api/admin/requests/my/${user.employeeId}`);
      setRequests(data);
    } catch (err) { console.error("Error fetching requests", err); }
  };

  const fetchOfficeSettings = async () => {
    setStatusLoading(true);
    try {
      // Fetch full settings to calculate detailed description locally
      const { data } = await api.get("/api/admin/settings/office");
      setOfficeConfig(data);
    } catch (err) {
      console.error("Failed to load office settings", err);
    } finally {
      setStatusLoading(false);
    }
  };

  // ✅ LOGIC TO CALCULATE DETAILED STATUS (Same as Dashboard)
  const calculateWorkModeStatus = useCallback(() => {
    const defaults = { 
      mode: officeConfig?.globalWorkMode || 'WFO', 
      description: "Adhering to standard company-wide policy." 
    };

    if (!officeConfig || !user) return defaults;

    const empConfig = officeConfig.employeeWorkModes?.find(e => e.employeeId === user.employeeId);
    
    // If no config found or rule is Global
    if (!empConfig || empConfig.ruleType === "Global") {
      return defaults;
    }

    const today = new Date();
    today.setHours(0,0,0,0);

    // 1. Check Temporary
    if (empConfig.ruleType === "Temporary" && empConfig.temporary) {
      const from = new Date(empConfig.temporary.fromDate);
      const to = new Date(empConfig.temporary.toDate);
      from.setHours(0,0,0,0);
      to.setHours(23,59,59,999);
      
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      const fromStr = new Date(empConfig.temporary.fromDate).toLocaleDateString('en-US', options);
      const toStr = new Date(empConfig.temporary.toDate).toLocaleDateString('en-US', options);

      if (today >= from && today <= to) {
        return {
          mode: empConfig.temporary.mode,
          description: `Temporary schedule active from ${fromStr} to ${toStr}.`
        };
      }
    }

    // 2. Check Recurring
    if (empConfig.ruleType === "Recurring" && empConfig.recurring) {
      const currentDay = new Date().getDay(); // 0=Sun, 1=Mon
      const daysMap = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
      
      // Get readable mode text
      const modeText = empConfig.recurring.mode === "WFH" ? "Remote" : "Work From Office";
      
      // Get all assigned days sorted
      const sortedDays = [...(empConfig.recurring.days || [])].sort((a,b) => a - b);
      const allDaysStr = sortedDays.map(d => daysMap[d]).join(", ");
      
      if (empConfig.recurring.days.includes(currentDay)) {
        return {
          mode: empConfig.recurring.mode,
          description: `Recurring schedule active. Assigned to work ${modeText} on ${allDaysStr}.`
        };
      } else {
        // Even if not active today, show the recurring schedule details
        return {
            ...defaults,
            description: `Recurring schedule exists (${modeText} on ${allDaysStr}), but today follows Global settings.`
        };
      }
    }

    // 3. Check Permanent
    if (empConfig.ruleType === "Permanent") {
      return {
        mode: empConfig.permanentMode,
        description: "Permanently assigned override by administration."
      };
    }

    return defaults;
  }, [officeConfig, user]);

  const toggleDay = (id) => {
    setSelectedDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (requestType === "Temporary" && (!fromDate || !toDate)) return Swal.fire("Missing Dates", "Please select a start and end date.", "warning");
    if (requestType === "Recurring" && selectedDays.length === 0) return Swal.fire("Missing Days", "Please select at least one day for the recurring schedule.", "warning");
    if (!reason.trim()) return Swal.fire("Missing Reason", "Please provide a reason for this request.", "warning");

    const payload = {
      employeeId: user.employeeId,
      employeeName: user.name,
      department: user.department || user.experienceDetails?.[user.experienceDetails.length - 1]?.department || "N/A",
      requestType,
      requestedMode,
      fromDate: requestType === "Temporary" ? fromDate : null,
      toDate: requestType === "Temporary" ? toDate : null,
      recurringDays: requestType === "Recurring" ? selectedDays : [],
      reason
    };

    try {
      setLoading(true);
      // ✅ FIX: Updated URL to match adminRoutes structure
      await api.post("/api/admin/request", payload);
      Swal.fire({
        title: "Submitted!",
        text: "Your request has been sent to administration.",
        icon: "success",
        confirmButtonColor: "#3b82f6"
      });
      setReason("");
      setSelectedDays([]);
      setFromDate("");
      setToDate("");
      fetchRequests(); // Refresh history
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Submission failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (req) => {
    setEditingRequest(req);
    setEditRequestType(req.requestType);
    setEditRequestedMode(req.requestedMode);
    setEditFromDate(req.fromDate ? req.fromDate.split('T')[0] : "");
    setEditToDate(req.toDate ? req.toDate.split('T')[0] : "");
    setEditSelectedDays(req.recurringDays || []);
    setEditReason(req.reason || "");
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (editRequestType === "Temporary" && (!editFromDate || !editToDate)) return Swal.fire("Missing Dates", "Please select a start and end date.", "warning");
    if (editRequestType === "Recurring" && editSelectedDays.length === 0) return Swal.fire("Missing Days", "Please select at least one day for the recurring schedule.", "warning");
    if (!editReason.trim()) return Swal.fire("Missing Reason", "Please provide a reason for this request.", "warning");

    const payload = {
      requestType: editRequestType,
      requestedMode: editRequestedMode,
      fromDate: editRequestType === "Temporary" ? editFromDate : null,
      toDate: editRequestType === "Temporary" ? editToDate : null,
      recurringDays: editRequestType === "Recurring" ? editSelectedDays : [],
      reason: editReason
    };

    try {
      setUpdateLoading(true);
      await api.put(`/api/admin/requests/update/${editingRequest._id}`, payload);
      Swal.fire({
        title: "Updated!",
        text: "Your request has been successfully updated.",
        icon: "success",
        confirmButtonColor: "#3b82f6"
      });
      setIsEditModalOpen(false);
      fetchRequests();
    } catch (err) {
      Swal.fire("Error", err.response?.data?.message || "Update failed", "error");
    } finally {
      setUpdateLoading(false);
    }
  };

  const toggleEditDay = (id) => {
    setEditSelectedDays(prev => prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]);
  };

  const handleWithdraw = async (id) => {
    const result = await Swal.fire({
      title: "Withdraw Request?",
      text: "Are you sure you want to withdraw this pending request?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, withdraw it!"
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/admin/requests/withdraw/${id}`);
        Swal.fire("Withdrawn!", "Your request has been withdrawn.", "success");
        fetchRequests();
      } catch (err) {
        Swal.fire("Error", err.response?.data?.message || "Withdrawal failed", "error");
      }
    }
  };



  // --- UI HELPER COMPONENTS ---

  const RequestTypeCard = ({ type, icon, title, desc }) => (
    <div 
      onClick={() => setRequestType(type)}
      className={`cursor-pointer p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${requestType === type ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'}`}
    >
      <div className={`p-2 rounded-full ${requestType === type ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
        {icon}
      </div>
      <div>
        <h4 className={`font-bold text-sm ${requestType === type ? 'text-blue-900' : 'text-gray-700'}`}>{title}</h4>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
  );

  const ModeRadio = ({ mode, icon, label }) => (
    <label className={`flex-1 cursor-pointer p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-2 ${requestedMode === mode ? (mode === 'WFH' ? 'border-green-500 bg-green-50 text-green-700' : 'border-blue-500 bg-blue-50 text-blue-700') : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
      <input type="radio" name="reqMode" className="hidden" checked={requestedMode === mode} onChange={() => setRequestedMode(mode)} />
      <div className="text-2xl">{icon}</div>
      <span className="font-bold text-sm">{label}</span>
    </label>
  );

  const renderCurrentStatus = () => {
    if (statusLoading) return <div className="animate-pulse h-32 bg-gray-200 rounded-xl mb-8"></div>;
    
    // Get detailed status from logic
    const { mode, description } = calculateWorkModeStatus();
    
    const isWFO = mode === "WFO";
    const statusColor = isWFO ? "bg-gradient-to-r from-blue-600 to-indigo-700" : "bg-gradient-to-r from-green-500 to-emerald-600";
    
    return (
      <div className={`${statusColor} rounded-2xl md:rounded-3xl p-6 md:p-8 text-white shadow-xl mb-10 relative overflow-hidden`}>
        {/* Background Icon */}
        <div className="absolute top-0 right-0 p-4 opacity-10 translate-x-1/4 -translate-y-1/4">
          {isWFO ? <FaBuilding size={150} /> : <FaLaptopHouse size={150} />}
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-[10px] md:text-xs uppercase tracking-[0.2em] font-black opacity-70 mb-2">Current Active Mode</h2>
            <div className="flex items-center gap-4">
              <span className="text-2xl md:text-4xl font-black tracking-tight">{isWFO ? "Work From Office" : "Work From Home"}</span>
              <div className="bg-white/20 p-2 md:p-3 rounded-2xl backdrop-blur-sm border border-white/20 shadow-lg">
                  {isWFO ? <FaBuilding size={24}/> : <FaLaptopHouse size={24}/>}
              </div>
            </div>
          </div>

          <div className="bg-black/20 backdrop-blur-md p-4 md:p-5 rounded-2xl border border-white/10 max-w-sm">
            <div className="flex items-start gap-3">
              <FaInfoCircle className="mt-1 flex-shrink-0 opacity-50" size={14} />
              <p className="text-xs md:text-sm font-medium leading-relaxed opacity-90">{description}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case "Approved": return <span className="flex items-center gap-1.5 text-green-700 bg-green-100 border border-green-200 px-2.5 py-1 rounded-full text-xs font-bold"><FaCheckCircle/> Approved</span>;
      case "Rejected": return <span className="flex items-center gap-1.5 text-red-700 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full text-xs font-bold"><FaTimesCircle/> Rejected</span>;
      case "Withdrawn": return <span className="flex items-center gap-1.5 text-gray-700 bg-gray-100 border border-gray-200 px-2.5 py-1 rounded-full text-xs font-bold"><FaUndo/> Withdrawn</span>;
      default: return <span className="flex items-center gap-1.5 text-yellow-700 bg-yellow-100 border border-yellow-200 px-2.5 py-1 rounded-full text-xs font-bold"><FaHourglassHalf/> Pending</span>;
    }
  };

  const pendingRequests = requests.filter(req => req.status === "Pending");
  const historyRequests = requests.filter(req => req.status !== "Pending");

  return (
    <>
      <div className="p-4 md:p-8 min-h-screen font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* 1. PINNED CURRENT STATUS */}
        {renderCurrentStatus()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          
          {/* 2. REQUEST FORM (Left Column) */}
          <div className="space-y-6 col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FaPaperPlane className="text-blue-600" /> New Request
              </h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                
                {/* Request Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Request Type</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <RequestTypeCard type="Temporary" icon={<FaCalendarAlt />} title="Temporary" desc="Specific dates" />
                    <RequestTypeCard type="Recurring" icon={<FaSyncAlt />} title="Recurring" desc="Weekly days" />
                    <RequestTypeCard type="Permanent" icon={<FaInfinity />} title="Permanent" desc="Indefinite change" />
                  </div>
                </div>

                {/* Mode Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Desired Work Mode</label>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <ModeRadio mode="WFO" icon={<FaBuilding />} label="Work From Office" />
                    <ModeRadio mode="WFH" icon={<FaLaptopHouse />} label="Work From Home" />
                  </div>
                </div>

                {/* Conditional Fields */}
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 transition-all">
                  {requestType === "Temporary" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">From Date</label>
                        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">To Date</label>
                        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                      </div>
                    </div>
                  )}

                  {requestType === "Recurring" && (
                    <div className="animate-fade-in">
                      <label className="block text-sm font-bold text-gray-700 mb-3">Select Days of the Week</label>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map(day => (
                          <button 
                            type="button"
                            key={day.id} 
                            onClick={() => toggleDay(day.id)}
                            className={`w-10 h-10 rounded-full text-xs font-bold transition-all shadow-sm ${selectedDays.includes(day.id) ? "bg-blue-600 text-white transform scale-110" : "bg-white text-gray-600 border border-gray-200 hover:bg-blue-50"}`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Selected days will apply weekly.</p>
                    </div>
                  )}

                  {requestType === "Permanent" && (
                    <div className="text-sm text-gray-600 italic animate-fade-in flex items-center gap-2">
                      <FaInfinity className="text-orange-500"/> This will override your global settings indefinitely until changed.
                    </div>
                  )}
                </div>

                {/* Reason Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reason for Request</label>
                  <textarea 
                    value={reason} 
                    onChange={(e) => setReason(e.target.value)} 
                    placeholder="Briefly explain why you need this change..."
                    className="w-full p-3 border border-gray-300 rounded-xl h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold text-lg hover:bg-black transition shadow-lg transform active:scale-[0.99] flex justify-center items-center gap-2"
                >
                  {loading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"/> : <><FaPaperPlane size={16} /> Submit Request</>}
                </button>
              </form>
            </div>
          </div>

          {/* 3. PENDING REQUESTS (Right Column) */}
          <div className="col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full max-h-[800px]">
              <div className="p-5 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <FaHourglassHalf className="text-yellow-500" /> Pending Requests
                </h3>
                {pendingRequests.length > 0 && <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-0.5 rounded-full">{pendingRequests.length}</span>}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {pendingRequests.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl flex flex-col items-center">
                    <FaHourglassHalf size={30} className="mb-3 opacity-10"/>
                    <p className="text-sm font-bold">No Pending Requests</p>
                  </div>
                ) : (
                  pendingRequests.map(req => (
                    <div key={req._id} className="bg-white p-4 rounded-2xl border border-yellow-100 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400"></div>
                      
                      <div className="flex justify-between items-start mb-3 pl-1">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${req.requestType === 'Permanent' ? 'bg-orange-100 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                          {req.requestType}
                        </span>
                        <span className="text-[10px] text-gray-400">{new Date(req.createdAt).toLocaleDateString()}</span>
                      </div>

                      <div className="flex items-center gap-2 mb-3 pl-1">
                        <div className={`p-1.5 rounded-lg ${req.requestedMode === 'WFH' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                          {req.requestedMode === 'WFH' ? <FaLaptopHouse size={16}/> : <FaBuilding size={16}/>}
                        </div>
                        <span className={`font-black text-sm tracking-tight ${req.requestedMode === 'WFH' ? 'text-green-700' : 'text-blue-700'}`}>
                          {req.requestedMode === 'WFH' ? 'Remote' : 'Office'}
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="text-[11px] text-gray-600 flex items-start gap-2 bg-gray-50/80 p-2 rounded-xl border border-gray-100">
                          <FaCalendarDay className="mt-0.5 text-gray-400" size={10}/>
                          <span>
                            {req.requestType === "Temporary" && `${new Date(req.fromDate).toLocaleDateString()} ➝ ${new Date(req.toDate).toLocaleDateString()}`}
                            {req.requestType === "Recurring" && `Repeats: ${req.recurringDays.length} days/week`}
                            {req.requestType === "Permanent" && "Permanent Change"}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button onClick={() => handleEditClick(req)} className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-colors">Modify</button>
                        <button onClick={() => handleWithdraw(req._id)} className="flex-1 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-100 transition-colors">Withdraw</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. REQUEST HISTORY SECTION (Full Width Bottom) */}
        <div className="mt-12">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <FaHistory className="text-indigo-600" /> Request History
                </h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">Summary of all your past work mode applications</p>
              </div>
            </div>
            
            <div className="p-0">
              {historyRequests.length === 0 ? (
                <div className="text-center py-16 text-gray-400 flex flex-col items-center p-6">
                  <FaHistory size={40} className="mb-3 opacity-10"/>
                  <p className="font-bold">Your history is currently empty.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-gray-100">
                  {historyRequests.map(req => (
                    <div key={req._id} className="flex flex-col md:flex-row md:items-center justify-between p-5 md:p-6 hover:bg-indigo-50/20 transition-all gap-5 group">
                        {/* Entry Main Info */}
                        <div className="flex items-center gap-4 flex-1">
                            <div className={`p-4 rounded-[1.25rem] shadow-sm flex-shrink-0 ${req.requestedMode === 'WFH' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                                {req.requestedMode === 'WFH' ? <FaLaptopHouse size={24}/> : <FaBuilding size={24}/>}
                            </div>
                            <div className="flex flex-col">
                                <span className={`font-black text-base md:text-sm tracking-tight ${req.requestedMode === 'WFH' ? 'text-green-800' : 'text-blue-800'}`}>
                                    {req.requestedMode === 'WFH' ? 'Work From Home' : 'Work From Office'}
                                </span>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{req.requestType}</span>
                                  <span className="hidden md:block w-1 h-1 bg-gray-300 rounded-full"></span>
                                  <span className="text-[10px] font-bold text-gray-400">Created: {new Date(req.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div className="flex-1 md:px-4">
                            <div className="text-[11px] md:text-xs text-gray-600 font-bold flex items-center gap-2.5 bg-gray-50/80 px-4 py-2 rounded-xl w-fit border border-gray-100/50">
                                <FaCalendarDay className="text-indigo-400" size={14}/>
                                <span>
                                    {req.requestType === "Temporary" && `${new Date(req.fromDate).toLocaleDateString()} ➝ ${new Date(req.toDate).toLocaleDateString()}`}
                                    {req.requestType === "Recurring" && `Repeats: ${req.recurringDays.length} days/week`}
                                    {req.requestType === "Permanent" && "Indefinite Change"}
                                </span>
                            </div>
                        </div>

                        {/* Reason - Hidden on mobile, visible as a block or in row on desktop */}
                        <div className="flex-1 max-w-sm hidden xl:block">
                             {req.reason && (
                                <p className="text-xs text-gray-400 italic truncate border-l-2 border-gray-100 pl-4 py-1" title={req.reason}>
                                  "{req.reason}"
                                </p>
                             )}
                        </div>

                        {/* Status */}
                        <div className="flex items-center md:min-w-[140px] justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                            <div className="transform scale-90 md:scale-100 origin-left md:origin-right">
                              {getStatusBadge(req.status)}
                            </div>
                        </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  </div>

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <FaEdit className="text-blue-600" /> Edit Work Mode Request
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <FaTimesCircle size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Read-Only Info */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Employee ID</label>
                  <p className="text-sm font-semibold text-gray-800">{editingRequest?.employeeId}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Employee Name</label>
                  <p className="text-sm font-semibold text-gray-800">{editingRequest?.employeeName}</p>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Current Status</label>
                  <div className="mt-1">{getStatusBadge(editingRequest?.status)}</div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase">Department</label>
                  <p className="text-sm font-semibold text-gray-800">{editingRequest?.department || "N/A"}</p>
                </div>
              </div>

              <form onSubmit={handleUpdate} className="space-y-6">
                {/* Request Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Select Request Type</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div onClick={() => setEditRequestType("Temporary")} className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${editRequestType === "Temporary" ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className={`p-2 rounded-full ${editRequestType === "Temporary" ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}><FaCalendarAlt size={14}/></div>
                      <span className={`font-bold text-xs ${editRequestType === "Temporary" ? 'text-blue-900' : 'text-gray-700'}`}>Temporary</span>
                    </div>
                    <div onClick={() => setEditRequestType("Recurring")} className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${editRequestType === "Recurring" ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className={`p-2 rounded-full ${editRequestType === "Recurring" ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}><FaSyncAlt size={14}/></div>
                      <span className={`font-bold text-xs ${editRequestType === "Recurring" ? 'text-blue-900' : 'text-gray-700'}`}>Recurring</span>
                    </div>
                    <div onClick={() => setEditRequestType("Permanent")} className={`cursor-pointer p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${editRequestType === "Permanent" ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <div className={`p-2 rounded-full ${editRequestType === "Permanent" ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}><FaInfinity size={14}/></div>
                      <span className={`font-bold text-xs ${editRequestType === "Permanent" ? 'text-blue-900' : 'text-gray-700'}`}>Permanent</span>
                    </div>
                  </div>
                </div>

                {/* Mode Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Desired Work Mode</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 cursor-pointer p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${editRequestedMode === "WFO" ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                      <input type="radio" name="editReqMode" className="hidden" checked={editRequestedMode === "WFO"} onChange={() => setEditRequestedMode("WFO")} />
                      <FaBuilding size={20}/>
                      <span className="font-bold text-xs">Work From Office</span>
                    </label>
                    <label className={`flex-1 cursor-pointer p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${editRequestedMode === "WFH" ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 text-gray-600'}`}>
                      <input type="radio" name="editReqMode" className="hidden" checked={editRequestedMode === "WFH"} onChange={() => setEditRequestedMode("WFH")} />
                      <FaLaptopHouse size={20}/>
                      <span className="font-bold text-xs">Work From Home</span>
                    </label>
                  </div>
                </div>

                {/* Conditional Fields */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  {editRequestType === "Temporary" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">From Date</label>
                        <input type="date" value={editFromDate} onChange={(e) => setEditFromDate(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded-lg outline-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">To Date</label>
                        <input type="date" value={editToDate} onChange={(e) => setEditToDate(e.target.value)} className="w-full p-2 text-sm border border-gray-300 rounded-lg outline-none" />
                      </div>
                    </div>
                  )}

                  {editRequestType === "Recurring" && (
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-2">Select Days</label>
                      <div className="flex flex-wrap gap-2">
                        {daysOfWeek.map(day => (
                          <button type="button" key={day.id} onClick={() => toggleEditDay(day.id)} className={`w-8 h-8 rounded-full text-[10px] font-bold transition-all ${editSelectedDays.includes(day.id) ? "bg-blue-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {editRequestType === "Permanent" && (
                    <p className="text-xs text-gray-600 italic flex items-center gap-2"><FaInfinity className="text-orange-500"/> Indefinite override change.</p>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Reason for Request</label>
                  <textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl h-24 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition">Cancel</button>
                  <button type="submit" disabled={updateLoading} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition flex justify-center items-center gap-2">
                    {updateLoading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"/> : "Update Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeeWorkModeRequest;