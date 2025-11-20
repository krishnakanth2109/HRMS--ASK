import express from "express";
import Notification from "../models/notificationModel.js";

const router = express.Router();

/*
===================================================================
 🔹 MARK ALL NOTIFICATIONS READ (For Logged-in Employee Only)
===================================================================
*/
router.patch("/mark-all", async (req, res) => {
  try {
    // Extract employee’s MongoDB ID from authenticated request
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized user" });
    }

    // Mark ONLY this employee’s notifications as read
    await Notification.updateMany(
      { userId: userId },
      { isRead: true }
    );

    // Optional socket event
    const io = req.app.get("io");
    if (io) io.emit("notificationsAllRead", { userId });

    res.json({ message: "All personal notifications marked as read" });
  } catch (err) {
    console.error("PATCH /mark-all error:", err);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
});

/*
===================================================================
 🔹 MARK SINGLE NOTIFICATION READ / UPDATE
===================================================================
*/
router.patch("/:id", async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    const io = req.app.get("io");
    if (io) io.emit("notificationUpdated", updated);

    res.json({ message: "Updated", data: updated });
  } catch (err) {
    console.error("PATCH /:id error:", err);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

/*
===================================================================
 🔹 GET ALL NOTIFICATIONS (Admin / System Fetch)
===================================================================
*/
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ date: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("GET error:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

/*
===================================================================
 🔹 CREATE NEW NOTIFICATION + SOCKET EMIT
===================================================================
*/
router.post("/", async (req, res) => {
  try {
    const { userId, title, message, type } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({
        message: "userId, title and message are required",
      });
    }

    const allowedTypes = [
      "leave",
      "attendance",
      "general",
      "notice",
      "leave-status",
      "overtime",
    ];

    const finalType = allowedTypes.includes(type) ? type : "general";

    const newNotification = await Notification.create({
      userId,
      title,
      message,
      type: finalType,
      isRead: false,
      date: new Date(),
    });

    // Emit socket
    const io = req.app.get("io");
    if (io) io.emit("newNotification", newNotification);

    res.status(201).json(newNotification);
  } catch (err) {
    console.error("POST error:", err);
    res.status(500).json({ message: "Failed to create notification" });
  }
});

export default router;
