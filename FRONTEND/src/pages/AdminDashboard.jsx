import React, { useState, useContext, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers, FaClipboardList, FaChevronLeft, FaChevronRight,
  FaSyncAlt, FaUmbrellaBeach, FaAngleRight, FaCalendarAlt, FaFileAlt, FaBullhorn,
  FaUserClock, FaChartPie, FaCalendarCheck, FaLayerGroup, FaConnectdevelop,
  FaCheck, FaTimes, FaWifi, FaRegCalendarCheck, FaRegClock
} from "react-icons/fa";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { EmployeeContext } from "../context/EmployeeContext";
import { AttendanceContext } from "../context/AttendanceContext";
import { LeaveRequestContext } from "../context/LeaveRequestContext";
import {
  getAttendanceByDateRange, getLeaveRequests, getEmployees,
  approveLeaveRequestById, rejectLeaveRequestById
} from "../api";
import api from "../api";
import Swal from "sweetalert2";

/* ═══════════════════════════════════════════════════
   GLOBAL STYLES (updated to match image exactly)
═══════════════════════════════════════════════════ */
const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');

    .adm {
      font-family: 'Nunito', sans-serif;
      min-height: 100vh;
      padding: 30px 30px 48px;
      color: #111a35;
      background: linear-gradient(150deg,
        #c4d2f6 0%, #b1c2ef 15%, #97aceb 30%,
        #7a96e3 46%, #6080d8 60%, #4d6cc6 74%,
        #3e5cb2 88%, #334fa0 100%
      );
    }

    .adm-h1 { font-size: 26px; font-weight: 900; color: #101830; margin-bottom: 24px; }

    /* Glass card */
    .g {
      background: rgba(255,255,255,0.76);
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
      border-radius: 20px;
      border: 1px solid rgba(255,255,255,0.58);
      box-shadow: 0 2px 22px rgba(30,50,130,0.10);
    }

    /* ── STAT ROW (exactly 4 cards) ── */
    .stat-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 22px;
    }
    @media(max-width:900px){ .stat-row { grid-template-columns: 1fr 1fr; } }

    .sc {
      padding: 22px 22px;
      display: flex; align-items: center; justify-content: space-between;
      cursor: pointer; transition: transform .18s, box-shadow .18s;
    }
    .sc:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(40,60,150,0.18); }
    .sc-num  { font-size: 32px; font-weight: 800; line-height: 1; color: #101830; }
    .sc-lbl  { font-size: 14px; font-weight: 700; color: #5a6a90; margin-top: 6px; }
    .sc-icon { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 24px; }

    /* ── MAIN 2-COL ── */
    .mg { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    @media(max-width:900px){ .mg { grid-template-columns: 1fr; } }
    .rc { display: flex; flex-direction: column; gap: 18px; }

    .cp { padding: 22px 22px; }
    .sec-t { font-size: 16px; font-weight: 800; color: #101830; margin-bottom: 16px; }

    /* ── DEPT (left side) ── */
    .dept-bar-wrap { display: flex; align-items: center; gap: 18px; }
    .dept-pct-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; color: #4a5a80; margin-bottom: 4px; }
    .dept-bar {
      height: 34px; border-radius: 24px;
      display: flex; align-items: center; padding-left: 16px;
      color: #fff; font-size: 13px; font-weight: 800;
    }

    /* ── GAUGE (today attendance) ── */
    .gauge-area { display: flex; align-items: flex-end; gap: 22px; }
    .gauge-legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; }
    .gauge-nav { display: flex; align-items: center; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    .gnav-btn {
      background: rgba(90,130,210,0.14); border: none; border-radius: 8px;
      padding: 5px 10px; cursor: pointer; color: #3a5ab0; font-size: 12px; font-weight: 700;
    }
    .gnav-btn:disabled { opacity: 0.35; cursor: default; }
    .gnav-label { font-size: 12px; font-weight: 700; color: #3a5ab0; }
    .dept-sel {
      background: rgba(255,255,255,0.95);
      border: 1.5px solid rgba(90,130,210,0.25);
      border-radius: 10px; padding: 6px 12px;
      font-size: 12px; font-weight: 700; color: #101830;
      outline: none; cursor: pointer; font-family: 'Nunito', sans-serif;
    }

    /* ── LEAVE ACTIVITY ── */
    .lv-row {
      display: flex; align-items: center; gap: 11px;
      padding: 9px 0; border-bottom: 1px solid rgba(80,110,190,0.09);
    }
    .lv-row:last-child { border-bottom: none; }
    .lv-av {
      width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 15px; color: #fff; overflow: hidden;
    }
    .lv-av img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .lv-name { font-size: 13px; font-weight: 800; color: #101830; }
    .lv-sub  { font-size: 11px; font-weight: 600; color: #7080a0; }
    .lv-badge { font-size: 10px; font-weight: 800; padding: 2px 9px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
    .badge-pending  { background: rgba(251,191,36,0.18); color: #b45309; }
    .badge-approved { background: rgba(52,211,153,0.18); color: #047857; }
    .badge-rejected { background: rgba(248,113,113,0.18); color: #b91c1c; }
    .lv-actions { margin-left: auto; display: flex; gap: 7px; flex-shrink: 0; }
    .btn-ap { background:#22c55e; color:#fff; border:none; border-radius:8px; width:28px; height:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
    .btn-rj { background:#ef4444; color:#fff; border:none; border-radius:8px; width:28px; height:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; }

    /* ── REMOTE WORKERS ── */
    .rw-card {
      display: flex; align-items: center; gap: 11px;
      padding: 9px 12px; border-radius: 13px;
      background: rgba(255,255,255,0.55); margin-bottom: 8px;
    }
    .rw-av {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 800; font-size: 14px; flex-shrink: 0;
    }
    .rw-name { font-size: 13px; font-weight: 800; color: #101830; }
    .rw-sub  { font-size: 11px; color: #7080a0; font-weight: 600; }

    /* ── BIRTHDAY ── */
    .bd-row {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 12px;
      background: rgba(255,255,255,0.50); margin-bottom: 7px;
    }
    .bd-av {
      width: 36px; height: 36px;
      background: linear-gradient(135deg,#ff9a6c,#ff6b9d);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 800; font-size: 14px; flex-shrink: 0;
      border-radius: 50%;
    }

    /* ── QUICK ACTIONS ── */
    .qa-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-top: 18px; }
    @media(max-width:900px){ .qa-grid { grid-template-columns: 1fr 1fr; } }
    .qa-btn {
      display: flex; align-items: center; gap: 12px; padding: 14px 16px;
      border-radius: 15px; background: rgba(255,255,255,0.86);
      border: 1.5px solid rgba(255,255,255,0.65);
      cursor: pointer; text-align: left;
      transition: transform .18s, box-shadow .18s; font-family: 'Nunito', sans-serif;
    }
    .qa-btn:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(40,60,150,0.16); }
    .qa-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; flex-shrink: 0; }
    .qa-lbl  { font-size: 13px; font-weight: 800; color: #101830; flex: 1; }

    .spin {
      width: 28px; height: 28px; border-radius: 50%;
      border: 3px solid rgba(70,100,200,0.18); border-top-color: #4a6bbf;
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .view-all-btn { font-size: 12px; font-weight: 700; color: #3a5ab0; cursor: pointer; background: none; border: none; padding: 0; font-family: 'Nunito', sans-serif; }
    .view-all-btn:hover { text-decoration: underline; }
    .show-more-btn {
      width: 100%; margin-top: 4px;
      background: rgba(80,120,200,0.10); border: 1.5px solid rgba(80,120,200,0.20);
      border-radius: 9px; padding: 6px 0; font-size: 12px; font-weight: 800; color: #3a5ab0;
      cursor: pointer; font-family: 'Nunito', sans-serif;
    }
    .show-more-btn:hover { background: rgba(80,120,200,0.20); }

    .empty-msg { text-align: center; color: #8090b0; padding: 18px 0; font-size: 13px; }
  `}</style>
);

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
const getSecureUrl = url => (!url ? "" : url.startsWith("http:") ? url.replace("http:", "https:") : url);

/* ═══════════════════════════════════════════════════
   SEMI-CIRCLE GAUGE (re-used for today attendance)
═══════════════════════════════════════════════════ */
const GaugeChart = ({ present, total }) => {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  const circ = Math.PI * 80;
  return (
    <div style={{ position: "relative", width: 180, height: 100, flexShrink: 0 }}>
      <svg width="180" height="100" viewBox="0 0 180 100">
        <path d="M 10 90 A 80 80 0 0 1 170 90" fill="none" stroke="#d4e2f9" strokeWidth="18" strokeLinecap="round" />
        <path d="M 10 90 A 80 80 0 0 1 170 90" fill="none" stroke="#192f7a" strokeWidth="18" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * circ} ${circ}`} style={{ transition: "stroke-dasharray .8s ease" }} />
      </svg>
      <div style={{ position: "absolute", bottom: 2, left: 0, right: 0, textAlign: "center" }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: "#101830" }}>{pct}%</span>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   DONUT CHART
═══════════════════════════════════════════════════ */
const DCOLS = ["#8b5cf6", "#ec4899", "#3b82f6", "#06b6d4", "#f97316", "#10b981"];

const DonutChart = ({ data, total }) => (
  <ResponsiveContainer width={150} height={150}>
    <PieChart>
      <Pie data={data} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
        paddingAngle={3} dataKey="employees" startAngle={90} endAngle={-270}>
        {data.map((_, i) => <Cell key={i} fill={DCOLS[i % DCOLS.length]} />)}
      </Pie>
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 20, fontWeight: 900, fill: "#101830" }}>{total}</text>
    </PieChart>
  </ResponsiveContainer>
);

const AV = ["#5b8aff", "#ff6b9d", "#43c99e", "#ff9a3c", "#9c6dff", "#3cb8e8", "#f06060", "#62c462"];
const badgeClass = s => `lv-badge ${s === "Approved" ? "badge-approved" : s === "Rejected" ? "badge-rejected" : "badge-pending"}`;

/* ═══════════════════════════════════════════════════
   MAIN
═══════════════════════════════════════════════════ */
const AdminDashboard = () => {
  const { employees } = useContext(EmployeeContext);
  const { getDashboardData } = useContext(AttendanceContext);
  const { leaveRequests } = useContext(LeaveRequestContext);
  const navigate = useNavigate();

  /* Today attendance filter state */
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // today
  const [attendanceDateData, setAttendanceDateData] = useState([]);
  const [loadingGraph, setLoadingGraph] = useState(false);

  /* today counts */
  const [todayCounts, setTodayCounts] = useState({ present: 0, notLoggedIn: 0, onLeave: 0 });
  const [todayAttendanceData, setTodayAttendanceData] = useState([]); // for remote workers

  /* team */
  const [loadingTeamData, setLoadingTeamData] = useState(false);
  const [monthlyBirthdays, setMonthlyBirthdays] = useState([]);
  const [remoteWorkers, setRemoteWorkers] = useState([]);
  const [isGlobalWFH, setIsGlobalWFH] = useState(false);
  const [showAllRemote, setShowAllRemote] = useState(false);

  /* leave activity */
  const [leaveActivity, setLeaveActivity] = useState([]);
  const [leaveEmpImages, setLeaveEmpImages] = useState({});
  const [loadingLeave, setLoadingLeave] = useState(false);

  const { statCards, activeEmployees, departmentList } = useMemo(
    () => getDashboardData(employees, leaveRequests),
    [employees, leaveRequests, getDashboardData]
  );

  /* ── 1. TODAY COUNTS based on selectedDate ── */
  useEffect(() => {
    const run = async () => {
      try {
        const arr = await getAttendanceByDateRange(selectedDate, selectedDate);
        const attendance = Array.isArray(arr) ? arr : [];
        setAttendanceDateData(attendance); // for gauge
        // For remote workers we still need today's attendance (punch in set)
        setTodayAttendanceData(attendance);

        const todayLeaves = leaveRequests.filter(l => l.status === "Approved" && selectedDate >= l.from && selectedDate <= l.to);
        const presentIds = new Set(attendance.filter(a => a.punchIn).map(a => a.employeeId));
        const leaveIds = new Set(todayLeaves.map(l => l.employeeId));
        const activeIds = new Set(activeEmployees.filter(e => e.isActive !== false).map(e => e.employeeId));
        setTodayCounts({
          present: presentIds.size,
          notLoggedIn: Array.from(activeIds).filter(id => !presentIds.has(id) && !leaveIds.has(id)).length,
          onLeave: todayLeaves.length
        });
      } catch (e) { console.error(e); }
    };
    run();
  }, [activeEmployees, leaveRequests, selectedDate]);

  /* ── 2. LEAVE ACTIVITY (same as before) ── */
  const fetchLeaveActivity = useCallback(async () => {
    setLoadingLeave(true);
    try {
      const [leavesData, employeesData] = await Promise.all([getLeaveRequests(), getEmployees()]);
      const empMap = new Map();
      employeesData.forEach(e => {
        if (e.employeeId) empMap.set(e.employeeId, e);
        if (e._id) empMap.set(e._id, e);
      });
      const enriched = leavesData.map(leave => {
        const emp = empMap.get(leave.employeeId);
        return {
          ...leave,
          employeeName: emp?.name || leave.employeeName || "Unknown",
          department: emp?.experienceDetails?.[0]?.department || emp?.department || "N/A",
        };
      });
      const sorted = [...enriched].sort((a, b) => {
        const da = new Date(a.createdAt || a.appliedDate || a.from);
        const db = new Date(b.createdAt || b.appliedDate || b.from);
        return db - da;
      }).slice(0, 5);
      setLeaveActivity(sorted);

      const imgs = {};
      for (const lv of sorted) {
        try {
          const res = await api.get(`/api/profile/${lv.employeeId}`);
          if (res.data?.profilePhoto?.url) imgs[lv.employeeId] = getSecureUrl(res.data.profilePhoto.url);
        } catch (_) { }
      }
      setLeaveEmpImages(imgs);
    } catch (e) { console.error(e); }
    finally { setLoadingLeave(false); }
  }, []);

  useEffect(() => { fetchLeaveActivity(); }, [fetchLeaveActivity]);

  const handleLeaveAction = async (id, action) => {
    const isApprove = action === "approve";
    const result = await Swal.fire({
      title: isApprove ? "Approve Request?" : "Reject Request?",
      text: `Are you sure you want to ${action} this leave request?`,
      icon: isApprove ? "question" : "warning",
      showCancelButton: true,
      confirmButtonColor: isApprove ? "#10B981" : "#EF4444",
      cancelButtonColor: "#6B7280",
      confirmButtonText: isApprove ? "Yes, Approve" : "Yes, Reject",
    });
    if (!result.isConfirmed) return;
    try {
      Swal.fire({ title: "Processing…", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      if (isApprove) await approveLeaveRequestById(id); else await rejectLeaveRequestById(id);
      await fetchLeaveActivity();
      Swal.fire("Done!", `Leave ${action}d successfully.`, "success");
    } catch (_) { Swal.fire("Error!", "Failed. Please try again.", "error"); }
  };

  /* ── 3. TEAM DATA (remote & birthdays) ── */
  const fetchTeamData = useCallback(async () => {
    setLoadingTeamData(true);
    try {
      const [empRes, cfgRes, modesRes] = await Promise.all([
        api.get("/api/employees"),
        api.get("/api/admin/settings/office"),
        api.get("/api/admin/settings/employees-modes")
      ]);
      const allEmp = empRes.data || [];
      const cfg = cfgRes.data;
      const empModes = modesRes.data?.employees || [];
      setIsGlobalWFH(cfg?.globalWorkMode === "WFH");

      const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
      const curMonth = todayDate.getMonth(); const curDay = todayDate.getDate();

      // Birthdays
      setMonthlyBirthdays(
        allEmp.filter(e => e.isActive !== false && e.personalDetails?.dob).map(e => {
          const dob = new Date(e.personalDetails.dob);
          return { name: e.name, employeeId: e.employeeId, department: e.department || e.experienceDetails?.[0]?.department || "N/A", dobDay: dob.getDate(), dobMonth: dob.getMonth() };
        }).filter(e => e.dobMonth === curMonth && e.dobDay >= curDay).sort((a, b) => a.dobDay - b.dobDay)
      );

      // Remote workers
      const empMap = new Map(); allEmp.forEach(e => empMap.set(e.employeeId, e));
      const globalMode = cfg?.globalWorkMode || "WFO";
      const weekday = new Date().getDay();
      const remList = [];
      if (globalMode === "WFH") {
        allEmp.filter(e => e.isActive !== false).forEach(e =>
          remList.push({ name: e.name, employeeId: e.employeeId, department: e.department || e.experienceDetails?.[0]?.department || "N/A" })
        );
      } else {
        empModes.forEach(em => {
          const base = empMap.get(em.employeeId); if (!base) return;
          let mode = globalMode;
          if (em.ruleType === "Permanent") { mode = em.config.permanentMode; }
          else if (em.ruleType === "Temporary" && em.config.temporary) {
            const f = new Date(em.config.temporary.fromDate); f.setHours(0,0,0,0);
            const t = new Date(em.config.temporary.toDate); t.setHours(23,59,59,999);
            if (todayDate >= f && todayDate <= t) mode = em.config.temporary.mode;
          } else if (em.ruleType === "Recurring" && em.config.recurring?.days?.includes(weekday)) {
            mode = em.config.recurring.mode;
          }
          if (mode === "WFH") remList.push({ name: base.name, employeeId: em.employeeId, department: base.department || base.experienceDetails?.[0]?.department || "N/A" });
        });
      }
      const punchedIn = new Set(todayAttendanceData.filter(a => a.punchIn).map(a => a.employeeId));
      setRemoteWorkers(remList.filter(w => punchedIn.has(w.employeeId)));
    } catch (e) { console.error(e); }
    finally { setLoadingTeamData(false); }
  }, [todayAttendanceData]);

  useEffect(() => { fetchTeamData(); }, [fetchTeamData]);

  /* ── 4. Today attendance data for gauge (based on selectedDate) already in attendanceDateData ── */
  // Prepare data for gauge based on selectedDate
  const filteredEmployeesForGauge = useMemo(() => {
    // employees active
    return activeEmployees.filter(e => e.isActive !== false);
  }, [activeEmployees]);

  const presentCountForSelectedDate = useMemo(() => {
    const ids = new Set(attendanceDateData.filter(a => a.punchIn).map(a => a.employeeId));
    return ids.size;
  }, [attendanceDateData]);

  const totalActiveForSelectedDate = filteredEmployeesForGauge.length;
  const absentCountForSelectedDate = totalActiveForSelectedDate - presentCountForSelectedDate;

  /* date navigation */
  const handlePrevDay = () => {
    const prev = new Date(selectedDate);
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev.toISOString().split('T')[0]);
  };
  const handleNextDay = () => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + 1);
    const todayStr = new Date().toISOString().split('T')[0];
    if (next.toISOString().split('T')[0] <= todayStr) {
      setSelectedDate(next.toISOString().split('T')[0]);
    }
  };
  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const departmentData = useMemo(() => {
    const c = {};
    activeEmployees.forEach(e => { const d = e.department || "Unassigned"; c[d] = (c[d] || 0) + 1; });
    return Object.entries(c).map(([name, employees]) => ({ name, employees }));
  }, [activeEmployees]);

  const totalActive = statCards.totalEmployees || 0;

  const quickActions = [
    { title: "Employee Management",  icon: <FaUsers />,         to: "/employees",               color: "linear-gradient(135deg,#5b8aff,#3a63e8)" },
    { title: "Group Management",     icon: <FaLayerGroup />,    to: "/admin/groups",            color: "linear-gradient(135deg,#9c6dff,#6e3fe8)" },
    { title: "Employees Attendance", icon: <FaUserClock />,     to: "/attendance",              color: "linear-gradient(135deg,#43c99e,#1e9e72)" },
    { title: "Leave Approvals",      icon: <FaCalendarCheck />, to: "/admin/admin-Leavemanage", color: "linear-gradient(135deg,#ffb74d,#f57c00)" },
    { title: "Payroll",              icon: <FaFileAlt />,       to: "/admin/payroll",           color: "linear-gradient(135deg,#f06060,#c0392b)" },
    { title: "Announcements",        icon: <FaBullhorn />,      to: "/admin/notices",           color: "linear-gradient(135deg,#5b8aff,#3a4eb8)" },
    { title: "Holiday Calendar",     icon: <FaCalendarAlt />,   to: "/admin/holiday-calendar",  color: "linear-gradient(135deg,#43c99e,#1a7a5e)" },
    { title: "Shift Management",     icon: <FaChartPie />,      to: "/admin/settings",          color: "linear-gradient(135deg,#ff6b9d,#c0396d)" },
  ];

  /* ═══ RENDER ═══ */
  return (
    <div className="adm">
      <GlobalStyle />

      <div className="adm-h1">Dashboard Overview!</div>

      {/* ── STAT CARDS (exactly as image) ── */}
      <div className="stat-row">
        <div className="g sc" onClick={() => navigate("/employees")}>
          <div><div className="sc-num">{statCards.totalEmployees}</div><div className="sc-lbl">Total Employees</div></div>
          <div className="sc-icon" style={{ background: "rgba(91,138,255,0.14)" }}><FaUsers style={{ color: "#5b8aff" }} /></div>
        </div>
        <div className="g sc" onClick={() => navigate("/admin/today-overview")}>
          <div><div className="sc-num">{todayCounts.present}</div><div className="sc-lbl">Present today</div></div>
          <div className="sc-icon" style={{ background: "rgba(67,201,158,0.14)" }}><FaUserClock style={{ color: "#43c99e" }} /></div>
        </div>
        <div className="g sc" onClick={() => navigate("/admin/today-overview")}>
          <div><div className="sc-num">{todayCounts.notLoggedIn}</div><div className="sc-lbl">Absent today</div></div>
          <div className="sc-icon" style={{ background: "rgba(240,96,96,0.14)" }}><FaUmbrellaBeach style={{ color: "#f06060" }} /></div>
        </div>
        <div className="g sc" onClick={() => navigate("/admin/admin-Leavemanage", { state: { defaultStatus: "Pending" } })}>
          <div><div className="sc-num">{statCards.pendingLeaves}</div><div className="sc-lbl">Leave requests</div></div>
          <div className="sc-icon" style={{ background: "rgba(156,109,255,0.14)" }}><FaClipboardList style={{ color: "#9c6dff" }} /></div>
        </div>
      </div>

      {/* ── MAIN 2-COL ── */}
      <div className="mg">

        {/* LEFT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Employee Departments (donut) */}
          <div className="g cp">
            <div className="sec-t">Employee Departments</div>
            <div className="dept-bar-wrap">
              <DonutChart data={departmentData} total={totalActive} />
              <div style={{ flex: 1 }}>
                {departmentData.map((dept, i) => {
                  const pct = totalActive > 0 ? Math.round((dept.employees / totalActive) * 100) : 0;
                  return (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div className="dept-pct-row"><span>{dept.name}</span><span>{pct}%</span></div>
                      <div className="dept-bar" style={{ background: DCOLS[i % DCOLS.length], width: `${Math.max(pct, 8)}%`, minWidth: 60 }}>
                        {dept.name}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Leave Activity */}
          <div className="g cp">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div className="sec-t" style={{ margin: 0 }}>Leave requests</div>
              <button className="view-all-btn" onClick={() => navigate("/admin/admin-Leavemanage")}>View all</button>
            </div>

            {loadingLeave ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "20px 0" }}><div className="spin" /></div>
            ) : leaveActivity.length === 0 ? (
              <div className="empty-msg">No recent leave activity</div>
            ) : (
              leaveActivity.map((lv, i) => {
                const img = leaveEmpImages[lv.employeeId];
                return (
                  <div key={lv._id || i} className="lv-row">
                    <div className="lv-av" style={{ background: AV[i % AV.length] }}>
                      {img ? <img src={img} alt={lv.employeeName} /> : (lv.employeeName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="lv-name">{lv.employeeName}</div>
                      <div className="lv-sub">{lv.leaveType || "Leave"} · {lv.department} · {lv.from} → {lv.to}</div>
                    </div>
                    <span className={badgeClass(lv.status)}>{lv.status}</span>
                    <div className="lv-actions">
                      <button className="btn-ap" title="Approve" onClick={() => handleLeaveAction(lv._id, "approve")}><FaCheck size={10} /></button>
                      <button className="btn-rj" title="Reject" onClick={() => handleLeaveAction(lv._id, "reject")}><FaTimes size={10} /></button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="rc">

          {/* TODAY Attendance Report (Gauge) */}
          <div className="g cp">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800 }}>
                <span style={{ color: "#4060c0" }}>Today </span>
                <span style={{ color: "#101830" }}>Attendance Report</span>
              </div>
              {/* Date filter exactly as image: Today/Yesterday picker */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button className="gnav-btn" onClick={handlePrevDay}><FaChevronLeft size={10} /></button>
                <span className="gnav-label">{new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <button className="gnav-btn" onClick={handleNextDay} disabled={selectedDate === new Date().toISOString().split('T')[0]}><FaChevronRight size={10} /></button>
                <button className="gnav-btn" onClick={handleToday}><FaSyncAlt size={10} /></button>
              </div>
            </div>

            <div className="gauge-area">
              <GaugeChart present={presentCountForSelectedDate} total={Math.max(totalActiveForSelectedDate, 1)} />
              <div style={{ paddingBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 7 }}>
                  <span className="gauge-legend-dot" style={{ background: "#192f7a" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6a90" }}>Present: <b style={{ color: "#101830" }}>{presentCountForSelectedDate}</b></span>
                </div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span className="gauge-legend-dot" style={{ background: "#d4e2f9" }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#5a6a90" }}>Absent: <b style={{ color: "#101830" }}>{absentCountForSelectedDate}</b></span>
                </div>
              </div>
            </div>
          </div>

          {/* Working Remotely */}
          <div className="g cp">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FaWifi style={{ color: "#43c99e", fontSize: 15 }} />
                <div className="sec-t" style={{ margin: 0 }}>Working remotely</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {isGlobalWFH && (
                  <span style={{ background: "rgba(67,201,158,0.18)", color: "#047857", fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 20 }}>Global</span>
                )}
                <span style={{ background: "rgba(67,201,158,0.18)", color: "#047857", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>{remoteWorkers.length}</span>
              </div>
            </div>

            {loadingTeamData ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}><div className="spin" /></div>
            ) : remoteWorkers.length === 0 ? (
              <div className="empty-msg">No employees working remotely today</div>
            ) : (
              <>
                {(showAllRemote ? remoteWorkers : remoteWorkers.slice(0, 4)).map((w, i) => (
                  <div key={w.employeeId} className="rw-card">
                    <div className="rw-av" style={{ background: AV[i % AV.length] }}>
                      {w.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="rw-name">{w.name}</div>
                      <div className="rw-sub">{w.employeeId} · {w.department}</div>
                    </div>
                  </div>
                ))}
                {remoteWorkers.length > 4 && (
                  <button className="show-more-btn" onClick={() => setShowAllRemote(v => !v)}>
                    {showAllRemote ? "Show less" : `Show all (${remoteWorkers.length})`}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Upcoming Birthdays */}
          <div className="g cp">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 18 }}>🎂</span>
                <div className="sec-t" style={{ margin: 0 }}>Upcoming Birthday's</div>
              </div>
              <span style={{ background: "rgba(255,180,60,0.18)", color: "#b45309", fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20, cursor: "pointer" }}>
                Wish All
              </span>
            </div>
            {loadingTeamData ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}><div className="spin" /></div>
            ) : monthlyBirthdays.length === 0 ? (
              <div className="empty-msg">No upcoming birthdays this month</div>
            ) : (
              monthlyBirthdays.slice(0, 4).map((p, i) => (
                <div key={i} className="bd-row">
                  <div className="bd-av">{p.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#101830" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#8090b0", fontWeight: 600 }}>{p.department} · {p.dobDay}/{p.dobMonth + 1}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="g" style={{ marginTop: 22, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#5b8aff,#3a63e8)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <FaConnectdevelop />
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: "#101830" }}>Quick Actions</span>
        </div>
        <p style={{ fontSize: 12, color: "#7080a0", fontWeight: 600, margin: "6px 0 0 46px" }}>Navigate to frequently used admin sections</p>
        <div className="qa-grid">
          {quickActions.map((a, i) => (
            <button key={i} className="qa-btn" onClick={() => navigate(a.to)}>
              <div className="qa-icon" style={{ background: a.color }}>{a.icon}</div>
              <span className="qa-lbl">{a.title}</span>
              <FaAngleRight style={{ color: "#a0aac0", flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;