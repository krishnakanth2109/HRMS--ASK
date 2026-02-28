// --- START OF FILE AdminDashboard.jsx ---

import React, { useState, useContext, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaUsers, FaClipboardList, FaBuilding, FaChevronLeft, FaChevronRight,
  FaSyncAlt, FaClock, FaArrowRight, FaBirthdayCake, FaUmbrellaBeach,
  FaLaptopHouse, FaAngleRight, FaCalendarAlt, FaFileAlt, FaBullhorn,
  FaUserClock, FaChartPie, FaCalendarCheck, FaLayerGroup, FaConnectdevelop,
  FaCheckCircle, FaTimesCircle, FaHourglassHalf, FaTrophy, FaFireAlt,
  FaChartLine, FaWifi, FaMapMarkerAlt, FaRegBell, FaShieldAlt
} from "react-icons/fa";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area
} from "recharts";
import DepartmentPieChart from "../components/DepartmentPieChart";
import { EmployeeContext } from "../context/EmployeeContext";
import { AttendanceContext } from "../context/AttendanceContext";
import { LeaveRequestContext } from "../context/LeaveRequestContext";
import { getAttendanceByDateRange } from "../api";
import api from "../api";

/* ─── Inject fonts ─── */
if (!document.getElementById("hrms-fonts")) {
  const l = document.createElement("link");
  l.id = "hrms-fonts";
  l.rel = "stylesheet";
  l.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Manrope:wght@300;400;500;600;700;800&display=swap";
  document.head.appendChild(l);
}

/* ─── Inject global CSS ─── */
const GLOBAL_CSS = `
  .hrms * { box-sizing: border-box; }
  .hrms { font-family: 'Manrope', sans-serif; }
  @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
  @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:.4; } }
  @keyframes spin     { to { transform: rotate(360deg); } }
  @keyframes dashRing { to { stroke-dashoffset: 0; } }
  @keyframes countUp  { from { opacity:0; transform:scale(.7); } to { opacity:1; transform:scale(1); } }
  @keyframes slideRight { from { width:0; } to { width:var(--bar-w); } }
  .hrms-card { animation: fadeUp .5s ease both; }
  .hrms-card:nth-child(1){animation-delay:.05s}
  .hrms-card:nth-child(2){animation-delay:.10s}
  .hrms-card:nth-child(3){animation-delay:.15s}
  .hrms-card:nth-child(4){animation-delay:.20s}
  .hrms-card:nth-child(5){animation-delay:.25s}
  .hrms-hover { transition: transform .18s ease, box-shadow .18s ease; cursor:pointer; }
  .hrms-hover:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,.10) !important; }
  .hrms-qa:hover .hrms-qa-icon { transform: scale(1.12) rotate(-4deg); }
  .hrms-qa-icon { transition: transform .2s ease; }
  .hrms-pill-btn { transition: background .15s, color .15s; }
  .hrms-dept-bar { animation: slideRight .8s cubic-bezier(.4,0,.2,1) both; animation-delay: .3s; }
  .feed-row:hover { background: #f0f4ff !important; }
  .feed-row { transition: background .15s; }
  select:focus, input[type=month]:focus { outline: 2px solid #6366f1; outline-offset: 2px; }
  .ring-arc { transition: stroke-dasharray .9s cubic-bezier(.4,0,.2,1); }
`;

/* ─── Color palette ─── */
const C = {
  bg:     "#f5f6fa",
  card:   "#ffffff",
  navy:   "#0f172a",
  slate:  "#64748b",
  border: "#e8ecf4",
  indigo: "#6366f1",
  teal:   "#0d9488",
  green:  "#10b981",
  amber:  "#f59e0b",
  rose:   "#f43f5e",
  sky:    "#0ea5e9",
  violet: "#8b5cf6",
  muted:  "#f8fafc",
};

/* ════════════════════════════════════════
   SUB-COMPONENTS
════════════════════════════════════════ */

/* SVG Donut Ring — attendance breakdown */
const AttendanceRing = ({ present, absent, onLeave, total }) => {
  const size = 105, stroke = 5, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? (val) => (val / total) * circ : () => 0;

  const pPresent = pct(present);
  const pLeave   = pct(onLeave);
  const pAbsent  = circ - pPresent - pLeave;

  const segments = [
    { color: C.green,  dashArray: `${pPresent} ${circ}`, offset: 0,               label: "Present" },
    { color: C.amber,  dashArray: `${pLeave} ${circ}`,   offset: -pPresent,        label: "Leave" },
    { color: "#fca5a5",dashArray: `${pAbsent} ${circ}`,  offset: -(pPresent+pLeave),label: "Absent" },
  ];

  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        {/* track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e8ecf4" strokeWidth={stroke} />
        {segments.map((s, i) => (
          <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={s.color} strokeWidth={stroke}
            strokeDasharray={s.dashArray}
            strokeDashoffset={s.offset}
            strokeLinecap="round"
            className="ring-arc"
          />
        ))}
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: C.navy, fontFamily:"'Outfit',sans-serif", lineHeight:1, animation:"countUp .6s ease" }}>{rate}%</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.slate, letterSpacing:"0.06em", marginTop:2 }}>ATTENDANCE</span>
      </div>
    </div>
  );
};

/* SVG Sparkline from weeklyChartData */
const Sparkline = ({ data, color = C.indigo, field = "Present", height = 40, width = 120 }) => {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => d[field] || 0);
  const max = Math.max(...vals, 1);
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* Area fill */}
      <polyline points={`0,${height} ${pts} ${width},${height}`} fill={color} fillOpacity={0.08} stroke="none" />
      {/* Last dot */}
      {vals.length > 0 && (
        <circle cx={(vals.length-1)/(vals.length-1)*width} cy={height-(vals[vals.length-1]/max)*height} r={3} fill={color} />
      )}
    </svg>
  );
};

