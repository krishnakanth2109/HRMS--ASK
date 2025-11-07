// CurrentEmployeeAttendanceProvider.jsx
import { useState,useEffect,useMemo } from "react";
import axios from "axios";
import { CurrentEmployeeAttendanceContext } from "./CurrentEmployeeAttendanceContext";

const CurrentEmployeeAttendanceProvider = ({ children }) => {
  // --- MANUAL ATTENDANCE DATA: September 2025 (30 days) ---
  const manualAttendance = [
    { id: 1, employeeId: "EMP101", name: "John Doe", date: "2025-09-01", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 2, employeeId: "EMP101", name: "John Doe", date: "2025-09-02", status: "Absent",
      punchIn: "", punchOut: "", actualPunchIn: "", actualPunchOut: "",
      workHours: 0, workedHours: 0, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 3, employeeId: "EMP101", name: "John Doe", date: "2025-09-03", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "10:30", actualPunchOut: "18:00",
      workHours: 9, workedHours: 7.5, idleTime: 1.5,
      isHalfDay: 0x00, isLateLogin: 0x01, isOtDay: 0x00, manualApproval: 0x01 },

    { id: 4, employeeId: "EMP101", name: "John Doe", date: "2025-09-04", status: "Leave",
      punchIn: "", punchOut: "", actualPunchIn: "", actualPunchOut: "",
      workHours: 0, workedHours: 0, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 5, employeeId: "EMP101", name: "John Doe", date: "2025-09-05", status: "Halfday",
      punchIn: "09:00", punchOut: "13:00", actualPunchIn: "09:00", actualPunchOut: "13:00",
      workHours: 4, workedHours: 4, idleTime: 0,
      isHalfDay: 0x01, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 6, employeeId: "EMP101", name: "John Doe", date: "2025-09-06", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "20:30",
      workHours: 9, workedHours: 11.5, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x01, manualApproval: 0x01 },

    { id: 7, employeeId: "EMP101", name: "John Doe", date: "2025-09-07", status: "Absent",
      punchIn: "", punchOut: "", actualPunchIn: "", actualPunchOut: "",
      workHours: 0, workedHours: 0, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 8, employeeId: "EMP101", name: "John Doe", date: "2025-09-08", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:45", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.25, idleTime: 0.75,
      isHalfDay: 0x00, isLateLogin: 0x01, isOtDay: 0x00, manualApproval: 0x01 },

    { id: 9, employeeId: "EMP101", name: "John Doe", date: "2025-09-09", status: "Leave",
      punchIn: "", punchOut: "", actualPunchIn: "", actualPunchOut: "",
      workHours: 0, workedHours: 0, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 10, employeeId: "EMP101", name: "John Doe", date: "2025-09-10", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 11, employeeId: "EMP101", name: "John Doe", date: "2025-09-11", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:15", actualPunchOut: "18:15",
      workHours: 9, workedHours: 9, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x01, isOtDay: 0x00, manualApproval: 0x01 },

    { id: 12, employeeId: "EMP101", name: "John Doe", date: "2025-09-12", status: "Halfday",
      punchIn: "09:00", punchOut: "13:00", actualPunchIn: "09:00", actualPunchOut: "13:00",
      workHours: 4, workedHours: 4, idleTime: 0,
      isHalfDay: 0x01, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 13, employeeId: "EMP101", name: "John Doe", date: "2025-09-13", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "21:00",
      workHours: 9, workedHours: 12, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x01, manualApproval: 0x01 },

    { id: 14, employeeId: "EMP101", name: "John Doe", date: "2025-09-14", status: "Absent",
      punchIn: "", punchOut: "", actualPunchIn: "", actualPunchOut: "",
      workHours: 0, workedHours: 0, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 15, employeeId: "EMP101", name: "John Doe", date: "2025-09-15", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 16, employeeId: "EMP101", name: "John Doe", date: "2025-09-16", status: "Leave",
      punchIn: "", punchOut: "", actualPunchIn: "", actualPunchOut: "",
      workHours: 0, workedHours: 0, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 17, employeeId: "EMP101", name: "John Doe", date: "2025-09-17", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 18, employeeId: "EMP101", name: "John Doe", date: "2025-09-18", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:40", actualPunchOut: "18:10",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x01, isOtDay: 0x00, manualApproval: 0x01 },

    { id: 19, employeeId: "EMP101", name: "John Doe", date: "2025-09-19", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 20, employeeId: "EMP101", name: "John Doe", date: "2025-09-20", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "19:30",
      workHours: 9, workedHours: 10.5, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x01, manualApproval: 0x01 },

    { id: 21, employeeId: "EMP101", name: "John Doe", date: "2025-09-21", status: "Halfday",
      punchIn: "09:00", punchOut: "13:00", actualPunchIn: "09:00", actualPunchOut: "13:00",
      workHours: 4, workedHours: 4, idleTime: 0,
      isHalfDay: 0x01, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 22, employeeId: "EMP101", name: "John Doe", date: "2025-09-22", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "10:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8, idleTime: 1,
      isHalfDay: 0x00, isLateLogin: 0x01, isOtDay: 0x00, manualApproval: 0x01 },

    { id: 23, employeeId: "EMP101", name: "John Doe", date: "2025-09-23", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 24, employeeId: "EMP101", name: "John Doe", date: "2025-09-24", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "21:15",
      workHours: 9, workedHours: 12.25, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x01, manualApproval: 0x01 },

    { id: 25, employeeId: "EMP101", name: "John Doe", date: "2025-09-25", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 26, employeeId: "EMP101", name: "John Doe", date: "2025-09-26", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:35", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.25, idleTime: 0.75,
      isHalfDay: 0x00, isLateLogin: 0x01, isOtDay: 0x00, manualApproval: 0x01 },

    { id: 27, employeeId: "EMP101", name: "John Doe", date: "2025-09-27", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 28, employeeId: "EMP101", name: "John Doe", date: "2025-09-28", status: "Absent",
      punchIn: "", punchOut: "", actualPunchIn: "", actualPunchOut: "",
      workHours: 0, workedHours: 0, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 29, employeeId: "EMP101", name: "John Doe", date: "2025-09-29", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "18:00",
      workHours: 9, workedHours: 8.5, idleTime: 0.5,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x00, manualApproval: 0x00 },

    { id: 30, employeeId: "EMP101", name: "John Doe", date: "2025-09-30", status: "Present",
      punchIn: "09:00", punchOut: "18:00", actualPunchIn: "09:00", actualPunchOut: "20:45",
      workHours: 9, workedHours: 11.75, idleTime: 0,
      isHalfDay: 0x00, isLateLogin: 0x00, isOtDay: 0x01, manualApproval: 0x01 }
  ];

  

  // useState so UI can update records later
const [attendanceRecords, setAttendanceRecords] = useState(
  Array.isArray(manualAttendance) ? manualAttendance : []
);

  // Helper for UI to update a single record (marks manualApproval if actualPunch changed)
  const updateAttendanceRecord = (id, updates) => {
    setAttendanceRecords(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, ...updates };
        // if actualPunch changed compared to previous, mark manualApproval
        if ((updates.actualPunchIn && updates.actualPunchIn !== r.actualPunchIn) ||
            (updates.actualPunchOut && updates.actualPunchOut !== r.actualPunchOut)) {
          updated.manualApproval = 0x01;
        }
        // keep idleTime/workedHours consistent if caller provided new times:
        if (updates.workedHours !== undefined) updated.idleTime = Math.max(0, (updated.workHours || 0) - updated.workedHours);
        return updated;
      })
    );
  };

    // ====== LATE PERMISSIONS ======

  const dummyPermissionRequests = [
  { id: 1, employeeId: "EMP101", request_date: "2025-08-01", from_time: "10:00", date: "2025-08-01", to_time: "12:00", reason: "Traffic jam", status: "Approved" },
  { id: 2, employeeId: "EMP101", request_date: "2025-08-01", from_time: "12:00", date: "2025-08-05", to_time: "2:00", reason: "Doctor appointment", status: "Pending" },
  { id: 3, employeeId: "EMP101", request_date: "2025-08-01", from_time: "2:30", date: "2025-07-20", to_time: "4:00", reason: "Family emergency", status: "Rejected" },
];

