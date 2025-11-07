// ...existing imports...
import React, { useContext, useMemo, useState } from "react";
import { CurrentEmployeeAttendanceContext } from "../EmployeeContext/CurrentEmployeeAttendanceContext";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function getMonthOptions(records) {
  const months = records.map((rec) => rec.date.slice(0, 7)); // "YYYY-MM"
  return Array.from(new Set(months)).sort();
}

function getMonthName(monthStr) {
  const [year, month] = monthStr.split("-");
  return `${new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  })} ${year}`;
}

const CalendarCell = ({ day, record }) => {
  let bg = "bg-gray-100";
  let text = "text-gray-700";
  if (record?.status === "Present") {
    bg = "bg-green-100";
    text = "text-green-700";
  } else if (record?.status === "Absent") {
    bg = "bg-red-100";
    text = "text-red-700";
  } else if (record?.status === "Leave") {
    bg = "bg-yellow-100";
    text = "text-yellow-700";
  }else if (record?.status === "Halfday") {
    bg = "bg-orange-100";
    text = "text-orange-700";
  }
  return (
    <td className={`h-28 w-40 align-top ${bg} ${text} border rounded-lg text-base`}>
      <div className="font-bold">{day}</div>
      {record && (
        <div className="text-xs">
          {record.status}
          <br />
          {record.punchIn && <>In: {record.punchIn}<br /></>}
          {record.punchOut && <>Out: {record.punchOut}<br /></>}
        </div>
      )}
    </td>
  );
};


const playRequestSound = () => {
  const audio = new Audio("/sounds/request-button.mp3");
  audio.play();
};



const CurrentEmployeeAttendanceProfile = () => {
  const { attendanceRecords,PermissionRequests, applyPermission ,overtimeRequests, applyOvertime} =
    useContext(CurrentEmployeeAttendanceContext);


  // Only for EMP101 (demo)
  const employeeId = "EMP101";
const employeeRecords = (attendanceRecords || []).filter((rec) => rec.employeeId === employeeId);

  // Monthly filter for attendance
  const monthOptions = getMonthOptions(employeeRecords);
  const [selectedMonth, setSelectedMonth] = useState(
    monthOptions[monthOptions.length - 1] || ""
  );

  
  const monthlyRecords = useMemo(() => {
  return employeeRecords.filter((rec) => rec.date.startsWith(selectedMonth));
}, [employeeRecords, selectedMonth]);


  const presentCount = monthlyRecords.filter((r) => r.status === "Present").length;
  const absentCount = monthlyRecords.filter((r) => r.status === "Absent").length;
  const halfdayCount = monthlyRecords.filter((r) => r.status === "Halfday").length;
  const leaveCount = monthlyRecords.filter((r) => r.status === "Leave").length;

  

  // Chart data
  const chartData = {
    labels: ["Present", "Absent", "Leave","Halfday"],
    datasets: [
      {
        label: "Monthly Attendance Summary",
        data: [presentCount, absentCount, leaveCount,halfdayCount],
        backgroundColor: ["#22c55e", "#ef4444", "#facc15","#fb923c"],
      },
    ],
  };

  // Calendar view toggle
  const [calendarView, setCalendarView] = useState(false);

  // Calendar grid
  const daysInMonth = selectedMonth
    ? new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)), 0).getDate()
    : 0;
  const firstDayOfWeek = selectedMonth
    ? new Date(Number(selectedMonth.slice(0, 4)), Number(selectedMonth.slice(5, 7)) - 1, 1).getDay()
    : 0;

  // Build calendar rows
  const calendarRows = [];
  let day = 1 - firstDayOfWeek;
  while (day <= daysInMonth) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      if (day > 0 && day <= daysInMonth) {
        const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
        const record = monthlyRecords.find((r) => r.date === dateStr);
        row.push(<CalendarCell key={i} day={day} record={record} />);
      } else {
        row.push(<td key={i} className="h-20 w-32 bg-white"></td>);
      }
      day++;
    }
    calendarRows.push(<tr key={day}>{row}</tr>);
  }



  // ========== OVERTIME UI STATE ==========
const [showOvertimeForm, setShowOvertimeForm] = useState(false);
const [OvertimeForm, setOvertimeForm] = useState({
  date: "",
  type: "INCENTIVE_OT",
  is_paid_out: false,
  is_used_as_leave: false,
});
const [OvertimeError, setOvertimeError] = useState("");
const [overtimeSuccess, setOvertimeSuccess] = useState("");

