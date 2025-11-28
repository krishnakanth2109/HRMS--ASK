import express from 'express';
import Attendance from '../models/Attendance.js';
import Shift from '../models/shiftModel.js';
import { reverseGeocode, validateCoordinates } from '../Services/locationService.js';

const router = express.Router();

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getToday = () => new Date().toISOString().split("T")[0];

const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

const addMinutesToTime = (timeStr, minutesToAdd) => {
  const totalMinutes = timeToMinutes(timeStr) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getTimeDifferenceInMinutes = (punchInTime, shiftStartTime) => {
  const punchInDate = new Date(punchInTime);
  const punchInMinutes = punchInDate.getHours() * 60 + punchInDate.getMinutes();
  const shiftStartMinutes = timeToMinutes(shiftStartTime);
  return punchInMinutes - shiftStartMinutes;
};

// ============================================================
// ROUTES
// ============================================================

// GET ALL RECORDS
router.get('/all', async (req, res) => {
  try {
    const records = await Attendance.find({});
    const sortedRecords = records.map(rec => {
        rec.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
        return rec;
    });
    res.status(200).json({ success: true, count: sortedRecords.length, data: sortedRecords });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUNCH IN
router.post('/punch-in', async (req, res) => {
  try {
    const { employeeId, employeeName, latitude, longitude } = req.body;
    if (!employeeId || !employeeName) return res.status(400).json({ success: false, message: 'Employee ID and Name are required' });
    if (!latitude || !longitude) return res.status(400).json({ error: "Location data required." });
    if (!validateCoordinates(latitude, longitude)) return res.status(400).json({ error: "Invalid coordinates." });

    const today = getToday();
    const now = new Date();

    let shift = await Shift.findOne({ employeeId, isActive: true });
    if (!shift) {
      shift = { shiftStartTime: "09:00", shiftEndTime: "18:00", lateGracePeriod: 15, autoExtendShift: true };
    }

    let address = 'Unknown Location';
    try { address = await reverseGeocode(latitude, longitude); } catch (err) { console.error("Geocode failed", err); }

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) attendance = new Attendance({ employeeId, employeeName, attendance: [] });

    let todayRecord = attendance.attendance.find(a => a.date === today);
    if (todayRecord && todayRecord.punchIn) return res.status(400).json({ success: false, message: 'Already punched in today' });

    const timeDiffMinutes = getTimeDifferenceInMinutes(now, shift.shiftStartTime);
    const isLate = timeDiffMinutes > shift.lateGracePeriod;
    let loginStatus = isLate ? 'LATE' : 'ON_TIME';
    let adjustedShiftEnd = shift.shiftEndTime;

    if (isLate && shift.autoExtendShift) {
      const lateMinutes = timeDiffMinutes - shift.lateGracePeriod;
      adjustedShiftEnd = addMinutesToTime(shift.shiftEndTime, lateMinutes);
    }

    const punchInData = {
        date: today,
        punchIn: now,
        punchInLocation: { latitude, longitude, address, timestamp: now },
        status: 'WORKING',
        loginStatus: loginStatus,
        shiftStartTime: shift.shiftStartTime,
        shiftEndTime: adjustedShiftEnd,
        idleActivity: [] 
    };

    if (!todayRecord) attendance.attendance.push(punchInData);
    else Object.assign(todayRecord, punchInData);

    await attendance.save();
    return res.status(200).json({ success: true, message: 'Punched in successfully', data: punchInData });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to punch in', error: error.message });
  }
});

// PUNCH OUT
router.post('/punch-out', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;
    if (!employeeId) return res.status(400).json({ success: false, message: 'Employee ID required' });
    
    const today = getToday();
    const now = new Date();

    let shift = await Shift.findOne({ employeeId, isActive: true });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let address = 'Unknown Location';
    try { address = await reverseGeocode(latitude, longitude); } catch (err) {}

    const attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ success: false, message: 'No record found' });

    const todayRecord = attendance.attendance.find(a => a.date === today);
    if (!todayRecord || !todayRecord.punchIn) return res.status(400).json({ success: false, message: 'Not punched in today' });
    if (todayRecord.punchOut) return res.json({ success: true, data: todayRecord });

    if (todayRecord.idleActivity?.length > 0) {
        const lastIdle = todayRecord.idleActivity[todayRecord.idleActivity.length - 1];
        if (!lastIdle.idleEnd) lastIdle.idleEnd = now;
    }

    const diffMs = now - new Date(todayRecord.punchIn);
    const totalSeconds = Math.floor(diffMs / 1000);
    const breakSeconds = (shift.breakTimeMinutes || 0) * 60;
    const effectiveSeconds = Math.max(0, totalSeconds - breakSeconds);
    const hours = Math.floor(effectiveSeconds / 3600);
    const minutes = Math.floor((effectiveSeconds % 3600) / 60);
    const seconds = effectiveSeconds % 60;

    let workedStatus = 'ABSENT';
    if (hours >= shift.fullDayHours) workedStatus = 'FULL_DAY';
    else if (hours >= shift.halfDayHours) workedStatus = 'HALF_DAY';
    else if (hours >= shift.quarterDayHours) workedStatus = 'QUARTER_DAY';

    todayRecord.punchOut = now;
    todayRecord.punchOutLocation = { latitude, longitude, address, timestamp: now };
    todayRecord.workedHours = hours;
    todayRecord.workedMinutes = minutes;
    todayRecord.workedSeconds = seconds;
    todayRecord.displayTime = `${hours}h ${minutes}m ${seconds}s`;
    todayRecord.status = 'COMPLETED';
    todayRecord.workedStatus = workedStatus;

    await attendance.save();
    return res.status(200).json({ success: true, message: 'Punched out successfully', data: todayRecord });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to punch out', error: error.message });
  }
});



