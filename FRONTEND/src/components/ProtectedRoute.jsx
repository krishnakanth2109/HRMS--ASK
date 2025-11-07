import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

const ProtectedRoute = ({ children, role }) => {
  const { user } = useContext(AuthContext);

  // Not logged in? Redirect to login
  if (!user) return <Navigate to="/" replace />;

  // Logged in, but not the correct role? Redirect to login
  if (role && user.role !== role) return <Navigate to="/" replace />;

  // All good
  return children;
};

export default ProtectedRoute;
