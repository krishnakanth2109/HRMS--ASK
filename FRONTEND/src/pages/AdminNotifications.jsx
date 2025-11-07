// pages/AdminNotifications.jsx
import { useContext } from "react";
import { NotificationContext } from "../context/NotificationContext";
import { FaBell, FaCheckCircle } from "react-icons/fa";

const AdminNotifications = () => {
  const { notifications, markAsRead, markAllAsRead } = useContext(NotificationContext);

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-blue-100 via-white to-blue-200">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <FaBell className="text-blue-600 text-2xl" />
            <h2 className="text-2xl font-bold text-blue-700">Notifications</h2>
            {notifications.filter(n => !n.isRead).length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 animate-bounce">
                {notifications.filter(n => !n.isRead).length} Unread
              </span>
            )}
          </div>
          <button
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold shadow hover:bg-blue-700 transition"
            onClick={markAllAsRead}
          >
            <FaCheckCircle className="inline mr-1" /> Mark all as read
          </button>
        </div>
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-gray-400 flex flex-col items-center">
            <FaBell className="text-5xl mb-4 animate-pulse" />
            <p className="text-lg">No notifications yet!</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`flex items-center gap-3 p-4 rounded-xl shadow transition-all cursor-pointer border-l-4 ${
                  !n.isRead
                    ? "bg-yellow-50 border-yellow-400 hover:bg-yellow-100"
                    : "bg-white border-blue-100 hover:bg-blue-50"
                }`}
                onClick={() => markAsRead(n.id)}
              >
                <FaBell className={`text-lg ${!n.isRead ? "text-yellow-500" : "text-blue-400"}`} />
                <div className="flex-1">
                  <div className="font-medium text-gray-800">
                    {n.message}
                  </div>
                  {n.timestamp && (
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(n.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
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

export default AdminNotifications;
