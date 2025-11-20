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

// Load logged-in employee from storage
const loadUser = () => {
  try {
    const raw =
      localStorage.getItem("hrmsUser") || sessionStorage.getItem("hrmsUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// LocalStorage key for READ NOTICES
const NOTICE_READ_KEY = "employee_read_notices";

const CurrentEmployeeNotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sound] = useState(() => new Audio("/notification.mp3"));
  const [loggedUser] = useState(loadUser);

  /*
  ==============================================================
    LocalStorage helpers for notices (admin broadcast messages)
  ==============================================================
  */
  const getReadNotices = () => {
    try {
      return JSON.parse(localStorage.getItem(NOTICE_READ_KEY)) || [];
    } catch {
      return [];
    }
  };

  const markNoticeAsReadLocally = (id) => {
    const list = getReadNotices();
    if (!list.includes(id)) {
      const updated = [...list, id];
      localStorage.setItem(NOTICE_READ_KEY, JSON.stringify(updated));
    }
  };

  const markAllNoticesAsReadLocally = () => {
    const allNoticeIds = notifications
      .filter((n) => n.userId === "ALL")
      .map((n) => n._id);

    localStorage.setItem(NOTICE_READ_KEY, JSON.stringify(allNoticeIds));
  };

  const getUserId = () =>
    loggedUser ? String(loggedUser._id) : null;

  /*
  ==============================================================
    FETCH PERSONAL + NOTICE NOTIFICATIONS
  ==============================================================
  */
  const fetchNotifications = useCallback(async () => {
    setLoading(true);

    try {
      const userId = getUserId();
      const readNotices = getReadNotices();

      // Personal notifications from DB
      const dbNotifications = await getNotifications();
      const personal = dbNotifications.filter(
        (n) => String(n.userId) === userId
      );

      // Fetch admin notices
      const notices = await getNotices();
      const noticeItems = notices.map((n) => ({
        _id: n._id,
        userId: "ALL",
        title: "New Notice",
        message: n.title,
        type: "notice",
        isRead: readNotices.includes(n._id),
        date: n.date,
      }));

      const combined = [...personal, ...noticeItems];

      combined.sort(
        (a, b) =>
          new Date(b.date || b.createdAt) -
          new Date(a.date || a.createdAt)
      );

      setNotifications(combined);
    } catch (err) {
      console.error("❌ Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  /*
  ==============================================================
    SOCKET.IO LISTENERS
  ==============================================================
  */
  useEffect(() => {
    const userId = getUserId();
    if (!userId) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    console.log("📡 Employee Socket Connected:", socket.id);

    // Real-time personal notification
    socket.on("newNotification", (n) => {
      if (String(n.userId) !== userId) return;
      setNotifications((prev) => [n, ...prev]);
      playSound();
      showToast(n.message);
    });

    // Real-time admin notice
    socket.on("newNotice", (notice) => {
      const newNotice = {
        _id: Date.now(),
        userId: "ALL",
        title: "New Notice",
        message: notice.title,
        type: "notice",
        isRead: false,
        date: new Date(),
      };

      setNotifications((prev) => [newNotice, ...prev]);
      playSound();
      showToast(`Notice: ${notice.title}`);
    });

    return () => socket.disconnect();
  }, []);

  /*
  ==============================================================
    SOUND + TOAST
  ==============================================================
  */
  const playSound = () => {
    try {
      sound.currentTime = 0;
      sound.play();
    } catch {}
  };

  const showToast = (message) => {
    const id = Date.now();
    setToasts((prev) => [{ id, message }, ...prev]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000
    );
  };

  /*
  ==============================================================
    MARK AS READ (Single)
  ==============================================================
  */
  const markAsRead = async (id) => {
    try {
      const target = notifications.find((n) => String(n._id) === String(id));

      // If it's a NOTICE, store in localStorage only
      if (target.userId === "ALL") {
        markNoticeAsReadLocally(id);
        setNotifications((prev) =>
          prev.map((n) =>
            String(n._id) === String(id) ? { ...n, isRead: true } : n
          )
        );
        return;
      }

      // Personal notification stored in DB
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          String(n._id) === String(id) ? { ...n, isRead: true } : n
        )
      );
    } catch (err) {
      console.error("❌ Failed to mark as read:", err);
    }
  };

  /*
  ==============================================================
    MARK ALL AS READ
  ==============================================================
  */
  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead(); // DB update
      markAllNoticesAsReadLocally(); // LocalStorage update

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
    } catch (err) {
      console.error("❌ Failed to mark all as read:", err);
    }
  };

  return (
    <CurrentEmployeeNotificationContext.Provider
      value={{
        notifications,
        loading,
        markAsRead,
        markAllAsRead,
        unreadCount: notifications.filter((n) => !n.isRead).length,
      }}
    >
      {children}

      {/* Toasts */}
      <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999 }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              background: "#fff",
              padding: "12px 16px",
              marginBottom: 10,
              borderRadius: 10,
              boxShadow: "0 6px 18px rgba(0,0,0,0.15)",
              fontWeight: 600,
              minWidth: "260px",
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </CurrentEmployeeNotificationContext.Provider>
  );
};

export default CurrentEmployeeNotificationProvider;
