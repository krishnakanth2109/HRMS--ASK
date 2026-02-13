// --- START OF FILE employeeRoutes.js ---

import express from "express";
import Employee from "../models/employeeModel.js";
import Company from "../models/CompanyModel.js";
import Notification from "../models/notificationModel.js";
import Otp from "../models/OtpModel.js"; 
import { upload, cloudinary } from "../config/cloudinary.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import nodemailer from "nodemailer";
import bcrypt from "bcrypt"; 

const router = express.Router();

// FIXED: Nodemailer transporter configuration with better error handling
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT) || 587, // Use 587 for TLS, 465 for SSL
  secure: process.env.SMTP_SECURE === "true" || false, // false for 587, true for 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false // Only for development, helps with self-signed certificates
  }
});

// Verify transporter connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error("❌ Email server configuration error:", error);
    console.log("Please check your SMTP credentials in .env file");
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

/* ==============================================================
==============
 📁 1. FILE UPLOAD ROUTE
=================================================================
=========== */
router.post("/upload-doc", protect, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Handle file upload to Cloudinary manually
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    
    // Determine resource type
    let resourceType = 'raw';
    if (req.file.mimetype.startsWith('image/')) {
      resourceType = 'image';
    }
    
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: "hrms_employee_documents",
      resource_type: resourceType,
    });

    res.status(200).json({ url: result.secure_url });
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

