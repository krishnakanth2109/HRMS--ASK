import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";

const LayoutAdmin = () => {
  const [bubbles, setBubbles] = useState([]);

  useEffect(() => {
    // Generate animated background bubbles on mount
    const newBubbles = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      size: Math.random() * 180 + 60, // Size between 60px and 240px
      left: Math.random() * 100, // Position 0-100%
      top: Math.random() * 100, // Position 0-100%
      color: Math.random() > 0.6 ? '#93C5FD' : '#E0F2FE', // Darker Blue vs Light Blue
      opacity: Math.random() > 0.6 ? 0.6 : 0.8,
      duration: Math.random() * 20 + 10, // Animation duration 10s - 30s
      delay: Math.random() * 10, // Animation delay
    }));
    setBubbles(newBubbles);
  },[]);

  return (
    <div className="relative flex h-screen overflow-hidden bg-[#F8FAFF]">
      
      {/* SIDEBAR */}
      <div className="relative z-20 bg-white/70 backdrop-blur-sm shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <Sidebar />
      </div>

      {/* MAIN AREA */}
      <div className="relative flex flex-col flex-1 z-10">
        
        {/* NAVBAR */}
        <div className="relative z-20 bg-white/70 backdrop-blur-sm shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <Navbar />
        </div>

        {/* OUTLET CONTAINER WITH BUBBLES */}
        <main className="relative flex-1 overflow-hidden bg-transparent">
          
          {/* ================= INJECT CUSTOM CSS FOR BUBBLES ================= */}
          <style>{`
            @keyframes blob-bounce {
              0% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(30px, -50px) scale(1.1); }
              66% { transform: translate(-20px, 20px) scale(0.9); }
              100% { transform: translate(0, 0) scale(1); }
            }
          `}</style>

          {/* ================= BACKGROUND BUBBLES (ONLY FOR OUTLET) ================= */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {bubbles.map((bubble) => (
              <div
                key={bubble.id}
                className="absolute rounded-full"
                style={{
                  width: `${bubble.size}px`,
                  height: `${bubble.size}px`,
                  left: `${bubble.left}%`,
                  top: `${bubble.top}%`,
                  backgroundColor: bubble.color,
                  opacity: bubble.opacity,
                  filter: "blur(1px)",
                  animation: `blob-bounce ${bubble.duration}s infinite ease-in-out alternate`,
                  animationDelay: `${bubble.delay}s`,
                }}
              />
            ))}
          </div>

          {/* ================= SCROLLABLE CONTENT (OUTLET) ================= */}
          <div className="relative z-10 h-full w-full overflow-y-auto p-6 md:p-8">
            <Outlet />
          </div>

        </main>
      </div>
    </div>
  );
};

export default LayoutAdmin;