const [OvertimeMonth, setOvertimeMonth] = useState("");
const [OvertimeStatus, setOvertimeStatus] = useState("");
const overtimeStatusOptions = ["All", "PENDING", "APPROVED", "REJECTED"];
const overtimeTypeOptions = ["INCENTIVE_OT", "PENDING_OT"];

const handleOvertimeChange = (e) => {
  const { name, type, value, checked } = e.target;
  setOvertimeForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  setOvertimeError("");
  setOvertimeSuccess("");
};

const handleOvertimeSubmit = async (e) => {
  e.preventDefault();
  const { date, type, is_paid_out, is_used_as_leave } = OvertimeForm;
  if (!date || !type) {
    setOvertimeError("Date and type are required.");
    setOvertimeSuccess("");
    return;
  }

  try {
    await applyOvertime({ date, type, is_paid_out, is_used_as_leave });
    setOvertimeForm({ date: "", type: "INCENTIVE_OT", is_paid_out: false, is_used_as_leave: false });
    setOvertimeError("");

    playRequestSound();
    setOvertimeSuccess("Overtime request submitted successfully!");
    setTimeout(() => setOvertimeSuccess(""), 3000);
  } catch (err) {
    setOvertimeError("Failed to submit overtime request. Try again.");
  }
};

// filtered list of overtimes for UI table
const filteredOvertimes = (overtimeRequests || []).filter((req) => {
  const matchesMonth = OvertimeMonth ? req.date.startsWith(OvertimeMonth) : true;
  const matchesStatus = OvertimeStatus && OvertimeStatus !== "All" ? req.status === OvertimeStatus : true;
  return matchesMonth && matchesStatus;
});

