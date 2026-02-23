import React, { useState, useContext, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers, FaClipboardList, FaChevronLeft, FaChevronRight,
  FaSyncAlt, FaUmbrellaBeach, FaAngleRight, FaCalendarAlt, FaFileAlt, FaBullhorn,
  FaUserClock, FaChartPie, FaCalendarCheck, FaLayerGroup, FaConnectdevelop,
  FaCheck, FaTimes, FaHeart, FaGift, FaUserTie, FaUserFriends
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
   HELPER FUNCTIONS
═══════════════════════════════════════════════════ */
const getSecureUrl = (url) => (!url ? "" : url.startsWith("http:") ? url.replace("http:", "https:") : url);

/* ═══════════════════════════════════════════════════
   GAUGE CHART COMPONENT
═══════════════════════════════════════════════════ */
const GaugeChart = ({ present, total }) => {
  const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
  const circumference = Math.PI * 160;
  
  return (
    <div className="relative w-[200px] h-[110px]">
      <svg width="200" height="110" viewBox="0 0 200 110">
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke="white"
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={`${(percentage / 100) * circumference} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="absolute bottom-0 left-0 right-0 text-center text-3xl font-black text-white drop-shadow-lg">
        {percentage}%
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   DONUT CHART COMPONENT
═══════════════════════════════════════════════════ */
const DonutChart = ({ data, total }) => {
  const COLORS = ["#FFB347", "#4ECDC4", "#FF6B6B", "#FFB347", "#4ECDC4", "#FF6B6B"];
  
  return (
    <ResponsiveContainer width={160} height={160}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          paddingAngle={2}
          dataKey="employees"
          startAngle={90}
          endAngle={-270}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
          ))}
        </Pie>
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-2xl font-black fill-white"
        >
          {total}
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
};

/* ═══════════════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
═══════════════════════════════════════════════════ */
const AdminDashboard = () => {
  const { employees } = useContext(EmployeeContext);
  const { getDashboardData } = useContext(AttendanceContext);
  const { leaveRequests } = useContext(LeaveRequestContext);
  const navigate = useNavigate();

  // State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceDateData, setAttendanceDateData] = useState([]);
  const [todayCounts, setTodayCounts] = useState({ present: 0, absent: 0, onLeave: 0 });
  const [todayAttendanceData, setTodayAttendanceData] = useState([]);
  const [loadingTeamData, setLoadingTeamData] = useState(false);
  const [monthlyBirthdays, setMonthlyBirthdays] = useState([]);
  const [remoteWorkers, setRemoteWorkers] = useState([]);
  const [isGlobalWFH, setIsGlobalWFH] = useState(false);
  const [showAllRemote, setShowAllRemote] = useState(false);
  const [leaveActivity, setLeaveActivity] = useState([]);
  const [leaveEmpImages, setLeaveEmpImages] = useState({});
  const [loadingLeave, setLoadingLeave] = useState(false);
  const [showAllLeave, setShowAllLeave] = useState(false);

  // Memoized data
  const { statCards, activeEmployees, departmentList } = useMemo(
    () => getDashboardData(employees, leaveRequests),
    [employees, leaveRequests, getDashboardData]
  );

  // Fetch today's attendance
  useEffect(() => {
    const fetchTodayAttendance = async () => {
      try {
        const data = await getAttendanceByDateRange(selectedDate, selectedDate);
        const attendance = Array.isArray(data) ? data : [];
        setAttendanceDateData(attendance);
        setTodayAttendanceData(attendance);

        const todayLeaves = leaveRequests.filter(
          l => l.status === "Approved" && selectedDate >= l.from && selectedDate <= l.to
        );
        
        const presentIds = new Set(attendance.filter(a => a.punchIn).map(a => a.employeeId));
        const leaveIds = new Set(todayLeaves.map(l => l.employeeId));
        const activeIds = new Set(activeEmployees.filter(e => e.isActive !== false).map(e => e.employeeId));
        
        setTodayCounts({
          present: presentIds.size,
          absent: Array.from(activeIds).filter(id => !presentIds.has(id) && !leaveIds.has(id)).length,
          onLeave: todayLeaves.length
        });
      } catch (error) {
        console.error("Error fetching attendance:", error);
      }
    };
    fetchTodayAttendance();
  }, [activeEmployees, leaveRequests, selectedDate]);

  // Fetch leave activity
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

      const sorted = [...enriched]
        .sort((a, b) => new Date(b.createdAt || b.appliedDate || b.from) - new Date(a.createdAt || a.appliedDate || a.from))
        .slice(0, 8);
      
      setLeaveActivity(sorted);

      const imgs = {};
      for (const lv of sorted) {
        try {
          const res = await api.get(`/api/profile/${lv.employeeId}`);
          if (res.data?.profilePhoto?.url) {
            imgs[lv.employeeId] = getSecureUrl(res.data.profilePhoto.url);
          }
        } catch (_) {}
      }
      setLeaveEmpImages(imgs);
    } catch (error) {
      console.error("Error fetching leave activity:", error);
    } finally {
      setLoadingLeave(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaveActivity();
  }, [fetchLeaveActivity]);

  // Handle leave actions
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
      background: "rgba(255,255,255,0.95)",
      backdrop: "rgba(0,0,0,0.4)"
    });

    if (!result.isConfirmed) return;

    try {
      Swal.fire({
        title: "Processing...",
        allowOutsideClick: false,
        background: "rgba(255,255,255,0.95)",
        didOpen: () => Swal.showLoading()
      });

      if (isApprove) {
        await approveLeaveRequestById(id);
      } else {
        await rejectLeaveRequestById(id);
      }

      await fetchLeaveActivity();
      Swal.fire({
        title: "Done!",
        text: `Leave ${action}d successfully.`,
        icon: "success",
        background: "rgba(255,255,255,0.95)",
        timer: 1500,
        showConfirmButton: false
      });
    } catch (_) {
      Swal.fire({
        title: "Error!",
        text: "Failed. Please try again.",
        icon: "error",
        background: "rgba(255,255,255,0.95)"
      });
    }
  };

  // Fetch team data
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

      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const currentMonth = todayDate.getMonth();
      const currentDay = todayDate.getDate();

      // Calculate birthdays
      const birthdays = allEmp
        .filter(e => e.isActive !== false && e.personalDetails?.dob)
        .map(e => {
          const dob = new Date(e.personalDetails.dob);
          return {
            name: e.name,
            employeeId: e.employeeId,
            department: e.department || e.experienceDetails?.[0]?.department || "N/A",
            dobDay: dob.getDate(),
            dobMonth: dob.getMonth()
          };
        })
        .filter(e => e.dobMonth === currentMonth && e.dobDay >= currentDay)
        .sort((a, b) => a.dobDay - b.dobDay)
        .slice(0, 4);

      setMonthlyBirthdays(birthdays);

      // Calculate remote workers
      const empMap = new Map();
      allEmp.forEach(e => empMap.set(e.employeeId, e));
      
      const globalMode = cfg?.globalWorkMode || "WFO";
      const weekday = new Date().getDay();
      const remoteList = [];

      if (globalMode === "WFH") {
        allEmp.filter(e => e.isActive !== false).forEach(e =>
          remoteList.push({
            name: e.name,
            employeeId: e.employeeId,
            department: e.department || e.experienceDetails?.[0]?.department || "N/A"
          })
        );
      } else {
        empModes.forEach(em => {
          const base = empMap.get(em.employeeId);
          if (!base) return;

          let mode = globalMode;
          if (em.ruleType === "Permanent") {
            mode = em.config.permanentMode;
          } else if (em.ruleType === "Temporary" && em.config.temporary) {
            const fromDate = new Date(em.config.temporary.fromDate);
            const toDate = new Date(em.config.temporary.toDate);
            fromDate.setHours(0, 0, 0, 0);
            toDate.setHours(23, 59, 59, 999);
            if (todayDate >= fromDate && todayDate <= toDate) {
              mode = em.config.temporary.mode;
            }
          } else if (em.ruleType === "Recurring" && em.config.recurring?.days?.includes(weekday)) {
            mode = em.config.recurring.mode;
          }

          if (mode === "WFH") {
            remoteList.push({
              name: base.name,
              employeeId: em.employeeId,
              department: base.department || base.experienceDetails?.[0]?.department || "N/A"
            });
          }
        });
      }

      const punchedInIds = new Set(todayAttendanceData.filter(a => a.punchIn).map(a => a.employeeId));
      setRemoteWorkers(remoteList.filter(w => punchedInIds.has(w.employeeId)));
    } catch (error) {
      console.error("Error fetching team data:", error);
    } finally {
      setLoadingTeamData(false);
    }
  }, [todayAttendanceData]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  // Date navigation handlers
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

  // Department data for donut
  const departmentData = useMemo(() => {
    const counts = {};
    activeEmployees.forEach(e => {
      const dept = e.department || "Unassigned";
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts).map(([name, employees]) => ({ name, employees }));
  }, [activeEmployees]);

  const totalActive = statCards.totalEmployees || 0;

  // Quick actions
  const quickActions = [
    { title: "Employee Management", icon: <FaUsers />, to: "/employees", color: "#FFB347" },
    { title: "Group Management", icon: <FaLayerGroup />, to: "/admin/groups", color: "#4ECDC4" },
    { title: "Employees Attendance", icon: <FaUserClock />, to: "/attendance", color: "#FF6B6B" },
    { title: "Leave Approvals", icon: <FaCalendarCheck />, to: "/admin/admin-Leavemanage", color: "#FFB347" },
    { title: "Payroll", icon: <FaFileAlt />, to: "/admin/payroll", color: "#4ECDC4" },
    { title: "Announcements", icon: <FaBullhorn />, to: "/admin/notices", color: "#FF6B6B" },
    { title: "Holiday Calendar", icon: <FaCalendarAlt />, to: "/admin/holiday-calendar", color: "#FFB347" },
    { title: "Shift Management", icon: <FaChartPie />, to: "/admin/settings", color: "#4ECDC4" },
  ];

  // Format date for display
  const formatDisplayDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const displayedLeaveActivity = showAllLeave ? leaveActivity : leaveActivity.slice(0, 4);

  return (
    <div className="min-h-screen p-6 font-nunito" style={{
      background: 'linear-gradient(145deg, #667eea 0%, #764ba2 50%, #6b8cff 100%)'
    }}>
      {/* Dashboard Title */}
      <h1 className="text-3xl font-extrabold text-white mb-6 drop-shadow-lg">Dashboard Overview!</h1>

      {/* Top Section: Today Attendance Report + Stats Cards in 2x2 Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">


            {/* Stats Cards - 2x2 Grid on Right side */}
        <div className="grid grid-cols-2 gap-4">
          {/* Total Employees */}
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-5 flex items-center justify-between cursor-pointer hover:bg-white/30 transition-all hover:-translate-y-1" onClick={() => navigate("/employees")}>
            <div>
              <h3 className="text-3xl font-extrabold text-white drop-shadow-md">{statCards.totalEmployees}</h3>
              <p className="text-sm font-semibold text-white/90">Total Employees</p>
            </div>
            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center text-white text-3xl">
              <FaUsers />
            </div>
          </div>

          {/* Present today */}
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-5 flex items-center justify-between cursor-pointer hover:bg-white/30 transition-all hover:-translate-y-1" onClick={() => navigate("/admin/today-overview")}>
            <div>
              <h3 className="text-3xl font-extrabold text-white drop-shadow-md">{todayCounts.present}</h3>
              <p className="text-sm font-semibold text-white/90">Present today</p>
            </div>
            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center text-white text-3xl">
              <FaUserClock />
            </div>
          </div>

          {/* Absent today */}
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-5 flex items-center justify-between cursor-pointer hover:bg-white/30 transition-all hover:-translate-y-1" onClick={() => navigate("/admin/today-overview")}>
            <div>
              <h3 className="text-3xl font-extrabold text-white drop-shadow-md">{todayCounts.absent}</h3>
              <p className="text-sm font-semibold text-white/90">Absent today</p>
            </div>
            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center text-white text-3xl">
              <FaUmbrellaBeach />
            </div>
          </div>

          {/* Leave requests */}
          <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-5 flex items-center justify-between cursor-pointer hover:bg-white/30 transition-all hover:-translate-y-1" onClick={() => navigate("/admin/admin-Leavemanage")}>
            <div>
              <h3 className="text-3xl font-extrabold text-white drop-shadow-md">{statCards.pendingLeaves}</h3>
              <p className="text-sm font-semibold text-white/90">Leave requests</p>
            </div>
            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center text-white text-3xl">
              <FaClipboardList />
            </div>
          </div>
        </div>
        <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-extrabold text-white drop-shadow-md">Today Attendance Report</h2>
            <div className="flex items-center gap-2 bg-white/20 rounded-full p-1">
              <button className="w-8 h-8 rounded-full bg-white/30 text-white flex items-center justify-center hover:bg-white/40 transition" onClick={handlePrevDay}>
                <FaChevronLeft size={12} />
              </button>
              <span className="text-sm font-bold text-white min-w-[80px] text-center">{formatDisplayDate(selectedDate)}</span>
              <button 
                className="w-8 h-8 rounded-full bg-white/30 text-white flex items-center justify-center hover:bg-white/40 transition disabled:opacity-30 disabled:cursor-not-allowed" 
                onClick={handleNextDay}
                disabled={selectedDate === new Date().toISOString().split('T')[0]}
              >
                <FaChevronRight size={12} />
              </button>
              <button className="w-8 h-8 rounded-full bg-white/30 text-white flex items-center justify-center hover:bg-white/40 transition" onClick={handleToday}>
                <FaSyncAlt size={12} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <GaugeChart 
              present={todayCounts.present} 
              total={Math.max(activeEmployees.filter(e => e.isActive !== false).length, 1)} 
            />
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-white"></div>
                <span className="text-sm font-semibold text-white/90">
                  Present: <span className="font-extrabold text-white ml-1">{todayCounts.present}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-white/40"></div>
                <span className="text-sm font-semibold text-white/90">
                  Absent: <span className="font-extrabold text-white ml-1">{todayCounts.absent}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

    


        
      </div>

      {/* Two Column Layout - Employee Departments and Leave requests (half screen each) */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Employee Departments */}
        <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-white drop-shadow-md">Employee Departments</h2>
          </div>
          <div className="flex items-center gap-6">
            <DonutChart data={departmentData} total={totalActive} />
            <div className="flex-1 space-y-4">
              {departmentData.map((dept, index) => {
                const percentage = totalActive > 0 ? Math.round((dept.employees / totalActive) * 100) : 0;
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-white/90">
                      <span>{dept.name}</span>
                      <span>{percentage}%</span>
                    </div>
                    <div className="h-9 rounded-full bg-white/25 flex items-center pl-4 relative overflow-hidden">
                      <div className="absolute top-0 left-0 h-full bg-white/40 rounded-full" style={{ width: `${percentage}%` }}></div>
                      <span className="relative z-10 text-white text-xs font-bold drop-shadow-md">{dept.name}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Leave requests */}
        <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-white drop-shadow-md">Leave requests</h2>
            <span className="text-xs font-semibold text-white/80 bg-white/20 px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/30 transition" onClick={() => navigate("/admin/admin-Leavemanage")}>
              View all
            </span>
          </div>

          {loadingLeave ? (
            <div className="flex justify-center py-5">
              <div className="w-8 h-8 rounded-full border-3 border-white/30 border-t-white animate-spin"></div>
            </div>
          ) : displayedLeaveActivity.length === 0 ? (
            <div className="text-center py-5 text-white/60 text-sm font-semibold">No recent leave requests</div>
          ) : (
            <div className="space-y-3">
              {displayedLeaveActivity.map((leave, index) => (
                <div key={leave._id || index} className="flex items-center gap-3 pb-3 border-b border-white/15 last:border-0 last:pb-0">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-300 to-pink-400 flex items-center justify-center text-white font-bold text-base flex-shrink-0 overflow-hidden">
                    {leaveEmpImages[leave.employeeId] ? (
                      <img src={leaveEmpImages[leave.employeeId]} alt={leave.employeeName} className="w-full h-full object-cover" />
                    ) : (
                      (leave.employeeName || "U").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-extrabold text-white">{leave.employeeName}</div>
                    <div className="text-xs font-semibold text-white/70">{leave.department} • {leave.from} → {leave.to}</div>
                  </div>
                  <div className="text-xs font-bold text-white bg-white/20 px-2.5 py-1 rounded-full">{leave.leaveType || "SICK LEAVE"}</div>
                  <div className="flex gap-1.5">
                    <button className="w-7 h-7 rounded-lg bg-green-500/30 text-white flex items-center justify-center hover:bg-green-500/50 transition" title="Approve" onClick={() => handleLeaveAction(leave._id, "approve")}>
                      <FaCheck size={10} />
                    </button>
                    <button className="w-7 h-7 rounded-lg bg-red-500/30 text-white flex items-center justify-center hover:bg-red-500/50 transition" title="Reject" onClick={() => handleLeaveAction(leave._id, "reject")}>
                      <FaTimes size={10} />
                    </button>
                  </div>
                </div>
              ))}
              {leaveActivity.length > 4 && (
                <button className="w-full py-2 rounded-full border border-white/30 bg-white/15 text-white text-xs font-bold hover:bg-white/25 transition mt-2" onClick={() => setShowAllLeave(!showAllLeave)}>
                  {showAllLeave ? "Show less" : `Show all (${leaveActivity.length})`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right side components - Working Remotely and Upcoming Birthdays */}
      <div className="grid grid-cols-2 gap-4 mb-6"> 
        {/* Working Remotely */}
        <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-white drop-shadow-md">Working remotely</h2>
            <span className="text-xs font-bold text-white bg-green-500/30 px-3 py-1.5 rounded-full">{remoteWorkers.length}</span>
          </div>

          {loadingTeamData ? (
            <div className="flex justify-center py-5">
              <div className="w-8 h-8 rounded-full border-3 border-white/30 border-t-white animate-spin"></div>
            </div>
          ) : remoteWorkers.length === 0 ? (
            <div className="text-center py-5 text-white/60 text-sm font-semibold">No employees working remotely today</div>
          ) : (
            <div className="space-y-3">
              {(showAllRemote ? remoteWorkers : remoteWorkers.slice(0, 4)).map((worker, index) => (
                <div key={worker.employeeId} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/15">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold text-base">
                    {worker.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">{worker.name}</h4>
                    <p className="text-xs font-semibold text-white/70">{worker.employeeId} · {worker.department}</p>
                  </div>
                </div>
              ))}
              {remoteWorkers.length > 4 && (
                <button className="w-full py-2 rounded-full border border-white/30 bg-white/15 text-white text-xs font-bold hover:bg-white/25 transition mt-2" onClick={() => setShowAllRemote(!showAllRemote)}>
                  {showAllRemote ? "Show less" : `Show all (${remoteWorkers.length})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Upcoming Birthdays */}
        <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-white drop-shadow-md">Upcoming Birthday's</h2>
            <button className="text-xs font-bold text-white bg-yellow-500/30 px-3 py-1.5 rounded-full hover:bg-yellow-500/40 transition flex items-center gap-1">
              <FaGift size={12} />
              Wish All
            </button>
          </div>

          {loadingTeamData ? (
            <div className="flex justify-center py-5">
              <div className="w-8 h-8 rounded-full border-3 border-white/30 border-t-white animate-spin"></div>
            </div>
          ) : monthlyBirthdays.length === 0 ? (
            <div className="text-center py-5 text-white/60 text-sm font-semibold">No upcoming birthdays this month</div>
          ) : (
            <div className="space-y-3">
              {monthlyBirthdays.map((bday, index) => (
                <div key={index} className="flex items-center gap-3 p-2.5 rounded-xl bg-white/15">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-300 to-pink-400 flex items-center justify-center text-white font-bold text-base">
                    {bday.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white">{bday.name}</h4>
                    <p className="text-xs font-semibold text-white/70">{bday.department} · {bday.dobDay}/{bday.dobMonth + 1}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chando Connect Section */}
      <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-6 flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white text-2xl">
            <FaHeart />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-white">Chando</h3>
            <p className="text-sm font-semibold text-white/80">Connect with team members</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button className="px-7 py-3 rounded-full border-2 border-white/50 bg-white/20 text-white font-bold text-sm hover:bg-white/30 transition hover:scale-105">
            Connect
          </button>
          <button className="px-7 py-3 rounded-full border-2 border-white/50 bg-white/30 text-white font-bold text-sm hover:bg-white/40 transition hover:scale-105">
            Chando
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="backdrop-blur-xl bg-white/20 rounded-2xl border border-white/30 shadow-xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-11 h-11 rounded-xl bg-white/30 flex items-center justify-center text-white text-2xl">
            <FaConnectdevelop />
          </div>
          <h2 className="text-2xl font-extrabold text-white">Quick Actions</h2>
        </div>
        <p className="text-sm text-white/80 ml-14 mb-4">Navigate to frequently used admin sections</p>

        <div className="grid grid-cols-4 gap-3">
          {quickActions.map((action, index) => (
            <div key={index} className="flex items-center gap-3 p-4 rounded-xl bg-white/20 border border-white/30 cursor-pointer hover:bg-white/30 transition-all hover:-translate-y-1" onClick={() => navigate(action.to)}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-xl" style={{ background: `linear-gradient(135deg, ${action.color}, ${action.color}dd)` }}>
                {action.icon}
              </div>
              <span className="text-sm font-bold text-white flex-1">{action.title}</span>
              <FaAngleRight className="text-white/60 text-xs" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;