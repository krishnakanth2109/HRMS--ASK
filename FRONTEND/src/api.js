// --- START OF FILE api.js ---

import axios from "axios";

// ✅ FIXED: Use import.meta.env.MODE instead of process.env.NODE_ENV
// Vite sets MODE to 'production' during build and 'development' during dev
const baseURL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT;

// Debug logs (remove in production)
console.log("🔧 Environment Mode:", import.meta.env.MODE);
console.log("🌐 API Base URL:", baseURL);

// Create an Axios instance that will use the correct base URL automatically.
const api = axios.create({
  baseURL: baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

/**
 * =============================================================================
 * API Service Functions
 * =============================================================================
 */

// ------------------ Auth API Calls ------------------
export const loginUser = async (email, password) => {
  try {
    const response = await api.post("/api/auth/login", { email, password });
    return response.data;
  } catch (error) {
    console.error("Login failed:", error.response?.data || error.message);
    throw error;
  }
};

// ------------------ Holiday API Calls ------------------
export const getHolidays = async () => {
  const response = await api.get("/api/holidays");
  return response.data;
};

export const addHoliday = async (holidayData) => {
  const response = await api.post("/api/holidays", holidayData);
  return response.data;
};

export const deleteHolidayById = async (id) => {
  const response = await api.delete(`/api/holidays/${id}`);
  return response.data;
};

// ------------------ Employee API Calls ------------------
export const getEmployees = async () => {
  const response = await api.get("/api/employees");
  return response.data;
};

export const getEmployeeById = async (id) => {
  const response = await api.get(`/api/employees/${id}`);
  return response.data;
};

export const updateEmployeeById = async (id, employeeData) => {
  const response = await api.put(`/api/employees/${id}`, employeeData);
  return response.data;
};

// ------------------ Notice API Calls ------------------
export const getNotices = async () => {
  const response = await api.get("/api/notices");
  return response.data;
};

export const addNotice = async (noticeData) => {
  const response = await api.post("/api/notices", noticeData);
  return response.data;
};

export default api;

// --- END OF FILE api.js ---