// routes/notificationRoutes.js
import express from "express";
import { protect } from "../middleware/authMiddleware.js";

import {
  getMyNotifications,
  createNotification,
  markNotificationAsReadController,
  markAllNotificationsAsReadController,
} from "../controllers/notificationController.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

/*
===================================================================
 🔹 GET My Notifications
     GET /api/notifications
===================================================================
*/
router.get("/", getMyNotifications);

/*
===================================================================
 🔹 Create Notification
     POST /api/notifications
     (Admin can target employees or all users)
===================================================================
*/
router.post("/", createNotification);

/*
===================================================================
 🔹 Mark SINGLE Notification Read
     PATCH /api/notifications/:id
===================================================================
*/
router.patch("/:id", markNotificationAsReadController);

/*
===================================================================
 🔹 Mark ALL My Notifications Read
     PATCH /api/notifications/mark-all
===================================================================
*/
router.post("/mark-all", markAllNotificationsAsReadController);


export default router;
