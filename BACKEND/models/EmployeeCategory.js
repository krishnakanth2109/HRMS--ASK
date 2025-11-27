import mongoose from "mongoose";

const EmployeeCategorySchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  categoryId: { type: String, default: null }
}, { timestamps: true });

export default mongoose.model("EmployeeCategory", EmployeeCategorySchema);
