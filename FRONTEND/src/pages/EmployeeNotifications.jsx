// src/pages/EmployeeNotifications.jsx

import { useContext, useEffect, useState } from "react";
import { CurrentEmployeeNotificationContext } from "../EmployeeContext/CurrentEmployeeNotificationContext";
import { FaBell, FaCheckCircle, FaTrash, FaUndo } from "react-icons/fa";

const STORAGE_KEY = "employee_hidden_notifications";

const EmployeeNotifications = () => {
  const {
    notifications,
    loading,
    markAsRead,
    markAllAsRead,
  } = useContext(CurrentEmployeeNotificationContext);

  const [localNotifications, setLocalNotifications] = useState([]);

  // ------------------------------------
  // LOCAL STORAGE HELPERS
  // ------------------------------------
  const getHiddenIds = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const hideLocally = (_id) => {
    const hidden = getHiddenIds();
    const updated = [...hidden, _id];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearHiddenList = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // ------------------------------------
  // DELETE SINGLE (UI ONLY)
  // ------------------------------------
  const removeNotification = (_id) => {
    hideLocally(_id);
    setLocalNotifications((prev) => prev.filter((n) => n._id !== _id));
  };

  // ------------------------------------
  // CLEAR ALL LOCAL
  // ------------------------------------
  const clearAllLocal = () => {
    const allIds = localNotifications.map((n) => n._id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
    setLocalNotifications([]);
  };

  // ------------------------------------
  // RESTORE ALL
  // ------------------------------------
  const restoreAll = () => {
    clearHiddenList();
    setLocalNotifications(notifications);
  };

  // ------------------------------------
  // HANDLE VISIBLE LIST
  // ------------------------------------
  useEffect(() => {
    const hidden = getHiddenIds();

    const filtered = notifications.filter(
      (n) => !hidden.includes(String(n._id))
    );

    setLocalNotifications(filtered);
  }, [notifications]);

  // ------------------------------------
  // LOADING UI
  // ------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <FaBell className="text-4xl animate-pulse mx-auto mb-2" />
          Loading notifications...
        </div>
      </div>
    );
  }

  // ------------------------------------
  // MAIN UI
  // ------------------------------------
  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-green-100 via-white to-green-200">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-6">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <FaBell className="text-green-600 text-2xl" />
            <h2 className="text-2xl font-bold text-green-700">Your Notifications</h2>

            {localNotifications.some((n) => !n.isRead) && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 animate-bounce">
                {localNotifications.filter((n) => !n.isRead).length} Unread
              </span>
            )}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex gap-2">
            <button
              className="text-sm bg-gray-300 text-gray-700 px-3 py-2 rounded-lg font-semibold shadow hover:bg-gray-400 flex items-center gap-1"
              onClick={restoreAll}
            >
              <FaUndo /> Restore
            </button>

            <button
              className="text-sm bg-red-500 text-white px-3 py-2 rounded-lg font-semibold shadow hover:bg-red-600 flex items-center gap-1"
              onClick={clearAllLocal}
            >
              <FaTrash /> Clear All
            </button>

            <button
              className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg font-semibold shadow hover:bg-green-700 flex items-center gap-1"
              onClick={markAllAsRead}
            >
              <FaCheckCircle /> Mark all as read
            </button>
          </div>
        </div>

        {/* EMPTY STATE */}
        {localNotifications.length === 0 ? (
          <div className="text-center py-12 text-gray-400 flex flex-col items-center">
            <FaBell className="text-5xl mb-4 animate-pulse" />
            <p className="text-lg">No notifications to show!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {localNotifications.map((n) => (
              <li
                key={n._id}
                className={`flex items-center gap-3 p-4 rounded-xl shadow border-l-4 transition-all ${
                  !n.isRead
                    ? "bg-yellow-50 border-yellow-400 hover:bg-yellow-100"
                    : "bg-white border-green-100 hover:bg-green-50"
                }`}
              >
                <FaBell
                  className={`text-lg ${
                    !n.isRead ? "text-yellow-600" : "text-green-400"
                  }`}
                />

                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => markAsRead(n._id)}
                >
                  <div className="font-medium text-gray-800">{n.message}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(n.date || n.createdAt).toLocaleString()}
                  </div>
                </div>

                <button
                  className="text-red-500 hover:text-red-700 p-2"
                  onClick={() => removeNotification(n._id)}
                >
                  <FaTrash />
                </button>

                {!n.isRead && (
                  <span className="ml-2 bg-yellow-400 text-white text-xs font-bold rounded-full px-2 py-0.5 shadow">
                    New
                  </span>
                )}
              </li>
            ))}

          </ul>
        )}
      </div>
    </div>
  );
};

export default EmployeeNotifications;
