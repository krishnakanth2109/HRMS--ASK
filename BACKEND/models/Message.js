import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true, // Index for faster lookup
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true, // Index for faster lookup
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for fetching chat history between two specific users quickly
MessageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });
MessageSchema.index({ sender: 1, isRead: 1 }); // Optimize unread counts

export default mongoose.model("Message", MessageSchema);