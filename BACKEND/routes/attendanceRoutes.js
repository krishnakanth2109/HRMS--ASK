import express from "express";
import {
  punchIn,
  punchOut,
  getAttendanceByEmployee,
} from "../controllers/attendanceController.js";

const router = express.Router();

router.post("/punch-in", punchIn);
router.post("/punch-out", punchOut);
router.get("/:employeeId", getAttendanceByEmployee);

export default router;