// helper to display 0x01/0x00 / booleans
const flagToYesNo = (v) => (v === 0x01 || v === 1 || v === true || v === "1" ? "Yes" : "No");




  // ===================== PERMISSION HOURS (Late Permissions UI) =====================
  // Local UI state (moved from Leave Management)
  const [showPermissionForm, setshowPermissionForm] = useState(false);
  const [PermissionForm, setPermissionForm] = useState({ date: "", from_time: "", to_time: "", reason: "" });
  const [PermissionError, setPermissionError] = useState("");
  const [permissionSuccess, setpermissionSuccess] = useState("");

  // Filters (re-using monthOptions from attendance, and local status options)
  const [PermissionMonth, setPermissionMonth] = useState("");
  const [PermissionStatus, setPermissionStatus] = useState("");
  const statusOptions = ["All", "Pending", "Approved", "Rejected"];

  const filteredLateLogins = (PermissionRequests || []).filter((req) => {
  const matchesMonth = PermissionMonth ? req.date.startsWith(PermissionMonth) : true;
  const matchesStatus = PermissionStatus && PermissionStatus !== "All" ? req.status === PermissionStatus : true;
  return matchesMonth && matchesStatus;
});


  const handlePermissionChange = (e) => {
    setPermissionForm({ ...PermissionForm, [e.target.name]: e.target.value });
    setPermissionError("");
    setpermissionSuccess("");
  };

  const handlePermissionSubmit = async (e) => {
  e.preventDefault();
  const { date, from_time, to_time, reason } = PermissionForm;

  if (!date || !from_time || !to_time || !reason) {
    setPermissionError("All fields are required.");
    setpermissionSuccess("");
    return;
  }

  try {
    await applyPermission({ date, from_time, to_time, reason });
    setPermissionForm({ date: "", from_time: "", to_time: "", reason: "" });
    setPermissionError("");

    playRequestSound();
    setpermissionSuccess("Permission hours submitted successfully!");
    setTimeout(() => setpermissionSuccess(""), 3000);
  } catch (err) {
    setPermissionError("Failed to submit permission request. Try again.");
  }
};


  // =========================================================================



      {/* ================= Permission Hours Section (moved here) ================= */}
      <div className="mb-10 mt-10">
        <div className="flex flex-wrap gap-6 items-center mb-6">
          <h2 className="text-3xl font-bold text-yellow-800 flex-1">Permission Hours</h2>
          <button
            className={`bg-blue-700 hover:bg-blue-900 text-white font-semibold px-6 py-2 rounded-lg shadow transition ${showPermissionForm ? 'bg-blue-900' : ''}`}
            onClick={() => setshowPermissionForm((v) => !v)}
          >
            {showPermissionForm ? "Cancel" : "Permission Hours"}
          </button>
        </div>

        {showPermissionForm && (
          <form
            onSubmit={handlePermissionSubmit}
            className="mb-8 bg-white rounded-lg shadow-md p-6 flex flex-col gap-4 border border-blue-100 max-w-xl"
          >
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block mb-1 font-medium text-yellow-800">Date of Late Login</label>
                <input
                  type="date"
                  name="date"
                  value={PermissionForm.date}
                  onChange={handlePermissionChange}
                  className="w-full border border-yellow-300 rounded px-3 py-2 focus:outline-yellow-500"
                />
              </div>
              <div className="flex-1">
                <label className="block mb-1 font-medium text-yellow-800">From (Time)</label>
                <input
                  type="time"
                  name="from_time"
                  value={PermissionForm.from_time}
                  onChange={handlePermissionChange}
                  className="w-full border border-yellow-300 rounded px-3 py-2 focus:outline-yellow-500"
                />
              </div>
              <div className="flex-1">
                <label className="block mb-1 font-medium text-yellow-800">To (Time)</label>
                <input
                  type="time"
                  name="to_time"
                  value={PermissionForm.to_time}
                  onChange={handlePermissionChange}
                  className="w-full border border-yellow-300 rounded px-3 py-2 focus:outline-yellow-500"
                />
              </div>
            </div>
            <div>
              <label className="block mb-1 font-medium text-yellow-800">Reason</label>
              <input
                type="text"
                name="reason"
                value={PermissionForm.reason}
                onChange={handlePermissionChange}
                className="w-full border border-yellow-300 rounded px-3 py-2 focus:outline-yellow-500"
                placeholder="Enter reason for late login"
              />
            </div>
            {PermissionError && <div className="text-red-600 font-semibold">{PermissionError}</div>}
            {permissionSuccess && <div className="text-green-600 font-semibold">{permissionSuccess}</div>}
            <button
              type="submit"
              className="bg-blue-700 hover:bg-blue-900 text-white font-semibold px-6 py-2 rounded-lg shadow transition mt-2"
            >
              Submit Permission Hours
            </button>
          </form>
        )}

        {/* Filters for late permissions */}
        <div className="flex flex-wrap gap-6 items-center mb-4">
          <div>
            <label className="mr-2 font-medium text-yellow-800">Filter by Month:</label>
            <select
              value={PermissionMonth}
              onChange={(e) => setPermissionMonth(e.target.value)}
              className="border border-yellow-300 rounded px-3 py-2 bg-white focus:outline-yellow-500"
            >
              <option value="">All</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {getMonthName(month)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mr-2 font-medium text-yellow-800">Status:</label>
            <select
              value={PermissionStatus}
              onChange={(e) => setPermissionStatus(e.target.value)}
              className="border border-yellow-300 rounded px-3 py-2 bg-white focus:outline-yellow-500"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Late permissions table */}
        <table className="min-w-full bg-white rounded shadow border border-yellow-200">
          <thead className="bg-yellow-100">
            <tr>
              <th className="w-32 px-4 py-2 text-yellow-900">Date</th>
              <th className="w-32 px-4 py-2 text-yellow-900">From</th>
              <th className="w-32 px-4 py-2 text-yellow-900">To</th>
              <th className="w-48 px-4 py-2 text-yellow-900">Reason</th>
              <th className="w-32 px-4 py-2 text-yellow-900">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLateLogins.length > 0 ? (
              filteredLateLogins.map((req) => (
                <tr key={req.id} className="hover:bg-yellow-50 transition">
                  <td className="w-32 px-4 py-2">{req.date}</td>
                  <td className="w-32 px-4 py-2">{req.from_time}</td>
                  <td className="w-32 px-4 py-2">{req.to_time || "-"}</td>
                  <td className="w-48 px-4 py-2">{req.reason}</td>
                  <td className="w-32 px-4 py-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        req.status === "Pending"
                          ? "bg-yellow-200 text-yellow-800"
                          : req.status === "Approved"
                          ? "bg-green-200 text-green-800"
                          : req.status === "Rejected"
                          ? "bg-red-200 text-red-800"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-2 text-center text-gray-400">
                  No late login requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* ================= End Permission Hours ================= */}    

      

  


  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Current Employee Attendance Profile</h1>

      {/* Month filter */}
      <div className="mb-4 flex flex-wrap gap-4 items-center">
        <label className="font-semibold">Select Month:</label>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border px-4 py-2 rounded"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {getMonthName(m)}
            </option>
          ))}
        </select>
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          onClick={() => setCalendarView((v) => !v)}
        >
          {calendarView ? "Table View" : "Calendar View"}
        </button>
      </div>

      {/* Bar graph */}
      <div className="mb-6 max-w-lg">
        <Bar
          data={chartData}
          options={{
            responsive: true,
            plugins: {
              legend: { display: false },
              title: { display: true, text: "Monthly Attendance Summary" },
            },
            scales: {
              y: { beginAtZero: true, precision: 0 },
            },
          }}
        />
      </div>

      {/* Summary boxes */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 p-4 rounded shadow flex flex-col items-center">
          <span className="text-green-600 font-bold text-lg">Present</span>
          <span className="text-2xl font-bold">{presentCount}</span>
        </div>
        <div className="bg-red-50 p-4 rounded shadow flex flex-col items-center">
          <span className="text-red-600 font-bold text-lg">Absent</span>
          <span className="text-2xl font-bold">{absentCount}</span>
        </div>
        <div className="bg-yellow-50 p-4 rounded shadow flex flex-col items-center">
          <span className="text-yellow-600 font-bold text-lg">On Leave</span>
          <span className="text-2xl font-bold">{leaveCount}</span>
        </div>
        <div className="bg-yellow-50 p-4 rounded shadow flex flex-col items-center">
          <span className="text-yellow-600 font-bold text-lg">Half-Day</span>
          <span className="text-2xl font-bold">{halfdayCount}</span>
        </div>
      </div>

      {/* ================= Permission Hours Section (moved here) ================= */}
      <div className="mb-10 mt-10">
        <div className="flex flex-wrap gap-6 items-center mb-6">
          <h2 className="text-3xl font-bold text-yellow-800 flex-1">Permission Hours</h2>
          <button
            className={`bg-blue-700 hover:bg-blue-900 text-white font-semibold px-6 py-2 rounded-lg shadow transition ${showPermissionForm ? 'bg-blue-900' : ''}`}
            onClick={() => setshowPermissionForm((v) => !v)}
          >
            {showPermissionForm ? "Cancel" : "Permission Hours"}
          </button>
        </div>

        {showPermissionForm && (
          <form
            onSubmit={handlePermissionSubmit}
            className="mb-8 bg-white rounded-lg shadow-md p-6 flex flex-col gap-4 border border-blue-100 max-w-xl"
          >
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block mb-1 font-medium text-yellow-800">Date of Late Login</label>
                <input
                  type="date"
                  name="date"
                  value={PermissionForm.date}
                  onChange={handlePermissionChange}
                  className="w-full border border-yellow-300 rounded px-3 py-2 focus:outline-yellow-500"
                />
              </div>
              <div className="flex-1">
                <label className="block mb-1 font-medium text-yellow-800">From (Time)</label>
                <input
                  type="time"
                  name="from_time"
                  value={PermissionForm.from_time}
                  onChange={handlePermissionChange}
                  className="w-full border border-yellow-300 rounded px-3 py-2 focus:outline-yellow-500"
                />
              </div>
              <div className="flex-1">
                <label className="block mb-1 font-medium text-yellow-800">To (Time)</label>
                <input
                  type="time"
                  name="to_time"
                  value={PermissionForm.to_time}
                  onChange={handlePermissionChange}
                  className="w-full border border-yellow-300 rounded px-3 py-2 focus:outline-yellow-500"
                />
              </div>
            </div>
            <div>
              <label className="block mb-1 font-medium text-yellow-800">Reason</label>
              <input
                type="text"
                name="reason"
                value={PermissionForm.reason}
                onChange={handlePermissionChange}
                className="w-full border border-yellow-300 rounded px-3 py-2 focus:outline-yellow-500"
                placeholder="Enter reason for late login"
              />
            </div>
            {PermissionError && <div className="text-red-600 font-semibold">{PermissionError}</div>}
            {permissionSuccess && <div className="text-green-600 font-semibold">{permissionSuccess}</div>}
            <button
              type="submit"
              className="bg-blue-700 hover:bg-blue-900 text-white font-semibold px-6 py-2 rounded-lg shadow transition mt-2"
            >
              Submit Permission Hours
            </button>
          </form>
        )}

        {/* Filters for late permissions */}
        <div className="flex flex-wrap gap-6 items-center mb-4">
          <div>
            <label className="mr-2 font-medium text-yellow-800">Filter by Month:</label>
            <select
              value={PermissionMonth}
              onChange={(e) => setPermissionMonth(e.target.value)}
              className="border border-yellow-300 rounded px-3 py-2 bg-white focus:outline-yellow-500"
            >
              <option value="">All</option>
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {getMonthName(month)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mr-2 font-medium text-yellow-800">Status:</label>
            <select
              value={PermissionStatus}
              onChange={(e) => setPermissionStatus(e.target.value)}
              className="border border-yellow-300 rounded px-3 py-2 bg-white focus:outline-yellow-500"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Late permissions table */}
        <table className="min-w-full bg-white rounded shadow border border-yellow-200">
          <thead className="bg-yellow-100">
            <tr>
              <th className="w-32 px-4 py-2 text-yellow-900">Date</th>
              <th className="w-32 px-4 py-2 text-yellow-900">From</th>
              <th className="w-32 px-4 py-2 text-yellow-900">To</th>
              <th className="w-48 px-4 py-2 text-yellow-900">Reason</th>
              <th className="w-32 px-4 py-2 text-yellow-900">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLateLogins.length > 0 ? (
              filteredLateLogins.map((req) => (
                <tr key={req.id} className="hover:bg-yellow-50 transition">
                  <td className="w-32 px-4 py-2 text-center">{req.date}</td>
                  <td className="w-32 px-4 py-2 text-center">{req.from_time}</td>
                  <td className="w-32 px-4 py-2 text-center">{req.to_time || "-"}</td>
                  <td className="w-48 px-4 py-2 text-center">{req.reason}</td>
                  <td className="w-32 px-4 py-2 text-center">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        req.status === "Pending"
                          ? "bg-yellow-200 text-yellow-800"
                          : req.status === "Approved"
                          ? "bg-green-200 text-green-800"
                          : req.status === "Rejected"
                          ? "bg-red-200 text-red-800"
                          : "bg-gray-200 text-gray-800"
                      }`}
                    >
                      {req.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-2 text-center text-gray-400">
                  No late login requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* ================= End Permission Hours ================= */}    



      {/* ================= OVERTIME REQUESTS (now below Permission Hours) ================= */}
      <div className="mt-8">
        <div className="flex flex-wrap gap-6 items-center mb-4">
          <h2 className="text-2xl font-bold text-yellow-800 flex-1">Overtime Requests</h2>
          <button
            className={`bg-indigo-600 hover:bg-indigo-800 text-white font-semibold px-5 py-2 rounded-lg shadow transition ${showOvertimeForm ? 'bg-indigo-800' : ''}`}
            onClick={() => setShowOvertimeForm((v) => !v)}
          >
            {showOvertimeForm ? "Cancel OT" : "New Overtime"}
          </button>
        </div>

        {showOvertimeForm && (
          <form onSubmit={handleOvertimeSubmit} className="mb-6 bg-white rounded-lg shadow-md p-6 border border-gray-100 max-w-xl">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block mb-1 font-medium">Date (OT Date)</label>
                <input type="date" name="date" value={OvertimeForm.date} onChange={handleOvertimeChange}
                       className="w-full border rounded px-3 py-2" />
              </div>

              <div className="flex-1">
                <label className="block mb-1 font-medium">Type</label>
                <select name="type" value={OvertimeForm.type} onChange={handleOvertimeChange} className="w-full border rounded px-3 py-2">
                  {overtimeTypeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            

            {OvertimeError && <div className="text-red-600 font-semibold mt-2">{OvertimeError}</div>}
            {overtimeSuccess && <div className="text-green-600 font-semibold mt-2">{overtimeSuccess}</div>}

            <div className="mt-4">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-800 text-white px-5 py-2 rounded-lg shadow">Submit Overtime</button>
            </div>
          </form>
        )}

        {/* Overtime filters */}
        <div className="flex flex-wrap gap-6 items-center mb-4">
          <div>
            <label className="mr-2 font-medium">Filter by Month:</label>
            <select value={OvertimeMonth} onChange={(e) => setOvertimeMonth(e.target.value)} className="border rounded px-3 py-2">
              <option value="">All</option>
              {monthOptions.map(m => <option key={m} value={m}>{getMonthName(m)}</option>)}
            </select>
          </div>

          <div>
            <label className="mr-2 font-medium">Status:</label>
            <select value={OvertimeStatus} onChange={(e) => setOvertimeStatus(e.target.value)} className="border rounded px-3 py-2">
              {overtimeStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Overtime table */}
        {/* Overtime table */}
{/* Overtime table */}
<table className="min-w-full bg-white rounded shadow border border-yellow-200">
  <thead className="bg-yellow-100">
    <tr>
      <th className="px-4 py-2 text-yellow-900 text-center">Date</th>
      <th className="px-4 py-2 text-yellow-900 text-left">Type</th>
      <th className="px-4 py-2 text-yellow-900 text-center">Paid Out</th>
      <th className="px-4 py-2 text-yellow-900 text-center">Used as Leave</th>
      <th className="px-4 py-2 text-yellow-900 text-left">Status</th>
    </tr>
  </thead>
  <tbody>
    {filteredOvertimes.length > 0 ? (
      filteredOvertimes.map((ot) => (
        <tr key={ot.id} className="hover:bg-yellow-50 transition">
          <td className="px-4 py-2 text-center">{ot.date}</td>
          <td className="px-4 py-2 text-left">{ot.type}</td>
          <td className="px-4 py-2 text-center">{flagToYesNo(ot.is_paid_out)}</td>
          <td className="px-4 py-2 text-center">{flagToYesNo(ot.is_used_as_leave)}</td>
          <td className="px-4 py-2 text-left">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold ${
                ot.status === "PENDING"
                  ? "bg-yellow-200 text-yellow-800"
                  : ot.status === "APPROVED"
                  ? "bg-green-200 text-green-800"
                  : ot.status === "REJECTED"
                  ? "bg-red-200 text-red-800"
                  : "bg-gray-200 text-gray-800"
              }`}
            >
              {ot.status}
            </span>
          </td>
        </tr>
      ))
    ) : (
      <tr>
        <td colSpan={5} className="px-4 py-2 text-center text-gray-400">
          No overtime requests found.
        </td>
      </tr>
    )}
  </tbody>
