// --- START OF FILE TodayOverview.jsx ---

import React, { useState, useEffect, useMemo, useCallback } from "react";
import api, {
  getAttendanceByDateRange,
  getLeaveRequests,
  getEmployees,
  getAllShifts
} from "../api";
import {
  FaClock,
  FaCheckCircle,
  FaUserSlash,
  FaCalendarAlt,
  FaSearch,
  FaCalendarDay,
  FaTimes,
  FaBell,
  FaArrowRight,
  FaEllipsisV,
  FaPhone,
  FaEnvelope,
  FaIdBadge,
  FaBuilding,
  FaWhatsapp,
  FaPhoneAlt,
  FaComment,
  FaUserClock,
  FaExclamationCircle,
  FaUserCheck
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";

// Helper functions
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

const LiveTimer = ({ startTime }) => {
  const [timeStr, setTimeStr] = useState("00:00:00");

  useEffect(() => {
    if (!startTime) return;
    
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(startTime);
      const diffMs = now - start;

      if (diffMs < 0) {
        setTimeStr("00:00:00");
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
      const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
      const seconds = (totalSeconds % 60).toString().padStart(2, '0');

      setTimeStr(`${hours}:${minutes}:${seconds}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return (
    <div className="flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
      <span className="font-mono font-medium text-green-700">
        {timeStr}
      </span>
    </div>
  );
};

// Calculate login status (from AdminviewAttendance.jsx)
const calculateLoginStatus = (punchInTime, shiftData, apiStatus) => {
  if (!punchInTime) return { status: "--", isLate: false };
  
  const statusUpper = (apiStatus || "").toUpperCase();
  if (statusUpper === "LATE") {
    return { status: "LATE", isLate: true };
  }
  
  if (shiftData && shiftData.shiftStartTime) {
    try {
      const punchDate = new Date(punchInTime);
      const [sHour, sMin] = shiftData.shiftStartTime.split(':').map(Number);
      const shiftDate = new Date(punchDate);
      shiftDate.setHours(sHour, sMin, 0, 0);
      const grace = shiftData.lateGracePeriod || 15;
      shiftDate.setMinutes(shiftDate.getMinutes() + grace);
      
      if (punchDate > shiftDate) {
        return { status: "LATE", isLate: true };
      }
    } catch (e) {
      console.error("Date calc error", e);
    }
  }
  
  return { status: "ON TIME", isLate: false };
};

// Login Status Badge Component
const LoginStatusBadge = ({ status }) => {
  const config = {
    "ON TIME": {
      label: 'On Time',
      icon: <FaUserCheck className="text-xs" />,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500'
    },
    "LATE": {
      label: 'Late',
      icon: <FaExclamationCircle className="text-xs" />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500'
    },
    "--": {
      label: 'Not Logged',
      icon: <FaUserSlash className="text-xs" />,
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-600',
      dot: 'bg-slate-400'
    }
  };

  const { label, icon, bg, border, text, dot } = config[status] || config["--"];

  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded-full ${bg} ${border} border ${text} font-medium text-xs`}>
      <div className={`w-2 h-2 rounded-full ${dot} mr-2`}></div>
      {icon && <span className="mr-1.5">{icon}</span>}
      {label}
    </div>
  );
};

// Status Badge Component
const StatusBadge = ({ status }) => {
  const config = {
    WORKING: { 
      label: 'Working', 
      icon: <FaClock className="text-xs" />,
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-700',
      dot: 'bg-blue-500'
    },
    COMPLETED: { 
      label: 'Completed', 
      icon: <FaCheckCircle className="text-xs" />,
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500'
    },
    NOT_LOGGED_IN: { 
      label: 'Not Logged', 
      icon: <FaUserSlash className="text-xs" />,
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      text: 'text-slate-600',
      dot: 'bg-slate-400'
    },
    ON_LEAVE: { 
      label: 'On Leave', 
      icon: <FaCalendarAlt className="text-xs" />,
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      text: 'text-purple-700',
      dot: 'bg-purple-500'
    },
    LATE: { 
      label: 'Late', 
      icon: <FaUserClock className="text-xs" />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      dot: 'bg-amber-500'
    }
  };

  const { label, icon, bg, border, text, dot } = config[status] || config.WORKING;

  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded-full ${bg} ${border} border ${text} font-medium text-xs`}>
      <div className={`w-2 h-2 rounded-full ${dot} mr-2`}></div>
      {icon && <span className="mr-1.5">{icon}</span>}
      {label}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon, title, value, color, onClick, category, isActive }) => {
  const colors = {
    WORKING: { 
      bg: 'bg-gradient-to-br from-blue-500/5 via-blue-500/2 to-transparent',
      border: 'border-blue-200',
      text: 'text-blue-600',
      gradient: 'from-blue-500 to-blue-600'
    },
    COMPLETED: { 
      bg: 'bg-gradient-to-br from-emerald-500/5 via-emerald-500/2 to-transparent',
      border: 'border-emerald-200',
      text: 'text-emerald-600',
      gradient: 'from-emerald-500 to-emerald-600'
    },
    NOT_LOGGED_IN: { 
      bg: 'bg-gradient-to-br from-slate-500/5 via-slate-500/2 to-transparent',
      border: 'border-slate-200',
      text: 'text-slate-600',
      gradient: 'from-slate-500 to-slate-600'
    },
    ON_LEAVE: { 
      bg: 'bg-gradient-to-br from-purple-500/5 via-purple-500/2 to-transparent',
      border: 'border-purple-200',
      text: 'text-purple-600',
      gradient: 'from-purple-500 to-purple-600'
    },
    LATE: { 
      bg: 'bg-gradient-to-br from-amber-500/5 via-amber-500/2 to-transparent',
      border: 'border-amber-200',
      text: 'text-amber-600',
      gradient: 'from-amber-500 to-amber-600'
    }
  };

  const config = colors[category] || colors.WORKING;

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl p-6 cursor-pointer transition-all duration-300 ${
        isActive ? 'ring-2 ring-offset-2' : ''
      } ${config.bg} border ${config.border} ${
        isActive ? `ring-${category === 'WORKING' ? 'blue' : category === 'COMPLETED' ? 'emerald' : category === 'NOT_LOGGED_IN' ? 'slate' : category === 'ON_LEAVE' ? 'purple' : 'amber'}-500/30` : ''
      }`}
    >
      <div className="absolute top-0 right-0 w-20 h-20 -mr-4 -mt-4 opacity-10">
        <div className={`w-full h-full bg-gradient-to-br ${config.gradient} rounded-full`}></div>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">{title}</p>
            <p className="text-3xl font-semibold text-slate-900">
              {value}
            </p>
          </div>
          <div className={`p-3 rounded-lg ${config.bg}`}>
            {React.cloneElement(icon, { 
              className: `text-xl ${config.text}` 
            })}
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">View Details</span>
            <FaArrowRight className={`text-sm ${config.text}`} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Call Modal Component
const CallModal = ({ isOpen, onClose, employee, phoneNumber }) => {
  if (!isOpen) return null;

  const handleNormalCall = () => {
    window.open(`tel:${phoneNumber}`, '_self');
    onClose();
  };

  const handleWhatsAppCall = () => {
    window.open(`https://wa.me/${phoneNumber}`, '_blank');
    onClose();
  };

  const handleWhatsAppMessage = () => {
    const message = `Hi ${employee?.employeeName || 'there'}, How are you?`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, '_blank');
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Contact Employee</h3>
              <p className="text-sm text-slate-600 mt-0.5">{employee?.employeeName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            >
              <FaTimes className="text-base" />
            </button>
          </div>
        </div>
        
        <div className="p-5">
          <div className="text-center mb-5">
            <div className="w-14 h-14 bg-gradient-to-br from-slate-700 to-slate-900 rounded-full flex items-center justify-center mx-auto mb-3">
              <FaPhoneAlt className="text-white text-xl" />
            </div>
            <h4 className="text-base font-semibold text-slate-900">{employee?.employeeName}</h4>
            <p className="text-sm text-slate-500 mt-0.5">ID: {employee?.employeeId}</p>
            <p className="text-lg font-semibold text-slate-900 mt-2">{phoneNumber || 'No phone number'}</p>
          </div>
          
          <div className="space-y-2.5">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleNormalCall}
              className="w-full py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-2.5 border border-slate-900"
            >
              <FaPhoneAlt className="text-base" />
              Make Phone Call
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleWhatsAppCall}
              className="w-full py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2.5 border border-emerald-600"
            >
              <FaWhatsapp className="text-base" />
              WhatsApp Call
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={handleWhatsAppMessage}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2.5 border border-blue-600"
            >
              <FaComment className="text-base" />
              WhatsApp Message
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Message Modal Component
const MessageModal = ({ isOpen, onClose, employee, phoneNumber }) => {
  const [message, setMessage] = useState(`Hi ${employee?.employeeName || 'there'}, How are you?`);

  if (!isOpen) return null;

  const handleSendMessage = (platform) => {
    let url = '';
    const encodedMessage = encodeURIComponent(message);
    
    if (platform === 'whatsapp') {
      url = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
      window.open(url, '_blank');
    } else if (platform === 'sms') {
      url = `sms:${phoneNumber}?body=${encodedMessage}`;
      window.open(url, '_self');
    }
    
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Send Message</h3>
              <p className="text-sm text-slate-600 mt-0.5">To: {employee?.employeeName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
            >
              <FaTimes className="text-base" />
            </button>
          </div>
        </div>
        
        <div className="p-5">
          <div className="mb-5">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none h-28 text-sm"
              placeholder="Type your message here..."
            />
            <div className="text-xs text-slate-500 mt-1.5">
              {message.length} characters
            </div>
          </div>
          
          <div className="space-y-2.5">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleSendMessage('whatsapp')}
              className="w-full py-3 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2.5 border border-emerald-600"
            >
              <FaWhatsapp className="text-base" />
              Send via WhatsApp
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => handleSendMessage('sms')}
              className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2.5 border border-blue-600"
            >
              <FaComment className="text-base" />
              Send as SMS
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Employee Card Component
const EmployeeCard = ({ employee, onImageClick, category, onCallClick, onMessageClick }) => {
  const profilePic = employee.profilePic;
  const [showDropdown, setShowDropdown] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setShowDropdown(false);
    
    if (showDropdown) {
      window.addEventListener('click', handleClickOutside);
    }
    
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [showDropdown]);

  const toggleDropdown = (e) => {
    e.stopPropagation();
    setShowDropdown(!showDropdown);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-300 border border-slate-200 relative"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div 
              className="relative cursor-pointer group"
              onClick={() => onImageClick(profilePic)}
            >
              <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shadow-sm">
                {profilePic ? (
                  <img 
                    src={profilePic} 
                    alt={employee.employeeName} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                    <span className="text-white font-semibold text-base">
                      {(employee.employeeName || "U").charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </div>
            
            <div>
              <h3 className="font-semibold text-slate-900 text-base">{employee.employeeName}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FaIdBadge className="text-slate-400 text-xs" />
                <span className="text-xs text-slate-600 font-mono">{employee.employeeId}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FaBuilding className="text-slate-400 text-xs" />
                <span className="text-xs text-slate-600">{employee.department}</span>
              </div>
              {employee.phoneNumber && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <FaPhoneAlt className="text-slate-400 text-xs" />
                  <span className="text-xs text-blue-700 font-medium">{employee.phoneNumber}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Dynamic Dropdown Logic */}
          <div className="relative">
            {employee.phoneNumber && (
              <>
                <button 
                  onClick={toggleDropdown}
                  className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
                >
                  <FaEllipsisV className="text-sm" />
                </button>

                <AnimatePresence>
                  {showDropdown && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-xl border border-slate-200 z-50 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-1">
                        <button
                          onClick={() => {
                            onCallClick(employee);
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
                        >
                          <FaPhone className="text-xs" /> Call
                        </button>
                        <button
                          onClick={() => {
                            onMessageClick(employee);
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
                        >
                          <FaEnvelope className="text-xs" /> Message
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </div>
        
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Status</span>
            <StatusBadge status={category} />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Login Status</span>
            <LoginStatusBadge status={employee.loginStatus?.status || "--"} />
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Time Today</span>
            <div className="text-right">
              {employee.punchIn ? (
                <>
                  <div className="text-sm font-medium text-emerald-700">
                    {new Date(employee.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {employee.punchOut && (
                    <div className="text-xs text-rose-700">
                      {new Date(employee.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-400">--</span>
              )}
            </div>
          </div>
          
          {category === 'WORKING' && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Duration</span>
              <LiveTimer startTime={employee.punchIn} />
            </div>
          )}
          
          {employee.isOnLeave && (
            <div className="bg-purple-50 rounded-md p-2.5 border border-purple-100">
              <div className="text-xs font-medium text-purple-800">{employee.leaveType}</div>
              <div className="text-xs text-purple-700 mt-0.5">"{employee.reason}"</div>
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom buttons removed as requested */}
    </motion.div>
  );
};

// Main Component
const TodayOverview = () => {
  const todayISO = new Date().toISOString().split("T")[0];
  
  // State
  const [attendanceData, setAttendanceData] = useState([]);
  const [leaveData, setLeaveData] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [shiftsMap, setShiftsMap] = useState({});
  const [employeeImages, setEmployeeImages] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [callModal, setCallModal] = useState({ isOpen: false, employee: null });
  const [messageModal, setMessageModal] = useState({ isOpen: false, employee: null });
  const [employeePhoneNumbers, setEmployeePhoneNumbers] = useState({});
  const [showLateOnly, setShowLateOnly] = useState(false);

  // Optimized data fetch
  const fetchAllData = useCallback(async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      
      const [
        attendanceRes,
        leaveRes,
        employeesRes,
        shiftsRes
      ] = await Promise.all([
        getAttendanceByDateRange(today, today),
        getLeaveRequests(),
        getEmployees(),
        getAllShifts()
      ]);

      setAttendanceData(Array.isArray(attendanceRes) ? attendanceRes : []);
      setLeaveData(Array.isArray(leaveRes) ? leaveRes : []);
      setAllEmployees(Array.isArray(employeesRes) ? employeesRes : []);

      const shiftsArray = Array.isArray(shiftsRes) ? shiftsRes : shiftsRes?.data || [];
      const map = {};
      shiftsArray.forEach(shift => {
        if (shift.employeeId) map[shift.employeeId] = shift;
      });
      setShiftsMap(map);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // Fetch employee details
  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      if (allEmployees.length === 0) return;
      
      const newImages = {};
      const newPhoneNumbers = {};
      
      // Process only first 20 employees initially (for performance)
      const employeesToProcess = allEmployees.slice(0, 20);
      
      await Promise.all(
        employeesToProcess.map(async (emp) => {
          const empId = emp.employeeId;
          if (!empId) return;
          
          try {
            const res = await api.get(`/api/profile/${empId}`);
            
            if (res?.data?.profilePhoto?.url) {
              newImages[empId] = getSecureUrl(res.data.profilePhoto.url);
            }
            
            if (res?.data?.phone) {
              newPhoneNumbers[empId] = res.data.phone;
            }
          } catch (err) {
            // Silent fail
          }
        })
      );
      
      if (Object.keys(newImages).length > 0) {
        setEmployeeImages(prev => ({ ...prev, ...newImages }));
      }
      
      if (Object.keys(newPhoneNumbers).length > 0) {
        setEmployeePhoneNumbers(prev => ({ ...prev, ...newPhoneNumbers }));
      }
    };
    
    if (allEmployees.length > 0) {
      fetchEmployeeDetails();
    }
  }, [allEmployees]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
  }, []);

  // Process data with login status
  const processedData = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const empNameMap = allEmployees.reduce((acc, emp) => {
      acc[emp.employeeId] = emp.name || emp.employeeName;
      return acc;
    }, {});

    // Process attendance with login status
    const attendanceWithDetails = attendanceData.map(item => {
      const shift = shiftsMap[item.employeeId];
      const realName = empNameMap[item.employeeId] || item.employeeName || item.employeeId;
      const department = allEmployees.find(e => e.employeeId === item.employeeId)?.experienceDetails?.[0]?.department || 'Unassigned';
      const loginStatus = calculateLoginStatus(item.punchIn, shift, item.loginStatus);
      
      return {
        ...item,
        employeeName: realName,
        department,
        category: !item.punchIn ? 'NOT_LOGGED_IN' : 
                  (item.punchIn && !item.punchOut ? 'WORKING' : 'COMPLETED'),
        isOnLeave: false,
        loginStatus,
        profilePic: employeeImages[item.employeeId],
        phoneNumber: employeePhoneNumbers[item.employeeId] || null
      };
    });

    // Get all active employee IDs
    const activeEmployeeIds = new Set(
      allEmployees.filter(e => e.isActive !== false).map(e => e.employeeId)
    );

    // Get employees on leave today
    const onLeaveToday = leaveData.filter(leave => {
      if (leave.status !== 'Approved') return false;
      return today >= leave.from && today <= leave.to;
    }).map(leave => {
      const emp = allEmployees.find(e => e.employeeId === leave.employeeId);
      return {
        employeeId: leave.employeeId,
        employeeName: empNameMap[leave.employeeId] || leave.employeeName || leave.employeeId,
        category: 'ON_LEAVE',
        isOnLeave: true,
        leaveType: leave.leaveType,
        reason: leave.reason,
        department: emp?.experienceDetails?.[0]?.department || 'Unassigned',
        punchIn: null,
        punchOut: null,
        loginStatus: { status: "--", isLate: false },
        profilePic: employeeImages[leave.employeeId],
        phoneNumber: employeePhoneNumbers[leave.employeeId] || null
      };
    });

    // Get employees not logged in
    const presentIds = new Set(attendanceData.map(att => att.employeeId));
    const onLeaveIds = new Set(onLeaveToday.map(l => l.employeeId));
    
    const notLoggedIn = Array.from(activeEmployeeIds)
      .filter(id => !presentIds.has(id) && !onLeaveIds.has(id))
      .map(id => {
        const emp = allEmployees.find(e => e.employeeId === id);
        return {
          employeeId: id,
          employeeName: empNameMap[id] || id,
          category: 'NOT_LOGGED_IN',
          isOnLeave: false,
          department: emp?.experienceDetails?.[0]?.department || 'Unassigned',
          punchIn: null,
          punchOut: null,
          loginStatus: { status: "--", isLate: false },
          profilePic: employeeImages[id],
          phoneNumber: employeePhoneNumbers[id] || null
        };
      });

    const allData = [...attendanceWithDetails, ...onLeaveToday, ...notLoggedIn];

    // Apply filters
    let filtered = allData;
    
    // Apply late filter
    if (showLateOnly) {
      filtered = filtered.filter(item => item.loginStatus?.isLate === true);
    }
    
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.employeeName.toLowerCase().includes(lowerTerm) ||
        item.employeeId.toLowerCase().includes(lowerTerm) ||
        item.department.toLowerCase().includes(lowerTerm) ||
        (item.phoneNumber && item.phoneNumber.includes(searchTerm))
      );
    }
    
    if (departmentFilter !== "All") {
      filtered = filtered.filter(item => item.department === departmentFilter);
    }
    
    return filtered;
  }, [attendanceData, leaveData, allEmployees, shiftsMap, searchTerm, departmentFilter, employeeImages, employeePhoneNumbers, showLateOnly]);

  // Categorize data
  const categorizedData = useMemo(() => {
    const categories = {
      WORKING: processedData.filter(item => item.category === 'WORKING'),
      COMPLETED: processedData.filter(item => item.category === 'COMPLETED'),
      NOT_LOGGED_IN: processedData.filter(item => item.category === 'NOT_LOGGED_IN'),
      ON_LEAVE: processedData.filter(item => item.category === 'ON_LEAVE')
    };
    return categories;
  }, [processedData]);

  // Late employees count
  const lateEmployeesCount = useMemo(() => {
    return processedData.filter(item => item.loginStatus?.isLate === true).length;
  }, [processedData]);

  // Statistics
  const stats = useMemo(() => ({
    working: categorizedData.WORKING.length,
    completed: categorizedData.COMPLETED.length,
    notLoggedIn: categorizedData.NOT_LOGGED_IN.length,
    onLeave: categorizedData.ON_LEAVE.length,
    late: lateEmployeesCount,
    total: processedData.length
  }), [categorizedData, processedData, lateEmployeesCount]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = processedData.map(item => item.department).filter(Boolean);
    return ['All', ...new Set(depts)];
  }, [processedData]);

  // Get displayed data based on selection
  const displayedData = useMemo(() => {
    if (selectedCategory) {
      return categorizedData[selectedCategory];
    }
    return processedData;
  }, [selectedCategory, categorizedData, processedData]);

  // Handle call button click
  const handleCallClick = (employee) => {
    setCallModal({ isOpen: true, employee });
  };

  // Handle message button click
  const handleMessageClick = (employee) => {
    setMessageModal({ isOpen: true, employee });
  };

  // Auto-refresh data every 3 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllData();
    }, 180000); // 3 minutes
    
    return () => clearInterval(interval);
  }, [fetchAllData]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
<div className=" z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between h-20">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg shadow">
                <FaCalendarDay className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">
                  Today's Overview
                </h1>
                <p className="text-sm text-slate-500 flex items-center gap-1.5">
                  <span>{formatDateDMY(new Date())}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="font-medium">Live Updates</span>
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2.5 mt-4 sm:mt-0">
              {/* Search */}
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-sm" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-56 text-sm shadow-sm"
                />
              </div>
              
              {/* Refresh Button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={fetchAllData}
                disabled={loading}
                className={`px-3.5 py-2.5 font-medium rounded-lg transition-all text-sm flex items-center gap-1.5 ${
                  loading 
                    ? 'bg-slate-300 text-slate-700 cursor-not-allowed' 
                    : 'bg-slate-800 text-white hover:bg-slate-900'
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Loading...
                  </>
                ) : (
                  'Refresh'
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <StatCard
            icon={<FaClock />}
            title="Currently Working"
            value={stats.working}
            category="WORKING"
            isActive={selectedCategory === 'WORKING'}
            onClick={() => {
              setSelectedCategory(selectedCategory === 'WORKING' ? null : 'WORKING');
              setShowLateOnly(false);
            }}
          />
          
          <StatCard
            icon={<FaCheckCircle />}
            title="Shift Completed"
            value={stats.completed}
            category="COMPLETED"
            isActive={selectedCategory === 'COMPLETED'}
            onClick={() => {
              setSelectedCategory(selectedCategory === 'COMPLETED' ? null : 'COMPLETED');
              setShowLateOnly(false);
            }}
          />
          
          <StatCard
            icon={<FaUserSlash />}
            title="Not Logged In"
            value={stats.notLoggedIn}
            category="NOT_LOGGED_IN"
            isActive={selectedCategory === 'NOT_LOGGED_IN'}
            onClick={() => {
              setSelectedCategory(selectedCategory === 'NOT_LOGGED_IN' ? null : 'NOT_LOGGED_IN');
              setShowLateOnly(false);
            }}
          />
          
          <StatCard
            icon={<FaCalendarAlt />}
            title="On Leave Today"
            value={stats.onLeave}
            category="ON_LEAVE"
            isActive={selectedCategory === 'ON_LEAVE'}
            onClick={() => {
              setSelectedCategory(selectedCategory === 'ON_LEAVE' ? null : 'ON_LEAVE');
              setShowLateOnly(false);
            }}
          />
          
          <StatCard
            icon={<FaUserClock />}
            title="Late Employees"
            value={stats.late}
            category="LATE"
            isActive={showLateOnly}
            onClick={() => {
              setShowLateOnly(!showLateOnly);
              setSelectedCategory(null);
            }}
          />
        </div>

        {/* Filters and Category Tabs */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedCategory(null);
                  setShowLateOnly(false);
                }}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  selectedCategory === null && !showLateOnly
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
                }`}
              >
                All Employees ({processedData.length})
              </button>
              
              {['WORKING', 'COMPLETED', 'NOT_LOGGED_IN', 'ON_LEAVE'].map(category => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(selectedCategory === category ? null : category);
                    setShowLateOnly(false);
                  }}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 ${
                    selectedCategory === category
                      ? category === 'WORKING' 
                        ? 'bg-blue-600 text-white shadow'
                        : category === 'COMPLETED'
                        ? 'bg-emerald-600 text-white shadow'
                        : category === 'NOT_LOGGED_IN'
                        ? 'bg-slate-600 text-white shadow'
                        : 'bg-purple-600 text-white shadow'
                      : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
                  }`}
                >
                  {category === 'WORKING' ? 'Working' :
                   category === 'COMPLETED' ? 'Completed' :
                   category === 'NOT_LOGGED_IN' ? 'Not Logged' : 'On Leave'}
                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                    selectedCategory === category
                      ? 'bg-white/20'
                      : category === 'WORKING' ? 'bg-blue-100 text-blue-700'
                      : category === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                      : category === 'NOT_LOGGED_IN' ? 'bg-slate-100 text-slate-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {categorizedData[category]?.length || 0}
                  </span>
                </button>
              ))}
              
              {/* Late Employees Filter */}
              <button
                onClick={() => {
                  setShowLateOnly(!showLateOnly);
                  setSelectedCategory(null);
                }}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-1.5 ${
                  showLateOnly
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
                }`}
              >
                <FaUserClock className="text-xs" />
                Late ({stats.late})
              </button>
            </div>
            
            {/* Department Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">Department:</span>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="text-sm text-slate-500">
            Showing {displayedData.length} of {processedData.length} employees
            {showLateOnly && ` • ${stats.late} late employees`}
          </div>
        </div>

        {/* Employees Grid */}
        {loading && processedData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-600 text-sm">Loading employee data...</p>
          </div>
        ) : displayedData.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gradient-to-br from-slate-200 to-slate-300 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCalendarDay className="text-slate-400 text-2xl" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">No employees found</h3>
            <p className="text-slate-500 text-sm">Try changing your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedData.map((employee, idx) => (
              <EmployeeCard
                key={employee.employeeId || idx}
                employee={employee}
                category={employee.category}
                onImageClick={setPreviewImage}
                onCallClick={handleCallClick}
                onMessageClick={handleMessageClick}
              />
            ))}
          </div>
        )}

        {/* Summary Stats */}
        <div className="mt-10 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl p-6 border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Today's Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <div className="text-sm font-medium text-slate-500 mb-1">Attendance Rate</div>
              <div className="text-2xl font-semibold text-slate-900">
                {processedData.length > 0 ? Math.round(((stats.working + stats.completed) / processedData.length) * 100) : 0}%
              </div>
              <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full"
                  style={{ width: `${processedData.length > 0 ? ((stats.working + stats.completed) / processedData.length) * 100 : 0}%` }}
                ></div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <div className="text-sm font-medium text-slate-500 mb-1">Active Employees</div>
              <div className="text-2xl font-semibold text-slate-900">{stats.working + stats.completed}</div>
              <div className="mt-1 text-xs text-slate-600">Currently engaged</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <div className="text-sm font-medium text-slate-500 mb-1">Contactable</div>
              <div className="text-2xl font-semibold text-blue-700">
                {processedData.filter(e => e.phoneNumber).length}
              </div>
              <div className="mt-1 text-xs text-slate-600">Employees with phone</div>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm border border-slate-200">
              <div className="text-sm font-medium text-slate-500 mb-1">Punctuality</div>
              <div className="text-2xl font-semibold text-amber-700">{stats.late}</div>
              <div className="mt-1 text-xs text-slate-600">Late arrivals</div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {/* Call Modal */}
        {callModal.isOpen && (
          <CallModal
            isOpen={callModal.isOpen}
            onClose={() => setCallModal({ isOpen: false, employee: null })}
            employee={callModal.employee}
            phoneNumber={employeePhoneNumbers[callModal.employee?.employeeId]}
          />
        )}

        {/* Message Modal */}
        {messageModal.isOpen && (
          <MessageModal
            isOpen={messageModal.isOpen}
            onClose={() => setMessageModal({ isOpen: false, employee: null })}
            employee={messageModal.employee}
            phoneNumber={employeePhoneNumbers[messageModal.employee?.employeeId]}
          />
        )}

        {/* Image Preview Modal */}
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative max-w-3xl max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setPreviewImage(null)}
                className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
              >
                <FaTimes size={20} />
              </button>
              <img
                src={previewImage}
                alt="Profile"
                className="rounded-lg shadow-2xl max-w-full max-h-[85vh] object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TodayOverview;
// --- END OF FILE TodayOverview.jsx ---