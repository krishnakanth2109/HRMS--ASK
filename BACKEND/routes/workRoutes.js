import express from "express";
import multer from "multer";

import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";
import { cloudinary } from "../config/cloudinary.js";
import DailyWorkEntry from "../models/DailyWorkEntry.js";
import WorkImage from "../models/WorkImage.js";
import Employee from "../models/employeeModel.js";
import Notification from "../models/notificationModel.js";
import WorkPercentageSetting from "../models/WorkPercentageSetting.js";
import {
  calculateMonthlyPerformance,
  getCurrentMonthYear,
  getDateKeyInTimeZone,
  getDateObjectFromKey,
  getMonthDateRange,
  getTimeKeyInTimeZone,
} from "../utils/monthlyPerformance.js";

const createWorkImageUploader = () =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024,
      files: 5,
    },
    fileFilter: (req, file, callback) => {
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

      if (!allowedTypes.includes(file.mimetype)) {
        return callback(new Error("Only JPG and PNG images are allowed."));
      }

      callback(null, true);
    },
  });

const uploadWorkImages = createWorkImageUploader();
const employeeWorkRoutes = express.Router();
const adminWorkRoutes = express.Router();

const getWorkPercentageSettings = async () => {
  let settings = await WorkPercentageSetting.findOne();

  if (!settings) {
    settings = await WorkPercentageSetting.create({
      auto_generate_percentage: true,
      default_daily_target_percentage: 70,
    });
  }

  return settings;
};

const formatWorkEntryResponse = (entry, images = []) => ({
  _id: entry._id,
  employeeId: entry.employeeId,
  date: entry.date,
  morning_title: entry.morning_title,
  morning_description: entry.morning_description,
  morning_time: entry.morning_time,
  evening_description: entry.evening_description,
  evening_time: entry.evening_time,
  employee_submitted_percentage: entry.employee_submitted_percentage,
  status: entry.status,
  daily_work_percentage: entry.daily_work_percentage,
  percentage_generated_at: entry.percentage_generated_at,
  percentage_mode: entry.percentage_mode,
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  images,
});

const getSuggestedEmployeePercentage = (entry, settings) => {
  const employeeValue = Number(entry.employee_submitted_percentage);
  if (!Number.isNaN(employeeValue) && employeeValue >= 0 && employeeValue <= 100) {
    return employeeValue;
  }

  return settings.default_daily_target_percentage;
};

const normalizeWorkPercentage = (value) => {
  const normalizedValue = Number(value);

  if (Number.isNaN(normalizedValue) || normalizedValue < 0 || normalizedValue > 100) {
    return null;
  }

  return normalizedValue;
};

const applyWorkPercentageToEntry = async (
  entry,
  settings,
  { requestedPercentage = null, useAutoSetting = true } = {}
) => {
  const suggestedPercentage = getSuggestedEmployeePercentage(entry, settings);
  const finalPercentage = useAutoSetting ? suggestedPercentage : requestedPercentage;

  if (
    finalPercentage === null ||
    Number.isNaN(finalPercentage) ||
    finalPercentage < 0 ||
    finalPercentage > 100
  ) {
    return {
      success: false,
      message: "Daily work percentage must be between 0 and 100.",
    };
  }

  entry.daily_work_percentage = entry.status === "approved" ? finalPercentage : 0;
  entry.percentage_generated_at = new Date();
  entry.percentage_mode = useAutoSetting && settings.auto_generate_percentage ? "auto" : "manual";
  await entry.save();

  return {
    success: true,
    finalPercentage,
    entry,
  };
};

const attachImagesToEntries = async (entries) => {
  const entryIds = entries.map((entry) => entry._id);
  const images = await WorkImage.find({
    workEntryId: { $in: entryIds },
  }).sort({ createdAt: 1 });

  const imageMap = images.reduce((accumulator, image) => {
    const key = image.workEntryId.toString();
    if (!accumulator[key]) {
      accumulator[key] = [];
    }

    accumulator[key].push(image);
    return accumulator;
  }, {});

  return entries.map((entry) => {
    const entryObject = typeof entry.toObject === "function" ? entry.toObject() : entry;
    return formatWorkEntryResponse(
      entryObject,
      imageMap[entry._id.toString()] || []
    );
  });
};

