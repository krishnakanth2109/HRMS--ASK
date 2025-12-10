import express from "express";
import Notice from "../models/Notice.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ============================================================================
   📌 ADMIN → GET ALL NOTICES
============================================================================ */
router.get("/all", protect, onlyAdmin, async (req, res) => {
  try {
    const allNotices = await Notice.find()
      .populate("readBy.employeeId", "name employeeId") 
      .populate("replies.employeeId", "name") 
      .populate("replies.adminId", "name")
      .sort({ date: -1 });
    res.json(allNotices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notices" });
  }
});

/* ============================================================================
   👤 EMPLOYEE → GET Notices (PRIVACY FILTER ADDED)
============================================================================ */
router.get("/", protect, async (req, res) => {
  try {
    const employeeId = req.user._id.toString();
    
    let notices = await Notice.find({
      $or: [
        { recipients: "ALL" },
        { recipients: { $in: [employeeId] } }
      ]
    })
    .populate("replies.employeeId", "name") 
    .populate("replies.adminId", "name")
    .sort({ date: -1 });

    // 🔒 PRIVACY FILTER: Only show replies belonging to this employee
    notices = notices.map(notice => {
      const noticeObj = notice.toObject();
      if (noticeObj.replies) {
        noticeObj.replies = noticeObj.replies.filter(r => 
          r.employeeId && r.employeeId._id.toString() === employeeId
        );
      }
      return noticeObj;
    });

    res.json(notices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notices" });
  }
});

/* ============================================================================
   ✅ MARK AS READ
============================================================================ */
router.put("/:id/read", protect, async (req, res) => {
  try {
    const noticeId = req.params.id;
    const employeeId = req.user._id;
    const notice = await Notice.findById(noticeId);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    if (!notice.readBy) notice.readBy = [];
    const isAlreadyRead = notice.readBy.some(r => r.employeeId.toString() === employeeId.toString());
    
    if (!isAlreadyRead) {
      notice.readBy.push({ employeeId, readAt: new Date() });
      await notice.save();
    }
    res.json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

/* ============================================================================
   💬 EMPLOYEE → REPLY (To Admin)
============================================================================ */
router.post("/:id/reply", protect, async (req, res) => {
  try {
    const { message } = req.body;
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    if (!notice.replies) notice.replies = [];

    const newReply = {
      employeeId: req.user._id, // This marks the chat owner
      message,
      sentBy: 'Employee',
      repliedAt: new Date()
    };

    notice.replies.push(newReply);
    await notice.save();

    // Return populated reply
    const updated = await Notice.findById(req.params.id).populate("replies.employeeId", "name");
    const addedReply = updated.replies[updated.replies.length - 1];

    res.status(201).json({ message: "Reply sent", reply: addedReply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to reply" });
  }
});

/* ============================================================================
   💬 ADMIN → REPLY (To Specific Employee)
============================================================================ */
router.post("/:id/admin-reply", protect, onlyAdmin, async (req, res) => {
  try {
    const { message, targetEmployeeId } = req.body; // Admin MUST send targetEmployeeId

    if (!targetEmployeeId) return res.status(400).json({ message: "Target employee required" });

    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    if (!notice.replies) notice.replies = [];

    const newReply = {
      adminId: req.user._id,
      employeeId: targetEmployeeId, // Links this reply to that specific employee's chat
      message,
      sentBy: 'Admin',
      repliedAt: new Date()
    };

    notice.replies.push(newReply);
    await notice.save();

    const updated = await Notice.findById(req.params.id).populate("replies.adminId", "name");
    const addedReply = updated.replies[updated.replies.length - 1];

    res.status(201).json({ message: "Reply sent", reply: addedReply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to reply" });
  }
});

/* ============================================================================
   🗑 DELETE REPLY
============================================================================ */
router.delete("/:id/reply/:replyId", protect, async (req, res) => {
  try {
    const { id, replyId } = req.params;
    const userId = req.user._id.toString();
    const isAdmin = req.user.role === "admin" || req.user.isAdmin === true;

    const notice = await Notice.findById(id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    const reply = notice.replies.id(replyId);
    if (!reply) return res.status(404).json({ message: "Reply not found" });

    const isOwner = (reply.employeeId?.toString() === userId) || (reply.adminId?.toString() === userId);

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    notice.replies.pull(replyId);
    await notice.save();
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete" });
  }
});

// ... (Create/Update/Delete Notice routes remain standard) ...
router.post("/", protect, onlyAdmin, async (req, res) => {
    try {
      const { title, description, recipients } = req.body;
      const recipientValue = recipients && recipients.length > 0 ? recipients : "ALL";
      const savedNotice = await Notice.create({ title, description, date: new Date(), createdBy: req.user._id, recipients: recipientValue });
      res.status(201).json({ message: "Posted", notice: savedNotice });
    } catch (e) { res.status(500).json({ message: "Error" }); }
});
router.put("/:id", protect, onlyAdmin, async (req, res) => {
    try { const updated = await Notice.findByIdAndUpdate(req.params.id, req.body, { new: true }); res.json({ message: "Updated", notice: updated }); } catch(e) { res.status(500).json({ message: "Error" }); }
});
router.delete("/:id", protect, onlyAdmin, async (req, res) => {
    try { await Notice.findByIdAndDelete(req.params.id); res.json({ message: "Deleted" }); } catch(e) { res.status(500).json({ message: "Error" }); }
});

export default router;