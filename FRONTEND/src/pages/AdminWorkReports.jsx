import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  FaCheck,
  FaClipboardCheck,
  FaEye,
  FaFilter,
  FaIdBadge,
  FaImages,
  FaMagic,
  FaPercentage,
  FaSearch,
  FaTimes,
  FaTrash,
  FaUserTie,
} from "react-icons/fa";

import {
  approveWorkEntry,
  bulkGenerateWorkEntryPercentage,
  deleteWorkEntry,
  generateWorkEntryPercentage,
  getAdminWorkPerformance,
  getAdminWorkRecords,
  getWorkPercentageSettings,
  rejectWorkEntry,
  updateWorkEntryStatus,
} from "../api";
import WorkRecordsCalendar, {
  getMonthRangeFromValue,
  getWorkDateKey,
} from "../components/work/WorkRecordsCalendar";

const getStatusClasses = (status) => {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
};

const getMonthValueFromDate = (dateValue) => {
  const date = new Date(dateValue);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthLabel = (monthValue) => {
  const [year, month] = monthValue.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const buildMonthOptions = (count = 24) => {
  const options = [];
  const now = new Date();

  for (let index = 0; index < count; index += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    options.push({
      value,
      label: getMonthLabel(value),
    });
  }

  return options;
};

const getDateLabelFromKey = (dateKey) => {
  if (!dateKey) return "";

  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
};

const normalizeWorkRecord = (record) => ({
  ...record,
  employee_submitted_percentage:
    record?.employee_submitted_percentage ??
    record?.employeeSubmittedPercentage ??
    null,
  daily_work_percentage: Number(record?.daily_work_percentage ?? 0),
  daily_percentage_display: Number(record?.daily_percentage_display ?? 0),
  monthly_work_percentage: Number(record?.monthly_work_percentage ?? 0),
});

const AdminWorkReports = () => {
  const [filters, setFilters] = useState({
    employee_query: "",
    start_date: "",
    end_date: "",
    status: "",
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState("");
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedPerformanceMonth, setSelectedPerformanceMonth] = useState("");
  const [selectedEmployeePerformance, setSelectedEmployeePerformance] = useState(null);
  const [selectedEmployeeCalendarRecords, setSelectedEmployeeCalendarRecords] = useState([]);
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState("");
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [employeeCalendarLoading, setEmployeeCalendarLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [bulkApplying, setBulkApplying] = useState(false);
  const [percentageSettings, setPercentageSettings] = useState({
    auto_generate_percentage: true,
    default_daily_target_percentage: 70,
  });
  const [percentageInputs, setPercentageInputs] = useState({});
  const [selectedEntryIds, setSelectedEntryIds] = useState([]);

  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const getSuggestedPercentage = (record) =>
    record.employee_submitted_percentage ??
    record.daily_work_percentage ??
    percentageSettings.default_daily_target_percentage ??
    0;

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const response = await getAdminWorkRecords(filters);
      if (response.success) {
        setRecords((response.data || []).map(normalizeWorkRecord));
      }
    } catch (error) {
      console.error("Admin work records load failed:", error);
      Swal.fire("Error", "Unable to load work reports.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await getWorkPercentageSettings();
      if (response.success) {
        setPercentageSettings(response.data);
      }
    } catch (error) {
      console.error("Percentage settings load failed:", error);
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    fetchSettings();
  }, []);

  useEffect(() => {
    setPercentageInputs((current) => {
      const next = {};
      records.forEach((record) => {
        next[record._id] =
          current[record._id] !== undefined
            ? current[record._id]
            : getSuggestedPercentage(record);
      });
      return next;
    });
  }, [records, percentageSettings.default_daily_target_percentage]);

  useEffect(() => {
    const recordIds = new Set(records.map((record) => record._id));
    setSelectedEntryIds((current) => current.filter((id) => recordIds.has(id)));
  }, [records]);

  useEffect(() => {
    if (!selectedRecord) return;

    const freshRecord = records.find((record) => record._id === selectedRecord._id);
    if (freshRecord) {
      setSelectedRecord(freshRecord);
      return;
    }

    setSelectedRecord(null);
    setSelectedEmployeePerformance(null);
  }, [records, selectedRecord]);

  useEffect(() => {
    if (!selectedRecord?.employeeId?._id || !selectedPerformanceMonth) {
      setSelectedEmployeePerformance(null);
      return;
    }

    const loadSelectedEmployeePerformance = async () => {
      setPerformanceLoading(true);
      try {
        const [year, month] = selectedPerformanceMonth.split("-").map(Number);
        const response = await getAdminWorkPerformance(
          selectedRecord.employeeId._id,
          month,
          year
        );

        if (response.success) {
          setSelectedEmployeePerformance(response.data || null);
        }
      } catch (error) {
        console.error("Admin monthly performance load failed:", error);
        Swal.fire("Error", "Unable to load employee monthly percentage.", "error");
      } finally {
        setPerformanceLoading(false);
      }
    };

    loadSelectedEmployeePerformance();
  }, [selectedPerformanceMonth, selectedRecord?.employeeId?._id]);

  useEffect(() => {
    if (!selectedRecord?.employeeId?._id || !selectedRecord?.employeeId?.employeeId || !selectedPerformanceMonth) {
      setSelectedEmployeeCalendarRecords([]);
      return;
    }

    const loadSelectedEmployeeCalendar = async () => {
      setEmployeeCalendarLoading(true);
      try {
        const { startDate, endDate } = getMonthRangeFromValue(selectedPerformanceMonth);
        const response = await getAdminWorkRecords({
          employee_query: selectedRecord.employeeId.employeeId,
          start_date: startDate,
          end_date: endDate,
        });

        if (response.success) {
          const nextRecords = (response.data || [])
            .map(normalizeWorkRecord)
            .filter(
              (record) =>
                record.employeeId?._id?.toString?.() ===
                selectedRecord.employeeId._id?.toString?.()
            );

          setSelectedEmployeeCalendarRecords(nextRecords);
          setSelectedCalendarDateKey((current) => {
            if (current && current.startsWith(selectedPerformanceMonth)) {
              return current;
            }

            const recordDateKey = getWorkDateKey(selectedRecord.date);
            const firstRecordDateKey = nextRecords[0] ? getWorkDateKey(nextRecords[0].date) : "";

            return recordDateKey || firstRecordDateKey || `${selectedPerformanceMonth}-01`;
          });
        }
      } catch (error) {
        console.error("Admin employee calendar load failed:", error);
      } finally {
        setEmployeeCalendarLoading(false);
      }
    };

    loadSelectedEmployeeCalendar();
  }, [
    selectedPerformanceMonth,
    selectedRecord?.employeeId?._id,
    selectedRecord?.employeeId?.employeeId,
    selectedRecord?.date,
  ]);

  const selectedCalendarRecord = useMemo(
    () =>
      selectedEmployeeCalendarRecords.find(
        (record) => getWorkDateKey(record.date) === selectedCalendarDateKey
      ) || null,
    [selectedCalendarDateKey, selectedEmployeeCalendarRecords]
  );

  const displayedRecord = selectedCalendarRecord || selectedRecord;

  const summary = useMemo(
    () => ({
      total: records.length,
      pending: records.filter((record) => record.status === "pending").length,
      approved: records.filter((record) => record.status === "approved").length,
      rejected: records.filter((record) => record.status === "rejected").length,
    }),
    [records]
  );

  const selectableRecords = useMemo(
    () => records.filter((record) => record.evening_time),
    [records]
  );

  const selectableEntryIds = useMemo(
    () => selectableRecords.map((record) => record._id),
    [selectableRecords]
  );
  const bulkSelectionEnabled = Boolean(percentageSettings.auto_generate_percentage);

  const allSelectableChecked =
    bulkSelectionEnabled &&
    selectableEntryIds.length > 0 &&
    selectableEntryIds.every((entryId) => selectedEntryIds.includes(entryId));

  useEffect(() => {
    if (!bulkSelectionEnabled && selectedEntryIds.length > 0) {
      setSelectedEntryIds([]);
    }
  }, [bulkSelectionEnabled, selectedEntryIds.length]);

  const handleSearch = async (event) => {
    event.preventDefault();
    await fetchRecords();
  };

  const handleClearFilters = async () => {
    const clearedFilters = {
      employee_query: "",
      start_date: "",
      end_date: "",
      status: "",
    };
    setFilters(clearedFilters);
    setLoading(true);
    try {
      const response = await getAdminWorkRecords(clearedFilters);
      if (response.success) {
        setRecords(response.data || []);
      }
    } catch (error) {
      Swal.fire("Error", "Unable to clear filters right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRecord = (record) => {
    setSelectedRecord(record);
    setSelectedPerformanceMonth(getMonthValueFromDate(record.date));
    setSelectedCalendarDateKey(getWorkDateKey(record.date));
  };

  const handleToggleRecordSelection = (recordId) => {
    if (!bulkSelectionEnabled) return;

    setSelectedEntryIds((current) =>
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId]
    );
  };

  const handleToggleSelectAll = () => {
    if (!bulkSelectionEnabled) return;

    setSelectedEntryIds((current) =>
      allSelectableChecked ? current.filter((id) => !selectableEntryIds.includes(id)) : selectableEntryIds
    );
  };

  const handleQuickAction = async (id, action) => {
    try {
      const manualValue = percentageInputs[id];
      const normalizedManualValue =
        manualValue === "" || manualValue === undefined || manualValue === null
          ? undefined
          : Number(manualValue);
      const request =
        action === "approved"
          ? approveWorkEntry(
              id,
              Number.isNaN(normalizedManualValue) ? undefined : normalizedManualValue
            )
          : rejectWorkEntry(id);

      const response = await request;
      if (response.success) {
        Swal.fire("Updated", response.message, "success");
        await fetchRecords();
      }
    } catch (error) {
      Swal.fire(
        "Update failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const manualValue = percentageInputs[id];
      const normalizedManualValue =
        manualValue === "" || manualValue === undefined || manualValue === null
          ? undefined
          : Number(manualValue);
      const response = await updateWorkEntryStatus(
        id,
        status,
        Number.isNaN(normalizedManualValue) ? undefined : normalizedManualValue
      );
      if (response.success) {
        await fetchRecords();
      }
    } catch (error) {
      Swal.fire(
        "Status update failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    }
  };

  const handleGeneratePercentage = async (record) => {
    try {
      const manualValue = percentageInputs[record._id];
      const normalizedManualValue =
        manualValue === "" || manualValue === undefined || manualValue === null
          ? undefined
          : Number(manualValue);
      const response = await generateWorkEntryPercentage(
        record._id,
        Number.isNaN(normalizedManualValue) ? undefined : normalizedManualValue
      );
      if (response.success) {
        Swal.fire("Updated", response.message, "success");
        await fetchRecords();
      }
    } catch (error) {
      Swal.fire(
        "Generation failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    }
  };

  const handleBulkApply = async () => {
    if (!bulkSelectionEnabled) {
      Swal.fire(
        "Auto generate is off",
        "Turn on Auto Generate to select employees and apply one percentage to multiple employees.",
        "warning"
      );
      return;
    }

    if (!selectedEntryIds.length) {
      Swal.fire("Select employees", "Choose at least one employee record first.", "warning");
      return;
    }

    const normalizedPercentage = Number(percentageSettings.default_daily_target_percentage);
    if (
      Number.isNaN(normalizedPercentage) ||
      normalizedPercentage < 0 ||
      normalizedPercentage > 100
    ) {
      Swal.fire(
        "Invalid percentage",
        "Enter a value between 0 and 100 before applying.",
        "warning"
      );
      return;
    }

    setBulkApplying(true);
    try {
      const response = await bulkGenerateWorkEntryPercentage(
        selectedEntryIds,
        normalizedPercentage
      );

      if (response.success) {
        const skippedCount = response.skipped?.length || 0;
        Swal.fire(
          "Applied",
          skippedCount
            ? `${response.message} Skipped ${skippedCount} record(s) without evening update.`
            : response.message,
          "success"
        );
        await fetchRecords();
      }
    } catch (error) {
      Swal.fire(
        "Bulk apply failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setBulkApplying(false);
    }
  };

  const handleDelete = async (record) => {
    const result = await Swal.fire({
      title: "Delete this work record?",
      text: "This will remove the stored work content for this day.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      confirmButtonText: "Delete",
    });

    if (!result.isConfirmed) return;

    try {
      const response = await deleteWorkEntry(record._id);
      if (response.success) {
        Swal.fire("Deleted", response.message, "success");
        setSelectedRecord((current) => (current?._id === record._id ? null : current));
        await fetchRecords();
      }
    } catch (error) {
      Swal.fire(
        "Delete failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc_40%,_#f8fafc)] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[30px] bg-gradient-to-r from-slate-950 via-blue-950 to-indigo-900 p-6 text-white shadow-2xl md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
                <FaClipboardCheck />
                Admin Review
              </p>
              <h1 className="text-3xl font-black md:text-4xl">Employee Work Reports</h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
                Filter quickly, review cleanly, and apply one fixed score to many
                employees in one step when the day needs a common rating.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-100">Total</p>
                <p className="mt-1 text-2xl font-black">{summary.total}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-100">Pending</p>
                <p className="mt-1 text-2xl font-black text-amber-200">{summary.pending}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-100">Approved</p>
                <p className="mt-1 text-2xl font-black text-emerald-200">{summary.approved}</p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 text-center backdrop-blur">
                <p className="text-xs uppercase tracking-[0.18em] text-blue-100">Rejected</p>
                <p className="mt-1 text-2xl font-black text-rose-200">{summary.rejected}</p>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60"
        >
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-2xl bg-blue-50 p-3 text-blue-600">
              <FaFilter />
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-900">Filter Employee Reports</h2>
              <p className="text-sm text-slate-500">
                Check a particular employee directly by name or employee ID number.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_auto_auto]">
            <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                <FaIdBadge />
                Employee Name or ID
              </span>
              <input
                type="text"
                placeholder="Search by Chandu or ARAH04"
                value={filters.employee_query}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    employee_query: event.target.value,
                  }))
                }
                className="w-full bg-transparent text-sm outline-none"
              />
            </label>

            <input
              type="date"
              value={filters.start_date}
              onChange={(event) =>
                setFilters((current) => ({ ...current, start_date: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
            />
            <input
              type="date"
              value={filters.end_date}
              onChange={(event) =>
                setFilters((current) => ({ ...current, end_date: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
            />
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl"
            >
              <FaSearch />
              Filter Records
            </button>
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <FaTimes />
              Clear
            </button>
          </div>
        </form>

        <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
          <div className="mb-5 flex items-center gap-3">
            <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
              <FaPercentage />
            </span>
            <div>
              <h2 className="text-xl font-black text-slate-900">Auto Percentage Control</h2>
              <p className="text-sm text-slate-500">
                Save the default target for future reviews, or apply the same score to
                selected employees instantly from here.
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto_auto] xl:items-end">
            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Auto Generate
              </span>
              <button
                type="button"
                onClick={() =>
                  setPercentageSettings((current) => ({
                    ...current,
                    auto_generate_percentage: !current.auto_generate_percentage,
                  }))
                }
                className={`inline-flex rounded-full px-4 py-2 text-sm font-bold ${
                  percentageSettings.auto_generate_percentage
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-700"
                }`}
                disabled={settingsLoading}
              >
                {percentageSettings.auto_generate_percentage ? "ON" : "OFF"}
              </button>
            </label>

            <label className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Default Daily Target %
              </span>
              <input
                type="number"
                min="0"
                max="100"
                value={percentageSettings.default_daily_target_percentage}
                onChange={(event) =>
                  setPercentageSettings((current) => ({
                    ...current,
                    default_daily_target_percentage: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400"
              />
            </label>

            <button
              type="button"
              onClick={handleBulkApply}
              disabled={!bulkSelectionEnabled || !selectedEntryIds.length || bulkApplying}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaCheck />
              {bulkApplying ? "Applying..." : `Apply To Selected (${selectedEntryIds.length})`}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[28px] bg-white shadow-xl shadow-slate-200/60">
          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-slate-400">
              <FaUserTie size={44} className="mb-4 opacity-30" />
              <p className="text-lg font-semibold text-slate-500">No work reports found.</p>
              <p className="mt-2 max-w-md text-sm">
                Try another employee name or ID, or adjust the filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Bulk Selection
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">
                    Select all or only the employees you want before clicking Apply.
                  </p>
                </div>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={allSelectableChecked}
                    onChange={handleToggleSelectAll}
                    disabled={!bulkSelectionEnabled}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  Select All Eligible
                </label>
              </div>

              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    <th className="px-5 py-4">Select</th>
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Daily %</th>
                    <th className="px-5 py-4">Monthly %</th>
                    <th className="px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((record) => {
                    const isSelectable = Boolean(record.evening_time) && bulkSelectionEnabled;
                    const isChecked = selectedEntryIds.includes(record._id);

                    return (
                      <tr key={record._id} className="hover:bg-slate-50/80">
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!isSelectable}
                            title={
                              !bulkSelectionEnabled
                                ? "Turn on Auto Generate to enable bulk selection"
                                : isSelectable
                                ? "Select this employee record"
                                : "Evening update is required before bulk apply"
                            }
                            onChange={() => handleToggleRecordSelection(record._id)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-900">
                            {record.employeeId?.name || "Employee"}
                          </p>
                          <p className="text-xs text-slate-500">
                            {record.employeeId?.employeeId || "-"}
                          </p>
                          <p className="text-xs text-slate-400">
                            {record.employeeId?.email || ""}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${getStatusClasses(
                              record.status
                            )}`}
                          >
                            {record.status}
                          </span>
                          <p className="mt-2 text-xs font-semibold text-slate-500">
                            {record.evening_time
                              ? `Evening: ${record.evening_time}`
                              : "Morning only"}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-lg font-black text-indigo-600">
                          {record.daily_percentage_display || 0}%
                        </td>
                        <td className="px-5 py-4 text-lg font-black text-cyan-600">
                          {record.monthly_work_percentage || 0}%
                        </td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={() => handleOpenRecord(record)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:shadow-lg"
                          >
                            <FaEye />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-[32px] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Work Details
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-900">
                  {selectedRecord.employeeId?.name || "Employee"}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  {selectedRecord.employeeId?.employeeId || "-"} |{" "}
                  {new Date(selectedRecord.date).toLocaleDateString()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedRecord(null);
                  setSelectedEmployeePerformance(null);
                }}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white"
              >
                Close
              </button>
            </div>

            <div className="max-h-[calc(92vh-92px)] overflow-y-auto px-6 py-6">
              <div className="grid gap-6 xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Morning Update
                  </p>
                  <h3 className="text-xl font-black text-slate-900">
                    {selectedRecord.morning_title}
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                    {selectedRecord.morning_description}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Submitted at {selectedRecord.morning_time || "-"}
                  </p>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    Evening Update
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                    {selectedRecord.evening_description ||
                      "Evening update has not been submitted yet."}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Submitted at {selectedRecord.evening_time || "-"}
                  </p>

                  <div className="mt-5">
                    <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      <FaImages />
                      Images
                    </p>
                    {selectedRecord.images?.length ? (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {selectedRecord.images.map((image) => (
                          <button
                            key={image._id}
                            type="button"
                            onClick={() => setPreviewImage(image.image_url)}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                          >
                            <img
                              src={image.image_url}
                              alt="Work evidence"
                              className="h-28 w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm font-semibold text-slate-400">
                        No images uploaded
                      </div>
                    )}
                  </div>
                </section>

                <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Review Month
                      </span>
                      <select
                        value={selectedPerformanceMonth}
                        onChange={(event) => setSelectedPerformanceMonth(event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400"
                      >
                        {monthOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl bg-sky-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                        Fixed Percentage Of Day
                      </p>
                      <p className="mt-2 text-3xl font-black text-sky-700">
                        {performanceLoading
                          ? "..."
                          : `${selectedEmployeePerformance?.performancePercentage || 0}%`}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-indigo-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                        Monthly Work %
                      </p>
                      <p className="mt-2 text-3xl font-black text-indigo-700">
                        {performanceLoading
                          ? "..."
                          : `${selectedEmployeePerformance?.monthlyWorkPercentage || 0}%`}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-cyan-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                      Employee Submitted %
                    </p>
                    <p className="mt-2 text-3xl font-black text-cyan-700">
                      {selectedRecord.employee_submitted_percentage ?? "-"}%
                    </p>
                  </div>

                  <div className="rounded-2xl bg-indigo-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                      Final Admin %
                    </p>
                    <p className="mt-2 text-3xl font-black text-indigo-700">
                      {selectedRecord.daily_work_percentage || 0}%
                    </p>
                    <p className="mt-2 text-xs font-semibold text-indigo-500">
                      Mode: {selectedRecord.percentage_mode || "none"}
                    </p>
                  </div>

                  {selectedRecord.evening_time ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="block">
                        <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                          Admin Approval Percentage
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={
                            percentageInputs[selectedRecord._id] ??
                            getSuggestedPercentage(selectedRecord)
                          }
                          onChange={(event) =>
                            setPercentageInputs((current) => ({
                              ...current,
                              [selectedRecord._id]: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-indigo-400"
                        />
                      </label>

                      <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-500">
                        Suggested value: {getSuggestedPercentage(selectedRecord)}%.
                        You can edit this score before approval, and the Approve button
                        will save this exact value as the final admin percentage.
                      </p>

                      <button
                        type="button"
                        onClick={() => handleGeneratePercentage(selectedRecord)}
                        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl"
                      >
                        <FaMagic />
                        Save Percentage Only
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-5 text-sm font-semibold text-amber-700">
                      Review starts only after the evening update is submitted.
                    </div>
                  )}
                </section>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <WorkRecordsCalendar
                    monthValue={selectedPerformanceMonth}
                    records={selectedEmployeeCalendarRecords}
                    selectedDateKey={selectedCalendarDateKey}
                    onSelectDate={setSelectedCalendarDateKey}
                    loading={employeeCalendarLoading}
                    title="Work Performance Calendar"
                    description="Click any date in the selected month to inspect that employee's work content and performance values."
                  />
                </div>

                <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">
                        Selected Day Details
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Review one date clearly before taking action on the employee's work.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {getDateLabelFromKey(selectedCalendarDateKey)}
                    </span>
                  </div>

                  {displayedRecord ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Morning Focus
                          </p>
                          <h3 className="mt-2 text-xl font-black text-slate-900">
                            {displayedRecord.morning_title}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${getStatusClasses(
                            displayedRecord.status
                          )}`}
                        >
                          {displayedRecord.status}
                        </span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Morning Update
                          </p>
                          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                            {displayedRecord.morning_description}
                          </p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            Time: {displayedRecord.morning_time || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Evening Update
                          </p>
                          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                            {displayedRecord.evening_description ||
                              "Evening work not submitted yet."}
                          </p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            Time: {displayedRecord.evening_time || "-"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-cyan-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                            Employee Submitted %
                          </p>
                          <p className="mt-2 text-2xl font-black text-cyan-700">
                            {displayedRecord.employee_submitted_percentage ?? "-"}%
                          </p>
                        </div>

                        <div className="rounded-2xl bg-indigo-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                            Final Admin %
                          </p>
                          <p className="mt-2 text-2xl font-black text-indigo-700">
                            {displayedRecord.daily_work_percentage || 0}%
                          </p>
                        </div>

                        <div className="rounded-2xl bg-sky-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                            Daily %
                          </p>
                          <p className="mt-2 text-2xl font-black text-sky-700">
                            {displayedRecord.daily_percentage_display || 0}%
                          </p>
                        </div>

                        <div className="rounded-2xl bg-violet-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
                            Monthly %
                          </p>
                          <p className="mt-2 text-2xl font-black text-violet-700">
                            {displayedRecord.monthly_work_percentage || 0}%
                          </p>
                        </div>
                      </div>

                      {displayedRecord.images?.length ? (
                        <div>
                          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            <FaImages />
                            Uploaded Images
                          </p>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {displayedRecord.images.map((image) => (
                              <button
                                key={image._id}
                                type="button"
                                onClick={() => setPreviewImage(image.image_url)}
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                              >
                                <img
                                  src={image.image_url}
                                  alt="Work evidence"
                                  className="h-28 w-full object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                      <p className="text-lg font-bold text-slate-700">
                        No work record on this date.
                      </p>
                      <p className="mt-2 text-sm text-slate-500">
                        Pick another date from the calendar to review submitted work and percentages.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Actions
                </p>

                {selectedRecord.evening_time ? (
                  <div className="grid gap-3 md:grid-cols-[180px_repeat(3,minmax(0,1fr))]">
                    <select
                      value={selectedRecord.status}
                      onChange={(event) =>
                        handleStatusChange(selectedRecord._id, event.target.value)
                      }
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition focus:border-blue-400"
                    >
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => handleQuickAction(selectedRecord._id, "approved")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <FaCheck />
                      Approve With Entered %
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickAction(selectedRecord._id, "rejected")}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                    >
                      <FaTimes />
                      Reject
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(selectedRecord)}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100"
                    >
                      <FaTrash />
                      Delete
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-5 text-sm font-semibold text-amber-700">
                    No action buttons are shown for morning-only records.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {previewImage ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-[28px] bg-white p-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewImage("")}
              className="absolute right-4 top-4 rounded-full bg-slate-900 px-3 py-2 text-xs font-bold text-white"
            >
              Close
            </button>
            <img
              src={previewImage}
              alt="Work evidence preview"
              className="max-h-[82vh] rounded-[22px] object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AdminWorkReports;
