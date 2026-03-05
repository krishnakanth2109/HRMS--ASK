import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import * as FileSaver from "file-saver";
import * as XLSX from "xlsx";
import api, { getAttendanceByDateRange, getAllOvertimeRequests, getEmployees, getAllShifts, getHolidays } from "../api";
import { FaCalendarAlt, FaUsers, FaFileExcel, FaClock, FaCheckCircle, FaEye, FaTimes, FaMapMarkerAlt, FaUserSlash, FaSignOutAlt, FaShareAlt, FaSearch, FaBriefcase, FaUserTimes, FaFilter, FaCalendarDay, FaExchangeAlt, FaCheck, FaHome, FaList, FaLayerGroup, FaChevronDown, FaChevronUp, FaInfoCircle } from "react-icons/fa";
import { toBlob } from 'html-to-image';

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

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

const getShiftDurationInHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 9;
  const [startH, startM] = startTime.split(':').map(Number);
  const[endH, endM] = endTime.split(':').map(Number);
  let diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
  if (diffMinutes < 0) diffMinutes += 24 * 60;
  return Math.round((diffMinutes / 60) * 10) / 10;
};

const formatDecimalHours = (decimalHours) => {
  if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours)) return "0h 0m";
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const getCurrentDepartment = (employee) => {
  if (employee.currentDepartment) return employee.currentDepartment;
  if (employee && Array.isArray(employee.experienceDetails)) {
    const currentExp = employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present");
    return currentExp?.department || "N/A";
  }
  return "N/A";
};

const getCurrentRole = (employee) => {
  if (employee.currentRole) return employee.currentRole;
  if (employee && Array.isArray(employee.experienceDetails)) {
    const currentExp = employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present");
    return currentExp?.role || "N/A";
  }
  return "N/A";
};

const getWorkedStatus = (punchIn, punchOut, apiStatus, fullDayThreshold, halfDayThreshold) => {
  const statusUpper = (apiStatus || "").toUpperCase();
  if (statusUpper === "LEAVE") return "Leave";
  if (statusUpper === "HOLIDAY") return "Holiday";
  if (statusUpper === "ABSENT" && !punchIn) return "Absent";
  if (punchIn && !punchOut) return "Working..";
  if (!punchIn) return "Absent";
  const workedMilliseconds = new Date(punchOut) - new Date(punchIn);
  const workedHours = workedMilliseconds / (1000 * 60 * 60);
  if (workedHours >= fullDayThreshold) return "Full Day";
  if (workedHours >= halfDayThreshold) return "Half Day";
  return "Absent";
};

const LocationViewButton = ({ location }) => {
  if (!location || !location.latitude || !location.longitude) {
    return <span className="text-gray-400 text-xs font-medium">No Loc</span>;
  }
  const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  return (
    <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-[11px] font-semibold mt-1 bg-blue-50 px-2 py-0.5 rounded-full transition-colors" title={location.address || 'View on Google Maps'}>
      <FaMapMarkerAlt size={10} /> View Map
    </a>
  );
};

const calculateLoginStatus = (punchInTime, shiftData, apiStatus) => {
  if (!punchInTime) return "--";
  if (apiStatus === "LATE") return "LATE";
  if (shiftData && shiftData.shiftStartTime) {
    try {
      const punchDate = new Date(punchInTime);
      const [sHour, sMin] = shiftData.shiftStartTime.split(':').map(Number);
      const shiftDate = new Date(punchDate);
      shiftDate.setHours(sHour, sMin, 0, 0);
      const grace = shiftData.lateGracePeriod || 15;
      shiftDate.setMinutes(shiftDate.getMinutes() + grace);
      if (punchDate > shiftDate) return "LATE";
    } catch (e) {
      console.error("Date calc error", e);
    }
  }
  return "ON_TIME";
};

const normalizeDateStr = (dateInput) => {
  const d = new Date(dateInput);
  return d.toISOString().split('T')[0];
};

