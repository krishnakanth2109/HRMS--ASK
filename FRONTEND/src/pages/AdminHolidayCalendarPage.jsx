// --- START OF FILE AdminHolidayCalendarPage.jsx ---
import React, { useState, useEffect, useCallback, useRef } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import * as XLSX from "xlsx"; // SheetJS
import Swal from "sweetalert2"; // SweetAlert2
import { getHolidays, addHoliday, deleteHolidayById, getEmployees } from "../api";
import { 
  FaChevronLeft, 
  FaChevronRight, 
  FaFileImport,
  FaPlus,
  FaTimes,
  FaTrash,
  FaCalendarAlt,
  FaBirthdayCake
} from "react-icons/fa";

const AdminHolidayCalendarPage = () => {
  // --- Form State ---
  const [holidayData, setHolidayData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
  });

  // --- Data States ---
  const [holidays, setHolidays] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // --- UI States ---
  const [activeDate, setActiveDate] = useState(new Date()); // Calendar View Date
  const [isModalOpen, setIsModalOpen] = useState(false); 
  
  // Cursors for the side lists
  const [birthdayCursor, setBirthdayCursor] = useState(new Date());
  const [holidayCursor, setHolidayCursor] = useState(new Date());

  const fileInputRef = useRef(null);

  // Helper: Normalize Date (Strip time)
  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  /* =========================================================
      FETCH DATA
  ==========================================================*/
  const fetchHolidays = useCallback(async () => {
    try {
      const response = await getHolidays();
      setHolidays(response);
    } catch (error) {
      console.error(error);
      Swal.fire("Error", "Failed to load holidays.", "error");
    }
  }, []);

  const fetchBirthdays = useCallback(async () => {
    try {
      const allEmployees = await getEmployees();
      const result = allEmployees
        .filter((emp) => emp.personalDetails?.dob)
        .map((emp) => ({
          name: emp.name,
          dob: new Date(emp.personalDetails.dob),
        }));
      setBirthdays(result);
    } catch (err) {
      console.error("Error loading birthdays:", err);
    }
  }, []);

  useEffect(() => {
    fetchHolidays();
    fetchBirthdays();
  }, [fetchHolidays, fetchBirthdays]);

  const handleChange = (e) => {
    setHolidayData({ ...holidayData, [e.target.name]: e.target.value });
  };

  /* =========================================================
      IMPORT LOGIC
  ==========================================================*/
  const findKey = (obj, searchStr) => Object.keys(obj).find(key => key.toLowerCase().replace(/[^a-z]/g, '').includes(searchStr.toLowerCase()));

  const parseImportDate = (val) => {
    if (!val) return null;
    if (typeof val === 'number') return new Date(Math.round((val - 25569) * 86400 * 1000));
    if (typeof val === 'string') {
      const match = val.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
      if (match) return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
      const stdDate = new Date(val);
      return isNaN(stdDate.getTime()) ? null : stdDate;
    }
    return null;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        let addedCount = 0;
        const promises = [];

        for (const row of data) {
          // Robust key finding
          const nameKey = findKey(row, "name") || findKey(row, "holiday");
          const descKey = findKey(row, "desc") || findKey(row, "description") || findKey(row, "detail");
          const startKey = findKey(row, "start") || findKey(row, "date");
          
          if (!startKey) continue;
          
          const startDate = parseImportDate(row[startKey]);
          if (!startDate || isNaN(startDate.getTime())) continue;

          const toLocalISO = (d) => {
            const offset = d.getTimezoneOffset() * 60000;
            return new Date(d.getTime() - offset).toISOString().split('T')[0];
          };

          const exists = holidays.some(h => normalizeDate(h.startDate).getTime() === normalizeDate(startDate).getTime());
          
          if (!exists) {
            promises.push(addHoliday({
              name: nameKey ? row[nameKey] : "Holiday",
              description: descKey ? row[descKey] : "", // Explicitly capture description
              startDate: toLocalISO(startDate),
              endDate: toLocalISO(startDate) // Single day default
            }));
            addedCount++;
          }
        }

        await Promise.all(promises);
        if (addedCount > 0) {
          Swal.fire('Success', `Imported ${addedCount} holidays!`, 'success');
          fetchHolidays();
          setIsModalOpen(false);
        } else {
          Swal.fire('Info', 'No new holidays found.', 'info');
        }
      } catch (error) {
        console.error("Import Error", error);
        Swal.fire("Error", "Failed to parse file.", "error");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  /* =========================================================
      CRUD LOGIC
  ==========================================================*/
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addHoliday({ ...holidayData, endDate: holidayData.endDate || holidayData.startDate });
      Swal.fire('Success', 'Holiday added!', 'success');
      setHolidayData({ name: "", description: "", startDate: "", endDate: "" });
      fetchHolidays();
      setIsModalOpen(false);
    } catch (error) {
      Swal.fire("Error", "Failed to add holiday.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Delete?', text: "Irreversible action!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33'
    });
    if (result.isConfirmed) {
      try {
        await deleteHolidayById(id);
        fetchHolidays();
        Swal.fire('Deleted', '', 'success');
      } catch (error) {
        Swal.fire('Error', 'Failed to delete.', 'error');
      }
    }
  };

  /* =========================================================
      LIST FILTERING LOGIC
  ==========================================================*/
  const changeMonth = (setter) => (increment) => {
    setter((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + increment);
      return newDate;
    });
  };

  // Filter Birthdays for Side List
  const currentMonthBirthdays = birthdays.filter((b) => b.dob.getMonth() === birthdayCursor.getMonth());
  currentMonthBirthdays.sort((a, b) => a.dob.getDate() - b.dob.getDate());

  // Filter Holidays for Side List
  const currentMonthHolidays = holidays.filter((h) => {
    const hDate = normalizeDate(h.startDate);
    return hDate.getMonth() === holidayCursor.getMonth() && hDate.getFullYear() === holidayCursor.getFullYear();
  });
  currentMonthHolidays.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));


  /* =========================================================
      CALENDAR RENDERING LOGIC
  ==========================================================*/
  
  // 1. Get Details for a specific Tile Date
  const getTileDetails = (date) => {
    const current = normalizeDate(date);
    
    // Check Holiday
    const holiday = holidays.find(h => {
      const s = normalizeDate(h.startDate);
      const e = normalizeDate(h.endDate);
      return current >= s && current <= e;
    });

    // Check Birthday (Match Day & Month)
    const birthday = birthdays.find(b => b.dob.getDate() === date.getDate() && b.dob.getMonth() === date.getMonth());

    return { holiday, birthday };
  };

  // 2. Class Name Logic (Green for Holiday, None specific for just Birthday unless overlapping)
  const tileClassName = ({ date, view }) => {
    if (view !== "month") return "";
    const { holiday } = getTileDetails(date);
    
    // User Requirement: Green Color Mark for Holiday
    if (holiday) return "holiday-tile-green";
    
    return "";
  };

  // 3. Tile Content (Indicators & Tooltip)
  const tileContent = ({ date, view }) => {
    if (view !== "month") return null;
    const { holiday, birthday } = getTileDetails(date);

    if (!holiday && !birthday) return null;

    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Indicators */}
        <div className="flex gap-1 items-center justify-center mt-6">
           {/* If Birthday: Show Emoji */}
           {birthday && <span className="text-sm animate-pulse">🎂</span>}
        </div>

        {/* HOVER TOOLTIP (Dropdown Style) */}
        <div className="custom-tooltip group-hover:block hidden">
          {holiday && (
            <div className="mb-2">
              <div className="font-bold text-green-300">Holiday: {holiday.name}</div>
              {/* Added Description to Tooltip */}
              {holiday.description && (
                <div className="text-[10px] text-gray-300 whitespace-normal leading-tight max-w-[150px] mt-1 border-t border-gray-600 pt-1">
                  {holiday.description}
                </div>
              )}
            </div>
          )}
          {birthday && (
            <div>
              <span className="font-bold text-orange-300">Birthday:</span> {birthday.name}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-sans text-slate-800">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">Holiday Calendar</h1>
            <p className="text-slate-500 text-sm mt-1">Manage holidays & track birthdays</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl font-semibold shadow-lg transition-transform transform hover:scale-105 active:scale-95"
          >
            <FaPlus className="text-xs" /> Add New Holiday 
          </button>
        </div>

        <div className="grid lg:grid-cols-12 gap-6">
          
          {/* --- LEFT SIDE: LISTS (4 Columns) --- */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* UPCOMING HOLIDAYS CARD */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <FaCalendarAlt /> <span className="font-bold">Holidays</span>
                </div>
                <div className="flex items-center gap-1 bg-white/20 rounded-lg px-1">
                  <button onClick={() => changeMonth(setHolidayCursor)(-1)} className="p-1 hover:bg-white/20 rounded"><FaChevronLeft size={10}/></button>
                  <span className="text-xs font-mono w-16 text-center">{holidayCursor.toLocaleString('default',{month:'short', year:'2-digit'})}</span>
                  <button onClick={() => changeMonth(setHolidayCursor)(1)} className="p-1 hover:bg-white/20 rounded"><FaChevronRight size={10}/></button>
                </div>
              </div>
              
              <div className="p-4 min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar">
                {currentMonthHolidays.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <span className="text-2xl opacity-50">🏝️</span>
                    <span className="text-xs mt-2">No holidays this month</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentMonthHolidays.map(h => (
                      <div key={h._id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:shadow-md transition-shadow group">
                        <div className="flex items-center gap-3 w-full">
                          <div className="flex flex-col items-center justify-center bg-white border border-emerald-100 shadow-sm w-10 h-10 rounded-lg text-emerald-600 font-bold leading-none flex-shrink-0">
                            <span className="text-sm">{new Date(h.startDate).getDate()}</span>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-sm font-bold text-slate-700 leading-tight truncate">{h.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{new Date(h.startDate).toLocaleDateString()}</p>
                            {/* Added Description Here */}
                            {h.description && (
                                <p className="text-[10px] text-slate-500 truncate mt-0.5" title={h.description}>
                                    {h.description}
                                </p>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleDelete(h._id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-2"><FaTrash size={12}/></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* BIRTHDAYS CARD */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-orange-400 to-pink-500 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <FaBirthdayCake /> <span className="font-bold">Birthdays</span>
                </div>
                <div className="flex items-center gap-1 bg-white/20 rounded-lg px-1">
                  <button onClick={() => changeMonth(setBirthdayCursor)(-1)} className="p-1 hover:bg-white/20 rounded"><FaChevronLeft size={10}/></button>
                  <span className="text-xs font-mono w-16 text-center">{birthdayCursor.toLocaleString('default',{month:'short', year:'2-digit'})}</span>
                  <button onClick={() => changeMonth(setBirthdayCursor)(1)} className="p-1 hover:bg-white/20 rounded"><FaChevronRight size={10}/></button>
                </div>
              </div>
              
              <div className="p-4 min-h-[200px] max-h-[300px] overflow-y-auto custom-scrollbar">
                {currentMonthBirthdays.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <span className="text-2xl opacity-50">🎂</span>
                    <span className="text-xs mt-2">No birthdays this month</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentMonthBirthdays.map((b, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 hover:bg-orange-50 rounded-lg transition-colors">
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 text-xs font-bold">
                          {b.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{b.name}</p>
                          <p className="text-[10px] text-slate-400">
                             Turns a year older on {b.dob.getDate()} {b.dob.toLocaleString('default',{month:'short'})}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* --- RIGHT SIDE: CALENDAR (8 Columns) --- */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-6 h-full relative">
              <Calendar
                tileClassName={tileClassName}
                tileContent={tileContent}
                onActiveStartDateChange={({ activeStartDate }) => setActiveDate(activeStartDate)}
                className="custom-calendar w-full border-none"
                next2Label={null}
                prev2Label={null}
              />
              
              {/* Legend */}
              <div className="flex gap-6 justify-center mt-6 text-xs text-gray-500 font-medium border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 block"></span> Holiday
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg leading-none">🎂</span> Birthday
                </div>
              </div>
            </div>
          </div>
        
        </div>
      </div>

      {/* --- MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
            <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">Add Holiday</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><FaTimes/></button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Import */}
              <div className="border border-dashed border-blue-300 bg-blue-50 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                <p className="text-xs text-blue-600 font-medium">Bulk Import via Excel</p>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.csv" />
                <button 
                  onClick={() => fileInputRef.current.click()}
                  disabled={loading}
                  className="bg-white text-blue-600 px-4 py-1.5 rounded-lg shadow-sm text-xs font-bold border border-blue-100 hover:bg-blue-100"
                >
                  <FaFileImport className="inline mr-1"/> Choose File
                </button>
              </div>

              <div className="relative text-center">
                <span className="bg-white px-2 text-xs text-gray-400 relative z-10">OR MANUALLY</span>
                <div className="absolute top-1/2 left-0 w-full border-t border-gray-100"></div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input 
                  name="name" 
                  value={holidayData.name} 
                  onChange={handleChange} 
                  placeholder="Holiday Name" 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none" 
                  required 
                />
                <textarea 
                  name="description" 
                  value={holidayData.description} 
                  onChange={handleChange} 
                  placeholder="Description" 
                  rows="2" 
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-800 outline-none resize-none" 
                />
                <div className="flex gap-3">
                  <div className="w-1/2">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Start Date</label>
                    <input type="date" name="startDate" value={holidayData.startDate} onChange={handleChange} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none" required />
                  </div>
                  <div className="w-1/2">
                    <label className="text-[10px] uppercase font-bold text-gray-400">End Date</label>
                    <input type="date" name="endDate" value={holidayData.endDate} min={holidayData.startDate} onChange={handleChange} className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition shadow-lg">
                  {loading ? "Processing..." : "Add Holiday"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- STYLES --- */}
      <style>{`
        /* CALENDAR BASE */
        .react-calendar { width: 100%; font-family: inherit; border: none; }
        
        /* NAVIGATION HEADER */
        .react-calendar__navigation { margin-bottom: 20px; }
        .react-calendar__navigation button { font-size: 1.2rem; font-weight: 700; color: #334155; }
        .react-calendar__navigation button:enabled:hover,
        .react-calendar__navigation button:enabled:focus { background-color: #f1f5f9; border-radius: 8px; }
        
        /* WEEKDAYS */
        .react-calendar__month-view__weekdays { text-transform: uppercase; font-size: 0.75rem; font-weight: 700; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 10px; }
        .react-calendar__month-view__weekdays__weekday abbr { text-decoration: none; }

        /* TILES (DATES) */
        .react-calendar__tile {
          height: 90px; /* Fixed height for consistency */
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 8px;
          position: relative;
          overflow: visible !important; /* Allow tooltip to overflow */
          border-radius: 12px;
          font-weight: 600;
          color: #475569;
          transition: all 0.2s ease;
        }

        .react-calendar__tile:enabled:hover { background-color: #f8fafc; }
        .react-calendar__tile--now { background: #f1f5f9; color: #0f172a; }

        /* HOLIDAY STYLE (Green Rounded Mark) */
        .holiday-tile-green {
          background-color: #ecfdf5 !important; /* light green bg */
          color: #059669 !important; /* green text */
          border: 1px solid #d1fae5;
        }

        /* CUSTOM TOOLTIP (Pop-up dropdown style) */
        .custom-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: #1e293b; /* Slate 800 */
          color: white;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.75rem;
          white-space: nowrap;
          z-index: 50;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          margin-bottom: 8px;
          opacity: 0;
          animation: fadeIn 0.2s forwards;
        }
        
        /* Tooltip Arrow */
        .custom-tooltip::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          margin-left: -5px;
          border-width: 5px;
          border-style: solid;
          border-color: #1e293b transparent transparent transparent;
        }

        .react-calendar__tile:hover .custom-tooltip {
          display: block;
          opacity: 1;
        }

        @keyframes fadeIn { from { opacity: 0; transform: translate(-50%, 5px); } to { opacity: 1; transform: translate(-50%, 0); } }

        /* SCROLLBAR */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      `}</style>
    </div>
  );
};

export default AdminHolidayCalendarPage;
// --- END OF FILE AdminHolidayCalendarPage.jsx ---