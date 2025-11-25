// --- START OF FILE overtimeRoutes.js ---

import express from "express";
import Overtime from "../models/Overtime.js";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";
import Notification from "../models/notificationModel.js";

const router = express.Router();

/* ======================================================
   🔥 EMPLOYEE APPLIES FOR OVERTIME
====================================================== */
router.post("/apply", async (req, res) => {
  try {
    const { employeeId, employeeName, date, type } = req.body;

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

    // 🔥 REAL-TIME broadcast to admin sidebar
    if (io) io.emit("overtime:new", newOT);

    // 🔔 Notify all admins
    const admins = await Admin.find().lean();
    for (const admin of admins) {
      await Notification.create({
        userId: admin._id.toString(),
        title: "New Overtime Request",
        message: `${employeeName} requested overtime on ${date}`,
        type: "overtime",
        isRead: false,
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
   🔥 ADMIN: GET ALL OVERTIME REQUESTS
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
   🔥 ADMIN UPDATES OVERTIME STATUS
====================================================== */
router.put("/update-status/:id", async (req, res) => {
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

    // 🔥 REAL-TIME update for sidebar
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
   🔥 EMPLOYEE CANCEL OVERTIME (ONLY IF PENDING)
====================================================== */
router.patch("/cancel/:id", async (req, res) => {
  try {
    const overtime = await Overtime.findById(req.params.id);

    if (!overtime)
      return res.status(404).json({ message: "Overtime not found" });

    if (overtime.status !== "PENDING") {
      return res.status(400).json({
        message: "Cannot cancel approved/rejected overtime",
      });
    }

    await Overtime.findByIdAndDelete(req.params.id);

    const io = req.app.get("io");

    // 🔥 REAL-TIME decrease on sidebar
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
   EMPLOYEE OVERTIME HISTORY
====================================================== */
router.get("/:employeeId", async (req, res) => {
  try {
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
   DELETE OVERTIME REQUEST
====================================================== */
router.delete("/delete/:id", async (req, res) => {
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

// --- END OF FILE overtimeRoutes.js ---
