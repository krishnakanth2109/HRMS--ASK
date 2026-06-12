import { promisify } from "util";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";
import { sessionStore } from "../config/redis.js";

// Create JWT (maintained for fallback/compatibility)
const signToken = (id, role, loginMethod = "password") => {
  return jwt.sign({ id, role, loginMethod }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "90d",
  });
};

// ----------------------------------------------
// LOGIN CONTROLLER
// ----------------------------------------------
export const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({
      message: "Please provide both email and password.",
    });

  try {
    let user = null;
    let role = null;

    // 1️⃣ CHECK ADMIN (includes manager)
    user = await Admin.findOne({ email }).select("+password +role");
    if (user) {
      role = user.role; // "admin" or "manager"
    }

    // 2️⃣ IF NOT ADMIN → CHECK EMPLOYEE
    if (!user) {
      user = await Employee.findOne({ email }).select("+password");
      if (user) role = "employee";
    }

    // 3️⃣ USER NOT FOUND OR PASSWORD WRONG
    if (!user || !(await user.correctPassword(password, user.password))) {
      return res
        .status(401)
        .json({ message: "Incorrect email or password." });
    }

    // 4️⃣ BLOCK DEACTIVATED EMPLOYEES
    if (role === "employee" && user.isActive === false) {
      return res.status(403).json({
        message: "Your account is deactivated. Please contact support team.",
      });
    }

    // 5️⃣ CREATE REDIS-BACKED SESSION (with in-memory fallback)
    const sessionId = crypto.randomUUID();
    const loginMethod = "password";
    const sessionData = {
      id: user._id.toString(),
      role: role,
      loginMethod,
    };

    // Store in Session Store
    await sessionStore.set(`session:${sessionId}`, JSON.stringify(sessionData), 30 * 24 * 60 * 60);

    // Send HTTP-Only Cookie
    res.cookie("sessionId", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
    });

    const token = signToken(user._id, role, loginMethod);
    user.password = undefined;

    return res.status(200).json({
      status: "success",
      token, // Maintain for backward compatibility / non-cookie clients
      loginMethod,
      data: {
        ...user.toObject(),
        role: role,
        loginMethod,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res
      .status(500)
      .json({ message: "An internal server error occurred." });
  }
};

// ----------------------------------------------
// PROTECT MIDDLEWARE
// ----------------------------------------------
export const protect = async (req, res, next) => {
  let sessionId = req.cookies?.sessionId;
  let sessionData = null;

  // 1️⃣ Try fetching session details from Session Store
  if (sessionId) {
    try {
      const stored = await sessionStore.get(`session:${sessionId}`);
      if (stored) {
        sessionData = JSON.parse(stored);
      }
    } catch (err) {
      console.error("Session store lookup error:", err.message);
    }
  }

  // 2️⃣ Fallback: Extract token from Authorization header
  let token;
  if (!sessionData && req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!sessionData && !token) {
    return res.status(401).json({
      message: "You are not logged in! Please log in to get access.",
    });
  }

  try {
    let userId;
    let userRole;
    let decoded;

    if (sessionData) {
      userId = sessionData.id;
      userRole = sessionData.role;
    } else {
      // Decode JWT token (legacy header path)
      decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
      userId = decoded.id;
      userRole = decoded.role;
      req.auth = decoded;
    }

    // 3️⃣ Check in Admin collection
    let currentUser = await Admin.findById(userId).select("+role");

    // 4️⃣ If not admin → check employee
    if (!currentUser) {
      currentUser = await Employee.findById(userId);
    }

    if (!currentUser) {
      return res.status(401).json({
        message: "The user belonging to this session no longer exists.",
      });
    }

    // 5️⃣ Block deactivated employees
    if (currentUser.isActive === false) {
      return res.status(401).json({ message: "User is deactivated." });
    }

    // 6️⃣ Attach user to request
    currentUser.role = userRole || currentUser.role;
    req.user = currentUser;

    next();
  } catch (error) {
    return res
      .status(401)
      .json({ message: "Invalid session or token. Please log in again." });
  }
};

// ----------------------------------------------
// LOGOUT CONTROLLER
// ----------------------------------------------
export const logout = async (req, res) => {
  const sessionId = req.cookies?.sessionId;
  if (sessionId) {
    try {
      await sessionStore.del(`session:${sessionId}`);
    } catch (err) {
      console.error("Error deleting session:", err.message);
    }
  }

  res.clearCookie("sessionId", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  return res.status(200).json({
    status: "success",
    message: "Logged out successfully.",
  });
};

// ----------------------------------------------
// GET ME CONTROLLER
// ----------------------------------------------
export const getMe = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      status: "fail",
      message: "Not authenticated.",
    });
  }

  return res.status(200).json({
    status: "success",
    data: req.user,
  });
};
