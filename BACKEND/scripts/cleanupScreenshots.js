import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import LiveTracking from "../models/LiveTrackingModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const SCREENSHOT_EXPIRY_DAYS = 3;

const getScreenshotExpiryDate = (capturedAt = new Date()) => {
  const expiry = new Date(capturedAt);
  expiry.setDate(expiry.getDate() + SCREENSHOT_EXPIRY_DAYS);
  return expiry;
};

const isExpiredScreenshot = (date) => {
  if (!date) return false;
  return new Date(date) <= new Date();
};

const deleteFromCloudinary = async (url) => {
  try {
    if (!url || !url.includes("cloudinary.com")) return;
    const parts = url.split("/");
    const filename = parts.pop();
    const folder = parts.pop();
    const folderName = folder.startsWith("v") ? parts.pop() : folder;
    const publicId = `${folderName}/${filename.split(".")[0]}`;
    await cloudinary.uploader.destroy(publicId);
    console.log(`✅ [Cloudinary] Deleted: ${publicId}`);
  } catch (err) {
    console.error("❌ [Cloudinary] Delete Error:", err);
  }
};

async function runCleanup() {
  try {
    console.log("🚀 Starting Global Screenshot Cleanup...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("🔌 Connected to MongoDB");

    const allDocs = await LiveTracking.find({});
    console.log(`🔍 Found ${allDocs.length} tracking documents to check.`);

    let totalDeleted = 0;

    for (const doc of allDocs) {
      let docChanged = false;
      if (!doc.dates) continue;

      for (const [dateStr, dailyData] of doc.dates.entries()) {
        let dailyChanged = false;

        // 1. Cleanup Working Screenshots
        const workingScreenshots = dailyData.workingScreenshots || [];
        const validWorking = [];
        for (const shot of workingScreenshots) {
          const expiresAt = shot.expiresAt || getScreenshotExpiryDate(shot.capturedAt);
          if (isExpiredScreenshot(expiresAt)) {
            await deleteFromCloudinary(shot.screenshotUrl);
            totalDeleted++;
            dailyChanged = true;
          } else {
            validWorking.push(shot);
          }
        }

        if (dailyChanged) {
          dailyData.workingScreenshots = validWorking;
          docChanged = true;
        }

        // 2. Cleanup Idle Timeline Screenshots
        const timeline = dailyData.idleTimeline || [];
        for (let i = 0; i < timeline.length; i++) {
          const seg = timeline[i];
          if (!seg.screenshotUrl) continue;

          const expiresAt = seg.screenshotExpiresAt || getScreenshotExpiryDate(seg.startTime);
          if (isExpiredScreenshot(expiresAt)) {
            await deleteFromCloudinary(seg.screenshotUrl);
            totalDeleted++;
            // We keep the segment but nullify the screenshot
            const plainSeg = seg.toObject ? seg.toObject() : seg;
            timeline[i] = { ...plainSeg, screenshotUrl: null, screenshotExpiresAt: null };
            dailyChanged = true;
            docChanged = true;
          }
        }

        if (dailyChanged) {
          doc.dates.set(dateStr, dailyData);
        }
      }

      if (docChanged) {
        await doc.save();
        console.log(`✅ Updated document for Employee: ${doc.employeeId}`);
      }
    }

    console.log(`✨ Cleanup Finished. Total screenshots deleted from Cloudinary: ${totalDeleted}`);
  } catch (error) {
    console.error("❌ Cleanup Script Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
    process.exit(0);
  }
}

runCleanup();
