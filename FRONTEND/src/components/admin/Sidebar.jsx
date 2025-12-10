// --- START OF FILE Sidebar.jsx ---

import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  FaTachometerAlt,
  FaUsers,
  FaCalendarCheck,
  FaClipboardList,
  FaChartPie,
  FaBars,
  FaCalendarAlt,
  FaFileAlt,
  FaConnectdevelop,
  FaAngleDown,
  FaAngleRight,
  FaUserClock
} from "react-icons/fa";
import { io } from "socket.io-client";
import { getLeaveRequests, getAllOvertimeRequests } from "../../api";
import { MapPinnedIcon, MapPinPlusInsideIcon } from "lucide-react";

// SOCKET URL
const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// REORGANIZED NAV LINKS WITH GROUPS
const navLinks = [
  { to: "/admin/dashboard", label: "Dashboard", icon: <FaTachometerAlt /> },

  // --- GROUP: EMPLOYEES ---
  {
    label: "Employees",
    icon: <FaUsers />,
    children: [
      { to: "/employees", label: "Employee Management", icon: <FaUsers /> },
      { to: "/attendance", label: "Employees Attendance", icon: <FaUserClock /> },
    ],
  },

  // --- GROUP: LEAVES ---
  {
    label: "Leaves",
    icon: <FaCalendarCheck />,
    children: [
      { to: "/admin/leave-summary", label: "Leave Summary", icon: <FaChartPie /> },
      {
        to: "/admin/admin-Leavemanage",
        label: "Leave Approvals",
        icon: <FaClipboardList />,
        isLeave: true, // Badge Logic
      },
    ],
  },

  // --- OTHER LINKS ---
  { to: "/admin/idle-time", label: "Idle Time", icon: <FaChartPie /> },
  { to: "/admin/payroll", label: "Payroll", icon: <FaFileAlt /> },
  { to: "/admin/notices", label: "Post Notices", icon: <FaClipboardList /> },
  { to: "/admin/holiday-calendar", label: "Holiday Calendar", icon: <FaCalendarAlt /> },

  // BADGE LINKS (Overtime)
  {
    to: "/admin/admin-overtime",
    label: "Overtime Approval",
    icon: <FaChartPie />,
    isOvertime: true,
  },
  { to: "/admin/shifttype", label: "Location Settings", icon:<MapPinnedIcon /> },
];

