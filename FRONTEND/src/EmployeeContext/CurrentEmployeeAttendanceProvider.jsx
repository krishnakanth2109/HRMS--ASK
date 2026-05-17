// ✅ CurrentEmployeeAttendanceProvider.jsx (FINAL CLEAN VERSION)
import { useState, useEffect } from "react";
import api from "../api"; // ✅ Use the shared axios instance
import { CurrentEmployeeAttendanceContext } from "./CurrentEmployeeAttendanceContext";

const API_PREFIX = "/api";

const CurrentEmployeeAttendanceProvider = ({ children }) => {
  // ✅ Logged user — read from sessionStorage (where auth data is stored)
  const loggedUser = JSON.parse(sessionStorage.getItem("hrmsUser") || localStorage.getItem("hrmsUser") || "null");
  const employeeId = loggedUser?.employeeId; // ✅ Use exact value (EMP101)

  // ✅ Manual (dummy) attendance for fallback
  const manualAttendance = [];

  // ✅ States
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [PermissionRequests, setPermissionRequests] = useState([]);
  const [overtimeRequests, setOvertimeRequests] = useState([]);

  // ✅ Update single attendance row
  const updateAttendanceRecord = (id, updates) => {
    setAttendanceRecords((prev) =>
      prev.map((rec) => {
        if (rec.id !== id) return rec;

        const updated = { ...rec, ...updates };

        // ✅ Auto-mark manual approval
        if (
          (updates.actualPunchIn && updates.actualPunchIn !== rec.actualPunchIn) ||
          (updates.actualPunchOut && updates.actualPunchOut !== rec.actualPunchOut)
        ) {
          updated.manualApproval = 0x01;
        }

        // ✅ Auto-calculate idle time
        if (updates.workedHours !== undefined) {
          updated.idleTime = Math.max(
            0,
            (updated.workHours || 0) - updates.workedHours
          );
        }

        return updated;
      })
    );
  };

  // ✅ Fetch Attendance
  const fetchAttendance = async () => {
    if (!employeeId) {
      setAttendanceRecords(manualAttendance);
      return;
    }

    try {
      const res = await api.get(`${API_PREFIX}/attendance/${employeeId}`);

      if (res.data && Array.isArray(res.data.data)) {
        const formatted = res.data.data.map((rec, index) => ({
          id: rec._id || index + 1,
          employeeId: rec.employeeId,
          name: rec.name || "Employee",
          date: rec.date,
          status: rec.status || "Present",
          punchIn: rec.punchIn || "",
          punchOut: rec.punchOut || "",
          actualPunchIn: rec.actualPunchIn || "",
          actualPunchOut: rec.actualPunchOut || "",
          workHours: rec.workHours || 0,
          workedHours: rec.workedHours || 0,
          idleTime: rec.idleTime || 0,
          isHalfDay: rec.isHalfDay ?? 0x00,
          isLateLogin: rec.isLateLogin ?? 0x00,
          isOtDay: rec.isOtDay ?? 0x00,
          manualApproval: rec.manualApproval ?? 0x00,
        }));

        setAttendanceRecords(formatted);
      } else {
        setAttendanceRecords(manualAttendance);
      }
    } catch (err) {
      console.warn("ℹ️ Attendance fetch failed (likely no records yet or API mismatch):", err.message);
      setAttendanceRecords(manualAttendance);
    }
  };

  // ✅ Fetch Permission Requests
  const fetchPermissions = async () => {
    if (!employeeId) {
      setPermissionRequests([]);
      return;
    }
    try {
      const res = await api.get(`${API_PREFIX}/permissions/${employeeId}`);
      setPermissionRequests(res.data?.length ? res.data : []);
    } catch (err) {
      // Gracefully handle 404 since this route might not be implemented in backend yet
      if (err.response?.status === 404) {
        console.info("ℹ️ Permissions route not yet available in backend.");
      } else {
        console.error("❌ Permission fetch failed:", err.message);
      }
      setPermissionRequests([]);
    }
  };

  // ✅ Fetch Overtime Requests
  const fetchOvertime = async () => {
    if (!employeeId) {
      setOvertimeRequests([]);
      return;
    }
    try {
      const res = await api.get(`${API_PREFIX}/overtime/${employeeId}`);
      setOvertimeRequests(res.data?.length ? res.data : []);
    } catch (err) {
      console.warn("ℹ️ Overtime fetch failed:", err.message);
      setOvertimeRequests([]);
    }
  };

  // ✅ On Employee Login Change → Load All Data
  useEffect(() => {
    if (employeeId) {
      fetchAttendance();
      fetchPermissions();
      fetchOvertime();
    }
  }, [employeeId]);

  return (
    <CurrentEmployeeAttendanceContext.Provider
      value={{
        attendanceRecords,
        updateAttendanceRecord,
        PermissionRequests,
        overtimeRequests,
      }}
    >
      {children}
    </CurrentEmployeeAttendanceContext.Provider>
  );
};

export default CurrentEmployeeAttendanceProvider;
