import express from "express";
import mongoose from "mongoose";
import Message from "../models/Message.js";
import Employee from "../models/Employee.js"; 
import { protect } from "../controllers/authController.js";

const router = express.Router();

/* ============================================================================
   📨 SEND MESSAGE (Create) - WITH SOCKET.IO
============================================================================ */
router.post("/send", protect, async (req, res) => {
  try {
    const { receiverId, message } = req.body;
    const senderId = req.user._id;

    if (!message || !receiverId) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const newMessage = await Message.create({
      sender: senderId,
      receiver: receiverId,
      message,
    });
    
    // Populate sender details for immediate frontend display
    await newMessage.populate("sender", "name employeeId");
    
    // Get Socket.IO instance and emit to receiver
    try {
      const io = req.app.get("io");
      const userSocketMap = req.app.get("userSocketMap");
      
      if (io && userSocketMap) {
        const receiverSocketId = userSocketMap.get(receiverId.toString());
        const senderSocketId = userSocketMap.get(senderId.toString());

        const messageData = {
          ...newMessage.toObject(),
          receiverId: receiverId.toString(),
        };

        // Send to receiver if online
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("receive_message", messageData);
        }

        // Also emit to sender for confirmation (helps with multi-device sync)
        if (senderSocketId) {
          io.to(senderSocketId).emit("message_sent", messageData);
        }
      }
    } catch (socketErr) {
      console.error("Socket emission error:", socketErr);
    }
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Error sending message", error: error.message });
  }
});

/* ============================================================================
   💥 GET CHAT USERS (OPTIMIZED AGGREGATION)
   Previously: N+1 Query problem (Slow).
   Now: Aggregation Pipeline (Fast).
============================================================================ */
router.get("/users", protect, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Aggregation to find recent conversations and unread counts
    const aggregation = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: currentUserId }, { receiver: currentUserId }]
        }
      },
      {
        $sort: { createdAt: -1 } // Sort by newest first
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", currentUserId] },
              "$receiver",
              "$sender"
            ]
          },
          lastMessage: { $first: "$message" },
          lastMessageTime: { $first: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiver", currentUserId] }, { $eq: ["$isRead", false] }] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // 2. Fetch User Details for the IDs found in messages
    const chattedUserIds = aggregation.map(a => a._id);
    
    // Also fetch ALL employees (to allow starting new chats), optimizing selection
    const allEmployees = await Employee.find({ 
        _id: { $ne: currentUserId },
        isActive: { $ne: false } // Only active employees
    }).select("name employeeId role");

    // 3. Merge Aggregation Data with Employee Data
    const result = allEmployees.map(emp => {
      // Check if we have chat history with this employee
      const chatData = aggregation.find(a => a._id.toString() === emp._id.toString());

      return {
        _id: emp._id,
        name: emp.name,
        employeeId: emp.employeeId,
        role: emp.role,
        lastMessage: chatData ? chatData.lastMessage : "",
        lastMessageTime: chatData ? chatData.lastMessageTime : null,
        unreadCount: chatData ? chatData.unreadCount : 0,
      };
    });

    // 4. Sort: Users with recent messages at the top
    result.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching chat users:", error);
    res.status(500).json({ message: "Error fetching chat users" });
  }
});