const attachMonthlyWorkPercentages = async (records = []) => {
  const performanceCache = new Map();

  await Promise.all(
    records.map(async (record) => {
      const employeeId = record.employeeId?._id?.toString?.() || record.employeeId?.toString?.();
      if (!employeeId || !record.date) {
        return;
      }

      const dateKey = getDateKeyInTimeZone(new Date(record.date));
      const [year, month] = dateKey.split("-").map(Number);
      const cacheKey = `${employeeId}-${month}-${year}`;

      if (!performanceCache.has(cacheKey)) {
        const performance = await calculateMonthlyPerformance(employeeId, month, year);
        performanceCache.set(cacheKey, {
          monthlyWorkPercentage: Number(performance?.monthlyWorkPercentage || 0),
          employeePortalDailyPercentage: Number(
            performance?.employeePortalDailyPercentage || 0
          ),
          totalWorkingDays: Number(performance?.totalWorkingDays || 0),
        });
      }
    })
  );

  return records.map((record) => {
      const employeeId = record.employeeId?._id?.toString?.() || record.employeeId?.toString?.();
      const dateKey = getDateKeyInTimeZone(new Date(record.date));
      const [year, month] = dateKey.split("-").map(Number);
      const cacheKey = `${employeeId}-${month}-${year}`;
      const performance = performanceCache.get(cacheKey);

    return {
      ...record,
      daily_percentage_display: Number(performance?.employeePortalDailyPercentage || 0),
      monthly_work_percentage: Number(performance?.monthlyWorkPercentage || 0),
      total_working_days: Number(performance?.totalWorkingDays || 0),
    };
  });
};

const getMonthYearFromQuery = (query) => {
  if (query.month && query.year) {
    return {
      month: Number(query.month),
      year: Number(query.year),
    };
  }

  return getCurrentMonthYear();
};

const uploadImagesToCloudinary = async (files = []) => {
  const uploadedImages = [];

  for (const file of files) {
    const encoded = Buffer.from(file.buffer).toString("base64");
    const dataUri = `data:${file.mimetype};base64,${encoded}`;
    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: "hrms_daily_work",
      resource_type: "image",
    });

    uploadedImages.push({
      image_url: uploadResult.secure_url,
      image_public_id: uploadResult.public_id,
    });
  }

  return uploadedImages;
};

employeeWorkRoutes.use(protect);
adminWorkRoutes.use(protect, onlyAdmin);

employeeWorkRoutes.post("/morning", async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Morning title and description are required.",
      });
    }

    const dateKey = getDateKeyInTimeZone();
    const todayDate = getDateObjectFromKey(dateKey);

    const existingEntry = await DailyWorkEntry.findOne({
      employeeId: req.user._id,
      date: todayDate,
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: "Morning work has already been submitted for today.",
      });
    }

    const entry = await DailyWorkEntry.create({
      employeeId: req.user._id,
      date: todayDate,
      morning_title: title.trim(),
      morning_description: description.trim(),
      morning_time: getTimeKeyInTimeZone(),
    });

    return res.status(201).json({
      success: true,
      message: "Morning work submitted successfully.",
      data: formatWorkEntryResponse(entry, []),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Only one daily work entry is allowed per day.",
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

employeeWorkRoutes.post("/evening", (req, res) => {
  uploadWorkImages.array("images", 5)(req, res, async (uploadError) => {
    if (uploadError instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: uploadError.message,
      });
    }

    if (uploadError) {
      return res.status(400).json({
        success: false,
        message: uploadError.message,
      });
    }

    try {
      const { description, employee_submitted_percentage } = req.body;
      const normalizedEmployeePercentage = Number(employee_submitted_percentage);

      if (!description?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Evening description is required.",
        });
      }

      if (
        employee_submitted_percentage === undefined ||
        employee_submitted_percentage === null ||
        employee_submitted_percentage === "" ||
        Number.isNaN(normalizedEmployeePercentage) ||
        normalizedEmployeePercentage < 0 ||
        normalizedEmployeePercentage > 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Please enter your work percentage between 0 and 100.",
        });
      }

      const dateKey = getDateKeyInTimeZone();
      const todayDate = getDateObjectFromKey(dateKey);

      const entry = await DailyWorkEntry.findOne({
        employeeId: req.user._id,
        date: todayDate,
      });

      if (!entry) {
        return res.status(400).json({
          success: false,
          message: "Morning work must be submitted before evening work.",
        });
      }

      if (entry.evening_time) {
        return res.status(400).json({
          success: false,
          message: "Evening work has already been submitted for today.",
        });
      }

      entry.evening_description = description.trim();
      entry.evening_time = getTimeKeyInTimeZone();
      entry.employee_submitted_percentage = normalizedEmployeePercentage;
      entry.status = "pending";
      await entry.save();

      const uploadedImageUrls = await uploadImagesToCloudinary(req.files || []);
      const imageDocs =
        uploadedImageUrls.length > 0
          ? await WorkImage.insertMany(
              uploadedImageUrls.map((image) => ({
                workEntryId: entry._id,
                image_url: image.image_url,
                image_public_id: image.image_public_id,
              }))
            )
          : [];

      return res.status(200).json({
        success: true,
        message: "Evening work submitted successfully.",
        data: formatWorkEntryResponse(entry, imageDocs),
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });
});

