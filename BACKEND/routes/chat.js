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
          console.log(`✅ Real-time message sent to receiver ${receiverId}`);
        }

        // Also emit to sender for confirmation
        if (senderSocketId) {
          io.to(senderSocketId).emit("message_sent", messageData);
        }
      }
    } catch (socketErr) {
      console.error("Socket emission error:", socketErr);
      // Continue even if socket fails - message is still saved
    }
    
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ message: "Error sending message", error: error.message });
  }
});

/* ============================================================================
   💥 GET CHAT USERS (Sidebar Persistence & Unread Counts)
   Finds users and attaches unread message counts + last message info
============================================================================ */
router.get("/users", protect, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user._id);

    // 1. Find distinct users interacted with
    const interactedUsers = await Message.aggregate([
      { 
        $match: { 
          $or: [{ sender: currentUserId }, { receiver: currentUserId }] 
        } 
      },
      {
        $project: {
          otherPartyId: {
            $cond: { if: { $eq: ["$sender", currentUserId] }, then: "$receiver", else: "$sender" }
          }
        }
      },
      {
        $group: { _id: "$otherPartyId" } 
      }
    ]);

    const userIds = interactedUsers.map(u => u._id);

    // 2. Fetch User Details
    const users = await Employee.find({ _id: { $in: userIds } })
      .select("name employeeId role");

    // 3. Attach Unread Count and Last Message for each user
    const usersWithCounts = await Promise.all(users.map(async (user) => {
      // Count unread messages
      const count = await Message.countDocuments({
        sender: user._id,
        receiver: currentUserId,
        isRead: false
      });

      // Get last message
      const lastMessage = await Message.findOne({
        $or: [
          { sender: currentUserId, receiver: user._id },
          { sender: user._id, receiver: currentUserId }
        ]
      })
      .sort({ createdAt: -1 })
      .select("message createdAt");

      return {
        ...user.toObject(),
        unreadCount: count,
        lastMessage: lastMessage?.message || "",
        lastMessageTime: lastMessage?.createdAt || null,
      };
    }));

    // Sort: Users with most recent messages first
    usersWithCounts.sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

    res.json(usersWithCounts);
  } catch (error) {
    console.error("Error fetching chat users:", error);
    res.status(500).json({ message: "Error fetching chat users" });
  }
});

/* ============================================================================
   ✅ MARK MESSAGES AS READ - WITH SOCKET.IO
   Marks all messages from a specific sender to me as read
============================================================================ */
router.put("/read/:senderId", protect, async (req, res) => {
  try {
    const senderId = req.params.senderId;
    const receiverId = req.user._id;

    await Message.updateMany(
      { sender: senderId, receiver: receiverId, isRead: false },
      { $set: { isRead: true } }
    );

    // Emit socket event to sender for read receipt
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
          console.log(`✅ Read receipt sent to ${senderId}`);
        }
      }
    } catch (socketErr) {
      console.error("Socket emission error:", socketErr);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking messages read:", error);
    res.status(500).json({ message: "Failed to mark as read" });
  }
});

/* ============================================================================
   📜 GET CHAT HISTORY
============================================================================ */
router.get("/history/:otherUserId", protect, async (req, res) => {
  try {
    const myId = req.user._id;
    const otherId = req.params.otherUserId;

    if (!otherId || otherId === 'undefined') {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const messages = await Message.find({
      $or: [
        { sender: myId, receiver: otherId },
        { sender: otherId, receiver: myId },
      ],
    })
    .sort({ createdAt: 1 })
    .populate("sender", "name employeeId")
    .populate("receiver", "name employeeId");

    res.json(messages);
  } catch (error) {
    console.error("Error fetching history:", error);
    res.status(500).json({ message: "Failed to fetch history" });
  }
});

/* ============================================================================
   ✏️ EDIT MESSAGE - WITH SOCKET.IO
============================================================================ */
router.put("/:id", protect, async (req, res) => {
  try {
    const { message } = req.body;
    const msgId = req.params.id;
    const userId = req.user._id;

    const originalMsg = await Message.findById(msgId);
    
    if (!originalMsg) {
      return res.status(404).json({ message: "Message not found" });
    }
    
    if (originalMsg.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    originalMsg.message = message;
    await originalMsg.save();

    // Emit socket event to receiver
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

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("message_edited", editData);
          console.log(`✅ Edit notification sent to receiver`);
        }

        // Also notify sender
        if (senderSocketId) {
          io.to(senderSocketId).emit("message_edit_confirmed", editData);
        }
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
   🗑️ DELETE MESSAGE - WITH SOCKET.IO
============================================================================ */
router.delete("/:id", protect, async (req, res) => {
  try {
    const msgId = req.params.id;
    const userId = req.user._id;

    const originalMsg = await Message.findById(msgId);
    
    if (!originalMsg) {
      return res.status(404).json({ message: "Message not found" });
    }

    if (originalMsg.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const receiverId = originalMsg.receiver.toString();
    await Message.findByIdAndDelete(msgId);

    // Emit socket event to receiver
    try {
      const io = req.app.get("io");
      const userSocketMap = req.app.get("userSocketMap");
      
      if (io && userSocketMap) {
        const receiverSocketId = userSocketMap.get(receiverId);
        const senderSocketId = userSocketMap.get(userId.toString());

        const deleteData = {
          messageId: msgId,
          receiverId,
          senderId: userId.toString(),
        };

        if (receiverSocketId) {
          io.to(receiverSocketId).emit("message_deleted", deleteData);
          console.log(`✅ Delete notification sent to receiver`);
        }

        // Also notify sender
        if (senderSocketId) {
          io.to(senderSocketId).emit("message_delete_confirmed", deleteData);
        }
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
    
    if (userSocketMap) {
      const onlineUserIds = Array.from(userSocketMap.keys());
      res.json({ onlineUsers: onlineUserIds });
    } else {
      res.json({ onlineUsers: [] });
    }
  } catch (error) {
    console.error("Error fetching online users:", error);
    res.status(500).json({ message: "Failed to fetch online users" });
  }
});

export default router;