/* Stat KPI tile */
const KpiTile = ({ label, value, icon, accent, sub, onClick, delay = 0, sparkData }) => (
  <div
    className="hrms-card hrms-hover"
    onClick={onClick}
    style={{
      background: C.card,
      borderRadius: 16,
      padding: "20px 22px",
      border: `1px solid ${C.border}`,
      boxShadow: "0 2px 10px rgba(0,0,0,.05)",
      animationDelay: `${delay}s`,
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}
  >
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
      <div style={{ background: accent+"1a", borderRadius:12, width:42, height:42, display:"flex", alignItems:"center", justifyContent:"center", color: accent, fontSize:17 }}>
        {icon}
      </div>
      {sparkData && <Sparkline data={sparkData} color={accent} field="Present" />}
    </div>
    <div>
      <div style={{ fontSize:30, fontWeight:800, color:C.navy, fontFamily:"'Outfit',sans-serif", lineHeight:1, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:600, color:C.slate, letterSpacing:"0.04em" }}>{label}</div>
      {sub && <div style={{ fontSize:11, color: accent, fontWeight:600, marginTop:3 }}>{sub}</div>}
    </div>
  </div>
);

/* Workforce Health Score */
const HealthScore = ({ present, total, pending }) => {
  const attRate = total > 0 ? (present / total) * 100 : 0;
  const leaveStress = total > 0 ? Math.min((pending / total) * 100, 100) : 0;
  const score = Math.round(attRate * 0.7 + (100 - leaveStress) * 0.3);
  const color = score >= 80 ? C.green : score >= 60 ? C.amber : C.rose;
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Attention";

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:6, padding:"16px 0" }}>
      <div style={{ position:"relative", width:80, height:80 }}>
        <svg width={80} height={80} style={{ transform:"rotate(-90deg)" }}>
          <circle cx={40} cy={40} r={32} fill="none" stroke="#e8ecf4" strokeWidth={8} />
          <circle cx={40} cy={40} r={32} fill="none" stroke={color} strokeWidth={8}
            strokeDasharray={`${(score/100)*201} 201`} strokeLinecap="round" className="ring-arc" />
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, color, fontFamily:"'Outfit',sans-serif" }}>
          {score}
        </div>
      </div>
      <div style={{ fontSize:12, fontWeight:700, color, textAlign:"center" }}>{label}</div>
      <div style={{ fontSize:10, color:C.slate, textAlign:"center" }}>Workforce Health</div>
    </div>
  );
};

