import EmployeeAttendance from "../modal/EmployeeAttendance.js";

// ✅ Punch In
export const punchIn = async (req, res) => {
  console.log("Punch In hit");
  try {
    const { employeeId, punchIn } = req.body;

    const today = new Date().toISOString().split("T")[0];

    let attendance = await EmployeeAttendance.findOne({ employeeId, date: today });

    if (attendance) {
      return res.status(400).json({ message: "Already punched in for today" });
    }

    attendance = new EmployeeAttendance({
      employeeId,
      date: today,
      punchIn,
      status: "Working",
    });

    await attendance.save();

    res.json({ message: "Punch In successful", attendance });
  } catch (err) {
    console.error("Punch-in error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Punch Out
export const punchOut = async (req, res) => {
  try {
    const { employeeId, punchOut } = req.body;

    const today = new Date().toISOString().split("T")[0];

    const attendance = await EmployeeAttendance.findOne({ employeeId, date: today });

    if (!attendance) {
      return res.status(400).json({ message: "Punch In not found" });
    }

    attendance.punchOut = punchOut;
    attendance.status = "Completed";

    await attendance.save();

    res.json({ message: "Punch Out successful", attendance });
  } catch (err) {
    console.error("Punch-out error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get attendance
export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const attendance = await EmployeeAttendance.find({ employeeId });

    res.json(attendance);
  } catch (err) {
    console.error("Get attendance error:", err);
    res.status(500).json({ error: err.message });
  }
};