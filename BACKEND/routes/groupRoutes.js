import express from "express";
import {
  createGroup,
  getAllGroups,
  getSingleGroup,
  updateGroup,
  assignGroupLeader,
  addMember,
  removeMember,
  deleteGroup,
  getMyTeams,
  getTeamAttendanceToday
} from "../controllers/groupController.js";

import { protect, restrictTo } from "../middleware/authMiddleware.js";

const router = express.Router();

/* =====================================================
   EMPLOYEE ROUTES (⚠️ MUST BE FIRST)
===================================================== */
router.get(
  "/my-teams",
  protect,
  restrictTo("employee"),
  getMyTeams
);

/* =====================================================
   ADMIN ROUTES
===================================================== */
router.post("/", protect, restrictTo("admin"), createGroup);
router.get("/", protect, restrictTo("admin"), getAllGroups);
router.get("/:id", protect, restrictTo("admin"), getSingleGroup);
router.put("/:id", protect, restrictTo("admin"), updateGroup);
router.put("/:id/leader", protect, restrictTo("admin"), assignGroupLeader);
router.post("/:id/member", protect, restrictTo("admin"), addMember);
router.delete("/:id/member", protect, restrictTo("admin"), removeMember);
router.delete("/:id", protect, restrictTo("admin"), deleteGroup);
// Employee-side team attendance
router.get(
  "/team-attendance-today",
  protect,
  restrictTo("employee"),
  getTeamAttendanceToday
);

export default router;
