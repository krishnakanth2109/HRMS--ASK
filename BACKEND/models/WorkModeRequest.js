import mongoose from "mongoose";

const workModeRequestSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  employeeName: { type: String, required: true },
  department: { type: String },
  requestType: { 
    type: String, 
    enum: ["Temporary", "Recurring", "Permanent"], 
    required: true 
  },
  // For Temporary
  fromDate: { type: Date },
  toDate: { type: Date },
  // For Recurring (0=Sun, 1=Mon, etc.)
  recurringDays: [{ type: Number }],
  // For Recurring/Temp/Perm - The mode they want (WFO/WFH)
  requestedMode: { 
    type: String, 
    enum: ["WFO", "WFH"], 
    required: true 
  },
  reason: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["Pending", "Approved", "Rejected", "Withdrawn"], 
    default: "Pending" 
  },
  adminComment: { type: String }, // Optional reason for rejection
  isEdited: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("WorkModeRequest", workModeRequestSchema);