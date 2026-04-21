// --- FILE: routes/mailRoutes.js ---

import express from "express";
import multer from "multer";
import transporter from "../config/nodemailer.js";
import { protect } from "../controllers/authController.js"; // Assuming you want this protected
import Employee from "../models/employeeModel.js";
import InductionDispatch from "../models/InductionDispatch.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const buildInductionPreview = ({
  employeeName,
  inductionType,
  date,
  time,
  venueOrPlatform,
  meetingLink,
  startDate,
  endDate,
  adminName,
  companyName,
}) => {
  const isDuration = inductionType === "Induction Program Duration";
  const dateValue = isDuration
    ? startDate && endDate
      ? `${startDate} to ${endDate}`
      : "To be announced"
    : date || "To be announced";
  const timeValue = isDuration
    ? time || "As per induction program schedule"
    : time || "To be announced";
  const venueOrLink =
    inductionType === "Online Module"
      ? meetingLink || "Meeting link will be shared separately"
      : venueOrPlatform || "Will be shared separately";

  const text = `Dear ${employeeName},

Greetings!

You are scheduled to attend the following induction activity. Please find the details below:

Activity: ${inductionType}
Date: ${dateValue}
Time: ${timeValue}
Venue / Platform: ${venueOrLink}

Kindly ensure your availability at the scheduled time.

Regards,
${adminName}
${companyName}`;

  const html = `
    <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
      <p>Dear ${employeeName},</p>
      <p>Greetings!</p>
      <p>You are scheduled to attend the following induction activity. Please find the details below:</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding:8px; font-weight:700;">Activity</td><td style="padding:8px;">${inductionType}</td></tr>
        <tr><td style="padding:8px; font-weight:700;">Date</td><td style="padding:8px;">${dateValue}</td></tr>
        <tr><td style="padding:8px; font-weight:700;">Time</td><td style="padding:8px;">${timeValue}</td></tr>
        <tr><td style="padding:8px; font-weight:700;">Venue / Platform</td><td style="padding:8px;">${venueOrLink}</td></tr>
      </table>
      <p>Kindly ensure your availability at the scheduled time.</p>
      <p>Regards,<br/>${adminName}<br/>${companyName}</p>
    </div>
  `;

  return { text, html, dateValue, timeValue, venueOrLink };
};

