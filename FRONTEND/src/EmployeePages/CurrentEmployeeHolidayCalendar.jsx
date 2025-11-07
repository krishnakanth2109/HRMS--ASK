import React, { useContext, useMemo, useState } from "react";
import { HolidayCalendarContext } from "../context/HolidayCalendarContext";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";

const CurrentEmployeeHolidayCalendar = () => {
  const { holidays } = useContext(HolidayCalendarContext);

  const currentYear = new Date().getFullYear();
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today);
  const [filter, setFilter] = useState("upcoming"); // "upcoming" | "previous"

  // Normalize date to midnight for reliable comparison
  const normalizeDateKey = (dateLike) => {
    const d = new Date(dateLike);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };

  const todayKey = normalizeDateKey(today);

  // Filter upcoming holidays (today & future), skip Sundays
  const upcomingHolidays = useMemo(
    () =>
      holidays
        .filter(
          (h) =>
            normalizeDateKey(h.date) >= todayKey &&
            new Date(h.date).getDay() !== 0 // Exclude Sundays
        )
        .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [holidays, todayKey]
  );

  // Filter previous holidays (before today), skip Sundays
  const previousHolidays = useMemo(
    () =>
      holidays
        .filter(
          (h) =>
            normalizeDateKey(h.date) < todayKey &&
            new Date(h.date).getDay() !== 0 // Exclude Sundays
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [holidays, todayKey]
  );

  // Always sort the list in ascending order by date before rendering
  const list = (filter === "upcoming" ? upcomingHolidays : previousHolidays)
    .slice()
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  // Helper: group holiday objects by date, merging names/descriptions
  const groupByDate = (arr) => {
    const map = new Map();
    arr.forEach((h) => {
      const key = h.date; // YYYY-MM-DD string is a safe key
      const existing = map.get(key);
      if (existing) {
        existing.names.push(h.name);
        if (h.description) existing.descriptions.push(h.description);
      } else {
        map.set(key, {
          date: h.date,
          names: [h.name],
          descriptions: h.description ? [h.description] : [],
        });
      }
    });

    // Convert map to array and join names/descriptions
    return Array.from(map.values())
      .map((item) => ({
        date: item.date,
        name: item.names.join(", "),
        description: item.descriptions.length ? item.descriptions.join(" | ") : "",
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  // Memoize grouped list and grouped counts
  const groupedList = useMemo(() => groupByDate(list), [list]);
  const upcomingGroupedCount = useMemo(() => groupByDate(upcomingHolidays).length, [upcomingHolidays]);
  const previousGroupedCount = useMemo(() => groupByDate(previousHolidays).length, [previousHolidays]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 py-8 px-2 md:px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-8 text-blue-900 text-center tracking-wide drop-shadow">
          Holiday Calendar - {currentYear}
        </h2>

        {/* Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left side */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-lg p-6 md:p-8">
            <div className="flex flex-col items-center">
              <Calendar
                value={selectedDate}
                onChange={setSelectedDate}
                className="border-0 shadow w-full rounded-lg calendar-custom"
                tileClassName={({ date }) => {
                  const isToday =
                    date.getDate() === today.getDate() &&
                    date.getMonth() === today.getMonth() &&
                    date.getFullYear() === today.getFullYear();
                  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                  let classes = "";
                  if (isToday) classes += " bg-yellow-200 font-bold";
                  if (isWeekend) classes += " text-red-600 font-semibold";
                  return classes.trim();
                }}
                prev2Label={null}
                next2Label={null}
                showNavigation={true}
                minDetail="year"
                maxDetail="month"
              />
            </div>

            <div className="mt-10">
              <h3 className="text-xl font-semibold text-blue-800 mb-4 text-center">
                {filter === "upcoming" ? "Upcoming Holidays" : "Previous Holidays"}
              </h3>
              {groupedList.length === 0 ? (
                <div className="text-center text-gray-500">No holidays to show.</div>
              ) : (
                <ul className="divide-y divide-blue-100 rounded-lg overflow-hidden shadow-md bg-blue-50">
                  {groupedList.map((h) => (
                    <li
                      key={h.date}
                      className="flex flex-col md:flex-row md:items-center gap-2 px-4 py-3 hover:bg-blue-100 transition"
                    >
                      <div className="flex-1 flex flex-col md:flex-row md:items-center gap-2">
                        <span className="font-bold text-blue-700 text-base md:text-lg">{h.name}</span>
                        <span className="text-gray-500 text-sm md:ml-4">
                          {new Date(h.date).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      {h.description && (
                        <span className="text-xs text-gray-600 md:ml-4">{h.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right side filter */}
          <aside className="md:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6 md:sticky md:top-6">
              <h4 className="text-lg font-semibold text-blue-900 mb-4">Filter</h4>
              <div className="space-y-3">
                <label className="flex items-center justify-between gap-2 cursor-pointer p-3 rounded-xl border border-blue-100 hover:bg-blue-50">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="holidayFilter"
                      value="upcoming"
                      checked={filter === "upcoming"}
                      onChange={() => setFilter("upcoming")}
                      className="accent-blue-600"
                    />
                    <span>Upcoming Holidays</span>
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                    {upcomingGroupedCount}
                  </span>
                </label>

                <label className="flex items-center justify-between gap-2 cursor-pointer p-3 rounded-xl border border-blue-100 hover:bg-blue-50">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="holidayFilter"
                      value="previous"
                      checked={filter === "previous"}
                      onChange={() => setFilter("previous")}
                      className="accent-blue-600"
                    />
                    <span>Previous Holidays</span>
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                    {previousGroupedCount}
                  </span>
                </label>
              </div>
            </div>
          </aside>
        </div>

        <style>{`
          .calendar-custom { font-size: 1rem; background: #f8fafc; }
          .react-calendar__tile { min-height: 3.5rem; border-radius: 0.5rem; margin: 2px; transition: background 0.2s; }
          .react-calendar__tile:enabled:hover, .react-calendar__tile:enabled:focus { background: #dbeafe; }
          .bg-yellow-200 { background: #fef9c3 !important; }
        `}</style>
      </div>
    </div>
  );
};

export default CurrentEmployeeHolidayCalendar;
