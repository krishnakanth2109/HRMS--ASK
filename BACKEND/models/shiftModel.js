import mongoose from "mongoose";

const ShiftSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true,
    ref: 'Employee'
  },
  employeeName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  department: {
    type: String,
    default: 'N/A'
  },
  role: {
    type: String,
    default: 'N/A'
  },
  
  // Shift Timings
  shiftStartTime: {
    type: String,
    required: true,
    default: "09:00" // HH:MM format
  },
  shiftEndTime: {
    type: String,
    required: true,
    default: "18:00" // HH:MM format
  },
  
  // Grace period for late login (in minutes)
  lateGracePeriod: {
    type: Number,
    default: 15 
  },
  
  // Working hours configuration
  fullDayHours: {
    type: Number,
    default: 8 
  },
  halfDayHours: {
    type: Number,
    default: 4 
  },
  // Removed Quarter Day and Break Time as requested
  
  // Auto-extend shift when late
  autoExtendShift: {
    type: Boolean,
    default: true
  },
  
  // Weekly off days (0 = Sunday, 6 = Saturday)
  weeklyOffDays: {
    type: [Number],
    default: [0] 
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  createdBy: { type: String, default: 'SYSTEM' },
  updatedBy: { type: String, default: 'SYSTEM' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ShiftSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("Shift", ShiftSchema);