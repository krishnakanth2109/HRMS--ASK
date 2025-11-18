// --- FIXED routes/noticeRoutes.js ---

import express from "express";
import Notice from "../models/Notice.js";
import Notification from "../models/notificationModel.js";
import Employee from "../models/employeeModel.js";
import { protect } from "../controllers/authController.js";

const router = express.Router();

// ===================================================================
// ✅ ADMIN-ONLY ROUTE TO GET ALL NOTICES
// ===================================================================
router.get("/all", protect, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }
    const allNotices = await Notice.find().sort({ date: -1 });
    res.json(allNotices);
  } catch (error) {
    console.error("GET All Notices Error:", error);
    res.status(500).json({ message: "Failed to fetch all notices" });
  }
});

// ===================================================================
// EMPLOYEE-FACING ROUTE (Filters notices for the logged-in user)
// ===================================================================
router.get("/", protect, async (req, res) => {
  try {
    const employeeId = req.user._id.toString();
    
    const notices = await Notice.find({
      $or: [
        { recipients: 'ALL' },
        { recipients: { $in: [employeeId] } }
      ]
    }).sort({ date: -1 });
    
    console.log(`📋 Employee ${employeeId} fetched ${notices.length} notices`);
    res.json(notices);
  } catch (error) {
    console.error("GET Notices Error:", error);
    res.status(500).json({ message: "Failed to fetch notices" });
  }
});

// ===================================================================
// POST NEW NOTICE (With Targeted Real-Time Emits)
// ===================================================================
router.post("/", protect, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can post notices" });
    }

    const { title, description, recipients } = req.body;

    // ✅ FIXED: Properly handle recipients
    const recipientValue = (recipients && recipients.length > 0) ? recipients : 'ALL';

    const savedNotice = await Notice.create({
      title,
      description,
      date: new Date(),
      createdBy: req.user._id,
      recipients: recipientValue,
    });

    console.log(`📢 Notice created with recipients:`, recipientValue);

    const io = req.app.get("io");
    const userSocketMap = req.app.get("userSocketMap");

    if (recipientValue !== 'ALL' && Array.isArray(recipientValue) && recipientValue.length > 0) {
      // --- Send to SPECIFIC employees ---
      console.log(`🎯 Sending notice to specific employees:`, recipientValue);
      
      const notifications = [];
      for (const empId of recipientValue) {
        const employeeIdStr = empId.toString();
        notifications.push({ 
          userId: employeeIdStr, 
          title: "New Notice Posted", 
          message: title, 
          type: "notice" 
        });
        
        if (userSocketMap) {
          const socketId = userSocketMap.get(employeeIdStr);
          if (socketId) {
            console.log(`✅ Emitting to employee ${employeeIdStr} via socket ${socketId}`);
            io.to(socketId).emit("newNotice", savedNotice);
          } else {
            console.log(`⚠️ Employee ${employeeIdStr} not connected`);
          }
        }
      }
      
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }
    } else {
      // --- Send to ALL employees ---
      console.log(`🌐 Broadcasting notice to ALL employees`);
      
      const allEmployees = await Employee.find({}, "_id");
      const notifications = allEmployees.map(emp => ({ 
        userId: emp._id.toString(), 
        title: "New Notice Posted", 
        message: title, 
        type: "notice" 
      }));
      
      await Notification.insertMany(notifications);
      io.emit("newNotice", savedNotice);
    }

    res.status(201).json({ message: "Notice posted successfully", notice: savedNotice });
  } catch (error) {
    console.error("POST Notice Error:", error); 
    res.status(500).json({ message: "Failed to post notice" });
  }
});

// ===================================================================
// ✅ FIXED UPDATE ROUTE - Now handles recipients
// ===================================================================
router.put("/:id", protect, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  
  try {
    const { title, description, recipients } = req.body;
    
    // ✅ Handle recipients properly
    const updateData = { title, description };
    
    if (recipients !== undefined) {
      updateData.recipients = (recipients && recipients.length > 0) ? recipients : 'ALL';
    }
    
    const updatedNotice = await Notice.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true }
    );
    
    if (!updatedNotice) {
      return res.status(404).json({ message: "Notice not found" });
    }
    
    console.log(`✏️ Notice ${req.params.id} updated with recipients:`, updateData.recipients);
    
    res.json({ message: "Notice updated successfully", notice: updatedNotice });
  } catch (error) {
    console.error("PUT Notice Error:", error);
    res.status(500).json({ message: "Failed to update notice" });
  }
});

// ===================================================================
// DELETE ROUTE
// ===================================================================
router.delete("/:id", protect, async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  
  try {
    const deletedNotice = await Notice.findByIdAndDelete(req.params.id);
    
    if (!deletedNotice) {
      return res.status(404).json({ message: "Notice not found" });
    }
    
    console.log(`🗑️ Notice ${req.params.id} deleted`);
    res.json({ message: "Notice deleted successfully" });
  } catch (error) {
    console.error("DELETE Notice Error:", error);
    res.status(500).json({ message: "Failed to delete notice" });
  }
});

export default router;