// ✅ UPDATED: ADMIN PUNCH OUT (Accepts specific Record Date)
router.post('/admin-punch-out', async (req, res) => {
  try {
    // ✅ Added 'date' to destructuring to identify which day's record to update
    const { employeeId, punchOutTime, latitude, longitude, adminId, date } = req.body;

    if (!employeeId || !punchOutTime || !latitude || !longitude || !date) {
      return res.status(400).json({ success: false, message: 'Missing required fields (employeeId, time, location, or date)' });
    }

    const customPunchOutTime = new Date(punchOutTime);
    if (isNaN(customPunchOutTime.getTime())) return res.status(400).json({ success: false, message: 'Invalid time' });

    // 1. Fetch Shift
    let shift = await Shift.findOne({ employeeId, isActive: true });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    // 2. Get Address
    let address = 'Unknown Location';
    try { address = await reverseGeocode(latitude, longitude); } catch (err) {}

    const attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ success: false, message: 'Employee not found' });

    // ✅ CRITICAL CHANGE: Find the record matching the PASSED date, not just getToday()
    const targetRecord = attendance.attendance.find(a => a.date === date);

    if (!targetRecord || !targetRecord.punchIn) {
      return res.status(400).json({ success: false, message: `No punch-in record found for date: ${date}` });
    }
    
    if (targetRecord.punchOut) {
      return res.status(400).json({ success: false, message: 'Already punched out' });
    }

    // Validate time
    if (customPunchOutTime <= new Date(targetRecord.punchIn)) {
      return res.status(400).json({ success: false, message: 'Punch out must be after punch in' });
    }

    // Close Idle
    if (targetRecord.idleActivity?.length > 0) {
      const lastIdle = targetRecord.idleActivity[targetRecord.idleActivity.length - 1];
      if (!lastIdle.idleEnd) lastIdle.idleEnd = customPunchOutTime;
    }

    // Calculations
    const diffMs = customPunchOutTime - new Date(targetRecord.punchIn);
    const totalSeconds = Math.floor(diffMs / 1000);
    const breakSeconds = (shift.breakTimeMinutes || 0) * 60;
    const effectiveSeconds = Math.max(0, totalSeconds - breakSeconds);
    const hours = Math.floor(effectiveSeconds / 3600);
    const minutes = Math.floor((effectiveSeconds % 3600) / 60);
    const seconds = effectiveSeconds % 60;

    let workedStatus = 'ABSENT';
    if (hours >= shift.fullDayHours) workedStatus = 'FULL_DAY';
    else if (hours >= shift.halfDayHours) workedStatus = 'HALF_DAY';
    else if (hours >= shift.quarterDayHours) workedStatus = 'QUARTER_DAY';

    // Update Record
    targetRecord.punchOut = customPunchOutTime;
    targetRecord.punchOutLocation = { latitude, longitude, address, timestamp: customPunchOutTime };
    targetRecord.workedHours = hours;
    targetRecord.workedMinutes = minutes;
    targetRecord.workedSeconds = seconds;
    targetRecord.displayTime = `${hours}h ${minutes}m ${seconds}s`;
    targetRecord.status = 'COMPLETED';
    targetRecord.workedStatus = workedStatus;
    targetRecord.adminPunchOut = true;
    targetRecord.adminPunchOutBy = adminId || 'Admin';

    await attendance.save();
    return res.status(200).json({ success: true, message: 'Admin punch out successful', data: targetRecord });
  } catch (error) {
    console.error('Admin punch out error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});



// RECORD IDLE
router.post("/record-idle-activity", async (req, res) => {
  try {
    const { employeeId, idleStart, idleEnd, isIdle } = req.body;
    const today = getToday();
    let record = await Attendance.findOne({ employeeId });
    if (!record) return res.status(404).json({ message: "Record not found" });

    let todayEntry = record.attendance.find((a) => a.date === today);
    if (!todayEntry) return res.status(400).json({ message: "Punch in first" });

    if (!todayEntry.idleActivity) todayEntry.idleActivity = [];

    if (isIdle) {
      const last = todayEntry.idleActivity[todayEntry.idleActivity.length - 1];
      if (!last || last.idleEnd) todayEntry.idleActivity.push({ idleStart: new Date(idleStart) });
    } else {
      const last = todayEntry.idleActivity[todayEntry.idleActivity.length - 1];
      if (last && !last.idleEnd) last.idleEnd = new Date(idleEnd);
    }

    await record.save();
    res.json({ message: "Idle updated" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET SINGLE EMPLOYEE
router.get('/:employeeId', async (req, res) => {
  try {
    const attendance = await Attendance.findOne({ employeeId: req.params.employeeId });
    if (!attendance) return res.status(200).json({ success: true, data: [] });
    return res.status(200).json({ success: true, data: attendance.attendance });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;