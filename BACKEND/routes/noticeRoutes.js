import express from "express";
import Notice from "../models/Notice.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const notices = await Notice.find().sort({ date: -1 })
    res.json(notices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notices" });
  }
});


router.post("/", async (req, res) => {
  try {
    const { title, description, date } = req.body;
    const newNotice = new Notice({ title, description, date });
    await newNotice.save();
    res.status(201).json({ message: "Notice posted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to post notice" });
  }
});

export default router;
