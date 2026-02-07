import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, index: { expires: '5m' } } // Auto-delete after 5 mins
});

export default mongoose.model("Otp", otpSchema);