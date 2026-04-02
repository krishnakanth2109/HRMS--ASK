// --- UPDATED FILE: controllers/leaveController.js ---

import LeaveRequest from "../models/LeaveRequest.js";
import Notification from "../models/notificationModel.js";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

/* ===============================================================
   SMTP TRANSPORTER
=============================================================== */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_PORT == 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
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

/* ===============================================================
   EMAIL ACTION TOKEN HELPERS
   Each token encodes { leaveId, action, adminId } and expires in 7 days.
   The admin clicks the button in their email → hits the public
   /api/leaves/email-action route → DB updated instantly.
=============================================================== */
const generateEmailActionToken = (leaveId, action, adminId) =>
  jwt.sign(
    { leaveId, action, adminId: adminId?.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

/* ===============================================================
   EMAIL TEMPLATE — Admin notified with APPROVE / REJECT buttons
=============================================================== */
const createAdminLeaveNotificationEmail = ({
  name, employeeId, email, leaveType, from, to, reason,
  approveUrl, rejectUrl,
}) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);
                     padding:38px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#bfdbfe;
                      letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              Leave Management
            </p>
            <h1 style="margin:0;font-size:26px;color:#ffffff;font-weight:800;">
              New Leave Request
            </h1>
            <p style="margin:10px 0 0;color:#e0e7ff;font-size:14px;opacity:0.9;">
              Action Required &mdash; Pending Your Approval
            </p>
          </td>
        </tr>

        <!-- Alert Banner -->
        <tr>
          <td style="background:#eff6ff;border-bottom:3px solid #3b82f6;
                     padding:13px 32px;text-align:center;">
            <p style="margin:0;font-size:13px;color:#1d4ed8;font-weight:600;">
              You can approve or reject this request directly from this email
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 32px 28px;">
            <p style="margin:0 0 22px;font-size:15px;color:#374151;line-height:1.7;">
              A new leave application has been submitted by <strong>${name}</strong>
              and is awaiting your review.
            </p>

            <!-- Employee Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">Employee Details</p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:20px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:36%;">Employee Name</td>
                    <td style="padding:9px 0;text-align:right;font-weight:700;color:#111827;">
                      ${name}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Employee ID</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                      ${employeeId || "N/A"}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">Email</td>
                    <td style="padding:9px 0;text-align:right;">
                      <a href="mailto:${email}"
                         style="color:#3b82f6;text-decoration:none;font-weight:600;">
                        ${email || "N/A"}
                      </a>
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Leave Details -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">Leave Details</p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 20px;
                          border:1px solid #e5e7eb;margin-bottom:28px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:9px 0;color:#6b7280;width:36%;">Leave Type</td>
                    <td style="padding:9px 0;text-align:right;">
                      <span style="background:#dbeafe;color:#1d4ed8;padding:3px 12px;
                                   border-radius:20px;font-size:13px;font-weight:600;">
                        ${leaveType}
                      </span>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">From Date</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                      ${new Date(from).toLocaleDateString("en-IN", {
                        weekday: "short", year: "numeric",
                        month: "short", day: "numeric",
                      })}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #f1f5f9;">
                    <td style="padding:9px 0;color:#6b7280;">To Date</td>
                    <td style="padding:9px 0;text-align:right;font-weight:600;color:#111827;">
                      ${new Date(to).toLocaleDateString("en-IN", {
                        weekday: "short", year: "numeric",
                        month: "short", day: "numeric",
                      })}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0 4px;color:#6b7280;vertical-align:top;">Reason</td>
                    <td style="padding:12px 0 4px;text-align:right;color:#4b5563;font-style:italic;">
                      &ldquo;${reason || "No reason provided."}&rdquo;
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- ✅ ACTION BUTTONS -->
            <p style="margin:0 0 14px;font-size:13px;font-weight:700;color:#374151;
                      text-align:center;text-transform:uppercase;letter-spacing:1px;">
              Take Action
            </p>
            <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:24px;">
              <tr>
                <!-- APPROVE -->
                <td width="48%" align="center" style="padding-right:6px;">
                  <a href="${approveUrl}"
                     style="display:block;background:linear-gradient(135deg,#059669,#10b981);
                            color:#ffffff;text-decoration:none;padding:14px 10px;
                            border-radius:10px;font-size:15px;font-weight:700;
                            text-align:center;letter-spacing:0.5px;">
                    &#10003;&nbsp; Approve Leave
                  </a>
                </td>
                <!-- REJECT -->
                <td width="4%"></td>
                <td width="48%" align="center" style="padding-left:6px;">
                  <a href="${rejectUrl}"
                     style="display:block;background:linear-gradient(135deg,#b91c1c,#ef4444);
                            color:#ffffff;text-decoration:none;padding:14px 10px;
                            border-radius:10px;font-size:15px;font-weight:700;
                            text-align:center;letter-spacing:0.5px;">
                    &#10007;&nbsp; Reject Leave
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6;">
              These links are valid for <strong>7 days</strong> and can only be used once.<br/>
              You can also manage this request from the Admin Portal.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Leave Management System &nbsp;&bull;&nbsp;
            This is an automated notification. Please do not reply directly.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

