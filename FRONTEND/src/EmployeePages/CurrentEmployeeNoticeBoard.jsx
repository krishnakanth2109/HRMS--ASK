import React, { useEffect, useState } from "react";
import { getNotices } from "../api"; // Import the centralized API function

const NoticeList = () => {
  const [notices, setNotices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        setIsLoading(true);
        const data = await getNotices();
        setNotices(data);
      } catch (err) {
        console.error("Error fetching notices:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotices();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-6 flex flex-col items-center">
        <div className="animate-pulse flex flex-col items-center w-full max-w-3xl">
          <div className="h-10 bg-gradient-to-r from-purple-400 to-blue-500 rounded-lg w-64 mb-8"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white/80 p-6 rounded-2xl shadow-lg w-full mb-4 backdrop-blur-sm">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-100 p-6 flex flex-col items-center">
      {/* Header with animated gradient */}
      <div className="text-center mb-10">
        <h2 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent mb-4 animate-gradient-x">
          📢 Latest Notices
        </h2>
        <p className="text-gray-600 text-lg">Stay updated with our latest announcements</p>
      </div>

      {notices.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-8xl mb-4">📭</div>
          <p className="text-xl text-gray-600 font-medium">No notices available yet.</p>
          <p className="text-gray-500 mt-2">Check back later for updates!</p>
        </div>
      ) : (
        <div className="grid gap-6 w-full max-w-4xl">
          {notices.map((notice, index) => (
            <div
              key={notice._id}
              className="group relative overflow-hidden bg-white/80 backdrop-blur-sm p-7 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-1 border border-white/60 hover:border-purple-200/80"
              style={{
                animationDelay: `${index * 100}ms`,
                animation: `slideInUp 0.6s ease-out ${index * 100}ms both`
              }}
            >
              {/* Gradient accent bar */}
              <div className="absolute left-0 top-0 w-1.5 h-full bg-gradient-to-b from-purple-500 via-blue-500 to-indigo-500 group-hover:from-purple-600 group-hover:via-blue-600 group-hover:to-indigo-600 transition-all duration-300"></div>
              
              {/* Shimmer effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 transform translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              
              <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-gray-900 transition-colors duration-300 relative z-10">
                {notice.title}
              </h3>
              
              <p className="text-gray-700 leading-relaxed mb-4 relative z-10 group-hover:text-gray-800 transition-colors duration-300">
                {notice.description}
              </p>
              
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100/80 relative z-10">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium bg-gradient-to-r from-purple-500 to-blue-500 text-white px-3 py-1 rounded-full">
                    📅 {new Date(notice.date).toLocaleDateString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </span>
                </div>
                
                <div className="flex space-x-2">
                  <span className="text-xs text-gray-500 bg-gray-100/80 px-2 py-1 rounded-full">
                    #{notice._id.slice(-6)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom animations */}
      <style jsx>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default NoticeList;