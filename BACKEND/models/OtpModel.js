// --- FILE: models/OtpModel.js ---

import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    expires: 300 // Document automatically deletes after 300 seconds (5 minutes)
  } 
});

// Check if model exists before compiling to prevent OverwriteModelError
const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);

export default Otp;