const [PermissionRequests, setPermissionRequests] = useState(
  Array.isArray(dummyPermissionRequests) ? dummyPermissionRequests : []
);
  
const applyPermission = async ({ from_time, date, to_time, reason }) => {
  const newRequest = {
    employeeId: "EMP101",
    name: "John Doe",
    from_time,
    date,
    to_time,
    reason,
    status: "Pending",
  };

  try {
    // Send new permission request to backend
    const response = await axios.post("/api/permissions", newRequest);

    // Assume backend returns the created object with 'id'
    const createdRequest = response.data;

    // Update local state with response
    setPermissionRequests((prev) => [createdRequest, ...prev]);
  } catch (error) {
    console.error("Failed to send permission request:", error);

    // Fallback: use local state if backend fails
    newRequest.id = PermissionRequests.length + 1 + Math.floor(Math.random() * 10000);
    setPermissionRequests((prev) => [newRequest, ...prev]);
  }
};

// --- DUMMY OVERTIME REQUESTS (September 2025) ---
const dummyOvertimeRequests = [
  // date = day for which OT was done / applied to; flags as 0x01 / 0x00
  { id: 1, employeeId: "EMP101", date: "2025-09-03", is_paid_out: 0x00, is_used_as_leave: 0x00, status: "APPROVED", type: "INCENTIVE_OT" },
  { id: 2, employeeId: "EMP101", date: "2025-09-06", is_paid_out: 0x01, is_used_as_leave: 0x00, status: "PENDING",  type: "PENDING_OT" },
  { id: 3, employeeId: "EMP101", date: "2025-09-13", is_paid_out: 0x01, is_used_as_leave: 0x01, status: "REJECTED", type: "INCENTIVE_OT" },
  { id: 4, employeeId: "EMP101", date: "2025-09-24", is_paid_out: 0x00, is_used_as_leave: 0x00, status: "APPROVED", type: "PENDING_OT" },
];

