import React, { useContext, useState, useRef } from "react";
import { HolidayCalendarContext } from "../context/HolidayCalendarContext";
import { FaPlus, FaEdit, FaTrash, FaFilter, FaFileImport } from "react-icons/fa";
import * as XLSX from "xlsx";

const AdminHolidayCalendarPage = () => {
  const { holidays, addHoliday, editHoliday, deleteHoliday, setAllHolidays } = useContext(HolidayCalendarContext);

  // Default filter: current month and year
  const now = new Date();
  const defaultMonth = String(now.getMonth() + 1).padStart(2, "0");
  const defaultYear = String(now.getFullYear());

  const [form, setForm] = useState({ name: "", date: "", description: "" });
  const [editingId, setEditingId] = useState(null);

  // Filter state
  const [filterMonth, setFilterMonth] = useState(defaultMonth);
  const [filterYear, setFilterYear] = useState(defaultYear);
  const [searchTerm, setSearchTerm] = useState("");
  const [importing, setImporting] = useState(false);

  // Modal state for import guidance
  const [showImportModal, setShowImportModal] = useState(false);
  const fileInputRef = useRef(null);

  // Get filtered holidays, sorted by date ascending
  const filteredHolidays = holidays
    .filter(h => (filterMonth ? h.date.startsWith(`${filterYear}-${filterMonth}`) : h.date.startsWith(filterYear)))
    .filter(h => h.name.toLowerCase().includes(searchTerm.toLowerCase()) || h.description?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => a.date.localeCompare(b.date));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.date) return;
    if (editingId) {
      editHoliday(editingId, form);
      setEditingId(null);
    } else {
      addHoliday(form);
    }
    setForm({ name: "", date: "", description: "" });
  };

  const handleEdit = (holiday) => {
    setForm({ name: holiday.name, date: holiday.date, description: holiday.description });
    setEditingId(holiday.id);
  };

  const handleCancel = () => {
    setForm({ name: "", date: "", description: "" });
    setEditingId(null);
  };

  // Excel import handler
  const handleExcelImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Validate header row
      const headerRow = rows[0] || [];
      const expectedHeaders = ["Name", "Date", "Description"];
      const headerValid = expectedHeaders.every((col, idx) =>
        headerRow[idx] && headerRow[idx].toString().trim().toLowerCase() === col.toLowerCase()
      );
      if (!headerValid) {
        console.error("Excel import failed: Invalid header row. Expected columns: Name, Date, Description.");
        setImporting(false);
        e.target.value = "";
        return;
      }

      // Collect valid holidays
      const importedHolidays = [];
      rows.slice(1).forEach((row, i) => {
        if (row[0] && row[1]) {
          importedHolidays.push({
            id: Date.now() + i, // Unique id
            name: row[0],
            date: row[1],
            description: row[2] || ""
          });
        }
      });

      setAllHolidays(importedHolidays);
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // Month options for dropdown
  const monthOptions = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

  // Year options for dropdown (current year +/- 2)
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(String);

  // Show modal instead of file dialog
  const handleImportClick = () => {
    setShowImportModal(true);
  };

  const handleProceedImport = () => {
    setShowImportModal(false);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleCancelImport = () => {
    setShowImportModal(false);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-blue-800 flex items-center gap-3">
          <FaPlus className="text-blue-400" /> Holiday Calendar Management
        </h2>
        <button
          type="button"
          className="flex items-center gap-2 cursor-pointer bg-blue-100 hover:bg-blue-200 px-4 py-2 rounded-lg shadow font-semibold text-blue-700 transition"
          onClick={handleImportClick}
          disabled={importing}
        >
          <FaFileImport className="text-xl" />
          <span>Import Excel</span>
        </button>
        {/* Hidden file input for actual import */}
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          ref={fileInputRef}
          onChange={handleExcelImport}
          disabled={importing}
        />
      </div>

      {/* Import Guidance Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full border border-blue-200">
            <h3 className="text-2xl font-bold text-blue-700 mb-4 flex items-center gap-2">
              <FaFileImport className="text-blue-400" /> Import Holidays from Excel
            </h3>
            <div className="mb-4 text-gray-700">
              <p className="mb-2">
                <span className="font-semibold text-red-600">Warning:</span> This process will <span className="font-bold">replace all existing holiday data</span> with the contents of your Excel file.
              </p>
              <p className="mb-2">
                Please ensure your Excel file has the following column headers in the <span className="font-semibold">first row</span>:
              </p>
              <ul className="list-disc pl-6 mb-2">
                <li><span className="font-mono text-blue-700">Name</span></li>
                <li><span className="font-mono text-blue-700">Date</span> <span className="text-gray-500">(YYYY-MM-DD)</span></li>
                <li><span className="font-mono text-blue-700">Description</span></li>
              </ul>
              <p className="mb-2">
                <span className="font-semibold">Example:</span>
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-sm font-mono mb-2">
                Name | Date | Description<br />
                New Year's Day | 2025-01-01 | First day of the year
              </div>
            </div>
            <div className="flex gap-4 justify-end mt-6">
              <button
                className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition font-semibold shadow"
                onClick={handleProceedImport}
                disabled={importing}
              >
                Proceed with Import
              </button>
              <button
                className="bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-gray-500 transition font-semibold shadow"
                onClick={handleCancelImport}
                disabled={importing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 mb-10 flex flex-col gap-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-6">
          <input
            type="text"
            placeholder="Holiday Name"
            className="border rounded-lg px-4 py-3 flex-1 text-lg focus:ring-2 focus:ring-blue-200"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="date"
            className="border rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-200"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            required
          />
        </div>
        <textarea
          placeholder="Description (optional)"
          className="border rounded-lg px-4 py-3 text-lg focus:ring-2 focus:ring-blue-200"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div className="flex gap-4">
          <button
            type="submit"
            className="bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-800 transition font-semibold shadow"
          >
            {editingId ? "Update Holiday" : "Add Holiday"}
          </button>
          {editingId && (
            <button
              type="button"
              className="bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-gray-500 transition font-semibold shadow"
              onClick={handleCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-6 items-center mb-6">
          <div className="flex items-center gap-3">
            <FaFilter className="text-blue-500" />
            <select
              value={filterYear}
              onChange={e => setFilterYear(e.target.value)}
              className="border rounded-lg px-3 py-2 text-gray-700 font-semibold focus:ring-2 focus:ring-blue-200"
            >
              {yearOptions.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="border rounded-lg px-3 py-2 text-gray-700 font-semibold focus:ring-2 focus:ring-blue-200"
            >
              <option value="">All Months</option>
              {monthOptions.map(m => (
                <option key={m} value={m}>
                  {new Date(`${currentYear}-${m}-01`).toLocaleString("default", { month: "long" })}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Search by name or description"
            className="border rounded-lg px-3 py-2 flex-1 text-lg focus:ring-2 focus:ring-blue-200"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <h3 className="text-xl font-semibold mb-4 text-blue-700">Holiday List</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border border-gray-200 rounded-xl shadow-sm bg-white">
            <thead>
              <tr className="bg-blue-50 text-blue-900">
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Description</th>
                <th className="py-3 px-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHolidays.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-gray-400 text-lg">
                    No holidays found.
                  </td>
                </tr>
              )}
              {filteredHolidays.map((holiday) => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const isFuture = holiday.date > todayStr;
                return (
                  <tr key={holiday.id} className="border-b last:border-b-0 hover:bg-blue-50 transition">
                    <td className="py-3 px-4 font-medium text-lg">{holiday.name}</td>
                    <td className="py-3 px-4 text-base">{holiday.date}</td>
                    <td className="py-3 px-4 text-base">{holiday.description}</td>
                    <td className="py-3 px-4 flex gap-2">
                      {isFuture && (
                        <>
                          <button
                            className="text-blue-600 hover:text-blue-800 bg-blue-100 rounded-full p-2 transition"
                            onClick={() => handleEdit(holiday)}
                            title="Edit"
                          >
                            <FaEdit />
                          </button>
                          <button
                            className="text-red-600 hover:text-red-800 bg-red-100 rounded-full p-2 transition"
                            onClick={() => deleteHoliday(holiday.id)}
                            title="Delete"
                          >
                            <FaTrash />
                          </button>
                        </>
                      )}
                      {!isFuture && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminHolidayCalendarPage;