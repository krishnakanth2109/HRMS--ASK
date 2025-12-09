// --- START OF FILE AuthProvider.jsx ---

import { useState, useEffect, useCallback } from "react";
import { AuthContext } from "./AuthContext";
import { loginUser } from "../api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Retrieve data from storage
    const savedUser = sessionStorage.getItem("hrmsUser");
    const token = sessionStorage.getItem("token") || sessionStorage.getItem("hrms-token");

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        
        // 2. Validate: Must have a user object AND a token (either in storage or inside the object)
        if (token || parsedUser.token) {
          setUser(parsedUser);
        } else {
          // Found user data but no token? invalid state.
          console.warn("Found user data but no token. Clearing session.");
          sessionStorage.clear();
        }
      } catch (e) {
        console.error("Error parsing auth data:", e);
        sessionStorage.clear();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await loginUser(email, password);

      console.log("LOGIN RAW RESPONSE:", response.data);

      const token = response.data.token;
      const userData = response.data.data;

      // Validation
      if (!token || !userData) {
        console.error("⚠ INVALID LOGIN RESPONSE STRUCTURE", response.data);
        throw new Error("Invalid login response");
      }

      // --- CRITICAL FIX: STORE TOKEN IN ALL EXPECTED LOCATIONS ---
      
      // 1. Standard key (used by CurrentEmployeeProfile)
      sessionStorage.setItem("token", token);
      
      // 2. Legacy key (used by api.js)
      sessionStorage.setItem("hrms-token", token);

      // 3. Inside User Object (Best practice for Profile page access)
      const userWithToken = { ...userData, token };
      sessionStorage.setItem("hrmsUser", JSON.stringify(userWithToken));

      setUser(userWithToken);

      // Return FULL RESPONSE so Login.jsx can redirect using role
      return response;

    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = () => {
    // Clear all possible keys
    sessionStorage.removeItem("hrmsUser");
    sessionStorage.removeItem("hrms-token");
    sessionStorage.removeItem("token");
    sessionStorage.clear(); // Safety clear
    setUser(null);
  };

  const updateUser = useCallback((newUserData) => {
    setUser(prevUser => {
      // Merge new data with previous user data
      const updatedUser = { ...prevUser, ...newUserData };
      
      // Ensure we don't accidentally lose the token during an update
      if (prevUser?.token && !updatedUser.token) {
          updatedUser.token = prevUser.token;
      }

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