const [overtimeRequests, setOvertimeRequests] = useState(
  Array.isArray(dummyOvertimeRequests) ? dummyOvertimeRequests : []
);

const applyOvertime = async ({ date, type, is_paid_out = false, is_used_as_leave = false }) => {
  // convert booleans to 0x01 / 0x00 so storage matches your requested format
  const payload = {
    employeeId: "EMP101",
    name: "John Doe",
    date,
    type,
    status: "PENDING",
  };

  try {
    const response = await axios.post("/api/overtime", payload);
    const created = response.data;
    setOvertimeRequests((prev) => [created, ...prev]);
  } catch (error) {
    console.error("Failed to send overtime request:", error);
    // fallback local insertion (no backend)
    payload.id = overtimeRequests.length + 1 + Math.floor(Math.random() * 10000);
    setOvertimeRequests((prev) => [payload, ...prev]);
  }
};




const fetchAttendanceData = async () => {
  try {
    const attendanceResponse = await axios.get("/api/attendance");
    const permissionResponse = await axios.get("/api/permissions");
    const overtimeResponse = await axios.get("/api/overtime");

    setAttendanceRecords(
      Array.isArray(attendanceResponse.data) && attendanceResponse.data.length
        ? attendanceResponse.data
        : manualAttendance
    );

    setPermissionRequests(
      Array.isArray(permissionResponse.data) && permissionResponse.data.length
        ? permissionResponse.data
        : dummyPermissionRequests
    );

    setOvertimeRequests(
      Array.isArray(overtimeResponse.data) && overtimeResponse.data.length
        ? overtimeResponse.data
        : dummyOvertimeRequests
    );


    
  } catch (error) {
    console.error("Backend not available, using dummy data", error);
    setAttendanceRecords(manualAttendance);
    setPermissionRequests(dummyPermissionRequests);
    setOvertimeRequests(dummyOvertimeRequests);
  }
};




useEffect(() => {
  fetchAttendanceData();
}, []);



  return (
    <CurrentEmployeeAttendanceContext.Provider
      value={{
        attendanceRecords,
        setAttendanceRecords, // exposed in case you need direct set
        updateAttendanceRecord, // helper to update a single record
        PermissionRequests,
        applyPermission,
        overtimeRequests,       
        applyOvertime,
      }}
    >
      {children}
    </CurrentEmployeeAttendanceContext.Provider>
  );
};

