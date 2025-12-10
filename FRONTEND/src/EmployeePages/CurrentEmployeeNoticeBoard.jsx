import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { AuthContext } from "../context/AuthContext"; 
import api from "../api"; 
import { FaPaperPlane, FaTrash, FaComments, FaTimes } from "react-icons/fa";

const NoticeList = () => {
  const [notices, setNotices] = useState([]);
  // Changed to isInitialLoading to ensure we only show loader ONCE
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const { user } = useContext(AuthContext);
  const currentUserId = user?._id || user?.id;

  // Chat Modal State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeNotice, setActiveNotice] = useState(null); 
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  
  // Auto-scroll to bottom of chat
  const messagesEndRef = useRef(null);

  // ✅ STABLE FETCH FUNCTION
  // prevents UI flickering by ensuring loading state is never toggled during polling
  const fetchNotices = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsInitialLoading(true);
      
      const { data } = await api.get("/api/notices");
      const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      
      // Update notices without causing a full re-render flicker
      setNotices(prev => {
        // Simple check to avoid state update if stringified data is identical (optional optimization)
        if (JSON.stringify(prev) === JSON.stringify(sortedData)) return prev;
        return sortedData;
      });
      
      // Trigger auto-read logic silently
      autoMarkAsRead(sortedData);
      
      // ✅ Update Active Chat Window Silently
      if (activeNotice) {
        const updatedActive = sortedData.find(n => n._id === activeNotice._id);
        
        // Only update if replies changed to avoid typing interruption/flicker
        if (updatedActive && JSON.stringify(updatedActive.replies) !== JSON.stringify(activeNotice.replies)) {
           setActiveNotice(updatedActive);
        }
      }
    } catch (err) {
      console.error("Error fetching notices:", err);
    } finally {
      // Only turn off initial loader, never turn it back on
      if (!silent) setIsInitialLoading(false);
    }
  }, [activeNotice, currentUserId]); 

  // Initial Load Only
  useEffect(() => { 
    if (user) {
        fetchNotices(false); // Show loader first time
    }
  }, [user]); // Removed fetchNotices from dependency to avoid loop, though useCallback handles it.

  // ✅ POLLING: Check for messages every 3s (Silent Mode)
  useEffect(() => {
    const interval = setInterval(() => {
        fetchNotices(true); // True = Silent update (No Loader)
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchNotices]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isChatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeNotice?.replies?.length, isChatOpen]); // Dependency on length ensures scroll on new msg

  const autoMarkAsRead = async (fetchedNotices) => {
    if (!currentUserId) return;

    const unreadNotices = fetchedNotices.filter(notice => {
      const isRead = notice.readBy && notice.readBy.some(record => {
        const rId = typeof record.employeeId === 'object' ? record.employeeId._id : record.employeeId;
        return rId === currentUserId;
      });
      return !isRead;
    });

    if (unreadNotices.length === 0) return;

    try {
      // API call fire-and-forget to avoid blocking UI
      Promise.all(unreadNotices.map(n => api.put(`/api/notices/${n._id}/read`))).catch(e => console.error(e));
    } catch (error) { 
      console.error("Error auto-marking notices:", error); 
    }
  };

  const handleSendReply = async () => {
    if (!replyText || !replyText.trim()) return;
    
    // Optimistic UI Update (Show message immediately before API confirms)
    const tempId = Date.now();
    const optimisticReply = {
        _id: tempId,
        message: replyText,
        sentBy: 'Employee',
        repliedAt: new Date().toISOString()
    };
    
    setReplyText("");
    
    // Update UI immediately
    setActiveNotice(prev => ({
        ...prev,
        replies: [...(prev.replies || []), optimisticReply]
    }));

    setSendingReply(true);
    
    try {
      await api.post(`/api/notices/${activeNotice._id}/reply`, { message: replyText });
      // We rely on the next polling cycle (3s) to reconcile the real data
      // or we can force a silent fetch immediately
      fetchNotices(true); 
    } catch (error) { 
        alert("Failed to send reply"); 
        // Revert optimistic update on failure (optional complexity)
    } finally { 
        setSendingReply(false); 
    }
  };

  const handleDeleteReply = async (noticeId, replyId) => {
    if(!window.confirm("Delete this message?")) return;
    try { 
        // Optimistic delete
        setActiveNotice(prev => ({
            ...prev,
            replies: prev.replies.filter(r => r._id !== replyId)
        }));

        await api.delete(`/api/notices/${noticeId}/reply/${replyId}`); 
        fetchNotices(true);
    } catch(e) { alert("Error deleting"); }
  };

  const openChatModal = (notice) => {
    // Set data immediately from props/state - No Loading
    setActiveNotice(notice);
    setIsChatOpen(true);
    setReplyText("");
  };

  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    return { date: d.toLocaleDateString(), time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
  };

  // Only show full page loader on FIRST mount
  if (isInitialLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] overflow-hidden relative font-sans">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply blur-3xl opacity-30 animate-blob"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Announcements</h1>
          <p className="text-slate-500 mt-1">Latest updates for {user?.name || "you"}</p>
        </div>

        <div className="space-y-5">
          {notices.map((notice, index) => {
            const { date, time } = formatDateTime(notice.date);
            
            // Check if read by current user (Locally)
            const isRead = notice.readBy && notice.readBy.some(record => {
              const rId = typeof record.employeeId === 'object' ? record.employeeId._id : record.employeeId;
              return rId === currentUserId;
            });

            // ✅ Check if last reply was from Admin
            const replies = notice.replies || [];
            const lastReply = replies.length > 0 ? replies[replies.length - 1] : null;
            const hasAdminReply = lastReply && lastReply.sentBy === 'Admin';

            return (
              <div key={notice._id} className="group relative bg-white/90 backdrop-blur-md rounded-2xl p-6 transition-all hover:shadow-xl border border-slate-100">
                <div className="flex flex-col md:flex-row gap-5">
                  
                  {/* --- Left Icon Column --- */}
                  <div className="hidden md:flex flex-col items-center">
                    <div 
                      className={`p-3 rounded-2xl shadow-lg transition-colors duration-500 ${
                        isRead 
                        ? 'bg-slate-100 text-slate-400 border border-slate-200' 
                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white animate-pulse'
                      }`}
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                    </div>
                    <div className="h-full w-0.5 bg-slate-100 mt-4 rounded-full"></div>
                  </div>

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">{notice.title}</h3>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 mb-3"><span>{date}, {time}</span></div>
                        </div>
                        
                        {/* Chat Trigger Button */}
                        <button 
                            onClick={() => openChatModal(notice)}
                            className="relative flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-full text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                        >
                            <FaComments /> Chat with Admin
                            {/* Red Dot Logic */}
                            {hasAdminReply && (
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                                </span>
                            )}
                        </button>
                    </div>
                    
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{notice.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CHAT POPUP */}
      {isChatOpen && activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#e5ddd5] w-full max-w-md h-[80vh] rounded-xl shadow-2xl flex flex-col relative overflow-hidden">
                <div className="bg-[#075e54] text-white p-4 flex justify-between items-center shadow-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">A</div>
                        <div>
                            <h3 className="font-bold text-sm">Admin Support</h3>
                            <p className="text-[10px] text-green-100 truncate w-40">{activeNotice.title}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsChatOpen(false)} className="text-white hover:bg-white/10 p-2 rounded-full"><FaTimes /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 relative custom-scrollbar">
                    <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
                    {(!activeNotice.replies || activeNotice.replies.length === 0) ? (
                        <div className="flex items-center justify-center h-full text-gray-500 text-xs italic z-10 relative">
                            Start a conversation with Admin...
                        </div>
                    ) : (
                        activeNotice.replies.map((reply, i) => {
                            const isMe = reply.sentBy === 'Employee';
                            // const isAdmin = reply.sentBy === 'Admin';
                            
                            return (
                                <div key={i} className={`flex w-full relative z-10 ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] p-2 px-3 rounded-lg shadow-sm text-sm relative ${
                                        isMe 
                                        ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' 
                                        : 'bg-white text-gray-800 rounded-tl-none'
                                    }`}>
                                        <div className="flex justify-between items-start gap-2">
                                            <p className="leading-snug break-words">{reply.message}</p>
                                            {isMe && (
                                                <button onClick={() => handleDeleteReply(activeNotice._id, reply._id)} className="text-[10px] text-gray-400 hover:text-red-500 ml-2">
                                                    <FaTrash />
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-[9px] text-right text-gray-500 mt-1 flex justify-end items-center gap-1">
                                            {formatDateTime(reply.repliedAt).time}
                                            {isMe && <span className="text-blue-500">✓✓</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="bg-[#f0f2f5] p-3 flex items-center gap-2 z-10">
                    <input 
                        className="flex-1 p-3 rounded-full border-none outline-none text-sm bg-white shadow-sm"
                        placeholder="Type a message"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendReply()}
                    />
                    <button 
                        onClick={handleSendReply} 
                        disabled={sendingReply || !replyText.trim()}
                        className="bg-[#008069] text-white p-3 rounded-full hover:bg-[#006a57] transition disabled:opacity-50 shadow-md flex items-center justify-center"
                    >
                        <FaPaperPlane size={14} />
                    </button>
                </div>
            </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ccc; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default NoticeList;