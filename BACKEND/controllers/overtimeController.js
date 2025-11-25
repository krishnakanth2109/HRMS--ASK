// --- START OF FILE controllers/overtimeController.js ---

import Overtime from "../models/overtimeModel.js";
import Employee from "../models/employeeModel.js";
import Admin from "../models/adminModel.js";
import Notification from "../models/notificationModel.js";

// ===================================================================================
// 🔹 EMPLOYEE REQUESTS OVERTIME
// ===================================================================================
export const applyOvertime = async (req, res) => {
  try {
    const user = req.user;
    const { date, hours, reason } = req.body;

    if (!date || !hours || !reason) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const overtime = await Overtime.create({
      employeeId: user.employeeId,
      employeeName: user.name,
      date,
      hours,
      reason,
      status: "Pending",
      appliedAt: new Date(),
    });

    const io = req.app.get("io");
    if (io) io.emit("overtime:new", overtime);

    // 🔥 Notify all admins
    const admins = await Admin.find().lean();
    for (const admin of admins) {
      const notif = await Notification.create({
        userId: admin._id,
        userType: "Admin",
        title: "New Overtime Request",
        message: `${user.name} requested ${hours}h overtime on ${date}`,
        type: "overtime",
        isRead: false,
        date: new Date(),
      });

      if (io) {
        io.emit("newNotification", {
          _id: notif._id,
          userId: admin._id.toString(),
          userType: "Admin",
          title: notif.title,
          message: notif.message,
          type: notif.type,
          isRead: false,
          date: notif.date,
        });
      }
    }

    return res.status(201).json(overtime);
  } catch (err) {
    console.error("applyOvertime error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// ===================================================================================
// 🔹 ADMIN GETS FULL LIST OF OVERTIME REQUESTS
// ===================================================================================
export const getAllOvertimeRequests = async (req, res) => {
  try {
    const docs = await Overtime.find().sort({ appliedAt: -1 }).lean();
    res.json(docs);
  } catch (err) {
    console.error("getAllOvertimeRequests error:", err);
    res.status(500).json({ message: "Failed to fetch overtime requests." });
  }
};

// ===================================================================================
// 🔹 EMPLOYEE VIEWS OWN OVERTIME HISTORY
// ===================================================================================
export const getOvertimeForEmployee = async (req, res) => {
  try {
    const { employeeId } = req.user;

    const docs = await Overtime.find({ employeeId }).sort({
      appliedAt: -1,
    });

    res.json(docs);
  } catch (err) {
    console.error("getOvertimeForEmployee error:", err);
    res.status(500).json({ message: "Failed to fetch your overtime." });
  }
};

// ===================================================================================
// 🔹 ADMIN UPDATES OVERTIME STATUS (FIXED)
// ===================================================================================
export const updateOvertimeStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const approvedBy = req.user.name;

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    // Update overtime
    const updated = await Overtime.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approvedBy,
        actionDate: new Date(),
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Not found" });
    }

    const io = req.app.get("io");
    if (io) io.emit("overtime:updated", updated);

    // Fetch employee safely
    const employee = await Employee.findOne({
      employeeId: updated.employeeId,
    });

    if (employee) {
      // Create notification
      const notif = await Notification.create({
        userId: employee._id,
        userType: "Employee",
        title: "Overtime Status Updated",
        message: `Your overtime request on ${updated.date} was ${status} by ${approvedBy}`,
        type: "overtime-status",
        isRead: false,
        date: new Date(),
      });

      // Emit real-time notification with correct structure
      if (io) {
        io.emit("newNotification", {
          _id: notif._id,
          userId: employee._id.toString(),
          userType: "Employee",
          title: notif.title,
          message: notif.message,
          type: notif.type,
          isRead: false,
          date: notif.date,
        });
      }
    }

    return res.json(updated);
  } catch (err) {
    console.error("updateOvertimeStatus error:", err);
    res.status(500).json({ message: "Failed to update overtime status" });
  }
};

// ===================================================================================
// 🔹 EMPLOYEE CANCELS OVERTIME (FIXED userType)
// ===================================================================================
export const cancelOvertime = async (req, res) => {
  try {
    const overtime = await Overtime.findById(req.params.id);
    if (!overtime) {
      return res.status(404).json({ message: "Not found" });
    }

    if (overtime.status !== "Pending") {
      return res
        .status(400)
        .json({ message: "Cannot cancel an approved/rejected overtime" });
    }

    await Overtime.findByIdAndDelete(req.params.id);

    const io = req.app.get("io");
    if (io) io.emit("overtime:cancelled", { _id: req.params.id });

    // Notify admins
    const admins = await Admin.find().lean();
    for (const admin of admins) {
      const notif = await Notification.create({
        userId: admin._id,
        userType: "Admin",
        title: "Overtime Cancelled",
        message: `${req.user.name} cancelled the overtime request (${overtime.date})`,
        type: "overtime",
        isRead: false,
        date: new Date(),
      });

      if (io) {
        io.emit("newNotification", {
          _id: notif._id,
          userId: admin._id.toString(),
          userType: "Admin",
          title: notif.title,
          message: notif.message,
          type: notif.type,
          isRead: false,
          date: notif.date,
        });
      }
    }

    res.json({ message: "Overtime cancelled successfully" });
  } catch (err) {
    console.error("cancelOvertime error:", err);
    res.status(500).json({ message: "Failed to cancel overtime" });
  }
};

// --- END OF FILE overtimeController.js ---