export default CurrentEmployeeAttendanceProvider;






















// // CurrentEmployeeAttendanceProvider.jsx
// import { useState, useEffect } from "react";
// import axios from "axios";
// import { CurrentEmployeeAttendanceContext } from "./CurrentEmployeeAttendanceContext";

// // ✅ BASE URL
// const API = "http://localhost:5000";

// const CurrentEmployeeAttendanceProvider = ({ children }) => {
//   // ✅ Logged user from localStorage
//   const loggedUser = JSON.parse(localStorage.getItem("hrmsUser"));
//   const employeeId = loggedUser?.employeeId;

//   // ✅ States
//   const [attendanceRecords, setAttendanceRecords] = useState([]);
//   const [permissionRequests, setPermissionRequests] = useState([]);
//   const [overtimeRequests, setOvertimeRequests] = useState([]);

//   // ✅ Fetch Attendance From Backend
//   const fetchAttendance = async () => {
//     if (!employeeId) return;

//     try {
//       console.log("Fetching attendance for:", employeeId);

//       const res = await axios.get(`${API}/attendance/${employeeId}`);

//       // ✅ Format backend → UI format
//       const formatted = res.data.map((rec) => ({
//         id: rec._id,                     // ✅ Unique ID
//         employeeId: rec.employeeId,
//         date: rec.date,
//         punchIn: rec.punchIn || "",
//         punchOut: rec.punchOut || "",
//         status:
//           rec.status === "Completed"
//             ? "Present"
//             : rec.status === "Working"
//             ? "Present"
//             : rec.status === "Not Started"
//             ? "Absent"
//             : rec.status,
//       }));

//       setAttendanceRecords(formatted);
//       console.log("Loaded attendance:", formatted);
//     } catch (err) {
//       console.error("Attendance Fetch Failed:", err);
//     }
//   };

//   // ✅ Fetch Permissions
//   const fetchPermissions = async () => {
//     try {
//       const res = await axios.get(`${API}/permissions/${employeeId}`);
//       setPermissionRequests(res.data);
//     } catch (err) {
//       console.error("Permissions Fetch Failed:", err);
//     }
//   };

//   // ✅ Fetch Overtime Requests
//   const fetchOvertime = async () => {
//     try {
//       const res = await axios.get(`${API}/overtime/${employeeId}`);
//       setOvertimeRequests(res.data);
//     } catch (err) {
//       console.error("Overtime Fetch Failed:", err);
//     }
//   };

//   // ✅ Apply Permission Request
//   const applyPermission = async ({ date, from_time, to_time, reason }) => {
//     try {
//       const payload = { employeeId, date, from_time, to_time, reason };

//       const res = await axios.post(`${API}/permissions`, payload);

//       setPermissionRequests((prev) => [res.data, ...prev]);
//     } catch (err) {
//       console.error("Permission Submit Failed:", err);
//       throw err;
//     }
//   };

//   // ✅ Apply Overtime Request
//   const applyOvertime = async ({ date, type }) => {
//     try {
//       const payload = { employeeId, date, type, status: "PENDING" };

//       const res = await axios.post(`${API}/overtime`, payload);

//       setOvertimeRequests((prev) => [res.data, ...prev]);
//     } catch (err) {
//       console.error("OT Submit Failed:", err);
//       throw err;
//     }
//   };

//   // ✅ Load all data when employeeId changes
//   useEffect(() => {
//     if (employeeId) {
//       fetchAttendance();
//       fetchPermissions();
//       fetchOvertime();
//     }
//   }, [employeeId]);

//   return (
//     <CurrentEmployeeAttendanceContext.Provider
//       value={{
//         attendanceRecords,
//         permissionRequests,
//         overtimeRequests,
//         applyPermission,
//         applyOvertime,
//       }}
//     >
//       {children}
//     </CurrentEmployeeAttendanceContext.Provider>
//   );
// };

// export default CurrentEmployeeAttendanceProvider;
