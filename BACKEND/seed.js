// --- START OF FILE seed.js ---

import mongoose from "mongoose";
import dotenv from "dotenv";
import Admin from "./models/adminModel.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const seedAdminAndManager = async () => {
  try {
    console.log("⏳ Connecting to database...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Database connected.");

    // ---------------------------
    // 1️⃣ CREATE ADMIN ACCOUNT
    // ---------------------------
    const adminEmail = "ops@arahinfotech.net";

    let admin = await Admin.findOne({ email: adminEmail });
    if (!admin) {
      await Admin.create({
        name: "Sanjay Kumar",
        email: adminEmail,
        password: "Admin@2026", // hashed automatically
        phone: "9491990526",
        role: "admin",
        designation: "Managing Director",
        companyName: "Arah Infotech",
      });

      console.log("✅ Admin account created.");
    } else {
      console.log("ℹ️ Admin already exists. Skipping...");
    }

    // ---------------------------
    // 2️⃣ CREATE MANAGER ACCOUNT
    // ---------------------------
    const managerEmail = "arahinfotech9@gmail.com";

    let manager = await Admin.findOne({ email: managerEmail });
    if (!manager) {
      await Admin.create({
        name: "AJAY",
        email: managerEmail,
        password: "123456789", // hashed automatically
        phone: "9876543210",
        role: "manager",
        department: "Management",
      });

      console.log("✅ Manager account created.");
    } else {
      console.log("ℹ️ Manager already exists. Skipping...");
    }

    console.log("\n🎉 Seeding completed successfully!");
    process.exit(0);

  } catch (error) {
    console.error("❌ Error during seeding:", error);
    process.exit(1);
  }
};

seedAdminAndManager();
