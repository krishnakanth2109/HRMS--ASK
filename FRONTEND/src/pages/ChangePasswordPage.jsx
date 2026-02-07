// --- START OF FILE ChangePasswordPage.jsx ---

import React, { useState } from "react";
// ✅ Import the new OTP functions
import { sendChangePasswordOtp, changePasswordWithOtp } from "../api";
import { FaEye, FaEyeSlash, FaCheckCircle, FaLock, FaPaperPlane } from "react-icons/fa";

const getPasswordStrength = (password) => {
  if (!password) return "";
  if (password.length < 6) return "Weak";
  if (password.match(/[A-Z]/) && password.match(/[0-9]/) && password.length >= 8)
    return "Strong";
  return "Medium";
};

const strengthBar = (strength) => {
  if (strength === "Strong") return <div className="h-2 rounded bg-green-500 w-full transition-all"></div>;
  if (strength === "Medium") return <div className="h-2 rounded bg-yellow-400 w-2/3 transition-all"></div>;
  if (strength === "Weak") return <div className="h-2 rounded bg-red-500 w-1/3 transition-all"></div>;
  return <div className="h-2 rounded bg-gray-200 w-full"></div>;
};

const ChangePasswordPage = () => {
  const [step, setStep] = useState(1); // 1: Request OTP, 2: Submit New Password
  
  const [form, setForm] = useState({
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  const [show, setShow] = useState({
    new: false,
    confirm: false,
  });
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordStrength = getPasswordStrength(form.newPassword);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleShow = (field) => {
    setShow((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // --- STEP 1: SEND OTP ---
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      await sendChangePasswordOtp();
      setSuccess("OTP sent to your registered email!");
      setStep(2); // Move to next step
    } catch (err) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 2: VERIFY & CHANGE ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.otp || !form.newPassword || !form.confirmPassword) {
      return setError("All fields are required.");
    }
    if (form.newPassword.length < 6) {
      return setError("New password must be at least 6 characters.");
    }
    if (form.newPassword !== form.confirmPassword) {
      return setError("New password and confirm password do not match.");
    }

    setLoading(true);
    
    try {
      await changePasswordWithOtp(form.otp, form.newPassword);
      setSuccess("Password changed successfully!");
      
      // Reset form and go back to step 1 after delay
      setForm({ otp: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => {
        setSuccess("");
        setStep(1); 
      }, 3000);
    } catch (err) {
      setError(err.message || "Failed to change password. Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-100">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-blue-100">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-100 rounded-full p-3 mb-2">
            <FaLock className="text-blue-600 text-3xl" />
          </div>
          <h2 className="text-2xl font-bold text-blue-700 mb-1">
            Change Password
          </h2>
          <p className="text-gray-500 text-sm text-center">
            {step === 1 
              ? "We need to verify it's you. Send an OTP to your email to proceed." 
              : "Enter the OTP sent to your email and set your new password."}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 text-green-700 bg-green-50 px-3 py-2 rounded border border-green-200 text-sm">
            <FaCheckCircle className="text-green-500" /> {success}
          </div>
        )}

        {/* STEP 1: Send OTP Button */}
        {step === 1 && (
          <form onSubmit={handleSendOtp}>
            <button
              type="submit"
              disabled={loading}
              className={`w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2 ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
            >
              {loading ? "Sending..." : <>Send OTP <FaPaperPlane /></>}
            </button>
          </form>
        )}

        {/* STEP 2: OTP & Password Form */}
        {step === 2 && (
          <form onSubmit={handleSubmit} autoComplete="off">
            
            {/* OTP Input */}
            <div className="mb-5">
              <label className="block mb-1 font-medium text-gray-700">Enter OTP</label>
              <input 
                type="text" 
                name="otp" 
                value={form.otp} 
                onChange={handleChange} 
                className="w-full border px-3 py-2 rounded focus:outline-blue-400 transition tracking-widest text-center text-lg font-bold" 
                placeholder="------"
                maxLength={6}
                required 
              />
            </div>

            {/* New Password */}
            <div className="mb-5 relative">
              <label className="block mb-1 font-medium text-gray-700">New Password</label>
              <input 
                type={show.new ? "text" : "password"} 
                name="newPassword" 
                value={form.newPassword} 
                onChange={handleChange} 
                className="w-full border px-3 py-2 rounded focus:outline-blue-400 pr-10 transition" 
                required 
              />
              <button type="button" tabIndex={-1} className="absolute right-3 top-9 text-gray-400 hover:text-blue-600" onClick={() => handleShow("new")}>
                {show.new ? <FaEyeSlash /> : <FaEye />}
              </button>
              
              {form.newPassword && (
                <div className="mt-2">
                  {strengthBar(passwordStrength)}
                  <span className={`block mt-1 text-xs font-semibold ${passwordStrength === "Strong" ? "text-green-600" : passwordStrength === "Medium" ? "text-yellow-600" : "text-red-600"}`}>
                    Strength: {passwordStrength}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="mb-8 relative">
              <label className="block mb-1 font-medium text-gray-700">Confirm New Password</label>
              <input 
                type={show.confirm ? "text" : "password"} 
                name="confirmPassword" 
                value={form.confirmPassword} 
                onChange={handleChange} 
                className="w-full border px-3 py-2 rounded focus:outline-blue-400 pr-10 transition" 
                required 
              />
              <button type="button" tabIndex={-1} className="absolute right-3 top-9 text-gray-400 hover:text-blue-600" onClick={() => handleShow("confirm")}>
                {show.confirm ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-green-600 text-white py-2 rounded font-semibold hover:bg-green-700 transition flex items-center justify-center ${loading ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
              
              <button 
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-gray-500 hover:text-blue-600 transition"
              >
                Cancel & Resend OTP
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordPage;