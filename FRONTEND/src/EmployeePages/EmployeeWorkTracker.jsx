import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  FaCalendarAlt,
  FaCamera,
  FaChartLine,
  FaClipboardList,
  FaCloudUploadAlt,
  FaClock,
  FaPercentage,
  FaUpload,
} from "react-icons/fa";

import {
  getMyDailyWorkRecords,
  submitEveningWork,
  submitMorningWork,
} from "../api";
import WorkRecordsCalendar, {
  getWorkDateKey,
} from "../components/work/WorkRecordsCalendar";

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

const getTodayDateKey = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
};

const getStatusClasses = (status) => {
  if (status === "approved") return "bg-emerald-100 text-emerald-700";
  if (status === "rejected") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
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
});

const EmployeeWorkTracker = () => {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthValue());
  const [records, setRecords] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [morningSubmitting, setMorningSubmitting] = useState(false);
  const [eveningSubmitting, setEveningSubmitting] = useState(false);
  const [morningForm, setMorningForm] = useState({
    title: "",
    description: "",
  });
  const [eveningDescription, setEveningDescription] = useState("");
  const [eveningPercentage, setEveningPercentage] = useState("");
  const [eveningImages, setEveningImages] = useState([]);
  const [selectedCalendarDateKey, setSelectedCalendarDateKey] = useState("");
  const [showWorkPercentageCalendar, setShowWorkPercentageCalendar] = useState(false);
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const todayDateKey = useMemo(() => getTodayDateKey(), []);

  const todayRecord = useMemo(
    () =>
      records.find((record) => {
        const recordDate = new Date(record.date);
        const localRecordDate = new Date(
          recordDate.getTime() - recordDate.getTimezoneOffset() * 60 * 1000
        )
          .toISOString()
          .split("T")[0];

        return localRecordDate === todayDateKey;
      }) || null,
    [records, todayDateKey]
  );

  const latestDailyPercentageRecord = useMemo(
    () =>
      records.find(
        (record) =>
          record.percentage_generated_at || record.percentage_mode !== "none"
      ) || null,
    [records]
  );

  const latestDailyCalculatedPercentage = useMemo(() => {
    const latestDailyPercentage = Number(
      latestDailyPercentageRecord?.daily_work_percentage ?? 0
    );
    const totalWorkingDays = Number(performance?.totalWorkingDays ?? 0);

    if (!totalWorkingDays || Number.isNaN(latestDailyPercentage)) {
      return 0;
    }

    return Number((latestDailyPercentage / totalWorkingDays).toFixed(2));
  }, [latestDailyPercentageRecord, performance?.totalWorkingDays]);

  const selectedCalendarRecord = useMemo(
    () =>
      records.find((record) => getWorkDateKey(record.date) === selectedCalendarDateKey) || null,
    [records, selectedCalendarDateKey]
  );

  const selectedCalendarDailyShare = useMemo(() => {
    const totalWorkingDays = Number(performance?.totalWorkingDays ?? 0);
    const selectedApprovedPercentage = Number(
      selectedCalendarRecord?.daily_work_percentage ?? 0
    );

    if (!selectedCalendarRecord || !totalWorkingDays) {
      return 0;
    }

    return Number((selectedApprovedPercentage / totalWorkingDays).toFixed(2));
  }, [performance?.totalWorkingDays, selectedCalendarRecord]);

  const loadRecords = async (monthValue = selectedMonth) => {
    setLoading(true);
    try {
      const [year, month] = monthValue.split("-");
      const response = await getMyDailyWorkRecords(Number(month), Number(year));
      if (response.success) {
        setRecords((response.data || []).map(normalizeWorkRecord));
        setPerformance(response.performance || null);
      }
    } catch (error) {
      console.error("Daily work load failed:", error);
      Swal.fire("Error", "Unable to load your work tracker right now.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [selectedMonth]);

  useEffect(() => {
    setSelectedCalendarDateKey((current) => {
      if (current && current.startsWith(selectedMonth)) {
        return current;
      }

      const todayInSelectedMonth = todayDateKey.startsWith(selectedMonth)
        ? todayDateKey
        : null;
      const firstRecordDateKey = records[0] ? getWorkDateKey(records[0].date) : "";

      return todayInSelectedMonth || firstRecordDateKey || `${selectedMonth}-01`;
    });
  }, [records, selectedMonth, todayDateKey]);

  const handleMorningSubmit = async (event) => {
    event.preventDefault();

    if (!morningForm.title.trim() || !morningForm.description.trim()) {
      Swal.fire("Missing details", "Please fill title and description.", "warning");
      return;
    }

    setMorningSubmitting(true);
    try {
      const response = await submitMorningWork(morningForm);
      if (response.success) {
        Swal.fire("Submitted", response.message, "success");
        setMorningForm({ title: "", description: "" });
        const currentMonth = getCurrentMonthValue();
        setSelectedMonth(currentMonth);
        await loadRecords(currentMonth);
      }
    } catch (error) {
      Swal.fire(
        "Morning work failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setMorningSubmitting(false);
    }
  };

  const handleEveningFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    const validTypes = ["image/jpeg", "image/jpg", "image/png"];
    const invalidFile = files.find((file) => !validTypes.includes(file.type));

    if (invalidFile) {
      Swal.fire("Invalid file", "Only JPG and PNG images are allowed.", "warning");
      event.target.value = "";
      return;
    }

    setEveningImages(files);
  };

  const handleEveningSubmit = async (event) => {
    event.preventDefault();
    const normalizedPercentage = Number(eveningPercentage);

    if (!eveningDescription.trim()) {
      Swal.fire("Missing details", "Please add the evening description.", "warning");
      return;
    }

    if (
      eveningPercentage === "" ||
      Number.isNaN(normalizedPercentage) ||
      normalizedPercentage < 0 ||
      normalizedPercentage > 100
    ) {
      Swal.fire(
        "Missing percentage",
        "Please enter your work percentage between 0 and 100.",
        "warning"
      );
      return;
    }

    setEveningSubmitting(true);
    try {
      const response = await submitEveningWork(
        eveningDescription,
        eveningImages,
        normalizedPercentage
      );
      if (response.success) {
        Swal.fire("Submitted", response.message, "success");
        setEveningDescription("");
        setEveningPercentage("");
        setEveningImages([]);
        if (response.data?._id) {
          setRecords((current) => {
            const nextRecord = normalizeWorkRecord(response.data);
            const withoutCurrentDay = current.filter((record) => record._id !== nextRecord._id);
            return [nextRecord, ...withoutCurrentDay];
          });
        }
        const currentMonth = getCurrentMonthValue();
        setSelectedMonth(currentMonth);
        await loadRecords(currentMonth);
      }
    } catch (error) {
      Swal.fire(
        "Evening work failed",
        error.response?.data?.message || "Please try again.",
        "error"
      );
    } finally {
      setEveningSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef4ff,_#f8fafc_45%,_#f8fafc)] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[32px] bg-gradient-to-br from-slate-950 via-indigo-950 to-cyan-900 px-6 py-8 text-white shadow-2xl md:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
                <FaClipboardList />
                Daily Work Tracker
              </p>
              <h1 className="text-3xl font-black md:text-4xl">
                Track the day, not just attendance
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-slate-200 md:text-base">
                Submit your morning plan, close the day with real outcomes, add your
                own work score, and watch your monthly progress build up.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  Review Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="rounded-xl border border-white/20 bg-slate-950/30 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300"
                >
                  {monthOptions.map((option) => (
                    <option key={option.value} value={option.value} className="text-slate-900">
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Approved Days</p>
            <p className="mt-3 text-3xl font-black text-emerald-600">
              {performance?.approvedDays || 0}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Rejected Days</p>
            <p className="mt-3 text-3xl font-black text-rose-600">
              {performance?.rejectedDays || 0}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Missed Days</p>
            <p className="mt-3 text-3xl font-black text-amber-600">
              {performance?.missedDays || 0}
            </p>
          </div>
            <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <FaChartLine className="text-sky-500" />
                Fixed Percentage Of Day
              </p>
              <p className="mt-3 text-3xl font-black text-sky-600">
                {performance?.performancePercentage || 0}%
              </p>
            </div>
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <FaPercentage className="text-cyan-500" />
              Daily Percentage
            </p>
            <p className="mt-3 text-3xl font-black text-cyan-600">
              {latestDailyCalculatedPercentage}%
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {latestDailyPercentageRecord
                ? `Calculated share ${new Date(
                    latestDailyPercentageRecord.date
                  ).toLocaleDateString()}`
                : "Visible after admin score"}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-500">
              <FaPercentage className="text-indigo-500" />
              Monthly Work %
            </p>
            <p className="mt-3 text-3xl font-black text-indigo-600">
              {performance?.monthlyWorkPercentage || 0}%
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Running month percentage
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Working Days This Month</p>
            <p className="mt-3 text-3xl font-black text-slate-900">
              {performance?.totalWorkingDays || 0}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Weekly Off Pattern</p>
            <p className="mt-3 text-xl font-black text-slate-900">
              {performance?.weeklyOffLabels?.join(", ") || "Sunday"}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-lg shadow-slate-200/60">
            <p className="text-sm font-semibold text-slate-500">Company Holidays In Month</p>
            <p className="mt-3 text-3xl font-black text-slate-900">
              {performance?.holidayCount || 0}
            </p>
          </div>
        </div>

        {performance?.weeklyPerformance?.length ? (
          <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
            <div className="mb-5">
              <h2 className="text-2xl font-black text-slate-900">Weekly Performance</h2>
              <p className="mt-1 text-sm text-slate-500">
                Weekly score is shown as the sum of that week's daily percentages from the
                first working day to the last working day.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {performance.weeklyPerformance.map((week) => (
                <div
                  key={week.weekLabel}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                    {week.weekLabel}
                  </p>
                  <p className="mt-3 text-3xl font-black text-indigo-600">
                    {week.weeklyPercentage}%
                  </p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Working days: {week.workingDays}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Morning Update</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Submit the first work update for today. Only one morning entry is
                    allowed each day.
                  </p>
                </div>
                {todayRecord?.morning_time ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    Submitted at {todayRecord.morning_time}
                  </span>
                ) : null}
              </div>

              <form onSubmit={handleMorningSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Morning Title
                  </label>
                  <input
                    type="text"
                    value={morningForm.title}
                    onChange={(event) =>
                      setMorningForm((current) => ({ ...current, title: event.target.value }))
                    }
                    placeholder="What is the main focus this morning?"
                    disabled={Boolean(todayRecord?.morning_time)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Morning Description
                  </label>
                  <textarea
                    rows="4"
                    value={morningForm.description}
                    onChange={(event) =>
                      setMorningForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Describe your planned tasks, meetings, or priorities."
                    disabled={Boolean(todayRecord?.morning_time)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={Boolean(todayRecord?.morning_time) || morningSubmitting}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaClock />
                  {morningSubmitting ? "Submitting..." : "Submit Morning Work"}
                </button>
              </form>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Evening Update</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Close the day with outcomes, add proof images, and enter your own
                    work percentage out of 100.
                  </p>
                </div>
                {todayRecord?.evening_time ? (
                  <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-bold text-sky-700">
                    Submitted at {todayRecord.evening_time}
                  </span>
                ) : null}
              </div>

              <form onSubmit={handleEveningSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Evening Description
                  </label>
                  <textarea
                    rows="5"
                    value={eveningDescription}
                    onChange={(event) => setEveningDescription(event.target.value)}
                    disabled={!todayRecord?.morning_time || Boolean(todayRecord?.evening_time)}
                    placeholder="Summarize what was completed, blockers resolved, and outcomes achieved."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-cyan-400"
                  />
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <FaPercentage className="text-indigo-500" />
                    Your work percentage for today
                  </div>
                  <div className="flex flex-col gap-3 md:flex-row md:items-end">
                    <div className="flex-1">
                      <label className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Enter your score out of 100
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={eveningPercentage}
                        onChange={(event) => setEveningPercentage(event.target.value)}
                        disabled={!todayRecord?.morning_time || Boolean(todayRecord?.evening_time)}
                        placeholder="Example: 82"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
                      />
                    </div>
                    <p className="max-w-xs text-xs font-semibold leading-relaxed text-slate-500">
                      This value is sent to admin as your own daily score suggestion. Admin can
                      accept it or change it after review.
                    </p>
                  </div>
                </div>

                <label className="block rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center transition hover:border-cyan-400 hover:bg-cyan-50/60">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    multiple
                    onChange={handleEveningFileChange}
                    disabled={!todayRecord?.morning_time || Boolean(todayRecord?.evening_time)}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <span className="rounded-2xl bg-white p-3 text-cyan-600 shadow">
                      <FaUpload size={20} />
                    </span>
                    <p className="font-semibold text-slate-700">Upload work images</p>
                    <p className="text-xs">PNG or JPG only, up to 5 images.</p>
                  </div>
                </label>

                {eveningImages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {eveningImages.map((file) => (
                      <span
                        key={`${file.name}-${file.size}`}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                      >
                        {file.name}
                      </span>
                    ))}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    !todayRecord?.morning_time ||
                    Boolean(todayRecord?.evening_time) ||
                    eveningSubmitting
                  }
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FaCloudUploadAlt />
                  {eveningSubmitting ? "Submitting..." : "Submit Evening Work"}
                </button>
              </form>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Review Work Percentage
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Open the work percentage calendar to view daily records, submitted score,
                    approved score, and performance details month-wise.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowWorkPercentageCalendar((currentValue) => !currentValue)
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl"
                >
                  <FaCalendarAlt />
                  {showWorkPercentageCalendar
                    ? "Hide Work Percentage Calendar"
                    : "Work Percentage Calendar"}
                </button>
              </div>
            </div>

            {showWorkPercentageCalendar ? (
              <>
                <WorkRecordsCalendar
                  monthValue={selectedMonth}
                  records={records}
                  selectedDateKey={selectedCalendarDateKey}
                  onSelectDate={setSelectedCalendarDateKey}
                  loading={loading}
                  title="Work Performance Calendar"
                  description="Click any date in the selected month to inspect that day's work content and performance values."
                />

                <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">Selected Day Details</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Use the calendar to review one date clearly before checking the full history.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {getDateLabelFromKey(selectedCalendarDateKey)}
                </span>
              </div>

              {selectedCalendarRecord ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Morning Focus
                      </p>
                      <h3 className="mt-2 text-xl font-black text-slate-900">
                        {selectedCalendarRecord.morning_title}
                      </h3>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${getStatusClasses(
                        selectedCalendarRecord.status
                      )}`}
                    >
                      {selectedCalendarRecord.status}
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Morning Update
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                        {selectedCalendarRecord.morning_description}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-slate-500">
                        Time: {selectedCalendarRecord.morning_time || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        Evening Update
                      </p>
                      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
                        {selectedCalendarRecord.evening_description ||
                          "Evening work not submitted yet."}
                      </p>
                      <p className="mt-3 text-xs font-semibold text-slate-500">
                        Time: {selectedCalendarRecord.evening_time || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-cyan-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                        Your Submitted %
                      </p>
                      <p className="mt-2 text-2xl font-black text-cyan-700">
                        {selectedCalendarRecord.employee_submitted_percentage ?? "-"}%
                      </p>
                    </div>

                    <div className="rounded-2xl bg-indigo-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                        Final Approved %
                      </p>
                      <p className="mt-2 text-2xl font-black text-indigo-700">
                        {selectedCalendarRecord.daily_work_percentage || 0}%
                      </p>
                    </div>

                    <div className="rounded-2xl bg-sky-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-sky-700">
                        Daily Share
                      </p>
                      <p className="mt-2 text-2xl font-black text-sky-700">
                        {selectedCalendarDailyShare}%
                      </p>
                    </div>

                    <div className="rounded-2xl bg-violet-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
                        Monthly Work %
                      </p>
                      <p className="mt-2 text-2xl font-black text-violet-700">
                        {performance?.monthlyWorkPercentage || 0}%
                      </p>
                    </div>
                  </div>

                  {selectedCalendarRecord.images?.length ? (
                    <div>
                      <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                        <FaCamera />
                        Uploaded Images
                      </p>
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {selectedCalendarRecord.images.map((image) => (
                          <a
                            key={image._id}
                            href={image.image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                          >
                            <img
                              src={image.image_url}
                              alt="Work evidence"
                              className="h-28 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                  <p className="text-lg font-bold text-slate-700">No work record on this date.</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Pick another date from the calendar to review submitted work and percentages.
                  </p>
                </div>
              )}
                </div>
              </>
            ) : null}

            <div className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">My Records</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review your submitted score, the admin-approved score, and all work
                    submissions for the selected month.
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {records.length} entries
                </span>
              </div>

              {loading ? (
                <div className="flex min-h-[420px] items-center justify-center">
                  <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
                </div>
              ) : records.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center text-slate-400">
                  <FaClipboardList size={46} className="mb-4 opacity-30" />
                  <p className="text-lg font-semibold text-slate-500">
                    No work entries for this month yet.
                  </p>
                  <p className="mt-2 max-w-sm text-sm">
                    Your approved, rejected, and pending work logs will appear here once
                    submitted.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {records.map((record) => (
                    <article
                      key={record._id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm"
                    >
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                            <FaCalendarAlt />
                            {new Date(record.date).toLocaleDateString()}
                          </p>
                          <h3 className="mt-2 text-lg font-black text-slate-900">
                            {record.morning_title}
                          </h3>
                        </div>
                        <span
                          className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${getStatusClasses(
                            record.status
                          )}`}
                        >
                          {record.status}
                        </span>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Morning
                          </p>
                          <p className="text-sm text-slate-700">{record.morning_description}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            Time: {record.morning_time || "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Evening
                          </p>
                          <p className="text-sm text-slate-700">
                            {record.evening_description || "Evening work not submitted yet."}
                          </p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">
                            Time: {record.evening_time || "-"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            Your Submitted %
                          </p>
                          <p className="mt-2 text-2xl font-black text-cyan-600">
                            {record.employee_submitted_percentage ?? "-"}%
                          </p>
                        </div>

                        <div className="rounded-2xl bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                Final Approved %
                              </p>
                              <p className="mt-2 text-2xl font-black text-indigo-600">
                                {record.daily_work_percentage || 0}%
                              </p>
                            </div>
                            <div className="text-right text-xs font-semibold text-slate-500">
                              <p>Mode: {record.percentage_mode || "none"}</p>
                              <p>
                                Generated:{" "}
                                {record.percentage_generated_at
                                  ? new Date(record.percentage_generated_at).toLocaleString()
                                  : "Not generated"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {record.images?.length ? (
                        <div className="mt-4">
                          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                            <FaCamera />
                            Uploaded Images
                          </p>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {record.images.map((image) => (
                              <a
                                key={image._id}
                                href={image.image_url}
                                target="_blank"
                                rel="noreferrer"
                                className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                              >
                                <img
                                  src={image.image_url}
                                  alt="Work evidence"
                                  className="h-28 w-full object-cover"
                                />
                              </a>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeWorkTracker;
