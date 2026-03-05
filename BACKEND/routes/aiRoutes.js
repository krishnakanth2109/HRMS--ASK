

const AI_BASE = "https://ai-features-nzmi.onrender.com";

import express from "express";
import axios from "axios";

const router = express.Router();


/* ---------------- GENERATE DESCRIPTION ---------------- */
router.post("/generate", async (req, res) => {
  try {
    const title = req.body?.title?.trim();

    if (!title) {
      return res.status(400).json({ error: "title is required" });
    }

    const response = await axios.post(
      `${AI_BASE}/generate`,
      { title },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 60000
      }
    );

    if (!response.data?.description) {
      return res.status(502).json({ error: "Invalid AI response" });
    }

    res.status(200).json({
      description: response.data.description
    });

  } catch (err) {
    console.error(
      "AI GENERATE ERROR:",
      err.response?.status,
      err.response?.data || err.message
    );

    res.status(500).json({ error: "AI generation failed" });
  }
});

/* ---------------- TITLE SUGGESTIONS ---------------- */
router.get("/suggest", async (req, res) => {
  try {
    const q = req.query?.q?.trim();

    if (!q) {
      return res.json({ suggestions: [] });
    }

    const response = await axios.get(`${AI_BASE}/suggest`, {
      params: { q },
      timeout: 60000
    });

    res.json({
      suggestions: response.data?.suggestions || []
    });

  } catch (err) {
    console.error(
      "AI SUGGEST ERROR:",
      err.response?.status,
      err.response?.data || err.message
    );

    res.status(500).json({ suggestions: [] });
  }
});

/* ---------------- AUTOCOMPLETE ---------------- */
router.get("/autocomplete", async (req, res) => {
  try {
    const q = req.query?.q?.trim();

    if (!q) {
      return res.json({ completion: "" });
    }

    const response = await axios.get(`${AI_BASE}/autocomplete`, {
      params: { q },
      timeout: 60000
    });

    res.json({
      completion: response.data?.completion || ""
    });

  } catch (err) {
    console.error(
      "AI AUTOCOMPLETE ERROR:",
      err.response?.status,
      err.response?.data || err.message
    );

    res.status(500).json({ completion: "" });
  }
});

export default router;
