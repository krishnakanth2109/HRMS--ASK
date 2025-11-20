// --- START OF FILE routes/attendanceRoutes.js (UPDATED WITH SHIFT LOGIC) ---

import express from 'express';
import Attendance from '../models/Attendance.js';
import Shift from '../models/shiftModel.js';

const router = express.Router();

// Helper function to parse time string "HH:MM" and convert to minutes since midnight
const timeToMinutes = (timeStr) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper function to add minutes to a time string
const addMinutesToTime = (timeStr, minutesToAdd) => {
  const totalMinutes = timeToMinutes(timeStr) + minutesToAdd;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// Helper function to calculate time difference in minutes
const getTimeDifferenceInMinutes = (punchInTime, shiftStartTime) => {
  const punchInDate = new Date(punchInTime);
  const punchInMinutes = punchInDate.getHours() * 60 + punchInDate.getMinutes();
  const shiftStartMinutes = timeToMinutes(shiftStartTime);
  return punchInMinutes - shiftStartMinutes;
};

// @route   POST /api/attendance/punch-in
// @desc    Punch In with shift-aware logic
// @access  Protected
router.post('/punch-in', async (req, res) => {
  try {
    const { employeeId, employeeName, latitude, longitude } = req.body;

    if (!employeeId || !employeeName) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID and Name are required'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Fetch shift configuration for this employee
    let shift = await Shift.findOne({ employeeId, isActive: true });
    
    // Default shift if not configured
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

    // Reverse geocode location to get address
    let address = 'Unknown Location';
    if (latitude && longitude) {
      try {
        const geocodeRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
        );
        const geoData = await geocodeRes.json();
        if (geoData && geoData.display_name) {
          address = geoData.display_name;
        }
      } catch (geoErr) {
        console.error('Geocoding error:', geoErr);
      }
    }

    // Find or create attendance record
    let attendance = await Attendance.findOne({ employeeId });

    if (!attendance) {
      attendance = new Attendance({
        employeeId,
        employeeName,
        attendance: []
      });
    }

    // Check if already punched in today
    let todayRecord = attendance.attendance.find(a => a.date === today);

    if (todayRecord && todayRecord.punchIn) {
      return res.status(400).json({
        success: false,
        message: 'Already punched in today'
      });
    }

    // Calculate if late
    const timeDiffMinutes = getTimeDifferenceInMinutes(now, shift.shiftStartTime);
    const isLate = timeDiffMinutes > shift.lateGracePeriod;
    
    let loginStatus = 'ON_TIME';
    let adjustedShiftEnd = shift.shiftEndTime;

    if (isLate) {
      loginStatus = 'LATE';
      
      // Auto-extend shift if enabled
      if (shift.autoExtendShift) {
        const lateMinutes = timeDiffMinutes - shift.lateGracePeriod;
        adjustedShiftEnd = addMinutesToTime(shift.shiftEndTime, lateMinutes);
        console.log(`🔄 Shift extended for ${employeeId}: ${shift.shiftEndTime} → ${adjustedShiftEnd} (Late by ${lateMinutes} minutes)`);
      }
    }

    if (!todayRecord) {
      // Create new record
      todayRecord = {
        date: today,
        punchIn: now,
        punchInLocation: {
          latitude: latitude || null,
          longitude: longitude || null,
          address: address,
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
        lateMinutes: isLate ? Math.max(0, timeDiffMinutes - shift.lateGracePeriod) : 0
      };
      attendance.attendance.push(todayRecord);
    } else {
      // Update existing record (shouldn't happen if check above works)
      todayRecord.punchIn = now;
      todayRecord.punchInLocation = {
        latitude: latitude || null,
        longitude: longitude || null,
        address: address,
        timestamp: now
      };
      todayRecord.status = 'WORKING';
      todayRecord.loginStatus = loginStatus;
      todayRecord.shiftStartTime = shift.shiftStartTime;
      todayRecord.shiftEndTime = adjustedShiftEnd;
      todayRecord.originalShiftEnd = shift.shiftEndTime;
      todayRecord.lateMinutes = isLate ? Math.max(0, timeDiffMinutes - shift.lateGracePeriod) : 0;
    }

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: isLate 
        ? `Punched in (Late). Shift extended to ${adjustedShiftEnd}` 
        : 'Punched in successfully',
      data: todayRecord,
      shift: {
        original: shift.shiftEndTime,
        adjusted: adjustedShiftEnd,
        isExtended: isLate && shift.autoExtendShift
      }
    });

  } catch (error) {
    console.error('Punch-in error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to punch in',
      error: error.message
    });
  }
});

