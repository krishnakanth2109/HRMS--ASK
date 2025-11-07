// src/context/NotificationProvider.jsx
import { useState } from "react";
import { NotificationContext } from "./NotificationContext";

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([
    { id: 1, message: "New leave request submitted", isRead: false },
    { id: 2, message: "Attendance marked for today", isRead: true },
    { id: 3, message: "Profile updated successfully", isRead: false },
  ]);

  const addNotification = (message) => {
    const newNotification = {
      id: Date.now(),
      message,
      isRead: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  const markAsRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        unreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
