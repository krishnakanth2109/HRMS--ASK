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
import multer from "multer";

const router = express.Router();

const memoryStorage = multer.memoryStorage();
const memoryUpload = multer({ storage: memoryStorage });

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

// GET role/department suggestions from existing employees (nested array-safe)
// Must be defined BEFORE /:id to avoid route conflict
// GET role/department suggestions from existing employees
router.get("/suggestions", protect, async (req, res) => {
  try {
    const { field, query } = req.query;

    if (!field || !query || query.trim().length < 2) {
      return res.status(200).json([]);
    }

    // Map frontend field names to backend schema paths
    // In your schema, these are inside the experienceDetails array
    const fieldPath = `experienceDetails.${field}`;
    const regex = new RegExp(query.trim(), "i");

    // Use MongoDB distinct with a filter
    const results = await Employee.distinct(fieldPath, { [fieldPath]: regex });

    // Limit and filter
    const suggestions = results.filter(Boolean).slice(0, 8);
    res.status(200).json(suggestions);
  } catch (err) {
    console.error("Suggestions fetch error:", err);
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

    // ── EMAIL: notify employee their account is reactivated ──────────────────
    if (emp.email) {
      try {
        // Use service:"gmail" — same pattern as the working OTP routes in this file
        const reactivationTransporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const reactivatedOn = new Date(date || Date.now()).toLocaleDateString("en-IN", {
          weekday: "long", year: "numeric", month: "long", day: "numeric",
        });

        const reactivationEmailHtml = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:40px 15px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 8px 24px rgba(0,0,0,0.09);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#065f46,#059669,#10b981);
                     padding:42px 32px;text-align:center;">
            <p style="margin:0 0 8px;font-size:12px;color:#a7f3d0;
                      letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              HRMS &mdash; Account Status Update
            </p>
            <h1 style="margin:0;font-size:28px;color:#ffffff;font-weight:800;line-height:1.3;">
              Your Account Has Been Reactivated!
            </h1>
            <p style="margin:12px 0 0;color:#d1fae5;font-size:15px;line-height:1.6;">
              Welcome back! You can now log in to your HRMS portal.
            </p>
          </td>
        </tr>

        <!-- Welcome Banner -->
        <tr>
          <td style="background:#f0fdf4;border-bottom:3px solid #10b981;
                     padding:16px 32px;text-align:center;">
            <p style="margin:0;font-size:14px;color:#065f46;font-weight:600;">
              Your HRMS account is now active and fully accessible
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:38px 32px 28px;">
            <p style="margin:0 0 6px;font-size:17px;color:#1f2937;font-weight:600;">
              Dear <strong>${emp.name}</strong>,
            </p>
            <p style="margin:0 0 26px;font-size:15px;color:#4b5563;line-height:1.8;">
              We are pleased to inform you that your HRMS employee account has been
              <strong style="color:#059669;">successfully reactivated</strong> by your
              administrator. You now have full access to all your HRMS features and services.
            </p>

            <!-- Account Details Card -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              Your Account Details
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f0fdf4;border-radius:10px;padding:20px 22px;
                          border:1px solid #bbf7d0;margin-bottom:24px;">
              <tr><td>
                <table width="100%" style="font-size:14px;border-collapse:collapse;">
                  <tr>
                    <td style="padding:10px 0;color:#374151;width:40%;">Full Name</td>
                    <td style="padding:10px 0;text-align:right;font-weight:700;color:#111827;">
                      ${emp.name}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #dcfce7;">
                    <td style="padding:10px 0;color:#374151;">Employee ID</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;
                               color:#111827;font-family:monospace;">
                      ${emp.employeeId}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #dcfce7;">
                    <td style="padding:10px 0;color:#374151;">Email Address</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#059669;">
                      ${emp.email}
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #dcfce7;">
                    <td style="padding:10px 0;color:#374151;">Account Status</td>
                    <td style="padding:10px 0;text-align:right;">
                      <span style="background:#dcfce7;color:#166534;padding:4px 16px;
                                   border-radius:20px;font-size:13px;font-weight:700;">
                        &#9679; Active
                      </span>
                    </td>
                  </tr>
                  <tr style="border-top:1px solid #dcfce7;">
                    <td style="padding:10px 0;color:#374151;">Reactivated On</td>
                    <td style="padding:10px 0;text-align:right;font-weight:600;color:#111827;">
                      ${reactivatedOn}
                    </td>
                  </tr>
                  ${reason
                    ? `<tr style="border-top:1px solid #dcfce7;">
                         <td style="padding:10px 0;color:#374151;vertical-align:top;">Reason</td>
                         <td style="padding:10px 0;text-align:right;color:#4b5563;font-style:italic;">
                           &ldquo;${reason}&rdquo;
                         </td>
                       </tr>`
                    : ""}
                </table>
              </td></tr>
            </table>

            <!-- What You Can Do Now -->
            <p style="margin:0 0 10px;font-size:12px;font-weight:700;color:#6b7280;
                      text-transform:uppercase;letter-spacing:1px;">
              What You Can Do Now
            </p>
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#f8fafc;border-radius:10px;padding:18px 22px;
                          border:1px solid #e5e7eb;margin-bottom:26px;">
              <tr><td style="font-size:14px;color:#374151;line-height:2.2;">
                &#10004;&nbsp; Log in using your registered email and password<br/>
                &#10004;&nbsp; View and manage your attendance records<br/>
                &#10004;&nbsp; Apply for leaves and track their status<br/>
                &#10004;&nbsp; Access your payslips and documents<br/>
                &#10004;&nbsp; Update your personal profile information
              </td></tr>
            </table>

            <!-- CTA Note -->
            <table width="100%" cellspacing="0" cellpadding="0"
                   style="background:#ecfdf5;border-radius:10px;padding:20px 22px;
                          border:1px solid #a7f3d0;margin-bottom:24px;">
              <tr><td style="text-align:center;">
                <p style="margin:0 0 6px;font-size:15px;color:#065f46;font-weight:700;">
                  Ready to get started?
                </p>
                <p style="margin:0;font-size:14px;color:#047857;line-height:1.7;">
                  Visit your HRMS portal and log in with your existing credentials.<br/>
                  If you have forgotten your password, use the
                  <strong>&ldquo;Forgot Password&rdquo;</strong> option on the login page.
                </p>
              </td></tr>
            </table>

            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
              If you have any questions or face issues logging in, please contact
              your HR administrator or our support team.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f3f4f6;padding:20px 32px;text-align:center;
                     font-size:12px;color:#9ca3af;line-height:1.7;">
            &copy; ${new Date().getFullYear()} Attendance Management System &nbsp;&bull;&nbsp;
            This is an automated notification regarding your account status.<br/>
            Please do not reply directly to this email.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

        await reactivationTransporter.sendMail({
          from:    `"HRMS Team" <${process.env.SMTP_USER}>`,
          to:      emp.email,
          subject: `Your HRMS Account Has Been Reactivated - Welcome Back, ${emp.name}!`,
          html:    reactivationEmailHtml,
        });
        console.log(`✅ Reactivation email sent to: ${emp.email}`);
      } catch (emailErr) {
        console.error("❌ Failed to send reactivation email:", emailErr.message);
      }
    }

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
router.post("/onboard", memoryUpload.fields([
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

    // ✅ FIX: Check if this email already has a full employee profile.
    // This covers the case where a previous onboard succeeded but mark-onboarded failed,
    // and the frontend recovery path re-submits. Return success so the user can proceed.
    const existingByEmail = await Employee.findOne({ email: data.email?.toLowerCase() });
    if (existingByEmail) {
      console.log(`ℹ️ Employee with email ${data.email} already exists. Returning existing profile.`);
      return res.status(200).json({
        success: true,
        message: "Onboarding already completed",
        employeeId: existingByEmail.employeeId,
        alreadyExists: true
      });
    }

    // 2. ✅ FIX: Collision-safe ID Generation.
    // countDocuments can be stale if employees were deleted/re-indexed.
    // We loop until we find an ID not yet taken in the DB.
    const currentCount = await Employee.countDocuments({ company: data.company });
    let counter = currentCount + 1;
    let employeeId = `${company.prefix}${String(counter).padStart(2, "0")}`;
    while (await Employee.findOne({ employeeId })) {
      counter++;
      employeeId = `${company.prefix}${String(counter).padStart(2, "0")}`;
    }
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
    
    // 🚨 FIX: Handle Mongoose Duplicate Key Errors gracefully.
    // Even with collision-safe ID generation, a race condition (two simultaneous submits)
    // could still hit this. In that case the employee WAS created — return success.
    if (err.code === 11000) {
      const duplicateField = Object.keys(err.keyValue || {})[0];
      const duplicateValue = err.keyValue?.[duplicateField];

      // If it's a duplicate email, the profile exists — return it so frontend can proceed
      if (duplicateField === 'email' && duplicateValue) {
        const existing = await Employee.findOne({ email: duplicateValue });
        if (existing) {
          return res.status(200).json({
            success: true,
            message: "Onboarding already completed",
            employeeId: existing.employeeId,
            alreadyExists: true
          });
        }
      }

      // For other duplicate fields (shouldn't happen with collision-safe ID gen)
      return res.status(400).json({ 
        success: false, 
        error: `This ${duplicateField} is already registered. If you have already onboarded, please log in.` 
      });
    }

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

    // 1. Check if employee exists
    const employee = await Employee.findOne({ email });
    if (!employee) {
      return res.status(404).json({ message: "Email not found in our records." });
    }

    // 2. Generate and Save OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // 3. Create Transporter inside the route (The Fix)
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // Your 16-character app password
      },
    });

    // 4. Send the Email
    try {
      await transporter.sendMail({
        from: `"HRMS Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Password Reset Request",
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: #1e40af;">Password Reset</h2>
            <p>We received a request to reset your password for the HRMS portal.</p>
            <p>Your OTP is: <strong style="font-size: 24px; color: #dc2626; letter-spacing: 2px;">${otpCode}</strong></p>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">This code expires in 5 minutes. If you did not request this, please ignore this email.</p>
          </div>
        `,
      });

      console.log(`✅ Forgot Password OTP sent to: ${email}`);
      
      return res.status(200).json({ 
        message: "OTP sent to your email.",
        // Only include OTP in response for development testing
        ...(process.env.NODE_ENV !== 'production' && { devOtp: otpCode })
      });

    } catch (emailError) {
      console.error("❌ Nodemailer Error (Forgot Pwd):", emailError.message);
      return res.status(500).json({ 
        message: "Failed to send email. Please try again later.",
        error: emailError.message 
      });
    }

  } catch (error) {
    console.error("❌ Forgot Password Global Error:", error);
    res.status(500).json({ error: "Failed to process request." });
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
    const email = req.user?.email;
    if (!email) return res.status(400).json({ message: "User email not found." });

    // CREATE TRANSPORTER (Use these specific settings for Gmail)
    const transporter = nodemailer.createTransport({
      service: "gmail", // Let Nodemailer handle host/port automatically
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS, // 16-character App Password
      },
    });

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // SEND MAIL
    const info = await transporter.sendMail({
      from: `"HRMS Team" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Change Password Verification",
      html: `<h3>Your OTP is: ${otpCode}</h3>`,
    });

    console.log("✅ Email Sent: " + info.response);
    res.status(200).json({ message: "OTP sent to your registered email." });

  } catch (error) {
    console.error("❌ Send OTP Error:", error.message);
    res.status(500).json({ error: error.message });
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