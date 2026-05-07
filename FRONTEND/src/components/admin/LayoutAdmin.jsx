import Sidebar from "./Sidebar";  // now from admin folder
import Navbar from "./Navbar";
import { Outlet } from "react-router-dom";
import { useState, useEffect } from "react";

const LayoutAdmin = () => {
  const[theme, setTheme] = useState(sessionStorage.getItem("adminTheme") || "white");
  const[bubbles, setBubbles] = useState([]);
  
  const themeBgImage = "../../../public/image.png"; 

  const toggleTheme = (selectedTheme) => {
    setTheme(selectedTheme);
    sessionStorage.setItem("adminTheme", selectedTheme);
  };

  useEffect(() => {
    // Handle Dark Mode Class
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }

    if (theme === "bubbles") {
      const newBubbles = Array.from({ length: 8 }).map((_, i) => ({
        id: i,
        size: Math.random() * 180 + 60,
        left: Math.random() * 100,
        top: Math.random() * 100,
        color: Math.random() > 0.6 ? '#93C5FD' : '#E0F2FE',
        opacity: Math.random() > 0.6 ? 0.6 : 0.8,
        duration: Math.random() * 20 + 10,
        delay: Math.random() * 10,
      }));
      setBubbles(newBubbles);
    } else {
      setBubbles([]);
    }
  }, [theme]);

  return (
    <div className={`flex h-screen w-full overflow-hidden transition-colors duration-500 ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : theme === 'white' ? 'bg-white' : 'bg-[#F8FAFF]'}`}>
      
      {/* SIDEBAR */}
      <div className={`z-30 transition-all duration-500 flex-shrink-0 ${theme === 'dark' ? 'bg-slate-900/50 backdrop-blur-xl border-r border-white/5' : 'bg-white/70 backdrop-blur-sm shadow-[4px_0_24px_rgba(0,0,0,0.02)]'}`}>
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        
        {/* NAVBAR */}
        <div className={`z-20 transition-all duration-500 flex-shrink-0 ${theme === 'dark' ? 'bg-slate-900/50 backdrop-blur-xl border-b border-white/5' : 'bg-white/70 backdrop-blur-sm shadow-[0_4px_24px_rgba(0,0,0,0.02)]'}`}>
          <Navbar currentTheme={theme} onThemeChange={toggleTheme} />
        </div>

        <main className="relative flex-1 overflow-hidden bg-transparent">
          <style>{`
            @keyframes blob-bounce {
              0% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(30px, -50px) scale(1.1); }
              66% { transform: translate(-20px, 20px) scale(0.9); }
              100% { transform: translate(0, 0) scale(1); }
            }
          `}</style>

          {/* BACKGROUND LAYERS */}
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            {theme === "dark" && (
              <div className="absolute inset-0 bg-slate-950 transition-colors duration-700">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-slate-950 to-purple-900/20" />
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
              </div>
            )}

            {theme === "bubbles" && bubbles.map((bubble) => (
              <div key={bubble.id} className="absolute rounded-full"
                style={{
                  width: `${bubble.size}px`, height: `${bubble.size}px`,
                  left: `${bubble.left}%`, top: `${bubble.top}%`,
                  backgroundColor: bubble.color, opacity: bubble.opacity,
                  filter: "blur(2px)", animation: `blob-bounce ${bubble.duration}s infinite ease-in-out alternate`,
                  animationDelay: `${bubble.delay}s`,
                }}
              />
            ))}

            {theme === "image" && (
              <div className="absolute inset-0 opacity-60 transition-opacity duration-700"
                style={{ backgroundImage: `url(https://image2url.com/r2/default/images/1773292744536-6fd3f832-9e97-4fb8-8a1d-1ddb3b5e2b15.png)`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
              />
            )}
          </div>

          {/* CONTENT */}
          {/* Removed specific z-indexes here so your Modals can freely escape and cover the Sidebar! */}
          <div className="relative h-full w-full overflow-y-auto p-6 md:p-8">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
};

export default LayoutAdmin;
