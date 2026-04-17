import React, { useMemo } from "react";
import { FaCalendarAlt } from "react-icons/fa";

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const getWorkDateKey = (dateValue) => {
  if (!dateValue) return "";

  if (typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const localDate = new Date(
    parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60 * 1000
  );

  return localDate.toISOString().split("T")[0];
};

export const getMonthRangeFromValue = (monthValue) => {
  if (!monthValue) {
    return {
      startDate: "",
      endDate: "",
    };
  }

  const [year, month] = monthValue.split("-").map(Number);
  const totalDays = new Date(year, month, 0).getDate();

  return {
    startDate: `${monthValue}-01`,
    endDate: `${monthValue}-${String(totalDays).padStart(2, "0")}`,
  };
};

const buildCalendarWeeks = (monthValue) => {
  if (!monthValue) return [];

  const [year, month] = monthValue.split("-").map(Number);
  const firstDayIndex = new Date(year, month - 1, 1).getDay();
  const totalDays = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: firstDayIndex }, () => null);

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7)
  );
};

const getStatusStyles = (status) => {
  if (status === "approved") {
    return {
      dot: "bg-emerald-500",
      label: "text-emerald-700",
      tile: "border-emerald-200 bg-emerald-50/60",
    };
  }

  if (status === "rejected") {
    return {
      dot: "bg-rose-500",
      label: "text-rose-700",
      tile: "border-rose-200 bg-rose-50/60",
    };
  }

  return {
    dot: "bg-amber-500",
    label: "text-amber-700",
    tile: "border-amber-200 bg-amber-50/60",
  };
};

const WorkRecordsCalendar = ({
  monthValue,
  records = [],
  selectedDateKey,
  onSelectDate,
  title = "Performance Calendar",
  description = "Click a date to inspect the work record and percentages for that day.",
  loading = false,
}) => {
  const recordMap = useMemo(
    () =>
      records.reduce((map, record) => {
        const key = getWorkDateKey(record.date);
        if (key) {
          map.set(key, record);
        }
        return map;
      }, new Map()),
    [records]
  );

  const calendarWeeks = useMemo(() => buildCalendarWeeks(monthValue), [monthValue]);

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-xl shadow-slate-200/60">
      <div className="mb-5 flex items-start gap-3">
        <span className="rounded-2xl bg-indigo-50 p-3 text-indigo-600">
          <FaCalendarAlt />
        </span>
        <div>
          <h2 className="text-xl font-black text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {WEEK_DAYS.map((day) => (
          <div
            key={day}
            className="pb-1 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400"
          >
            {day}
          </div>
        ))}

        {calendarWeeks.flat().map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="h-[108px] rounded-2xl bg-slate-50" />;
          }

          const dateKey = `${monthValue}-${String(day).padStart(2, "0")}`;
          const record = recordMap.get(dateKey);
          const isSelected = selectedDateKey === dateKey;
          const statusStyles = getStatusStyles(record?.status);

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onSelectDate?.(dateKey)}
              className={`h-[108px] rounded-2xl border p-3 text-left transition ${
                isSelected
                  ? "border-slate-900 bg-slate-900 text-white shadow-lg"
                  : record
                    ? `${statusStyles.tile} hover:-translate-y-0.5 hover:shadow-md`
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-sm font-black ${isSelected ? "text-white" : "text-slate-900"}`}>
                  {day}
                </span>
                {record ? (
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-white" : statusStyles.dot}`}
                  />
                ) : null}
              </div>

              {loading ? (
                <p className={`mt-4 text-[11px] font-semibold ${isSelected ? "text-slate-200" : "text-slate-400"}`}>
                  Loading...
                </p>
              ) : record ? (
                <div className="mt-4 space-y-1">
                  <p
                    className={`text-[11px] font-bold uppercase tracking-[0.14em] ${
                      isSelected ? "text-slate-200" : statusStyles.label
                    }`}
                  >
                    {record.status}
                  </p>
                  <p className={`text-[11px] font-semibold ${isSelected ? "text-white" : "text-slate-600"}`}>
                    Submitted {record.employee_submitted_percentage ?? "-"}%
                  </p>
                  <p className={`text-[11px] font-semibold ${isSelected ? "text-white" : "text-slate-600"}`}>
                    Final {record.daily_work_percentage || 0}%
                  </p>
                </div>
              ) : (
                <p className={`mt-4 text-[11px] font-semibold ${isSelected ? "text-slate-200" : "text-slate-400"}`}>
                  No record
                </p>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default WorkRecordsCalendar;
