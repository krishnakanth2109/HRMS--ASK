// --- START OF FILE routes/categoryRoutes.js ---

import express from "express";
import Category from "../models/Category.js";

const router = express.Router();

/* ========================= GET ALL CATEGORIES ========================= */
router.get("/", async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch categories", error: err.message });
  }
});

/* ========================= CREATE CATEGORY ========================= */
router.post("/", async (req, res) => {
  try {
    const { id, name } = req.body;

    if (!id || !name)
      return res.status(400).json({ message: "id and name are required" });

    const exists = await Category.findOne({ id });
    if (exists)
      return res.status(400).json({ message: "Category ID already exists" });

    const category = await Category.create({ id, name });
    res.json({ success: true, data: category });

  } catch (err) {
    res.status(500).json({ message: "Failed to add category", error: err.message });
  }
});

/* ========================= DELETE CATEGORY ========================= */
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Category.findOneAndDelete({ id: req.params.id });

    if (!deleted)
      return res.status(404).json({ message: "Category not found" });

    res.json({ success: true, message: "Category deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete category", error: err.message });
  }
});

export default router;

// --- END OF FILE routes/categoryRoutes.js ---