/* ===============================================================
   EMAIL TEMPLATE — Employee notified when admin acts on leave
=============================================================== */
const createLeaveStatusEmail = ({
  employeeName, status, from, to, leaveType, reason, approvedBy,
}) => {
  const statusColor    = status === "Approved" ? "#10b981" : "#ef4444";
  const headerGradient = status === "Approved"
    ? "linear-gradient(135deg,#059669,#10b981)"
    : "linear-gradient(135deg,#b91c1c,#ef4444)";

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 20px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:${headerGradient};padding:35px 30px;text-align:center;">
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:700;">
              Leave Request ${status}
            </h1>
            <p style="margin:8px 0 0;color:#f0fdf4;font-size:14px;opacity:0.9;">
              Official Leave Management Notification
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:35px 30px;">
            <p style="margin:0 0 18px;font-size:16px;color:#1f2937;">
              Dear <strong>${employeeName}</strong>,
            </p>
            <p style="margin:0 0 25px;font-size:15px;color:#4b5563;line-height:1.7;">
              Your leave request has been processed. Below are the details of the decision:
            </p>

            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:20px;
                          border:1px solid #e5e7eb;margin-bottom:25px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Status</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:${statusColor};">
                      ${status.toUpperCase()}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Leave Type</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${leaveType}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Duration</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${new Date(from).toLocaleDateString()} &ndash; ${new Date(to).toLocaleDateString()}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:10px 0;color:#6b7280;">Reason</td>
                    <td style="padding:10px 0;text-align:right;color:#4b5563;">
                      ${reason || "N/A"}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #e5e7eb;">
                    <td style="padding:12px 0;color:#6b7280;">Actioned By</td>
                    <td style="padding:12px 0;text-align:right;font-weight:bold;color:#111827;">
                      ${approvedBy}
                    </td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:#4b5563;">
              If you have any questions, please contact the HR department or your manager.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:18px;text-align:center;
                     font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Attendance Management System<br/>
            This is an automated notification regarding your leave application.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

/* ===============================================================
   INLINE HTML RESPONSE — shown in browser when admin clicks button
=============================================================== */
// success = true (action worked) | false (error/expired)
// action = "Approved" | "Rejected" | "Error" | "Expired" | etc.
const emailActionResultPage = (success, action, employeeName, message) => {
  // Color is based on the action taken, not just success/failure
  const isApproved = action === "Approved";
  const isError    = !success;

  const headerGradient = isError
    ? "linear-gradient(135deg,#374151,#6b7280)"       // grey for errors
    : isApproved
      ? "linear-gradient(135deg,#059669,#10b981)"      // green for approved
      : "linear-gradient(135deg,#b91c1c,#ef4444)";    // red for rejected

  const icon = isError ? "&#9888;" : isApproved ? "&#10003;" : "&#10007;";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Leave Action — HRMS</title>
</head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Tahoma,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
         style="padding:60px 15px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:16px;overflow:hidden;
                    box-shadow:0 8px 32px rgba(0,0,0,0.10);">
        <tr>
          <td style="background:${headerGradient};padding:40px 32px;text-align:center;">
            <div style="font-size:52px;margin-bottom:12px;color:#ffffff;">
              ${icon}
            </div>
            <h1 style="margin:0;font-size:24px;color:#ffffff;font-weight:800;">
              Leave ${action}
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;text-align:center;">
            <p style="margin:0 0 12px;font-size:16px;color:#1f2937;font-weight:600;">
              ${message}
            </p>
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
              ${success && employeeName
                ? `${employeeName} will be notified via email about this decision.`
                : "Please use the Admin Portal to manage leave requests."}
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f3f4f6;padding:16px;text-align:center;
                     font-size:12px;color:#9ca3af;">
            &copy; ${new Date().getFullYear()} Attendance Management System
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`; };

// ===================================================================================
// ✅ EMPLOYEE CREATES LEAVE → Email with action buttons sent to scoped Admin
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
      employeeId:   loggedUser.employeeId || null,
      employeeName: loggedUser.name || "Unknown",
      from,
      to,
      reason,
      leaveType,
      leaveDayType,
      halfDaySession,
      monthKey,
      status:      "Pending",
      approvedBy:  "-",
      actionDate:  "-",
      requestDate: new Date().toISOString().slice(0, 10),
      details,
    });

    // 📧 SEND EMAIL TO ADMINS WITH APPROVE/REJECT BUTTONS
    try {
      const admins = await Admin.find().lean();
      const adminEmails = admins.map((a) => a.email).filter(Boolean);

      if (adminEmails.length > 0) {
        // Find the primary admin to scope the action token
        const primaryAdmin = admins[0];

        // Generate one-click action tokens (7-day expiry)
        const approveToken = generateEmailActionToken(doc._id, "Approved", primaryAdmin._id);
        const rejectToken  = generateEmailActionToken(doc._id, "Rejected", primaryAdmin._id);

        const BASE_URL = process.env.VITE_API_URL_PRODUCTION || "https://hrms-ask-1jx6.onrender.com";
        const approveUrl = `${BASE_URL}/api/leaves/email-action?token=${approveToken}`;
        const rejectUrl  = `${BASE_URL}/api/leaves/email-action?token=${rejectToken}`;

        await transporter.sendMail({
          from:    `"HRMS Leave Request Notification" <${process.env.SMTP_USER}>`,
          to:      adminEmails.join(","),
          subject: `New Leave Request from ${name} — Action Required`,
          html:    createAdminLeaveNotificationEmail({
            name,
            employeeId: loggedUser.employeeId,
            email:      loggedUser.email,
            leaveType,
            from,
            to,
            reason,
            approveUrl,
            rejectUrl,
          }),
        });
        console.log(`✅ Leave notification email (with action buttons) sent to: ${adminEmails.join(", ")}`);
      }
    } catch (emailErr) {
      console.error("❌ Failed to send Leave Notification to Admin:", emailErr);
    }

    // In-app Notifications
    const admins = await Admin.find().lean();
    const notifList = [];
    for (const admin of admins) {
      const notif = await Notification.create({
        userId:  admin._id.toString(),
        title:   "New Leave Request",
        message: `${name} submitted a leave request (${from} → ${to})`,
        type:    "leave",
        isRead:  false,
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
// ✅ EMAIL ACTION HANDLER — Public route, no auth needed
//    Admin clicks Approve/Reject button in email → lands here
//    Route: GET /api/leaves/email-action?token=JWT
// ===================================================================================
export const handleEmailAction = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).send(
        emailActionResultPage(false, "Error", "", "No action token provided.")
      );
    }

    // Verify and decode the token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      return res.status(400).send(
        emailActionResultPage(false, "Expired", "", "This action link has expired or is invalid. Please use the Admin Portal.")
      );
    }

    const { leaveId, action, adminId } = decoded;

    if (!["Approved", "Rejected"].includes(action)) {
      return res.status(400).send(
        emailActionResultPage(false, "Error", "", "Invalid action in token.")
      );
    }

    // Find the leave BEFORE updating — use this for employeeName
    const leave = await LeaveRequest.findById(leaveId);

    if (!leave) {
      return res.status(404).send(
        emailActionResultPage(false, "Not Found", "", "This leave request no longer exists.Might be Employee Cancelled his Leave")
      );
    }

    if (leave.status !== "Pending") {
      return res.status(200).send(
        emailActionResultPage(
          false,
          leave.status,
          leave.employeeName || "Employee",
          `This leave request has already been ${leave.status}. No further action needed.`
        )
      );
    }

    // Find admin name for the approvedBy field
    const admin = await Admin.findById(adminId).lean();
    const approvedBy = admin?.name || "Admin";

    // Update the leave
    const updated = await LeaveRequest.findByIdAndUpdate(
      leaveId,
      {
        status:     action,
        approvedBy,
        actionDate: new Date().toISOString().slice(0, 10),
      },
      { new: true }
    );

    // Use leave.employeeName (pre-update) as primary, fallback to updated fields
    const employeeName = leave.employeeName || updated?.employeeName || "Employee";

    // Notify employee in-app + send email
    const employee = await Employee.findOne({ employeeId: leave.employeeId });

    if (employee) {
      await Notification.create({
        userId:   employee._id,
        userType: "Employee",
        title:    "Leave Status Update",
        message:  `Your leave request (${leave.from} → ${leave.to}) has been ${action} by ${approvedBy}.`,
        type:     "leave-status",
        isRead:   false,
      });

      if (employee.email) {
        try {
          await transporter.sendMail({
            from:    `"Leave Management" <${process.env.SMTP_USER}>`,
            to:      employee.email,
            subject: `Leave Request ${action}: ${leave.from} to ${leave.to}`,
            html:    createLeaveStatusEmail({
              employeeName: employee.name || employeeName,
              status:       action,
              from:         leave.from,
              to:           leave.to,
              leaveType:    leave.leaveType,
              reason:       leave.reason,
              approvedBy,
            }),
          });
          console.log(`✅ Leave status email sent to employee: ${employee.email}`);
        } catch (emailErr) {
          console.error("❌ Failed to send leave status email to employee:", emailErr);
        }
      }
    }

    // Return styled confirmation page — color matches action
    return res.status(200).send(
      emailActionResultPage(
        true,
        action,
        employeeName,
        `Leave request of ${employeeName} has been ${action} successfully.`
      )
    );
  } catch (err) {
    console.error("handleEmailAction error:", err);
    return res.status(500).send(
      emailActionResultPage(false, "Error", "", "A server error occurred. Please use the Admin Portal.")
    );
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
// ADMIN UPDATES LEAVE STATUS (EMPLOYEE GETS EMAIL) — used by portal UI
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
      const notif = await Notification.create({
        userId:   employee._id,
        userType: "Employee",
        title:    "Leave Status Update",
        message:  `Your leave request (${doc.from} → ${doc.to}) has been ${status} by ${approvedBy}.`,
        type:     "leave-status",
        isRead:   false,
      });

      const io = req.app.get("io");
      if (io) io.emit("newNotification", notif);

      if (employee.email) {
        try {
          await transporter.sendMail({
            from:    `"Leave Management" <${process.env.SMTP_USER}>`,
            to:      employee.email,
            subject: `Leave Request Update: ${status}`,
            html:    createLeaveStatusEmail({
              employeeName: employee.name,
              status,
              from:      doc.from,
              to:        doc.to,
              leaveType: doc.leaveType,
              reason:    doc.reason,
              approvedBy,
            }),
          });
          console.log(`✅ Leave status email sent to ${employee.email}`);
        } catch (emailErr) {
          console.error("❌ Error sending leave status email:", emailErr);
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
        userId:  admin._id.toString(),
        title:   "Leave Cancelled",
        message: `${req.user.name} cancelled a leave (${leave.from} → ${leave.to})`,
        type:    "leave",
        isRead:  false,
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