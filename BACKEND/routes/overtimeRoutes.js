// --- UPDATED FILE: routes/overtimeRoutes.js ---

import express from "express";
import Overtime from "../models/Overtime.js";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";
import Notification from "../models/notificationModel.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import { sendBrevoEmail } from "../Services/emailService.js";

const router = express.Router();

/* ======================================================
   🔐 All Overtime routes require authentication
====================================================== */
router.use(protect);

/* ======================================================
   🧑‍💼 EMPLOYEE/MANAGER → APPLY FOR OVERTIME
====================================================== */
router.post("/apply", async (req, res) => {
  try {
    const { employeeId, employeeName, date, type } = req.body;

    // req.user is populated by the 'protect' middleware
    const employeeEmail = req.user?.email || "N/A";

    if (!employeeId || !employeeName || !date || !type) {
      return res.status(400).json({
        message: "employeeId, employeeName, date and type are required",
      });
    }

    const newOT = new Overtime({
      employeeId,
      employeeName,
      date,
      type,
      status: "PENDING",
    });

    await newOT.save();

    const io = req.app.get("io");

    // 🔥 Notify admins in real-time
    if (io) io.emit("overtime:new", newOT);

    // 🔔 Fetch all admins from DB
    const admins = await Admin.find().lean();

    // 1. Create In-App Notifications for all DB admins
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id.toString(),
        title: "New Overtime Request",
        message: `${employeeName} requested overtime on ${date}`,
        type: "overtime",
        isRead: false,
      });
    }

    // 2. Prepare Email Recipients (ONLY from DB Admins)
    const adminRecipients = admins
      .filter(admin => admin.email) // Ensure admin has an email address
      .map(admin => ({ name: admin.name, email: admin.email }));

    console.log(`📧 Overtime Email Debug: Sending to ${adminRecipients.length} admins from DB.`);

    // 3. Send Email to Admins
    if (adminRecipients.length > 0) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
          <h2 style="color: #4f46e5;">New Overtime Request</h2>
          <p><strong>${employeeName}</strong> (ID: ${employeeId}) has applied for overtime.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Employee Name:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${employeeName}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Employee ID:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${employeeId}</td>
            </tr>
             <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Employee Email:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${employeeEmail}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Date:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${new Date(date).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;"><strong>Type:</strong></td>
              <td style="padding: 8px; border: 1px solid #ddd;">${type}</td>
            </tr>
          </table>
          <p style="margin-top: 20px;">Please login to the Admin Portal to approve or reject this request.</p>
        </div>
      `;

      await sendBrevoEmail({
        to: adminRecipients,
        subject: `New Overtime Request: ${employeeName}`,
        htmlContent: emailHtml,
      });
    }

    res.status(201).json({
      message: "Overtime request submitted",
      data: newOT,
    });
  } catch (err) {
    console.error("OT CREATE ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   🟥 ADMIN ONLY → GET ALL OVERTIME REQUESTS
====================================================== */
router.get("/all", async (req, res) => {
  try {
    const list = await Overtime.find().sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    console.error("OT ALL FETCH ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   🟥 ADMIN ONLY → UPDATE OVERTIME STATUS
====================================================== */
router.put("/update-status/:id", onlyAdmin, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["PENDING", "APPROVED", "REJECTED"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const updated = await Overtime.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Overtime request not found" });
    }

    const io = req.app.get("io");

    // 🔥 Real-time for admin panel
    if (io) io.emit("overtime:updated", updated);

    // 🔔 Notify employee
    const employee = await Employee.findOne({
      employeeId: updated.employeeId,
    });

    if (employee) {
      await Notification.create({
        userId: employee._id.toString(),
        title: "Overtime Status Update",
        message: `Your overtime request on ${updated.date} was ${status}`,
        type: "overtime-status",
        isRead: false,
      });

      if (io)
        io.emit("newNotification", {
          userId: employee._id.toString(),
          message: `Your overtime request was ${status}`,
        });
    }

    res.json({
      message: "Status updated successfully",
      data: updated,
    });
  } catch (err) {
    console.error("OT STATUS UPDATE ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   ❌ EMPLOYEE/MANAGER → CANCEL THEIR OWN PENDING OT
====================================================== */
router.patch("/cancel/:id", async (req, res) => {
  try {
    const overtime = await Overtime.findById(req.params.id);

    if (!overtime)
      return res.status(404).json({ message: "Overtime not found" });

    if (overtime.employeeId !== req.user.employeeId) {
      return res.status(403).json({
        message: "You can only cancel your own overtime",
      });
    }

    if (overtime.status !== "PENDING") {
      return res.status(400).json({
        message: "Cannot cancel approved/rejected overtime",
      });
    }

    await Overtime.findByIdAndDelete(req.params.id);

    const io = req.app.get("io");

    if (io) io.emit("overtime:cancelled", { _id: req.params.id });

    // 🔔 Notify admins
    const admins = await Admin.find().lean();
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id.toString(),
        title: "Overtime Cancelled",
        message: `${overtime.employeeName} cancelled their overtime request on ${overtime.date}`,
        type: "overtime",
        isRead: false,
      });
    }

    res.json({
      message: "Overtime cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel OT failed:", error);
    res.status(500).json({ message: "Failed to cancel overtime request" });
  }
});

/* ======================================================
   👤 EMPLOYEE/MANAGER → GET THEIR OWN OVERTIME HISTORY
====================================================== */
router.get("/:employeeId", async (req, res) => {
  try {
    if (req.user.employeeId !== req.params.employeeId && req.user.role !== "admin") {
      return res.status(403).json({
        message: "You can only view your own overtime history",
      });
    }

    const list = await Overtime.find({
      employeeId: req.params.employeeId,
    }).sort({ date: -1 });

    res.json(list);
  } catch (err) {
    console.error("OT FETCH ERROR →", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ======================================================
   🟥 ADMIN ONLY → DELETE OVERTIME REQUEST
====================================================== */
router.delete("/delete/:id", onlyAdmin, async (req, res) => {
  try {
    const removed = await Overtime.findByIdAndDelete(req.params.id);

    if (!removed) {
      return res.status(404).json({ message: "Overtime not found" });
    }

    res.json({ message: "Overtime deleted successfully" });
  } catch (err) {
    console.error("OT DELETE ERROR →", err);
    res.status(500).json({ message: "Failed to delete overtime request" });
  }
});

export default router;

// --- END ---
