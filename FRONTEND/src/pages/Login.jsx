// --- START OF FILE Login.jsx ---
import { useState, useContext, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FaEnvelope, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";

const Login = () => {
  const { user, login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") navigate("/admin/dashboard");
    else if (user?.role === "employee") navigate("/employee/dashboard");
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const role = await login(email, password);

      if (role === "admin") navigate("/admin/dashboard");
      else if (role === "employee") navigate("/employee/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center relative"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1521790361543-f645cf042ec4?auto=format&fit=crop&w=1920&q=80')",
      }}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 bg-white/10 backdrop-blur-lg border border-white/20 shadow-2xl w-full max-w-md px-10 py-8 rounded-3xl"
      >
        <h1 className="text-3xl font-bold text-white text-center mb-2 drop-shadow">
          Welcome Back
        </h1>
        <p className="text-center text-gray-200 mb-6">
          Login to continue to Vagarious – Arah Info Tech
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-400 text-red-200 text-sm text-center py-2 mb-4 rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email */}
          <div>
            <label className="text-gray-200 text-sm font-semibold">Email</label>
            <div className="flex items-center bg-white/20 border border-white/30 rounded-lg px-3 py-2 mt-1">
              <FaEnvelope className="text-gray-200 mr-3" />
              <input
                type="email"
                className="w-full bg-transparent text-white outline-none placeholder-gray-300"
                placeholder="Enter your email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-gray-200 text-sm font-semibold">Password</label>
            <div className="flex items-center bg-white/20 border border-white/30 rounded-lg px-3 py-2 mt-1">
              <FaLock className="text-gray-200 mr-3" />
              <input
                type={showPassword ? "text" : "password"}
                className="w-full bg-transparent text-white outline-none placeholder-gray-300"
                placeholder="Enter your password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
              />
              <span
                className="text-gray-200 cursor-pointer"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </span>
            </div>
          </div>

          {/* Forgot Password */}
          <div className="text-right">
            <button
              type="button"
              onClick={() => navigate("/forgot-password")}
              className="text-blue-200 hover:text-white text-sm underline"
            >
              Forgot Password?
            </button>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600/80 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg shadow-lg transition"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
