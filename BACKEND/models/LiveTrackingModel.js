import mongoose from "mongoose";

const liveTrackingSchema = new mongoose.Schema(
    {
        employeeId: { type: String, required: true, index: true },
        date: { type: String, required: true },
        currentStatus: { type: String, enum: ["WORKING", "IDLE", "OFFLINE"], default: "OFFLINE" },
        lastPing: { type: Date },
        idleSince: { type: Date, default: null }
    },
    { timestamps: true }
);

liveTrackingSchema.index({ employeeId: 1, date: 1 }, { unique: true });

export default mongoose.model("LiveTracking", liveTrackingSchema);
