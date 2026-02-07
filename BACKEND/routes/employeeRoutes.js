
import express from "express";
import Employee from "../models/employeeModel.js";
import Company from "../models/CompanyModel.js";
import Notification from "../models/notificationModel.js";
import Otp from "../models/OtpModel.js"; 
import { upload } from "../config/cloudinary.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt"; // ✅ REQUIRED for password reset

const router = express.Router();

// ✅ SETUP EMAIL TRANSPORTER AT THE TOP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 465,
  secure: true, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/* ==============================================================
==============
 📁 1. FILE UPLOAD ROUTE
=================================================================
=========== */
router.post("/upload-doc", protect, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    // Return the Cloudinary URL (or local path)
    res.status(200).json({ url: req.file.path });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==============================================================
==============
 👤 2. EMPLOYEE CRUD
=================================================================
=========== */

// CREATE employee → ADMIN ONLY
router.post("/", protect, onlyAdmin, async (req, res) => {
  try {

    // ✅ USE COMPANY'S employeeCount COUNTER (ensures ID consistency)
    if (req.body.company) {
      // Find the company to get the prefix
      const company = await Company.findById(req.body.company);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // ✅ RE-COUNT ACTUAL EMPLOYEES to ensure ID accuracy
      const currentCount = await Employee.countDocuments({ company: req.body.company });

      // Generate employee ID: prefix + (count + 1) with zero padding
      const paddedCount = String(currentCount + 1).padStart(2, "0");
      req.body.employeeId = `${company.prefix}${paddedCount}`;

      // Update company count to be consistent (optional but good for sync)
      company.employeeCount = currentCount + 1;
      await company.save();
    } 

    const employee = new Employee(req.body);
    const result = await employee.save();
    res.status(201).json(result);
  } catch (err) {
    console.error("❌ Employee creation error:", err);
    console.error("Full error details:", err.errors || err.message);

    // Handle duplicate key error (e.g., duplicate email)
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        error: `Duplicate value entered for ${field}. Please use a different one.`,
        field: field
      });
    }

    res.status(500).json({
      error: err.message,
      details: err.errors ? Object.keys(err.errors).map(key => err.errors[key].message) : undefined
    });
  }
});

