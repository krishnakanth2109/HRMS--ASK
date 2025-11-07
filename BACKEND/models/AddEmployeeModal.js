import mongoose from "mongoose";

const experienceSchema = new mongoose.Schema({
  employeeId: String,
  company: String,
  role: String,
  department: String,
  years: Number,
  joiningDate: String,
  lastWorkingDate: String,
  salary: Number,
  reason: String,
  experienceLetterUrl: String,
  employmentType: String,
});

const personalSchema = new mongoose.Schema({
  dob: String,
  gender: String,
  maritalStatus: String,
  nationality: String,
  panNumber: String,
  aadharNumber: String,
  aadharFileUrl: String,
  panFileUrl: String,
});

const bankSchema = new mongoose.Schema({
  accountNumber: String,
  bankName: String,
  ifsc: String,
  branch: String,
});

const EmployeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: String,
  email: String,
  phone: String,
  password: String, // ✅ Added this line
  address: String,
  emergency: String,
  isActive: Boolean,
  bankDetails: bankSchema,
  personalDetails: personalSchema,
  experienceDetails: [experienceSchema],
});

export default mongoose.model("Employee", EmployeeSchema);