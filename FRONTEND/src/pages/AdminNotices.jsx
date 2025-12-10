import React, { useState, useEffect, useCallback } from "react";
import { getAllNoticesForAdmin, addNotice, getEmployees, deleteNoticeById, updateNotice } from "../api";
import api from "../api"; // Direct API import for chat
import Swal from 'sweetalert2'; 
import { 
  FaEdit, FaTrash, FaPlus, FaTimes, FaSearch, FaCheck, 
  FaChevronDown, FaChevronUp, FaUserTag, FaEye, FaReply, FaPaperPlane 
} from 'react-icons/fa';

const AdminNotices = () => {
  // --- STATE ---
  const initialFormState = { title: "", description: "", recipients: [], sendTo: 'ALL' };
  const [noticeData, setNoticeData] = useState(initialFormState);
  const [notices, setNotices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI States
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Toggle for "Specific" recipients list
  const [expandedRecipientNoticeId, setExpandedRecipientNoticeId] = useState(null);

  // ✅ POPUP STATES
  const [viewedByNotice, setViewedByNotice] = useState(null); 
  const [repliesNotice, setRepliesNotice] = useState(null);
  
  // ✅ CHAT STATES
  const [selectedChatEmployeeId, setSelectedChatEmployeeId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  // --- API CALLS ---
  const fetchNotices = useCallback(async () => {
    try {
      const data = await getAllNoticesForAdmin();
      const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));
      setNotices(sortedData);

      // ✅ Update Chat Window if Open
      if (repliesNotice) {
        const updatedNotice = sortedData.find(n => n._id === repliesNotice._id);
        
        // Only update state if replies have actually changed (prevents flickering)
        if (updatedNotice && JSON.stringify(updatedNotice.replies) !== JSON.stringify(repliesNotice.replies)) {
           setRepliesNotice(updatedNotice);
        }
      }
    } catch (error) {
      console.error("Error fetching notices:", error);
    }
  }, [repliesNotice]);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data.filter(emp => emp.isActive !== false));
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchNotices();
    fetchEmployees();
  }, [fetchEmployees]); 

  // ✅ AUTO-REFRESH MESSAGES (POLLING)
  // This will check for new messages every 3 seconds when the chat is open
  useEffect(() => {
    let interval;
    if (repliesNotice) {
      interval = setInterval(() => {
        fetchNotices();
      }, 3000); // 3 seconds
    }
    return () => clearInterval(interval);
  }, [repliesNotice, fetchNotices]);

  // --- HANDLERS ---
  const handleChange = (e) => {
    const { name, value } = e.target;
    setNoticeData(prev => ({ ...prev, [name]: value }));
  };

  const toggleEmployeeSelection = (employeeId) => {
    setNoticeData(prev => {
      const isSelected = prev.recipients.includes(employeeId);
      if (isSelected) {
        return { ...prev, recipients: prev.recipients.filter(id => id !== employeeId) };
      } else {
        return { ...prev, recipients: [...prev.recipients, employeeId] };
      }
    });
  };

  const toggleRecipientList = (noticeId) => {
    setExpandedRecipientNoticeId(prev => prev === noticeId ? null : noticeId);
  };

  const openModal = (notice = null) => {
    if (notice) {
      setEditingNoticeId(notice._id);
      const isSpecific = Array.isArray(notice.recipients) && notice.recipients.length > 0;
      setNoticeData({
        title: notice.title,
        description: notice.description,
        recipients: isSpecific ? notice.recipients : [],
        sendTo: isSpecific ? 'SPECIFIC' : 'ALL',
      });
    } else {
      setEditingNoticeId(null);
      setNoticeData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNoticeId(null);
    setNoticeData(initialFormState);
    setIsDropdownOpen(false);
    setSearchTerm("");
  };

  const handleDelete = async (noticeId) => {
    const result = await Swal.fire({
      title: 'Delete Notice?',
      text: "This action cannot be undone.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, Delete'
    });

    if (result.isConfirmed) {
      try {
        await deleteNoticeById(noticeId);
        Swal.fire('Deleted', 'Notice removed successfully.', 'success');
        fetchNotices();
      } catch (error) {
        Swal.fire('Error', 'Failed to delete.', 'error');
      }
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingNoticeId) {
        const updatePayload = {
          title: noticeData.title,
          description: noticeData.description,
          recipients: noticeData.sendTo === 'SPECIFIC' ? noticeData.recipients : 'ALL'
        };
        await updateNotice(editingNoticeId, updatePayload);
        Swal.fire('Updated', 'Notice updated successfully.', 'success');
      } else {
        const payload = {
          title: noticeData.title,
          description: noticeData.description,
          recipients: noticeData.sendTo === 'SPECIFIC' ? noticeData.recipients : [],
        };
        await addNotice(payload);
        Swal.fire('Posted', 'Notice sent successfully.', 'success');
      }
      closeModal();
      fetchNotices();
    } catch (error) {
      Swal.fire('Error', 'Something went wrong.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ ADMIN REPLY HANDLER
  const handleAdminReply = async () => {
    if (!replyText.trim() || !repliesNotice || !selectedChatEmployeeId) return;
    
    setSendingReply(true);
    try {
        await api.post(`/api/notices/${repliesNotice._id}/admin-reply`, { 
            message: replyText,
            targetEmployeeId: selectedChatEmployeeId
        });
        setReplyText("");
        fetchNotices(); 
    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Failed to send reply", "error");
    } finally {
        setSendingReply(false);
    }
  };

  // ✅ DELETE MESSAGE HANDLER
  const handleDeleteReply = async (noticeId, replyId) => {
    if(!window.confirm("Delete this message?")) return;
    try {
        await api.delete(`/api/notices/${noticeId}/reply/${replyId}`);
        fetchNotices();
    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Failed to delete message", "error");
    }
  };

  // ✅ HELPER: Group replies
  const getGroupedReplies = (notice) => {
    if (!notice.replies) return {};
    return notice.replies.reduce((acc, reply) => {
        const empId = reply.employeeId?._id || reply.employeeId; 
        const empName = reply.employeeId?.name || "Unknown";
        if (empId) {
            if (!acc[empId]) {
                acc[empId] = { name: empName, messages: [] };
            }
            acc[empId].messages.push(reply);
        }
        return acc;
    }, {});
  };

  const formatDateTime = (dateString) => {
    const d = new Date(dateString);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    };
  };

  const getRecipientNamesList = (recipientIds) => {
    if (!recipientIds || recipientIds.length === 0) return [];
    return recipientIds.map(id => {
      const emp = employees.find(e => e._id === id);
      return emp ? emp.name : 'Unknown User';
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24">
      
      {/* 1. HEADER */}
      <div className="relative bg-white border-b border-slate-200 shadow-sm z-30">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Announcement Center</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Manage and broadcast updates</p>
          </div>
          <button 
            onClick={() => openModal()}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-slate-200 transition-all transform active:scale-95"
          >
            <FaPlus className="text-sm" /> <span className="hidden sm:inline">New Post</span>
          </button>
        </div>
      </div>

      {/* 2. NOTICE FEED */}
      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        
        {notices.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 mx-4">
            <div className="text-5xl mb-4 grayscale opacity-30">📯</div>
            <p className="text-slate-400 text-lg font-medium">No active notices.</p>
            <p className="text-slate-300 text-sm">Create one to notify your team.</p>
          </div>
        ) : (
          notices.map((notice, index) => {
            const { date, time } = formatDateTime(notice.date);
            const isSpecific = notice.recipients && notice.recipients.length > 0 && notice.recipients !== 'ALL';
            const recipientNames = isSpecific ? getRecipientNamesList(notice.recipients) : [];
            const isExpandedRecipients = expandedRecipientNoticeId === notice._id;
            
            const viewCount = notice.readBy ? notice.readBy.length : 0;
            const groupedChats = getGroupedReplies(notice);
            const activeChatCount = Object.keys(groupedChats).length;

            return (
              <div 
                key={notice._id}
                className="group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border border-slate-100 overflow-visible"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${
                  isSpecific ? 'bg-gradient-to-b from-purple-500 to-pink-500' : 'bg-gradient-to-b from-blue-500 to-cyan-500'
                }`}></div>

                <div className="p-6 pl-8">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {isSpecific ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-purple-100">
                              🔒 Specific
                            </span>
                            <button 
                               onClick={() => toggleRecipientList(notice._id)}
                               className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-purple-600 transition-colors bg-slate-50 px-3 py-1 rounded-full cursor-pointer hover:bg-purple-50"
                            >
                              {recipientNames.length} Cands 
                              {isExpandedRecipients ? <FaChevronUp /> : <FaChevronDown />}
                            </button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-100">
                            📢 Everyone
                          </span>
                        )}

                        <button 
                           onClick={() => setViewedByNotice(notice)}
                           className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-green-600 transition-colors bg-green-50 px-3 py-1 rounded-full border border-green-100 cursor-pointer"
                        >
                          <FaEye /> {viewCount}
                        </button>

                        <button 
                            onClick={() => { setRepliesNotice(notice); setSelectedChatEmployeeId(null); }}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border cursor-pointer ${
                                activeChatCount > 0 
                                ? 'bg-orange-100 text-orange-700 border-orange-200' 
                                : 'bg-gray-50 text-gray-400 border-gray-100 hover:bg-orange-50 hover:text-orange-500'
                            }`}
                        >
                            <FaReply /> {activeChatCount} Chats
                        </button>
                      </div>
                      
                      <div className={`overflow-hidden transition-all duration-300 ease-in-out origin-top ${isExpandedRecipients ? 'max-h-60 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                        <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 shadow-inner">
                           <div className="flex flex-wrap gap-2">
                              {recipientNames.map((name, i) => (
                                <span key={i} className="flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2 py-1 rounded border border-slate-200 shadow-sm">
                                  <FaUserTag className="text-slate-300" /> {name}
                                </span>
                              ))}
                           </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 self-start whitespace-nowrap">
                       <span>{date}</span>
                       <span className="h-3 w-px bg-slate-300"></span>
                       <span>{time}</span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">
                      {notice.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {notice.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                    <button 
                      onClick={() => openModal(notice)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button 
                      onClick={() => handleDelete(notice._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"
                    >
                      <FaTrash /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================= MODALS ================= */}

      {viewedByNotice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewedByNotice(null)}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95">
                <div className="px-6 py-4 border-b border-green-100 flex justify-between items-center bg-green-50">
                    <h3 className="font-bold text-green-800 flex items-center gap-2"><FaEye /> Viewed By ({viewedByNotice.readBy ? viewedByNotice.readBy.length : 0})</h3>
                    <button onClick={() => setViewedByNotice(null)} className="text-green-800 hover:bg-green-100 p-1 rounded"><FaTimes /></button>
                </div>
                <div className="p-4 overflow-y-auto bg-slate-50 custom-scrollbar">
                    {viewedByNotice.readBy && viewedByNotice.readBy.length > 0 ? (
                        <div className="space-y-2">
                            {[...viewedByNotice.readBy].reverse().map((record, index) => (
                                <div key={index} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700">
                                            {record.employeeId?.name?.charAt(0) || "U"}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{record.employeeId?.name || "Unknown"}</p>
                                            <p className="text-[10px] text-slate-400">{record.employeeId?.employeeId || "N/A"}</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-[10px] text-slate-400">
                                        <p>{formatDateTime(record.readAt).date}</p>
                                        <p>{formatDateTime(record.readAt).time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400 italic">No one has viewed this yet.</div>
                    )}
                </div>
            </div>
        </div>
      )}

      {repliesNotice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setRepliesNotice(null)}></div>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden flex h-[80vh] animate-in fade-in zoom-in-95">
                
                {/* SIDEBAR */}
                <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-200 font-bold text-gray-700 bg-white">
                        Inbox
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {Object.keys(getGroupedReplies(repliesNotice)).length === 0 ? (
                            <p className="text-xs text-gray-400 p-4 text-center mt-10">No messages yet.</p>
                        ) : (
                            Object.entries(getGroupedReplies(repliesNotice)).map(([empId, data]) => {
                                const lastMsg = data.messages[data.messages.length - 1];
                                return (
                                    <div 
                                        key={empId}
                                        onClick={() => setSelectedChatEmployeeId(empId)}
                                        className={`p-3 cursor-pointer border-b border-gray-100 flex items-center gap-3 transition-colors ${selectedChatEmployeeId === empId ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : 'hover:bg-gray-100'}`}
                                    >
                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-700">
                                            {data.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <p className="text-sm font-bold text-gray-700 truncate">{data.name}</p>
                                                <span className="text-[9px] text-gray-400">{formatDateTime(lastMsg.repliedAt).time}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 truncate">
                                                {lastMsg.sentBy === 'Admin' ? 'You: ' : ''}{lastMsg.message}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                </div>

                {/* CHAT AREA */}
                <div className="w-2/3 flex flex-col bg-[#e5ddd5] relative"> 
                    <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
                    
                    {selectedChatEmployeeId ? (
                        <>
                            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white z-10 shadow-sm">
                                <h3 className="font-bold text-gray-800">{getGroupedReplies(repliesNotice)[selectedChatEmployeeId]?.name}</h3>
                                <button onClick={() => setRepliesNotice(null)} className="text-gray-400 hover:text-red-500 p-2"><FaTimes /></button>
                            </div>
                            
                            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-2 z-10">
                                {getGroupedReplies(repliesNotice)[selectedChatEmployeeId]?.messages.map((reply, i) => {
                                    const isAdmin = reply.sentBy === 'Admin';
                                    return (
                                        <div key={i} className={`flex w-full ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] p-2 px-3 rounded-lg relative shadow-sm text-sm ${
                                                isAdmin 
                                                ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' 
                                                : 'bg-white text-gray-800 rounded-tl-none'
                                            }`}>
                                                <div className="flex justify-between items-start gap-3">
                                                    <p className="leading-snug break-words">{reply.message}</p>
                                                    <button onClick={() => handleDeleteReply(repliesNotice._id, reply._id)} className="opacity-20 hover:opacity-100 text-[10px] text-gray-500 transition-opacity"><FaTrash /></button>
                                                </div>
                                                <div className="text-[9px] text-right text-gray-500 mt-1">
                                                    {formatDateTime(reply.repliedAt).time}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="p-3 bg-white z-10">
                                <div className="flex items-center gap-2 bg-white p-2 rounded-full border border-gray-300">
                                    <input 
                                        className="flex-1 text-sm outline-none px-2"
                                        placeholder="Type a message" 
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => { if(e.key === 'Enter') handleAdminReply(); }}
                                    />
                                    <button onClick={handleAdminReply} disabled={sendingReply || !replyText.trim()} className="bg-teal-600 text-white p-2 rounded-full hover:bg-teal-700 transition disabled:opacity-50">
                                        <FaPaperPlane />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 z-10">
                            <FaReply className="text-5xl mb-4 opacity-20" />
                            <p>Select a chat to start messaging</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* ✅ NEW NOTICE MODAL - MATCHING ATTACHED IMAGE EXACTLY */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative animate-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                {editingNoticeId ? 'Edit Notice' : 'New Notice'}
              </h2>
              <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                <FaTimes size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* Title Input */}
              <input 
                type="text"
                name="title"
                placeholder="Title"
                value={noticeData.title}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded p-3 text-sm focus:outline-none focus:border-black focus:ring-0 placeholder-gray-500 text-gray-900 transition-colors"
                required
              />

              {/* Description Input */}
              <textarea 
                name="description"
                placeholder="Description"
                value={noticeData.description}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded p-3 text-sm h-32 resize-none focus:outline-none focus:border-black focus:ring-0 placeholder-gray-500 text-gray-900 transition-colors"
                required
              />

              {/* Toggle Buttons */}
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setNoticeData(prev => ({ ...prev, sendTo: 'ALL' }))}
                  className={`flex-1 py-2.5 rounded text-sm font-medium border transition-colors ${
                    noticeData.sendTo === 'ALL' 
                      ? 'bg-blue-50 border-blue-200 text-blue-600' 
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  All
                </button>
                <button 
                  type="button" 
                  onClick={() => setNoticeData(prev => ({ ...prev, sendTo: 'SPECIFIC' }))}
                  className={`flex-1 py-2.5 rounded text-sm font-medium border transition-colors ${
                    noticeData.sendTo === 'SPECIFIC' 
                      ? 'bg-blue-50 border-blue-200 text-blue-600' 
                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Specific
                </button>
              </div>

              {/* Specific Dropdown */}
              {noticeData.sendTo === 'SPECIFIC' && (
                  <div className="relative animate-in fade-in slide-in-from-top-2 duration-200">
                      <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full p-2.5 bg-white border border-gray-300 rounded flex justify-between items-center cursor-pointer text-sm text-gray-700 hover:border-gray-400">
                          <span>{noticeData.recipients.length} Selected</span> <FaChevronDown size={12} className="text-gray-400"/>
                      </div>
                      {isDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-xl z-30 max-h-48 overflow-y-auto p-2">
                              <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 border-b border-gray-100 rounded-none mb-2 outline-none text-xs text-gray-600"/>
                              {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (
                                  <div key={emp._id} onClick={() => toggleEmployeeSelection(emp._id)} className="flex items-center gap-3 p-2 hover:bg-blue-50 cursor-pointer rounded text-sm text-gray-700 transition-colors">
                                      <div className={`w-4 h-4 border rounded flex items-center justify-center transition-colors ${noticeData.recipients.includes(emp._id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>{noticeData.recipients.includes(emp._id) && <FaCheck className="text-white text-[10px]"/>}</div>
                                      <span>{emp.name}</span>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              )}

              {/* Post Button */}
              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#0F172A] hover:bg-[#1e293b] text-white font-bold py-3 rounded text-sm transition-colors mt-2 shadow-sm"
              >
                {isSubmitting ? 'Posting...' : (editingNoticeId ? 'Update Notice' : 'Post')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotices;