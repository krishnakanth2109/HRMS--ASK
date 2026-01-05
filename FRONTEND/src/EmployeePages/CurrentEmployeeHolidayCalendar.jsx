// --- START OF FILE EmployeeHolidays.jsx ---
import React, { useEffect, useState } from "react";
import { getHolidays, getEmployees } from "../api";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { FaCalendarDay, FaGift, FaStar, FaRegSadTear } from "react-icons/fa";

const EmployeeHolidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeDate, setActiveDate] = useState(new Date());

  // Normalize date (timezone-safe)
  const normalize = (d) => {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Fetch holidays
  useEffect(() => {
    const fetchHolidays = async () => {
      try {
        const data = await getHolidays();

        const formatted = data.map((h) => ({
          ...h,
          start: normalize(h.startDate),
          end: normalize(h.endDate || h.startDate),
        }));

        setHolidays(formatted);
      } catch (err) {
        console.error("Error fetching holidays:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHolidays();
  }, []);

  // Fetch birthdays
  useEffect(() => {
    const fetchBirthdays = async () => {
      try {
        const employees = await getEmployees();
        const list = employees
          .filter((emp) => emp.personalDetails?.dob)
          .map((emp) => ({
            name: emp.name,
            dob: new Date(emp.personalDetails.dob),
          }));
        setBirthdays(list);
      } catch (err) {
        console.error("Error loading birthdays:", err);
      }
    };

    fetchBirthdays();
  }, []);

  // Month-wise filtered holidays
  const filteredHolidays = holidays.filter((h) => {
    return (
      h.start.getMonth() === activeDate.getMonth() &&
      h.start.getFullYear() === activeDate.getFullYear()
    );
  });

  // Month-wise filtered birthdays
  const filteredBirthdays = birthdays.filter((b) => {
    return b.dob.getMonth() === activeDate.getMonth();
  });

  // Monthly holiday count
  const holidaysThisMonth = holidays.reduce((total, h) => {
    const year = activeDate.getFullYear();
    const month = activeDate.getMonth();

    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    const start = h.start < monthStart ? monthStart : h.start;
    const end = h.end > monthEnd ? monthEnd : h.end;

    if (start <= end) {
      return (
        total +
        (Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1)
      );
    }
    return total;
  }, 0);

  // Tooltip for holiday
  const tileContent = ({ date, view }) => {
    if (view === "month") {
      const d = normalize(date);
      const holiday = holidays.find((h) => d >= h.start && d <= h.end);
      return holiday ? (
        <div className="holiday-tooltip">
          <div className="font-bold">{holiday.name}</div>
          {holiday.description && <div className="text-[10px] font-normal opacity-90 border-t border-gray-500 mt-1 pt-1">{holiday.description}</div>}
        </div>
      ) : null;
    }
  };

  // Highlight holidays on calendar
  const tileClassName = ({ date, view }) => {
    if (view === "month") {
      const d = normalize(date);
      const isHoliday = holidays.some((h) => d >= h.start && d <= h.end);
      return isHoliday ? "holiday-tile" : null;
    }
  };

  // Helper for Month Name
  const currentMonthName = activeDate.toLocaleString("default", { month: "long" });

  // Loading UI
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex justify-center animate-pulse">
        <div className="w-full max-w-6xl space-y-12">
          <div className="h-12 bg-gray-200 rounded-lg w-1/3 mx-auto"></div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 bg-gray-200 rounded-2xl h-96"></div>
            <div className="bg-gray-200 rounded-2xl h-48"></div>
          </div>
          <div className="grid lg:grid-cols-2 gap-8">
             <div className="bg-gray-200 h-64 rounded-2xl"></div>
             <div className="bg-gray-200 h-64 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="text-center mb-12">
          <h2 className="text-4xl pb-2 sm:text-5xl font-extrabold bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent mb-3 animate-gradient-x">
            Company Calendar
          </h2>
          <p className="text-lg text-gray-600">
            Keep track of holidays and celebrate your colleagues.
          </p>
        </div>

        {/* CALENDAR & STATS SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16 items-start">
          <div className="lg:col-span-2 bg-white shadow-xl rounded-3xl p-6 sm:p-8 border border-slate-100">
            <h3 className="text-2xl font-bold text-gray-800 mb-6 text-center flex items-center justify-center gap-3">
              <FaCalendarDay className="text-indigo-500" /> Holiday Calendar
            </h3>

            <Calendar
              tileClassName={tileClassName}
              tileContent={tileContent}
              onActiveStartDateChange={({ activeStartDate }) =>
                setActiveDate(activeStartDate)
              }
              className="w-full border-none mx-auto"
            />
          </div>

          {/* STATS */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-xl rounded-3xl p-8 text-center flex flex-col justify-center h-full">
            <h3 className="text-2xl font-bold mb-4">Holidays in {currentMonthName}</h3>
            <div className="text-7xl font-extrabold my-4 animate-bounce-slow">
              {holidaysThisMonth}
            </div>
            <p className="opacity-80">
              {activeDate.toLocaleString("default", {
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* SPLIT VIEW: HOLIDAYS & BIRTHDAYS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* ----- LEFT COLUMN: HOLIDAYS ----- */}
          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-purple-600">🎉</span> Holidays ({currentMonthName})
            </h3>
            
            {filteredHolidays.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-dashed border-gray-300 text-center">
                 <p className="text-gray-400 text-5xl mb-3">🏖️</p>
                 <p className="text-gray-500 font-medium">No holidays this month.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredHolidays.map((h) => (
                  <div
                    key={h._id}
                    className="group relative bg-white shadow-md p-5 rounded-xl hover:shadow-xl hover:scale-[1.01] transition-all duration-300 overflow-hidden border-l-4 border-purple-500"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 text-2xl font-bold text-purple-600 bg-purple-50 p-3 rounded-lg text-center w-16">
                        <div className="leading-none">{h.start.getDate()}</div>
                        <div className="text-xs uppercase font-bold mt-1">
                          {h.start.toLocaleString("default", { month: "short" })}
                        </div>
                      </div>

                      <div className="flex-grow">
                        <h4 className="text-lg font-bold text-gray-900">{h.name}</h4>
                        <p className="text-gray-500 text-sm">
                           {h.start.toDateString()}
                        </p>
                        {/* Description Added Here */}
                        {h.description && (
                          <p className="text-gray-500 text-xs mt-2 italic border-t pt-2 border-gray-100">
                            {h.description}
                          </p>
                        )}
                      </div>
                      
                      <FaStar className="text-yellow-400 text-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ----- RIGHT COLUMN: BIRTHDAYS ----- */}
          <div>
            <h3 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="text-orange-500">🎂</span> Colleagues Birthdays ({currentMonthName})
            </h3>

            {filteredBirthdays.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-dashed border-gray-300 text-center">
                 <p className="text-gray-400 text-5xl mb-3">🎈</p>
                 <p className="text-gray-500 font-medium">No birthdays this month.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBirthdays.map((b, i) => (
                  <div
                    key={i}
                    className="group relative bg-white shadow-md p-5 rounded-xl hover:shadow-xl hover:scale-[1.01] transition-all duration-300 overflow-hidden border-l-4 border-orange-400"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0 text-2xl font-bold text-orange-600 bg-orange-50 p-3 rounded-lg text-center w-16">
                        <div className="leading-none">{b.dob.getDate()}</div>
                        <div className="text-xs uppercase font-bold mt-1">
                          {b.dob.toLocaleString("default", { month: "short" })}
                        </div>
                      </div>

                      <div className="flex-grow">
                        <h4 className="text-lg font-bold text-gray-900">{b.name}</h4>
                        <p className="text-gray-500 text-sm">
                          Turning a year older! 🎁
                        </p>
                      </div>

                      <FaGift className="text-pink-500 text-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* CSS */}
      <style>{`
        .react-calendar { font-family: inherit; border: none; }
        .holiday-tile {
          background: linear-gradient(135deg, #8B5CF6, #6366F1) !important;
          color: white !important;
        }
        .holiday-tooltip {
          position: absolute;
          bottom: 105%;
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: white;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12px;
          opacity: 0;
          transition: 0.3s;
          z-index: 10;
          white-space: nowrap;
          pointer-events: none;
        }
        .holiday-tile:hover .holiday-tooltip { opacity: 1; }
        .animate-bounce-slow { animation: bounce 2s infinite; }
      `}</style>
    </div>
  );
};

export default EmployeeHolidays;
// --- END OF FILE EmployeeHolidays.jsx ---