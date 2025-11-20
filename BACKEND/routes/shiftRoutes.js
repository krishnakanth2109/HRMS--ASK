import express from 'express';
import Shift from '../models/shiftModel.js';
import Employee from '../models/employeeModel.js';

const router = express.Router();

// @route   POST /api/shifts/create
router.post('/create', async (req, res) => {
  try {
    const {
      employeeId,
      shiftStartTime,
      shiftEndTime,
      lateGracePeriod,
      fullDayHours,
      halfDayHours,
      autoExtendShift,
      weeklyOffDays
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({ success: false, message: 'Employee ID is required' });
    }

    const cleanEmployeeId = employeeId.trim();
    const employee = await Employee.findOne({ employeeId: cleanEmployeeId });
    
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const latestExp = employee.experienceDetails?.length
      ? employee.experienceDetails[employee.experienceDetails.length - 1]
      : null;

    const department = latestExp?.department || employee.department || 'N/A';
    const role = latestExp?.role || employee.role || 'N/A';

    let shift = await Shift.findOne({ employeeId: cleanEmployeeId });
    const currentUserEmail = req.user?.email || 'Admin';

    const shiftData = {
      shiftStartTime: shiftStartTime || "09:00",
      shiftEndTime: shiftEndTime || "18:00",
      lateGracePeriod: Number(lateGracePeriod) || 15,
      fullDayHours: Number(fullDayHours) || 8,
      halfDayHours: Number(halfDayHours) || 4,
      autoExtendShift: autoExtendShift !== undefined ? autoExtendShift : true,
      weeklyOffDays: weeklyOffDays || [0],
      department,
      role,
      employeeName: employee.name,
      updatedBy: currentUserEmail,
      isActive: true
    };

    if (shift) {
      Object.assign(shift, shiftData);
      await shift.save();
    } else {
      shift = await Shift.create({
        employeeId: cleanEmployeeId,
        email: employee.email,
        createdBy: currentUserEmail,
        ...shiftData
      });
    }

    return res.status(200).json({ success: true, message: 'Shift saved successfully', data: shift });

  } catch (error) {
    console.error('Shift save error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/shifts/all
router.get('/all', async (req, res) => {
  try {
    const shifts = await Shift.find({ isActive: true }).sort({ employeeName: 1 });
    return res.status(200).json({ success: true, count: shifts.length, data: shifts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   GET /api/shifts/:employeeId
router.get('/:employeeId', async (req, res) => {
  try {
    const shift = await Shift.findOne({ employeeId: req.params.employeeId, isActive: true });
    if (!shift) {
      // Default if not found
      return res.status(200).json({
        success: true,
        data: {
          employeeId: req.params.employeeId,
          shiftStartTime: "09:00",
          shiftEndTime: "18:00",
          lateGracePeriod: 15,
          fullDayHours: 8,
          halfDayHours: 4,
          autoExtendShift: true,
          weeklyOffDays: [0],
          isDefault: true
        }
      });
    }
    return res.status(200).json({ success: true, data: shift });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   DELETE /api/shifts/:employeeId
router.delete('/:employeeId', async (req, res) => {
  try {
    await Shift.findOneAndDelete({ employeeId: req.params.employeeId });
    return res.status(200).json({ success: true, message: 'Shift reset to default' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/shifts/bulk-create
router.post('/bulk-create', async (req, res) => {
  try {
    const { employeeIds, shiftData } = req.body;
    const currentUserEmail = req.user?.email || 'Admin';

    if (!employeeIds || !Array.isArray(employeeIds)) {
      return res.status(400).json({ success: false, message: 'Invalid Employee IDs' });
    }

    const cleanShiftData = {
      ...shiftData,
      lateGracePeriod: Number(shiftData.lateGracePeriod),
      fullDayHours: Number(shiftData.fullDayHours),
      halfDayHours: Number(shiftData.halfDayHours),
    };

    for (const empId of employeeIds) {
      const cleanId = empId.trim();
      const employee = await Employee.findOne({ employeeId: cleanId });
      if (!employee) continue;

      let shift = await Shift.findOne({ employeeId: cleanId });
      if (shift) {
        Object.assign(shift, { ...cleanShiftData, updatedBy: currentUserEmail, isActive: true });
        await shift.save();
      } else {
        await Shift.create({
          employeeId: cleanId,
          employeeName: employee.name,
          email: employee.email,
          createdBy: currentUserEmail,
          updatedBy: currentUserEmail,
          ...cleanShiftData
        });
      }
    }
    return res.status(200).json({ success: true, message: 'Bulk update successful' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;