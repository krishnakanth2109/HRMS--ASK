// --- START OF FILE models/Shift.js ---

import mongoose from "mongoose";

const ShiftSchema = new mongoose.Schema(
  {
    employeeId: { type: String, required: true, unique: true },
    employeeName: { type: String, required: true },
    email: { type: String, required: true },
    department: { type: String, default: "N/A" },
    role: { type: String, default: "N/A" },

    // Manual shift (NO DEFAULTS)
    shiftStartTime: { type: String, default: "" },
    shiftEndTime: { type: String, default: "" },

    lateGracePeriod: { type: Number, default: null },
    fullDayHours: { type: Number, default: null },
    halfDayHours: { type: Number, default: null },

    autoExtendShift: { type: Boolean, default: false },

    weeklyOffDays: { type: [Number], default: [] },

    category: { type: String, default: null }, // night-shift-xxxx

    timezone: { type: String, default: "Asia/Kolkata" },

    isActive: { type: Boolean, default: true },

    createdBy: { type: String, default: "Admin" },
    updatedBy: { type: String, default: "Admin" },
  },
  { timestamps: true }
);

export default mongoose.model("Shift", ShiftSchema);

// --- END OF FILE models/Shift.js ---
