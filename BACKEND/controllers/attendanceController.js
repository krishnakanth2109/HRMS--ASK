// --- START OF FILE controllers/attendanceController.js ---

import Attendance from "../models/Attendance.js";

// Helper to get today's date in YYYY-MM-DD format
const getToday = () => new Date().toISOString().split("T")[0];

// Helper to calculate work duration
const calcWork = (start, end) => {
  const diffMs = new Date(end) - new Date(start);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return {
    floatHours: diffMs / (1000 * 60 * 60),
    displayTime: `${hours}h ${minutes}m`,
  };
};

// ✅ PUNCH IN: Securely uses the authenticated user's ID and name
export const punchIn = async (req, res) => {
  try {
    const { employeeId, name: employeeName } = req.user;
    const today = getToday();
    const punchInTime = new Date();

    const lateCutoff = new Date();
    lateCutoff.setHours(10, 15, 0, 0);
    const loginStatus = punchInTime > lateCutoff ? "LATE" : "ON_TIME";

    let record = await Attendance.findOne({ employeeId });
    if (!record) {
      record = new Attendance({ employeeId, employeeName, attendance: [] });
    }

    let todayEntry = record.attendance.find((a) => a.date === today);
    if (todayEntry?.punchIn) {
      return res.status(200).json({ message: "Already punched in", attendance: record.attendance });
    }

    if (!todayEntry) {
      record.attendance.push({
        date: today,
        punchIn: punchInTime,
        status: "WORKING",
        loginStatus: loginStatus,
      });
    } else {
      todayEntry.punchIn = punchInTime;
      todayEntry.status = "WORKING";
      todayEntry.loginStatus = loginStatus;
    }

    await record.save();
    res.status(200).json({ message: "Punch In successful", attendance: record.attendance });
  } catch (err) {
    console.error("Punch-in error:", err);
    res.status(500).json({ message: "Server error during punch-in." });
  }
};

// ✅ PUNCH OUT: Securely uses the authenticated user's ID
export const punchOut = async (req, res) => {
  try {
    const { employeeId } = req.user;
    const today = getToday();

    let record = await Attendance.findOne({ employeeId });
    if (!record) return res.status(400).json({ message: "No attendance record found. Please punch in first." });

    const todayEntry = record.attendance.find((a) => a.date === today);
    if (!todayEntry?.punchIn) return res.status(400).json({ message: "You have not punched in today." });
    if (todayEntry.punchOut) return res.status(200).json({ message: "Already punched out", attendance: record.attendance });

    todayEntry.punchOut = new Date();
    todayEntry.status = "COMPLETED";

    const work = calcWork(todayEntry.punchIn, todayEntry.punchOut);
    todayEntry.workedHours = work.floatHours;
    todayEntry.displayTime = work.displayTime;

    if (work.floatHours >= 7) todayEntry.attendanceCategory = "FULL_DAY";
    else if (work.floatHours >= 4) todayEntry.attendanceCategory = "HALF_DAY";
    else todayEntry.attendanceCategory = "ABSENT";

    await record.save();
    res.status(200).json({ message: "Punch Out successful", attendance: record.attendance });
  } catch (err) {
    console.error("Punch-out error:", err);
    res.status(500).json({ message: "Server error during punch-out." });
  }
};

// ✅ GET ATTENDANCE: Securely gets attendance for ONLY the logged-in employee
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user;
    const record = await Attendance.findOne({ employeeId });
    if (!record) return res.status(200).json([]);
    
    res.status(200).json(record.attendance);
  } catch (err) {
    console.error("Get attendance error:", err);
    res.status(500).json({ message: "Server error while fetching attendance." });
  }
};