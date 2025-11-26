// --- START OF FILE models/Category.js ---
import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },   // frontend friendly ID
  name: { type: String, required: true },
}, {
  timestamps: true
});

export default mongoose.model("Category", CategorySchema);
// --- END OF FILE models/Category.js ---
