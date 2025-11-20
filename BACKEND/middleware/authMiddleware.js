// --- START OF FILE middleware/authMiddleware.js ---

import jwt from 'jsonwebtoken';
import User from '../models/employeeModel.js'; // Ensures we check against the Employee DB

const protect = async (req, res, next) => {
  let token;

  // 1. Check if Authorization header exists and starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // 2. Get token from header
      token = req.headers.authorization.split(' ')[1];

      // 3. Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Get user from the token (exclude password)
      // Note: Ensures the user actually exists in the DB
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      next(); // Proceed to the next middleware
    } catch (error) {
      console.error('Token verification failed:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    // If header is missing or incorrect format
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

// Role-based access control
const restrictTo = (...roles) => {
  return (req, res, next) => {
    // req.user is set in the 'protect' middleware above
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'You do not have permission to perform this action' 
      });
    }
    next();
  };
};

export { protect, restrictTo };