const Sidebar = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingOvertime, setPendingOvertime] = useState(0);
  const [socket, setSocket] = useState(null);

  // State for handling the hover/click dropdown
  const [activeMenu, setActiveMenu] = useState(null);

  const isPending = (status) =>
    typeof status === "string" && status.toLowerCase() === "pending";

  // -----------------------------
  // INITIAL FETCH FOR COUNTS
  // -----------------------------
  useEffect(() => {
    const fetchLeaves = async () => {
      const data = await getLeaveRequests();
      setPendingLeaves(data.filter((l) => isPending(l.status)).length);
    };
    fetchLeaves();
  }, []);

  useEffect(() => {
    const fetchOT = async () => {
      const data = await getAllOvertimeRequests();
      setPendingOvertime(data.filter((o) => isPending(o.status)).length);
    };
    fetchOT();
  }, []);

  // -----------------------------
  // SINGLE SOCKET CONNECTION + REGISTER
  // -----------------------------
  useEffect(() => {
    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    s.on("connect", () => {
      try {
        const raw = sessionStorage.getItem("hrmsUser");
        if (raw) {
          const user = JSON.parse(raw);
          const id = user?._id || user?.id;

          if (id) {
            s.emit("register", id);
            console.log("📡 Registered admin on socket:", id);
          }
        }
      } catch (err) {
        console.error("Socket register parse fail:", err);
      }
    });

    setSocket(s);
    return () => s.disconnect();
  }, []);

  // -----------------------------
  // REAL-TIME EVENTS
  // -----------------------------
  useEffect(() => {
    if (!socket) return;
    socket.on("leave:new", () => setPendingLeaves((prev) => prev + 1));
    socket.on("leave:updated", (data) => {
      if (!isPending(data.status)) setPendingLeaves((prev) => Math.max(prev - 1, 0));
    });
    socket.on("leave:cancelled", () => setPendingLeaves((prev) => Math.max(prev - 1, 0)));
    return () => {
      socket.off("leave:new");
      socket.off("leave:updated");
      socket.off("leave:cancelled");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on("overtime:new", () => setPendingOvertime((prev) => prev + 1));
    socket.on("overtime:updated", (data) => {
      if (!isPending(data.status)) setPendingOvertime((prev) => Math.max(prev - 1, 0));
    });
    socket.on("overtime:cancelled", () => setPendingOvertime((prev) => Math.max(prev - 1, 0)));
    return () => {
      socket.off("overtime:new");
      socket.off("overtime:updated");
      socket.off("overtime:cancelled");
    };
  }, [socket]);

  // Handle Hover/Click Logic for menus
  const handleMenuHover = (label, isEntering) => {
    if (isEntering) {
      if (collapsed) setCollapsed(false); // Auto expand sidebar if hovering a group
      setActiveMenu(label);
    } else {
      setActiveMenu(null);
    }
  };

  // Helper to render the badge
  const renderBadge = (link) => {
    if (link.isLeave && pendingLeaves > 0) {
      return (
        <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ml-auto">
          {pendingLeaves}
        </span>
      );
    }
    if (link.isOvertime && pendingOvertime > 0) {
      return (
        <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ml-auto">
          {pendingOvertime}
        </span>
      );
    }
    return null;
  };

  // -----------------------------
  // RENDER SIDEBAR
  // -----------------------------
  return (
    <div
      className={`h-screen bg-slate-900 shadow-xl transition-[width] duration-300 ${
        collapsed ? "w-20" : "w-72"
      } p-4 flex flex-col overflow-y-auto overflow-x-hidden`}
    >
      {/* HEADER */}
      <div
        className={`flex items-center mb-6 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <div
          className={`flex items-center gap-3 transition-all hover:bg-slate-800 ${
            collapsed ? "w-0 opacity-0 hidden" : "w-full opacity-100 flex"
          }`}
          onClick={() => setCollapsed((p) => !p)}
        >
          <span className="text-3xl text-indigo-400">
            <FaConnectdevelop />
          </span>
          <span className="text-xl font-bold text-slate-200">HRMS</span>
        </div>

        <button
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-800"
          onClick={() => setCollapsed((p) => !p)}
        >
          <FaBars />
        </button>
      </div>

      {/* NAV LINKS */}
      <ul className="space-y-2 flex-1">
        {navLinks.map((link, index) => {
          // CHECK IF IT IS A GROUP (Has children)
          if (link.children) {
            const isOpen = activeMenu === link.label;

            return (
              <li
                key={index}
                className="relative"
                onMouseEnter={() => handleMenuHover(link.label, true)}
                onMouseLeave={() => handleMenuHover(link.label, false)}
              >
                {/* PARENT ITEM */}
                <div
                  className={`flex items-center gap-4 px-4 py-2.5 rounded-lg text-base cursor-pointer border-l-4 border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200 ${
                    collapsed ? "justify-center px-2" : "justify-between"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-xl w-5 flex justify-center">
                      {link.icon}
                    </span>
                    {!collapsed && <span>{link.label}</span>}
                  </div>
                  {!collapsed && (
                    <span className="text-xs">
                      {isOpen ? <FaAngleDown /> : <FaAngleRight />}
                    </span>
                  )}
                </div>

                {/* CHILDREN ITEMS (DROPDOWN) */}
                <ul
                  className={`bg-slate-800/50 rounded-lg overflow-hidden transition-all duration-300 ${
                    isOpen && !collapsed ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"
                  }`}
                >
                  {link.children.map((child) => (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 pl-12 pr-4 py-2 text-sm transition-colors ${
                            isActive
                              ? "text-indigo-400 font-semibold"
                              : "text-slate-400 hover:text-slate-200"
                          }`
                        }
                      >
                        {/* Render Badge if needed */}
                        <span className="flex-1">{child.label}</span>
                        {renderBadge(child)}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </li>
            );
          }

          // STANDARD SINGLE LINK
          return (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-2.5 rounded-lg text-base border-l-4 ${
                    isActive
                      ? "bg-slate-800 text-indigo-400 border-indigo-500"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-transparent"
                  } ${collapsed ? "justify-center px-2" : ""}`
                }
              >
                <span className="text-xl w-5 flex justify-center">
                  {link.icon}
                </span>

                {!collapsed && (
                  <span className="flex items-center gap-2 relative w-full">
                    {link.label}
                    {renderBadge(link)}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>

      <div
        className={`mt-auto text-center text-xs text-slate-500 ${
          collapsed ? "opacity-0 hidden" : "opacity-100 block"
        }`}
      >
        &copy; {new Date().getFullYear()} HRMS Admin
      </div>
    </div>
  );
};

export default Sidebar;
// --- END OF FILE Sidebar.jsx ---