import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import LiveTracking from "./models/LiveTrackingModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const doc = await LiveTracking.findOne({ employeeId: "INT2607" });
  if (!doc) {
    console.log("No document found for INT2607");
  } else {
    for (const key of doc.dates.keys()) {
        const data = doc.dates.get(key);
        const hasIdleScreenshot = data.idleTimeline?.some(seg => !!seg.screenshotUrl);
        const hasWorkingScreenshot = data.workingScreenshots?.length > 0;
        
        if (hasIdleScreenshot || hasWorkingScreenshot) {
            console.log(`- ${key}: idle screenshots=${hasIdleScreenshot}, working=${data.workingScreenshots?.length || 0}`);
            if (hasIdleScreenshot) {
                const idle = data.idleTimeline.find(seg => !!seg.screenshotUrl);
                console.log(`  Sample idle:`, idle.screenshotUrl);
            }
        }
    }
  }
  process.exit(0);
}
check();