// @desc    Send Onboarding Email (Single or Bulk)
// @route   POST /api/mail/send-onboarding
// @access  Protected
router.post("/send-onboarding", protect, async (req, res) => {
  const { 
    recipientEmail, 
    recipientList, 
    emailSubject, 
    emailMessage, 
    formLink 
  } = req.body;

  try {
    // 1. Determine Recipients
    let recipients = [];

    if (recipientEmail) {
      // Single Recipient Case
      recipients.push(recipientEmail);
    } else if (recipientList) {
      // Bulk Recipient Case (split by comma, newline, or semicolon)
      recipients = recipientList
        .split(/[\n,;]/)
        .map((email) => email.trim())
        .filter((email) => email.includes("@")); // Basic validation
    }

    if (recipients.length === 0) {
      return res.status(400).json({ message: "No valid recipients found." });
    }

    // 2. Prepare Email Content
    // Replace the placeholder with the actual link
    const finalHtmlMessage = emailMessage
      .replace(/\n/g, "<br>") // Convert newlines to HTML breaks
      .replace("[ONBOARDING_LINK]", `<a href="${formLink}" style="color: #2563eb; font-weight: bold;">Click Here to Complete Onboarding</a>`);

    const plainTextMessage = emailMessage.replace("[ONBOARDING_LINK]", formLink);

    // 3. Send Emails
    // We use Promise.all to send them in parallel, or you can loop sequentially
    const emailPromises = recipients.map((toEmail) => {
      return transporter.sendMail({
        from: `"HR Team" <${process.env.SMTP_USER}>`, // Sender address
        to: toEmail,
        subject: emailSubject || "Complete Your Onboarding",
        text: plainTextMessage, // Fallback for clients that don't render HTML
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #1e3a8a;">Welcome to the Team!</h2>
            <p>${finalHtmlMessage}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #666;">If the button above doesn't work, copy and paste this link:</p>
            <p style="font-size: 12px; color: #2563eb;">${formLink}</p>
          </div>
        `,
      });
    });

    // Wait for all emails to attempt sending
    await Promise.all(emailPromises);

    res.status(200).json({ 
      success: true, 
      message: `Successfully sent emails to ${recipients.length} recipient(s).`,
      sentTo: recipients
    });

  } catch (error) {
    console.error("Send Mail Error:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to send emails.", 
      error: error.message 
    });
  }
});

// @desc    Send induction email(s)
// @route   POST /api/mail/send
// @access  Protected
router.post("/send", protect, upload.single("attachment"), async (req, res) => {
  try {
    const {
      employeeIds,
      inductionType,
      date = "",
      time = "",
      venueOrPlatform = "",
      meetingLink = "",
      startDate = "",
      endDate = "",
    } = req.body;

    if (!employeeIds || !inductionType) {
      return res.status(400).json({
        success: false,
        message: "Employee selection and induction type are required.",
      });
    }

    let parsedEmployeeIds = [];
    try {
      parsedEmployeeIds = Array.isArray(employeeIds)
        ? employeeIds
        : JSON.parse(employeeIds);
    } catch {
      parsedEmployeeIds = [employeeIds];
    }

    const normalizedEmployeeIds = parsedEmployeeIds
      .map((id) => String(id).trim())
      .filter(Boolean);

    if (!normalizedEmployeeIds.length) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one employee.",
      });
    }

    const employees = await Employee.find({
      _id: { $in: normalizedEmployeeIds },
      isActive: true,
    }).select("employeeId name email companyName");

    if (!employees.length) {
      return res.status(404).json({
        success: false,
        message: "Selected employees were not found.",
      });
    }

    const adminName = req.user?.name || "HR Team";
    const companyName =
      req.user?.companyName ||
      employees.find((employee) => employee.companyName)?.companyName ||
      "HRMS";

    const attachment = req.file
      ? [
          {
            filename: req.file.originalname,
            content: req.file.buffer,
            contentType: req.file.mimetype,
          },
        ]
      : [];

    const recipients = [];

    for (const employee of employees) {
      const employeeName = employee.name || employee.employeeId || "Employee";

      if (!employee.email) {
        recipients.push({
          employeeRef: employee._id,
          employeeId: employee.employeeId || "",
          employeeName,
          email: "",
          status: "failed",
          error: "Employee email is missing.",
        });
        continue;
      }

      const preview = buildInductionPreview({
        employeeName,
        inductionType,
        date,
        time,
        venueOrPlatform,
        meetingLink,
        startDate,
        endDate,
        adminName,
        companyName,
      });

      try {
        const info = await transporter.sendMail({
          from: `"${companyName}" <${process.env.SMTP_USER}>`,
          to: employee.email,
          subject: `${inductionType} - ${companyName}`,
          text: preview.text,
          html: preview.html,
          attachments: attachment,
        });

        recipients.push({
          employeeRef: employee._id,
          employeeId: employee.employeeId || "",
          employeeName,
          email: employee.email,
          status: "sent",
          provider: "nodemailer",
          providerMessageId: info?.messageId || "",
        });
      } catch (error) {
        recipients.push({
          employeeRef: employee._id,
          employeeId: employee.employeeId || "",
          employeeName,
          email: employee.email,
          status: "failed",
          provider: "nodemailer",
          error: error.message,
        });
      }
    }

    const summary = {
      total: recipients.length,
      sent: recipients.filter((recipient) => recipient.status === "sent").length,
      failed: recipients.filter((recipient) => recipient.status === "failed").length,
    };

    const firstPreview = buildInductionPreview({
      employeeName: employees[0]?.name || "Employee",
      inductionType,
      date,
      time,
      venueOrPlatform,
      meetingLink,
      startDate,
      endDate,
      adminName,
      companyName,
    });

    await InductionDispatch.create({
      adminId: req.user?._id,
      adminName,
      designation: req.user?.designation || "",
      inductionType,
      subject: `${inductionType} - ${companyName}`,
      companyName,
      formData: {
        date,
        time,
        venueOrPlatform,
        meetingLink,
        startDate,
        endDate,
      },
      templateSnapshot: {
        dateValue: firstPreview.dateValue,
        timeValue: firstPreview.timeValue,
        venueOrLink: firstPreview.venueOrLink,
      },
      attachment: req.file
        ? {
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
          }
        : undefined,
      recipients,
      summary,
    });

    return res.status(200).json({
      success: true,
      message:
        summary.failed > 0
          ? `Induction emails sent to ${summary.sent} employee(s). ${summary.failed} failed.`
          : `Induction emails sent successfully to ${summary.sent} employee(s).`,
      summary,
      recipients,
    });
  } catch (error) {
    console.error("Induction send error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send induction emails.",
    });
  }
});

export default router;
