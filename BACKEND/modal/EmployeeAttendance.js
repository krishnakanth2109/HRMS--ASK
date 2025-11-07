import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  employeeId: String,
  date: String,
  punchIn: String,
  punchOut: String,
  status: String,
});

export default mongoose.model("EmployeeAttendance", attendanceSchema);