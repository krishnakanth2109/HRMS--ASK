import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' }, // Tracks who created it
  // Tracks recipients: 'ALL' or an array of Employee IDs
  recipients: {
    type: mongoose.Schema.Types.Mixed,
    default: 'ALL',
  }
});

export default mongoose.model("Notice", noticeSchema);