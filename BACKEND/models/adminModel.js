// --- START OF FILE models/adminModel.js ---

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema(
{
  name: {
    type: String,
    required: [true, "Please provide a name"],
  },

  email: {
    type: String,
    required: [true, "Please provide an email"],
    unique: true,
    lowercase: true,
    match: [/.+\@.+\..+/, "Please fill a valid email address"],
  },

  password: {
    type: String,
    required: [true, "Please provide a password"],
    minlength: 6,
    select: false,
  },

  role: {
    type: String,
    enum: ["admin", "manager"],
    default: "admin",
  },

  phone: {
    type: String,
  },

  department: {
    type: String,
    default: "Administration",
  },

  // ✅ NEW FIELDS (Add these)
  designation: {
    type: String,
    default: "",
  },

  companyName: {
    type: String,
    default: "",
  },

  employeeId: {
    type: String,
    default: "",
  },

  profileImage: {
    type: String,
    default: "",
  },

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },

  lastLogin: {
    type: Date,
  },

},
{
  timestamps: true, // adds createdAt and updatedAt automatically
}
);

// Middleware to hash password before saving
adminSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
adminSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;