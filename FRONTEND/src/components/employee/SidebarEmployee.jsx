import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useContext, useCallback, useRef } from "react";
import {
  FaBullhorn,
  FaUser,
  FaBars,
  FaTimes,
  FaTachometerAlt,
  FaUserCheck,
  FaUmbrellaBeach,
  FaHourglassHalf,
  FaPlaneDeparture,
  FaLaptopHouse,
  FaMoneyCheckAlt,
  FaUserFriends,
  FaReceipt
} from "react-icons/fa";


// Import AuthContext to get current user details
import { AuthContext } from "../../context/AuthContext";
// Import API to fetch real DB data
import api from "../../api";
import { CalendarDays, ChartPie, MapPinHouse } from "lucide-react";

const navLinks = [
  { to: "/employee/dashboard", label: "Dashboard", icon: <FaTachometerAlt /> },

  { to: "/employee/my-attendence", label: "Attendance", icon: <FaUserCheck /> },

  { to: "/employee/holiday-calendar", label: "Holiday Calendar", icon: <FaUmbrellaBeach /> },

  { to: "/employee/notices", label: "Notice Board", icon: <FaBullhorn />, isNotice: true },

  { to: "/employee/empovertime", label: "Request Overtime", icon: <FaHourglassHalf /> },

  { to: "/employee/leave-management", label: "Leave Requests", icon: <FaPlaneDeparture /> },

  { to: "/employee/reuestworkmode", label: "WorkMode Request", icon: <FaLaptopHouse /> },

  { to: "/employee/payslip", label: "Pay-Slip", icon: <FaMoneyCheckAlt /> },

  {
    to: "/employee/chatting",
    label: "Connect with Employee",
    icon: <FaUserFriends />,
  },

  { to: "/employee/expense", label: "Add Expense", icon: <FaReceipt /> }
];

