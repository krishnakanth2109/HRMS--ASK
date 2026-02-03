// --- START OF FILE controllers/userController.js ---

import Admin from "../models/adminModel.js";
import Employee from "../models/employeeModel.js";

// Helper function to filter an object for only allowed fields
const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

// Controller function for updating a user's own profile
export const updateMyProfile = async (req, res) => {
  try {
    const filteredBody = filterObj(req.body, 'name', 'email', 'phone', 'department');
    const userId = req.user.id;
    const userRole = req.user.role;

    let updatedUser;
    if (userRole === 'admin') {
      updatedUser = await Admin.findByIdAndUpdate(userId, filteredBody, { new: true, runValidators: true });
    } else {
      updatedUser = await Employee.findByIdAndUpdate(userId, filteredBody, { new: true, runValidators: true });
    }

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json({
      status: 'success',
      data: { user: updatedUser },
    });
  } catch (error) {
    console.error("UPDATE PROFILE ERROR:", error);
    res.status(500).json({ message: "An error occurred while updating profile." });
  }
};

// Controller function for a user changing their own password
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Please provide your current and new password." });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters long." });
  }

  try {
    let user = await Admin.findById(req.user.id).select("+password");
    let isAdmin = true;
    
    if (!user) {
      user = await Employee.findById(req.user.id).select("+password");
      isAdmin = false;
    }

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    // Check current password
    if (!(await user.correctPassword(currentPassword, user.password))) {
      return res.status(401).json({ message: "Your current password is incorrect." });
    }

    // **FIX 1: Update only the password field**
    user.password = newPassword;
    
    // **FIX 2: Use save with validation turned off for non-password fields**
    // or update only the password field
    
    // Option A: Use save with options to validate only modified paths
    await user.save({ validateModifiedOnly: true });
    
    // Option B: Or update directly without full validation
    // if (isAdmin) {
    //   await Admin.findByIdAndUpdate(req.user.id, { password: newPassword });
    // } else {
    //   await Employee.findByIdAndUpdate(req.user.id, { password: newPassword });
    // }

    res.status(200).json({ status: "success", message: "Password changed successfully." });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        message: "Validation failed.",
        details: messages.join(', ')
      });
    }
    
    res.status(500).json({ 
      message: "An internal server error occurred.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};