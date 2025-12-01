import express from "express";
import OfficeSettings from "../models/OfficeSettings.js";
import Employee from "../models/Employee.js";

const router = express.Router();

// =========================================================================
// 1. GLOBAL OFFICE SETTINGS ROUTES
// =========================================================================

router.get("/settings/office", async (req, res) => {
  try {
    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) {
      settings = await OfficeSettings.create({
        type: "Global",
        officeLocation: { latitude: 0, longitude: 0 },
        allowedRadius: 200,
        globalWorkMode: "WFO",
        employeeWorkModes: [],
        categories: []
      });
    }
    res.status(200).json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.put("/settings/office", async (req, res) => {
  try {
    const { officeLocation, allowedRadius, globalWorkMode } = req.body;
    const settings = await OfficeSettings.findOneAndUpdate(
      { type: "Global" },
      { $set: { officeLocation, allowedRadius, globalWorkMode } },
      { new: true, upsert: true }
    );
    res.status(200).json({ message: "Office settings updated successfully", data: settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 2. EMPLOYEE WORK MODE ROUTES (UPDATED)
// =========================================================================

// -------------------------------------------------------------------------
// PUT: Update Single Employee Work Mode (Advanced Schedules)
// -------------------------------------------------------------------------
router.put("/settings/employee-mode", async (req, res) => {
  try {
    const { 
      employeeId, 
      ruleType,       // "Global", "Permanent", "Temporary", "Recurring"
      mode,           // The mode (WFO/WFH)
      fromDate,       // For Temporary
      toDate,         // For Temporary
      days            // For Recurring ([1,2,3])
    } = req.body;
    
    if (!employeeId || !ruleType) {
      return res.status(400).json({ message: "Employee ID and Rule Type are required" });
    }

    const employee = await Employee.findOne({ employeeId });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) settings = new OfficeSettings({ type: "Global" });

    // Construct the new config object
    const newConfig = {
      employeeId: employee.employeeId,
      employeeName: employee.name,
      ruleType: ruleType,
      updatedAt: new Date()
    };

    // Populate fields based on Rule Type
    if (ruleType === "Permanent") {
      newConfig.permanentMode = mode;
    } else if (ruleType === "Temporary") {
      newConfig.temporary = { mode, fromDate, toDate };
    } else if (ruleType === "Recurring") {
      newConfig.recurring = { mode, days };
    }
    // If Global, we basically just save the ruleType as Global and clear others.

    // Find and Replace or Push
    const existingIndex = settings.employeeWorkModes.findIndex(e => e.employeeId === employeeId);
    if (existingIndex !== -1) {
      settings.employeeWorkModes[existingIndex] = newConfig;
    } else {
      settings.employeeWorkModes.push(newConfig);
    }

    await settings.save();
    res.status(200).json({ message: `Schedule updated for ${employee.name}` });
  } catch (error) {
    console.error("Error updating employee mode:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// -------------------------------------------------------------------------
// POST: Bulk Update (Simple Permanent Override)
// -------------------------------------------------------------------------
router.post("/settings/employee-mode/bulk", async (req, res) => {
  try {
    const { employeeIds, mode } = req.body; 

    if (!employeeIds || !Array.isArray(employeeIds) || !mode) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) settings = new OfficeSettings({ type: "Global" });

    const employees = await Employee.find({ employeeId: { $in: employeeIds } });

    employees.forEach(emp => {
      const idx = settings.employeeWorkModes.findIndex(e => e.employeeId === emp.employeeId);
      const config = {
        employeeId: emp.employeeId,
        employeeName: emp.name,
        updatedAt: new Date(),
        // Bulk update sets Permanent or resets to Global
        ruleType: mode === 'Global' ? 'Global' : 'Permanent',
        permanentMode: mode === 'Global' ? undefined : mode
      };

      if (idx !== -1) settings.employeeWorkModes[idx] = config;
      else settings.employeeWorkModes.push(config);
    });

    await settings.save();
    res.status(200).json({ message: "Bulk update successful" });
  } catch (error) {
    console.error("Error in bulk update:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// -------------------------------------------------------------------------
// POST: Reset All
// -------------------------------------------------------------------------
router.post("/settings/employee-mode/reset", async (req, res) => {
  try {
    await OfficeSettings.findOneAndUpdate(
      { type: "Global" },
      { $set: { employeeWorkModes: [] } }
    );
    res.status(200).json({ message: "All employees reset to Global Configuration" });
  } catch (error) {
    console.error("Error resetting modes:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 3. CATEGORY ROUTES
// =========================================================================
router.post("/settings/categories", async (req, res) => {
  try {
    const { name, employeeIds } = req.body;
    if (!name) return res.status(400).json({ message: "Category name required" });

    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) settings = new OfficeSettings({ type: "Global" });

    settings.categories = settings.categories.filter(c => c.name !== name);
    if (employeeIds && employeeIds.length > 0) {
      settings.categories.forEach(cat => {
        cat.employeeIds = cat.employeeIds.filter(id => !employeeIds.includes(id));
      });
    }
    settings.categories.push({ name, employeeIds: employeeIds || [] });

    await settings.save();
    res.status(200).json({ message: "Category saved", categories: settings.categories });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.delete("/settings/categories/:name", async (req, res) => {
  try {
    const { name } = req.params;
    let settings = await OfficeSettings.findOne({ type: "Global" });
    if (!settings) return res.status(404).json({ message: "Settings not found" });

    settings.categories = settings.categories.filter(c => c.name !== name);
    await settings.save();
    res.status(200).json({ message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

router.put("/settings/categories/remove-employee", async (req, res) => {
  try {
    const { categoryName, employeeId } = req.body;
    let settings = await OfficeSettings.findOne({ type: "Global" });
    const category = settings.categories.find(c => c.name === categoryName);
    if (category) {
      category.employeeIds = category.employeeIds.filter(id => id !== employeeId);
      await settings.save();
      res.status(200).json({ message: "Employee removed" });
    } else {
      res.status(404).json({ message: "Category not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

// =========================================================================
// 4. DATA FETCHING (LOGIC FOR EFFECTIVE MODE)
// =========================================================================

// Helper to determine active mode
const calculateEffectiveMode = (settings, empId) => {
  const config = settings.employeeWorkModes.find(e => e.employeeId === empId);
  if (!config || config.ruleType === "Global") return "Global";

  const today = new Date();
  
  // 1. Check Temporary Date Range
  if (config.ruleType === "Temporary" && config.temporary) {
    const from = new Date(config.temporary.fromDate);
    const to = new Date(config.temporary.toDate);
    // Normalize time to compare dates only
    today.setHours(0,0,0,0);
    from.setHours(0,0,0,0);
    to.setHours(23,59,59,999);

    if (today >= from && today <= to) {
      return config.temporary.mode; // Active Temporary Mode
    } else {
      return "Global"; // Expired -> Fallback to Global
    }
  }

  // 2. Check Recurring Days
  if (config.ruleType === "Recurring" && config.recurring) {
    const currentDay = new Date().getDay(); // 0-6
    if (config.recurring.days.includes(currentDay)) {
      return config.recurring.mode; // Active Recurring Mode
    } else {
      return "Global"; // Not the right day -> Fallback to Global
    }
  }

  // 3. Check Permanent
  if (config.ruleType === "Permanent") {
    return config.permanentMode;
  }

  return "Global";
};

router.get("/settings/employees-modes", async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true }, { employeeId: 1, name: 1, email: 1, experienceDetails: 1 }).sort({ name: 1 });
    const settings = await OfficeSettings.findOne({ type: "Global" });
    const categories = settings?.categories || [];

    const employeesWithData = employees.map(emp => {
      const config = settings?.employeeWorkModes.find(e => e.employeeId === emp.employeeId);
      const effectiveMode = settings ? calculateEffectiveMode(settings, emp.employeeId) : "Global";
      const currentExp = emp.experienceDetails?.find(exp => exp.lastWorkingDate === "Present");
      const categoryEntry = categories.find(cat => cat.employeeIds.includes(emp.employeeId));

      return {
        employeeId: emp.employeeId,
        name: emp.name,
        department: currentExp?.department || "",
        category: categoryEntry ? categoryEntry.name : "Uncategorized",
        
        // Return raw config for Admin UI editing
        ruleType: config?.ruleType || "Global",
        config: config || {},
        
        // Return calculated current status
        currentEffectiveMode: effectiveMode
      };
    });

    res.status(200).json({
      employees: employeesWithData,
      categories: categories.map(c => c.name)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Used by Employee App
router.get("/settings/employee-mode/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const settings = await OfficeSettings.findOne({ type: "Global" });
    
    if (!settings) return res.status(200).json({ workMode: "Global" });

    const mode = calculateEffectiveMode(settings, employeeId);
    // If effective mode is "Global", return the actual Global Setting (WFO/WFH)
    const finalMode = mode === "Global" ? settings.globalWorkMode : mode;

    res.status(200).json({
      employeeId,
      workMode: finalMode,
      source: mode === "Global" ? "Global Settings" : "Custom Schedule"
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
});

export default router;