import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useContext } from "react";
import { 
  FaHome, 
  FaClock, 
  FaClipboardList, 
  FaBullhorn, 
  FaUser, 
  FaBars, 
  FaTimes 
} from "react-icons/fa";
import { CurrentEmployeeNotificationContext } from "../../EmployeeContext/CurrentEmployeeNotificationContext";

const navLinks = [
  {
    to: "/employee/dashboard",
    label: "Dashboard",
    icon: <FaHome className="mr-2" />,
  },
  {
    to: "/employee/my-attendence",
    label: "Attendance",
    icon: <FaClock className="mr-2" />,
  },
  {
    to: "/employee/holiday-calendar",
    label: "Holiday Calendar",
    icon: <FaClipboardList className="mr-2" />,
  },
  {
    to: "/employee/notices",
    label: "Notice Board",
    icon: <FaBullhorn className="mr-2" />,
    isNotice: true, // 🔥 Indicator flag
  },
  {
    to: "/employee/empovertime",
    label: "Request Overtime",
    icon: <FaClock className="mr-2" />,
  },
  {
    to: "/employee/leave-request",
    label: "Leave Requests",
    icon: <FaClipboardList className="mr-2" />,
  },
];

const SidebarEmployee = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(window.innerWidth >= 768);
  const [collapsed, setCollapsed] = useState(false);

  // 🔴 Get unread notices from context
  const { notifications } = useContext(CurrentEmployeeNotificationContext);
  const unreadNotices = notifications.filter(
    (n) => n.userId === "ALL" && !n.isRead
  ).length;

  useEffect(() => {
    const handleResize = () => {
      setOpen(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <>
      {/* Mobile hamburger */}
      {!open && (
        <button
          className="md:hidden fixed top-4 left-4 z-50 bg-blue-900 text-white p-2 rounded-lg shadow-lg focus:outline-none"
          onClick={() => setOpen(true)}
        >
          <FaBars className="text-2xl" />
        </button>
      )}

      {/* Sidebar container */}
      <div
        className={`fixed md:static top-0 left-0 h-full ${
          collapsed ? "w-20" : "w-64"
        } bg-gradient-to-b from-blue-900 to-blue-700 text-white shadow-xl flex flex-col p-4 md:p-6 z-40 transition-all duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        {/* Collapse toggle */}
        <button
          className="hidden md:block absolute top-4 right-4 text-white text-xl bg-blue-700 rounded-full p-2 shadow hover:bg-blue-800"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? <FaBars /> : <FaTimes />}
        </button>

        {/* Mobile close */}
        {open && (
          <button
            className="md:hidden absolute top-4 right-4 text-white text-2xl"
            onClick={() => setOpen(false)}
          >
            <FaTimes />
          </button>
        )}

        {/* Header */}
        <div
          className={`mb-8 flex items-center gap-1 mt-2 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          {!collapsed && <FaUser className="text-3xl" />}
          {!collapsed && (
            <span className="text-lg font-bold tracking-wide">
              Employee Panel
            </span>
          )}
        </div>

        {/* Navigation links */}
        <ul className="space-y-2 flex-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;

            return (
              <li key={link.to}>
                <Link
                  to={link.to}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all duration-150 text-base ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg"
                      : "hover:bg-blue-700 hover:text-blue-300 text-gray-200"
                  } ${collapsed ? "justify-center px-2" : ""}`}
                >
                  <span className="text-xl">{link.icon}</span>

                  {/* Text + RED DOT indicator */}
                  {!collapsed && (
                    <span className="flex items-center gap-2 relative">
                      {link.label}

                      {/* 🔴 Pulsing Red Dot for unread notices */}
                      {link.isNotice && unreadNotices > 0 && (
                        <span className="absolute -right-4 top-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                      )}
                      {link.isNotice && unreadNotices > 0 && (
                        <span className="absolute -right-4 top-1 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {!collapsed && (
          <div className="mt-2 text-xs text-gray-300">
            &copy; {new Date().getFullYear()} HRMS Employee
          </div>
        )}
      </div>
    </>
  );
};

export default SidebarEmployee;
