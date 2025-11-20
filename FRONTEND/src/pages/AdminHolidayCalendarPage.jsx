// --- START OF FILE AdminHolidayCalendarPage.jsx ---
import React, { useState, useEffect, useCallback } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { getHolidays, addHoliday, deleteHolidayById } from "../api";
import { FaCalendarDay, FaStar } from "react-icons/fa";

const AdminHolidayCalendarPage = () => {
  const [holidayData, setHolidayData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
  });

  const [holidays, setHolidays] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDate, setActiveDate] = useState(new Date());

  // Normalize Date (Fix timezone issues)
  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Fetch Holidays
  const fetchHolidays = useCallback(async () => {
    try {
      const response = await getHolidays();
      setHolidays(response);
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to load holidays.");
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleChange = (e) => {
    setHolidayData({
      ...holidayData,
      [e.target.name]: e.target.value,
    });
  };

  // Submit Holiday
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Auto-fill endDate for single-day holiday
      const finalData = {
        ...holidayData,
        endDate: holidayData.endDate || holidayData.startDate,
      };

      await addHoliday(finalData);

      setMessage("✅ Holiday added successfully!");
      setHolidayData({ name: "", description: "", startDate: "", endDate: "" });
      fetchHolidays();
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to add holiday.");
    } finally {
      setLoading(false);
    }
  };

  // Delete holiday
  const handleDelete = async (id) => {
    try {
      await deleteHolidayById(id);
      setMessage("🗑️ Holiday removed!");
      fetchHolidays();
    } catch (error) {
      console.error(error);
      setMessage("❌ Failed to delete holiday.");
    }
  };

  // Count holiday DAYS this month
  const holidaysThisMonth = holidays.reduce((total, holiday) => {
    const start = normalizeDate(holiday.startDate);
    const end = normalizeDate(holiday.endDate);

    const month = activeDate.getMonth();
    const year = activeDate.getFullYear();

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const rangeStart = start < monthStart ? monthStart : start;
    const rangeEnd = end > monthEnd ? monthEnd : end;

    if (rangeStart <= rangeEnd) {
      const days =
        Math.floor((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1;
      return total + days;
    }

    return total;
  }, 0);

  // Tooltip for holiday ranges
  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const current = normalizeDate(date);

      const holiday = holidays.find((h) => {
        const start = normalizeDate(h.startDate);
        const end = normalizeDate(h.endDate);
        return current >= start && current <= end;
      });

      if (holiday) {
        return (
          <div className="holiday-tooltip">
            {holiday.name}
            <br />
            {holiday.startDate} → {holiday.endDate}
          </div>
        );
      }
    }
  };

  // Highlight holiday ranges on calendar
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const current = normalizeDate(date);

      const range = holidays.some((holiday) => {
        const start = normalizeDate(holiday.startDate);
        const end = normalizeDate(holiday.endDate);
        return current >= start && current <= end;
      });

      if (range) return "holiday-tile";
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 p-4 sm:p-6 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <header className="mb-12 text-center">
          <h1 className="text-5xl pb-2 font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent drop-shadow-md">
            Holiday Management
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            Add, manage, and view all company holidays
          </p>
        </header>

        {/* FORM + LIST */}
        <div className="grid lg:grid-cols-2 gap-10 mb-16">

          {/* ADD HOLIDAY FORM */}
          <div className="bg-white/70 backdrop-blur-xl border border-white/30 shadow-2xl p-10 rounded-3xl">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">
              Add New Holiday 🎉
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">

              <div>
                <label className="font-semibold text-gray-700 mb-2 block">
                  Holiday Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={holidayData.name}
                  onChange={handleChange}
                  className="w-full p-4 rounded-xl border border-gray-300 focus:ring-4 focus:ring-blue-200 outline-none"
                  placeholder="Enter holiday name"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 mb-2 block">
                  Description
                </label>
                <textarea
                  name="description"
                  value={holidayData.description}
                  onChange={handleChange}
                  className="w-full p-4 rounded-xl border border-gray-300 focus:ring-4 focus:ring-blue-200 outline-none resize-none"
                  rows="3"
                  required
                  placeholder="Enter holiday description"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 mb-2 block">
                  Start Date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={holidayData.startDate}
                  onChange={handleChange}
                  className="w-full p-4 rounded-xl border border-gray-300 focus:ring-4 focus:ring-blue-200 outline-none"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 mb-2 block">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={holidayData.endDate}
                  min={holidayData.startDate}
                  onChange={handleChange}
                  className="w-full p-4 rounded-xl border border-gray-300 focus:ring-4 focus:ring-blue-200 outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`w-full py-4 rounded-xl font-semibold text-lg shadow-lg transition-all ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:scale-105"
                }`}
              >
                {loading ? "Adding..." : "Add Holiday ✨"}
              </button>

            </form>

            {message && (
              <div
                className={`mt-5 p-3 rounded-xl text-center font-semibold ${
                  message.includes("❌")
                    ? "bg-red-100 text-red-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                {message}
              </div>
            )}
          </div>

          {/* HOLIDAY LIST */}
          <div className="w-full">
            <h3 className="text-3xl font-bold text-gray-800 mb-8 text-center">
              All Holidays 📋
            </h3>

            {holidays.length === 0 ? (
              <div className="text-center bg-white p-12 rounded-2xl shadow-lg">
                <p className="text-2xl text-gray-400 mb-4">📭</p>
                <p className="text-gray-600 font-semibold text-lg">
                  No holidays added yet.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {holidays.map((holiday) => (
                  <div
                    key={holiday._id}
                    className="group relative bg-white shadow-lg p-6 rounded-2xl hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 overflow-hidden"
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex-shrink-0 text-3xl font-bold text-indigo-600 bg-indigo-50 p-4 rounded-xl text-center">
                        <div className="leading-none">
                          {new Date(holiday.startDate).getDate()}
                        </div>
                        <div className="text-sm font-medium tracking-wide">
                          {new Date(holiday.startDate).toLocaleString(
                            "default",
                            { month: "short" }
                          )}
                        </div>
                      </div>

                      <div className="flex-grow">
                        <h4 className="text-xl font-bold text-gray-900 mb-1">
                          {holiday.name}
                        </h4>
                        <p className="text-gray-500 text-sm mb-1">
                          {holiday.description}
                        </p>
                        <p className="text-gray-500 font-semibold text-sm">
                          {new Date(holiday.startDate).toLocaleDateString(
                            "en-US"
                          )}{" "}
                          →{" "}
                          {new Date(holiday.endDate).toLocaleDateString(
                            "en-US"
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col items-center gap-3">
                        <FaStar className="text-yellow-400 text-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <button
                          onClick={() => handleDelete(holiday._id)}
                          className="bg-red-500 hover:bg-red-600 text-white text-sm px-4 py-2 rounded-xl shadow"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* CALENDAR + STATS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 items-start">
          <div className="lg:col-span-2 bg-white shadow-2xl rounded-3xl p-6 sm:p-8 border border-slate-100">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center flex items-center justify-center gap-3">
              <FaCalendarDay className="text-indigo-500" /> Holiday Calendar
            </h3>

            <Calendar
              tileClassName={tileClassName}
              tileContent={tileContent}
              onActiveStartDateChange={({ activeStartDate }) =>
                setActiveDate(activeStartDate)
              }
              className="w-full border-none"
            />
          </div>

          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl rounded-3xl p-8 text-center flex flex-col justify-center h-full">
            <h3 className="text-2xl font-bold mb-4">Holiday Days This Month</h3>
            <div className="text-7xl font-extrabold my-4 animate-bounce-slow">
              {holidaysThisMonth}
            </div>
            <p className="opacity-80">
              {new Date(activeDate).toLocaleString("default", {
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

      </div>

      {/* CSS */}
      <style>{`
        .react-calendar { font-family: inherit; border: none; }
        .react-calendar__navigation button { font-weight: bold; font-size: 1.1rem; border-radius: 0.5rem; transition: 0.2s; }
        .react-calendar__navigation button:hover { background-color: #f3f4f6; }
        .react-calendar__month-view__weekdays__weekday { text-align: center; font-weight: 600; color: #6366F1; }
        .react-calendar__tile { border-radius: 0.5rem; transition: all 0.2s; position: relative; }
        .react-calendar__tile:enabled:hover { background: #eef2ff; }
        .react-calendar__tile--now { background: #e0e7ff !important; font-weight: bold; }

        .holiday-tile {
          background: linear-gradient(135deg, #8B5CF6, #6366F1) !important;
          color: white !important;
          font-weight: bold;
          border-radius: 0.5rem !important;
        }
        .holiday-tile:hover .holiday-tooltip {
          opacity: 1;
          transform: translateY(0);
        }

        .holiday-tooltip {
          position: absolute;
          bottom: 105%;
          left: 50%;
          transform: translateX(-50%) translateY(10px);
          background-color: #333;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.75rem;
          opacity: 0;
          transition: 0.3s;
          white-space: nowrap;
        }
        .holiday-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px;
          border-style: solid;
          border-color: #333 transparent transparent transparent;
        }

        .animate-bounce-slow { animation: bounce 2s infinite; }
      `}</style>
    </div>
  );
};

export default AdminHolidayCalendarPage;
// --- END OF FILE AdminHolidayCalendarPage.jsx ---