// @route   POST /api/attendance/punch-out
// @desc    Punch Out with shift-aware worked hours calculation
// @access  Protected
router.post('/punch-out', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date();

    // Fetch shift configuration
    let shift = await Shift.findOne({ employeeId, isActive: true });
    
    if (!shift) {
      shift = {
        fullDayHours: 8,
        halfDayHours: 4,
        quarterDayHours: 2,
        breakTimeMinutes: 60
      };
    }

    // Reverse geocode
    let address = 'Unknown Location';
    if (latitude && longitude) {
      try {
        const geocodeRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
        );
        const geoData = await geocodeRes.json();
        if (geoData && geoData.display_name) {
          address = geoData.display_name;
        }
      } catch (geoErr) {
        console.error('Geocoding error:', geoErr);
      }
    }

    const attendance = await Attendance.findOne({ employeeId });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'No attendance record found'
      });
    }

    const todayRecord = attendance.attendance.find(a => a.date === today);

    if (!todayRecord || !todayRecord.punchIn) {
      return res.status(400).json({
        success: false,
        message: 'No punch-in record found for today'
      });
    }

    if (todayRecord.punchOut) {
      return res.status(400).json({
        success: false,
        message: 'Already punched out today'
      });
    }

    // Calculate worked time
    const punchInTime = new Date(todayRecord.punchIn);
    const punchOutTime = now;
    const diffMs = punchOutTime - punchInTime;
    const totalSeconds = Math.floor(diffMs / 1000);

    // Subtract break time
    const breakSeconds = (shift.breakTimeMinutes || 0) * 60;
    const effectiveSeconds = Math.max(0, totalSeconds - breakSeconds);

    const hours = Math.floor(effectiveSeconds / 3600);
    const minutes = Math.floor((effectiveSeconds % 3600) / 60);
    const seconds = effectiveSeconds % 60;

    // Determine worked status based on shift configuration
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
      attendanceCategory = 'HALF_DAY'; // Quarter day counts as half day in attendance
    } else {
      workedStatus = 'ABSENT';
      attendanceCategory = 'ABSENT';
    }

    // Update record
    todayRecord.punchOut = punchOutTime;
    todayRecord.punchOutLocation = {
      latitude: latitude || null,
      longitude: longitude || null,
      address: address,
      timestamp: punchOutTime
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
      data: todayRecord
    });

  } catch (error) {
    console.error('Punch-out error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to punch out',
      error: error.message
    });
  }
});

// @route   GET /api/attendance/:employeeId
// @desc    Get attendance for employee
// @access  Protected
router.get('/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;

    const attendance = await Attendance.findOne({ employeeId });

    if (!attendance) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      data: attendance.attendance.sort((a, b) => 
        new Date(b.date) - new Date(a.date)
      )
    });

  } catch (error) {
    console.error('Get attendance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance',
      error: error.message
    });
  }
});

// @route   GET /api/attendance/all/records
// @desc    Get all attendance records (Admin)
// @access  Protected/Admin
router.get('/all/records', async (req, res) => {
  try {
    const allAttendance = await Attendance.find({});

    return res.status(200).json({
      success: true,
      count: allAttendance.length,
      data: allAttendance
    });

  } catch (error) {
    console.error('Get all attendance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch all attendance',
      error: error.message
    });
  }
});

export default router;

// --- END OF FILE routes/attendanceRoutes.js ---