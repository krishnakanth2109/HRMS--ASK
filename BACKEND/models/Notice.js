import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: String, required: true },
});

export default mongoose.model("Notice", noticeSchema);
