// src/EmployeeContext/CurrentEmployeeNotificationProvider.jsx

import React, { useState, useEffect, useCallback } from "react";
import { CurrentEmployeeNotificationContext } from "./CurrentEmployeeNotificationContext";
import {
  getNotifications,
  getNotices,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../api";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// Load logged-in employee
const loadUser = () => {
  try {
    const raw =
      localStorage.getItem("hrmsUser") || sessionStorage.getItem("hrmsUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const READ_NOTICE_KEY = "employee_read_notices";

const CurrentEmployeeNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [notices, setNotices] = useState([]);
  const [unreadNotices, setUnreadNotices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loggedUser] = useState(loadUser);

  const getUserId = () => (loggedUser ? String(loggedUser._id) : null);

  // Read notices from localStorage
  const loadReadNoticeIds = () => {
    try {
      return JSON.parse(localStorage.getItem(READ_NOTICE_KEY)) || [];
    } catch {
      return [];
    }
  };

  const saveReadNoticeIds = (ids) => {
    localStorage.setItem(READ_NOTICE_KEY, JSON.stringify(ids));
  };

  // Load employee notifications
  const loadNotifications = useCallback(async () => {
    try {
      const all = await getNotifications();

      const filtered = all.filter(
        (n) => String(n.userId) === String(getUserId())
      );

      filtered.sort(
        (a, b) =>
          new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt)
      );

      setNotifications(filtered);
    } catch (err) {
      console.error("❌ Error fetching employee notifications:", err);
    }
  }, []);

  // Load notices
  const loadNotices = useCallback(async () => {
    try {
      const list = await getNotices();
      const readIds = loadReadNoticeIds();

      const mapped = list.map((n) => ({
        _id: n._id,
        title: n.title,
        message: n.title,
        date: n.date,
        isRead: readIds.includes(n._id),
      }));

      mapped.sort((a, b) => new Date(b.date) - new Date(a.date));

      setNotices(mapped);
      setUnreadNotices(mapped.filter((n) => !n.isRead).length);
    } catch (err) {
      console.error("❌ Error fetching notices:", err);
    }
  }, []);

  // Mark all notices read
  const markAllNoticesRead = () => {
    const allIds = notices.map((n) => n._id);
    saveReadNoticeIds(allIds);

    const updated = notices.map((n) => ({ ...n, isRead: true }));
    setNotices(updated);
    setUnreadNotices(0);
  };

  // 🚫 DISABLE ALL SOCKET NOTIFICATIONS
  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

    console.log("📡 Socket connected (employee notifications disabled)");

    socket.off("newNotification");
    socket.off("newNotice");
    socket.off("notificationUpdated");
    socket.off("notificationsAllRead");

    return () => socket.disconnect();
  }, []);

  // Mark single notification read
  const markAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);

      setNotifications((prev) =>
        prev.map((n) =>
          String(n._id) === String(id) ? { ...n, isRead: true } : n
        )
      );
    } catch (err) {
      console.error("❌ Mark read failed:", err);
    }
  };

  // Mark all notifications read
  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("❌ Mark all read failed:", err);
    }
  };

  // Initial load
  useEffect(() => {
    (async () => {
      await loadNotifications();
      await loadNotices();
      setLoading(false);
    })();
  }, []);

  return (
    <CurrentEmployeeNotificationContext.Provider
      value={{
        notifications,
        notices,
        unreadNotices,
        loading,
        markAsRead,
        markAllAsRead,
        markAllNoticesRead,
        loadNotifications,
        loadNotices,
      }}
    >
      {children}
    </CurrentEmployeeNotificationContext.Provider>
  );
};

export default CurrentEmployeeNotificationProvider;
