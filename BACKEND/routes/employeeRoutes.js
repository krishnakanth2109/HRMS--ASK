// --- START OF FILE employeeRoutes.js ---

import express from "express";
import Employee from "../models/employeeModel.js";
import Company from "../models/CompanyModel.js";
import Notification from "../models/notificationModel.js";
import Otp from "../models/OtpModel.js"; 
import { upload } from "../config/cloudinary.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt"; 

const router = express.Router();

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

    // ✅ CHECK FOR COMPANY
    if (req.body.company) {
      const company = await Company.findById(req.body.company);

      if (!company) {
        return res.status(404).json({ error: "Company not found" });
      }

      // ✅ LOGIC: MANUAL ID vs AUTO-GEN ID
      if (req.body.employeeId && req.body.employeeId.trim() !== "") {
        // --- MANUAL ID CASE ---
        
        // 1. Check for duplicates
        const existingEmp = await Employee.findOne({ employeeId: req.body.employeeId.trim() });
        if (existingEmp) {
          return res.status(400).json({ 
            error: "Employee ID already exists. Please choose a different one.", 
            field: "employeeId" 
          });
        }
        
        // 2. Use the provided manual ID (ensure trimmed)
        req.body.employeeId = req.body.employeeId.trim();

        // 3. Still update company count for statistics/next-gen reference
        const currentCount = await Employee.countDocuments({ company: req.body.company });
        company.employeeCount = currentCount + 1;
        await company.save();

      } else {
        // --- AUTO-GENERATE CASE (If ID is empty or missing) ---
        
        // 1. Count actual employees
        const currentCount = await Employee.countDocuments({ company: req.body.company });

        // 2. Generate: Prefix + (Count + 1) padded
        const paddedCount = String(currentCount + 1).padStart(2, "0");
        req.body.employeeId = `${company.prefix}${paddedCount}`;

        // 3. Update company count
        company.employeeCount = currentCount + 1;
        await company.save();
      }
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
    const isAdmin = req.user.role === "admin";
    const isSelf = req.user.employeeId === req.params.id;

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
    const employeeToDelete = await Employee.findOne({ employeeId: req.params.id });

    if (!employeeToDelete) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const companyId = employeeToDelete.company;
    const deletedId = employeeToDelete.employeeId;

    const company = await Company.findById(companyId);
    if (!company) {
      await Employee.findOneAndDelete({ employeeId: req.params.id });
      return res.status(200).json({ message: "Employee deleted (Company not found, IDs not shifted)" });
    }

    const prefixLength = company.prefix.length;
    const deletedNumber = parseInt(deletedId.slice(prefixLength), 10);

    if (isNaN(deletedNumber)) {
      await Employee.findOneAndDelete({ employeeId: req.params.id });
      return res.status(200).json({ message: "Employee deleted (ID format invalid for shifting)" });
    }

    await Employee.findOneAndDelete({ employeeId: req.params.id });

    const siblings = await Employee.find({ company: companyId });

    const updatePromises = siblings.map(async (emp) => {
      const currentNum = parseInt(emp.employeeId.slice(prefixLength), 10);

      if (!isNaN(currentNum) && currentNum > deletedNumber) {
        const newNum = currentNum - 1;
        const newId = `${company.prefix}${String(newNum).padStart(2, "0")}`;

        emp.employeeId = newId;
        return emp.save(); 
      }
    });

    await Promise.all(updatePromises);

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
router.post("/onboard", async (req, res) => {
  try {
    if (!req.body.company) {
      return res.status(400).json({ error: "Company selection is required" });
    }

    const company = await Company.findById(req.body.company);
    if (!company) {
      return res.status(404).json({ error: "Selected company not found" });
    }

    let employeeId;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const currentCount = await Employee.countDocuments({ company: req.body.company });
      const paddedCount = String(currentCount + 1).padStart(2, "0");
      employeeId = `${company.prefix}${paddedCount}`;
      
      const existingEmployee = await Employee.findOne({ employeeId });
      if (!existingEmployee) {
        break; 
      }
      
      attempts++;
      if (attempts === maxAttempts) {
        const timestamp = Date.now().toString().slice(-3);
        employeeId = `${company.prefix}${paddedCount}_${timestamp}`;
      }
    }

    req.body.employeeId = employeeId;
    req.body.role = "employee"; 
    req.body.isActive = true;
    
    const employee = new Employee(req.body);
    const result = await employee.save();
    
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


// ROUTE: SEND OTP
router.post("/send-onboarding-otp", async (req, res) => {
  try {
    const { email } = req.body;
    
    const existingUser = await Employee.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered. Please login." });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

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
 🔑 4. PASSWORD RESET ROUTES
=================================================================
=========== */

router.post("/forgot-password-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(404).json({ message: "Email not found in our records." });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

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

router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res.status(400).json({ message: "Invalid or expired OTP. Please try again." });
    }

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
   CHANGE PASSWORD WITH OTP (PROTECTED / LOGGED IN)
================================================================= */

router.post("/change-password-otp", protect, async (req, res) => {
  try {
    const email = req.user.email;

    if (!email) {
      return res.status(400).json({ message: "User email not found." });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

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

router.post("/change-password-verify", protect, async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    const email = req.user.email; 

    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res.status(400).json({ message: "Invalid or expired OTP." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await Employee.findOneAndUpdate(
      { email },
      { password: hashedPassword }
    );

    await Otp.deleteOne({ email });

    res.status(200).json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Change Password Verify Error:", error);
    res.status(500).json({ error: "Failed to update password." });
  }
});


export default router;