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

const READ_NOTICE_KEY = "employee_read_notices"; // localStorage only

const CurrentEmployeeNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]); // ONLY Employee notifications
  const [notices, setNotices] = useState([]); // Notice board items
  const [unreadNotices, setUnreadNotices] = useState(0); // Badge count
  const [loading, setLoading] = useState(true);
  const [sound] = useState(() => new Audio("/notification.mp3"));
  const [loggedUser] = useState(loadUser);

  const getUserId = () => (loggedUser ? String(loggedUser._id) : null);

  // -------------------------------------------------------------
  // Load read notice IDs from localStorage
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // FETCH EMPLOYEE NOTIFICATIONS
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // FETCH NOTICES (SEPARATE)
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // MARK ALL NOTICES READ
  // -------------------------------------------------------------
  const markAllNoticesRead = () => {
    const allIds = notices.map((n) => n._id);
    saveReadNoticeIds(allIds);

    const updated = notices.map((n) => ({ ...n, isRead: true }));

    setNotices(updated);
    setUnreadNotices(0);
  };

  // -------------------------------------------------------------
  // SOCKET: Only notifications (NOT notices)
  // -------------------------------------------------------------
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });

    socket.on("newNotification", (n) => {
      if (String(n.userId) !== userId) return;

      setNotifications((prev) => [n, ...prev]);
      playSound();
    });

    return () => socket.disconnect();
  }, []);

  // -------------------------------------------------------------
  // SOUND
  // -------------------------------------------------------------
  const playSound = () => {
    try {
      sound.currentTime = 0;
      sound.play();
    } catch {}
  };

  // -------------------------------------------------------------
  // MARK SINGLE EMPLOYEE NOTIFICATION READ
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // MARK ALL EMPLOYEE NOTIFICATIONS READ
  // -------------------------------------------------------------
  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();

      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("❌ Mark all read failed:", err);
    }
  };

  // -------------------------------------------------------------
  // INITIAL LOAD
  // -------------------------------------------------------------
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
        notifications, // only employee notifications
        notices,       // separate notices for sidebar + notice page
        unreadNotices, // badge count for sidebar
        loading,

        markAsRead,
        markAllAsRead,

        markAllNoticesRead, // notice board only
        loadNotifications,
        loadNotices,
      }}
    >
      {children}
    </CurrentEmployeeNotificationContext.Provider>
  );
};

export default CurrentEmployeeNotificationProvider;
