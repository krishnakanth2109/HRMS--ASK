// --- START OF FILE routes/EmployeeattendanceRoutes.js ---

import express from "express";
import { protect } from "../controllers/authController.js";
import { 
    getAttendanceByEmployee, 
    punchIn, 
    punchOut 
} from "../controllers/attendanceController.js";

const router = express.Router();

// ✅ VITAL: Apply the 'protect' middleware to ALL routes in this file.
router.use(protect);

// POST /api/attendance/punch-in
router.post("/punch-in", punchIn);

// POST /api/attendance/punch-out
router.post("/punch-out", punchOut);

// GET /api/attendance/:employeeId
// The controller will securely ignore ':employeeId' and use the authenticated user's ID.
// This path is kept for compatibility with your existing frontend api.js file.
router.get("/:employeeId", getAttendanceByEmployee);

export default router;