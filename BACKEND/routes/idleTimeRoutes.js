import express from "express";
import IdleTime from "../models/IdleTimeModel.js";
import LiveTracking from "../models/LiveTrackingModel.js";

const router = express.Router();

// ------------------------------------------
// LIVE STATUS POST (From Desktop Mouse Tracker)
// ------------------------------------------
router.post('/live-status', async (req, res) => {
  try {
    const { employeeId, status, duration_seconds, timestamp } = req.body;

    // Ensure date is consistent (YYYY-MM-DD)
    const date = new Date().toISOString().split('T')[0];

    await LiveTracking.findOneAndUpdate(
      { employeeId: employeeId, date: date },
      {
        currentStatus: status,
        lastPing: new Date(timestamp * 1000),
        idleSince: req.body.idle_since ? new Date(req.body.idle_since * 1000) : null
      },
      { upsert: true }
    );

    console.log(`📡 [Live Tracking] Telemetry received for employee ${employeeId}: Status=${status}, IdleSince=${req.body.idle_since}`);
    res.status(200).json({ message: "Telemetry Received" });
  } catch (error) {
    console.error("Live Status Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// ------------------------------------------
// LIVE STATUS GET (For Admin Dashboard)
// ------------------------------------------
router.get('/live-status', async (req, res) => {
  try {
    // Ensure date is consistent (YYYY-MM-DD)
    const date = new Date().toISOString().split('T')[0];

    // Fetch all live tracking data for today
    const liveData = await LiveTracking.find({ date: date });

    res.status(200).json(liveData);
  } catch (error) {
    console.error("Fetch Live Status Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

/**
 * POST /idletime
 * Save idle session safely with UPSERT(NO duplicates)
 */
router.post("/", async (req, res) => {
  console.log("📥 [Idle Time] Received session for employee:", req.body.employeeId);
  try {
    const {
      employeeId,
      name,
      department,
      role,
      date,
      idleStart,
      idleEnd,
      idleDurationSeconds,
    } = req.body;

    if (!employeeId || !idleStart || !idleEnd || !date) {
      return res.status(400).json({ message: "Missing required values" });
    }

    // NEW idle session object
    const idleEntry = {
      idleStart: new Date(idleStart),
      idleEnd: new Date(idleEnd),
      idleDurationSeconds,
    };

    // Atomic operation: create OR update the SAME document
    const updatedRecord = await IdleTime.findOneAndUpdate(
      { employeeId, date },
      {
        $setOnInsert: { employeeId, name, department, role, date },
        $push: { idleTimeline: idleEntry },
      },
      {
        new: true,
        upsert: true, // This ensures no duplicates EVER
      }
    );

    return res.json({
      message: "Idle session saved",
      record: updatedRecord,
    });
  } catch (err) {
    console.error("❌ Idle time save error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message || err,
    });
  }
});

/**
 * GET /idletime/:employeeId/:date
 */
router.get("/:employeeId/:date", async (req, res) => {
  const { employeeId, date } = req.params;
  console.log(`🔍 [Idle Time] Fetching report for ${employeeId} on ${date}`);

  try {
    // Try exact match first
    let record = await IdleTime.findOne({ employeeId, date });

    // Case-insensitive fallback for employeeId
    if (!record) {
      console.log(`⚠️  No exact match for ${employeeId}. Trying case-insensitive...`);
      record = await IdleTime.findOne({
        employeeId: { $regex: new RegExp(`^${employeeId}$`, "i") },
        date
      });
    }

    if (record) {
      console.log(`✅ [Idle Time] Record found. Sessions: ${record.idleTimeline.length}`);
    } else {
      console.log(`❌ [Idle Time] No record found for ${employeeId} on ${date}`);
    }

    return res.json(record || { employeeId, date, idleTimeline: [] });
  } catch (err) {
    console.error("❌ Get idle time error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /idletime/employee/:employeeId
 */
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const rows = await IdleTime.find({
      employeeId: req.params.employeeId,
    }).sort({ date: -1 });

    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