employeeWorkRoutes.get("/my-records", async (req, res) => {
  try {
    const { month, year } = getMonthYearFromQuery(req.query);
    const { startDate, endDate } = getMonthDateRange(month, year);

    const entries = await DailyWorkEntry.find({
      employeeId: req.user._id,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({ date: -1, createdAt: -1 });

    const records = await attachImagesToEntries(entries);
    const performance = await calculateMonthlyPerformance(req.user, month, year);
    const settings = await getWorkPercentageSettings();

    return res.status(200).json({
      success: true,
      data: records,
      performance,
      percentageSettings: settings,
      month,
      year,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

employeeWorkRoutes.get("/performance", async (req, res) => {
  try {
    const { month, year } = getMonthYearFromQuery(req.query);
    const performance = await calculateMonthlyPerformance(req.user, month, year);

    return res.status(200).json({
      success: true,
      data: performance,
      month,
      year,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

adminWorkRoutes.get("/work-records", async (req, res) => {
  try {
    const { employee_name, employee_query, start_date, end_date, status } = req.query;
    const query = {};

    if (status && ["pending", "approved", "rejected"].includes(status)) {
      query.status = status;
    }

    if (start_date || end_date) {
      query.date = {};
      if (start_date) {
        query.date.$gte = getDateObjectFromKey(start_date);
      }
      if (end_date) {
        const endDate = getDateObjectFromKey(end_date);
        endDate.setDate(endDate.getDate() + 1);
        endDate.setMilliseconds(endDate.getMilliseconds() - 1);
        query.date.$lte = endDate;
      }
    }

    const entries = await DailyWorkEntry.find(query)
      .populate("employeeId", "name employeeId email companyName")
      .sort({ date: -1, createdAt: -1 });

    const searchValue = String(employee_query || employee_name || "").trim().toLowerCase();

    const filteredEntries = searchValue
      ? entries.filter((entry) =>
          entry.employeeId?.name?.toLowerCase().includes(searchValue) ||
          entry.employeeId?.employeeId?.toLowerCase().includes(searchValue)
        )
      : entries;

    const recordsWithImages = await attachImagesToEntries(filteredEntries);
    const records = await attachMonthlyWorkPercentages(recordsWithImages);

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

adminWorkRoutes.get("/work-percentage-settings", async (req, res) => {
  try {
    const settings = await getWorkPercentageSettings();

    return res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

adminWorkRoutes.patch("/work-percentage-settings", async (req, res) => {
  try {
    const { auto_generate_percentage, default_daily_target_percentage } = req.body;
    const settings = await getWorkPercentageSettings();

    if (typeof auto_generate_percentage === "boolean") {
      settings.auto_generate_percentage = auto_generate_percentage;
    }

    if (default_daily_target_percentage !== undefined) {
      const normalizedPercentage = Number(default_daily_target_percentage);

      if (Number.isNaN(normalizedPercentage) || normalizedPercentage < 0 || normalizedPercentage > 100) {
        return res.status(400).json({
          success: false,
          message: "Default daily target percentage must be between 0 and 100.",
        });
      }

      settings.default_daily_target_percentage = normalizedPercentage;
    }

    await settings.save();

    return res.status(200).json({
      success: true,
      message: "Work percentage settings updated successfully.",
      data: settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

adminWorkRoutes.get("/work-performance/:employeeId", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId).select("name employeeId");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const { month, year } = getMonthYearFromQuery(req.query);
    const performance = await calculateMonthlyPerformance(employee, month, year);

    return res.status(200).json({
      success: true,
      employee,
      data: performance,
      month,
      year,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

const updateWorkStatus = async (req, res, status) => {
  try {
    const entry = await DailyWorkEntry.findById(req.params.id).populate(
      "employeeId",
      "name employeeId email"
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Work entry not found.",
      });
    }

    if (!entry.evening_time) {
      return res.status(400).json({
        success: false,
        message: "Admin review is available only after the employee submits the evening update.",
      });
    }

    if (status === "approved") {
      entry.status = status;

      const settings = await getWorkPercentageSettings();
      const requestedPercentage =
        req.body.daily_work_percentage !== undefined
          ? normalizeWorkPercentage(req.body.daily_work_percentage)
          : null;
      const useAutoSetting =
        requestedPercentage === null ? settings.auto_generate_percentage : false;
      const percentageResult = await applyWorkPercentageToEntry(entry, settings, {
        requestedPercentage,
        useAutoSetting,
      });

      if (!percentageResult.success) {
        return res.status(400).json({
          success: false,
          message: percentageResult.message,
        });
      }
    } else {
      entry.status = status;

      if (status !== "approved") {
        entry.daily_work_percentage = 0;
        entry.percentage_generated_at = null;
        entry.percentage_mode = "none";
      }

      await entry.save();
    }

    const [record] = await attachImagesToEntries([entry]);

    return res.status(200).json({
      success: true,
      message: `Work entry marked as ${status}.`,
      data: record,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

adminWorkRoutes.post("/work/:id/generate-percentage", async (req, res) => {
  try {
    const entry = await DailyWorkEntry.findById(req.params.id).populate(
      "employeeId",
      "name employeeId email"
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Work entry not found.",
      });
    }

    if (!entry.evening_time) {
      return res.status(400).json({
        success: false,
        message: "Percentage review is available only after the evening update is submitted.",
      });
    }

    const settings = await getWorkPercentageSettings();
    const requestedPercentage =
      req.body.daily_work_percentage !== undefined
        ? normalizeWorkPercentage(req.body.daily_work_percentage)
        : null;
    const useAutoSetting =
      requestedPercentage === null ? settings.auto_generate_percentage : false;
    const percentageResult = await applyWorkPercentageToEntry(entry, settings, {
      requestedPercentage,
      useAutoSetting,
    });

    if (!percentageResult.success) {
      return res.status(400).json({
        success: false,
        message: percentageResult.message,
      });
    }

    const [record] = await attachImagesToEntries([entry]);

    return res.status(200).json({
      success: true,
      message:
        entry.status === "approved"
          ? `Daily work percentage updated to ${entry.daily_work_percentage}%.`
          : "Entry is not approved, so daily work percentage was stored as 0%.",
      data: record,
      settings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

adminWorkRoutes.post("/work/bulk-generate-percentage", async (req, res) => {
  try {
    const { entryIds = [], daily_work_percentage } = req.body;

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one employee work record.",
      });
    }

    const normalizedPercentage = normalizeWorkPercentage(daily_work_percentage);

    if (normalizedPercentage === null) {
      return res.status(400).json({
        success: false,
        message: "Daily work percentage must be between 0 and 100.",
      });
    }

    const entries = await DailyWorkEntry.find({
      _id: { $in: entryIds },
    }).populate("employeeId", "name employeeId email");

    if (!entries.length) {
      return res.status(404).json({
        success: false,
        message: "Selected work records were not found.",
      });
    }

    const settings = await getWorkPercentageSettings();
    const updatedEntries = [];
    const skippedEntries = [];

    for (const entry of entries) {
      if (!entry.evening_time) {
        skippedEntries.push({
          _id: entry._id,
          employeeId: entry.employeeId,
          reason: "Evening update not submitted.",
        });
        continue;
      }

      await applyWorkPercentageToEntry(entry, settings, {
        requestedPercentage: normalizedPercentage,
        useAutoSetting: false,
      });
      updatedEntries.push(entry);
    }

    const records = await attachImagesToEntries(updatedEntries);

    return res.status(200).json({
      success: true,
      message: `Applied ${normalizedPercentage}% to ${updatedEntries.length} selected record(s).`,
      data: records,
      skipped: skippedEntries,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

adminWorkRoutes.post("/work-performance/:employeeId/send-summary", async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId).select(
      "name employeeId email"
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const { month, year } = getMonthYearFromQuery(req.body);
    const performance = await calculateMonthlyPerformance(employee, month, year);

    await Notification.create({
      userId: employee._id,
      userType: "Employee",
      title: "Monthly Work Percentage",
      message: `Your work score for ${String(month).padStart(2, "0")}/${year} is ${performance.monthlyWorkPercentage}%. Approved days: ${performance.approvedDays}, Rejected days: ${performance.rejectedDays}, Missed days: ${performance.missedDays}.`,
      type: "system",
      isRead: false,
      date: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: "Monthly work percentage sent to the employee.",
      data: performance,
      employee,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

adminWorkRoutes.patch("/work/:id/approve", async (req, res) =>
  updateWorkStatus(req, res, "approved")
);

adminWorkRoutes.patch("/work/:id/reject", async (req, res) =>
  updateWorkStatus(req, res, "rejected")
);

adminWorkRoutes.patch("/work/:id/update-status", async (req, res) => {
  const { status } = req.body;

  if (!["pending", "approved", "rejected"].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status supplied.",
    });
  }

  return updateWorkStatus(req, res, status);
});

adminWorkRoutes.delete("/work/:id", async (req, res) => {
  try {
    const entry = await DailyWorkEntry.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: "Work entry not found.",
      });
    }

    const images = await WorkImage.find({ workEntryId: entry._id });

    await Promise.all(
      images.map(async (image) => {
        if (image.image_public_id) {
          try {
            await cloudinary.uploader.destroy(image.image_public_id, {
              resource_type: "image",
            });
          } catch (error) {}
        }
      })
    );

    await WorkImage.deleteMany({ workEntryId: entry._id });
    await DailyWorkEntry.findByIdAndDelete(entry._id);

    return res.status(200).json({
      success: true,
      message: "Work entry deleted successfully.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export { employeeWorkRoutes, adminWorkRoutes };