/* ============================================================================
   ✅ MARK MESSAGES AS READ
============================================================================ */
router.put("/read/:senderId", protect, async (req, res) => {
  try {
    const senderId = req.params.senderId;
    const receiverId = req.user._id;

    // Use updateMany for batch update
    const result = await Message.updateMany(
      { sender: senderId, receiver: receiverId, isRead: false },
      { $set: { isRead: true } }
    );

    if (result.modifiedCount > 0) {
      // Emit socket event only if changes were made
      try {
        const io = req.app.get("io");
        const userSocketMap = req.app.get("userSocketMap");
        
        if (io && userSocketMap) {
          const senderSocketId = userSocketMap.get(senderId.toString());
          if (senderSocketId) {
            io.to(senderSocketId).emit("messages_read", {
              readBy: receiverId.toString(),
              senderId: senderId.toString()
            });
          }
        }
      } catch (socketErr) {
        console.error("Socket emission error:", socketErr);
      }
    }

    res.json({ success: true, count: result.modifiedCount });
  } catch (error) {
    console.error("Error marking messages read:", error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

/* ============================================================================
   📜 GET CHAT HISTORY (With Pagination Limit)
============================================================================ */
router.get("/history/:otherUserId", protect, async (req, res) => {
  try {
    const myId = req.user._id;
    const otherId = req.params.otherUserId;

    if (!otherId || otherId === 'undefined') {
      return res.status(400).json({ message: "Invalid ID" });
    }

    // Use .lean() for faster query execution (returns plain JS objects, not Mongoose docs)
    // Limit to last 300 messages to prevent loading huge history at once
    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: otherId },
        { sender: otherId, receiver: myId },
      ],
    })
    .sort({ createdAt: 1 }) 
    // .limit(300) // Uncomment this if chats are extremely long
    .populate("sender", "name employeeId")
    .populate("receiver", "name employeeId")
    .lean();

    res.json(messages);
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

/* ============================================================================
   ✏️ EDIT MESSAGE
============================================================================ */
router.put("/:id", protect, async (req, res) => {
  try {
    const { message } = req.body;
    const msgId = req.params.id;
    const userId = req.user._id;

    const originalMsg = await Message.findById(msgId);
    
    if (!originalMsg) return res.status(404).json({ message: "Message not found" });
    if (originalMsg.sender.toString() !== userId.toString()) return res.status(403).json({ message: "Unauthorized" });

    originalMsg.message = message;
    await originalMsg.save();

    try {
      const io = req.app.get("io");
      const userSocketMap = req.app.get("userSocketMap");
      
      if (io && userSocketMap) {
        const receiverSocketId = userSocketMap.get(originalMsg.receiver.toString());
        const senderSocketId = userSocketMap.get(userId.toString());

        const editData = {
          messageId: msgId,
          newMessage: message,
          receiverId: originalMsg.receiver.toString(),
          senderId: userId.toString(),
        };

        if (receiverSocketId) io.to(receiverSocketId).emit("message_edited", editData);
        if (senderSocketId) io.to(senderSocketId).emit("message_edit_confirmed", editData);
      }
    } catch (socketErr) {
      console.error("Socket emission error:", socketErr);
    }

    res.json({ message: "Updated successfully", updatedMessage: originalMsg });
  } catch (error) {
    console.error("Error updating message:", error);
    res.status(500).json({ message: "Error updating message" });
  }
});

/* ============================================================================
   🗑️ DELETE MESSAGE
============================================================================ */
router.delete("/:id", protect, async (req, res) => {
  try {
    const msgId = req.params.id;
    const userId = req.user._id;

    const originalMsg = await Message.findById(msgId);
    
    if (!originalMsg) return res.status(404).json({ message: "Message not found" });
    if (originalMsg.sender.toString() !== userId.toString()) return res.status(403).json({ message: "Unauthorized" });

    const receiverId = originalMsg.receiver.toString();
    await Message.findByIdAndDelete(msgId);

    try {
      const io = req.app.get("io");
      const userSocketMap = req.app.get("userSocketMap");
      
      if (io && userSocketMap) {
        const receiverSocketId = userSocketMap.get(receiverId);
        const senderSocketId = userSocketMap.get(userId.toString());

        const deleteData = { messageId: msgId, receiverId, senderId: userId.toString() };

        if (receiverSocketId) io.to(receiverSocketId).emit("message_deleted", deleteData);
        if (senderSocketId) io.to(senderSocketId).emit("message_delete_confirmed", deleteData);
      }
    } catch (socketErr) {
      console.error("Socket emission error:", socketErr);
    }

    res.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ message: "Error deleting message" });
  }
});

/* ============================================================================
   🔌 GET ONLINE USERS
============================================================================ */
router.get("/online-users", protect, async (req, res) => {
  try {
    const userSocketMap = req.app.get("userSocketMap");
    const onlineUsers = userSocketMap ? Array.from(userSocketMap.keys()) : [];
    res.json({ onlineUsers });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch online users" });
  }
});

export default router;