import express from "express";
import Holiday from "../models/Holiday.js";

const router = express.Router();

/* ============================================================
   ADD NEW HOLIDAY (Start Date + End Date)
   ============================================================ */
router.post("/", async (req, res) => {
  try {
    const { name, description, startDate, endDate } = req.body;

    if (!name || !description || !startDate || !endDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newHoliday = new Holiday({
      name,
      description,
      startDate,
      endDate,
    });

    await newHoliday.save();

    res.status(201).json({ message: "Holiday added successfully" });
  } catch (error) {
    console.error("Add holiday error:", error);
    res.status(500).json({ message: "Failed to add holiday" });
  }
});

/* ============================================================
   GET ALL HOLIDAYS (sorted by startDate)
   ============================================================ */
router.get("/", async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ startDate: 1 });
    res.json(holidays);
  } catch (error) {
    console.error("Get holidays error:", error);
    res.status(500).json({ message: "Failed to fetch holidays" });
  }
});

/* ============================================================
   DELETE HOLIDAY
   ============================================================ */
router.delete("/:id", async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ message: "Holiday deleted successfully" });
  } catch (error) {
    console.error("Delete holiday error:", error);
    res.status(500).json({ message: "Failed to delete holiday" });
  }
});

export default router;