// FIXED: /onboard route with proper file handling
// FIXED: /onboard route with proper file handling using memory storage only
router.post("/onboard", upload.fields([
  { name: 'aadhaarCard', maxCount: 1 },
  { name: 'panCard', maxCount: 1 },
  { name: 'companyDocuments' }
]), async (req, res) => {
  try {
    // Log received files for debugging
    console.log("========== ONBOARD REQUEST ==========");
    console.log("Received files:", {
      aadhaarCard: req.files?.['aadhaarCard'] ? req.files['aadhaarCard'].length : 0,
      panCard: req.files?.['panCard'] ? req.files['panCard'].length : 0,
      companyDocuments: req.files?.['companyDocuments'] ? req.files['companyDocuments'].length : 0
    });

    // 1. Parse the text data
    if (!req.body.jsonData) {
      return res.status(400).json({ error: "No form data received" });
    }
    
    const data = JSON.parse(req.body.jsonData);
    console.log("Company ID:", data.company);

    const company = await Company.findById(data.company);
    if (!company) return res.status(404).json({ error: "Company not found" });

    // 2. ID Generation Logic
    const currentCount = await Employee.countDocuments({ company: data.company });
    const paddedCount = String(currentCount + 1).padStart(2, "0");
    const employeeId = `${company.prefix}${paddedCount}`;
    console.log("Generated Employee ID:", employeeId);

    // 3. Construct the Employee Object
    const newEmployeeData = {
      ...data,
      employeeId,
      role: "employee",
      isActive: true,
      personalDetails: {
        ...data.personalDetails,
        aadhaarFileUrl: null,
        panFileUrl: null
      },
      companyDocuments: []
    };

    // 4. Handle Aadhaar Card Upload (Image) - DIRECT TO CLOUDINARY
    if (req.files && req.files['aadhaarCard'] && req.files['aadhaarCard'][0]) {
      const file = req.files['aadhaarCard'][0];
      console.log("Processing Aadhaar Card:", file.originalname);
      
      try {
        // Convert buffer to base64
        const b64 = Buffer.from(file.buffer).toString("base64");
        const dataURI = "data:" + file.mimetype + ";base64," + b64;
        
        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: "hrms_employee_documents/aadhaar",
          resource_type: "image",
          public_id: `aadhaar_${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, "")}`,
          format: file.originalname.split('.').pop()
        });
        
        newEmployeeData.personalDetails.aadhaarFileUrl = uploadResult.secure_url;
        console.log("✅ Aadhaar uploaded to Cloudinary:", uploadResult.secure_url);
      } catch (uploadError) {
        console.error("❌ Aadhaar upload failed:", uploadError);
        return res.status(500).json({ 
          error: "Failed to upload Aadhaar card", 
          details: uploadError.message 
        });
      }
    } else {
      console.warn("⚠️ No Aadhaar Card file received");
      return res.status(400).json({ error: "Aadhaar card is required" });
    }

    // 5. Handle PAN Card Upload (Image) - DIRECT TO CLOUDINARY
    if (req.files && req.files['panCard'] && req.files['panCard'][0]) {
      const file = req.files['panCard'][0];
      console.log("Processing PAN Card:", file.originalname);
      
      try {
        // Convert buffer to base64
        const b64 = Buffer.from(file.buffer).toString("base64");
        const dataURI = "data:" + file.mimetype + ";base64," + b64;
        
        // Upload to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(dataURI, {
          folder: "hrms_employee_documents/pan",
          resource_type: "image",
          public_id: `pan_${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, "")}`,
          format: file.originalname.split('.').pop()
        });
        
        newEmployeeData.personalDetails.panFileUrl = uploadResult.secure_url;
        console.log("✅ PAN uploaded to Cloudinary:", uploadResult.secure_url);
      } catch (uploadError) {
        console.error("❌ PAN upload failed:", uploadError);
        return res.status(500).json({ 
          error: "Failed to upload PAN card", 
          details: uploadError.message 
        });
      }
    } else {
      console.warn("⚠️ No PAN Card file received");
      return res.status(400).json({ error: "PAN card is required" });
    }

    // 6. Handle Company Documents (PDF, DOCX, etc.) - DIRECT TO CLOUDINARY
    if (req.files && req.files['companyDocuments'] && req.files['companyDocuments'].length > 0) {
      console.log(`Processing ${req.files['companyDocuments'].length} company documents`);
      
      for (const file of req.files['companyDocuments']) {
        try {
          console.log(`Uploading ${file.originalname} to Cloudinary...`);
          
          // Convert buffer to base64
          const b64 = Buffer.from(file.buffer).toString("base64");
          const dataURI = "data:" + file.mimetype + ";base64," + b64;
          
          // Determine resource type
          const resourceType = file.mimetype.startsWith('image/') ? 'image' : 'raw';
          
          // Upload to Cloudinary
          const uploadResult = await cloudinary.uploader.upload(dataURI, {
            folder: "hrms_employee_documents/company",
            resource_type: resourceType,
            public_id: `${Date.now()}_${file.originalname.replace(/\.[^/.]+$/, "")}`,
            format: file.originalname.split('.').pop()
          });
          
          newEmployeeData.companyDocuments.push({
            fileName: file.originalname,
            fileUrl: uploadResult.secure_url,
            uploadedAt: new Date(),
            fileType: file.mimetype,
            fileSize: file.size
          });
          
          console.log(`✅ Uploaded ${file.originalname}: ${uploadResult.secure_url}`);
        } catch (uploadError) {
          console.error(`❌ Error uploading ${file.originalname}:`, uploadError);
          return res.status(500).json({ 
            error: `Failed to upload document: ${file.originalname}`,
            details: uploadError.message 
          });
        }
      }
    }

    // 7. Validate required files
    if (!newEmployeeData.personalDetails.aadhaarFileUrl) {
      console.error("❌ Aadhaar file URL is missing");
      return res.status(400).json({ error: "Aadhaar card upload failed" });
    }
    
    if (!newEmployeeData.personalDetails.panFileUrl) {
      console.error("❌ PAN file URL is missing");
      return res.status(400).json({ error: "PAN card upload failed" });
    }

    // 8. Save to Database
    console.log("Saving employee to database...");
    console.log("Aadhaar URL:", newEmployeeData.personalDetails.aadhaarFileUrl);
    console.log("PAN URL:", newEmployeeData.personalDetails.panFileUrl);
    console.log("Company Documents:", newEmployeeData.companyDocuments.length);
    
    const employee = new Employee(newEmployeeData);
    const result = await employee.save();
    
    // Update company count
    company.employeeCount = await Employee.countDocuments({ company: data.company });
    await company.save();
    
    console.log(`✅ Employee onboarded successfully: ${result.employeeId}`);
    console.log("======================================");
    
    res.status(201).json({ 
      success: true, 
      message: "Onboarding successful", 
      employeeId: result.employeeId 
    });

  } catch (err) {
    console.error("❌ Onboarding error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({ 
      success: false,
      error: "Internal Server Error", 
      message: err.message 
    });
  }
});

