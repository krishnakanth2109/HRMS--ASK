// --- START OF FILE routes/shiftRoutes.js ---

import express from "express";
import Shift from "../models/shiftModel.js";
import Employee from "../models/employeeModel.js";

const router = express.Router();

/* ======================= GET ALL SHIFTS ======================= */
router.get("/all", async (req, res) => {
  try {
    const shifts = await Shift.find();
    res.json({ success: true, data: shifts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ======================= GET SHIFT BY EMPLOYEE ======================= */
router.get("/:employeeId", async (req, res) => {
  try {
    const shift = await Shift.findOne({ employeeId: req.params.employeeId });
    res.json({ success: true, data: shift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ======================= CREATE OR UPDATE SHIFT ======================= */
router.post("/create", async (req, res) => {
  try {
    const data = req.body;

    const emp = await Employee.findOne({ employeeId: data.employeeId });
    if (!emp)
      return res.status(404).json({ success: false, message: "Employee not found" });

    const shift = await Shift.findOneAndUpdate(
      { employeeId: data.employeeId },
      {
        ...data,
        employeeName: emp.name,
        email: emp.email,
        department: emp.department || "N/A",
        role: emp.role || "N/A",
        updatedBy: "Admin",
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: shift });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ======================= UPDATE CATEGORY ONLY ======================= */
router.post("/update-category", async (req, res) => {
  try {
    const { employeeId, category } = req.body;

    if (!employeeId)
      return res.status(400).json({ message: "employeeId required" });

    const updated = await Shift.findOneAndUpdate(
      { employeeId },
      { category },
      { new: true }
    );

    res.json({ message: "Category updated", data: updated });
  } catch (error) {
    res.status(500).json({ message: "Failed to update category" });
  }
});

/* ======================= BULK CREATE SHIFTS ======================= */
router.post("/bulk-create", async (req, res) => {
  try {
    const { employeeIds, shiftData, category } = req.body;

    await Promise.all(
      employeeIds.map(async (id) => {
        const emp = await Employee.findOne({ employeeId: id });
        if (!emp) return;

        await Shift.findOneAndUpdate(
          { employeeId: id },
          {
            ...shiftData,
            category: category || null,
            employeeId: id,
            employeeName: emp.name,
            email: emp.email,
            department: emp.department || "N/A",
            role: emp.role || "N/A",
            updatedBy: "Admin",
          },
          { upsert: true }
        );
      })
    );

    res.json({ success: true, message: "Bulk shift update completed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ======================= DELETE SHIFT ======================= */
router.delete("/:employeeId", async (req, res) => {
  try {
    await Shift.findOneAndDelete({ employeeId: req.params.employeeId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;

// --- END OF FILE routes/shiftRoutes.js ---
