// --- START OF FILE EmployeeattendanceRoutes.js ---

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

// ✅ GET ALL RECORDS 
router.get('/all', async (req, res) => {
  try {
    const records = await Attendance.find({});
    const sortedRecords = records.map(rec => {
        rec.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
        return rec;
    });
    res.status(200).json({
      success: true,
      count: sortedRecords.length,
      data: sortedRecords
    });
  } catch (err) {
    console.error("Error fetching all attendance:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ PUNCH IN 
router.post('/punch-in', async (req, res) => {
  try {
    const { employeeId, employeeName, latitude, longitude } = req.body;

    if (!employeeId || !employeeName) {
      return res.status(400).json({ success: false, message: 'Employee ID and Name are required' });
    }

    if (!latitude || !longitude) return res.status(400).json({ error: "Location data required." });
    if (!validateCoordinates(latitude, longitude)) return res.status(400).json({ error: "Invalid coordinates." });

    const today = getToday();
    const now = new Date();

    let shift = await Shift.findOne({ employeeId, isActive: true });
    
    if (!shift) {
      shift = {
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        lateGracePeriod: 15,
        autoExtendShift: true,
        fullDayHours: 8,
        halfDayHours: 4,
        quarterDayHours: 2
      };
    }

    let address = 'Unknown Location';
    try {
      address = await reverseGeocode(latitude, longitude);
    } catch (err) {
      console.error("Geocode failed, using default", err);
    }

    let attendance = await Attendance.findOne({ employeeId });

    if (!attendance) {
      attendance = new Attendance({
        employeeId,
        employeeName,
        attendance: []
      });
    }

    let todayRecord = attendance.attendance.find(a => a.date === today);

    if (todayRecord && todayRecord.punchIn) {
      return res.status(400).json({ success: false, message: 'Already punched in today' });
    }

    const timeDiffMinutes = getTimeDifferenceInMinutes(now, shift.shiftStartTime);
    const isLate = timeDiffMinutes > shift.lateGracePeriod;
    
    let loginStatus = 'ON_TIME';
    let adjustedShiftEnd = shift.shiftEndTime;

    if (isLate) {
      loginStatus = 'LATE';
      if (shift.autoExtendShift) {
        const lateMinutes = timeDiffMinutes - shift.lateGracePeriod;
        adjustedShiftEnd = addMinutesToTime(shift.shiftEndTime, lateMinutes);
      }
    }

    const punchInData = {
        date: today,
        punchIn: now,
        punchInLocation: {
          latitude,
          longitude,
          address,
          timestamp: now
        },
        punchOut: null,
        punchOutLocation: null,
        workedHours: 0,
        workedMinutes: 0,
        workedSeconds: 0,
        displayTime: '0h 0m 0s',
        status: 'WORKING',
        loginStatus: loginStatus,
        workedStatus: 'NOT_APPLICABLE',
        attendanceCategory: 'NOT_APPLICABLE',
        
        shiftStartTime: shift.shiftStartTime,
        shiftEndTime: adjustedShiftEnd,
        originalShiftEnd: shift.shiftEndTime,
        lateMinutes: isLate ? Math.max(0, timeDiffMinutes - shift.lateGracePeriod) : 0,
        
        idleActivity: [] 
    };

    if (!todayRecord) {
      attendance.attendance.push(punchInData);
    } else {
      Object.assign(todayRecord, punchInData);
    }

    await attendance.save();

    const savedRecord = attendance.attendance.find(a => a.date === today);
    
    return res.status(200).json({
      success: true,
      message: isLate 
        ? `Punched in (Late). Shift extended to ${adjustedShiftEnd}` 
        : 'Punched in successfully',
      data: savedRecord, 
      attendance: attendance.attendance,
      shift: {
        original: shift.shiftEndTime,
        adjusted: adjustedShiftEnd,
        isExtended: isLate && shift.autoExtendShift
      }
    });

  } catch (error) {
    console.error('Punch-in error:', error);
    return res.status(500).json({ success: false, message: 'Failed to punch in', error: error.message });
  }
});

// ✅ PUNCH OUT (Employee Side)
router.post('/punch-out', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;

    if (!employeeId) return res.status(400).json({ success: false, message: 'Employee ID is required' });
    if (!latitude || !longitude) return res.status(400).json({ error: "Location data required." });

    const today = getToday();
    const now = new Date();

    let shift = await Shift.findOne({ employeeId, isActive: true });
    if (!shift) {
      shift = {
        fullDayHours: 8,
        halfDayHours: 4,
        quarterDayHours: 2,
        breakTimeMinutes: 60 
      };
    }

    let address = 'Unknown Location';
    try {
      address = await reverseGeocode(latitude, longitude);
    } catch (err) {
       console.error("Geocode error", err);
    }

    const attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ success: false, message: 'No attendance record found' });

    const todayRecord = attendance.attendance.find(a => a.date === today);

    if (!todayRecord || !todayRecord.punchIn) {
      return res.status(400).json({ success: false, message: 'No punch-in record found for today' });
    }

    if (todayRecord.punchOut) {
        return res.json({ success: true, data: todayRecord, attendance: attendance.attendance });
    }

    if (todayRecord.idleActivity && todayRecord.idleActivity.length > 0) {
        const lastIdle = todayRecord.idleActivity[todayRecord.idleActivity.length - 1];
        if (!lastIdle.idleEnd) {
          lastIdle.idleEnd = now;
        }
    }

    const punchInTime = new Date(todayRecord.punchIn);
    const diffMs = now - punchInTime;
    const totalSeconds = Math.floor(diffMs / 1000);

    const breakSeconds = (shift.breakTimeMinutes || 0) * 60;
    const effectiveSeconds = Math.max(0, totalSeconds - breakSeconds);

    const hours = Math.floor(effectiveSeconds / 3600);
    const minutes = Math.floor((effectiveSeconds % 3600) / 60);
    const seconds = effectiveSeconds % 60;

    let workedStatus = 'NOT_APPLICABLE';
    let attendanceCategory = 'NOT_APPLICABLE';

    if (hours >= shift.fullDayHours) {
      workedStatus = 'FULL_DAY';
      attendanceCategory = 'FULL_DAY';
    } else if (hours >= shift.halfDayHours) {
      workedStatus = 'HALF_DAY';
      attendanceCategory = 'HALF_DAY';
    } else if (hours >= shift.quarterDayHours) {
      workedStatus = 'QUARTER_DAY';
      attendanceCategory = 'HALF_DAY'; 
    } else {
      workedStatus = 'ABSENT';
      attendanceCategory = 'ABSENT';
    }

    todayRecord.punchOut = now;
    todayRecord.punchOutLocation = {
      latitude,
      longitude,
      address,
      timestamp: now
    };
    todayRecord.workedHours = hours;
    todayRecord.workedMinutes = minutes;
    todayRecord.workedSeconds = seconds;
    todayRecord.displayTime = `${hours}h ${minutes}m ${seconds}s`;
    todayRecord.status = 'COMPLETED';
    todayRecord.workedStatus = workedStatus;
    todayRecord.attendanceCategory = attendanceCategory;

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: `Punched out successfully. Worked: ${hours}h ${minutes}m (${workedStatus})`,
      data: todayRecord,
      attendance: attendance.attendance 
    });

  } catch (error) {
    console.error('Punch-out error:', error);
    return res.status(500).json({ success: false, message: 'Failed to punch out', error: error.message });
  }
});