const SidebarEmployee = () => {
  const location = useLocation();
  const [open, setOpen] = useState(window.innerWidth >= 768);
  const [collapsed, setCollapsed] = useState(false);

  // Get current user to check against DB records and get NAME
  const { user } = useContext(AuthContext);

  // Local state for accurate DB count
  const [unreadCount, setUnreadCount] = useState(0);

  // ✅ Refs to track previous count for Sound Logic (Prevents re-renders)
  const lastCountRef = useRef(0);
  const firstLoadRef = useRef(true);

  useEffect(() => {
    const resize = () => setOpen(window.innerWidth >= 768);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ✅ SOUND FUNCTION WITH NAME
  const playNoticeSound = () => {
    if ('speechSynthesis' in window && user?.name) {
      window.speechSynthesis.cancel(); // Stop any current speech
      // Speak Name + Message
      const utterance = new SpeechSynthesisUtterance(`${user.name}, please check notices`);
      utterance.rate = 1.0; // Normal speed
      window.speechSynthesis.speak(utterance);
    }
  };

  // ✅ FETCH REAL UNREAD COUNT (Wrapped in useCallback)
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get("/api/notices");

      const count = data.filter(notice => {
        // Skip system/config notices from badge count
        if (!notice?.title) return false;
        if (typeof notice.title === 'string' && notice.title.startsWith("__SYSTEM_")) return false;

        // If recipients are specified, ensure current user is a target
        if (Array.isArray(notice.recipients) && notice.recipients.length > 0) {
          const currentId = (user?._id || user?.id);
          if (!notice.recipients.includes(currentId)) return false;
        }

        // Check if current user ID is present inside the readBy array
        const isRead = Array.isArray(notice.readBy) && notice.readBy.some(record => {
          const recordId = typeof record.employeeId === 'object'
            ? record.employeeId._id
            : record.employeeId;
          return recordId === (user._id || user.id);
        });

        // Return true if NOT read (to count it)
        return !isRead;
      }).length;

      // ✅ SOUND LOGIC: Check if count increased
      if (!firstLoadRef.current) {
        if (count > lastCountRef.current) {
          playNoticeSound();
        }
      } else {
        firstLoadRef.current = false;
      }

      lastCountRef.current = count;
      setUnreadCount(prev => prev !== count ? count : prev);

    } catch (error) {
      console.error("Failed to fetch unread notice count", error);
    }
  }, [user]); // user dependency ensures we have the name available

  // ✅ POLLING EFFECT: Updates every 3 seconds & on Route Change
  useEffect(() => {
    // 1. Fetch immediately on mount or route change
    fetchUnreadCount();

    // 2. Poll every 3 seconds to catch incoming notices without refresh
    const interval = setInterval(fetchUnreadCount, 3000);

    // Cleanup interval on unmount
    return () => clearInterval(interval);
  }, [fetchUnreadCount, location.pathname]);

  return (
    <>
      <style>
        {`
          /* Custom Scrollbar for Sidebar */
          .sidebar-scroll::-webkit-scrollbar {
            width: 5px;
          }
          .sidebar-scroll::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1); 
          }
          .sidebar-scroll::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3); 
            border-radius: 10px;
          }
          .sidebar-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5); 
          }
        `}
      </style>

      {!open && (
        <button
          className="md:hidden fixed top-4 left-4 z-50 bg-blue-900 text-white p-2 rounded-lg shadow-lg"
          onClick={() => setOpen(true)}
        >
          <FaBars />
        </button>
      )}

      <div
        className={`fixed md:sticky top-0 left-0 h-screen ${collapsed ? "w-20" : "w-64"
          } bg-gradient-to-b from-blue-900 to-blue-700 text-white shadow-xl flex flex-col z-40 transition-all duration-300 ${open ? "translate-x-0" : "-translate-x-full"
          } md:translate-x-0`}
      >
        {/* Toggle Button for Desktop */}
<button
  className="hidden md:block absolute top-4 -right-0 text-white text-sm bg-blue-800 border border-blue-600 rounded-full p-1.5 shadow-md z-50 hover:bg-blue-600 transition"
  onClick={() => setCollapsed((v) => !v)}
>
  {collapsed ? <FaBars /> : <FaTimes />}
</button>


        {open && (
          <button
            className="md:hidden absolute top-4 right-4 text-white text-2xl"
            onClick={() => setOpen(false)}
          >
            <FaTimes />
          </button>
        )}

        {/* Header Section (Fixed at top of sidebar) */}
   {/* Header Section */}
<div
  className={`p-4 flex items-center gap-1 shrink-0 relative ${collapsed ? "justify-center" : "justify-start"
    }`}
>
  {/* Always show user icon */}
  <FaUser className={`text-3xl cursor-pointer`} onClick={() => setOpen(true)} />

  {/* Only show text when expanded */}
  {!collapsed && open && (
    <span className="text-lg font-bold ml-2">Employee Panel</span>
  )}
</div>


        {/* Navigation Links (Scrollable Area) */}
        <ul className="space-y-2 flex-1 overflow-y-auto sidebar-scroll px-4 pb-4">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;

            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition font-semibold ${isActive
                    ? "bg-blue-600 text-white shadow-md"
                    : "hover:bg-blue-800/50 text-gray-200"
                    } ${collapsed ? "justify-center px-2" : ""}`}
                >
                  <span className="text-xl shrink-0">{link.icon}</span>

                  {!collapsed && (
                    <span className="relative">
                      {link.label}

                      {/* ✅ Updated Badge Logic with Polling & Sound */}
                      {link.isNotice && unreadCount > 0 && (
                        <span className="absolute -right-5 top-0 bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full animate-pulse shadow-sm border border-white">
                          {unreadCount}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Footer Section (Fixed at bottom of sidebar) */}
        {!collapsed && (
          <div className="p-4 text-center shrink-0 border-t border-blue-600/30">
            <div className="text-xs text-gray-300">
              &copy; {new Date().getFullYear()} HRMS Employee
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SidebarEmployee;