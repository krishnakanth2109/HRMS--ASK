// --- UPDATED FILE: punchOutRequestRoutes.js ---

import express from "express";
import PunchOutRequest from "../models/PunchOutRequest.js";
import Attendance from "../models/Attendance.js";
import Employee from "../models/employeeModel.js";
import nodemailer from "nodemailer";

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

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ PunchOut Mail Server Error:", error);
  } else {
    console.log("✅ PunchOut Mail Server is ready");
  }
});

/* ================= EMAIL TEMPLATE ================= */
const createPunchOutStatusEmail = (data) => {
  const { employeeName, status, originalDate, requestedTime, reason, adminComment } = data;

  const statusColor = status === "Approved" ? "#10b981" : "#ef4444";
  const headerGradient = status === "Approved"
    ? "linear-gradient(135deg,#059669,#10b981)"
    : "linear-gradient(135deg,#b91c1c,#ef4444)";

  return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 25px rgba(0,0,0,0.1);">
          
          <tr>
            <td style="background:${headerGradient}; padding:40px 30px; text-align:center;">
              <h1 style="margin:0; font-size:24px; color:#ffffff; font-weight:700;">
                Punch-Out Correction ${status}
              </h1>
            </td>
          </tr>

          <tr>
            <td style="padding:40px 35px;">
              <p>Hi <strong>${employeeName}</strong>,</p>
              <p>Your request for <strong>${originalDate}</strong> has been <strong>${status}</strong>.</p>

              <table width="100%" style="background:#f9fafb; border-radius:12px; padding:20px; border:1px solid #e5e7eb;">
                <tr>
                  <td>Status:</td>
                  <td align="right" style="color:${statusColor}; font-weight:bold;">${status}</td>
                </tr>
                <tr>
                  <td>Date:</td>
                  <td align="right">${originalDate}</td>
                </tr>
                <tr>
                  <td>Time:</td>
                  <td align="right">${requestedTime}</td>
                </tr>
              </table>

              ${adminComment ? `
                <p style="margin-top:20px;">
                  <strong>Admin Comment:</strong> ${adminComment}
                </p>
              ` : ''}

              ${status === "Approved" ? `
                <div style="margin-top:25px; padding:15px; background:#ecfdf5; border-left:4px solid #10b981; border-radius:8px;">
                  <p style="margin:0; color:#065f46; font-weight:500;">
                    Note: Your request has been approved. Please punch in today immediately.
                  </p>
                </div>
              ` : ''}

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

// 1. Employee: Submit a Request
router.post("/create", async (req, res) => {
  try {
    const { employeeId, employeeName, originalDate, requestedPunchOut, reason } = req.body;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const requestCount = await PunchOutRequest.countDocuments({
      employeeId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth }
    });

    if (requestCount >= 3) {
      return res.status(400).json({ success: false, message: "Monthly limit reached (3 max)." });
    }

    const newRequest = new PunchOutRequest({ employeeId, employeeName, originalDate, requestedPunchOut, reason });
    await newRequest.save();
    res.json({ success: true, message: "Request submitted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. Admin: Get Pending Requests
router.get("/all", async (req, res) => {
  try {
    const requests = await PunchOutRequest.find().sort({ requestDate: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. Admin: Approve or Reject Request (WITH DEBUG CONSOLES)
router.post("/action", async (req, res) => {
  console.log("🚀 Punch-Out Action Started...");
  try {
    const { requestId, status, adminComment = "" } = req.body;
    const request = await PunchOutRequest.findById(requestId);

    if (!request) {
      console.log("❌ Request not found in database.");
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    console.log(`📝 Processing ${status} for Employee ID: ${request.employeeId}`);

    request.status = status;

    if (status === "Approved") {
      const targetDate = new Date(request.originalDate);
      const startOfDay = new Date(targetDate); startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate); endOfDay.setUTCHours(23, 59, 59, 999);

      let attendanceRecord = await Attendance.findOne({
        employeeId: request.employeeId,
        $or: [
          { punchIn: { $gte: startOfDay, $lte: endOfDay } },
          { date: { $gte: startOfDay, $lte: endOfDay } },
          { date: request.originalDate }
        ]
      });

      if (attendanceRecord && !attendanceRecord.punchOut) {
        attendanceRecord.punchOut = request.requestedPunchOut;
        attendanceRecord.status = "PRESENT";
        attendanceRecord.punchOutLocation = {
          latitude: 0,
          longitude: 0,
          address: "Manual Request Approved (Admin)",
        };
        await attendanceRecord.save();
        console.log("✅ Attendance record updated successfully.");
      } else {
        console.log("⚠️ No active attendance record found to update punch-out.");
      }
    }

    await request.save();
    console.log(`✅ Request status updated to ${status} in DB.`);

    /* ================= 📧 EMAIL DEBUG SECTION ================= */
    console.log(`🔍 Looking up email for Employee ID: ${request.employeeId}...`);
    const employee = await Employee.findOne({ employeeId: request.employeeId });

    if (!employee) {
      console.log("❌ Could not find employee details in the database.");
    } else if (!employee.email) {
      console.log(`❌ Employee found (${employee.name}), but no email address is registered.`);
    } else {
      console.log(`📧 Attempting to send email to: ${employee.email}`);

      const mailOptions = {
        from: `"Attendance System" <${process.env.SMTP_USER}>`,
        to: employee.email,
        subject: `Punch-Out Correction Request ${status}`,
        html: createPunchOutStatusEmail({
          employeeName: employee.name,
          status: status,
          originalDate: request.originalDate,
          requestedTime: new Date(request.requestedPunchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          reason: request.reason,
          adminComment: adminComment
        }),
      };

      try {
        const info = await transporter.sendMail(mailOptions);

      } catch (emailErr) {
        console.error('❌ ERROR: Nodemailer failed to send the email:', emailErr);
      }
    }
    /* ========================================================= */

    res.json({ success: true, message: `Request ${status} Successfully` });
  } catch (error) {
    console.error("❌ SYSTEM ERROR in PunchOut Action:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. Admin: Delete Request
router.delete("/delete/:id", async (req, res) => {
  try {
    const result = await PunchOutRequest.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;