// src/context/NotificationProvider.jsx
import { useState, useEffect, useCallback } from "react";
import { NotificationContext } from "./NotificationContext";
import {
  getNotifications,
  addNotificationRequest,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../api";
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  const [sound] = useState(() => new Audio("/notification.mp3"));

  // Load current user from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("hrmsUser");
      if (raw) {
        setCurrentUser(JSON.parse(raw));
      }
    } catch (err) {
      console.error("Failed to parse hrmsUser:", err);
    }
  }, []);

  // Helper: does this notif belong to this user?
  const shouldShowToUser = (notif, user) => {
    if (!user || !notif) return false;
    const userId = user._id;
    const role = user.role;

    // direct notification
    if (notif.userId) {
      return (
        notif.userId === userId ||
        notif.userId?.toString?.() === userId?.toString()
      );
    }

    // role/global broadcast
    if (!notif.role || notif.role === "all") return true;
    return notif.role === role;
  };

  // Fetch notifications from backend
  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // SOCKET CONNECTION
  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
    });

    console.log("📡 SOCKET CONNECTED (notifications):", SOCKET_URL);

    // When admin posts a notice (you already had this)
    socket.on("newNotice", (data) => {
      const newNotification = {
        _id: Date.now(),
        title: "New Notice Posted",
        message: data.title,
        type: "notice",
        isRead: false,
        date: new Date(),
      };

      setNotifications((prev) => [newNotification, ...prev]);
    });

    // General notification from backend
    socket.on("newNotification", (data) => {
      console.log("🔥 New Notification Received:", data);

      // ✅ Only add if this notification is actually for this user
      if (!shouldShowToUser(data, currentUser)) return;

      setNotifications((prev) => {
        if (prev.some((n) => n._id === data._id)) return prev;
        return [data, ...prev];
      });

      // play sound
      try {
        sound.currentTime = 0;
        sound.play().catch(() => {});
      } catch {}

      // toast popup
      const toastId = Date.now();
      setToasts((prev) => [
        { id: toastId, message: data.message, time: new Date() },
        ...prev,
      ]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toastId));
      }, 4000);
    });

    return () => {
      socket.disconnect();
    };
  }, [sound, currentUser]);

  // Add notification manually
  const addNotification = async (message, type = "info", extra = {}) => {
    try {
      const saved = await addNotificationRequest({ message, type, ...extra });
      setNotifications((prev) => [saved, ...prev]);
      return saved;
    } catch (err) {
      console.error("Failed to save notification:", err.message);
    }
  };

  const markAsRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error("Failed to update notification:", err.message);
    }
  };

  const markAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err.message);
    }
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
        loading,
      }}
    >
      {children}

      {/* Toasts */}
      <div
        style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          zIndex: 9999,
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              background: "#ffffff",
              padding: "12px 16px",
              marginBottom: "10px",
              borderRadius: "8px",
              boxShadow: "0px 4px 12px rgba(0,0,0,0.15)",
              minWidth: "250px",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            {toast.message}
            <div
              style={{
                fontSize: "11px",
                opacity: 0.6,
                marginTop: "4px",
              }}
            >
              {toast.time.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