const isHoliday = (dateStr, holidays) => {
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  if (!Array.isArray(holidays)) return null;
  return holidays.find(h => {
    const start = new Date(h.startDate);
    const end = new Date(h.endDate || h.startDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    return target >= start && target <= end;
  });
};

const LiveTimer = ({ startTime }) => {
  const[timeStr, setTimeStr] = useState("0h 0m 0s");
  useEffect(() => {
    if (!startTime) return;
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(startTime);
      const diffMs = now - start;
      if (diffMs < 0) { setTimeStr("0h 0m 0s"); return; }
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      setTimeStr(`${hours}h ${minutes}m ${seconds}s`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);
  return <span className="text-blue-600 font-mono font-bold animate-pulse bg-blue-50 px-2 py-1 rounded-md">{timeStr}</span>;
};

// ==========================================
// ✅ Attendance Comparison Modal
// ==========================================
const AttendanceComparisonModal = ({ isOpen, onClose, selectedStats, employeeImages, startDate, endDate }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-[100] flex justify-center items-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <FaExchangeAlt className="text-blue-600" /> Attendance Comparison
            </h2>
            <p className="text-gray-500 font-medium text-sm mt-1">{formatDateDMY(startDate)} to {formatDateDMY(endDate)}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"><FaTimes size={20} /></button>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-gray-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {selectedStats.map(emp => (
              <div key={emp.employeeId} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-5 border-b border-gray-100 bg-white flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full border border-gray-200 overflow-hidden bg-gray-50 flex-shrink-0">
                    {employeeImages[emp.employeeId] ? (
                      <img src={employeeImages[emp.employeeId]} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-gray-400">{emp.employeeName.charAt(0)}</div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-800 leading-tight">{emp.employeeName}</h4>
                    <p className="text-sm font-mono text-gray-500 mt-0.5">{emp.employeeId}</p>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Present Days</p>
                      <p className="text-2xl font-black text-blue-700 mt-1">{emp.presentDays}</p>
                    </div>
                    <div className="bg-red-50/50 border border-red-100 p-3 rounded-xl text-center">
                      <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Absent Days</p>
                      <p className="text-2xl font-black text-red-700 mt-1">{emp.absentDays}</p>
                    </div>
                  </div>

                  <div className="space-y-1 mt-4">
                    <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                      <span className="text-sm font-medium text-gray-500">On Time</span>
                      <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">{emp.onTimeDays}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                      <span className="text-sm font-medium text-gray-500">Late Arrivals</span>
                      <span className="font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md">{emp.lateDays}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                      <span className="text-sm font-medium text-gray-500">Full Days</span>
                      <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">{emp.fullDays}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5 border-b border-gray-50">
                      <span className="text-sm font-medium text-gray-500">Half Days</span>
                      <span className="font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">{emp.halfDays}</span>
                    </div>
                    <div className="flex justify-between items-center py-2.5">
                      <span className="text-sm font-medium text-gray-500">Approved OT</span>
                      <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">{emp.approvedOT}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button onClick={onClose} className="px-6 py-2.5 bg-gray-800 text-white font-semibold text-sm rounded-xl hover:bg-gray-900 transition-colors shadow-sm">Close Comparison</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// SUB-COMPONENTS (MODALS & PAGINATION)
// ==========================================

const AdminPunchOutModal = ({ isOpen, onClose, employee, onPunchOut }) => {
  const [punchOutDateTime, setPunchOutDateTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const[locationLoading, setLocationLoading] = useState(true);
  const[locationError, setLocationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setPunchOutDateTime(localDateTime);
      setLocationLoading(true);
      setLocationError('');
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => { setCurrentLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setLocationLoading(false); },
          (error) => { setLocationError('Unable to get location.'); setLocationLoading(false); },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else { setLocationError('Geolocation not supported.'); setLocationLoading(false); }
    }
  }, [isOpen, employee]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!punchOutDateTime) { alert('Please select a punch out time'); return; }
    if (locationLoading) { alert('Getting location...'); return; }
    if (locationError || !currentLocation) { alert('Location required.'); return; }
    const selectedTime = new Date(punchOutDateTime);
    const punchInTime = new Date(employee.punchIn);
    if (selectedTime <= punchInTime) { alert('Must be after punch in'); return; }
    setLoading(true);
    try { await onPunchOut(employee.employeeId, selectedTime.toISOString(), currentLocation, employee.date); onClose(); } catch (error) { } finally { setLoading(false); }
  };

  if (!isOpen || !employee) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <div><h3 className="text-xl font-bold text-gray-800">Admin Punch Out</h3><p className="text-sm text-gray-500 font-medium mt-0.5">{employee.employeeName}</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-full transition-colors"><FaTimes size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-sm"><span className="text-blue-800 font-medium">Record Date:</span><span className="text-blue-900 font-bold bg-blue-100/50 px-2 py-1 rounded-md">{formatDateDMY(employee.date)}</span></div>
            <div className="flex justify-between items-center text-sm"><span className="text-blue-800 font-medium">Punch In Time:</span><span className="text-green-700 font-bold bg-green-50 px-2 py-1 rounded-md">{new Date(employee.punchIn).toLocaleString()}</span></div>
          </div>
          <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2"><FaMapMarkerAlt className="text-blue-600" /><span className="text-sm font-bold text-gray-700">Location Status</span></div>
            {locationLoading ? <p className="text-sm font-medium text-gray-500 animate-pulse">Getting location...</p> : locationError ? <p className="text-sm font-medium text-red-600">{locationError}</p> : <p className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg inline-block">✓ Location acquired</p>}
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700">Select Punch Out Time <span className="text-red-500">*</span></label>
            <input type="datetime-local" value={punchOutDateTime} onChange={(e) => setPunchOutDateTime(e.target.value)} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-gray-700" />
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors" disabled={loading}>Cancel</button>
            <button type="submit" disabled={loading || locationLoading || !!locationError} className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:bg-blue-300 transition-colors shadow-sm">{loading ? 'Processing...' : 'Confirm Punch Out'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AttendanceDetailModal = ({ isOpen, onClose, employeeData, shiftsMap, holidays, dateRange, employeeImages }) => {
  const contentRef = useRef(null);
  const [viewMode, setViewMode] = useState("daily"); // "daily" or "weekly"
  const [expandedWeeks, setExpandedWeeks] = useState({});

  const completeHistory = useMemo(() => {
    if (!isOpen || !employeeData || !dateRange.startDate || !dateRange.endDate) return[];
    const history =[];
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    const shift = shiftsMap[employeeData.employeeId];
    const weeklyOffs = shift?.weeklyOffDays || [0];
    const adminFullDayHours = shift?.fullDayHours || 9;
    const adminHalfDayHours = shift?.halfDayHours || 4.5;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayOfWeek = d.getDay();
      const record = employeeData.records.find(r => normalizeDateStr(r.date) === dateStr);
      const holidayObj = isHoliday(dateStr, holidays);
      const isWeeklyOff = weeklyOffs.includes(dayOfWeek);
      const isWorkingDay = !holidayObj && !isWeeklyOff;
      let workedStatus = "--"; let loginStatus = "--"; let displayTime = "--"; let punchIn = null; let punchOut = null; let rowClass = ""; let shiftDuration = adminFullDayHours;
      let actualWorkedHours = 0;

      if (record) {
        punchIn = record.punchIn; punchOut = record.punchOut; displayTime = record.displayTime;
        loginStatus = calculateLoginStatus(record.punchIn, shift, record.loginStatus);
        workedStatus = getWorkedStatus(record.punchIn, record.punchOut, record.status, adminFullDayHours, adminHalfDayHours);

        if (punchIn && punchOut) {
          actualWorkedHours = (new Date(punchOut) - new Date(punchIn)) / (1000 * 60 * 60);
        }

        if (workedStatus === "Absent") rowClass = "bg-red-50/30 hover:bg-red-50";
        else if (workedStatus === "Half Day") rowClass = "bg-yellow-50/30 hover:bg-yellow-50";
        else rowClass = "bg-white hover:bg-gray-50/80";
      } else {
        if (isWorkingDay) { workedStatus = "Absent (Not Logged In)"; rowClass = "bg-red-50/50 hover:bg-red-50"; }
        else if (holidayObj) { workedStatus = `Holiday: ${holidayObj.name}`; rowClass = "bg-purple-50/30 text-purple-700 hover:bg-purple-50"; shiftDuration = 0; }
        else if (isWeeklyOff) { workedStatus = "Weekly Off"; rowClass = "bg-gray-50 text-gray-500 hover:bg-gray-100"; shiftDuration = 0; }
      }
      history.push({ date: dateStr, punchIn, punchOut, shiftHours: shiftDuration, actualWorkedHours, displayTime, loginStatus, workedStatus, isWorkingDay, isAbsent: workedStatus.includes("Absent"), isFullDay: workedStatus === "Full Day", isHalfDay: workedStatus === "Half Day", isPresent: !!punchIn, rowClass });
    }
    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
  },[isOpen, employeeData, shiftsMap, holidays, dateRange]);

  const weeklyHistory = useMemo(() => {
    if (viewMode !== "weekly") return[];

    const weeks = {};
    const sortedDaily =[...completeHistory].sort((a, b) => new Date(a.date) - new Date(b.date));

    sortedDaily.forEach(day => {
      const date = new Date(day.date);
      const dayOfWeek = date.getDay();
      const diff = date.getDate() - dayOfWeek;
      const weekStart = new Date(date.setDate(diff));
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!weeks[weekKey]) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weeks[weekKey] = {
          weekStart: weekKey,
          weekEnd: weekEnd.toISOString().split('T')[0],
          days:[],
          totalHours: 0,
          stats: { full: 0, half: 0, absent: 0, late: 0 }
        };
      }

      weeks[weekKey].days.push(day);
      weeks[weekKey].totalHours += day.actualWorkedHours || 0;

      // Update Weekly Stats
      if (day.isWorkingDay) {
        if (day.isFullDay) weeks[weekKey].stats.full++;
        else if (day.isHalfDay) weeks[weekKey].stats.half++;
        else if (day.isAbsent) weeks[weekKey].stats.absent++;
        if (day.loginStatus === "LATE") weeks[weekKey].stats.late++;
      }
    });

    return Object.values(weeks).sort((a, b) => new Date(b.weekStart) - new Date(a.weekStart));
  },[completeHistory, viewMode]);

  const toggleWeekExpansion = (weekKey) => {
    setExpandedWeeks(prev => ({ ...prev, [weekKey]: !prev[weekKey] }));
  };

  const stats = useMemo(() => {
    return completeHistory.reduce((acc, curr) => {
      if (curr.isWorkingDay) acc.workingDays++;
      if (curr.isPresent) acc.present++;
      if (curr.isFullDay) acc.fullDays++;
      if (curr.isHalfDay) acc.halfDays++;
      if (curr.isAbsent) acc.absent++;
      return acc;
    }, { workingDays: 0, present: 0, fullDays: 0, halfDays: 0, absent: 0 });
  }, [completeHistory]);

  if (!isOpen || !employeeData) return null;

  const downloadIndividualReport = () => {
    if (completeHistory.length === 0) return;
    const formattedData = completeHistory.map(item => ({ "Date": formatDateDMY(item.date), "Punch In": item.punchIn ? new Date(item.punchIn).toLocaleTimeString() : "--", "Punch Out": item.punchOut ? new Date(item.punchOut).toLocaleTimeString() : "--", "Assigned Hrs": formatDecimalHours(item.shiftHours), "Duration": item.displayTime || "--", "Login Status": item.loginStatus, "Worked Status": item.workedStatus }));
    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = { Sheets: { data: ws }, SheetNames: ["data"] };
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    FileSaver.saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" }), `${employeeData.name.replace(/\s+/g, '_')}_Attendance_Report.xlsx`);
  };

  const handleShareImage = async () => {
    if (contentRef.current) {
      try {
        const blob = await toBlob(contentRef.current, { backgroundColor: '#ffffff' });
        if (blob) {
          const file = new File([blob], "attendance_summary.png", { type: "image/png" });
          if (navigator.share) await navigator.share({ files: [file], title: 'Attendance Summary', text: `Attendance for ${employeeData.name}` });
          else { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `Attendance_${employeeData.name}.png`; link.click(); URL.revokeObjectURL(link.href); }
        }
      } catch (error) { console.error("Error generating image:", error); }
    }
  };

  const profilePic = employeeImages ? employeeImages[employeeData.employeeId] : null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white shrink-0 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 font-bold text-xl overflow-hidden bg-gray-50">
              {profilePic ? <img src={profilePic} alt={employeeData.name} className="w-full h-full object-cover" /> : (employeeData.name || "U").charAt(0)}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800">Attendance History</h3>
              <p className="text-gray-500 font-medium text-sm flex items-center gap-2 mt-0.5"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>{employeeData.name} ({employeeData.employeeId})</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleShareImage} className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-100 transition-colors border border-gray-200"><FaShareAlt /> Share</button>
            <button onClick={downloadIndividualReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors shadow-sm"><FaFileExcel /> Download</button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-800 p-2 hover:bg-gray-100 rounded-full transition-colors ml-2"><FaTimes size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50/50 custom-scrollbar" ref={contentRef}>
          <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-4 sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200/50">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow">
              <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Working Days</span>
              <span className="text-2xl font-black text-gray-800">{stats.workingDays}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow border-b-4 border-b-indigo-500">
              <span className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider">Present</span>
              <span className="text-2xl font-black text-gray-800">{stats.present}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow border-b-4 border-b-green-500">
              <span className="text-[10px] font-bold uppercase text-green-500 tracking-wider">Full Days</span>
              <span className="text-2xl font-black text-gray-800">{stats.fullDays}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow border-b-4 border-b-yellow-500">
              <span className="text-[10px] font-bold uppercase text-yellow-600 tracking-wider">Half Days</span>
              <span className="text-2xl font-black text-gray-800">{stats.halfDays}</span>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center gap-1 hover:shadow-md transition-shadow border-b-4 border-b-red-500">
              <span className="text-[10px] font-bold uppercase text-red-500 tracking-wider">Absent</span>
              <span className="text-2xl font-black text-gray-800">{stats.absent}</span>
            </div>
          </div>

          <div className="px-6 mb-6 mt-4">
            <div className="flex bg-gray-200/50 p-1.5 rounded-xl w-fit border border-gray-200">
              <button
                onClick={() => setViewMode("daily")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === "daily" ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <FaList /> Daily History
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === "weekly" ? "bg-white text-purple-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                <FaLayerGroup /> Weekly Report
              </button>
            </div>
          </div>

          <div className="px-6 pb-10">
            {viewMode === "daily" ? (
              <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white">
                <table className="min-w-full text-sm text-left whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs font-bold tracking-wider border-b border-gray-200 sticky top-0 z-20">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Punch In</th>
                      <th className="px-6 py-4">Punch Out</th>
                      <th className="px-6 py-4">Assigned</th>
                      <th className="px-6 py-4">Duration</th>
                      <th className="px-6 py-4">Login Status</th>
                      <th className="px-6 py-4">Worked Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {completeHistory.length > 0 ? (completeHistory.map((item, idx) => (
                      <tr key={idx} className={`transition-all duration-200 ${item.rowClass}`}>
                        <td className="px-6 py-4 font-semibold text-gray-800">
                          {formatDateDMY(item.date)}
                          <div className="text-[10px] font-medium text-gray-400 uppercase mt-0.5">{new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' })}</div>
                        </td>
                        <td className="px-6 py-4 text-green-600 font-semibold">{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                        <td className="px-6 py-4 text-red-600 font-semibold">{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                        <td className="px-6 py-4 text-gray-500 font-medium">{formatDecimalHours(item.shiftHours)}</td>
                        <td className="px-6 py-4 font-mono font-bold text-gray-700">{item.displayTime}</td>
                        <td className="px-6 py-4">{item.loginStatus !== "--" && (<span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide ${item.loginStatus === "LATE" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{item.loginStatus}</span>)}</td>
                        <td className="px-6 py-4 font-semibold"><span className={`px-3 py-1 rounded-full text-xs font-bold shadow-sm border ${item.workedStatus === "Full Day" ? "bg-green-50 text-green-700 border-green-100" : item.workedStatus === "Half Day" ? "bg-yellow-50 text-yellow-700 border-yellow-100" : item.isAbsent ? "bg-red-50 text-red-700 border-red-100" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{item.workedStatus}</span></td>
                      </tr>
                    ))) : (<tr><td colSpan="7" className="text-center p-10 text-gray-500 font-medium bg-white">No data for selected range.</td></tr>)}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-6">
                {weeklyHistory.length > 0 ? (weeklyHistory.map((week, wIdx) => {
                  const isExpanded = expandedWeeks[week.weekStart];
                  return (
                    <div key={wIdx} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
                      <div className="bg-gray-50 border-b border-gray-200 p-5 flex justify-between items-center">
                        <div className="flex items-center gap-6">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">Weekly Range</span>
                            <span className="font-bold text-gray-800">{formatDateDMY(week.weekStart)} — {formatDateDMY(week.weekEnd)}</span>
                          </div>
                          <button
                            onClick={() => toggleWeekExpansion(week.weekStart)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-[11px] font-bold uppercase text-gray-600 transition-colors shadow-sm"
                          >
                            <FaInfoCircle className="text-blue-500" /> {isExpanded ? "Hide Report" : "Detailed Report"} {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                          </button>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase text-gray-400 tracking-widest block mb-1">Total Work Hours</span>
                          <span className="text-xl font-black text-green-600 font-mono bg-green-50 px-3 py-1 rounded-lg">{formatDecimalHours(week.totalHours)}</span>
                        </div>
                      </div>

                      {/* Expandable Summary Section */}
                      {isExpanded && (
                        <div className="p-5 bg-gray-50/50 border-b border-gray-100 grid grid-cols-4 gap-4 animate-in slide-in-from-top duration-300">
                          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500 border-t border-r border-b border-gray-100">
                            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Full Days</p>
                            <p className="text-xl font-black text-gray-800 mt-1">{week.stats.full}</p>
                          </div>
                          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-yellow-500 border-t border-r border-b border-gray-100">
                            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Half Days</p>
                            <p className="text-xl font-black text-gray-800 mt-1">{week.stats.half}</p>
                          </div>
                          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500 border-t border-r border-b border-gray-100">
                            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Absents</p>
                            <p className="text-xl font-black text-gray-800 mt-1">{week.stats.absent}</p>
                          </div>
                          <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-orange-500 border-t border-r border-b border-gray-100">
                            <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Late Logins</p>
                            <p className="text-xl font-black text-gray-800 mt-1">{week.stats.late}</p>
                          </div>
                        </div>
                      )}
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left whitespace-nowrap">
                          <thead className="bg-white text-gray-400 uppercase text-[11px] font-bold tracking-wider border-b border-gray-100">
                            <tr>
                              <th className="px-6 py-3">Day</th>
                              <th className="px-6 py-3">Punch In</th>
                              <th className="px-6 py-3">Punch Out</th>
                              <th className="px-6 py-3 text-center">Login Status</th>
                              <th className="px-6 py-3 text-right">Hours Worked</th>
                              <th className="px-6 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {week.days.map((day, dIdx) => (
                              <tr key={dIdx} className={day.rowClass}>
                                <td className="px-6 py-3.5 font-semibold text-gray-700">
                                  {formatDateDMY(day.date)}
                                  <span className="ml-2 text-gray-400 font-medium uppercase text-[10px] bg-gray-100 px-1.5 py-0.5 rounded">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                </td>
                                <td className="px-6 py-3.5 font-medium text-gray-600">{day.punchIn ? new Date(day.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                                <td className="px-6 py-3.5 font-medium text-gray-600">{day.punchOut ? new Date(day.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</td>
                                <td className="px-6 py-3.5 text-center">
                                  {day.loginStatus !== "--" && (
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-wide ${day.loginStatus === "LATE" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
                                      {day.loginStatus}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-3.5 text-right font-mono font-bold text-gray-700">{day.displayTime || "0h 0m"}</td>
                                <td className="px-6 py-3.5">
                                  <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${day.workedStatus === "Full Day" ? "bg-green-50 text-green-700 border border-green-100" : day.isAbsent ? "bg-red-50 text-red-700 border border-red-100" : "bg-gray-100 text-gray-600 border border-gray-200"}`}>
                                    {day.workedStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })) : (
                  <div className="text-center p-10 bg-white rounded-2xl border border-gray-200 text-gray-500 font-medium shadow-sm">No weekly history available.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatusListModal = ({ isOpen, onClose, title, employees, employeeImages, allEmployees }) => {
  if (!isOpen) return null;
  const employeeInfoMap = useMemo(() => {
    const map = {};
    allEmployees.forEach(emp => { map[emp.employeeId] = { name: emp.name, role: getCurrentRole(emp) }; });
    return map;
  }, [allEmployees]);
  const isLoginRequired = title === "Login Required";
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex justify-center items-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white">
          <div><h3 className="text-xl font-bold text-gray-800">{title}</h3><p className="text-sm text-gray-500 font-medium mt-0.5">{employees.length} Employees</p></div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800 hover:bg-gray-100 p-2 rounded-full transition-colors"><FaTimes size={20} /></button>
        </div>
        <div className="p-6 overflow-y-auto bg-gray-50/50">
          {employees.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white">
              <table className="min-w-full text-sm text-left whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-b border-gray-200">
                  <tr><th className="px-6 py-4">Employee</th><th className="px-6 py-4">Role</th>{!isLoginRequired && <th className="px-6 py-4">Login Status</th>}{!isLoginRequired && <th className="px-6 py-4">Worked Status</th>}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {employees.map((emp, index) => {
                    const employeeInfo = employeeInfoMap[emp.employeeId] || {};
                    const profilePic = employeeImages ? employeeImages[emp.employeeId] : null;
                    return (
                      <tr key={emp.employeeId || index} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 font-bold border border-gray-200 overflow-hidden bg-gray-50">{profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : (emp.name || emp.employeeName || "U").charAt(0)}</div>
                            <div><p className="font-bold text-gray-800">{emp.name || emp.employeeName || employeeInfo.name}</p><p className="text-xs text-gray-500 font-mono mt-0.5">{emp.employeeId}</p></div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200">{employeeInfo.role || "N/A"}</span></td>
                        {!isLoginRequired && (<td className="px-6 py-4">{emp.displayLoginStatus && (<span className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md font-bold ${emp.displayLoginStatus === 'LATE' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{emp.displayLoginStatus}</span>)}</td>)}
                        {!isLoginRequired && (<td className="px-6 py-4">{emp.workedStatus && (<span className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-bold ${emp.workedStatus === 'Full Day' ? 'bg-green-50 text-green-700 border border-green-100' : emp.workedStatus === 'Half Day' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' : emp.workedStatus.includes('Absent') ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>{emp.workedStatus}</span>)}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <div className="text-center bg-white rounded-2xl border border-gray-200 py-12 shadow-sm"><p className="text-gray-500 font-medium">No employees in this category.</p></div>}
        </div>
      </div>
    </div>
  );
};

const Pagination = ({ totalItems, itemsPerPage, currentPage, onPageChange, setItemsPerPage }) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  if (totalItems === 0) return null;
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white border-t border-gray-200">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-500">Rows per page:</label>
        <select value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); onPageChange(1); }} className="bg-gray-50 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg p-1.5 outline-none focus:ring-2 focus:ring-blue-500">
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
        </select>
      </div>
      <div className="flex items-center gap-6">
        <span className="text-sm font-medium text-gray-500">Showing {startItem}-{endItem} of {totalItems}</span>
        <div className="flex rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:bg-gray-50 border-r border-gray-200 transition-colors">Prev</button>
          <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages} className="px-4 py-2 text-sm font-bold text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:bg-gray-50 transition-colors">Next</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================

const AdminAttendance = () => {
  const todayISO = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState(todayISO);
  const[endDate, setEndDate] = useState(todayISO);
  const[rawDailyData, setRawDailyData] = useState([]);
  const [loading, setLoading] = useState(true);
  const[allEmployees, setAllEmployees] = useState([]);

  const [summaryStartDate, setSummaryStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const[summaryEndDate, setSummaryEndDate] = useState(todayISO);
  const[selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const[rawSummaryData, setRawSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const[overtimeData, setOvertimeData] = useState([]);
  const[isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const[statusListModal, setStatusListModal] = useState({ isOpen: false, title: "", employees: [] });
  const[shiftsMap, setShiftsMap] = useState({});
  const[holidays, setHolidays] = useState([]);
  const [dailyCurrentPage, setDailyCurrentPage] = useState(1);
  const[dailyItemsPerPage, setDailyItemsPerPage] = useState(10);
  const[summaryCurrentPage, setSummaryCurrentPage] = useState(1);
  const[summaryItemsPerPage, setSummaryItemsPerPage] = useState(10);
  const [punchOutModal, setPunchOutModal] = useState({ isOpen: false, employee: null });
  const [dailySearchTerm, setDailySearchTerm] = useState("");
  const[summarySearchTerm, setSummarySearchTerm] = useState("");
  const[employeeImages, setEmployeeImages] = useState({});
  const [previewImage, setPreviewImage] = useState(null);

  // ✅ NEW STATE FOR EMPLOYEE WORK MODES
  const[employeeWorkModes, setEmployeeWorkModes] = useState({});

  // ✅ NEW STATES FOR COMPARISON
  const[isCompareMode, setIsCompareMode] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState([]);
  const[isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);

  const fetchShifts = useCallback(async () => {
    try {
      const response = await getAllShifts();
      const data = Array.isArray(response) ? response : response.data ||[];
      const map = {}; data.forEach(shift => { if (shift.employeeId) map[shift.employeeId] = shift; });
      setShiftsMap(map);
    } catch (error) { console.error("Error fetching shifts:", error); }
  },[]);

  const fetchHolidays = useCallback(async () => {
    try { const response = await getHolidays(); setHolidays(response ||[]); } catch (error) { console.error("Error fetching holidays:", error); }
  },[]);

  const fetchAllEmployees = useCallback(async () => {
    try { const data = await getEmployees(); setAllEmployees(data); } catch (error) { setAllEmployees([]); }
  },[]);

  const fetchOvertimeData = useCallback(async () => {
    try { const data = await getAllOvertimeRequests(); setOvertimeData(data); } catch (error) { setOvertimeData([]); }
  },[]);

  const fetchDailyData = useCallback(async (start, end) => {
    setLoading(true);
    try { const data = await getAttendanceByDateRange(start, end); setRawDailyData(Array.isArray(data) ? data :[]); } catch (error) { setRawDailyData([]); } finally { setLoading(false); }
  },[]);

  const fetchSummaryData = useCallback(async (start, end) => {
    setSummaryLoading(true);
    try { const data = await getAttendanceByDateRange(start, end); setRawSummaryData(Array.isArray(data) ? data :[]); } catch (error) { setRawSummaryData([]); } finally { setSummaryLoading(false); }
  },[]);

  // ✅ NEW: Fetch employee work modes from the same endpoint used in AdminLocationSettings
  const fetchEmployeeWorkModes = useCallback(async () => {
    try {
      const { data } = await api.get("/api/admin/settings/employees-modes");
      if (data && data.employees) {
        const modeMap = {};
        data.employees.forEach(emp => {
          modeMap[emp.employeeId] = {
            currentEffectiveMode: emp.currentEffectiveMode || 'WFO',
            ruleType: emp.ruleType || 'Global'
          };
        });
        setEmployeeWorkModes(modeMap);
      }
    } catch (error) {
      console.error("Error fetching employee work modes:", error);
    }
  },[]);

  useEffect(() => {
    fetchShifts();
    fetchHolidays();
    fetchDailyData(startDate, endDate);
    fetchEmployeeWorkModes(); // Fetch work modes
  },[startDate, endDate, fetchDailyData, fetchShifts, fetchHolidays, fetchEmployeeWorkModes]);

  useEffect(() => {
    fetchAllEmployees();
    fetchSummaryData(summaryStartDate, summaryEndDate);
    fetchOvertimeData();
    fetchEmployeeWorkModes(); // Also fetch when summary dates change
  },[summaryStartDate, summaryEndDate, fetchSummaryData, fetchOvertimeData, fetchAllEmployees, fetchEmployeeWorkModes]);

  useEffect(() => {
    const fetchImages = async () => {
      const newImages = {};
      if (allEmployees.length === 0) return;
      for (const emp of allEmployees) {
        if (!employeeImages[emp.employeeId]) {
          try {
            const res = await api.get(`/api/profile/${emp.employeeId}`);
            if (res.data?.profilePhoto?.url) newImages[emp.employeeId] = getSecureUrl(res.data.profilePhoto.url);
          } catch (err) { }
        }
      }
      if (Object.keys(newImages).length > 0) setEmployeeImages(prev => ({ ...prev, ...newImages }));
    };
    if (allEmployees.length > 0) fetchImages();
  }, [allEmployees]);

  const handleAdminPunchOut = async (employeeId, punchOutTime, location, dateOfRecord) => {
    try {
      const response = await api.post(`/api/attendance/admin-punch-out`, { employeeId, punchOutTime, latitude: location.latitude, longitude: location.longitude, adminId: 'Admin', date: dateOfRecord });
      if (response.data.success) { alert('Employee punched out successfully!'); await fetchDailyData(startDate, endDate); await fetchSummaryData(summaryStartDate, summaryEndDate); }
    } catch (error) { const errMsg = error.response?.data?.message || error.message; alert(`Failed to punch out: ${errMsg}`); throw error; }
  };

  const handleMonthChange = (e) => {
    const val = e.target.value; setSelectedMonth(val);
    if (val) {
      const startStr = `${val}-01`;
      const [year, month] = val.split('-').map(Number);
      const end = new Date(year, month, 0);
      const offset = end.getTimezoneOffset() * 60000;
      const endStr = new Date(end.getTime() - offset).toISOString().split('T')[0];
      setSummaryStartDate(startStr); setSummaryEndDate(endStr);
    }
  };

  const empNameMap = useMemo(() => {
    return allEmployees.reduce((acc, emp) => { acc[emp.employeeId] = emp.name; return acc; }, {});
  },[allEmployees]);

  const processedDailyData = useMemo(() => {
    const mapped = rawDailyData.map(item => {
      const shift = shiftsMap[item.employeeId];
      const adminFullDayHours = shift?.fullDayHours || 9;
      const adminHalfDayHours = shift?.halfDayHours || 4.5;
      const realName = empNameMap[item.employeeId] || item.employeeName || item.employeeId;

      // ✅ Get work mode for this employee (default to 'WFO' if not found)
      const workMode = employeeWorkModes[item.employeeId]?.currentEffectiveMode || 'WFO';

      return {
        ...item,
        employeeName: realName,
        assignedHours: adminFullDayHours,
        workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, adminFullDayHours, adminHalfDayHours),
        displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus),
        workMode: workMode // Add work mode to the item
      };
    });
    mapped.sort((a, b) => { const timeA = a.punchIn ? new Date(a.punchIn).getTime() : 0; const timeB = b.punchIn ? new Date(b.punchIn).getTime() : 0; return timeB - timeA; });
    if (!dailySearchTerm) return mapped;
    const lowerTerm = dailySearchTerm.toLowerCase();
    return mapped.filter(item => (item.employeeName && item.employeeName.toLowerCase().includes(lowerTerm)) || (item.employeeId && item.employeeId.toLowerCase().includes(lowerTerm)));
  },[rawDailyData, shiftsMap, dailySearchTerm, empNameMap, employeeWorkModes]);

  const processedSummaryData = useMemo(() => {
    return rawSummaryData.map(item => {
      const shift = shiftsMap[item.employeeId];
      const adminFullDayHours = shift?.fullDayHours || 9;
      const realName = empNameMap[item.employeeId] || item.employeeName || item.employeeId;
      const workMode = employeeWorkModes[item.employeeId]?.currentEffectiveMode || 'WFO';
      return {
        ...item,
        employeeName: realName,
        assignedHours: adminFullDayHours,
        workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, adminFullDayHours, shift?.halfDayHours || 4.5),
        displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus),
        workMode: workMode
      };
    });
  },[rawSummaryData, shiftsMap, empNameMap, employeeWorkModes]);

  const employeeSummaryStats = useMemo(() => {
    if (!allEmployees.length) return[];
    const attendanceMap = new Map();
    processedSummaryData.forEach(r => { const key = `${r.employeeId}_${normalizeDateStr(r.date)}`; attendanceMap.set(key, r); });
    const approvedOTCounts = overtimeData.reduce((acc, ot) => {
      if (ot.status === 'APPROVED') {
        const otDateStr = normalizeDateStr(ot.date);
        if (otDateStr >= summaryStartDate && otDateStr <= summaryEndDate) acc[ot.employeeId] = (acc[ot.employeeId] || 0) + 1;
      }
      return acc;
    }, {});
    const activeEmployees = allEmployees.filter(e => e.isActive !== false);
    const summaryArray = activeEmployees.map(emp => {
      const shift = shiftsMap[emp.employeeId];
      const weeklyOffs = shift?.weeklyOffDays || [0];
      const adminFullDayHours = shift?.fullDayHours || 9;
      let stats = { employeeId: emp.employeeId, employeeName: emp.name, assignedHours: adminFullDayHours, presentDays: 0, onTimeDays: 0, lateDays: 0, fullDays: 0, halfDays: 0, absentDays: 0, approvedOT: approvedOTCounts[emp.employeeId] || 0 };
      const start = new Date(summaryStartDate);
      const end = new Date(summaryEndDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const key = `${emp.employeeId}_${dateStr}`;
        const record = attendanceMap.get(key);
        const holidayObj = isHoliday(dateStr, holidays);
        const isWeeklyOff = weeklyOffs.includes(d.getDay());
        if (record) {
          if (record.punchIn) { stats.presentDays++; if (record.displayLoginStatus === 'LATE') stats.lateDays++; else stats.onTimeDays++; }
          if (record.workedStatus === "Full Day") stats.fullDays++; else if (record.workedStatus === "Half Day") stats.halfDays++; else if (record.status === "ABSENT" || record.workedStatus.includes("Absent")) stats.absentDays++;
        } else if (!holidayObj && !isWeeklyOff) stats.absentDays++;
      }
      return stats;
    });
    const sortedArray = summaryArray.sort((a, b) => b.presentDays - a.presentDays || a.employeeName.localeCompare(b.employeeName));
    if (!summarySearchTerm) return sortedArray;
    const lowerTerm = summarySearchTerm.toLowerCase();
    return sortedArray.filter(item => (item.employeeName && item.employeeName.toLowerCase().includes(lowerTerm)) || (item.employeeId && item.employeeId.toLowerCase().includes(lowerTerm)));
  },[allEmployees, processedSummaryData, overtimeData, shiftsMap, holidays, summaryStartDate, summaryEndDate, summarySearchTerm]);

  const absentEmployees = useMemo(() => {
    if (allEmployees.length === 0 || loading || startDate !== endDate) return[];
    const presentIds = new Set(rawDailyData.map(att => att.employeeId));
    return allEmployees.filter(emp => emp.isActive !== false && !presentIds.has(emp.employeeId));
  }, [allEmployees, rawDailyData, loading, startDate, endDate]);

  const dailyStats = useMemo(() => {
    const fullList = rawDailyData.map(item => {
      const shift = shiftsMap[item.employeeId];
      const realName = empNameMap[item.employeeId] || item.employeeName || item.employeeId;
      const workMode = employeeWorkModes[item.employeeId]?.currentEffectiveMode || 'WFO';
      return {
        ...item,
        employeeName: realName,
        workedStatus: getWorkedStatus(item.punchIn, item.punchOut, item.status, shift?.fullDayHours || 9, shift?.halfDayHours || 4.5),
        displayLoginStatus: calculateLoginStatus(item.punchIn, shift, item.loginStatus),
        workMode: workMode
      };
    });
    const working = fullList.filter(item => item.punchIn && !item.punchOut);
    const completed = fullList.filter(item => item.punchIn && item.punchOut);
    return { workingList: working, workingCount: working.length, completedList: completed, completedCount: completed.length, absentCount: startDate === endDate ? absentEmployees.length : 0 };
  },[rawDailyData, shiftsMap, absentEmployees, startDate, endDate, empNameMap, employeeWorkModes]);

  const paginatedDailyData = useMemo(() => processedDailyData.slice((dailyCurrentPage - 1) * dailyItemsPerPage, dailyCurrentPage * dailyItemsPerPage),[processedDailyData, dailyCurrentPage, dailyItemsPerPage]);
  const paginatedSummaryData = useMemo(() => employeeSummaryStats.slice((summaryCurrentPage - 1) * summaryItemsPerPage, summaryCurrentPage * summaryItemsPerPage),[employeeSummaryStats, summaryCurrentPage, summaryItemsPerPage]);

  const exportDailyLogToExcel = () => exportToExcel(processedDailyData, `Daily_Log_${startDate}_to_${endDate}`,[
    { label: "Employee Name", value: item => item.employeeName }, { label: "Employee ID", value: item => item.employeeId }, { label: "Date", value: item => formatDateDMY(item.date) }, { label: "Punch In", value: item => item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--" }, { label: "Punch Out", value: item => item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--" }, { label: "Assigned Work Hours", value: item => formatDecimalHours(item.assignedHours) }, { label: "Duration", value: item => item.displayTime || "0h 0m" }, { label: "Login Status", value: item => item.displayLoginStatus }, { label: "Worked Status", value: item => item.workedStatus }
  ]);

  const exportSummaryToExcel = () => exportToExcel(employeeSummaryStats, `Attendance_Summary_${summaryStartDate}_to_${summaryEndDate}`,[
    { label: "Employee ID", value: item => item.employeeId }, { label: "Employee Name", value: item => item.employeeName }, { label: "Assigned Work Hours", value: item => formatDecimalHours(item.assignedHours) }, { label: "Present Days", value: item => item.presentDays }, { label: "On-Time Days", value: item => item.onTimeDays }, { label: "Late Days", value: item => item.lateDays }, { label: "Approved OT", value: item => item.approvedOT }, { label: "Full Days", value: item => item.fullDays }, { label: "Half Days", value: item => item.halfDays }, { label: "Absent Days", value: item => item.absentDays },
  ]);

  const exportToExcel = (data, fileName, fields) => {
    if (data.length === 0) { alert("No data to export."); return; }
    const formattedData = data.map(item => fields.reduce((obj, field) => { obj[field.label] = field.value(item); return obj; }, {}));
    const ws = XLSX.utils.json_to_sheet(formattedData); const wb = { Sheets: { data: ws }, SheetNames: ["data"] }; const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    FileSaver.saveAs(new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8" }), `${fileName}.xlsx`);
  };

  const handleViewDetails = (employeeId, employeeName) => {
    const records = rawSummaryData.filter(r => r.employeeId === employeeId);
    setSelectedEmployee({ name: employeeName, records, employeeId, startDate: summaryStartDate, endDate: summaryEndDate }); setIsModalOpen(true);
  };

  const handleOpenStatusModal = (type) => {
    if (type === 'WORKING') setStatusListModal({ isOpen: true, title: "Currently Working", employees: dailyStats.workingList });
    else if (type === 'COMPLETED') setStatusListModal({ isOpen: true, title: "Shift Completed", employees: dailyStats.completedList });
    else if (type === 'ABSENT' && startDate === endDate) setStatusListModal({ isOpen: true, title: "Login Required", employees: absentEmployees });
  };

  // ✅ NEW: Toggle selection for comparison
  const toggleSelection = (id) => {
    setSelectedCompareIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const selectedStatsForComparison = useMemo(() => {
    return employeeSummaryStats.filter(s => selectedCompareIds.includes(s.employeeId));
  },[employeeSummaryStats, selectedCompareIds]);

  const StatCard = ({ icon, title, value, colorClass, onClick }) => (
    <div className={`relative flex-1 p-6 bg-white rounded-2xl border border-gray-200 shadow-sm flex items-center gap-5 overflow-hidden group ${onClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300 transition-all duration-200' : ''}`} onClick={onClick}>
      <div className={`absolute top-0 left-0 w-1.5 h-full ${colorClass}`}></div>
      <div className="p-3 bg-gray-50 rounded-xl group-hover:scale-110 transition-transform duration-300">{icon}</div>
      <div>
        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{title}</p>
        <p className="text-3xl font-black text-gray-800 mt-1">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* ========================================== */}
        {/* Daily Log Section */}
        {/* ========================================== */}
        <div className="flex flex-col space-y-6">
          <div className="p-6 border border-gray-200 shadow-sm bg-white rounded-2xl flex flex-col gap-5">
            <div className="flex items-center gap-3 text-xl font-bold text-gray-800">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><FaCalendarAlt /></div>
              Daily Attendance Log
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative group flex-grow-0">
                <FaSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input type="text" placeholder="Search Name or ID..." value={dailySearchTerm} onChange={(e) => { setDailySearchTerm(e.target.value); setDailyCurrentPage(1); }} className="pl-10 pr-4 py-2.5 w-64 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm text-sm font-medium text-gray-700" />
              </div>
              <div className="w-64 bg-gray-50 border border-gray-200 rounded-xl outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-sm overflow-hidden flex items-center">
                <span className="px-4 py-2.5 bg-gray-100 text-gray-500 text-xs font-bold uppercase tracking-wider border-r border-gray-200 h-full flex items-center">From</span>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full pl-3 pr-3 py-2.5 outline-none bg-transparent text-gray-700 font-medium text-sm" />
              </div>
              <div className="w-64 bg-gray-50 border border-gray-200 rounded-xl outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all shadow-sm overflow-hidden flex items-center">
                <span className="px-4 py-2.5 bg-gray-100 text-gray-500 text-xs font-bold uppercase tracking-wider border-r border-gray-200 h-full flex items-center">To</span>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full pl-3 pr-3 py-2.5 outline-none bg-transparent text-gray-700 font-medium text-sm" />
              </div>
              <div className="flex items-center gap-3 ml-auto">
                <button onClick={exportDailyLogToExcel} className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-bold text-sm rounded-xl shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all active:scale-95">
                  <FaFileExcel size={16} /><span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <StatCard icon={<FaClock className="text-orange-500 text-2xl" />} title="Currently Working" value={dailyStats.workingCount} colorClass="bg-orange-500" onClick={() => handleOpenStatusModal('WORKING')} />
            <StatCard icon={<FaCheckCircle className="text-green-500 text-2xl" />} title="Shift Completed" value={dailyStats.completedCount} colorClass="bg-green-500" onClick={() => handleOpenStatusModal('COMPLETED')} />
            {startDate === endDate && (<StatCard icon={<FaUserSlash className="text-red-500 text-2xl" />} title="Login Required" value={loading ? '...' : dailyStats.absentCount} colorClass="bg-red-500" onClick={() => handleOpenStatusModal('ABSENT')} />)}
          </div>

          {/* Wrapper specific classes requested */}
          <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white">
            <table className="min-w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[11px] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Punch In</th>
                  <th className="px-6 py-4">Punch Out</th>
                  <th className="px-6 py-4">Work Hrs</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Login Status</th>
                  <th className="px-6 py-4">Worked Status</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {loading ? (<tr><td colSpan="9" className="text-center p-10 font-medium text-gray-500">Loading daily log...</td></tr>) : paginatedDailyData.length === 0 ? (<tr><td colSpan="9" className="text-center p-10 text-gray-500 font-medium">No records found.</td></tr>) : paginatedDailyData.map((item, idx) => {
                  const isAbsent = item.status === "ABSENT" || item.workedStatus.includes("Absent");
                  const canPunchOut = item.punchIn && !item.punchOut;
                  const punchInColor = item.displayLoginStatus === 'LATE' ? 'text-red-600' : 'text-green-600';
                  const punchOutColor = item.workedStatus === 'Full Day' ? 'text-green-600' : 'text-red-600';
                  const profilePic = employeeImages ? employeeImages[item.employeeId] : null;

                  // ✅ Check if employee is working from home
                  const isWorkFromHome = item.workMode === 'WFH';

                  return (
                    <tr key={item._id || idx} className={`hover:bg-gray-50 transition-colors ${isAbsent ? "bg-red-50/20" : "bg-white"}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden bg-gray-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => profilePic && setPreviewImage(profilePic)}>
                            {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : (item.employeeName || "U").charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-800">{item.employeeName}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-gray-500 font-mono text-xs">{item.employeeId}</span>
                              {isWorkFromHome && (
                                <span className="flex items-center justify-center" title="Working from Home">
                                  <img src="https://image2url.com/r2/default/images/1771229256808-7f17d81e-c508-495b-91f1-f6fda3c6ac5b.png" alt="Home" className="w-5 h-5 object-contain" />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-600">{formatDateDMY(item.date)}</td>
                      <td className="px-6 py-4"><div className={`font-bold ${punchInColor}`}>{item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</div>{item.punchIn && <LocationViewButton location={item.punchInLocation} />}</td>
                      <td className="px-6 py-4"><div className={`font-bold ${item.punchOut ? punchOutColor : 'text-gray-400'}`}>{item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}</div>{item.punchOut && <LocationViewButton location={item.punchOutLocation} />}</td>
                      <td className="px-6 py-4 font-medium text-gray-500">{formatDecimalHours(item.assignedHours)}</td>
                      <td className="px-6 py-4 font-mono font-bold text-gray-700">{(!item.punchOut && item.punchIn) ? <LiveTimer startTime={item.punchIn} /> : (item.displayTime || "0h 0m 0s")}</td>
                      <td className="px-6 py-4"><span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase ${item.displayLoginStatus === "LATE" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>{item.displayLoginStatus}</span></td>
                      <td className="px-6 py-4 font-semibold"><span className={`px-3 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold shadow-sm border ${item.workedStatus === "Full Day" ? "bg-green-50 text-green-700 border-green-100" : item.workedStatus === "Half Day" ? "bg-yellow-50 text-yellow-700 border-yellow-100" : isAbsent ? "bg-red-50 text-red-700 border-red-100" : "bg-gray-50 text-gray-700 border-gray-200"}`}>{item.workedStatus}</span></td>
                      <td className="px-6 py-4">{canPunchOut ? <button onClick={() => setPunchOutModal({ isOpen: true, employee: item })} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 shadow-sm"><FaSignOutAlt /> Punch Out</button> : item.punchOut ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-600 text-[11px] font-bold rounded-lg"><FaCheckCircle className="text-green-500" /> Done</span> : <span className="text-gray-400 text-xs font-medium">--</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination totalItems={processedDailyData.length} itemsPerPage={dailyItemsPerPage} currentPage={dailyCurrentPage} onPageChange={setDailyCurrentPage} setItemsPerPage={setDailyItemsPerPage} />
          </div>
        </div>

        {/* ========================================== */}
        {/* Employee Attendance Summary Section */}
        {/* ========================================== */}
        <div className="flex flex-col space-y-6 mt-10">
          <div className="p-6 border border-gray-200 shadow-sm bg-white rounded-2xl flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><FaUsers size={20} /></div>
                <h2 className="text-xl font-bold text-gray-800">Employee Attendance Summary</h2>
              </div>
              {/* ✅ Comparison Action Buttons */}
              <div className="flex items-center gap-3">
                {!isCompareMode ? (
                  <button onClick={() => setIsCompareMode(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-bold rounded-xl shadow-sm hover:bg-gray-50 transition-all active:scale-95"><FaExchangeAlt className="text-blue-500" /> Compare Data</button>
                ) : (
                  <div className="flex items-center gap-3 animate-in slide-in-from-right duration-300">
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-full">{selectedCompareIds.length} Selected</span>
                    <button onClick={() => { if (selectedCompareIds.length < 2) alert("Select at least 2 employees to compare."); else setIsComparisonModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-xl shadow hover:bg-green-700 transition-all"><FaCheck /> Proceed Comparison</button>
                    <button onClick={() => { setIsCompareMode(false); setSelectedCompareIds([]); }} className="px-5 py-2.5 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="relative group w-full"><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1.5 block">Search Employee</label><FaSearch className="absolute left-3.5 top-[35px] text-gray-400 group-focus-within:text-blue-500" /><input type="text" placeholder="Name or ID..." value={summarySearchTerm} onChange={(e) => { setSummarySearchTerm(e.target.value); setSummaryCurrentPage(1); }} className="pl-10 pr-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm text-sm font-medium" /></div>
              <div className="w-full"><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1.5 block">Select Month</label><div className="relative"><FaCalendarDay className="absolute left-3.5 top-3 text-gray-400" /><input type="month" value={selectedMonth} onChange={handleMonthChange} className="pl-10 pr-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-sm text-sm font-medium" /></div></div>
              <div className="w-full"><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1.5 block">From Date</label><input type="date" value={summaryStartDate} onChange={(e) => setSummaryStartDate(e.target.value)} className="px-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-sm text-sm font-medium text-gray-700" /></div>
              <div className="w-full"><label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider ml-1 mb-1.5 block">To Date</label><input type="date" value={summaryEndDate} onChange={(e) => setSummaryEndDate(e.target.value)} className="px-4 py-2.5 w-full bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white shadow-sm text-sm font-medium text-gray-700" /></div>
              <div className="w-full"><button onClick={exportSummaryToExcel} className="w-full flex justify-center items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl shadow-md hover:bg-blue-700 transition-transform active:scale-95 h-[46px]"><FaFileExcel size={16} /> Export Data</button></div>
            </div>
          </div>

          {/* Wrapper specific classes requested */}
          <div className="overflow-x-auto rounded-2xl shadow-lg border border-gray-200 relative z-10 overflow-hidden bg-white">
            <table className="min-w-full text-sm text-left whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[11px] font-bold tracking-wider border-b border-gray-200 sticky top-0 z-20 shadow-sm">
                <tr>
                  {isCompareMode && (
                    <th className="px-6 py-4 text-center">Select</th>
                  )}
                  <th className="px-6 py-4">Employee</th>
                  <th className="px-6 py-4 text-center">Assigned Hrs</th>
                  <th className="px-6 py-4 text-center">Present</th>
                  <th className="px-6 py-4 text-center">On Time</th>
                  <th className="px-6 py-4 text-center">Late</th>
                  <th className="px-6 py-4 text-center">Approved OT</th>
                  <th className="px-6 py-4 text-center">Full Days</th>
                  <th className="px-6 py-4 text-center">Half Days</th>
                  <th className="px-6 py-4 text-center">Absent</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {summaryLoading ? (<tr><td colSpan="11" className="text-center p-10 text-gray-500 font-medium">Loading summary...</td></tr>) : paginatedSummaryData.length === 0 ? (<tr><td colSpan="11" className="text-center p-10 text-gray-500 font-medium">No summary data available.</td></tr>) : paginatedSummaryData.map((emp) => {
                  const profilePic = employeeImages ? employeeImages[emp.employeeId] : null;
                  return (
                    <tr key={emp.employeeId} className={`transition-colors ${selectedCompareIds.includes(emp.employeeId) ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}>
                      {/* ✅ Checkbox Cell in Compare Mode */}
                      {isCompareMode && (
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            checked={selectedCompareIds.includes(emp.employeeId)}
                            onChange={() => toggleSelection(emp.employeeId)}
                          />
                        </td>
                      )}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 font-bold overflow-hidden bg-gray-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => profilePic && setPreviewImage(profilePic)}>
                            {profilePic ? <img src={profilePic} alt="" className="w-full h-full object-cover" /> : (emp.employeeName || "U").charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-gray-800">{emp.employeeName}</div>
                            <div className="text-gray-500 font-mono text-xs mt-0.5">{emp.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-medium text-gray-500">{formatDecimalHours(emp.assignedHours)}</td>
                      <td className="px-6 py-4 text-center font-black text-blue-700 bg-blue-50/30 text-lg">{emp.presentDays}</td>
                      <td className="px-6 py-4 text-center font-bold text-green-600">{emp.onTimeDays}</td>
                      <td className="px-6 py-4 text-center font-bold text-red-600">{emp.lateDays}</td>
                      <td className="px-6 py-4 text-center font-bold text-indigo-600">{emp.approvedOT}</td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-700">{emp.fullDays}</td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-700">{emp.halfDays}</td>
                      <td className="px-6 py-4 text-center text-red-600 font-black">{emp.absentDays}</td>
                      <td className="px-6 py-4 text-center">
                        <button onClick={() => handleViewDetails(emp.employeeId, emp.employeeName)} className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm">
                          <FaEye size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pagination totalItems={employeeSummaryStats.length} itemsPerPage={summaryItemsPerPage} currentPage={summaryCurrentPage} onPageChange={setSummaryCurrentPage} setItemsPerPage={setSummaryItemsPerPage} />
          </div>
        </div>
      </div>

      <AttendanceDetailModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} employeeData={selectedEmployee} shiftsMap={shiftsMap} holidays={holidays} dateRange={{ startDate: summaryStartDate, endDate: summaryEndDate }} employeeImages={employeeImages} />
      <StatusListModal isOpen={statusListModal.isOpen} onClose={() => setStatusListModal({ ...statusListModal, isOpen: false })} title={statusListModal.title} employees={statusListModal.employees} employeeImages={employeeImages} allEmployees={allEmployees} />
      <AdminPunchOutModal isOpen={punchOutModal.isOpen} onClose={() => setPunchOutModal({ isOpen: false, employee: null })} employee={punchOutModal.employee} onPunchOut={handleAdminPunchOut} />

      {/* ✅ Comparison Popup */}
      <AttendanceComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        selectedStats={selectedStatsForComparison}
        employeeImages={employeeImages}
        startDate={summaryStartDate}
        endDate={summaryEndDate}
      />

      {previewImage && (<div className="fixed inset-0 z-[200] bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}><button className="absolute top-6 right-6 text-white hover:text-gray-300 p-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors"><FaTimes size={24} /></button><img src={previewImage} alt="Full Preview" className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl object-contain animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()} /></div>)}
    </div>
  );
};

export default AdminAttendance;