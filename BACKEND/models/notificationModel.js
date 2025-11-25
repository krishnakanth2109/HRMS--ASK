// models/notificationModel.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    // 🔥 User receiving this notification (Employee or Admin)
    userId: {
      type: Schema.Types.ObjectId,
      refPath: "userType",
      required: false,      // allow role-based notifications
    },

    // 🔥 Required for refPath to work properly
    userType: {
      type: String,
      enum: ["Employee", "Admin"],
      required: false,
    },

    // 🔥 Broadcast notifications (OPTIONAL)
    role: {
      type: String,
      enum: ["admin", "employee", "all"],
      default: null,
    },

    title: {
      type: String,
      default: "",
    },

    message: {
      type: String,
      required: true,
    },

    // 🔥 ALL SUPPORTED TYPES
    type: {
      type: String,
      enum: [
        "leave",
        "attendance",
        "general",
        "notice",
        "leave-status",
        "overtime",
        "overtime-status",
        "system",
      ],
      default: "general",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    // 🔥 Store date consistently
    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;
