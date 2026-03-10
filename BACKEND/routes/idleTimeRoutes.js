import express from "express";
import IdleTime from "../models/IdleTimeModel.js";
import LiveTracking from "../models/LiveTrackingModel.js";

const router = express.Router();

// ------------------------------------------
// LIVE STATUS POST (From Desktop Mouse Tracker)
// Stores ONE document per employee, with each date as a sub-object
// Now also automatically tracks timelines of working and idle states
// ------------------------------------------
router.post('/live-status', async (req, res) => {
  try {
    const { employeeId, status, duration_seconds, timestamp, total_work_seconds, total_idle_seconds } = req.body;

    // Ensure date is consistent (YYYY-MM-DD)
    const date = new Date().toISOString().split('T')[0];
    const pingTime = new Date(timestamp * 1000);
    const idleSinceTime = req.body.idle_since ? new Date(req.body.idle_since * 1000) : null;

    // Fetch the employee's document
    let doc = await LiveTracking.findOne({ employeeId: employeeId });
    if (!doc) {
      doc = new LiveTracking({ employeeId: employeeId, dates: {} });
    }

    if (!doc.dates.has(date)) {
      // Initialize today's date structure
      const newDateData = {
        currentStatus: status,
        lastPing: pingTime,
        idleSince: idleSinceTime,
        idleTimeline: [],
        trackedWorkSeconds: total_work_seconds || 0,
        trackedIdleSeconds: total_idle_seconds || 0
      };

      // Don't modify idleTimeline here anymore, wait for explicit save_idle_session POSTs
      doc.dates.set(date, newDateData);
    } else {
      const todayData = doc.dates.get(date);
      todayData.currentStatus = status;
      todayData.lastPing = pingTime;
      todayData.idleSince = idleSinceTime;
      if (total_work_seconds !== undefined) todayData.trackedWorkSeconds = total_work_seconds;
      if (total_idle_seconds !== undefined) todayData.trackedIdleSeconds = total_idle_seconds;

      // Remove live-inference logic to avoid drift, instead we wait for 
      // the tracker's explicit save_idle_session chunk POST to /api/idletime
      doc.dates.set(date, todayData);
    }

    await doc.save();

    console.log(`📡 [Live Tracking] Telemetry received for employee ${employeeId}: Status=${status}, IdleSince=${req.body.idle_since}`);
    res.status(200).json({ message: "Telemetry Received" });
  } catch (error) {
    console.error("Live Status Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// ------------------------------------------
// LIVE STATUS GET (For Admin Dashboard)
// Returns a flat array of today's employee data
// so the frontend doesn't need to change
// ------------------------------------------
router.get('/live-status', async (req, res) => {
  try {
    // Ensure date is consistent (YYYY-MM-DD)
    const date = new Date().toISOString().split('T')[0];

    // Find all employee documents
    const allDocs = await LiveTracking.find({});

    const liveArray = [];
    allDocs.forEach((doc) => {
      // Check if this employee has data for today
      if (doc.dates && doc.dates.has(date)) {
        const todayData = doc.dates.get(date);
        liveArray.push({
          _id: `${doc._id}_${date}`,
          employeeId: doc.employeeId,
          date: date,
          currentStatus: todayData.currentStatus,
          lastPing: todayData.lastPing,
          idleSince: todayData.idleSince,
          idleTimeline: todayData.idleTimeline, // Send only the idle timeline array
          trackedWorkSeconds: todayData.trackedWorkSeconds || 0,
          trackedIdleSeconds: todayData.trackedIdleSeconds || 0
        });
      }
    });

    res.status(200).json(liveArray);
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

    // NEW idle session object to insert into LiveTracking
    const idleEntry = {
      startTime: new Date(idleStart),
      endTime: new Date(idleEnd),
      idleDurationSeconds,
    };

    let doc = await LiveTracking.findOne({ employeeId });
    if (!doc) {
      doc = new LiveTracking({ employeeId, dates: {} });
    }

    if (!doc.dates.has(date)) {
      doc.dates.set(date, { idleTimeline: [] });
    }

    const todayData = doc.dates.get(date);
    const existingTimeline = todayData.idleTimeline || [];
    existingTimeline.push(idleEntry);
    todayData.idleTimeline = existingTimeline;
    doc.dates.set(date, todayData);

    await doc.save();

    return res.json({
      message: "Idle session saved directly to LiveTracking database",
      record: doc,
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
    let doc = await LiveTracking.findOne({ employeeId: { $regex: new RegExp(`^${employeeId}$`, "i") } });

    if (doc && doc.dates && doc.dates.has(date)) {
      const todayData = doc.dates.get(date);
      const record = {
        employeeId: doc.employeeId,
        date: date,
        currentStatus: todayData.currentStatus,
        lastPing: todayData.lastPing,
        idleSince: todayData.idleSince,
        idleTimeline: todayData.idleTimeline,
        trackedWorkSeconds: todayData.trackedWorkSeconds || 0,
        trackedIdleSeconds: todayData.trackedIdleSeconds || 0
      };
      console.log(`✅ [Idle Time] Record found in LiveTracking. Sessions: ${record.idleTimeline?.length || 0}`);
      return res.json(record);
    }

    console.log(`❌ [Idle Time] No record found for ${employeeId} on ${date}`);
    return res.json({ employeeId, date, idleTimeline: [] });
  } catch (err) {
    console.error("❌ Get idle time error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

/**
 * GET /idletime/employee/:employeeId
 * Used for Weekly charts in Admin Live Tracking
 */
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const doc = await LiveTracking.findOne({
      employeeId: { $regex: new RegExp(`^${req.params.employeeId}$`, "i") }
    });

    const rows = [];
    if (doc && doc.dates) {
      for (const [dateStr, dailyData] of doc.dates.entries()) {
        rows.push({
          employeeId: doc.employeeId,
          date: dateStr,
          currentStatus: dailyData.currentStatus,
          lastPing: dailyData.lastPing,
          idleSince: dailyData.idleSince,
          idleTimeline: dailyData.idleTimeline,
          trackedWorkSeconds: dailyData.trackedWorkSeconds || 0,
          trackedIdleSeconds: dailyData.trackedIdleSeconds || 0
        });
      }
    }

    // Sort descending by date
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json(rows);
  } catch (err) {
    console.error("❌ Get employee history error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
