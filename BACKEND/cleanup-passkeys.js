import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";

async function cleanup() {
  await mongoose.connect(process.env.MONGO_URI);
  const result = await mongoose.connection.db.collection("webauthncredentials").deleteMany({});
  console.log(`✅ Deleted ${result.deletedCount} old credentials from database`);
  await mongoose.disconnect();
  process.exit(0);
}

cleanup().catch(err => { console.error(err); process.exit(1); });
