import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  FaClock,
  FaUserTie,
  FaSave,
  FaSearch,
  FaEdit,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
  FaUsers,
  FaTag,
  FaInfoCircle
} from "react-icons/fa";
import {
  getEmployees,
  getAllShifts,
  createOrUpdateShift,
  deleteShift,
  bulkCreateShifts,
} from "../api";

const DepartmentSettings = () => {
  const { user } = useContext(AuthContext);

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [viewMode, setViewMode] = useState("individual"); // "individual" | "bulk"

  // --- Category System (Session Storage) ---
  const [categories, setCategories] = useState(() => {
    const saved = sessionStorage.getItem("shiftCategories");
    return saved ? JSON.parse(saved) : [
      { id: "day", name: "Day Shift", isDefault: true },
      { id: "night", name: "Night Shift", isDefault: true },
      { id: "nonit", name: "Non-IT", isDefault: true },
    ];
  });
  
  const [selectedCategoryId, setSelectedCategoryId] = useState("all"); 
  const [employeeCategories, setEmployeeCategories] = useState(() => {
    const saved = sessionStorage.getItem("employeeCategories");
    return saved ? JSON.parse(saved) : {};
  });

  // Save categories to SESSION storage whenever they change
  useEffect(() => {
    sessionStorage.setItem("shiftCategories", JSON.stringify(categories));
    sessionStorage.setItem("employeeCategories", JSON.stringify(employeeCategories));
  }, [categories, employeeCategories]);

  // Default Form State 
  // UPDATED: Default Full Day Hours set to 9 manually
  const defaultShift = {
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    lateGracePeriod: 15,
    fullDayHours: 9, // Changed from 8 to 9
    halfDayHours: 4.5, // Changed from 4 to 4.5 (half of 9)
    autoExtendShift: true,
    weeklyOffDays: [0], // Sunday
  };

  const [shiftForm, setShiftForm] = useState(defaultShift);
  const [bulkShiftForm, setBulkShiftForm] = useState(defaultShift);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  // ---------------- Fetch Data ----------------
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeesData, shiftsData] = await Promise.all([
        getEmployees(),
        getAllShifts(),
      ]);

      const empList = Array.isArray(employeesData) ? employeesData : (employeesData?.data || []);
      const shiftList = Array.isArray(shiftsData) ? shiftsData : (shiftsData?.data || []);

      setEmployees(empList);
      setShifts(shiftList);
    } catch (error) {
      console.error("Fetch error:", error);
      showMessage("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Helpers ----------------
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);

    const existingShift = shifts.find(
      (s) => s.employeeId === employee.employeeId
    );

    if (existingShift) {
      setShiftForm({
        shiftStartTime: existingShift.shiftStartTime || "09:00",
        shiftEndTime: existingShift.shiftEndTime || "18:00",
        lateGracePeriod: existingShift.lateGracePeriod ?? 15,
        // Ensure we load existing hours or fallback to new default of 9
        fullDayHours: existingShift.fullDayHours || 9,
        halfDayHours: existingShift.halfDayHours || 4.5,
        autoExtendShift: existingShift.autoExtendShift ?? true,
        weeklyOffDays: existingShift.weeklyOffDays || [0],
      });
    } else {
      setShiftForm(defaultShift);
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setShiftForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleBulkFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBulkShiftForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleWeeklyOffToggle = (day, isBulk = false) => {
    const setter = isBulk ? setBulkShiftForm : setShiftForm;
    setter((prev) => {
      const current = prev.weeklyOffDays || [];
      if (current.includes(day)) {
        return { ...prev, weeklyOffDays: current.filter((d) => d !== day) };
      } else {
        return { ...prev, weeklyOffDays: [...current, day] };
      }
    });
  };

  const handleBulkEmployeeToggle = (employeeId) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleSelectAllEmployees = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((emp) => emp.employeeId));
    }
  };

  // ---------------- Category Logic ----------------
  const handleAddCategory = () => {
    const name = prompt("Enter new category name:");
    if (!name) return;
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString();
    setCategories((prev) => [...prev, { id, name, isDefault: false }]);
  };

  const handleDeleteCategory = (categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category || category.isDefault) return;
    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    setEmployeeCategories((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((empId) => {
        if (updated[empId] === categoryId) updated[empId] = null;
      });
      return updated;
    });

    if (selectedCategoryId === categoryId) setSelectedCategoryId("all");
  };

  const handleAssignCategory = (employeeId, categoryIdOrEmpty) => {
    const categoryId = categoryIdOrEmpty || null;
    setEmployeeCategories((prev) => ({ ...prev, [employeeId]: categoryId }));
  };

  // ---------------- Save Logic ----------------
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) {
      showMessage("error", "Please select an employee first");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employeeId: selectedEmployee.employeeId,
        shiftStartTime: shiftForm.shiftStartTime,
        shiftEndTime: shiftForm.shiftEndTime,
        lateGracePeriod: Number(shiftForm.lateGracePeriod),
        fullDayHours: Number(shiftForm.fullDayHours), // Send manual input
        halfDayHours: Number(shiftForm.halfDayHours), // Send manual input
        autoExtendShift: shiftForm.autoExtendShift,
        weeklyOffDays: shiftForm.weeklyOffDays,
      };
      await createOrUpdateShift(payload);
      showMessage("success", `Shift saved for ${selectedEmployee.name}`);
      await fetchData();
    } catch (error) {
      console.error("Save shift error:", error);
      showMessage("error", error.response?.data?.message || "Failed to save shift");
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSaveShift = async (e) => {
    e.preventDefault();
    if (selectedEmployeeIds.length === 0) {
      showMessage("error", "Please select at least one employee");
      return;
    }
    setSaving(true);
    try {
      const shiftData = {
        shiftStartTime: bulkShiftForm.shiftStartTime,
        shiftEndTime: bulkShiftForm.shiftEndTime,
        lateGracePeriod: Number(bulkShiftForm.lateGracePeriod),
        fullDayHours: Number(bulkShiftForm.fullDayHours), // Send manual input
        halfDayHours: Number(bulkShiftForm.halfDayHours), // Send manual input
        autoExtendShift: bulkShiftForm.autoExtendShift,
        weeklyOffDays: bulkShiftForm.weeklyOffDays,
      };
      await bulkCreateShifts(selectedEmployeeIds, shiftData);
      showMessage("success", `Updated ${selectedEmployeeIds.length} employees`);
      setSelectedEmployeeIds([]);
      await fetchData();
    } catch (error) {
      console.error("Bulk save error:", error);
      showMessage("error", error.response?.data?.message || "Failed to save shifts");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (employeeId) => {
    if (!window.confirm("Reset shift to default?")) return;
    try {
      await deleteShift(employeeId);
      showMessage("success", "Shift reset successfully");
      await fetchData();
      if (selectedEmployee?.employeeId === employeeId) {
        setShiftForm(defaultShift);
      }
    } catch (error) {
      showMessage("error", "Failed to delete shift");
    }
  };

  // ---------------- Filtering ----------------
  const baseFilteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.employeeId?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    );
  });

  const filteredEmployees = baseFilteredEmployees.filter((emp) => {
    const empCat = employeeCategories[emp.employeeId] || null;
    if (selectedCategoryId === "all") return true;
    if (selectedCategoryId === "unassigned") return empCat === null;
    return empCat === selectedCategoryId;
  });

  const weekDays = [
    { value: 0, label: "Sun" }, { value: 1, label: "Mon" }, { value: 2, label: "Tue" },
    { value: 3, label: "Wed" }, { value: 4, label: "Thu" }, { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto font-sans">
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="p-2 bg-blue-100 rounded-lg text-blue-600"><FaClock /></span>
            Shift Management
          </h1>
          <div className="flex items-center gap-2 mt-1">
             <p className="text-gray-600 text-sm">Configure timings in Indian Standard Time (IST)</p>
             <span className="bg-orange-100 text-orange-800 text-[10px] px-2 py-0.5 rounded-full font-bold border border-orange-200">
               🇮🇳 IST Active
             </span>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button onClick={() => setViewMode("individual")} className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${viewMode === "individual" ? "bg-white shadow text-blue-700" : "text-gray-600"}`}><FaUserTie /> Individual</button>
          <button onClick={() => setViewMode("bulk")} className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${viewMode === "bulk" ? "bg-white shadow text-blue-700" : "text-gray-600"}`}><FaUsers /> Bulk</button>
        </div>
      </div>

      {/* ALERTS */}
      {message.text && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.type === "success" ? <FaCheckCircle /> : <FaTimesCircle />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* CATEGORY FILTER */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 text-sm flex gap-2 items-center"><FaTag className="text-blue-500"/> Filter by Category</h3>
          <button onClick={handleAddCategory} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">+ Add Category</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedCategoryId("all")} className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedCategoryId === "all" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>All</button>
          <button onClick={() => setSelectedCategoryId("unassigned")} className={`px-3 py-1 rounded-full text-xs font-semibold border ${selectedCategoryId === "unassigned" ? "bg-blue-600 text-white" : "bg-white text-gray-600"}`}>Unassigned</button>
          {categories.map((cat) => (
            <div key={cat.id} className={`flex items-center px-3 py-1 rounded-full text-xs border ${selectedCategoryId === cat.id ? "bg-indigo-600 text-white" : "bg-white text-gray-600"}`}>
              <button onClick={() => setSelectedCategoryId(cat.id)} className="font-semibold">{cat.name}</button>
              {!cat.isDefault && <button onClick={() => handleDeleteCategory(cat.id)} className="ml-2 text-red-400 hover:text-white">×</button>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: EMPLOYEE LIST */}
        <div className="lg:col-span-5 flex flex-col h-[600px] bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input type="text" placeholder="Search employees..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-between items-center mt-2">
               <p className="text-xs text-gray-500">Showing {filteredEmployees.length} employees</p>
               {viewMode === "bulk" && (
                 <button onClick={handleSelectAllEmployees} className="text-xs text-blue-600 font-bold hover:underline">
                   {selectedEmployeeIds.length === filteredEmployees.length && filteredEmployees.length > 0 ? "Deselect All" : "Select All"}
                 </button>
               )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {filteredEmployees.map((emp) => (
              <div 
                key={emp.employeeId} 
                onClick={() => viewMode === "bulk" ? handleBulkEmployeeToggle(emp.employeeId) : handleEmployeeSelect(emp)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  (viewMode === "individual" && selectedEmployee?.employeeId === emp.employeeId) || (viewMode === "bulk" && selectedEmployeeIds.includes(emp.employeeId))
                    ? "bg-blue-50 border-blue-500" 
                    : "bg-white border-gray-100 hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {viewMode === "bulk" && <input type="checkbox" checked={selectedEmployeeIds.includes(emp.employeeId)} readOnly className="w-4 h-4 text-blue-600 rounded" />}
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                      <p className="text-xs text-gray-500">{emp.employeeId} • {emp.department || "N/A"}</p>
                    </div>
                  </div>
                  <select 
                    value={employeeCategories[emp.employeeId] || ""} 
                    onClick={(e) => e.stopPropagation()} 
                    onChange={(e) => handleAssignCategory(emp.employeeId, e.target.value)} 
                    className="text-[10px] border border-gray-200 rounded bg-gray-50 px-1 py-0.5"
                  >
                    <option value="">Unassigned</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            ))}
            {filteredEmployees.length === 0 && <div className="text-center text-gray-400 text-sm mt-10">No employees found.</div>}
          </div>
        </div>

        {/* RIGHT COLUMN: FORM */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          {viewMode === "individual" ? (
            selectedEmployee ? (
              <form onSubmit={handleSaveShift} className="h-full flex flex-col">
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-800">Edit Shift (IST)</h2>
                  <p className="text-sm text-gray-600">For <span className="font-semibold text-blue-600">{selectedEmployee.name}</span> ({selectedEmployee.employeeId})</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Start Time (IST)</label>
                    <input type="time" name="shiftStartTime" value={shiftForm.shiftStartTime} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">End Time (IST)</label>
                    <input type="time" name="shiftEndTime" value={shiftForm.shiftEndTime} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  
                  {/* --- UPDATED SECTION: Manual Work Hours --- */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Full Day Work Hours</label>
                    <input type="number" step="0.5" name="fullDayHours" value={shiftForm.fullDayHours} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Half Day Work Hours</label>
                    <input type="number" step="0.5" name="halfDayHours" value={shiftForm.halfDayHours} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  {/* ------------------------------------------ */}

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Grace (Mins)</label>
                    <input type="number" name="lateGracePeriod" value={shiftForm.lateGracePeriod} onChange={handleFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                     <label className="flex items-center gap-2 text-sm mt-6 cursor-pointer">
                        <input type="checkbox" name="autoExtendShift" checked={shiftForm.autoExtendShift} onChange={handleFormChange} className="w-4 h-4 text-blue-600"/>
                        Auto-extend shift if late
                     </label>
                  </div>
                </div>
                
                <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded flex items-center gap-2">
                   <FaInfoCircle className="text-blue-500" />
                   Timings entered here are treated as Indian Standard Time by the server. Work hours are manual.
                </div>

                <div className="mt-4">
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-2">Weekly Offs</label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((d) => (
                      <button key={d.value} type="button" onClick={() => handleWeeklyOffToggle(d.value)} className={`px-3 py-1 rounded text-xs font-bold ${shiftForm.weeklyOffDays.includes(d.value) ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600"}`}>{d.label}</button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 flex justify-center items-center gap-2">
                    {saving ? "Saving..." : <><FaSave /> Save Shift</>}
                  </button>
                  {shifts.some(s => s.employeeId === selectedEmployee.employeeId) && (
                    <button type="button" onClick={() => handleDeleteShift(selectedEmployee.employeeId)} className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200"><FaTrash /></button>
                  )}
                </div>
              </form>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <FaUserTie className="text-5xl mb-3 opacity-20" />
                <p>Select an employee to configure shift</p>
              </div>
            )
          ) : (
            <form onSubmit={handleBulkSaveShift} className="h-full flex flex-col">
              <div className="mb-4 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">Bulk Shift Update (IST)</h2>
                <p className="text-sm text-gray-600">Applying to <span className="font-bold text-blue-600">{selectedEmployeeIds.length}</span> employees</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Start Time (IST)</label>
                    <input type="time" name="shiftStartTime" value={bulkShiftForm.shiftStartTime} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">End Time (IST)</label>
                    <input type="time" name="shiftEndTime" value={bulkShiftForm.shiftEndTime} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>

                  {/* --- UPDATED SECTION: Manual Work Hours (Bulk) --- */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Full Day Work Hours</label>
                    <input type="number" step="0.5" name="fullDayHours" value={bulkShiftForm.fullDayHours} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Half Day Work Hours</label>
                    <input type="number" step="0.5" name="halfDayHours" value={bulkShiftForm.halfDayHours} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
                  {/* ----------------------------------------------- */}

                  <div>
                    <label className="text-xs font-bold text-gray-700 uppercase">Grace (Mins)</label>
                    <input type="number" name="lateGracePeriod" value={bulkShiftForm.lateGracePeriod} onChange={handleBulkFormChange} className="w-full mt-1 p-2 border rounded-md" required />
                  </div>
              </div>
              
              <div className="mt-2 text-xs text-gray-500 bg-gray-50 p-2 rounded flex items-center gap-2">
                   <FaInfoCircle className="text-blue-500" />
                   Timings entered here are treated as Indian Standard Time by the server. Work hours are manual.
              </div>

              <div className="mt-4">
                  <label className="text-xs font-bold text-gray-700 uppercase block mb-2">Weekly Offs</label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((d) => (
                      <button key={d.value} type="button" onClick={() => handleWeeklyOffToggle(d.value, true)} className={`px-3 py-1 rounded text-xs font-bold ${bulkShiftForm.weeklyOffDays.includes(d.value) ? "bg-red-500 text-white" : "bg-gray-200 text-gray-600"}`}>{d.label}</button>
                    ))}
                  </div>
              </div>
              
              <div className="mt-auto pt-6">
                <button type="submit" disabled={saving || selectedEmployeeIds.length === 0} className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50">
                   {saving ? "Processing..." : `Apply to ${selectedEmployeeIds.length} Employees`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepartmentSettings;