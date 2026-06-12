// middleware/authMiddleware.js
import { promisify } from "util";
import jwt from "jsonwebtoken";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";
import { sessionStore } from "../config/redis.js";

/*
  PROTECT MIDDLEWARE
  - validates session via Session Store (first) or JWT (fallback)
  - loads Admin OR Employee into req.user
  - attaches user.role = "admin" or "employee"
*/
export const protect = async (req, res, next) => {
  let sessionId = req.cookies?.sessionId;
  let sessionData = null;

  // 1️⃣ Check Session Store
  if (sessionId) {
    try {
      const stored = await sessionStore.get(`session:${sessionId}`);
      if (stored) {
        sessionData = JSON.parse(stored);
      }
    } catch (err) {
      console.error("Session store lookup error (middleware):", err.message);
    }
  }

  // 2️⃣ Fallback to JWT token header
  let token;
  if (!sessionData && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!sessionData && !token) {
    return res
      .status(401)
      .json({ message: "Not authorized, no token or session provided" });
  }

  try {
    let userId;
    let userRole;
    let decoded;

    if (sessionData) {
      userId = sessionData.id;
      userRole = sessionData.role;
    } else {
      decoded = await promisify(jwt.verify)(
        token,
        process.env.JWT_SECRET
      );
      userId = decoded.id;
      userRole = decoded.role;
    }

    let currentUser = await Admin.findById(userId).select("-password");
    if (currentUser) {
      currentUser.role = userRole || currentUser.role || "admin";
    } else {
      currentUser = await Employee.findById(userId).select("-password");
      if (currentUser) {
        currentUser.role = userRole || currentUser.role || "employee";
      }
    }

    if (!currentUser) {
      return res.status(401).json({ message: "Not authorized, user not found" });
    }

    req.user = currentUser;
    next();
  } catch (error) {
    console.error("Token/Session verification error:", error.message);
    return res.status(401).json({ message: "Not authorized, invalid session or token" });
  }
};

/*
  Restrict route to roles:
  router.get('/admin-only', protect, restrictTo('admin'), controller)
*/
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You do not have permission for this action" });
    }
    next();
  };
};
