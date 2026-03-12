import mongoose from "mongoose";

const noticeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, default: Date.now, index: true }, // 🟢 Added Index for sorting
  
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true,
    refPath: 'creatorModel',
    index: true // 🟢 Added Index for querying
  },
  creatorModel: {
    type: String,
    required: true,
    enum: ['Admin', 'Employee']
  },
  
  recipients: {
    type: mongoose.Schema.Types.Mixed,
    default: 'ALL',
    index: true // 🟢 Added Index for faster $or queries
  },

  readBy: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    readAt: { type: Date, default: Date.now }
  }],

  replies: [{
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    message: { type: String },
    image: { type: String, default: null }, 
    sentBy: { type: String, enum: ['Employee', 'Admin'], default: 'Employee' },
    repliedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

export default mongoose.model("Notice", noticeSchema);