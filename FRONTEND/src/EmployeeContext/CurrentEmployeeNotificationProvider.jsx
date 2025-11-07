import React, { useState, useCallback } from "react";
import { CurrentEmployeeNotificationContext } from "./CurrentEmployeeNotificationContext";

// Initial demo notifications
const initialNotifications = [
  { id: 1, text: "Your leave request was approved.", read: false, date: "2025-07-31" },
  { id: 2, text: "New company notice posted.", read: false, date: "2025-07-30" },
  { id: 3, text: "Attendance marked for today.", read: false, date: "2025-07-29" },
];

const CurrentEmployeeNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState(initialNotifications);

  const addNotification = useCallback((text) => {
    setNotifications((prev) => [
      { id: Date.now(), text, read: false, date: new Date().toISOString().slice(0, 10) },
      ...prev,
    ]);
  }, []);

  const markAsRead = useCallback((id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <CurrentEmployeeNotificationContext.Provider
      value={{
        notifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        unreadCount,
      }}
    >
      {children}
    </CurrentEmployeeNotificationContext.Provider>
  );
};

export default CurrentEmployeeNotificationProvider;