import express from "express";
import WorkModeRequest from "../models/WorkModeRequest.js";
import OfficeSettings from "../models/OfficeSettings.js";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
import { sendBrevoEmail } from "../Services/emailService.js";

const router = express.Router();

// 1. Submit a Request (Employee)
// 1. Submit a Request (Employee)
router.post("/request", async (req, res) => {
  try {
    const {
      employeeId, employeeName, department,
      requestType, fromDate, toDate, recurringDays, requestedMode, reason
    } = req.body;

    // Validate based on type
    if (requestType === "Temporary" && (!fromDate || !toDate)) {
      return res.status(400).json({ message: "Dates required for Temporary request" });
    }
    if (requestType === "Recurring" && (!recurringDays || recurringDays.length === 0)) {
      return res.status(400).json({ message: "Days required for Recurring request" });
    }

    const newRequest = new WorkModeRequest({
      employeeId, employeeName, department,
      requestType, fromDate, toDate, recurringDays, requestedMode, reason
    });

    await newRequest.save();

    // ----------------------------------------------------
    // EMAIL NOTIFICATION LOGIC (UPDATED: DB ADMINS ONLY)
    // ----------------------------------------------------
    try {
      // 1. Fetch all admins from Database
      const admins = await Admin.find().lean();

      // 2. Prepare recipients list from DB records only
      const adminRecipients = admins
        .filter(admin => admin.email) // Ensure email exists
        .map(admin => ({ name: admin.name, email: admin.email }));

      console.log(`📧 WorkMode Email Debug: Sending to ${adminRecipients.length} admins from database.`);

      // 3. Construct Email Content
      let dateInfo = "N/A";
      if (requestType === "Temporary") {
        dateInfo = `${new Date(fromDate).toLocaleDateString()} to ${new Date(toDate).toLocaleDateString()}`;
      } else if (requestType === "Recurring") {
        dateInfo = `Every ${recurringDays ? recurringDays.join(", ") : "N/A"}`;
      } else if (requestType === "Permanent") {
        dateInfo = "Starting immediately (Permanent)";
      }

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
          <h2 style="color: #4f46e5;">New Work Mode Request</h2>
          <p><strong>${employeeName}</strong> (ID: ${employeeId}) has requested a change in work mode.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Employee Name:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Department:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${department || "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Requested Mode:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${requestedMode}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Request Type:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${requestType}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Date/Duration:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${dateInfo}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Reason:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${reason || "No reason provided"}</td>
            </tr>
          </table>

          <p style="margin-top: 20px;">Please login to the Admin Portal to approve or reject this request.</p>
          <p>Regards,<br/>HRMS System</p>
        </div>
      `;

      // 4. Send Email
      if (adminRecipients.length > 0) {
        await sendBrevoEmail({
          to: adminRecipients,
          subject: `Work Mode Request: ${employeeName} - ${requestType}`,
          htmlContent: emailHtml,
        });
      }
    } catch (emailErr) {
      console.error("❌ Failed to send Work Mode Request email:", emailErr);
    }

    res.status(201).json({ message: "Request submitted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 2. Get Requests for an Employee (Employee View)
router.get("/my-requests/:employeeId", async (req, res) => {
  try {
    const requests = await WorkModeRequest.find({ employeeId: req.params.employeeId }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 3. Get All Pending Requests (Admin View)
router.get("/pending-requests", async (req, res) => {
  try {
    const requests = await WorkModeRequest.find({ status: "Pending" }).sort({ createdAt: -1 });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 4. Approve or Reject Request (Admin Action)
router.put("/action", async (req, res) => {
  try {
    const { requestId, action } = req.body; // action = "Approved" or "Rejected"

    const request = await WorkModeRequest.findById(requestId);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (action === "Rejected") {
      request.status = "Rejected";
      await request.save();
      return res.status(200).json({ message: "Request rejected" });
    }

    if (action === "Approved") {
      // 1. Update Request Status
      request.status = "Approved";
      await request.save();

      // 2. Update Actual Office Settings
      let settings = await OfficeSettings.findOne({ type: "Global" });
      if (!settings) settings = new OfficeSettings({ type: "Global" });

      // Build the new config object based on the request
      const newConfig = {
        employeeId: request.employeeId,
        employeeName: request.employeeName,
        ruleType: request.requestType,
        updatedAt: new Date()
      };

      if (request.requestType === "Permanent") {
        newConfig.permanentMode = request.requestedMode;
      } else if (request.requestType === "Temporary") {
        newConfig.temporary = {
          mode: request.requestedMode,
          fromDate: request.fromDate,
          toDate: request.toDate
        };
      } else if (request.requestType === "Recurring") {
        newConfig.recurring = {
          mode: request.requestedMode,
          days: request.recurringDays
        };
      }

      // Update or Push to OfficeSettings array
      const existingIndex = settings.employeeWorkModes.findIndex(e => e.employeeId === request.employeeId);
      if (existingIndex !== -1) {
        settings.employeeWorkModes[existingIndex] = newConfig;
      } else {
        settings.employeeWorkModes.push(newConfig);
      }

      await settings.save();
      return res.status(200).json({ message: "Request approved and settings updated" });
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 5. Withdraw a Request (Employee)
router.delete("/withdraw/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const request = await WorkModeRequest.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.status !== "Pending") {
      return res.status(400).json({ message: "Only pending requests can be withdrawn" });
    }

    request.status = "Withdrawn";
    await request.save();
    res.status(200).json({ message: "Request withdrawn successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 6. Update a Request (Employee)
router.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { requestType, fromDate, toDate, recurringDays, requestedMode, reason } = req.body;

    const request = await WorkModeRequest.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    // Ensure only pending requests can be updated
    if (request.status !== "Pending") {
      return res.status(400).json({ message: "Only pending requests can be updated" });
    }

    // Update fields
    request.requestType = requestType || request.requestType;
    request.fromDate = fromDate || request.fromDate;
    request.toDate = toDate || request.toDate;
    request.recurringDays = recurringDays || request.recurringDays;
    request.requestedMode = requestedMode || request.requestedMode;
    request.reason = reason || request.reason;
    request.isEdited = true;

    await request.save();

    res.status(200).json({ message: "Request updated successfully", request });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 7. Clear All History (For Employee)
router.delete("/my/clear/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    await WorkModeRequest.deleteMany({ employeeId });
    res.status(200).json({ message: "History cleared successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// 8. Delete Individual Request (For Employee History)
router.delete("/my/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await WorkModeRequest.findByIdAndDelete(id);
    res.status(200).json({ message: "Request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default router;