// GET all employees → Authenticated users allowed
router.get("/", protect, async (req, res) => {
  try {
    const employees = await Employee.find();
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET employee by ID → Authenticated users allowed
router.get("/:id", protect, async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    res.status(200).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE employee
router.put("/:id", protect, async (req, res) => {
  try {
    // 1. Check if user is Admin
    const isAdmin = req.user.role === "admin";

    // 2. Check if user is updating their OWN profile
    const isSelf = req.user.employeeId === req.params.id;

    // 3. If not admin and not self, reject
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ message: "Not authorized to update this profile" });
    }

    const updated = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Employee not found" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE employee → ADMIN ONLY
router.delete("/:id", protect, onlyAdmin, async (req, res) => {
  try {
    // 1. Find the employee to be deleted
    const employeeToDelete = await Employee.findOne({ employeeId: req.params.id });

    if (!employeeToDelete) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const companyId = employeeToDelete.company;
    const deletedId = employeeToDelete.employeeId;

    // 2. Find the company to get the prefix (essential for parsing IDs)
    const company = await Company.findById(companyId);
    if (!company) {
      // If company doesn't exist, just delete the employee (fallback)
      await Employee.findOneAndDelete({ employeeId: req.params.id });
      return res.status(200).json({ message: "Employee deleted (Company not found, IDs not shifted)" });
    }

    // 3. Extract the numeric part of the deleted employee's ID
    const prefixLength = company.prefix.length;
    const deletedNumber = parseInt(deletedId.slice(prefixLength), 10);

    if (isNaN(deletedNumber)) {
      // Fallback if ID format is unexpected
      await Employee.findOneAndDelete({ employeeId: req.params.id });
      return res.status(200).json({ message: "Employee deleted (ID format invalid for shifting)" });
    }

    // 4. Delete the employee
    await Employee.findOneAndDelete({ employeeId: req.params.id });

    // 5. Find all remaining employees of this company
    const siblings = await Employee.find({ company: companyId });

    // 6. Iterate and shift IDs for those with number > deletedNumber
    const updatePromises = siblings.map(async (emp) => {
      const currentNum = parseInt(emp.employeeId.slice(prefixLength), 10);

      if (!isNaN(currentNum) && currentNum > deletedNumber) {
        const newNum = currentNum - 1;
        // Pad with 0 to match existing format (2 digits minimum)
        const newId = `${company.prefix}${String(newNum).padStart(2, "0")}`;

        emp.employeeId = newId;
        return emp.save(); // Save the updated employee
      }
    });

    await Promise.all(updatePromises);

    // 7. Decrement the company's employeeCount
    if (company.employeeCount > 0) {
      company.employeeCount -= 1;
      await company.save();
    }

    res.status(200).json({
      message: "Employee deleted and subsequent IDs shifted successfully",
      adjustedCount: company.employeeCount
    });

  } catch (err) {
    console.error("Delete Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ==============================================================
==============
 🔐 DEACTIVATE / REACTIVATE → ADMIN ONLY
=================================================================
=========== */

router.patch("/:id/deactivate", protect, onlyAdmin, async (req, res) => {
  const { endDate, reason } = req.body;
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      {
        isActive: false,
        status: "Inactive",
        deactivationDate: endDate,
        deactivationReason: reason
      },
      { new: true }
    );

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/:id/reactivate", protect, onlyAdmin, async (req, res) => {
  const { date, reason } = req.body;
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      {
        isActive: true,
        status: "Active",
        reactivationDate: date,
        reactivationReason: reason
      },
      { new: true }
    );

    if (!emp) return res.status(404).json({ message: "Employee not found" });

    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ==============================================================
==============
 🔥 IDLE DETECTION → SYSTEM GENERATED
=================================================================
=========== */
router.post("/idle-activity", protect, async (req, res) => {
  try {
    const { employeeId, name, department, role, lastActiveAt } = req.body;

    const msg = `${name} (${employeeId}) from ${department} is idle since ${new Date(
      lastActiveAt
    ).toLocaleTimeString()}.`;

    const notification = await Notification.create({
      userId: "admin",
      title: "Employee Idle Alert",
      message: msg,
      type: "attendance",
      isRead: false
    });

    const io = req.app.get("io");
    const userSocketMap = req.app.get("userSocketMap");
    const adminSocket = userSocketMap.get("admin");

    if (adminSocket) {
      io.to(adminSocket).emit("admin-notification", notification);
    }

    res.json({ success: true, notification });
  } catch (error) {
    console.error("❌ Idle Activity Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/* ==============================================================
==============
 🚀 3. PUBLIC ONBOARDING (No Auth Required)
=================================================================
=========== */
// employeeRoutes.js - Update the /onboard route
router.post("/onboard", async (req, res) => {
  try {
    // 1. Validate Company existence
    if (!req.body.company) {
      return res.status(400).json({ error: "Company selection is required" });
    }

    const company = await Company.findById(req.body.company);
    if (!company) {
      return res.status(404).json({ error: "Selected company not found" });
    }

    // 2. Generate Employee ID with retry logic to avoid duplicates
    let employeeId;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const currentCount = await Employee.countDocuments({ company: req.body.company });
      const paddedCount = String(currentCount + 1).padStart(2, "0");
      employeeId = `${company.prefix}${paddedCount}`;
      
      // Check if this ID already exists
      const existingEmployee = await Employee.findOne({ employeeId });
      if (!existingEmployee) {
        break; // ID is unique, proceed
      }
      
      attempts++;
      if (attempts === maxAttempts) {
        // Fallback: use timestamp to ensure uniqueness
        const timestamp = Date.now().toString().slice(-3);
        employeeId = `${company.prefix}${paddedCount}_${timestamp}`;
      }
    }

    // 3. Set default fields for new onboarders
    req.body.employeeId = employeeId;
    req.body.role = "employee"; // Force role to employee
    req.body.isActive = true;
    
    // 4. Create Employee
    const employee = new Employee(req.body);
    const result = await employee.save();
    
    // Update company count
    company.employeeCount = await Employee.countDocuments({ company: req.body.company });
    await company.save();
    
    res.status(201).json({ 
      message: "Onboarding successful", 
      employeeId: result.employeeId,
      employee: result 
    });

  } catch (err) {
    console.error("❌ Onboarding error:", err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        error: `Duplicate value entered for ${field}. Please try again.`,
        field: field,
        details: "The system detected a duplicate entry. Please refresh and try again."
      });
    }
    res.status(500).json({ 
      error: "Onboarding failed. Please contact HR.",
      details: err.message 
    });
  }
});


// --- 2. ROUTE: SEND OTP (Add this before the onboard route) ---
router.post("/send-onboarding-otp", async (req, res) => {
  try {
    const { email } = req.body;
    
    // Check if email already exists in Employee DB
    const existingUser = await Employee.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered. Please login." });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to OTP Collection (Upsert: update if exists, insert if not)
    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send Email
    await transporter.sendMail({
      from: `"HRMS Team" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Verify your Account Registration",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Email Verification</h2>
          <p>You are about to submit your employee onboarding details.</p>
          <p>Your OTP is: <strong style="font-size: 24px; color: #1e40af;">${otpCode}</strong></p>
          <p>This code expires in 5 minutes.</p>
        </div>
      `,
    });

    res.status(200).json({ message: "OTP sent to email." });
  } catch (error) {
    console.error("OTP Error:", error);
    res.status(500).json({ error: "Failed to send email." });
  }
});

/* ==============================================================
==============
 🔑 4. PASSWORD RESET ROUTES (Using same Otp Model)
=================================================================
=========== */

// 1. Send OTP for Forgot Password
router.post("/forgot-password-otp", async (req, res) => {
  try {
    const { email } = req.body;

    // Check if employee exists
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(404).json({ message: "Email not found in our records." });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Reusing the same OTP Model logic as Onboarding
    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

    await transporter.sendMail({
      from: `"HRMS Support" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset</h2>
          <p>We received a request to reset your password.</p>
          <p>Your OTP is: <strong style="font-size: 24px; color: #dc2626;">${otpCode}</strong></p>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    });

    res.status(200).json({ message: "OTP sent to your email." });
  } catch (error) {
    console.error("Forgot Password OTP Error:", error);
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

// 2. Verify OTP
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const validOtp = await Otp.findOne({ email, otp });
    
    if (!validOtp) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    res.status(200).json({ message: "OTP verified successfully." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Reset Password
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res.status(400).json({ message: "Invalid or expired OTP. Please try again." });
    }

    // ✅ This requires 'bcrypt' imported at the top
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await Employee.findOneAndUpdate(
      { email },
      { password: hashedPassword }
    );

    await Otp.deleteOne({ email });

    res.status(200).json({ message: "Password has been reset successfully. Please login." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ error: "Failed to reset password." });
  }
});

/* ==============================================================
   EXISTING ROUTES (Upload, CRUD, etc...)
   ... (Keep your existing File Upload, Create, Get, Update, Delete routes here) ...
================================================================= */

// ... [Keep File Upload Route] ...
// ... [Keep Employee CRUD Routes] ...
// ... [Keep Idle Activity Route] ...
// ... [Keep Onboarding Routes] ...
// ... [Keep Forgot Password Routes] ...


/* ==============================================================
   ✅ NEW: CHANGE PASSWORD WITH OTP (PROTECTED / LOGGED IN)
================================================================= */

// 1. Send OTP to the Logged-In User
router.post("/change-password-otp", protect, async (req, res) => {
  try {
    // Get email from the logged-in user's token
    const email = req.user.email;

    if (!email) {
      return res.status(400).json({ message: "User email not found." });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save/Update OTP
    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send Email
    await transporter.sendMail({
      from: `"HRMS Security" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Change Password Verification",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Security Verification</h2>
          <p>You requested to change your password.</p>
          <p>Your OTP is: <strong style="font-size: 24px; color: #1e40af;">${otpCode}</strong></p>
          <p>If you did not make this request, please contact admin immediately.</p>
        </div>
      `,
    });

    res.status(200).json({ message: "OTP sent to your registered email." });
  } catch (error) {
    console.error("Change Password OTP Error:", error);
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

// 2. Verify OTP and Update Password
router.post("/change-password-verify", protect, async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    const email = req.user.email; // From Token

    // 1. Verify OTP
    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    // 2. Hash New Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 3. Update Employee Password
    await Employee.findOneAndUpdate(
      { email },
      { password: hashedPassword }
    );

    // 4. Delete OTP
    await Otp.deleteOne({ email });

    res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Change Password Verify Error:", error);
    res.status(500).json({ error: "Failed to update password." });
  }
});


export default router;
// --- START OF FILE src/pages/ForgotPassword.jsx ---
