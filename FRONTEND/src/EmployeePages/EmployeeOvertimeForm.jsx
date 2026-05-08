// --- START OF FILE EmployeeOvertimeForm.jsx ---

import React, { useState, useEffect, useCallback, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AuthContext } from "../context/AuthContext";
import {
  getOvertimeForEmployee,
  applyForOvertime,
  cancelOvertime,
} from "../api";

const OvertimeWithModal = () => {
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({ date: "", type: "INCENTIVE_OT" });
  const [overtimeList, setOvertimeList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [confirmCancelModal, setConfirmCancelModal] = useState(false);
  const [selectedOT, setSelectedOT] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ============================
  // BLOCK SUNDAY VALIDATION
  // ============================
  const validateDate = (selectedDate) => {
    const d = new Date(selectedDate);
    if (d.getDay() === 0) {
      return "❌ You cannot apply overtime on Sundays.";
    }
    return null;
  };

  // Load OT Data
  const fetchOT = useCallback(async () => {
    try {
      const res = await getOvertimeForEmployee(user.employeeId);
      setOvertimeList(
        res.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user.employeeId]);

  useEffect(() => {
    fetchOT();
  }, [fetchOT]);

  // Handle Change
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  // Submit OT
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.date) {
      setError("Please select a date.");
      return;
    }

    const msg = validateDate(form.date);
    if (msg) {
      setError(msg);
      return;
    }

    try {
      await applyForOvertime({
        employeeId: user.employeeId,
        employeeName: user.name,
        date: form.date,
        type: form.type,
      });

      setSuccess("Overtime submitted successfully!");
      setForm({ date: "", type: "INCENTIVE_OT" });
      fetchOT();

      setTimeout(() => setApplyModalOpen(false), 1200);
    } catch (err) {
      console.error(err);
      setError("Failed to submit overtime. Try again.");
    }
  };

  // Cancel OT
  const handleCancel = async () => {
    try {
      await cancelOvertime(selectedOT);
      setConfirmCancelModal(false);
      fetchOT();
    } catch (err) {
      setError("Failed to cancel overtime.");
    }
  };

  if (loading) return <div className="p-6 text-center text-lg">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-indigo-950 tracking-tight">
            Overtime Requests
          </h2>
          <p className="text-indigo-500/70 text-sm font-medium mt-0.5">Manage and track extra hours</p>
        </div>

        <button
          onClick={() => setApplyModalOpen(true)}
          className="group relative flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl shadow-lg shadow-indigo-100 transition-all font-bold overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
          <span className="relative text-lg">+</span>
          <span className="relative text-sm">New Request</span>
        </button>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white shadow-xl shadow-indigo-100/50 rounded-2xl overflow-hidden border border-indigo-50">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-indigo-50/50 text-indigo-900 border-b border-indigo-100">
              <tr>
                <th className="px-6 py-4 text-left font-black uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left font-black uppercase tracking-wider">Request Type</th>
                <th className="px-6 py-4 text-center font-black uppercase tracking-wider">Status & Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-indigo-50/50">
              {overtimeList.length > 0 ? (
                overtimeList.map((ot) => (
                  <tr
                    key={ot._id}
                    className="hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-900">{new Date(ot.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">{new Date(ot.date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[11px] font-bold border border-indigo-100">
                        {ot.type.replace("_", " ")}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                            ot.status === "APPROVED"
                              ? "bg-green-50 text-green-600 border-green-200"
                              : ot.status === "REJECTED"
                              ? "bg-red-50 text-red-600 border-red-200"
                              : ot.status === "CANCELLED"
                              ? "bg-gray-100 text-gray-500 border-gray-200"
                              : "bg-yellow-50 text-yellow-600 border-yellow-200"
                          }`}
                        >
                          {ot.status}
                        </span>

                        {ot.status === "PENDING" && (
                          <button
                            onClick={() => {
                              setSelectedOT(ot._id);
                              setConfirmCancelModal(true);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all hover:scale-110"
                            title="Cancel Request"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="p-10 text-center text-indigo-300 font-bold"
                    colSpan="3"
                  >
                    No overtime requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden flex flex-col gap-3">
        {overtimeList.length > 0 ? (
          overtimeList.map((ot) => (
            <div key={ot._id} className="bg-white p-4 rounded-2xl shadow-lg shadow-indigo-100/30 border border-indigo-50 flex flex-col gap-3 relative overflow-hidden active:scale-[0.98] transition-transform">
                <div className="flex justify-between items-start relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest mb-0.5">Request Date</span>
                        <span className="font-bold text-indigo-950 text-base">{new Date(ot.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-tighter">{new Date(ot.date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
                    </div>
                    <span
                        className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${
                          ot.status === "APPROVED"
                            ? "bg-green-50 text-green-600 border-green-200"
                            : ot.status === "REJECTED"
                            ? "bg-red-50 text-red-600 border-red-200"
                            : ot.status === "CANCELLED"
                            ? "bg-gray-100 text-gray-500 border-gray-200"
                            : "bg-yellow-50 text-yellow-600 border-yellow-200"
                        }`}
                    >
                        {ot.status}
                    </span>
                </div>

                <div className="flex justify-between items-center bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50 relative z-10">
                    <div className="flex flex-col">
                        <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-0.5">OT Type</span>
                        <span className="font-semibold text-indigo-900 text-xs">{ot.type.replace("_", " ")}</span>
                    </div>
                    {ot.status === "PENDING" && (
                        <button
                          onClick={() => {
                            setSelectedOT(ot._id);
                            setConfirmCancelModal(true);
                          }}
                          className="px-3 py-1.5 bg-white text-red-500 rounded-lg text-[10px] font-bold border border-red-100 shadow-sm active:scale-90"
                        >
                          Cancel
                        </button>
                    )}
                </div>
            </div>
          ))
        ) : (
          <div className="bg-white p-10 rounded-2xl border-2 border-dashed border-indigo-50 text-center">
              <p className="font-bold text-indigo-200">No OT Records</p>
          </div>
        )}
      </div>

      {/* ----------------------- APPLY OT MODAL ----------------------- */}
      <AnimatePresence>
        {applyModalOpen && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-96 p-6 rounded-xl shadow-2xl"
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.7 }}
            >
              <h3 className="text-2xl font-bold mb-4 text-indigo-700">
                Apply Overtime
              </h3>

              <div className="bg-indigo-50 p-3 rounded mb-4 text-sm">
                <p><b>Name:</b> {user.name}</p>
                <p><b>ID:</b> {user.employeeId}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={form.date}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => {
                      const selected = e.target.value;
                      const d = new Date(selected);

                      if (d.getDay() === 0) {
                        setError("Sundays are not allowed for overtime.");
                        setForm({ ...form, date: "" });
                        return;
                      }

                      setError("");
                      handleChange(e);
                    }}
                    className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-medium">Type</label>
                  <select
                    name="type"
                    value={form.type}
                    onChange={handleChange}
                    className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-indigo-400"
                  >
                    <option value="INCENTIVE_OT">Incentive OT</option>
                    <option value="PENDING_OT">Pending OT</option>
                  </select>
                </div>

                {error && <p className="text-red-600">{error}</p>}
                {success && <p className="text-green-600">{success}</p>}

                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-800 text-white py-2 rounded-lg font-semibold shadow"
                >
                  Submit
                </button>
              </form>

              <button
                onClick={() => setApplyModalOpen(false)}
                className="mt-4 text-sm text-gray-500 underline w-full text-center"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------- CANCEL MODAL ----------------------- */}
      <AnimatePresence>
        {confirmCancelModal && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white w-80 p-6 rounded-xl shadow-2xl"
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.7 }}
            >
              <h3 className="text-xl font-bold mb-4 text-red-600">
                Confirm Cancel
              </h3>

              <p className="mb-6 text-gray-700">
                Are you sure you want to cancel this overtime request?
              </p>

              <div className="flex justify-between">
                <button
                  onClick={handleCancel}
                  className="bg-red-600 hover:bg-red-800 text-white px-4 py-2 rounded shadow"
                >
                  Yes, Cancel
                </button>

                <button
                  onClick={() => setConfirmCancelModal(false)}
                  className="bg-gray-300 hover:bg-gray-400 px-4 py-2 rounded shadow"
                >
                  No, Keep
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OvertimeWithModal;

// --- END OF FILE EmployeeOvertimeForm.jsx ---
