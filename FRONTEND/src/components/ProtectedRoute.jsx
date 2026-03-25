import { useContext, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

// Define the animations for the spinner and fire
const animations = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  @keyframes flicker {
    0% { transform: rotate(-45deg) scale(0.9); opacity: 0.8; }
    100% { transform: rotate(-45deg) scale(1.1); opacity: 1; }
  }
`;

// Define styles to center everything on the screen and style the elements
const styles = {
  container: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", height: "100vh", backgroundColor: "#f9fafb",
    fontFamily: "system-ui, sans-serif",
  },
  spinner: {
    width: "50px", height: "50px", border: "5px solid #e5e7eb",
    borderTop: "5px solid #3b82f6", borderRadius: "50%",
    animation: "spin 1s linear infinite", marginBottom: "20px",
  },
  loadingText: { color: "#1f2937", margin: "0 0 8px 0" },
  subText: { color: "#6b7280", margin: "0" },
  illustrationBox: { position: "relative", marginBottom: "20px" },
  fireWrapper: { position: "absolute", bottom: "30px", left: "90px" },
  fireMain: {
    width: "20px", height: "20px", backgroundColor: "#ff5722",
    borderRadius: "50% 0 50% 50%", transform: "rotate(-45deg)",
    animation: "flicker 0.6s infinite alternate", position: "absolute",
  },
  fireLeft: { width: "15px", height: "15px", backgroundColor: "#ff9800", left: "-10px", top: "5px", animationDelay: "0.2s" },
  fireRight: { width: "12px", height: "12px", backgroundColor: "#ffeb3b", left: "10px", top: "8px", animationDelay: "0.4s" },
  errorTitle: { color: "#dc2626", margin: "0 0 10px 0" },
  errorText: { color: "#4b5563", marginBottom: "20px", textAlign: "center" },
  retryButton: {
    padding: "10px 24px", backgroundColor: "#ef4444", color: "white",
    border: "none", borderRadius: "6px", cursor: "pointer",
    fontWeight: "bold", transition: "transform 0.2s ease",
  }
};

const ProtectedRoute = ({ children }) => {
  const { user, loading, error } = useContext(AuthContext);
  
  // Local state to enforce a 2-second minimum loading time
  const [minLoadingTime, setMinLoadingTime] = useState(true);

  // Run a 2-second timer when the component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinLoadingTime(false); // Turn off the forced loading after 2s
    }, 1000);

    return () => clearTimeout(timer); // Cleanup timer if component unmounts
  }, []);

  // ⭐ Combine actual context loading WITH our 2-second timer
  const isLoading = loading || minLoadingTime;

  // ---------------------------------------------
  // ⭐ 1. DYNAMIC LOADING UI
  // ---------------------------------------------
  if (isLoading) {
    return (
      <div style={styles.container}>
        <style>{animations}</style>
        <div style={styles.spinner}></div>
        <h3 style={styles.loadingText}>Loading Application Data...</h3>
        <p style={styles.subText}>Please wait while we connect to the server</p>
      </div>
    );
  }

  // ---------------------------------------------
  // ⭐ 2. "TIRED WIRES & FIRE" ERROR UI
  // ---------------------------------------------
  if (error) {
    return (
      <div style={styles.container}>
        <style>{animations}</style>
        <div style={styles.illustrationBox}>
          <svg width="200" height="120" viewBox="0 0 200 120">
            <path d="M 0 60 Q 50 60 80 90" stroke="#555" strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M 200 60 Q 150 60 120 90" stroke="#555" strokeWidth="8" fill="none" strokeLinecap="round" />
            <circle cx="80" cy="90" r="3" fill="orange">
              <animate attributeName="opacity" values="1;0" dur="0.5s" repeatCount="indefinite" />
              <animate attributeName="cy" values="90;110" dur="0.5s" repeatCount="indefinite" />
              <animate attributeName="cx" values="80;70" dur="0.5s" repeatCount="indefinite" />
            </circle>
            <circle cx="120" cy="90" r="2" fill="yellow">
              <animate attributeName="opacity" values="1;0" dur="0.3s" repeatCount="indefinite" />
              <animate attributeName="cy" values="90;70" dur="0.3s" repeatCount="indefinite" />
              <animate attributeName="cx" values="120;130" dur="0.3s" repeatCount="indefinite" />
            </circle>
          </svg>
          <div style={styles.fireWrapper}>
            <div style={styles.fireMain}></div>
            <div style={{...styles.fireMain, ...styles.fireLeft}}></div>
            <div style={{...styles.fireMain, ...styles.fireRight}}></div>
          </div>
        </div>

        <h2 style={styles.errorTitle}>Something Went Wrong!</h2>
        <p style={styles.errorText}>We failed to fetch the authentication data.</p>
        <button 
          onClick={() => window.location.reload()}
          style={styles.retryButton}
          onMouseOver={(e) => e.target.style.transform = "scale(1.05)"}
          onMouseOut={(e) => e.target.style.transform = "scale(1)"}
        >
          Try Again
        </button>
      </div>
    );
  }

  // ---------------------------------------------
  // ⭐ 3. UNAUTHORIZED REDIRECT
  // ---------------------------------------------
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // ⭐ 4. RENDER CHILDREN IF SUCCESSFUL
  return children;
};

export default ProtectedRoute;