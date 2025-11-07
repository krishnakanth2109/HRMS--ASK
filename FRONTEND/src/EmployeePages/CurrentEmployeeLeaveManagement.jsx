import React, { useContext, useState } from "react";
import { CurrentEmployeeLeaveRequestContext } from "../EmployeeContext/CurrentEmployeeLeaveRequestContext";

const formatMonth = (monthStr) => {
  const [year, month] = monthStr.split("-");
  return `${new Date(year, month - 1).toLocaleString("default", {
    month: "long",
  })} ${year}`;
};


const playRequestSound = () => {
  const audio = new Audio("/sounds/request-button.mp3");
  audio.play();
};


const CurrentEmployeeLeaveManagement = () => {
  const {
    monthOptions = [],
    selectedMonth,
    setSelectedMonth,
    statusOptions = [],
    selectedStatus,
    setSelectedStatus,
    filteredRequests,
    applyLeave,
    sandwichLeaves = [],
    fetchLeaveDetails, // <-- new
  } = useContext(CurrentEmployeeLeaveRequestContext);

  // Leave form state
  const [form, setForm] = useState({ from: "", to: "", reason: "", halfDaySession: "", leaveType: "" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const REASON_LIMIT = 50;

  // NEW: per-leave details & expanded state
  const [expandedId, setExpandedId] = useState(null); // currently expanded leave id (null = none). For multi-expand use a Set instead.
  const [detailsMap, setDetailsMap] = useState({}); // { [leaveId]: [ per-day entries ] }
  const [loadingDetails, setLoadingDetails] = useState({}); // { [leaveId]: boolean }
  const [detailsError, setDetailsError] = useState({}); // { [leaveId]: string|null }

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "reason" ? value.slice(0, REASON_LIMIT) : value,
    }));
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { from, to, reason, halfDaySession, leaveType } = form;

    if (!from || !to || !reason || !leaveType) {
      setError("All fields are required");
      return;
    }

    try {
      await applyLeave({
        from,
        to,
        reason,
        leaveType,
        leaveDayType: from === to && halfDaySession ? "Half Day" : "Full Day",
        halfDaySession: from === to ? halfDaySession || null : null,
      });

      playRequestSound();

      // ✅ Only reset AFTER applyLeave updates table
      setSuccess("Leave request submitted successfully!");
      setForm({ from: "", to: "", reason: "", halfDaySession: "", leaveType: "" });
    } catch (err) {
      setError("Failed to submit leave request");
    }
  };

  // NEW: toggle details for a leave row
  const toggleDetails = async (leaveId) => {
    if (expandedId === leaveId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(leaveId);

    // if already have details, don't re-fetch
    if (detailsMap[leaveId]) return;

    setLoadingDetails((s) => ({ ...s, [leaveId]: true }));
    setDetailsError((s) => ({ ...s, [leaveId]: null }));

    try {
      const details = await fetchLeaveDetails(leaveId);
      // Normalize: make sure it's an array of {id, date, leavecategory}
      const normalized = Array.isArray(details)
        ? details.map((d, idx) => ({
            id: d.id ?? idx,
            date: d.date,
            leavecategory: d.leavecategory ?? d.leaveCategory ?? d.category ?? "UnPaid",
            leaveType: d.leaveType ?? null,
            leaveDayType: d.leaveDayType ?? null,
          }))
        : [];
      setDetailsMap((s) => ({ ...s, [leaveId]: normalized }));
    } catch (err) {
      // The provider should fallback to its dummy, but handle defensive UI errors as well
      setDetailsError((s) => ({ ...s, [leaveId]: "Failed to load details" }));
      setDetailsMap((s) => ({ ...s, [leaveId]: [] }));
    } finally {
      setLoadingDetails((s) => ({ ...s, [leaveId]: false }));
    }
  };

  return (
    <>
      {/* Header & New Leave button */}
      <div className="flex items-center mb-[25px]">
        <h2 className="text-3xl font-bold text-blue-800 flex-1">Leave Request</h2>
        <button
          className={`ml-4 bg-blue-700 hover:bg-blue-900 text-white font-semibold px-6 py-2 rounded-lg shadow transition ${
            showForm ? "bg-blue-900" : ""
          }`}
          onClick={() => {
            if (!showForm) {
              setForm({ from: "", to: "", reason: "", halfDaySession: "", leaveType: "" });
              setError("");
              setSuccess("");
            }
            setShowForm((v) => !v);
          }}
        >
          {showForm ? "Cancel" : "Leave Request"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="mr-2 font-medium text-blue-800">Month:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-blue-300 rounded px-3 py-2 bg-white focus:outline-blue-500"
          >
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonth(month)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mr-2 font-medium text-blue-800">Status:</label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-blue-300 rounded px-3 py-2 bg-white focus:outline-blue-500"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Apply Leave Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 bg-white rounded-lg shadow-md p-6 flex flex-col gap-4 border border-blue-100 max-w-xl"
        >
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block mb-1 font-medium text-blue-800">From Date</label>
              <input
                type="date"
                name="from"
                value={form.from}
                onChange={handleChange}
                className="w-full border border-blue-300 rounded px-3 py-2 focus:outline-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1 font-medium text-blue-800">To Date</label>
              <input
                type="date"
                name="to"
                value={form.to}
                onChange={handleChange}
                className="w-full border border-blue-300 rounded px-3 py-2 focus:outline-blue-500"
              />
            </div>

            {/* Half Day Option only if same date */}
            {form.from && form.to && form.from === form.to && (
              <div className="flex-1">
                <label className="block mb-1 font-medium text-blue-800">Half Day</label>
                <select
                  name="halfDaySession"
                  value={form.halfDaySession}
                  onChange={handleChange}
                  className="w-full border border-blue-300 rounded px-3 py-2 focus:outline-blue-500"
                >
                  <option value="">-- Select --</option>
                  <option value="Morning Half">Morning</option>
                  <option value="Afternoon Half">Afternoon</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block mb-1 font-medium text-blue-800">Reason</label>
            <input
              type="text"
              name="reason"
              value={form.reason}
              onChange={handleChange}
              maxLength={REASON_LIMIT}
              className="w-full border border-blue-300 rounded px-3 py-2 focus:outline-blue-500"
              placeholder="Enter reason for leave"
            />
            <p>
              {form.reason.length}/{REASON_LIMIT}
            </p>
            <div
              className={`mt-1 text-xs ${form.reason.length >= REASON_LIMIT ? "text-red-600" : "text-gray-500"}`}
            >
              {form.reason.length}/{REASON_LIMIT}
            </div>
          </div>

          <div>
            <label className="block mb-1 font-medium text-blue-800">Leave Type</label>
            <select
              name="leaveType"
              value={form.leaveType || ""}
              onChange={handleChange}
              className="w-full border border-blue-300 rounded px-3 py-2 focus:outline-blue-500"
            >
              <option value="">-- Select Leave Type --</option>
              <option value="CASUAL">Casual Leave</option>
              <option value="SICK">Sick Leave</option>
              <option value="EMERGENCY">Emergency Leave</option>
            </select>
          </div>

          {error && <div className="text-red-600 font-semibold">{error}</div>}
          {success && <div className="text-green-600 font-semibold">{success}</div>}
          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-green-600 hover:bg-green-800 text-white font-semibold px-6 py-2 rounded-lg shadow transition"
            >
              Submit
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-gray-500 hover:bg-gray-700 text-white font-semibold px-6 py-2 rounded-lg shadow transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Leave Requests Table */}
      <div className="mb-10 overflow-x-auto">
        <table className="min-w-full table-fixed bg-white rounded shadow border border-blue-100">
          <thead className="bg-blue-100">
            <tr>
              <th className="px-4 py-2 text-left text-blue-900 w-[12%]">From Date</th>
              <th className="px-4 py-2 text-left text-blue-900 w-[12%]">To Date</th>
              <th className="px-4 py-2 text-left text-blue-900 w-[12%]">Leave Day Type</th>
              <th className="px-4 py-2 text-left text-blue-900 w-[12%]">halfDaySession</th>
              <th className="px-4 py-2 text-left text-blue-900 w-[12%]">leaveType</th>
              <th className="px-4 py-2 text-left text-blue-900 w-[10%]">actionDate</th>
              <th className="px-4 py-2 text-left text-blue-900 w-[10%]">Applied Date</th>
              <th className="px-4 py-2 text-left text-blue-900 w-[10%]">Status</th>
              <th className="px-4 py-2 text-left text-blue-900 w-[8%]">approvedBy</th>
              <th className="px-4 py-2 text-left text-blue-900 w-[10%]">Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length > 0 ? (
              filteredRequests.map((req) => (
                <React.Fragment key={req.id}>
                  <tr className="hover:bg-blue-50 transition">
                    <td className="px-4 py-2 text-left">{req.from}</td>
                    <td className="px-4 py-2 text-left">{req.to}</td>
                    <td className="px-4 py-2 text-left">{req.leaveDayType || "-"}</td>
                    <td className="px-4 py-2 text-left">{req.halfDaySession || "-"}</td>
                    <td className="px-4 py-2 text-left">{req.leaveType}</td>
                    <td className="px-4 py-2 text-left">{req.actionDate}</td>
                    <td className="px-4 py-2 text-left">{req.requestDate}</td>
                    <td className="px-4 py-2 text-left">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          req.status === "Pending"
                            ? "bg-yellow-200 text-yellow-800"
                            : req.status === "Approved"
                            ? "bg-green-200 text-green-800"
                            : req.status === "Rejected"
                            ? "bg-red-200 text-red-800"
                            : "bg-gray-200 text-gray-800"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-left">{req.approvedBy || "-"}</td>
                    <td className="px-4 py-2 text-left">
                      <button
                        onClick={() => toggleDetails(req.id)}
                        className="text-sm px-3 py-1 rounded bg-blue-50 border border-blue-200 hover:bg-blue-100"
                      >
                        {expandedId === req.id ? "Show Less" : "Show More"}
                      </button>
                    </td>
                  </tr>

                  {/* Expanded details row */}
                  {expandedId === req.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={10} className="px-6 py-4">
                        {loadingDetails[req.id] ? (
                          <div className="text-sm text-gray-600">Loading details...</div>
                        ) : detailsError[req.id] ? (
                          <div className="text-sm text-red-600">{detailsError[req.id]}</div>
                        ) : detailsMap[req.id] && detailsMap[req.id].length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {detailsMap[req.id].map((d) => (
                              <div key={d.id} className="flex items-center gap-4">
                                <div className="w-40 text-sm font-medium">{d.date}</div>
                                <div
                                  className={`text-sm font-semibold px-2 py-1 rounded-full ${
                                    d.leavecategory === "Paid"
                                      ? "bg-green-100 text-green-800"
                                      : d.leavecategory === "UnPaid"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}
                                >
                                  {d.leavecategory}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-600">No details available for this leave.</div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="px-4 py-2 text-center text-gray-400">
                  No leave requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sandwich Leaves Section */}
      <div className="mt-10 p-6 bg-white rounded-lg shadow border border-purple-100">
        <h2 className="text-2xl font-bold text-purple-800 mb-4">Sandwich Leaves</h2>
        {Array.isArray(sandwichLeaves) && sandwichLeaves.length > 0 ? (
          <ul className="list-disc pl-6 space-y-2">
            {sandwichLeaves.map((item, index) => (
              <li key={index} className="text-gray-700">
                <span className="font-semibold">{item.date}</span> is counted as a sandwich leave between your leave
                from <span className="font-semibold">{item.from}</span> to{" "}
                <span className="font-semibold">{item.to}</span>.
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 italic">No sandwich leaves this month.</p>
        )}
      </div>
    </>
  );
};

export default CurrentEmployeeLeaveManagement;
