// controllers/notificationController.js
import Notification from "../models/notificationModel.js";

/*
 Helper to filter notifications based on user role
*/
const buildNotificationFilterForUser = (user) => {
  if (!user) return { _id: null };

  if (user.role === "admin") {
    return {
      $or: [
        { role: "admin" },
        { role: "all" },
        { userId: user._id },
        { role: null, userId: null },
      ],
    };
  }

  // Employee
  return {
    $or: [
      { userId: user._id },
      { role: "employee" },
      { role: "all" },
    ],
  };
};

/*
===================================================================
 🔹 Get MY Notifications
 GET /api/notifications
===================================================================
*/
export const getMyNotifications = async (req, res) => {
  try {
    const filter = buildNotificationFilterForUser(req.user);
    const notifications = await Notification.find(filter).sort({ date: -1 });
    res.json(notifications);
  } catch (err) {
    console.error("GET /api/notifications error:", err);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
};

/*
===================================================================
 🔹 Create Notification
 POST /api/notifications
===================================================================
*/
export const createNotification = async (req, res) => {
  try {
    const { message, title, type, userId, role } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const notification = await Notification.create({
      message,
      title: title || "",
      type: type || "general",
      userId: userId || null,
      role: role || null,
    });

    // ❌ Remove socket broadcast
    // const io = req.app.get("io");
    // if (io) io.emit("newNotification", notification);

    res.status(201).json(notification);
  } catch (err) {
    console.error("POST /api/notifications error:", err);
    res.status(500).json({ message: "Failed to create notification" });
  }
};

/*
===================================================================
 🔹 Mark Single Notification Read
 PATCH /api/notifications/:id
===================================================================
*/
export const markNotificationAsReadController = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    const user = req.user;

    if (
      notification.userId &&
      notification.userId.toString() !== user._id.toString() &&
      user.role !== "admin"
    ) {
      return res
        .status(403)
        .json({ message: "Not allowed to update this notification" });
    }

    notification.isRead = true;
    await notification.save();

    // ❌ Remove socket broadcast
    // const io = req.app.get("io");
    // if (io) io.emit("notificationUpdated", notification);

    res.json({ message: "Updated", data: notification });
  } catch (err) {
    console.error("PATCH /api/notifications/:id error:", err);
    res.status(500).json({ message: "Failed to update notification" });
  }
};

/*
===================================================================
 🔹 Mark ALL My Notifications Read
 PATCH /api/notifications/mark-all
===================================================================
*/
export const markAllNotificationsAsReadController = async (req, res) => {
  try {
    const user = req.user;
    const filter = buildNotificationFilterForUser(user);

    await Notification.updateMany(filter, { isRead: true });

    // ❌ Remove socket broadcast
    // const io = req.app.get("io");
    // if (io) io.emit("notificationsAllRead", { userId: user._id });

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("PATCH /api/notifications/mark-all error:", err);
    res.status(500).json({ message: "Failed to mark all as read" });
  }
};
