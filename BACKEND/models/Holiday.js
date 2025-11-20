import mongoose from "mongoose";

const holidaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  startDate: { type: String, required: true },
  endDate: { type: String, required: true },
});

export default mongoose.model("Holiday", holidaySchema);