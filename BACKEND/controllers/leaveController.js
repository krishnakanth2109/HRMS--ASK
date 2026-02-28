// --- UPDATED FILE: controllers/leaveController.js ---

import LeaveRequest from "../models/LeaveRequest.js";
import Notification from "../models/notificationModel.js";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
import nodemailer from 'nodemailer';

/* ================= EMAIL CONFIGURATION (Based on working Attendance Logic) ================= */
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

// Helper: List dates
function listDates(fromStr, toStr) {
  const out = [];
  const from = new Date(fromStr);
  const to = new Date(toStr);

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/* ================= EMAIL TEMPLATE FOR LEAVE STATUS ================= */
const createLeaveStatusEmail = (data) => {
  const { employeeName, status, from, to, leaveType, reason, approvedBy } = data;
  
  const statusColor = status === "Approved" ? "#10b981" : "#ef4444";
  const headerGradient = status === "Approved" 
    ? "linear-gradient(135deg,#059669,#10b981)" 
    : "linear-gradient(135deg,#b91c1c,#ef4444)";

  return `
<!DOCTYPE html>
<html>
<body style="margin:0; padding:0; background-color:#eef2f7; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 8px 20px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background:${headerGradient}; padding:35px 30px; text-align:center;">
              <h1 style="margin:0; font-size:24px; color:#ffffff; font-weight:700;">
                Leave Request ${status}
              </h1>
              <p style="margin:8px 0 0 0; color:#f0fdf4; font-size:14px; opacity:0.9;">
                Official Leave Management Notification
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:35px 30px;">
              <p style="margin:0 0 18px 0; font-size:16px; color:#1f2937;">
                Dear <strong>${employeeName}</strong>,
              </p>

              <p style="margin:0 0 25px 0; font-size:15px; color:#4b5563; line-height:1.7;">
                Your leave request has been processed. Below are the details of the decision:
              </p>

              <!-- Info Card -->
              <table width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc; border-radius:10px; padding:20px; border:1px solid #e5e7eb; margin-bottom:25px;">
                <tr>
                  <td>
                    <table width="100%" style="font-size:14px; border-collapse:collapse;">
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">Status</td>
                        <td style="padding:10px 0; text-align:right; font-weight:700; color:${statusColor};">
                          ${status.toUpperCase()}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">Leave Type</td>
                        <td style="padding:10px 0; text-align:right; font-weight:600; color:#111827;">${leaveType}</td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">Duration</td>
                        <td style="padding:10px 0; text-align:right; font-weight:600; color:#111827;">
                          ${new Date(from).toLocaleDateString()} - ${new Date(to).toLocaleDateString()}
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:10px 0; color:#6b7280;">Reason</td>
                        <td style="padding:10px 0; text-align:right; color:#4b5563;">${reason || 'N/A'}</td>
                      </tr>
                      <tr style="border-top:1px solid #e5e7eb;">
                        <td style="padding:12px 0; color:#6b7280;">Actioned By</td>
                        <td style="padding:12px 0; text-align:right; font-weight:bold; color:#111827;">
                          ${approvedBy}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin:0; font-size:14px; color:#4b5563;">
                If you have any questions, please contact the HR department or your manager.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f3f4f6; padding:18px; text-align:center; font-size:12px; color:#9ca3af;">
              © ${new Date().getFullYear()} Attendance Management System <br/>
              This is an automated notification regarding your leave application.
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

// ===================================================================================
// ✅ EMPLOYEE CREATES LEAVE (ADMIN GETS EMAIL)
// ===================================================================================
export const createLeave = async (req, res) => {
  try {
    const loggedUser = req.user; 
    const { _id: userMongoId, name } = loggedUser;
    const { from, to, reason, leaveType, leaveDayType, halfDaySession = "" } = req.body;

    if (!from || !to || !reason || !leaveType || !leaveDayType) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const monthKey = from.slice(0, 7);
    const details = listDates(from, to).map((date) => ({
      date,
      leavecategory: "UnPaid",
      leaveType,
      leaveDayType: from === to ? leaveDayType : "Full Day",
    }));

    const doc = await LeaveRequest.create({
      employeeId: loggedUser.employeeId || null,
      employeeName: loggedUser.name || "Unknown",
      from,
      to,
      reason,
      leaveType,
      leaveDayType,
      halfDaySession,
      monthKey,
      status: "Pending",
      approvedBy: "-",
      actionDate: "-",
      requestDate: new Date().toISOString().slice(0, 10),
      details,
    });

    // 📧 SEND EMAIL TO ADMINS (Using SMTP)
    try {
      const admins = await Admin.find().lean();
      const adminEmails = admins.map(admin => admin.email).filter(Boolean);
      const specificAdminEmail = "oragantisagar041@gmail.com";
      
      if (!adminEmails.includes(specificAdminEmail)) {
        adminEmails.push(specificAdminEmail);
      }

      if (adminEmails.length > 0) {
        const mailOptions = {
          from: ` <${process.env.SMTP_USER}>`,
          to: adminEmails.join(','),
          subject: `New Leave Request: ${name}`,
          html: `<h3>New Leave Request Submitted</h3>
                 <p><strong>Employee:</strong> ${name} (${loggedUser.employeeId})</p>
                 <p><strong>Type:</strong> ${leaveType}</p>
                 <p><strong>Dates:</strong> ${from} to ${to}</p>
                 <p><strong>Reason:</strong> ${reason}</p>
                 <p>Please login to the Admin Portal to review.</p>`
        };
        await transporter.sendMail(mailOptions);
      }
    } catch (emailErr) {
      console.error("❌ Failed to send Leave Notification to Admin:", emailErr);
    }

    // In-app Notifications
    const admins = await Admin.find().lean();
    const notifList = [];
    for (const admin of admins) {
      const notif = await Notification.create({
        userId: admin._id.toString(),
        title: "New Leave Request",
        message: `${name} submitted a leave request (${from} → ${to})`,
        type: "leave",
        isRead: false,
      });
      notifList.push(notif);
    }

    const io = req.app.get("io");
    if (io) notifList.forEach((n) => io.emit("newNotification", n));

    return res.status(201).json(doc);
  } catch (err) {
    console.error("createLeave error:", err);
    res.status(500).json({ message: "Failed to create leave request." });
  }
};

// ===================================================================================
// FETCH USER LEAVES
// ===================================================================================
export const listLeavesForEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user;
    const { month, status } = req.query;
    const query = { employeeId };
    if (month) query.monthKey = month;
    if (status && status !== "All") query.status = status;
    const docs = await LeaveRequest.find(query).sort({ requestDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your leave requests." });
  }
};

// ===================================================================================
// ADMIN LIST ALL LEAVES
// ===================================================================================
export const adminListAllLeaves = async (req, res) => {
  try {
    const docs = await LeaveRequest.find().sort({ requestDate: -1 }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch all leave requests." });
  }
};

// ===================================================================================
// GET DETAILS
// ===================================================================================
export const getLeaveDetails = async (req, res) => {
  try {
    const doc = await LeaveRequest.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ message: "Not found" });
    const isAdmin = req.user.role === "admin";
    const isOwner = doc.employeeId === req.user.employeeId;
    if (!isAdmin && !isOwner) return res.status(403).json({ message: "Unauthorized" });
    res.json(doc.details || []);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch leave details." });
  }
};

// ===================================================================================
// ✅ ADMIN UPDATES LEAVE STATUS (EMPLOYEE GETS EMAIL)
// ===================================================================================
export const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const approvedBy = req.user.name;

    if (!["Approved", "Rejected", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const doc = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approvedBy,
        actionDate: new Date().toISOString().slice(0, 10),
      },
      { new: true }
    );

    if (!doc) return res.status(404).json({ message: "Leave request not found" });

    const employee = await Employee.findOne({ employeeId: doc.employeeId });

    if (employee) {
      // 1. Create in-app notification
      const notif = await Notification.create({
        userId: employee._id,
        userType: "Employee",
        title: "Leave Status Update",
        message: `Your leave request (${doc.from} → ${doc.to}) has been ${status} by ${approvedBy}.`,
        type: "leave-status",
        isRead: false,
      });

      const io = req.app.get("io");
      if (io) io.emit("newNotification", notif);

      // 2. 📧 SEND EMAIL TO EMPLOYEE (Using SMTP)
      if (employee.email) {
        try {
          const mailOptions = {
            from: `"Leave Management" <${process.env.SMTP_USER}>`,
            to: employee.email,
            subject: `Leave Request Update: ${status}`,
            html: createLeaveStatusEmail({
              employeeName: employee.name,
              status: status,
              from: doc.from,
              to: doc.to,
              leaveType: doc.leaveType,
              reason: doc.reason,
              approvedBy: approvedBy
            }),
          };
          await transporter.sendMail(mailOptions);
          console.log(`✅ Leave status email sent to ${employee.email}`);
        } catch (emailErr) {
          console.error('❌ Error sending leave status email:', emailErr);
        }
      }
    }

    return res.json(doc);
  } catch (err) {
    console.error("updateLeaveStatus error:", err);
    res.status(500).json({ message: "Failed to update leave status." });
  }
};

// ===================================================================================
// EMPLOYEE CANCEL LEAVE
// ===================================================================================
export const cancelLeave = async (req, res) => {
  try {
    const leave = await LeaveRequest.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: "Not found" });
    if (leave.status !== "Pending") return res.status(400).json({ message: "Cannot cancel this leave" });

    await LeaveRequest.findByIdAndDelete(req.params.id);

    const admins = await Admin.find().lean();
    const notifList = [];
    for (const admin of admins) {
      const notif = await Notification.create({
        userId: admin._id.toString(),
        title: "Leave Cancelled",
        message: `${req.user.name} cancelled a leave (${leave.from} → ${leave.to})`,
        type: "leave",
        isRead: false,
      });
      notifList.push(notif);
    }
    const io = req.app.get("io");
    if (io) notifList.forEach((n) => io.emit("newNotification", n));
    return res.json({ message: "Leave cancelled successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};