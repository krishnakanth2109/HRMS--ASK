import express from 'express';
import Attendance from '../models/Attendance.js';
import Shift from '../models/shiftModel.js';
import { reverseGeocode, validateCoordinates } from '../Services/locationService.js';
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import LeaveRequest from "../models/LeaveRequest.js";
import nodemailer from 'nodemailer';

const router = express.Router();

/* ================= EMAIL CONFIGURATION ================= */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error("❌ SMTP Verification Error:", error);
  } else {
    console.log("✅ Mail Server is ready to send messages");
  }
});

/* ================= EMAIL TEMPLATES ================= */

const createInsufficientHoursEmail = (employeeData) => {
  const { employeeName, date, punchIn, punchOut, workedHours, workedMinutes, workedSeconds, requiredHours, loginStatus, workedStatus } = employeeData;

  const formatTime = (dateObj) => {
    if (!dateObj) return '--';
    const utcDate = new Date(dateObj);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utcDate.getTime() + istOffset);
    let hours = istDate.getUTCHours();
    const minutes = istDate.getUTCMinutes();
    const seconds = istDate.getUTCSeconds();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '--';
    const utcDate = new Date(dateStr);
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(utcDate.getTime() + istOffset);
    return istDate.toDateString();
  };

  const getStatusBadge = (status) => {
    const colors = {
      'ON_TIME': { bg: '#10b981', text: '#ffffff' },
      'LATE': { bg: '#ef4444', text: '#ffffff' },
      'FULL_DAY': { bg: '#10b981', text: '#ffffff' },
      'HALF_DAY': { bg: '#f59e0b', text: '#ffffff' },
      'ABSENT': { bg: '#ef4444', text: '#ffffff' },
    };
    const color = colors[status] || { bg: '#6b7280', text: '#ffffff' };
    return `<span style="background-color: ${color.bg}; color: ${color.text}; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600;">${status.replace(/_/g, ' ')}</span>`;
  };

  return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#eef2f7; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#b91c1c,#ef4444); padding:35px 30px; text-align:center;">
              <h1 style="margin:0; font-size:26px; color:#ffffff; font-weight:700; letter-spacing:0.5px;">
                ⚠Shortage Of Working Hours
              </h1>
              <p style="margin:8px 0 0 0; color:#fecaca; font-size:14px;">
                Attendance & Workforce Management System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:35px 30px;">
              
              <p style="margin:0 0 18px 0; font-size:16px; color:#1f2937;">
                Hi <strong>${employeeName}</strong>,
              </p>

              <p style="margin:0 0 25px 0; font-size:15px; color:#4b5563; line-height:1.7;">
                Your are receiving this Email because we identified some irregularity in your attendance logs on ${formatDate(date)}. 
                Your total worked hours for the day are less than the required ${requiredHours} hours. Please find the details below.

              </p>

                 <p style="margin:0 0 25px 0; font-size:15px; color:#4b5563; line-height:1.7;">
                  
              </p>

              <!-- Info Card -->
              <table width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc; border-radius:10px; padding:20px; border:1px solid #e5e7eb; margin-bottom:25px;">
                <tr>
                  <td>
                    <table width="100%" style="font-size:14px; border-collapse:collapse;">
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">📅 Date</td>
                        <td style="padding:10px 0; text-align:right; font-weight:600; color:#111827;">
                          ${formatDate(date)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">🕘 First Punch-In</td>
                        <td style="padding:10px 0; text-align:right; font-weight:600;">
                          ${formatTime(punchIn)}
                          
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">🕔 Last Punch-Out</td>
                        <td style="padding:10px 0; text-align:right; font-weight:600;">
                          ${formatTime(punchOut)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">⏱ Required Hours</td>
                        <td style="padding:10px 0; text-align:right; font-weight:600;">
                          ${requiredHours}h
                        </td>
                      </tr>
                      <tr style="border-top:1px solid #e5e7eb;">
                        <td style="padding:12px 0; font-weight:bold; color:#111827;">
                          ⌛ Total Worked Time
                        </td>
                        <td style="padding:12px 0; text-align:right; font-weight:bold; color:#dc2626; font-size:15px;">
                          ${workedHours}h ${workedMinutes}m ${workedSeconds}s
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">Login Status</td>
                        <td style="padding:10px 0; text-align:right;">
                          ${getStatusBadge(loginStatus)}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">Work Status</td>
                        <td style="padding:10px 0; text-align:right;">
                          ${getStatusBadge(workedStatus)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning Box -->
              <div style="background:#fff7ed; border:1px solid #fed7aa; border-left:5px solid #f97316; border-radius:8px; padding:16px; margin-bottom:25px;">
                <p style="margin:0; font-size:13px; color:#7c2d12; line-height:1.6;">
                  <strong>Note:</strong> If you do not punch in again today, this will be considered your final punch-out
                  and will be officially recorded in our management system.
                </p>
              
              
              <p style="margin:0 0 10px 0; font-size:13px; color:#9a3412; line-height:1.6;">
                  <strong>Important:</strong> Early punch-out without prior approval may impact your attendance compliance and salary processing.
                  Please reach out to your HR/reporting manager in case you need further clarification.
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f3f4f6; padding:18px; text-align:center; font-size:12px; color:#9ca3af;">
              © ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric' })}
 Attendance Management System <br/>
              This is an automated notification. Please do not reply to this email.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
};

/* ================= ✅ NEW: UNINFORMED ABSENCE TEMPLATE ================= */
const createUninformedAbsenceEmail = (employeeName, absentDate) => {
return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#f4f7f6; font-family:'Segoe UI', Arial, sans-serif;">
  <table width="100%" cellspacing="0" cellpadding="0" style="padding:40px 10px;">
    <tr>
      <td align="center">
        <table width="600" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background:#dc2626; padding:40px 20px; text-align:center;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; letter-spacing:1px;">ABSENCE ALERT</h1>
              <p style="margin:10px 0 0 0; color:#fecaca; font-size:14px;">Attendance Management Notification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 30px;">
              
              <p style="font-size:17px; color:#1f2937; margin-bottom:20px;">
                Hi <strong>${employeeName}</strong>,
              </p>
              
              <div style="background:#fff1f2; border-left:5px solid #e11d48; padding:20px; margin-bottom:30px;">
                <p style="margin:0; color:#9f1239; font-size:16px; line-height:1.6;">
                  <strong>No Attendance Recorded on:</strong> ${new Date(absentDate).toDateString()}
                </p>
              </div>

              <p style="color:#4b5563; font-size:15px; line-height:1.7;">
                This is to inform you that an irregularity has been identified in your attendance records on ${new Date(absentDate).toDateString()}. Our records indicate that you were absent on this date without an approved leave request on file.
                <br><br>
                Please note that unreported or uninformed absences may impact team scheduling, project timelines, and overall workflow efficiency.
              </p>

              <!-- Next Steps -->
              <table width="100%" style="margin:30px 0; border-top:1px solid #e5e7eb; padding-top:20px;">
                <tr>
                  <td>
                    <p style="margin:0; font-size:13px; color:#6b7280;">
                      <strong>Next Steps:</strong><br>
                      1. Please discuss this absence with your Reporting Manager.<br>
                      2. If this is a technical error, contact HR/IT support immediately.<br>
                      3. Ensure all future leaves are applied and approved in advance.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; padding:20px; text-align:center; color:#9ca3af; font-size:12px;">
              © ${new Date().getFullYear()} Attendance System | Automated Message - Please do not reply.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

};

/* ================= SEND EMAIL FUNCTIONS ================= */
const sendInsufficientHoursEmail = async (employeeEmail, employeeData) => {
  try {
    const mailOptions = {
      from: `<${process.env.SMTP_USER}>`,
      to: employeeEmail,
      subject: `Shortage of Work Hours - ${employeeData.date}`,
      html: createInsufficientHoursEmail(employeeData),
    };
    await transporter.sendMail(mailOptions);
    console.log(`✅ Insufficient hours email sent to ${employeeEmail}`);
  } catch (error) { console.error('❌ Error sending email:', error); }
};

const sendUninformedAbsenceEmail = async (employeeEmail, employeeName, absentDate) => {
  try {
    const mailOptions = {
      from: `<${process.env.SMTP_USER}>`,
      to: employeeEmail,
      subject: `⚠ No Attendance Recorded - ${absentDate}`,
      html: createUninformedAbsenceEmail(employeeName, absentDate),
    };
    await transporter.sendMail(mailOptions);
    console.log(`✅ Absence alert email sent to ${employeeEmail} for date ${absentDate}`);
  } catch (error) { console.error('❌ Error sending absence email:', error); }
};

// Apply protection to all routes
router.use(protect);

// Admin Only: Get All
router.get('/all', onlyAdmin, async (req, res) => {
  try {
    const records = await Attendance.find({});
    const sortedRecords = records.map(rec => {
      rec.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
      return rec;
    });
    res.status(200).json({ success: true, count: sortedRecords.length, data: sortedRecords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= UTILITIES ================= */
const getToday = () => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
};

const getYesterdayDate = () => {
  const date = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  date.setDate(date.getDate() - 1);
  return date.toLocaleDateString("en-CA"); // Returns YYYY-MM-DD
};

const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const getTimeDifferenceInMinutes = (punchIn, shiftStart) => {
  const t = new Date(punchIn);
  return t.getHours() * 60 + t.getMinutes() - timeToMinutes(shiftStart);
};

/* ================= PUNCH IN ================= */
router.post('/punch-in', async (req, res) => {
  try {
    const { employeeId, employeeName, latitude, longitude } = req.body;

    if (!employeeId || !employeeName)
      return res.status(400).json({ message: 'Employee ID & Name required' });

    if (!validateCoordinates(latitude, longitude))
      return res.status(400).json({ message: "Invalid coordinates" });

    const today = getToday();
    const now = new Date();

    /* ================= ✅ CHECK YESTERDAY'S ABSENCE WITHOUT LEAVE ================= */
    const yesterday = getYesterdayDate();
    let attendance = await Attendance.findOne({ employeeId });

    if (attendance) {
      // ✅ UNINFORMED ABSENCE email only fires on the very FIRST punch-in of the day.
      // Guard 1: no todayRecord at all means no sessions yet.
      // Guard 2: sessions.length === 0 as extra safety for edge cases.
      const todayRecordCheck = attendance.attendance.find(a => a.date === today);
      const isFirstPunchInToday = !todayRecordCheck || (todayRecordCheck.sessions && todayRecordCheck.sessions.length === 0);

      if (isFirstPunchInToday) {
        const yesterdayRecord = attendance.attendance.find(a => a.date === yesterday);

        if (!yesterdayRecord) {
          const approvedLeaveYesterday = await LeaveRequest.findOne({
            employeeId: String(employeeId).trim(),
            status: "Approved",
            "details.date": yesterday
          });

          if (!approvedLeaveYesterday && req.user && req.user.email) {
            sendUninformedAbsenceEmail(req.user.email, employeeName, yesterday);
          }
        }
      }
    }

    // Existing Leave Logic for Today
    const approvedLeaveToday = await LeaveRequest.findOne({
      employeeId: String(employeeId).trim(),
      status: "Approved",
      "details.date": today,
    }).lean();

    if (approvedLeaveToday) {
      if (approvedLeaveToday.leaveDayType === "Full Day") {
        return res.status(403).json({ success: false, message: "Punch-in not allowed. You are on approved leave today." });
      }
      if (approvedLeaveToday.leaveDayType === "Half Day") {
        const hour = now.getHours();
        if (approvedLeaveToday.halfDaySession === "Morning" && hour < 13) {
          return res.status(403).json({ success: false, message: "Morning half-day leave. Punch-in allowed after 1 PM." });
        }
        if (approvedLeaveToday.halfDaySession === "Afternoon" && hour >= 13) {
          return res.status(403).json({ success: false, message: "Afternoon half-day leave. Punch-in not allowed after 1 PM." });
        }
      }
    }

    let address = "Unknown Location";
    try { address = await reverseGeocode(latitude, longitude); } catch { }

    if (!attendance) {
      attendance = new Attendance({ employeeId, employeeName, attendance: [] });
    }

    let todayRecord = attendance.attendance.find(a => a.date === today);

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

    if (!todayRecord) {
      const diffMin = getTimeDifferenceInMinutes(now, shift.shiftStartTime);
      const isLate = diffMin > shift.lateGracePeriod;

      todayRecord = {
        date: today,
        punchIn: now,
        punchOut: null,
        punchInLocation: { latitude, longitude, address, timestamp: now },
        sessions: [{ punchIn: now, punchOut: null, durationSeconds: 0 }],
        workedHours: 0,
        workedMinutes: 0,
        workedSeconds: 0,
        totalBreakSeconds: 0,
        displayTime: "0h 0m 0s",
        status: "WORKING",
        loginStatus: isLate ? "LATE" : "ON_TIME",
      };

      attendance.attendance.push(todayRecord);
    }
    else {
      if (todayRecord.workedStatus === "FULL_DAY") {
        return res.status(400).json({ message: "Your shift is completed. You cannot punch in again today." });
      }
      // ✅ Block re-punch-in if employee did a final punch out (not just a break)
      if (todayRecord.isFinalPunchOut) {
        return res.status(400).json({ message: "You have punched out for the day. Re-punch-in is not allowed after a final punch out." });
      }
      if (todayRecord.status === "WORKING") {
        return res.status(400).json({ message: "You are already Punched In." });
      }

      const lastSession = todayRecord.sessions[todayRecord.sessions.length - 1];
      if (lastSession && lastSession.punchOut) {
        const breakDiff = (now - new Date(lastSession.punchOut)) / 1000;
        todayRecord.totalBreakSeconds += breakDiff;
      }

      todayRecord.sessions.push({ punchIn: now, punchOut: null, durationSeconds: 0 });
      todayRecord.status = "WORKING";
      todayRecord.punchOut = null;
    }

    await attendance.save();
    return res.json({
      success: true,
      message: "Punch-in successful",
      data: attendance.attendance.find(a => a.date === today),
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ================= PUNCH OUT (FINAL — sends shortage email if applicable) ================= */
router.post('/punch-out', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;
    if (!employeeId) return res.status(400).json({ message: "Employee ID required" });

    const today = getToday();
    const now = new Date();

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "No record found" });

    let todayRecord = attendance.attendance.find(a => a.date === today);
    if (!todayRecord) return res.status(400).json({ message: "No attendance record for today" });

    const currentSession = (todayRecord.sessions || []).find(s => !s.punchOut);
    if (!currentSession) {
      return res.status(400).json({ message: "You are already Punched Out." });
    }

    currentSession.punchOut = now;
    currentSession.durationSeconds = (new Date(now) - new Date(currentSession.punchIn)) / 1000;

    todayRecord.punchOut = now;
    todayRecord.punchOutLocation = { latitude, longitude, timestamp: now };
    todayRecord.status = "COMPLETED";
    // ✅ FINAL punch-out: block re-punch-in
    todayRecord.isFinalPunchOut = true;

    let totalSeconds = 0;
    todayRecord.sessions.forEach(sess => {
      if (sess.punchIn && sess.punchOut) {
        totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
      }
    });

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    todayRecord.workedHours = h;
    todayRecord.workedMinutes = m;
    todayRecord.workedSeconds = s;
    todayRecord.displayTime = `${h}h ${m}m ${s}s`;

    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let attendanceCategory = "ABSENT";
    let workedStatus = "ABSENT";

    if (h >= shift.fullDayHours) { attendanceCategory = "FULL_DAY"; workedStatus = "FULL_DAY"; }
    else if (h >= shift.halfDayHours) { attendanceCategory = "HALF_DAY"; workedStatus = "HALF_DAY"; }
    else if (h >= shift.quarterDayHours) { workedStatus = "HALF_DAY"; }

    todayRecord.workedStatus = workedStatus;
    todayRecord.attendanceCategory = attendanceCategory;

    await attendance.save();

    // ✅ Send "Shortage Of Working Hours" email ONLY on final punch-out when hours are short
    if (h < shift.fullDayHours && req.user && req.user.email) {
      const emailData = {
        employeeName: attendance.employeeName,
        date: today,
        punchIn: todayRecord.punchIn,
        punchOut: todayRecord.punchOut,
        workedHours: h,
        workedMinutes: m,
        workedSeconds: s,
        requiredHours: shift.fullDayHours,
        loginStatus: todayRecord.loginStatus || 'ON_TIME',
        workedStatus: todayRecord.workedStatus
      };
      sendInsufficientHoursEmail(req.user.email, emailData);
    }

    res.json({ success: true, message: `Punched out. Total: ${h}h ${m}m`, data: todayRecord });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= PUNCH BREAK (BREAK — no email, allows re-punch-in) ================= */
router.post('/punch-break', async (req, res) => {
  try {
    const { employeeId, latitude, longitude } = req.body;
    if (!employeeId) return res.status(400).json({ message: "Employee ID required" });

    const today = getToday();
    const now = new Date();

    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "No record found" });

    let todayRecord = attendance.attendance.find(a => a.date === today);
    if (!todayRecord) return res.status(400).json({ message: "No attendance record for today" });

    const currentSession = (todayRecord.sessions || []).find(s => !s.punchOut);
    if (!currentSession) {
      return res.status(400).json({ message: "You are already on a break." });
    }

    currentSession.punchOut = now;
    currentSession.durationSeconds = (new Date(now) - new Date(currentSession.punchIn)) / 1000;

    todayRecord.punchOut = now;
    if (latitude && longitude) {
      todayRecord.punchOutLocation = { latitude, longitude, timestamp: now };
    }
    todayRecord.status = "COMPLETED";
    // ✅ BREAK: allow re-punch-in, NO email sent
    todayRecord.isFinalPunchOut = false;

    let totalSeconds = 0;
    todayRecord.sessions.forEach(sess => {
      if (sess.punchIn && sess.punchOut) {
        totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
      }
    });

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    todayRecord.workedHours = h;
    todayRecord.workedMinutes = m;
    todayRecord.workedSeconds = s;
    todayRecord.displayTime = `${h}h ${m}m ${s}s`;

    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let attendanceCategory = "ABSENT";
    let workedStatus = "ABSENT";

    if (h >= shift.fullDayHours) { attendanceCategory = "FULL_DAY"; workedStatus = "FULL_DAY"; }
    else if (h >= shift.halfDayHours) { attendanceCategory = "HALF_DAY"; workedStatus = "HALF_DAY"; }
    else if (h >= shift.quarterDayHours) { workedStatus = "HALF_DAY"; }

    todayRecord.workedStatus = workedStatus;
    todayRecord.attendanceCategory = attendanceCategory;

    await attendance.save();

    // ✅ NO email sent for break — employee is expected to punch back in
    res.json({ success: true, message: `Break started. Worked so far: ${h}h ${m}m`, data: todayRecord });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= ADMIN PUNCH OUT ROUTE ================= */
router.post('/admin-punch-out', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, punchOutTime, latitude, longitude, date } = req.body;

    if (!employeeId || !punchOutTime || !date) {
      return res.status(400).json({ message: "Employee ID, Punch Out Time and Date are required" });
    }

    const punchOutDateObj = new Date(punchOutTime);
    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "No attendance record found" });

    let targetDateStr = date.includes("T") ? date.split("T")[0] : date;
    let dayRecord = attendance.attendance.find(a => a.date === targetDateStr);

    if (!dayRecord) {
      return res.status(400).json({ message: `No attendance entry found for date: ${targetDateStr}` });
    }

    const sessions = dayRecord.sessions || [];
    const openSession = sessions.find(s => !s.punchOut);

    if (openSession) {
      openSession.punchOut = punchOutDateObj;
      openSession.durationSeconds = (punchOutDateObj - new Date(openSession.punchIn)) / 1000;
    }

    dayRecord.punchOut = punchOutDateObj;
    dayRecord.punchOutLocation = {
      latitude: latitude || 0,
      longitude: longitude || 0,
      address: "Admin Force Logout",
      timestamp: new Date()
    };
    dayRecord.status = "COMPLETED";
    dayRecord.adminPunchOut = true;
    dayRecord.adminPunchOutBy = req.user.name;
    dayRecord.adminPunchOutTimestamp = new Date();

    let totalSeconds = 0;
    dayRecord.sessions.forEach(sess => {
      if (sess.punchIn && sess.punchOut) {
        totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
      }
    });

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    dayRecord.workedHours = h;
    dayRecord.workedMinutes = m;
    dayRecord.workedSeconds = s;
    dayRecord.displayTime = `${h}h ${m}m ${s}s`;

    let shift = await Shift.findOne({ employeeId });
    if (!shift) shift = { fullDayHours: 8, halfDayHours: 4, quarterDayHours: 2 };

    let workedStatus = "ABSENT";
    if (h >= shift.fullDayHours) workedStatus = "FULL_DAY";
    else if (h >= shift.halfDayHours) workedStatus = "HALF_DAY";
    else if (h >= shift.quarterDayHours) workedStatus = "HALF_DAY";

    dayRecord.workedStatus = workedStatus;
    dayRecord.attendanceCategory = workedStatus === "FULL_DAY" ? "FULL_DAY" : (workedStatus === "HALF_DAY" ? "HALF_DAY" : "ABSENT");

    await attendance.save();
    res.json({ success: true, message: "Employee punched out by Admin successfully", data: dayRecord });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= CORRECTION REQUESTS ================= */
router.post('/request-correction', async (req, res) => {
  try {
    const { employeeId, date, time, reason } = req.body;
    let attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "Attendance record not found" });

    const now = new Date();
    const currentYearMonth = now.toISOString().slice(0, 7);

    const monthlyRequestCount = attendance.attendance.filter(day =>
      day.date.startsWith(currentYearMonth) &&
      day.lateCorrectionRequest?.hasRequest === true
    ).length;

    if (monthlyRequestCount >= 3) {
      return res.status(400).json({
        success: false,
        message: "Monthly limit reached. You can only submit 3 login correction requests per month."
      });
    }

    let dayRecord = attendance.attendance.find(a => a.date === date);
    if (!dayRecord) return res.status(400).json({ message: "No attendance found for this date." });

    if (dayRecord.lateCorrectionRequest?.hasRequest) {
      return res.status(400).json({ message: "A request for this date has already been submitted." });
    }

    const requestedDateObj = new Date(`${date}T${time}:00`);

    dayRecord.lateCorrectionRequest = {
      hasRequest: true,
      status: "PENDING",
      requestedTime: requestedDateObj,
      reason: reason
    };

    await attendance.save();
    res.json({ success: true, message: `Request sent to Admin. (${monthlyRequestCount + 1}/3 used this month)` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:employeeId', async (req, res) => {
  try {
    const requestedId = req.params.employeeId;
    const loggedUser = req.user;
    if (loggedUser.role !== "admin" && loggedUser.employeeId !== requestedId) {
      return res.status(403).json({ message: "Access denied." });
    }
    const record = await Attendance.findOne({ employeeId: requestedId });
    if (!record) return res.json({ success: true, data: [] });
    const sorted = record.attendance.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: sorted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/request-limit/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const attendanceRecord = await Attendance.findOne({ employeeId });
    if (!attendanceRecord) return res.status(404).json({ message: "Employee not found" });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthData = attendanceRecord.monthlyRequestLimits?.get(currentMonth) || { limit: 5, used: 0 };

    res.json({
      employeeId,
      employeeName: attendanceRecord.employeeName,
      monthlyRequestLimits: { [currentMonth]: monthData }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/set-request-limit", async (req, res) => {
  try {
    const { employeeId, limit } = req.body;
    if (!employeeId || limit === undefined) return res.status(400).json({ message: "Employee ID and limit are required" });

    const attendanceRecord = await Attendance.findOne({ employeeId });
    if (!attendanceRecord) return res.status(404).json({ message: "Employee not found" });

    const currentMonth = new Date().toISOString().slice(0, 7);
    if (!attendanceRecord.monthlyRequestLimits) attendanceRecord.monthlyRequestLimits = new Map();

    const currentData = attendanceRecord.monthlyRequestLimits.get(currentMonth) || { limit: 5, used: 0 };
    if (limit < currentData.used) return res.status(400).json({ message: `Cannot set limit lower than used requests.` });

    attendanceRecord.monthlyRequestLimits.set(currentMonth, { limit: parseInt(limit), used: currentData.used });
    await attendanceRecord.save({ validateBeforeSave: false });

    res.json({ success: true, message: "Request limit updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/submit-late-correction", async (req, res) => {
  try {
    const { employeeId, date, requestedTime, reason } = req.body;
    const attendanceRecord = await Attendance.findOne({ employeeId });
    if (!attendanceRecord) return res.status(404).json({ message: "Employee not found" });

    const dayLog = attendanceRecord.attendance.find(a => a.date === date);
    if (!dayLog) return res.status(404).json({ message: "Attendance record not found" });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthData = attendanceRecord.monthlyRequestLimits?.get(currentMonth) || { limit: 5, used: 0 };

    if (monthData.used >= monthData.limit) return res.status(400).json({ message: "Monthly limit reached", limitReached: true });

    dayLog.lateCorrectionRequest = {
      hasRequest: true,
      status: "PENDING",
      requestedTime: new Date(requestedTime),
      reason,
    };

    attendanceRecord.monthlyRequestLimits.set(currentMonth, { limit: monthData.limit, used: monthData.used + 1 });
    await attendanceRecord.save();
    res.json({ success: true, message: "Request submitted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/approve-correction", async (req, res) => {
  try {
    const { employeeId, date, status, adminComment } = req.body;
    const attendanceRecord = await Attendance.findOne({ employeeId });
    if (!attendanceRecord) return res.status(404).json({ message: "Employee not found" });

    const dayLog = attendanceRecord.attendance.find(a => a.date === date);
    if (!dayLog || !dayLog.lateCorrectionRequest?.hasRequest) return res.status(404).json({ message: "No request found" });

    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthData = attendanceRecord.monthlyRequestLimits?.get(currentMonth) || { limit: 5, used: 0 };

    if (status === "APPROVED") {
      const newPunchIn = new Date(dayLog.lateCorrectionRequest.requestedTime);
      dayLog.punchIn = newPunchIn;
      if (dayLog.sessions.length > 0) {
        dayLog.sessions[0].punchIn = newPunchIn;
        if (dayLog.sessions[0].punchOut) {
          dayLog.sessions[0].durationSeconds = (new Date(dayLog.sessions[0].punchOut) - newPunchIn) / 1000;
        }
      }
      let shift = await Shift.findOne({ employeeId }) || { shiftStartTime: "09:00", lateGracePeriod: 15 };
      const diffMin = getTimeDifferenceInMinutes(newPunchIn, shift.shiftStartTime);
      dayLog.loginStatus = diffMin <= shift.lateGracePeriod ? "ON_TIME" : "LATE";
      dayLog.lateCorrectionRequest.status = "APPROVED";
    } else {
      dayLog.lateCorrectionRequest.status = "REJECTED";
      if (monthData.used > 0) attendanceRecord.monthlyRequestLimits.set(currentMonth, { limit: monthData.limit, used: monthData.used - 1 });
    }

    dayLog.lateCorrectionRequest.adminComment = adminComment;
    await attendanceRecord.save();
    res.json({ success: true, message: "Status updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ================= STATUS CORRECTION ================= */
router.post('/request-status-correction', async (req, res) => {
  try {
    const { employeeId, date, requestedPunchOut, reason } = req.body;
    const attendance = await Attendance.findOne({ employeeId });
    const dayRecord = attendance.attendance.find(a => a.date === date);
    if (!dayRecord.punchIn) return res.status(400).json({ message: "No punch-in found" });

    dayRecord.statusCorrectionRequest = {
      hasRequest: true,
      status: "PENDING",
      requestedPunchOut: new Date(`${date}T${requestedPunchOut}:00`),
      reason: reason
    };

    await attendance.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approve-status-correction', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, date, adminComment } = req.body;
    const attendance = await Attendance.findOne({ employeeId });
    const dayRecord = attendance.attendance.find(a => a.date === date);
    const newPunchOut = new Date(dayRecord.statusCorrectionRequest.requestedPunchOut);

    dayRecord.punchOut = newPunchOut;
    if (dayRecord.sessions.length > 0) {
      dayRecord.sessions[dayRecord.sessions.length - 1].punchOut = newPunchOut;
    }

    let totalSeconds = 0;
    dayRecord.sessions.forEach(sess => {
      if (sess.punchIn && sess.punchOut) totalSeconds += (new Date(sess.punchOut) - new Date(sess.punchIn)) / 1000;
    });

    dayRecord.workedHours = Math.floor(totalSeconds / 3600);
    dayRecord.workedMinutes = Math.floor((totalSeconds % 3600) / 60);
    dayRecord.workedSeconds = Math.floor(totalSeconds % 60);
    dayRecord.workedStatus = "FULL_DAY";
    dayRecord.status = "COMPLETED";
    dayRecord.statusCorrectionRequest.status = "APPROVED";
    dayRecord.statusCorrectionRequest.adminComment = adminComment;

    await attendance.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= GET ALL STATUS CORRECTION REQUESTS (ADMIN) ================= */
router.get('/admin/status-correction-requests', onlyAdmin, async (req, res) => {
  try {
    const allRecords = await Attendance.find({});
    const requests = [];

    allRecords.forEach(empRecord => {
      empRecord.attendance.forEach(dayLog => {
        if (dayLog.statusCorrectionRequest && dayLog.statusCorrectionRequest.hasRequest && dayLog.statusCorrectionRequest.status === "PENDING") {
          requests.push({
            employeeId: empRecord.employeeId,
            employeeName: empRecord.employeeName,
            date: dayLog.date,
            punchIn: dayLog.punchIn,
            currentStatus: dayLog.status,
            requestedPunchOut: dayLog.statusCorrectionRequest.requestedPunchOut,
            reason: dayLog.statusCorrectionRequest.reason,
            status: dayLog.statusCorrectionRequest.status
          });
        }
      });
    });

    requests.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ success: true, data: requests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ================= REJECT STATUS CORRECTION ================= */
router.post('/reject-status-correction', onlyAdmin, async (req, res) => {
  try {
    const { employeeId, date, adminComment } = req.body;
    const attendance = await Attendance.findOne({ employeeId });
    if (!attendance) return res.status(404).json({ message: "Attendance record not found" });
    const dayRecord = attendance.attendance.find(a => a.date === date);
    if (!dayRecord || !dayRecord.statusCorrectionRequest) {
      return res.status(404).json({ message: "No request found for this date" });
    }
    dayRecord.statusCorrectionRequest.status = "REJECTED";
    dayRecord.statusCorrectionRequest.adminComment = adminComment || "Rejected by Admin";
    await attendance.save();
    res.json({ success: true, message: "Request rejected successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;