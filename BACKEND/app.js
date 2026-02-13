import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import http from "http";
import { Server } from "socket.io";

// -------------------- ROUTES --------------------
import employeeRoutes from "./routes/employeeRoutes.js";
import holidayRoutes from "./routes/holidayRoutes.js";
import noticeRoutes from "./routes/noticeRoutes.js";
import overtimeRoutes from "./routes/overtimeRoutes.js";
import leaveRoutes from "./routes/leaveRoutes.js";
import EmployeeattendanceRoutes from "./routes/EmployeeattendanceRoutes.js";
import AdminAttendanceRoutes from "./routes/AdminAttendanceRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import profilePicRoutes from "./routes/ProfilePicRoute.js";
import idleTimeRoutes from "./routes/idleTimeRoutes.js";
import shiftRoutes from "./routes/shiftRoutes.js";
import categoryAssignmentRoutes from "./routes/categoryAssignmentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import requestWorkModeRoutes from "./routes/requestWorkModeRoutes.js";
import punchOutRoutes from "./routes/punchOutRequestRoutes.js";
import groupRoutes from "./routes/groupRoutes.js";
import meetingRoutes from "./routes/meetingRoutes.js";
import rulesRoutes from "./routes/rules.js";
import chatRoutes from "./routes/chat.js";
import companyRoutes from "./routes/companyRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import payrollRoutes from "./routes/payroll.js";
import mailRoutes from "./routes/mailRoutes.js";
import invitedEmployeeRoutes from "./routes/invitedEmployeeRoutes.js";
import payrollcandidatesRoutes from "./routes/payrollcandidatesRoutes.js";


// -------------------- APP SETUP --------------------
const app = express();
const server = http.createServer(app);

// -------------------- CORS ORIGINS --------------------
const allowedOrigins = [
  "https://hrms-420.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://hrms-ask.onrender.com",
  "http://localhost:5000",
  "https://hrms-ask-1.onrender.com",
  "https://hrms-ask.vercel.app",
  "https://hrms-ask-1jx6.onrender.com"
  "http://hrms.vagarioussolutions.com"
];

// -------------------- SOCKET.IO FOR REAL-TIME CHAT --------------------
const userSocketMap = new Map(); // userId -> socketId mapping

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Optimization: Allow WebSocket transport explicitly for faster connections
  transports: ['websocket', 'polling'], 
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Make io and userSocketMap available to routes (Critical for api/chat routes)
app.set("io", io);
app.set("userSocketMap", userSocketMap);

