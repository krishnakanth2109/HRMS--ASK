
import React, { useState } from "react";
import { motion } from "framer-motion";
import { FaEnvelope, FaKey } from "react-icons/fa";
import { useNavigate } from "react-router-dom"; 
// ✅ FIXED IMPORT: Points to the new src/utils/api.js file
import { sendForgotPasswordOtp, verifyForgotPasswordOtp, resetUserPassword } from "../api.js"; 

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: email, 2: OTP, 3: reset
  const [email, setEmail] = useState("");
  const [userOtp, setUserOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  const navigate = useNavigate();

  // STEP 1: Send OTP
  const handleSendOtp = async () => {
    if (!email) return setError("Please enter your email.");
    setError("");
    setLoading(true);

    try {
      await sendForgotPasswordOtp(email);
      setSuccessMessage("OTP sent to your email!");
      setTimeout(() => setSuccessMessage(""), 3000);
      setStep(2);
    } catch (err) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2: Verify OTP
  const handleVerifyOtp = async () => {
    if (!userOtp) return setError("Please enter the OTP.");
    setError("");
    setLoading(true);

    try {
      await verifyForgotPasswordOtp(email, userOtp);
      setSuccessMessage("OTP Verified!");
      setTimeout(() => setSuccessMessage(""), 3000);
      setStep(3);
    } catch (err) {
      setError(err.message || "Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 3: Reset Password
  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (newPassword.length < 6) {
      return setError("Password must be at least 6 characters.");
    }
    
    setError("");
    setLoading(true);

    try {
      await resetUserPassword(email, userOtp, newPassword);
      alert("Password reset successful! You can now log in.");
      navigate("/login"); 
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-100 to-purple-200">
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md"
      >
        <h2 className="text-2xl font-bold mb-4 text-center text-blue-700">
          Forgot Password
        </h2>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-red-500 text-sm mb-3 text-center bg-red-100 p-2 rounded"
          >
            {error}
          </motion.p>
        )}

        {successMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-green-600 text-sm mb-3 text-center bg-green-100 p-2 rounded"
          >
            {successMessage}
          </motion.p>
        )}

        {step === 1 && (
          <>
            <div className="relative mb-4">
              <FaEnvelope className="absolute top-3 left-3 text-gray-400" />
              <input
                type="email"
                placeholder="Enter your email"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className={`w-full text-white py-2 rounded-lg transition ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-gray-500 mb-2 text-center">
              Enter the OTP sent to {email}
            </p>
            <div className="relative mb-4">
              <FaKey className="absolute top-3 left-3 text-gray-400" />
              <input
                type="text"
                placeholder="Enter 6-digit OTP"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={userOtp}
                onChange={(e) => setUserOtp(e.target.value)}
              />
            </div>
            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className={`w-full text-white py-2 rounded-lg transition ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
              }`}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button 
              onClick={() => setStep(1)} 
              className="w-full text-gray-500 text-sm mt-2 hover:underline"
            >
              Change Email
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div className="relative mb-4">
              <input
                type="password"
                placeholder="New Password"
                className="pl-4 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="relative mb-4">
              <input
                type="password"
                placeholder="Confirm Password"
                className="pl-4 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-green-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              onClick={handleResetPassword}
              disabled={loading}
              className={`w-full text-white py-2 rounded-lg transition ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;