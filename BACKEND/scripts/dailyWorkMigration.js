import dotenv from "dotenv";
import mongoose from "mongoose";

import DailyWorkEntry from "../models/DailyWorkEntry.js";
import WorkImage from "../models/WorkImage.js";

dotenv.config();

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });

    await DailyWorkEntry.syncIndexes();
    await WorkImage.syncIndexes();

    console.log("✅ Daily work indexes synced successfully.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Daily work migration failed:", error.message);
    process.exit(1);
  }
};

run();
