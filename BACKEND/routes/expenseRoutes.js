import express from 'express';
import Expense from '../models/Expense.js';
import Employee from "../models/employeeModel.js"; // Added missing import
import Company from "../models/CompanyModel.js";   // Added missing import
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Cloudinary storage for Multer with optimized settings
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    return {
      folder: 'expense-receipts',
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
      resource_type: 'auto',
      public_id: `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    };
  }
});

// Configure multer with size limit and file filter
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and PDF are allowed.'));
    }
  }
});

/* ==============================================================
==============
 📁 1. EXPENSE MANAGEMENT ROUTES
=================================================================
=========== */

// --- POST Route: Add Expense ---
router.post('/add', (req, res) => {
  upload.single('receipt')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'File too large. Maximum size is 5MB.' });
      }
      return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      const { category, amount, date, description, employeeId, employeeCustomId, employeeName } = req.body;

      if (!employeeId || !employeeCustomId || !employeeName) {
        return res.status(400).json({ success: false, message: 'Employee information is required' });
      }

      if (!category || !amount || !date) {
        return res.status(400).json({ success: false, message: 'Category, amount, and date are required' });
      }

      const newExpense = new Expense({
        employeeId,
        employeeCustomId,
        employeeName,
        category,
        amount: Number(amount),
        date,
        description: description || '',
        receiptUrl: req.file ? req.file.path : null,
        receiptPublicId: req.file ? req.file.filename : null,
        status: 'Pending'
      });

      const savedExpense = await newExpense.save();
      res.status(201).json({ success: true, message: 'Expense submitted successfully.', data: savedExpense });

    } catch (error) {
      console.error('Error adding expense:', error);
      if (req.file && req.file.filename) {
        try { await cloudinary.uploader.destroy(req.file.filename); } catch (deleteError) { console.error('Error deleting orphaned file:', deleteError); }
      }
      res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
    }
  });
});

// --- GET Route: Fetch Expenses for a Specific Employee ---
router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    if (!employeeId) return res.status(400).json({ success: false, message: 'Employee ID is required' });
    const expenses = await Expense.find({ employeeId }).sort({ date: -1 });
    res.status(200).json({ success: true, count: expenses.length, data: expenses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
});

// --- ADMIN ROUTE: Get ALL Expenses ---
router.get('/all', async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ status: 1, date: -1 });
    const sortedExpenses = expenses.sort((a, b) => {
      if (a.status === 'Pending' && b.status !== 'Pending') return -1;
      if (a.status !== 'Pending' && b.status === 'Pending') return 1;
      return new Date(b.date) - new Date(a.date);
    });
    res.status(200).json({ success: true, count: sortedExpenses.length, data: sortedExpenses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
});

// --- ADMIN ROUTE: Update Expense Status ---
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    const updatedExpense = await Expense.findByIdAndUpdate(id, { status: status, actionDate: new Date() }, { new: true });
    if (!updatedExpense) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.status(200).json({ success: true, message: `Expense marked as ${status}`, data: updatedExpense });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
});

// --- DELETE Route: Delete an Expense ---
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const expense = await Expense.findById(id);
    if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
    if (expense.receiptPublicId) {
      try { await cloudinary.uploader.destroy(expense.receiptPublicId); } catch (e) {}
    }
    await Expense.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error: ' + error.message });
  }
});

/* ==============================================================
==============
 🚀 2. PUBLIC ONBOARDING (Updated to structure experienceDetails)
=================================================================
=========== */

router.post("/onboard", async (req, res) => {
  try {
    const { 
      company: companyId, 
      currentRole, 
      currentDepartment, 
      currentSalary, 
      joiningDate, 
      employmentType,
      ...otherDetails 
    } = req.body;

    // 1. Validate Company existence
    if (!companyId) {
      return res.status(400).json({ error: "Company selection is required" });
    }

    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ error: "Selected company not found" });
    }

    // 2. Generate Employee ID (Prefix + padded count)
    const currentCount = await Employee.countDocuments({ company: companyId });
    const paddedCount = String(currentCount + 1).padStart(2, "0");
    const generatedId = `${company.prefix}${paddedCount}`;

    // 3. Structure Experience Details exactly like AddEmployee
    const experienceEntry = {
      company: company.name,
      role: currentRole,
      department: currentDepartment,
      years: 0,
      joiningDate: joiningDate,
      lastWorkingDate: "Present",
      salary: Number(currentSalary) || 0,
      employmentType: employmentType || "Full-Time",
    };

    // 4. Create Employee Object with structured array
    const employeeData = {
      ...otherDetails,
      employeeId: generatedId,
      company: companyId,
      companyName: company.name,
      companyPrefix: company.prefix,
      role: "employee",
      isActive: true,
      status: "Active",
      experienceDetails: [experienceEntry] // Put the mapped fields inside the array
    };

    const employee = new Employee(employeeData);
    const result = await employee.save();

    // 5. Update Company Employee Count
    company.employeeCount = await Employee.countDocuments({ company: companyId });
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
        field: field
      });
    }
    res.status(500).json({ error: "Onboarding failed: " + err.message });
  }
});

export default router;