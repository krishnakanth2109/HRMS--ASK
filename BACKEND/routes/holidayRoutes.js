import express from "express";
import Holiday from "../models/Holiday.js";




const router = express.Router();

// Add new holiday
router.post("/", async (req, res) => {
  try {
    const { name, description, date } = req.body;
    const newHoliday = new Holiday({ name, description, date });
    await newHoliday.save();
    res.status(201).json({ message: "Holiday added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to add holiday" });
  }
});

// Get all holidays
router.get("/", async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch holidays" });
  }
});

// Delete holiday
router.delete("/:id", async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ message: "Holiday deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete holiday" });
  }
});

export default router;