// Socket.IO Connection Handler
io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // Handle user authentication and registration
  socket.on("authenticate", (userId) => {
    if (userId) {
      userSocketMap.set(userId.toString(), socket.id);
      socket.userId = userId.toString();
      console.log(`🔐 User ${userId} authenticated with socket ${socket.id}`);
      
      // Notify user they're connected
      socket.emit("authenticated", { userId, socketId: socket.id });
      
      // Broadcast online status to all users
      io.emit("user_online", { userId: userId.toString() });
    }
  });

  // Legacy support for 'register' event
  socket.on("register", (userId) => {
    if (userId) {
      userSocketMap.set(userId.toString(), socket.id);
      socket.userId = userId.toString();
      console.log(`🔐 User ${userId} registered with socket ${socket.id}`);
      io.emit("user_online", { userId: userId.toString() });
    }
  });

  // Handle sending messages (Socket-only approach)
  // Note: The new chat.js route also handles emission via API
  socket.on("send_message", (messageData) => {
    const { receiverId, message, sender } = messageData;
    const receiverSocketId = userSocketMap.get(receiverId?.toString());

    console.log(`📨 Message from ${sender?._id || sender} to ${receiverId}`);

    // Send to receiver if they're online
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receive_message", messageData);
      console.log(`✅ Message delivered to ${receiverId}`);
    } else {
      console.log(`⚠️ Receiver ${receiverId} is offline`);
    }

    // Send confirmation back to sender
    socket.emit("message_sent", messageData);
  });

  // Handle message read status
  socket.on("mark_as_read", ({ senderId, receiverId }) => {
    const senderSocketId = userSocketMap.get(senderId?.toString());
    
    if (senderSocketId) {
      io.to(senderSocketId).emit("messages_read", { 
        readBy: receiverId?.toString(),
        senderId: senderId?.toString()
      });
      console.log(`✅ Read receipt sent to ${senderId}`);
    }
  });

  // Handle typing indicator
  socket.on("typing_start", ({ receiverId, senderId, senderName }) => {
    const receiverSocketId = userSocketMap.get(receiverId?.toString());
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user_typing", { 
        userId: senderId?.toString(),
        userName: senderName 
      });
    }
  });

  socket.on("typing_stop", ({ receiverId, senderId }) => {
    const receiverSocketId = userSocketMap.get(receiverId?.toString());
    
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("user_stopped_typing", { 
        userId: senderId?.toString()
      });
    }
  });

  // Handle message edit
  socket.on("edit_message", (editData) => {
    const { receiverId, messageId, newMessage, senderId } = editData;
    const receiverSocketId = userSocketMap.get(receiverId?.toString());

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("message_edited", editData);
      console.log(`✅ Edit notification sent to ${receiverId}`);
    }

    // Send confirmation back to sender
    socket.emit("message_edit_confirmed", editData);
  });

  // Handle message delete
  socket.on("delete_message", (deleteData) => {
    const { receiverId, messageId } = deleteData;
    const receiverSocketId = userSocketMap.get(receiverId?.toString());

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("message_deleted", deleteData);
      console.log(`✅ Delete notification sent to ${receiverId}`);
    }

    // Send confirmation back to sender
    socket.emit("message_delete_confirmed", deleteData);
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
    
    if (socket.userId) {
      userSocketMap.delete(socket.userId);
      
      // Broadcast offline status
      io.emit("user_offline", { userId: socket.userId });
      console.log(`👋 User ${socket.userId} went offline`);
    } else {
      // Fallback: remove by socket.id
      for (let [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          io.emit("user_offline", { userId });
          console.log(`👋 User ${userId} went offline`);
          break;
        }
      }
    }
  });
});

// -------------------- MIDDLEWARE --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("CORS not allowed"), false);
    },
    credentials: true,
  })
);

app.options("*", cors());

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// -------------------- DATABASE --------------------
mongoose
  .connect(process.env.MONGO_URI, { 
    serverSelectionTimeoutMS: 10000,
    // Optimization: Connection Pooling for Production
    maxPoolSize: 10, 
    minPoolSize: 2
  })
  .then(async () => {
    console.log("✅ MongoDB Connected");

    try {
      const db = mongoose.connection.db;
      const collection = db.collection("companies");

      const indexes = await collection.listIndexes().toArray();
      const indexNames = indexes.map((i) => i.name);

      for (const name of ["ownerEmail_1", "companyId_1"]) {
        if (indexNames.includes(name)) {
          await collection.dropIndex(name);
          console.log(`✅ Dropped index ${name}`);
        }
      }
    } catch (err) {
      console.log("ℹ️ Index cleanup:", err.message);
    }
  })
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

// -------------------- HEALTH --------------------
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

// -------------------- ROUTES --------------------
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/attendance", EmployeeattendanceRoutes);
app.use("/api/admin/attendance", AdminAttendanceRoutes);
app.use("/api/profile", profilePicRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/idletime", idleTimeRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/category-assign", categoryAssignmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/work-mode", requestWorkModeRoutes);
app.use("/api/punchoutreq", punchOutRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/meetings", meetingRoutes);
app.use("/api/rules", rulesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/mail", mailRoutes);
app.use("/api/invited-employees", invitedEmployeeRoutes);
app.use('/api/payroll', payrollcandidatesRoutes);

// -------------------- 404 --------------------
app.use("*", (req, res) => {
  res.status(404).json({ success: false, message: "API route not found" });
});

// -------------------- ERROR HANDLER --------------------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: err.message });
});

// -------------------- SERVER START --------------------
const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO server initialized for real-time chat`);
});
