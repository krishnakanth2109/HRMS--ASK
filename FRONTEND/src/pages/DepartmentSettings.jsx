// --- START OF FILE DepartmentSettings.jsx ---
import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  FaClock,
  FaUserTie,
  FaSave,
  FaSearch,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
  FaUsers,
  FaTag,
  FaInfoCircle,
} from "react-icons/fa";

import {
  getEmployees,
  getAllShifts,
  createOrUpdateShift,
  deleteShift,
  bulkCreateShifts,
  getCategories,
  addCategory,
  deleteCategoryApi,
  updateEmployeeCategory,
} from "../api";

const DepartmentSettings = () => {
  const { user } = useContext(AuthContext);

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [employeeCategories, setEmployeeCategories] = useState({});

  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");

  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("individual");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  // ❗ BLANK SHIFT FORM – no defaults
  const emptyShift = {
    shiftStartTime: "",
    shiftEndTime: "",
    lateGracePeriod: "",
    fullDayHours: "",
    halfDayHours: "",
    autoExtendShift: false,
    weeklyOffDays: [],
  };

  const [shiftForm, setShiftForm] = useState(emptyShift);
  const [bulkShiftForm, setBulkShiftForm] = useState(emptyShift);

  const weekDays = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  // ---------------- FETCH DATA ----------------
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeesRes, shiftsRes, categoriesRes] = await Promise.all([
        getEmployees(),
        getAllShifts(),
        getCategories(),
      ]);

      const empList = Array.isArray(employeesRes)
        ? employeesRes
        : employeesRes?.data || employeesRes;
      const shiftList = Array.isArray(shiftsRes)
        ? shiftsRes
        : shiftsRes?.data || shiftsRes;
      const catList = Array.isArray(categoriesRes)
        ? categoriesRes
        : categoriesRes?.data || categoriesRes;

      setEmployees(empList);
      setShifts(shiftList);
      setCategories(catList);

      // Map employeeId -> categoryId
      const catMap = {};
      shiftList.forEach((s) => {
        if (s.category) {
          catMap[s.employeeId] = s.category;
        }
      });
      setEmployeeCategories(catMap);
    } catch (err) {
      console.error("Fetch error:", err);
      showMessage("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- HELPERS ----------------
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 4000);
  };

  // ---------------- SELECT EMPLOYEE ----------------
  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);

    const existingShift = shifts.find(
      (s) => s.employeeId === employee.employeeId
    );

    if (existingShift) {
      setShiftForm({
        shiftStartTime: existingShift.shiftStartTime || "",
        shiftEndTime: existingShift.shiftEndTime || "",
        lateGracePeriod: existingShift.lateGracePeriod ?? "",
        fullDayHours: existingShift.fullDayHours || "",
        halfDayHours: existingShift.halfDayHours || "",
        autoExtendShift: existingShift.autoExtendShift ?? false,
        weeklyOffDays: existingShift.weeklyOffDays || [],
      });
    } else {
      // No shift → empty form
      setShiftForm(emptyShift);
    }
  };

  const handleBulkEmployeeToggle = (employeeId) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAllEmployees = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((e) => e.employeeId));
    }
  };

  // ---------------- FORM HANDLERS ----------------
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
      const existing = prev.weeklyOffDays || [];
      if (existing.includes(day)) {
        return { ...prev, weeklyOffDays: existing.filter((d) => d !== day) };
      } else {
        return { ...prev, weeklyOffDays: [...existing, day] };
      }
    });
  };

  // ---------------- CATEGORY LOGIC ----------------
  const handleAddCategory = async () => {
    const name = prompt("Enter new category name:");
    if (!name) return;

    const id = `${name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`;

    try {
      await addCategory(id, name);
      await fetchData();
      showMessage("success", "Category added");
    } catch (err) {
      console.error("Add category error:", err);
      showMessage("error", "Failed to add category");
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    try {
      await deleteCategoryApi(categoryId);

      setEmployeeCategories((prev) => {
        const updated = {};
        for (const empId in prev) {
          updated[empId] = prev[empId] === categoryId ? null : prev[empId];
        }
        return updated;
      });

      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId("all");
      }

      await fetchData();
      showMessage("success", "Category deleted");
    } catch (err) {
      console.error("Delete category error:", err);
      showMessage("error", "Failed to delete category");
    }
  };

  const handleAssignCategory = async (employeeId, catId) => {
    const categoryId = catId || null;

    setEmployeeCategories((prev) => ({ ...prev, [employeeId]: categoryId }));

    try {
      await updateEmployeeCategory(employeeId, categoryId);
      showMessage("success", "Category updated");
    } catch (err) {
      console.error("Update category error:", err);
      showMessage("error", "Failed to update category");
    }
  };

  // ---------------- SAVE SHIFT (INDIVIDUAL) ----------------
  const handleSaveShift = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) {
      showMessage("error", "Select an employee first");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employeeId: selectedEmployee.employeeId,
        shiftStartTime: shiftForm.shiftStartTime,
        shiftEndTime: shiftForm.shiftEndTime,
        lateGracePeriod: Number(shiftForm.lateGracePeriod),
        fullDayHours: Number(shiftForm.fullDayHours),
        halfDayHours: Number(shiftForm.halfDayHours),
        autoExtendShift: shiftForm.autoExtendShift,
        weeklyOffDays: shiftForm.weeklyOffDays,
        category: employeeCategories[selectedEmployee.employeeId] || null,
      };

      await createOrUpdateShift(payload);
      showMessage("success", `Shift saved for ${selectedEmployee.name}`);
      await fetchData();
    } catch (err) {
      console.error("Save shift error:", err);
      showMessage("error", "Failed to save shift");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- SAVE SHIFT (BULK) ----------------
  const handleBulkSaveShift = async (e) => {
    e.preventDefault();
    if (selectedEmployeeIds.length === 0) {
      showMessage("error", "Select at least one employee");
      return;
    }

    setSaving(true);
    try {
      const shiftData = {
        shiftStartTime: bulkShiftForm.shiftStartTime,
        shiftEndTime: bulkShiftForm.shiftEndTime,
        lateGracePeriod: Number(bulkShiftForm.lateGracePeriod),
        fullDayHours: Number(bulkShiftForm.fullDayHours),
        halfDayHours: Number(bulkShiftForm.halfDayHours),
        autoExtendShift: bulkShiftForm.autoExtendShift,
        weeklyOffDays: bulkShiftForm.weeklyOffDays,
      };

      await bulkCreateShifts(
        selectedEmployeeIds,
        shiftData,
        selectedCategoryId !== "all" && selectedCategoryId !== "unassigned"
          ? selectedCategoryId
          : null
      );

      showMessage("success", "Bulk shift update completed");
      setSelectedEmployeeIds([]);
      await fetchData();
    } catch (err) {
      console.error("Bulk save error:", err);
      showMessage("error", "Failed to update shifts");
    } finally {
      setSaving(false);
    }
  };

  // ---------------- DELETE SHIFT ----------------
  const handleDeleteShift = async (employeeId) => {
    if (!window.confirm("Reset shift to empty?")) return;

    try {
      await deleteShift(employeeId);
      showMessage("success", "Shift reset");
      await fetchData();

      if (selectedEmployee?.employeeId === employeeId) {
        setShiftForm(emptyShift);
      }
    } catch (err) {
      console.error("Delete shift error:", err);
      showMessage("error", "Failed to delete shift");
    }
  };

  // ---------------- FILTER EMPLOYEES ----------------
  const baseFilteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.employeeId?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    );
  });

  const filteredEmployees = baseFilteredEmployees.filter((emp) => {
    const cat = employeeCategories[emp.employeeId] || null;
    if (selectedCategoryId === "all") return true;
    if (selectedCategoryId === "unassigned") return cat === null;
    return cat === selectedCategoryId;
  });

  // ---------------- LOADING UI ----------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ---------------- RENDER ----------------
  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto font-sans">
      {/* HEADER */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <FaClock />
            </span>
            Shift Management
          </h1>
          <div className="flex gap-2 items-center mt-1 text-sm text-gray-600">
            <p>Configure timings manually</p>
          </div>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setViewMode("individual")}
            className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${
              viewMode === "individual"
                ? "bg-white shadow text-blue-700"
                : "text-gray-600"
            }`}
          >
            <FaUserTie /> Individual
          </button>
          <button
            onClick={() => setViewMode("bulk")}
            className={`px-4 py-2 rounded-md text-sm font-semibold flex items-center gap-2 ${
              viewMode === "bulk"
                ? "bg-white shadow text-blue-700"
                : "text-gray-600"
            }`}
          >
            <FaUsers /> Bulk
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {message.text && (
        <div
          className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.type === "success" ? <FaCheckCircle /> : <FaTimesCircle />}
          <span className="text-sm font-medium">{message.text}</span>
        </div>
      )}

      {/* CATEGORY SELECTOR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 text-sm flex gap-2 items-center">
            <FaTag className="text-blue-500" /> Filter by Category
          </h3>
          <button
            onClick={handleAddCategory}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            + Add Category
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategoryId("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              selectedCategoryId === "all"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600"
            }`}
          >
            All
          </button>

          <button
            onClick={() => setSelectedCategoryId("unassigned")}
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              selectedCategoryId === "unassigned"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600"
            }`}
          >
            Unassigned
          </button>

          {categories.map((cat) => (
            <div
              key={cat.id || cat._id}
              className={`flex items-center px-3 py-1 rounded-full text-xs border ${
                selectedCategoryId === cat.id
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-600"
              }`}
            >
              <button
                onClick={() => setSelectedCategoryId(cat.id)}
                className="font-semibold"
              >
                {cat.name}
              </button>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className="ml-2 text-red-400 hover:text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: EMPLOYEE LIST */}
        <div className="lg:col-span-5 flex flex-col h-[600px] bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <div className="relative">
              <FaSearch className="absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-between items-center mt-2">
              <p className="text-xs text-gray-500">
                Showing {filteredEmployees.length} employees
              </p>

              {viewMode === "bulk" && (
                <button
                  onClick={handleSelectAllEmployees}
                  className="text-xs text-blue-600 font-bold hover:underline"
                >
                  {selectedEmployeeIds.length === filteredEmployees.length &&
                  filteredEmployees.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </button>
              )}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {filteredEmployees.map((emp) => (
              <div
                key={emp.employeeId}
                onClick={() =>
                  viewMode === "bulk"
                    ? handleBulkEmployeeToggle(emp.employeeId)
                    : handleEmployeeSelect(emp)
                }
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  (viewMode === "individual" &&
                    selectedEmployee?.employeeId === emp.employeeId) ||
                  (viewMode === "bulk" &&
                    selectedEmployeeIds.includes(emp.employeeId))
                    ? "bg-blue-50 border-blue-500"
                    : "bg-white border-gray-100 hover:bg-gray-50"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {viewMode === "bulk" && (
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.employeeId)}
                        readOnly
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    )}
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {emp.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {emp.employeeId} • {emp.department || "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* CATEGORY DROPDOWN */}
                  <select
                    value={employeeCategories[emp.employeeId] || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      handleAssignCategory(emp.employeeId, e.target.value)
                    }
                    className="text-[10px] border rounded bg-gray-50 px-1 py-0.5"
                  >
                    <option value="">Unassigned</option>
                    {categories.map((c) => (
                      <option key={c.id || c._id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}

            {filteredEmployees.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-10">
                No employees found.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: SHIFT FORM */}
        <div className="lg:col-span-7 bg-white p-6 rounded-xl border shadow-sm">
          {viewMode === "individual" ? (
            selectedEmployee ? (
              <form onSubmit={handleSaveShift} className="h-full flex flex-col">
                <div className="mb-4 pb-4 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-800">
                    Edit Shift (Manual)
                  </h2>
                  <p className="text-sm text-gray-600">
                    For{" "}
                    <span className="font-semibold text-blue-600">
                      {selectedEmployee.name}
                    </span>{" "}
                    ({selectedEmployee.employeeId})
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase">
                      Start Time
                    </label>
                    <input
                      type="time"
                      name="shiftStartTime"
                      value={shiftForm.shiftStartTime}
                      onChange={handleFormChange}
                      className="w-full mt-1 p-2 border rounded-md"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase">
                      End Time
                    </label>
                    <input
                      type="time"
                      name="shiftEndTime"
                      value={shiftForm.shiftEndTime}
                      onChange={handleFormChange}
                      className="w-full mt-1 p-2 border rounded-md"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase">
                      Grace Minutes
                    </label>
                    <input
                      type="number"
                      name="lateGracePeriod"
                      value={shiftForm.lateGracePeriod}
                      onChange={handleFormChange}
                      className="w-full mt-1 p-2 border rounded-md"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase">
                      Full Day Hours
                    </label>
                    <input
                      type="number"
                      name="fullDayHours"
                      value={shiftForm.fullDayHours}
                      onChange={handleFormChange}
                      className="w-full mt-1 p-2 border rounded-md"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold uppercase">
                      Half Day Hours
                    </label>
                    <input
                      type="number"
                      name="halfDayHours"
                      value={shiftForm.halfDayHours}
                      onChange={handleFormChange}
                      className="w-full mt-1 p-2 border rounded-md"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      name="autoExtendShift"
                      checked={shiftForm.autoExtendShift}
                      onChange={handleFormChange}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label className="text-sm">Auto Extend Shift</label>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-xs font-bold uppercase block mb-2">
                    Weekly Offs
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => handleWeeklyOffToggle(d.value)}
                        className={`px-3 py-1 rounded text-xs font-bold ${
                          shiftForm.weeklyOffDays.includes(d.value)
                            ? "bg-red-500 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 flex justify-center items-center gap-2"
                  >
                    {saving ? "Saving..." : <><FaSave /> Save Shift</>}
                  </button>

                  {shifts.some(
                    (s) => s.employeeId === selectedEmployee.employeeId
                  ) && (
                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteShift(selectedEmployee.employeeId)
                      }
                      className="bg-red-100 text-red-600 px-4 py-2 rounded-lg hover:bg-red-200"
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <FaUserTie className="text-5xl mb-3 opacity-20" />
                <p>Select an employee to configure shift</p>
              </div>
            )
          ) : (
            <form onSubmit={handleBulkSaveShift} className="h-full flex flex-col">
              <div className="mb-4 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">
                  Bulk Shift Update (Manual)
                </h2>
                <p className="text-sm text-gray-600">
                  Applying to{" "}
                  <span className="font-bold text-blue-600">
                    {selectedEmployeeIds.length}
                  </span>{" "}
                  employees
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase">
                    Start Time
                  </label>
                  <input
                    type="time"
                    name="shiftStartTime"
                    value={bulkShiftForm.shiftStartTime}
                    onChange={handleBulkFormChange}
                    className="w-full mt-1 p-2 border rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase">
                    End Time
                  </label>
                  <input
                    type="time"
                    name="shiftEndTime"
                    value={bulkShiftForm.shiftEndTime}
                    onChange={handleBulkFormChange}
                    className="w-full mt-1 p-2 border rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase">
                    Grace Minutes
                  </label>
                  <input
                    type="number"
                    name="lateGracePeriod"
                    value={bulkShiftForm.lateGracePeriod}
                    onChange={handleBulkFormChange}
                    className="w-full mt-1 p-2 border rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase">
                    Full Day Hours
                  </label>
                  <input
                    type="number"
                    name="fullDayHours"
                    value={bulkShiftForm.fullDayHours}
                    onChange={handleBulkFormChange}
                    className="w-full mt-1 p-2 border rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase">
                    Half Day Hours
                  </label>
                  <input
                    type="number"
                    name="halfDayHours"
                    value={bulkShiftForm.halfDayHours}
                    onChange={handleBulkFormChange}
                    className="w-full mt-1 p-2 border rounded-md"
                    required
                  />
                </div>

                <div className="flex items-center gap-2 mt-6">
                  <input
                    type="checkbox"
                    name="autoExtendShift"
                    checked={bulkShiftForm.autoExtendShift}
                    onChange={handleBulkFormChange}
                    className="w-4 h-4 text-blue-600"
                  />
                  <label className="text-sm">Auto Extend Shift</label>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs font-bold uppercase block mb-2">
                  Weekly Offs
                </label>
                <div className="flex flex-wrap gap-2">
                  {weekDays.map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => handleWeeklyOffToggle(d.value, true)}
                      className={`px-3 py-1 rounded text-xs font-bold ${
                        bulkShiftForm.weeklyOffDays.includes(d.value)
                          ? "bg-red-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-auto pt-6">
                <button
                  type="submit"
                  disabled={saving || selectedEmployeeIds.length === 0}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? "Processing..."
                    : `Apply to ${selectedEmployeeIds.length} Employees`}
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

// --- END OF FILE DepartmentSettings.jsx ---