// ✅ RECORD IDLE ACTIVITY
router.post("/record-idle-activity", async (req, res) => {
  try {
    const { employeeId, idleStart, idleEnd, isIdle } = req.body;
    const today = getToday();

    let record = await Attendance.findOne({ employeeId });
    if (!record) return res.status(404).json({ message: "Record not found." });

    let todayEntry = record.attendance.find((a) => a.date === today);
    if (!todayEntry) return res.status(400).json({ message: "Punch in first." });

    if (!todayEntry.idleActivity) todayEntry.idleActivity = [];

    if (isIdle) {
      const lastEntry = todayEntry.idleActivity[todayEntry.idleActivity.length - 1];
      if (!lastEntry || lastEntry.idleEnd) {
         todayEntry.idleActivity.push({ idleStart: new Date(idleStart) });
      }
    } else {
      const lastEntry = todayEntry.idleActivity[todayEntry.idleActivity.length - 1];
      if (lastEntry && !lastEntry.idleEnd) {
        lastEntry.idleEnd = new Date(idleEnd);
      } else if (idleStart && idleEnd) {
        todayEntry.idleActivity.push({
           idleStart: new Date(idleStart),
           idleEnd: new Date(idleEnd)
        });
      }
    }

    await record.save();
    res.json({ message: "Idle updated", attendance: record.attendance });
  } catch (err) {
    console.error("Idle record error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ ADMIN MANUAL PUNCH OUT (Using POST to fix CORS/Network issues)
router.post('/admin-punch-out', async (req, res) => {
  try {
    const { employeeId, date, punchOutTime } = req.body; // punchOutTime should be full ISO string

    if (!employeeId || !date || !punchOutTime) {
      return res.status(400).json({ success: false, message: 'Employee ID, Date and Punch Out Time are required.' });
    }

    const attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ success: false, message: 'Employee record not found.' });

    const record = attendance.attendance.find(a => a.date === date);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record for this date not found.' });
    if (!record.punchIn) return res.status(400).json({ success: false, message: 'Employee has not punched in yet.' });

    // Calculate Times
    const punchIn = new Date(record.punchIn);
    const punchOut = new Date(punchOutTime);

    if (punchOut <= punchIn) {
      return res.status(400).json({ success: false, message: 'Punch out time must be after punch in time.' });
    }

    // Fetch Shift Config for Calculation
    let shift = await Shift.findOne({ employeeId, isActive: true });
    if (!shift) {
      shift = {
        fullDayHours: 8,
        halfDayHours: 4,
        quarterDayHours: 2,
        breakTimeMinutes: 60 
      };
    }

    // Close any open idle sessions automatically
    if (record.idleActivity && record.idleActivity.length > 0) {
      const lastIdle = record.idleActivity[record.idleActivity.length - 1];
      if (!lastIdle.idleEnd) {
        lastIdle.idleEnd = punchOut;
      }
    }

    // Calculate Duration
    const diffMs = punchOut - punchIn;
    const totalSeconds = Math.floor(diffMs / 1000);
    const breakSeconds = (shift.breakTimeMinutes || 0) * 60;
    const effectiveSeconds = Math.max(0, totalSeconds - breakSeconds);

    const hours = Math.floor(effectiveSeconds / 3600);
    const minutes = Math.floor((effectiveSeconds % 3600) / 60);
    const seconds = effectiveSeconds % 60;

    // Determine Status
    let workedStatus = 'ABSENT';
    let attendanceCategory = 'ABSENT';

    if (hours >= shift.fullDayHours) {
      workedStatus = 'FULL_DAY';
      attendanceCategory = 'FULL_DAY';
    } else if (hours >= shift.halfDayHours) {
      workedStatus = 'HALF_DAY';
      attendanceCategory = 'HALF_DAY';
    } else if (hours >= shift.quarterDayHours) {
      workedStatus = 'QUARTER_DAY';
      attendanceCategory = 'HALF_DAY'; 
    }

    // Update Record
    record.punchOut = punchOut;
    // Set a dummy Admin Location (Schema requires location)
    record.punchOutLocation = {
      latitude: 0,
      longitude: 0,
      address: 'Admin Manual Action',
      timestamp: new Date()
    };
    record.workedHours = hours;
    record.workedMinutes = minutes;
    record.workedSeconds = seconds;
    record.displayTime = `${hours}h ${minutes}m ${seconds}s`;
    record.status = 'COMPLETED';
    record.workedStatus = workedStatus;
    record.attendanceCategory = attendanceCategory;

    await attendance.save(); // ✅ Saves to DB

    return res.status(200).json({
      success: true,
      message: 'Admin punch out successful.',
      data: record
    });

  } catch (error) {
    console.error('Admin punch out error:', error);
    return res.status(500).json({ success: false, message: 'Server error during admin punch out.', error: error.message });
  }
});

// ✅ GET SINGLE EMPLOYEE ATTENDANCE 
router.get('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const attendance = await Attendance.findOne({ employeeId });

    if (!attendance) {
      return res.status(200).json({ success: true, data: [] });
    }

    const sortedData = attendance.attendance.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    return res.status(200).json({
      success: true,
      data: sortedData
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: error.message });
  }
});

export default router;