// FIXED: ROUTE: SEND OTP with better error handling
router.post("/send-onboarding-otp", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

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

    // Check if SMTP credentials are configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("⚠️ SMTP credentials not configured. OTP will not be sent via email.");
      console.log(`OTP for ${email}: ${otpCode} (Save this for testing)`);
      
      // For development, return OTP in response (remove in production)
      if (process.env.NODE_ENV !== 'production') {
        return res.status(200).json({ 
          message: "OTP generated (SMTP not configured)", 
          otp: otpCode,
          devMode: true 
        });
      }
    }

    // Try to send email, but don't fail if email fails
    try {
      await transporter.sendMail({
        from: `"HRMS Team" <${process.env.SMTP_USER || 'noreply@hrms.com'}>`,
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
      console.log(`OTP email sent to ${email}`);
    } catch (emailError) {
      console.error("Failed to send OTP email:", emailError);
      // Don't return error, just log it
    }

    // Always return success (OTP is saved in DB)
    res.status(200).json({ 
      message: "OTP sent to email.",
      // Include OTP in development mode only
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otpCode })
    });
    
  } catch (error) {
    console.error("OTP Error:", error);
    res.status(500).json({ error: "Failed to process OTP request." });
  }
});

/* ==============================================================
==============
 🔑 4. PASSWORD RESET ROUTES
=================================================================
=========== */

// FIXED: Forgot password OTP with better error handling
router.post("/forgot-password-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

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

    // Check if SMTP credentials are configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("⚠️ SMTP credentials not configured. Password reset OTP will not be sent via email.");
      console.log(`Password reset OTP for ${email}: ${otpCode}`);
      
      if (process.env.NODE_ENV !== 'production') {
        return res.status(200).json({ 
          message: "OTP generated (SMTP not configured)", 
          otp: otpCode,
          devMode: true 
        });
      }
    }

    try {
      await transporter.sendMail({
        from: `"HRMS Support" <${process.env.SMTP_USER || 'noreply@hrms.com'}>`,
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
    } catch (emailError) {
      console.error("Failed to send password reset email:", emailError);
    }

    res.status(200).json({ 
      message: "OTP sent to your email.",
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otpCode })
    });
  } catch (error) {
    console.error("Forgot Password OTP Error:", error);
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

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

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP, and new password are required" });
    }

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

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("⚠️ SMTP credentials not configured. Change password OTP will not be sent.");
      console.log(`Change password OTP for ${email}: ${otpCode}`);
      
      if (process.env.NODE_ENV !== 'production') {
        return res.status(200).json({ 
          message: "OTP generated (SMTP not configured)", 
          otp: otpCode,
          devMode: true 
        });
      }
    }

    try {
      await transporter.sendMail({
        from: `"HRMS Security" <${process.env.SMTP_USER || 'noreply@hrms.com'}>`,
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
    } catch (emailError) {
      console.error("Failed to send change password email:", emailError);
    }

    res.status(200).json({ 
      message: "OTP sent to your registered email.",
      ...(process.env.NODE_ENV !== 'production' && { devOtp: otpCode })
    });
  } catch (error) {
    console.error("Change Password OTP Error:", error);
    res.status(500).json({ error: "Failed to send OTP." });
  }
});

router.post("/change-password-verify", protect, async (req, res) => {
  try {
    const { otp, newPassword } = req.body;
    const email = req.user.email; 

    if (!otp || !newPassword) {
      return res.status(400).json({ message: "OTP and new password are required" });
    }

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
// --- END OF FILE employeeRoutes.js ---