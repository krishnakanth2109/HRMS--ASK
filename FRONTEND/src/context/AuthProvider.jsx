// --- START OF FILE AuthProvider.jsx ---

import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { loginUser, logoutUser, getMe } from "../api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Load cached user from sessionStorage for instant display (optimistic UI)
    const savedUser = sessionStorage.getItem("hrmsUser");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Error parsing cached auth data:", e);
      }
    }

    // 2. Query the server to check if session cookie is valid and fetch fresh user details
    const fetchUser = async () => {
      try {
        const response = await getMe();
        if (response?.status === "success" && response.data) {
          const freshUser = response.data;
          setUser(freshUser);
          sessionStorage.setItem("hrmsUser", JSON.stringify(freshUser));
        } else {
          sessionStorage.removeItem("hrmsUser");
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("hrms-token");
          setUser(null);
        }
      } catch (error) {
        console.warn("Invalid session cookie or expired session. Clearing user state.");
        sessionStorage.removeItem("hrmsUser");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("hrms-token");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await loginUser(email, password);

      console.log("💾 [Auth Diagnostics] Login Raw Response:", response.data);

      const userData = response.data.data;
      const token = response.data.token;

      // Validation
      if (!userData) {
        console.error("⚠ [Auth Diagnostics] Invalid login response structure", response.data);
        throw new Error("Invalid login response");
      }

      // Cache token and user info in sessionStorage
      if (token) {
        console.log("💾 [Auth Diagnostics] Storing JWT token:", token.substring(0, 15) + "...");
        sessionStorage.setItem("token", token);
        userData.token = token;
      } else {
        console.warn("⚠ [Auth Diagnostics] No token returned in login response!");
      }
      sessionStorage.setItem("hrmsUser", JSON.stringify(userData));
      setUser(userData);

      return response;
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error("Backend logout failed:", error);
    } finally {
      // Clear local storage and state regardless of API success
      sessionStorage.removeItem("hrmsUser");
      sessionStorage.removeItem("hrms-token");
      sessionStorage.removeItem("token");
      sessionStorage.clear(); // Safety clear
      setUser(null);
    }
  };

  const updateUser = useCallback((newUserData) => {
    setUser(prevUser => {
      const updatedUser = { ...prevUser, ...newUserData };
      sessionStorage.setItem("hrmsUser", JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- END OF FILE AuthProvider.jsx ---