/* Leave Activity Feed — from leaveRequests */
const ActivityFeed = ({ requests, employees }) => {
  const empMap = useMemo(() => {
    const m = {};
    (employees || []).forEach(e => { m[e.employeeId] = e.name; });
    return m;
  }, [employees]);

  const feed = useMemo(() => {
    return [...requests]
      .sort((a,b) => new Date(b.createdAt || b.from) - new Date(a.createdAt || a.from))
      .slice(0, 8)
      .map(r => ({
        name: r.employeeName || empMap[r.employeeId] || "Employee",
        type: r.leaveType || "Leave",
        status: r.status,
        from: r.from,
        to: r.to,
        reason: r.reason,
      }));
  }, [requests, empMap]);

  const statusStyle = {
    Approved:  { bg:"#d1fae5", color:C.green,  icon:<FaCheckCircle/>,  label:"Approved" },
    Pending:   { bg:"#fef3c7", color:C.amber,  icon:<FaHourglassHalf/>,label:"Pending" },
    Rejected:  { bg:"#fee2e2", color:C.rose,   icon:<FaTimesCircle/>,  label:"Rejected" },
  };

  const fmt = (d) => {
    if (!d) return "";
    return new Date(d+"T00:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short"});
  };

  const avatarColors = ["#6366f1","#0d9488","#f59e0b","#f43f5e","#0ea5e9","#8b5cf6","#10b981","#ec4899"];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {feed.length === 0 && (
        <div style={{ textAlign:"center", padding:"24px 0", color:C.slate, fontSize:13 }}>No recent activity</div>
      )}
      {feed.map((item, i) => {
        const s = statusStyle[item.status] || statusStyle.Pending;
        return (
          <div key={i} className="feed-row" style={{
            display:"flex", alignItems:"center", gap:12, padding:"10px 14px",
            borderBottom: i < feed.length-1 ? `1px solid ${C.border}` : "none",
            borderRadius: i === 0 ? "10px 10px 0 0" : i === feed.length-1 ? "0 0 10px 10px" : 0,
          }}>
            {/* Avatar */}
            <div style={{ width:34, height:34, borderRadius:"50%", background:avatarColors[i%avatarColors.length], color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:13, flexShrink:0 }}>
              {item.name.charAt(0)}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:600, color:C.navy, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                {item.name}
              </div>
              <div style={{ fontSize:11, color:C.slate }}>
                {item.type} · {fmt(item.from)}{item.to !== item.from ? ` – ${fmt(item.to)}` : ""}
              </div>
            </div>
            <div style={{ background:s.bg, color:s.color, fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20, display:"flex", alignItems:"center", gap:4, whiteSpace:"nowrap", flexShrink:0 }}>
              <span style={{ fontSize:9 }}>{s.icon}</span>{s.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* Department Leaderboard */
const DeptLeaderboard = ({ data }) => {
  const sorted = [...data].sort((a,b) => b.employees - a.employees);
  const max = sorted[0]?.employees || 1;
  const colors = [C.indigo, C.teal, C.amber, C.rose, C.sky, C.violet];
  const medals = ["🥇","🥈","🥉"];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {sorted.slice(0,6).map((dept, i) => (
        <div key={dept.name} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:22, textAlign:"center", fontSize:14, flexShrink:0 }}>
            {i < 3 ? medals[i] : <span style={{ fontSize:11, color:C.slate, fontWeight:700 }}>#{i+1}</span>}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <span style={{ fontSize:12, fontWeight:600, color:C.navy, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{dept.name}</span>
              <span style={{ fontSize:12, fontWeight:700, color:colors[i%colors.length], flexShrink:0, marginLeft:6 }}>{dept.employees}</span>
            </div>
            <div style={{ height:6, background:"#f1f5f9", borderRadius:10, overflow:"hidden" }}>
              <div
                className="hrms-dept-bar"
                style={{
                  height:"100%",
                  width: `${(dept.employees/max)*100}%`,
                  "--bar-w": `${(dept.employees/max)*100}%`,
                  background: `linear-gradient(90deg, ${colors[i%colors.length]}cc, ${colors[i%colors.length]})`,
                  borderRadius:10,
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/* Next birthday countdown */
const BirthdayCountdown = ({ birthdays }) => {
  if (!birthdays || birthdays.length === 0) return (
    <div style={{ textAlign:"center", color:C.slate, fontSize:12, padding:"12px 0" }}>No upcoming birthdays</div>
  );
  const next = birthdays[0];
  const today = new Date();
  const bday = new Date(today.getFullYear(), next.dobMonth, next.dobDay);
  if (bday < today) bday.setFullYear(today.getFullYear() + 1);
  const days = Math.ceil((bday - today) / (1000*60*60*24));
  const isToday = days === 0;

  return (
    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
      <div style={{ width:46, height:46, borderRadius:14, background:"linear-gradient(135deg,#f97316,#ec4899)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
        🎂
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:700, color:C.navy }}>{next.name}</div>
        <div style={{ fontSize:11, color:C.slate }}>{next.department}</div>
      </div>
      <div style={{ textAlign:"center", flexShrink:0 }}>
        {isToday ? (
          <div style={{ fontSize:11, fontWeight:800, color:"#f97316", background:"#fff7ed", borderRadius:8, padding:"4px 10px" }}>TODAY! 🎉</div>
        ) : (
          <>
            <div style={{ fontSize:20, fontWeight:800, color:"#f97316", fontFamily:"'Outfit',sans-serif", lineHeight:1 }}>{days}</div>
            <div style={{ fontSize:10, color:C.slate, fontWeight:600 }}>days left</div>
          </>
        )}
      </div>
    </div>
  );
};

/* Peak attendance day badge */
const PeakDay = ({ chartData }) => {
  if (!chartData || chartData.length === 0) return null;
  const peak = chartData.reduce((best, d) => d.Present > (best?.Present||0) ? d : best, null);
  if (!peak) return null;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, background:"#f0fdf4", borderRadius:10, padding:"8px 12px" }}>
      <FaTrophy style={{ color:C.amber, fontSize:14 }} />
      <div>
        <div style={{ fontSize:11, fontWeight:700, color:C.navy }}>Peak Day: <span style={{ color:C.green }}>{peak.name}</span></div>
        <div style={{ fontSize:10, color:C.slate }}>{peak.Present} employees present</div>
      </div>
    </div>
  );
};

/* Custom tooltip */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0f172a", borderRadius:10, padding:"10px 14px", fontFamily:"'Manrope',sans-serif", boxShadow:"0 8px 24px rgba(0,0,0,.25)", fontSize:12 }}>
      <div style={{ color:"#94a3b8", marginBottom:6, fontWeight:600, letterSpacing:"0.05em" }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ color: p.fill === C.green ? C.green : "#fca5a5", fontWeight:700, display:"flex", justifyContent:"space-between", gap:16 }}>
          <span style={{ color:"#94a3b8", fontWeight:400 }}>{p.name}</span>{p.value}
        </div>
      ))}
    </div>
  );
};

/* ════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════ */
const AdminDashboard = () => {
  const { employees } = useContext(EmployeeContext);
  const { getDashboardData } = useContext(AttendanceContext);
  const { leaveRequests } = useContext(LeaveRequestContext);
  const navigate = useNavigate();

  const [selectedDept, setSelectedDept]       = useState("All");
  const [viewMode, setViewMode]               = useState("week");
  const [selectedMonth, setSelectedMonth]     = useState(new Date().toISOString().slice(0,7));
  const [currentWeek, setCurrentWeek]         = useState(0);
  const [weeklyAttendanceData, setWeeklyAttendanceData] = useState([]);
  const [loadingGraph, setLoadingGraph]       = useState(false);
  const [todayCounts, setTodayCounts]         = useState({ present:0, notLoggedIn:0, onLeave:0 });
  const [loadingTeamData, setLoadingTeamData] = useState(false);
  const [monthlyBirthdays, setMonthlyBirthdays] = useState([]);
  const [onLeaveToday, setOnLeaveToday]       = useState([]);
  const [remoteWorkers, setRemoteWorkers]     = useState([]);
  const [officeConfig, setOfficeConfig]       = useState(null);
  const [isGlobalWFH, setIsGlobalWFH]         = useState(false);
  const [showAllRemote, setShowAllRemote]     = useState(false);
  const [todayAttendanceData, setTodayAttendanceData] = useState([]);

  /* ── 1. General stats ── */
  const { statCards, activeEmployees, departmentList } = useMemo(
    () => getDashboardData(employees, leaveRequests),
    [employees, leaveRequests, getDashboardData]
  );

  /* ── 2. Today's counts ── */
  useEffect(() => {
    const calc = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const todayAtt = await getAttendanceByDateRange(today, today);
        const arr = Array.isArray(todayAtt) ? todayAtt : [];
        setTodayAttendanceData(arr);

        const todayLeaves = leaveRequests.filter(l => l.status === "Approved" && today >= l.from && today <= l.to);
        const present = arr.filter(a => a.punchIn).length;
        const onLeave = todayLeaves.length;
        const activeIds = new Set(activeEmployees.filter(e => e.isActive !== false).map(e => e.employeeId));
        const presentIds = new Set(arr.filter(a => a.punchIn).map(a => a.employeeId));
        const onLeaveIds = new Set(todayLeaves.map(l => l.employeeId));
        const notLoggedIn = Array.from(activeIds).filter(id => !presentIds.has(id) && !onLeaveIds.has(id)).length;
        setTodayCounts({ present, notLoggedIn, onLeave });
      } catch (e) { console.error(e); }
    };
    calc();
  }, [activeEmployees, leaveRequests]);

  /* ── 3. Team data ── */
  const fetchTeamData = async () => {
    setLoadingTeamData(true);
    try {
      const [empRes, leavesRes, configRes, modesRes] = await Promise.all([
        api.get("/api/employees"),
        api.get("/api/leaves"),
        api.get("/api/admin/settings/office"),
        api.get("/api/admin/settings/employees-modes"),
      ]);
      const allEmp = empRes.data || [];
      const allLeaves = leavesRes.data || [];
      const config = configRes.data;
      const empModes = modesRes.data?.employees || [];
      setOfficeConfig(config);
      setIsGlobalWFH(config?.globalWorkMode === "WFH");

      const today = new Date();
      const cm = today.getMonth(), cd = today.getDate();
      const birthdays = allEmp
        .filter(e => e.isActive !== false && e.personalDetails?.dob)
        .filter(e => { const d = new Date(e.personalDetails.dob); return d.getMonth()===cm && d.getDate()>=cd; })
        .map(e => {
          const d = new Date(e.personalDetails.dob);
          return { name:e.name, employeeId:e.employeeId, department:e.department||e.experienceDetails?.[0]?.department||"N/A", role:e.role||e.experienceDetails?.[0]?.role||"N/A", dobDay:d.getDate(), dobMonth:d.getMonth() };
        })
        .sort((a,b) => a.dobDay - b.dobDay);
      setMonthlyBirthdays(birthdays);

      const empMap = new Map();
      allEmp.forEach(e => empMap.set(e.employeeId, { name:e.name, employeeId:e.employeeId, department:e.department||e.experienceDetails?.[0]?.department||"N/A", role:e.role||e.experienceDetails?.[0]?.role||"N/A" }));

      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todayLeaves = allLeaves.filter(l => {
        if (l.status !== "Approved") return false;
        const f = new Date(l.from); const t = new Date(l.to);
        f.setHours(0,0,0,0); t.setHours(23,59,59,999);
        return todayStart >= f && todayStart <= t;
      });
      const onLeave = todayLeaves.map(l => ({ ...(empMap.get(l.employeeId)||{name:l.employeeName||"Unknown",employeeId:l.employeeId,department:"N/A",role:"N/A"}), leaveType:l.leaveType||"Casual", leaveReason:l.reason }));
      setOnLeaveToday(Array.from(new Map(onLeave.map(i=>[i.employeeId,i])).values()));

      const globalMode = config.globalWorkMode || "WFO";
      const curDay = today.getDay();
      const remotes = [];
      empModes.forEach(emp => {
        const info = empMap.get(emp.employeeId); if (!info) return;
        let mode = globalMode;
        if (emp.ruleType==="Permanent") mode = emp.config.permanentMode;
        else if (emp.ruleType==="Temporary"&&emp.config.temporary) {
          const f=new Date(emp.config.temporary.fromDate),t=new Date(emp.config.temporary.toDate);
          f.setHours(0,0,0,0); t.setHours(23,59,59,999);
          if (todayStart>=f&&todayStart<=t) mode=emp.config.temporary.mode;
        } else if (emp.ruleType==="Recurring"&&emp.config.recurring) {
          if (emp.config.recurring.days.includes(curDay)) mode=emp.config.recurring.mode;
        }
        if (mode==="WFH") remotes.push({...info,employeeId:emp.employeeId});
      });
      if (globalMode==="WFH") {
        remotes.push(...allEmp.filter(e=>e.isActive!==false).map(e=>({name:e.name,employeeId:e.employeeId,department:e.department||e.experienceDetails?.[0]?.department||"N/A",role:e.role||e.experienceDetails?.[0]?.role||"N/A"})));
        const u=new Map(); remotes.forEach(e=>u.set(e.employeeId,e)); remotes.length=0; remotes.push(...u.values());
      }
      const punchedIn = new Set(todayAttendanceData.filter(a=>a.punchIn).map(a=>a.employeeId));
      setRemoteWorkers(remotes.filter(e=>punchedIn.has(e.employeeId)));
    } catch(e) { console.error(e); }
    finally { setLoadingTeamData(false); }
  };
  useEffect(() => { fetchTeamData(); }, [todayAttendanceData]);

  /* ── 4. Date range ── */
  const weekDates = useMemo(() => {
    const fmt = d => { const o=d.getTimezoneOffset()*60000; return new Date(d.getTime()-o).toISOString().slice(0,10); };
    if (viewMode==="month") {
      const [y,m] = selectedMonth.split("-").map(Number);
      const first=new Date(y,m-1,1), last=new Date(y,m,0); last.setHours(23,59,59,999);
      return {start:fmt(first),end:fmt(last),startDateObj:first,endDateObj:last};
    }
    const today=new Date(); today.setDate(today.getDate()+currentWeek*7);
    const dow=today.getDay();
    const sun=new Date(today); sun.setDate(today.getDate()-dow); sun.setHours(0,0,0,0);
    const sat=new Date(sun); sat.setDate(sun.getDate()+6); sat.setHours(23,59,59,999);
    return {start:fmt(sun),end:fmt(sat),startDateObj:sun,endDateObj:sat};
  }, [currentWeek, viewMode, selectedMonth]);

  /* ── 5. Fetch chart data ── */
  useEffect(() => {
    const fetch_ = async () => {
      setLoadingGraph(true);
      try {
        const d = await getAttendanceByDateRange(weekDates.start, weekDates.end);
        setWeeklyAttendanceData(Array.isArray(d)?d:[]);
      } catch(e){ setWeeklyAttendanceData([]); }
      finally { setLoadingGraph(false); }
    };
    fetch_();
  }, [weekDates]);

  /* ── 6. Chart data processed ── */
  const weeklyChartData = useMemo(() => {
    const deptEmp = activeEmployees.filter(e => selectedDept==="All" || e.department===selectedDept);
    const total = deptEmp.length;
    const validIds = new Set(deptEmp.map(e=>e.employeeId));
    const data=[], start=new Date(weekDates.startDateObj), today=new Date(); today.setHours(0,0,0,0);
    const days = Math.ceil((weekDates.endDateObj.getTime()-weekDates.startDateObj.getTime())/(1000*3600*24))+1;
    for (let i=0;i<days;i++) {
      const d=new Date(start); d.setDate(start.getDate()+i);
      if (d>today) break;
      const o=d.getTimezoneOffset()*60000;
      const ds=new Date(d.getTime()-o).toISOString().slice(0,10);
      const dn=viewMode==="week"?d.toLocaleDateString("en-US",{weekday:"short"}):d.getDate().toString();
      const ps=new Set();
      weeklyAttendanceData.forEach(r=>{
        const rd=r.punchIn?new Date(r.punchIn):new Date(r.date);
        const ro=rd.getTimezoneOffset()*60000;
        const rs=new Date(rd.getTime()-ro).toISOString().slice(0,10);
        if(rs===ds&&r.punchIn&&validIds.has(r.employeeId)) ps.add(r.employeeId);
      });
      const present=ps.size; let absent=total-present; if(absent<0)absent=0;
      data.push({name:dn,date:ds,Present:present,Absent:absent});
    }
    return data;
  }, [weeklyAttendanceData, activeEmployees, selectedDept, weekDates, viewMode]);

  /* ── 7. Department distribution ── */
  const departmentData = useMemo(() => {
    const c={};
    activeEmployees.forEach(e=>{ const d=e.department||"Unassigned"; c[d]=(c[d]||0)+1; });
    return Object.entries(c).map(([name,employees])=>({name,employees}));
  }, [activeEmployees]);

  /* ── 8. Leave type breakdown (NEW) ── */
  const leaveTypeBreakdown = useMemo(() => {
    const c={};
    leaveRequests.filter(l=>l.status==="Approved").forEach(l=>{ const t=l.leaveType||"Other"; c[t]=(c[t]||0)+1; });
    return Object.entries(c).map(([type,count])=>({type,count})).sort((a,b)=>b.count-a.count).slice(0,4);
  }, [leaveRequests]);

  const pendingLeaveCount = useMemo(() => leaveRequests.filter(l=>l.status==="Pending").length, [leaveRequests]);

  /* ── Helpers ── */
  const fmtRange = (s,e) => {
    const o={month:"short",day:"numeric"}; const yr={year:"numeric"};
    return `${new Date(s+"T00:00:00").toLocaleDateString("en-US",o)} – ${new Date(e+"T00:00:00").toLocaleDateString("en-US",{...o,...yr})}`;
  };
  const isCurrentWeek = currentWeek >= 0;
  const totalActive = activeEmployees.filter(e=>e.isActive!==false).length;
  const attRate = totalActive>0 ? Math.round((todayCounts.present/totalActive)*100) : 0;
  const peakDay = weeklyChartData.length>0 ? weeklyChartData.reduce((b,d)=>d.Present>(b?.Present||0)?d:b,null) : null;

  const quickActions = [
    { title:"Employee Management",   icon:<FaUsers/>,         to:"/employees",                  accent:C.indigo },
    { title:"Group Management",      icon:<FaLayerGroup/>,    to:"/admin/groups",               accent:C.violet },
    { title:"Attendance",            icon:<FaUserClock/>,     to:"/attendance",                  accent:C.green  },
    { title:"Leave Approvals",       icon:<FaCalendarCheck/>, to:"/admin/admin-Leavemanage",    accent:C.amber  },
    { title:"Payroll",               icon:<FaFileAlt/>,       to:"/admin/payroll",              accent:C.rose   },
    { title:"Announcements",         icon:<FaBullhorn/>,      to:"/admin/notices",              accent:C.sky    },
    { title:"Holiday Calendar",      icon:<FaCalendarAlt/>,   to:"/admin/holiday-calendar",    accent:C.teal   },
    { title:"Shift Management",      icon:<FaChartPie/>,      to:"/admin/settings",            accent:"#ec4899"},
  ];

  const AV_GRADS = [
    "linear-gradient(135deg,#6366f1,#8b5cf6)",
    "linear-gradient(135deg,#0d9488,#0ea5e9)",
    "linear-gradient(135deg,#f59e0b,#f97316)",
    "linear-gradient(135deg,#f43f5e,#ec4899)",
    "linear-gradient(135deg,#10b981,#06b6d4)",
  ];

  const today = new Date();
  const greeting = today.getHours()<12?"Good morning":"today.getHours()<17"?"Good afternoon":"Good evening";

  /* ─── RENDER ─── */
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="hrms" style={{ minHeight:"100vh", background:C.bg, color:C.navy }}>

        {/* ══════════ TOPBAR ══════════ */}
        <div style={{
          background:"#fff",
          borderBottom:`1px solid ${C.border}`,
          padding:"0 28px",
          height:60,
          display:"flex",
          alignItems:"center",
          justifyContent:"space-between",
          top:0,
          zIndex:100,
          boxShadow:"0 1px 8px rgba(0,0,0,.06)",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:32, height:32, borderRadius:10, background:`linear-gradient(135deg,${C.indigo},${C.teal})`, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <FaShieldAlt style={{ color:"#fff", fontSize:14 }} />
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:C.navy, fontFamily:"'Outfit',sans-serif", letterSpacing:"-0.01em" }}>HRMS Admin</div>
              <div style={{ fontSize:10, color:C.slate, fontWeight:500 }}>
                {today.toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            {/* Pending badge */}
            {pendingLeaveCount > 0 && (
              <button
                onClick={()=>navigate("/admin/admin-Leavemanage",{state:{defaultStatus:"Pending"}})}
                style={{ display:"flex", alignItems:"center", gap:7, background:"#fef3c7", border:"1px solid #fde68a", borderRadius:20, padding:"5px 12px", cursor:"pointer", fontFamily:"'Manrope',sans-serif" }}
              >
                <span style={{ width:7,height:7,borderRadius:"50%",background:C.amber,display:"inline-block",animation:"pulse 1.5s infinite" }}/>
                <span style={{ fontSize:12, fontWeight:700, color:"#92400e" }}>{pendingLeaveCount} pending leave{pendingLeaveCount>1?"s":""}</span>
              </button>
            )}
            {/* Live indicator */}
            <div style={{ display:"flex", alignItems:"center", gap:6, background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:20, padding:"5px 12px" }}>
              <span style={{ width:7,height:7,borderRadius:"50%",background:C.green,display:"inline-block",animation:"pulse 2s infinite" }}/>
              <span style={{ fontSize:11, fontWeight:700, color:"#166534" }}>Live</span>
            </div>
          </div>
        </div>

        {/* ══════════ PAGE BODY ══════════ */}
        <div style={{ padding:"24px 28px 8px", maxWidth:1600, margin:"0 auto" }}>

          {/* ── Section label ── */}
          <div style={{ marginBottom:20, display:"flex", alignItems:"baseline", gap:10 }}>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, fontFamily:"'Outfit',sans-serif", letterSpacing:"-0.02em" }}>
              Workforce Overview
            </h1>
            <span style={{ fontSize:13, color:C.slate }}>· Real-time snapshot</span>
          </div>

          {/* ══ ROW 1: Hero Stats Row ══ */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:16, marginBottom:20 }}>

            {/* Card 1 — Attendance ring hero */}
            <div className="hrms-card hrms-hover" style={{
             background:"linear-gradient(145deg,#ffffff 0%,#f1f5f9 100%)",

              borderRadius:12,
             padding:"16px 18px",

              border:"none",
              boxShadow:"0 4px 20px rgba(15,23,42,.2)",
              gridColumn:"span 1",
              display:"flex",
              flexDirection:"column",
              gap:10,
            }} onClick={()=>navigate("/admin/today-overview")}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:600, color:"#64748b", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Today's Attendance</div>
                  <div style={{ fontSize:11, color:"#475569" }}>
                    {today.toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:6, background:"#ffffff10", borderRadius:12, padding:"4px 10px" }}>
                  <FaClock style={{ color:"#94a3b8", fontSize:11 }} />
                  <span style={{ fontSize:11, color:"#94a3b8" }}>Live</span>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:18, justifyContent:"center" }}>
                <AttendanceRing present={todayCounts.present} absent={todayCounts.notLoggedIn} onLeave={todayCounts.onLeave} total={totalActive} />
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[
                    { label:"Present",  val:todayCounts.present,    color:C.green },
                    { label:"On Leave", val:todayCounts.onLeave,    color:C.amber },
                    { label:"Absent",   val:todayCounts.notLoggedIn, color:"#fca5a5" },
                  ].map(s => (
                    <div key={s.label} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ width:8, height:8, borderRadius:2, background:s.color, display:"inline-block", flexShrink:0 }} />
                      <span style={{ fontSize:11, color:"#94a3b8", width:54 }}>{s.label}</span>
                      <span style={{ fontSize:16, fontWeight:800, color:s.color, fontFamily:"'Outfit',sans-serif", lineHeight:1 }}>{s.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:4, borderTop:"1px solid #ffffff10" }}>
                <span style={{ fontSize:11, color:"#475569" }}>of {totalActive} active employees</span>
                <span style={{ fontSize:11, color:"#6366f1", fontWeight:700, display:"flex", alignItems:"center", gap:4 }}>
                  Details <FaArrowRight style={{ fontSize:9 }} />
                </span>
              </div>
            </div>

            {/* Card 2 — Total employees + sparkline */}
            <KpiTile
              label="Total Employees"
              value={statCards.totalEmployees}
              icon={<FaUsers/>}
              accent={C.indigo}

        
              sub={`${attRate}% present today`}
              onClick={()=>navigate("/employees")}
              delay={0.08}
              sparkData={weeklyChartData}
            />
            

            {/* Card 3 — Leave requests */}
            <KpiTile
              label="Pending Leave Requests"
              value={statCards.pendingLeaves}
              icon={<FaClipboardList/>}
              accent={C.amber}
              sub={statCards.pendingLeaves > 0 ? "Requires your attention" : "All caught up ✓"}
              onClick={()=>navigate("/admin/admin-Leavemanage",{state:{defaultStatus:"Pending"}})}
              delay={0.12}
            />

            {/* Card 4 — Departments */}
            <KpiTile
              label="Departments"
              value={statCards.totalDepartments}
              icon={<FaBuilding/>}
              accent={C.teal}
              sub={`${departmentData.length > 0 ? Math.max(...departmentData.map(d=>d.employees)) : 0} max headcount`}
              delay={0.16}
            />
          </div>

          {/* ══ ROW 2: Insights strip ══ */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
            {[
              {
                icon:<FaFireAlt style={{ color:C.rose }}/>,
                label:"Attendance Rate",
                val:`${attRate}%`,
                accent:C.rose,
                sub: attRate >= 80 ? "Above target" : "Below 80% target",
              },
              {
                icon:<FaWifi style={{ color:C.sky }}/>,
                label:"Working Remotely",
                val:remoteWorkers.length,
                accent:C.sky,
                sub:`${todayCounts.present > 0 ? Math.round((remoteWorkers.length/todayCounts.present)*100) : 0}% of present`,
              },
              {
                icon:<FaUmbrellaBeach style={{ color:C.violet }}/>,
                label:"On Leave Today",
                val:todayCounts.onLeave,
                accent:C.violet,
                sub:`${totalActive > 0 ? Math.round((todayCounts.onLeave/totalActive)*100) : 0}% of workforce`,
              },
              {
                icon:<FaBirthdayCake style={{ color:"#f97316" }}/>,
                label:"Birthdays This Month",
                val:monthlyBirthdays.length,
                accent:"#f97316",
                sub:monthlyBirthdays.length > 0 ? `Next: ${monthlyBirthdays[0]?.name?.split(" ")[0]}` : "None upcoming",
              },
            ].map((s, i) => (
              <div key={i} className="hrms-card" style={{
                background:C.card, border:`1px solid ${C.border}`, borderRadius:14,
                padding:"14px 16px", boxShadow:"0 1px 6px rgba(0,0,0,.04)",
                animationDelay:`${.1+i*.05}s`,
                display:"flex", alignItems:"center", gap:12,
              }}>
                <div style={{ width:38, height:38, borderRadius:10, background:s.accent+"14", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize:20, fontWeight:800, color:C.navy, fontFamily:"'Outfit',sans-serif", lineHeight:1, marginBottom:2 }}>{s.val}</div>
                  <div style={{ fontSize:11, fontWeight:600, color:C.slate, marginBottom:1 }}>{s.label}</div>
                  <div style={{ fontSize:10, color:s.accent, fontWeight:600 }}>{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ══ ROW 3: Chart + Right sidebar ══ */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 360px", gap:20, marginBottom:20 }}>

            {/* Attendance Chart Card */}
            <div className="hrms-card" style={{ background:C.card, borderRadius:18, padding:"24px", border:`1px solid ${C.border}`, boxShadow:"0 2px 12px rgba(0,0,0,.05)" }}>
              {/* Chart header */}
              <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom:20 }}>
                <div>
                  <h3 style={{ margin:0, fontSize:16, fontWeight:800, fontFamily:"'Outfit',sans-serif" }}>
                    Attendance Trend
                  </h3>
                  <p style={{ margin:"3px 0 0", fontSize:12, color:C.slate }}>
                    {fmtRange(weekDates.start, weekDates.end)}
                  </p>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                  {/* View toggle */}
                  <div style={{ display:"flex", background:"#f1f5f9", borderRadius:10, padding:3 }}>
                    {["week","month"].map(m=>(
                      <button key={m} onClick={()=>setViewMode(m)}
                        className="hrms-pill-btn"
                        style={{ padding:"5px 14px", borderRadius:8, border:"none", cursor:"pointer",
                          fontFamily:"'Manrope',sans-serif", fontSize:12, fontWeight:600,
                          background:viewMode===m?C.navy:"transparent", color:viewMode===m?"#fff":C.slate }}>
                        {m==="week"?"Weekly":"Monthly"}
                      </button>
                    ))}
                  </div>
                  {/* Week nav */}
                  {viewMode==="week" ? (
                    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <button onClick={()=>setCurrentWeek(currentWeek-1)} style={{ width:30,height:30,background:"#f1f5f9",border:"none",borderRadius:8,cursor:"pointer",color:C.navy,display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <FaChevronLeft style={{ fontSize:11 }}/>
                      </button>
                      <button onClick={()=>setCurrentWeek(currentWeek+1)} disabled={isCurrentWeek}
                        style={{ width:30,height:30,background:isCurrentWeek?"#f8fafc":"#f1f5f9",border:"none",borderRadius:8,cursor:isCurrentWeek?"not-allowed":"pointer",color:isCurrentWeek?"#cbd5e1":C.navy,display:"flex",alignItems:"center",justifyContent:"center" }}>
                        <FaChevronRight style={{ fontSize:11 }}/>
                      </button>
                      {currentWeek!==0&&<button onClick={()=>setCurrentWeek(0)} style={{ width:30,height:30,background:C.teal+"18",border:"none",borderRadius:8,cursor:"pointer",color:C.teal,display:"flex",alignItems:"center",justifyContent:"center" }}><FaSyncAlt style={{ fontSize:11 }}/></button>}
                    </div>
                  ) : (
                    <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
                      max={new Date().toISOString().slice(0,7)}
                      style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", fontFamily:"'Manrope',sans-serif", fontSize:12, color:C.navy, background:"#f8fafc" }}
                    />
                  )}
                  {/* Dept filter */}
                  <select value={selectedDept} onChange={e=>setSelectedDept(e.target.value)}
                    style={{ border:`1px solid ${C.border}`, borderRadius:8, padding:"5px 10px", fontFamily:"'Manrope',sans-serif", fontSize:12, color:C.navy, background:"#f8fafc" }}>
                    <option value="All">All Departments</option>
                    {departmentList.map(d=><option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              {/* Peak day badge */}
              {peakDay && (
                <div style={{ marginBottom:14 }}>
                  <PeakDay chartData={weeklyChartData} />
                </div>
              )}

              {/* Bar chart */}
              <div style={{ width:"100%", height:260 }}>
                {loadingGraph ? (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:C.slate, gap:10 }}>
                    <div style={{ width:20,height:20,border:`2px solid ${C.indigo}30`,borderTop:`2px solid ${C.indigo}`,borderRadius:"50%",animation:"spin .7s linear infinite" }}/>
                    Loading…
                  </div>
                ) : weeklyChartData.length===0 ? (
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:C.slate, fontSize:13 }}>No data for this period</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChartData} margin={{top:5,right:0,left:-20,bottom:0}} barGap={3}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:"#94a3b8",fontSize:11}} dy={8} interval={0}/>
                      <YAxis axisLine={false} tickLine={false} tick={{fill:"#94a3b8",fontSize:11}}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <Bar dataKey="Present" fill={C.green}  radius={[5,5,0,0]} barSize={viewMode==="month"?7:18}/>
                      <Bar dataKey="Absent"  fill="#fca5a5" radius={[5,5,0,0]} barSize={viewMode==="month"?7:18}/>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Legend */}
              <div style={{ display:"flex", gap:18, justifyContent:"center", marginTop:12 }}>
                {[["Present",C.green],["Absent","#fca5a5"]].map(([l,c])=>(
                  <div key={l} style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ width:10,height:10,borderRadius:3,background:c,display:"inline-block" }}/>
                    <span style={{ fontSize:12,color:C.slate,fontWeight:500 }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right panel stack */}
            <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

              {/* Workforce Health */}
              <div className="hrms-card" style={{ background:C.card, borderRadius:18, padding:"20px", border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <FaChartLine style={{ color:C.indigo, fontSize:14 }}/>
                  <span style={{ fontSize:13, fontWeight:800, fontFamily:"'Outfit',sans-serif" }}>Workforce Health</span>
                </div>
                <HealthScore present={todayCounts.present} total={totalActive} pending={pendingLeaveCount} />
                {/* Leave type breakdown */}
                {leaveTypeBreakdown.length > 0 && (
                  <div style={{ marginTop:12, borderTop:`1px solid ${C.border}`, paddingTop:12 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:C.slate, marginBottom:8, letterSpacing:"0.06em" }}>LEAVE TYPES (APPROVED)</div>
                    {leaveTypeBreakdown.map((lt,i)=>{
                      const totalApproved = leaveTypeBreakdown.reduce((s,x)=>s+x.count,0);
                      const pct = Math.round((lt.count/totalApproved)*100);
                      const colors=[C.indigo,C.teal,C.amber,C.rose];
                      return (
                        <div key={lt.type} style={{ marginBottom:8 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                            <span style={{ fontSize:11, fontWeight:600, color:C.navy }}>{lt.type}</span>
                            <span style={{ fontSize:11, fontWeight:700, color:colors[i%colors.length] }}>{lt.count}</span>
                          </div>
                          <div style={{ height:5, background:"#f1f5f9", borderRadius:10 }}>
                            <div className="hrms-dept-bar" style={{ height:"100%", width:`${pct}%`, "--bar-w":`${pct}%`, background:colors[i%colors.length], borderRadius:10 }}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Next birthday + dept leaderboard teaser */}
              <div className="hrms-card" style={{ background:C.card, borderRadius:18, padding:"18px 20px", border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
                  <FaBirthdayCake style={{ color:"#f97316", fontSize:13 }}/>
                  <span style={{ fontSize:13, fontWeight:800, fontFamily:"'Outfit',sans-serif" }}>Next Birthday</span>
                </div>
                <BirthdayCountdown birthdays={monthlyBirthdays} />
                {monthlyBirthdays.length > 1 && (
                  <div style={{ marginTop:10, fontSize:11, color:C.slate, textAlign:"center" }}>
                    +{monthlyBirthdays.length - 1} more birthday{monthlyBirthdays.length>2?"s":""} this month
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ══ ROW 4: Department + Activity Feed ══ */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>

            {/* Department Leaderboard */}
            <div className="hrms-card" style={{ background:C.card, borderRadius:18, padding:"24px", border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <FaTrophy style={{ color:C.amber, fontSize:15 }}/>
                  <span style={{ fontSize:15, fontWeight:800, fontFamily:"'Outfit',sans-serif" }}>Department Headcount</span>
                </div>
                <span style={{ fontSize:11, color:C.slate, fontWeight:500 }}>{departmentData.length} departments</span>
              </div>
              <DeptLeaderboard data={departmentData} />
              {departmentData.length === 0 && (
                <div style={{ textAlign:"center", padding:"24px 0", color:C.slate, fontSize:13 }}>No department data</div>
              )}
            </div>

            {/* Leave Activity Feed */}
            <div className="hrms-card" style={{ background:C.card, borderRadius:18, padding:"24px", border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <FaRegBell style={{ color:C.indigo, fontSize:15 }}/>
                  <span style={{ fontSize:15, fontWeight:800, fontFamily:"'Outfit',sans-serif" }}>Leave Activity</span>
                </div>
                <button onClick={()=>navigate("/admin/admin-Leavemanage")}
                  style={{ fontSize:11, fontWeight:700, color:C.indigo, background:C.indigo+"14", border:"none", borderRadius:8, padding:"4px 10px", cursor:"pointer", fontFamily:"'Manrope',sans-serif" }}>
                  View All
                </button>
              </div>
          <ActivityFeed requests={leaveRequests.slice(0, 2)} employees={activeEmployees} />


            </div>
          </div>

          {/* ══ ROW 5: Team Today ══ */}
          <div style={{ marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:16 }}>
              <h2 style={{ margin:0, fontSize:16, fontWeight:800, fontFamily:"'Outfit',sans-serif" }}>Team Today</h2>
              <span style={{ fontSize:12, color:C.slate }}>· Who's where right now</span>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:28 }}>

            {/* On Leave */}
            <div className="hrms-card" style={{ background:C.card, borderRadius:18, padding:"20px", border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:"#dbeafe", display:"flex", alignItems:"center", justifyContent:"center", color:C.sky, fontSize:16 }}>
                    <FaUmbrellaBeach/>
                  </div>
                  <span style={{ fontSize:14, fontWeight:700, fontFamily:"'Outfit',sans-serif" }}>On Leave</span>
                </div>
                <span style={{ background:"#dbeafe", color:C.sky, fontSize:12, fontWeight:700, padding:"3px 10px", borderRadius:20 }}>{onLeaveToday.length}</span>
              </div>
              {loadingTeamData ? (
                <div style={{ display:"flex", justifyContent:"center", padding:"16px 0" }}>
                  <div style={{ width:24,height:24,border:`2px solid ${C.sky}30`,borderTop:`2px solid ${C.sky}`,borderRadius:"50%",animation:"spin .7s linear infinite" }}/>
                </div>
              ) : onLeaveToday.length > 0 ? (
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {onLeaveToday.slice(0,5).map((p,i)=>(
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"#f8fafc", borderRadius:10 }}>
                      <div style={{ width:32,height:32,borderRadius:"50%",background:AV_GRADS[i%AV_GRADS.length],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13,flexShrink:0 }}>{p.name.charAt(0)}</div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:12,fontWeight:600,color:C.navy,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{p.name}</div>
                        <div style={{ fontSize:10,color:C.slate }}>{p.department}</div>
                      </div>
                      <span style={{ background:"#dbeafe",color:C.sky,fontSize:10,fontWeight:600,padding:"2px 8px",borderRadius:12,flexShrink:0 }}>{p.leaveType}</span>
                    </div>
                  ))}
                  {onLeaveToday.length > 5 && <div style={{ textAlign:"center",fontSize:11,color:C.slate,paddingTop:4 }}>+{onLeaveToday.length-5} more</div>}
                </div>
              ) : (
                <div style={{ textAlign:"center",padding:"18px 0",color:C.slate,fontSize:12,background:"#f8fafc",borderRadius:10 }}>No employees on leave today</div>
              )}
            </div>

            {/* Working Remotely */}
            <div className="hrms-card" style={{ background:C.card, borderRadius:18, padding:"20px", border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:10,background:"#d1fae5",display:"flex",alignItems:"center",justifyContent:"center",color:C.green,fontSize:16 }}>
                    <FaLaptopHouse/>
                  </div>
                  <span style={{ fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif" }}>Remote</span>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  {isGlobalWFH && <span style={{ background:"#ede9fe",color:C.violet,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:12 }}>Global WFH</span>}
                  <span style={{ background:"#d1fae5",color:C.green,fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20 }}>{remoteWorkers.length}</span>
                </div>
              </div>
              {loadingTeamData ? (
                <div style={{ display:"flex", justifyContent:"center", padding:"16px 0" }}>
                  <div style={{ width:24,height:24,border:`2px solid ${C.green}30`,borderTop:`2px solid ${C.green}`,borderRadius:"50%",animation:"spin .7s linear infinite" }}/>
                </div>
              ) : remoteWorkers.length > 0 ? (
                <div>
                  {/* Stacked avatars */}
                  <div style={{ display:"flex", marginBottom:12 }}>
                    {(showAllRemote?remoteWorkers:remoteWorkers.slice(0,8)).map((w,i)=>(
                      <div key={i} title={`${w.name} (${w.department})`}
                        style={{ width:30,height:30,borderRadius:"50%",background:AV_GRADS[i%AV_GRADS.length],border:"2px solid #fff",marginLeft:i===0?0:-8,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:12,position:"relative",zIndex:10-i }}>
                        {w.name.charAt(0)}
                      </div>
                    ))}
                    {!showAllRemote&&remoteWorkers.length>8&&(
                      <div onClick={()=>setShowAllRemote(true)}
                        style={{ width:30,height:30,borderRadius:"50%",background:"#e2e8f0",border:"2px solid #fff",marginLeft:-8,display:"flex",alignItems:"center",justifyContent:"center",color:C.slate,fontWeight:700,fontSize:10,cursor:"pointer" }}>
                        +{remoteWorkers.length-8}
                      </div>
                    )}
                  </div>
                  <div style={{ display:"flex",flexDirection:"column",gap:6 }}>
                    {(showAllRemote?remoteWorkers:remoteWorkers.slice(0,3)).map((w,i)=>(
                      <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:"#f8fafc",borderRadius:10 }}>
                        <div style={{ width:28,height:28,borderRadius:"50%",background:AV_GRADS[i%AV_GRADS.length],display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:12,flexShrink:0 }}>{w.name.charAt(0)}</div>
                        <span style={{ fontSize:12,fontWeight:600,color:C.navy,flex:1,minWidth:0,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{w.name}</span>
                        <span style={{ fontSize:10,color:C.slate,flexShrink:0 }}>{w.department}</span>
                      </div>
                    ))}
                  </div>
                  {remoteWorkers.length>3&&(
                    <button onClick={()=>setShowAllRemote(v=>!v)}
                      style={{ marginTop:8,width:"100%",padding:"6px 0",borderRadius:8,border:`1px solid ${C.green}30`,background:"#f0fdf4",color:C.green,fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"'Manrope',sans-serif" }}>
                      {showAllRemote?"Show less":`Show all ${remoteWorkers.length}`}
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ textAlign:"center",padding:"18px 0",color:C.slate,fontSize:12,background:"#f8fafc",borderRadius:10 }}>No remote workers today</div>
              )}
            </div>

            {/* Birthdays this month */}
            <div className="hrms-card" style={{ background:C.card, borderRadius:18, padding:"20px", border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,.05)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:36,height:36,borderRadius:10,background:"#fff7ed",display:"flex",alignItems:"center",justifyContent:"center",color:"#f97316",fontSize:16 }}>
                    <FaBirthdayCake/>
                  </div>
                  <span style={{ fontSize:14,fontWeight:700,fontFamily:"'Outfit',sans-serif" }}>Birthdays</span>
                </div>
                <span style={{ background:"#fff7ed",color:"#f97316",fontSize:12,fontWeight:700,padding:"3px 10px",borderRadius:20 }}>{monthlyBirthdays.length}</span>
              </div>
              {loadingTeamData ? (
                <div style={{ display:"flex",justifyContent:"center",padding:"16px 0" }}>
                  <div style={{ width:24,height:24,border:"2px solid #f9731630",borderTop:"2px solid #f97316",borderRadius:"50%",animation:"spin .7s linear infinite" }}/>
                </div>
              ) : monthlyBirthdays.length > 0 ? (
                <div style={{ display:"flex",flexDirection:"column",gap:7 }}>
                  {monthlyBirthdays.slice(0,5).map((p,i)=>{
                    const isToday = p.dobDay === new Date().getDate();
                    return (
                      <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:isToday?"#fff7ed":"#f8fafc",borderRadius:10,border:isToday?"1px solid #fed7aa":"1px solid transparent" }}>
                        <div style={{ width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#f97316,#ec4899)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:13,flexShrink:0 }}>{p.name.charAt(0)}</div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontSize:12,fontWeight:600,color:C.navy,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{p.name}</div>
                          <div style={{ fontSize:10,color:C.slate }}>{p.department}</div>
                        </div>
                        <span style={{ fontSize:10,fontWeight:700,color:"#f97316",flexShrink:0 }}>{isToday?"🎉 Today":`${p.dobDay}/${p.dobMonth+1}`}</span>
                      </div>
                    );
                  })}
                  {monthlyBirthdays.length>5&&<div style={{ textAlign:"center",fontSize:11,color:C.slate,paddingTop:4 }}>+{monthlyBirthdays.length-5} more this month</div>}
                </div>
              ) : (
                <div style={{ textAlign:"center",padding:"18px 0",color:C.slate,fontSize:12,background:"#f8fafc",borderRadius:10 }}>No upcoming birthdays</div>
              )}
            </div>
          </div>

          {/* ══ ROW 6: Quick Actions ══ */}
          <div className="hrms-card" style={{ background:C.card, borderRadius:18, padding:"24px", border:`1px solid ${C.border}`, boxShadow:"0 2px 12px rgba(0,0,0,.05)" }}>
            <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <FaConnectdevelop style={{ color:C.indigo, fontSize:16 }}/>
                <h3 style={{ margin:0, fontSize:16, fontWeight:800, fontFamily:"'Outfit',sans-serif" }}>Quick Actions</h3>
              </div>
              <span style={{ fontSize:12, color:C.slate }}>Jump to any section instantly</span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:12 }}>
              {quickActions.map((a,i)=>(
                <button key={i} className="hrms-qa" onClick={()=>navigate(a.to)}
                  style={{ display:"flex",alignItems:"center",gap:12,padding:"13px 15px",background:"#f8fafc",border:`1px solid ${C.border}`,borderRadius:13,cursor:"pointer",textAlign:"left",fontFamily:"'Manrope',sans-serif",width:"100%",transition:"all .18s ease" }}
                  onMouseEnter={e=>{e.currentTarget.style.background="#f0f4ff";e.currentTarget.style.borderColor=a.accent+"60";e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 20px ${a.accent}18`;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="#f8fafc";e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="";}}>
                  <div className="hrms-qa-icon" style={{ width:38,height:38,borderRadius:10,background:a.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",color:a.accent,fontSize:16,flexShrink:0 }}>
                    {a.icon}
                  </div>
                  <span style={{ flex:1,fontSize:13,fontWeight:600,color:C.navy }}>{a.title}</span>
                  <FaAngleRight style={{ color:"#cbd5e1",fontSize:12 }}/>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default AdminDashboard;