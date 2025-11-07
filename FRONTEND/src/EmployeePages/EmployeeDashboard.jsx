import React, { useContext, useState, useEffect } from "react";
import axios from "axios";
import { NoticeContext } from "../context/NoticeContext";
import { Bar, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { FaRegClock, FaUserCircle, FaBell, FaCalendarAlt, FaChartPie } from "react-icons/fa";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

function formatTime(time) {
  if (!time) return "--";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${ampm}`;
}

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

const EmployeeDashboard = () => {
  const { notices } = useContext(NoticeContext);
  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(true);

  // States for punch in / punch out
  const [punchedIn, setPunchedIn] = useState(false);
  const [punchInTime, setPunchInTime] = useState("");
  const [punchOutTime, setPunchOutTime] = useState("");

  const todayStr = getTodayStr();
  const loggedUser = JSON.parse(localStorage.getItem("hrmsUser"));
  const loggedEmail = loggedUser?.email;

  // ✅ Fetch employee details from backend
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await axios.get("http://localhost:5000/employees");
        const emp = res.data.find((e) => e.email === loggedEmail);
        setEmployeeData(emp || null);
      } catch (err) {
        console.error("Error fetching employee:", err);
      } finally {
        setLoading(false);
      }
    };

    if (loggedEmail) fetchEmployee();
  }, [loggedEmail]);

  const playPunchInSound = () => new Audio("/sounds/punched-in.mp3").play();
  const playPunchOutSound = () => new Audio("/sounds/punch-out.mp3").play();

 const handlePunchIn = async () => {
  if (!punchedIn) {
    const timeStr = new Date().toTimeString().slice(0, 5);

    try {
      const res = await axios.post("http://localhost:5000/attendance/punch-in", {
        employeeId: employeeId,
        punchIn: timeStr
      });

      console.log("Punch In Success:", res.data);

      setPunchInTime(timeStr);
      setPunchedIn(true);
      playPunchInSound();
    } catch (err) {
      console.error("Punch In error:", err.response?.data || err.message);
      alert("Failed to Punch In: " + (err.response?.data?.message || err.message));
    }
  }
};



const handlePunchOut = async () => {
  if (punchedIn && !punchOutTime) {
    const timeStr = new Date().toTimeString().slice(0, 5);

    try {
      const res = await axios.post("http://localhost:5000/attendance/punch-out", {
        employeeId: employeeId,
        punchOut: timeStr
      });

      console.log("Punch Out Success:", res.data);

      setPunchOutTime(timeStr);
      playPunchOutSound();
    } catch (err) {
      console.error("Punch Out error:", err.response?.data || err.message);
      alert("Failed to Punch Out: " + (err.response?.data?.message || err.message));
    }
  }
};





  // ✅ Loading State
  if (loading) {
    return <div className="p-8 text-center text-lg font-semibold">Loading Employee Dashboard...</div>;
  }

  // ✅ If employee not found
  if (!employeeData) {
    return <div className="p-8 text-center text-red-600 font-semibold">Employee Data Not Found</div>;
  }

  // ✅ Extract fields from backend data
  const { name, email, phone, employeeId, currentDepartment, currentRole } = employeeData;

  const leaveBarData = {
    labels: ["Full Day", "Half Day", "Sandwich"],
    datasets: [
      {
        label: "Leaves",
        data: [2, 1, 0], // dummy for now
        backgroundColor: ["#22c55e", "#facc15", "#3b82f6"],
        borderRadius: 6,
      },
    ],
  };

  const workPieData = {
    labels: ["Worked Hours", "Idle Time"],
    datasets: [
      {
        data: [150, 10], // static for now
        backgroundColor: ["#3b82f6", "#f87171"],
      },
    ],
  };

  return (
    <div className="p-4 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen">
      {/* Profile Section */}
      <div className="flex flex-col md:flex-row items-center bg-gradient-to-r from-blue-100 to-blue-50 rounded-2xl shadow-lg p-6 mb-8 gap-6">
        <div className="flex-shrink-0">
          <img
            alt="Employee"
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff&size=128`}
            className="w-28 h-28 rounded-full border-4 border-white shadow"
          />
        </div>
        <div className="flex-1">
          <h3 className="text-2xl font-bold text-blue-900 flex items-center gap-2">
            <FaUserCircle className="text-blue-400" /> {name}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700 mt-2">
            <div><b>ID:</b> {employeeId}</div>
            <div><b>Department:</b> {currentDepartment}</div>
            <div><b>Designation:</b> {currentRole}</div>
            <div><b>Email:</b> {email}</div>
            <div><b>Phone:</b> {phone}</div>
          </div>
        </div>
      </div>

      {/* Daily Checkin */}
      <div className="bg-white rounded-2xl shadow p-6 mb-8">
        <div className="flex items-center mb-4 gap-2">
          <FaRegClock className="text-blue-600" />
          <h2 className="font-bold text-xl">Daily Check-in</h2>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-blue-50 text-blue-900">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Punch In</th>
              <th className="px-3 py-2">Punch Out</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="text-center">
              <td>{todayStr}</td>
              <td>{formatTime(punchInTime)}</td>
              <td>{formatTime(punchOutTime)}</td>
              <td>{!punchedIn ? "Not Started" : punchOutTime ? "Completed" : "Working"}</td>
              <td>
                {!punchedIn ? (
                  <button className="bg-green-600 text-white px-3 py-1 rounded" onClick={handlePunchIn}>
                    Punch In
                  </button>
                ) : !punchOutTime ? (
                  <button className="bg-red-600 text-white px-3 py-1 rounded" onClick={handlePunchOut}>
                    Punch Out
                  </button>
                ) : (
                  "Done"
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-bold flex items-center gap-2 mb-2">
            <FaCalendarAlt className="text-blue-500" /> Leave Summary
          </h2>
          <Bar data={leaveBarData} />
        </div>
        <div className="bg-white rounded-2xl shadow p-4">
          <h2 className="font-bold flex items-center gap-2 mb-2">
            <FaChartPie className="text-yellow-500" /> Work Hours
          </h2>
          <Pie data={workPieData} />
        </div>
      </div>

      {/* Notice Board */}
      <div className="bg-white rounded-2xl shadow p-4 mb-8">
        <h2 className="font-bold flex items-center gap-2 mb-2">
          <FaBell className="text-red-500" /> Notice Board
        </h2>
        {notices?.length ? (
          <ul className="space-y-2">
            {notices.map((n, i) => (
              <li key={i} className="border-b pb-2">
                <b>{n.title}</b> - {n.description}
              </li>
            ))}
          </ul>
        ) : (
          "No Notices"
        )}
      </div>
    </div>
  );
};

export default EmployeeDashboard;
