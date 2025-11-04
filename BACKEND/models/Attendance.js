// --- START OF FILE models/Attendance.js ---

import mongoose from "mongoose";

// This schema represents a single day's attendance entry
const DailySchema = new mongoose.Schema({
  date: { type: String, required: true },
  punchIn: { type: Date, default: null },
  punchOut: { type: Date, default: null },
  workedHours: { type: Number, default: 0 },
  displayTime: { type: String, default: "0h 0m" },
  status: {
    type: String,
    enum: ["WORKING", "COMPLETED", "ABSENT", "LEAVE", "HOLIDAY"],
    default: "WORKING",
  },
  loginStatus: {
    type: String,
    enum: ["ON_TIME", "LATE", "NOT_APPLICABLE"],
    default: "NOT_APPLICABLE",
  },
  attendanceCategory: {
      type: String,
      enum: ["FULL_DAY", "HALF_DAY", "ABSENT"],
      default: "ABSENT",
  },
});

// This schema represents the top-level document for an employee's attendance history
const AttendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true, index: true },
  employeeName: { type: String, required: true },
  // All daily records are stored in this array
  attendance: [DailySchema],
});

export default mongoose.model("Attendance", AttendanceSchema);