// --- models/employeeModel.js ---

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// 1. Experience Sub-schema
const experienceSchema = new mongoose.Schema({
  company: String,
  role: String,
  department: String,
  years: Number,
  joiningDate: String,
  lastWorkingDate: String,
  salary: Number,
  reason: String,
  experienceLetterUrl: String, // Stores Cloudinary URL
  employmentType: String,
});

// 2. Personal Sub-schema (Updated with File URL keys)
const personalSchema = new mongoose.Schema({
  dob: String,
  gender: { type: String, enum: ["Male", "Female", "Prefer not to say", "Other"] },
  maritalStatus: String,
  nationality: String,
  panNumber: String,
  aadhaarNumber: String,
  // Keys for Cloudinary Storage
  aadhaarFileUrl: { type: String, default: null }, 
  panFileUrl: { type: String, default: null },     
});

// 3. Bank Sub-schema
const bankSchema = new mongoose.Schema({
  accountNumber: String,
  bankName: String,
  ifsc: String,
  branch: String,
});

// 4. Main Employee Schema
const EmployeeSchema = new mongoose.Schema({
  employeeId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: {
    type: String,
    minlength: 8,
    select: false,
    default: null,
  },
  
  // Company Reference
  company: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  companyName: String,
  companyPrefix: String,
  
  phone: String,
  address: String,
  emergency: String, 
  emergencyPhone: String,
  
  // Status and Deactivation Details
  isActive: { type: Boolean, default: true },
  status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  
  deactivationDate: { type: String, default: null },
  deactivationReason: { type: String, default: null },

  reactivationDate: { type: String, default: null },
  reactivationReason: { type: String, default: null },

  // Nested Data
  bankDetails: bankSchema,
  personalDetails: personalSchema,
  experienceDetails: [experienceSchema],

  // NEW: Array to store multiple company documents (Signed Policies, etc.)
  companyDocuments: [
    {
      fileName: String,
      fileUrl: String, // Cloudinary URL
      uploadedAt: { type: Date, default: Date.now }
    }
  ],

  role: { type: String, enum: ["employee", "admin", "manager"], default: "employee" },
  isAdmin: { type: Boolean, default: false },
}, { timestamps: true });

// Hash password before save
EmployeeSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to verify password
EmployeeSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

export default mongoose.model("Employee", EmployeeSchema);