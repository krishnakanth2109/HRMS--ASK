import mongoose from "mongoose";

const groupSchema = new mongoose.Schema(
  {
    // ===============================
    // BASIC INFO
    // ===============================
    groupCode: {
      type: String,
      required: true,
      unique: true, // HR-GRP-001
      uppercase: true,
      trim: true,
    },

    groupName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // ===============================
    // RELATIONSHIPS
    // ===============================

    // Admin who created the group
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },

    // Group Leader (Single employee)
    groupLeader: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },

    // Group Members (Multiple employees)
    members: [
      {
        employee: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Employee",
        },
        role: {
          type: String,
          enum: ["member", "senior", "intern"],
          default: "member",
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // ===============================
    // GROUP SETTINGS
    // ===============================
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    permissions: {
      canApproveLeave: { type: Boolean, default: false },
      canAssignTasks: { type: Boolean, default: false },
      canViewReports: { type: Boolean, default: false },
    },

    // ===============================
    // AUDIT
    // ===============================
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

export default mongoose.model("Group", groupSchema);