</table>


      </div>

      <div className="mt-8 mb-10">
  
</div>
      {/* ================= End OVERTIME REQUESTS ================= */}


      {/* Calendar view */}
      {/* Calendar/Table view */}
      {calendarView ? (
        <div className="overflow-x-auto mb-8">
          <table className="bg-white rounded-xl shadow min-w-max">
            <thead>
              <tr>
                <th className="p-4 text-center text-lg">Sun</th>
                <th className="p-4 text-center text-lg">Mon</th>
                <th className="p-4 text-center text-lg">Tue</th>
                <th className="p-4 text-center text-lg">Wed</th>
                <th className="p-4 text-center text-lg">Thu</th>
                <th className="p-4 text-center text-lg">Fri</th>
                <th className="p-4 text-center text-lg">Sat</th>
              </tr>
            </thead>
            <tbody>{calendarRows}</tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded-xl shadow">
            <thead>
              <tr>
                <th className="border px-4 py-2">Date</th>
                <th className="border px-4 py-2">Status</th>
                <th className="border px-4 py-2">Punch In</th>
                <th className="border px-4 py-2">Punch Out</th>
                <th className="border px-4 py-2">Work Hours</th>
                <th className="border px-4 py-2">Worked Hours</th>
                <th className="border px-4 py-2">Idle Time</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRecords.length > 0 ? (
                monthlyRecords.map((record) => (
                  <tr
                    key={record.id}
                    className={
                      record.status === "Leave"
                        ? "bg-yellow-100"
                        : record.status === "Absent"
                        ? "bg-red-100"
                        : record.status === "Halfday"
                        ? "bg-orange-100"
                        : "hover:bg-green-50"

                    }
                  >
                    <td className="border px-4 py-2">{record.date}</td>
                    <td className="border px-4 py-2">{record.status}</td>
                    <td className="border px-4 py-2">{record.punchIn}</td>
                    <td className="border px-4 py-2">{record.punchOut}</td>
                    <td className="border px-4 py-2">{record.workHours}</td>
                    <td className="border px-4 py-2">{record.workedHours}</td>
                    <td className="border px-4 py-2">{record.idleTime}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="border px-4 py-2 text-center text-gray-500">
                    No attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CurrentEmployeeAttendanceProfile;
