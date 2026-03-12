// --- START OF FILE AdminNotices.jsx ---
// ✅ PRODUCTION-READY VERSION — All 127.0.0.1 localhost calls removed,
//    AI routed through your existing `api` instance, ghost text fixed,
//    chat UX polished, loading/error states hardened.

import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { getAllNoticesForAdmin, addNotice, getEmployees, deleteNoticeById, updateNotice, sendAdminReplyWithImage } from "../api";
import api from "../api";
import { AuthContext } from "../context/AuthContext";
import Swal from 'sweetalert2';
import {
  FaEdit, FaTrash, FaPlus, FaTimes, FaSearch, FaCheck,
  FaChevronDown, FaChevronUp, FaUserTag, FaEye, FaReply, FaPaperPlane,
  FaBullhorn, FaUserFriends, FaUsers, FaLayerGroup, FaUsersCog,
  FaSave, FaExclamationCircle, FaCommentDots, FaArrowLeft, FaRobot,
  FaPaperclip, FaVideo, FaCalendarAlt, FaClock, FaLink, FaExternalLinkAlt
} from 'react-icons/fa';
import { getAttendanceByDateRange } from "../api";

// ─── helpers ──────────────────────────────────────────────────────────────────
const getSecureUrl = (url) => {
  if (!url) return "";
  return url.startsWith("http:") ? url.replace("http:", "https:") : url;
};

// Debounce hook — cleaner than a ref+setTimeout in every handler
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// ─── component ────────────────────────────────────────────────────────────────
const AdminNotices = () => {
  const { user } = useContext(AuthContext);

  // ── form ──────────────────────────────────────────────────────────────────
  const initialFormState = { title: "", description: "", recipients: [], sendTo: "ALL", selectedGroupId: null };
  const [noticeData, setNoticeData]     = useState(initialFormState);
  const [notices, setNotices]           = useState([]);
  const [isLoadingNotices, setIsLoadingNotices] = useState(true);
  const initialLoadRef                  = useRef(true);
  const [employees, setEmployees]       = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employeeWorkingStatus, setEmployeeWorkingStatus] = useState({});

  // ── UI ────────────────────────────────────────────────────────────────────
  const [editingNoticeId, setEditingNoticeId]   = useState(null);
  const [isModalOpen, setIsModalOpen]           = useState(false);
  const [isDropdownOpen, setIsDropdownOpen]     = useState(false);
  const [searchTerm, setSearchTerm]             = useState("");

  // ── meeting ───────────────────────────────────────────────────────────────
  const DEFAULT_MEETING_LINK = "https://meet.google.com/tsn-vrih-zvx";
  const [isMeetingMode, setIsMeetingMode]       = useState(false);
  const [meetingParams, setMeetingParams]       = useState({ date: "", time: "" });
  const [meetingDescManual, setMeetingDescManual] = useState(false);
  const [meetingLink, setMeetingLink]           = useState(DEFAULT_MEETING_LINK);
  const [isLinkEditable, setIsLinkEditable]     = useState(false);

  // ── popups ────────────────────────────────────────────────────────────────
  const [expandedRecipientNoticeId, setExpandedRecipientNoticeId] = useState(null);
  const [viewedByNotice, setViewedByNotice]     = useState(null);
  const [repliesNotice, setRepliesNotice]       = useState(null);
  const [selectedChatEmployeeId, setSelectedChatEmployeeId] = useState(null);
  const [replyText, setReplyText]               = useState("");
  const [sendingReply, setSendingReply]         = useState(false);

  // ── image upload ──────────────────────────────────────────────────────────
  const [selectedFile, setSelectedFile]         = useState(null);
  const fileInputRef                            = useRef(null);
  const [previewImage, setPreviewImage]         = useState(null);
  const [employeeImages, setEmployeeImages]     = useState({});
  const lastUploadedImageRef                    = useRef(null);

  const staticQuickReplies = ["Ok", "Come To My Cabin", "Do It Fast", "Call me", "Update me when done"];
  const messagesEndRef = useRef(null);

  // ── read state ────────────────────────────────────────────────────────────
  const [readState, setReadState]               = useState({});
  const [readStateConfigId, setReadStateConfigId] = useState(null);

  // ── groups ────────────────────────────────────────────────────────────────
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groups, setGroups]                     = useState([]);
  const [groupConfigId, setGroupConfigId]       = useState(null);
  const [groupForm, setGroupForm]               = useState({ name: "", members: [] });
  const [editingGroupId, setEditingGroupId]     = useState(null);
  const [groupSearchTerm, setGroupSearchTerm]   = useState("");
  const [viewUnassigned, setViewUnassigned]     = useState(false);

  // ── AI title ──────────────────────────────────────────────────────────────
  const [ghostText, setGhostText]               = useState("");
  const [titleSuggestions, setTitleSuggestions] = useState([]);
  const [loadingSuggest, setLoadingSuggest]     = useState(false);
  const [aiGenerating, setAiGenerating]         = useState(false);
  // Use a REF for aiPaused — state would reset the debounce effect on every keystroke,
  // causing suggestions to re-appear immediately after generation/tab-accept.
  const aiPausedRef = useRef(false);

  const clearAiUI = () => {
    setGhostText("");
    setTitleSuggestions([]);
    setLoadingSuggest(false);
  };

  // Debounce the title so we don't fire on every keystroke
  const debouncedTitle = useDebounce(noticeData.title, 350);

  // ── AI effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    // If AI was paused (post-generation or post-tab-accept), skip and reset the pause
    // only AFTER the user has changed the title again (debouncedTitle changed = new intent)
    if (aiPausedRef.current) {
      // Reset pause now that user has typed something new — but still skip THIS run
      aiPausedRef.current = false;
      clearAiUI();
      return;
    }

    if (!debouncedTitle.trim() || isMeetingMode) {
      clearAiUI();
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const [autoRes, sugRes] = await Promise.allSettled([
          api.get("/api/ai/autocomplete", { params: { q: debouncedTitle } }),
          api.get("/api/ai/suggest",      { params: { q: debouncedTitle } }),
        ]);
        if (cancelled) return;
        if (autoRes.status === "fulfilled") setGhostText(autoRes.value.data?.completion || "");
        if (sugRes.status === "fulfilled")  setTitleSuggestions(sugRes.value.data?.suggestions || []);
      } catch {
        // silent — AI is optional, never break the form
      }
    };

    setLoadingSuggest(true);
    run().finally(() => { if (!cancelled) setLoadingSuggest(false); });
    return () => { cancelled = true; };
  }, [debouncedTitle, isMeetingMode]);

  // ─── read-state backend sync ──────────────────────────────────────────────
  const saveReadStateToBackend = async (updatedState) => {
    try {
      const payload = { title: "__SYSTEM_READ_STATE__", description: JSON.stringify(updatedState), recipients: [] };
      readStateConfigId ? await updateNotice(readStateConfigId, payload) : await addNotice(payload);
    } catch (error) {
      console.error("Failed to sync read state", error);
    }
  };

  // ─── groups backend sync ──────────────────────────────────────────────────
  const saveGroupsToBackend = async (updatedGroups) => {
    try {
      const payload = { title: "__SYSTEM_GROUPS_CONFIG__", description: JSON.stringify(updatedGroups), recipients: [] };
      groupConfigId ? await updateNotice(groupConfigId, payload) : await addNotice(payload);
      setGroups(updatedGroups);
    } catch {
      Swal.fire("Error", "Could not save groups to server.", "error");
    }
  };

  const handleSaveGroup = async () => {
    if (!groupForm.name.trim()) return Swal.fire("Error", "Group name is required", "error");
    if (!groupForm.members.length) return Swal.fire("Error", "Select at least one employee", "error");
    let updatedGroups;
    if (editingGroupId) {
      updatedGroups = groups.map(g => g.id === editingGroupId ? { ...g, name: groupForm.name, members: groupForm.members } : g);
      Swal.fire("Success", "Group updated", "success");
    } else {
      updatedGroups = [...groups, { id: Date.now().toString(), name: groupForm.name, members: groupForm.members }];
      Swal.fire("Success", "Group created", "success");
    }
    await saveGroupsToBackend(updatedGroups);
    resetGroupForm();
  };

  const handleEditGroup   = (group) => { setEditingGroupId(group.id); setGroupForm({ name: group.name, members: group.members }); setViewUnassigned(false); };
  const handleDeleteGroup = (groupId) => {
    if (!window.confirm("Delete this group?")) return;
    const updated = groups.filter(g => g.id !== groupId);
    saveGroupsToBackend(updated);
    if (editingGroupId === groupId) resetGroupForm();
  };
  const resetGroupForm = () => { setGroupForm({ name: "", members: [] }); setEditingGroupId(null); setGroupSearchTerm(""); setViewUnassigned(false); };
  const toggleGroupMemberSelection = (id) => {
    setGroupForm(prev => ({
      ...prev,
      members: prev.members.includes(id) ? prev.members.filter(m => m !== id) : [...prev.members, id]
    }));
  };
  const getUnassignedEmployees = () => {
    const assigned = new Set(groups.flatMap(g => g.members.map(String)));
    return employees.filter(e => !assigned.has(String(e._id)));
  };

  // ─── fetch notices ─────────────────────────────────────────────────────────
  const fetchNotices = useCallback(async () => {
    if (initialLoadRef.current) setIsLoadingNotices(true);
    try {
      const data = await getAllNoticesForAdmin();
      if (!Array.isArray(data)) return;

      try {
        const cfg = data.find(n => n.title === "__SYSTEM_GROUPS_CONFIG__");
        if (cfg) {
          setGroupConfigId(cfg._id);
          const parsed = JSON.parse(cfg.description);
          if (Array.isArray(parsed)) setGroups(prev => JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev);
        }
      } catch { /* ignore */ }

      try {
        const rc = data.find(n => n.title === "__SYSTEM_READ_STATE__");
        if (rc) {
          setReadStateConfigId(rc._id);
          const parsed = JSON.parse(rc.description);
          setReadState(prev => JSON.stringify(prev) !== JSON.stringify(parsed) ? parsed : prev);
        }
      } catch { /* ignore */ }

      const real = data
        .filter(n => n.title !== "__SYSTEM_GROUPS_CONFIG__" && n.title !== "__SYSTEM_READ_STATE__")
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      setNotices(prev => JSON.stringify(prev) !== JSON.stringify(real) ? real : prev);

      if (repliesNotice) {
        const updated = real.find(n => n._id === repliesNotice._id);
        if (!sendingReply && updated && JSON.stringify(updated.replies) !== JSON.stringify(repliesNotice.replies)) {
          setRepliesNotice(updated);
        }
      }
      if (viewedByNotice) {
        const updated = real.find(n => n._id === viewedByNotice._id);
        if (updated && JSON.stringify(updated.readBy) !== JSON.stringify(viewedByNotice.readBy)) setViewedByNotice(updated);
      }
    } catch (err) {
      console.error("Error fetching notices:", err);
    } finally {
      if (initialLoadRef.current) { setIsLoadingNotices(false); initialLoadRef.current = false; }
    }
  }, [repliesNotice, viewedByNotice, sendingReply]);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      if (Array.isArray(data)) setEmployees(data.filter(e => e.isActive !== false));
    } catch (err) { console.error("Error fetching employees:", err); }
  }, []);

  const fetchEmployeeWorkingStatus = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const attendance = await getAttendanceByDateRange(today, today);
      const map = {};
      employees.forEach(e => { map[e.employeeId] = "offline"; });
      if (Array.isArray(attendance)) {
        attendance.forEach(r => {
          if (r.punchIn && !r.punchOut) map[r.employeeId] = "online";
          else if (r.punchIn) map[r.employeeId] = "offline";
        });
      }
      setEmployeeWorkingStatus(prev => JSON.stringify(prev) !== JSON.stringify(map) ? map : prev);
    } catch { /* silent */ }
  }, [employees]);

  const isEmployeeWorking = useCallback(id => employeeWorkingStatus[id] === "online", [employeeWorkingStatus]);

  useEffect(() => { fetchNotices(); fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { if (employees.length > 0) fetchEmployeeWorkingStatus(); }, [employees, fetchEmployeeWorkingStatus]);
  useEffect(() => {
    const iv = setInterval(() => { fetchNotices(); if (employees.length > 0) fetchEmployeeWorkingStatus(); }, 2000);
    return () => clearInterval(iv);
  }, [fetchNotices, fetchEmployeeWorkingStatus, employees.length]);

  // ─── sidebar profile pictures ──────────────────────────────────────────────
  useEffect(() => {
    if (!repliesNotice?.replies || !employees.length) return;
    const ids = new Set(
      repliesNotice.replies.filter(r => r.sentBy === "Employee").map(r => r.employeeId?._id || r.employeeId).filter(Boolean)
    );
    ids.forEach(async id => {
      const emp = employees.find(e => e._id === id);
      if (emp?.employeeId && !employeeImages[emp.employeeId]) {
        try {
          const res = await api.get(`/api/profile/${emp.employeeId}`);
          if (res?.data?.profilePhoto?.url) {
            setEmployeeImages(prev => ({ ...prev, [emp.employeeId]: getSecureUrl(res.data.profilePhoto.url) }));
          }
        } catch { /* silent */ }
      }
    });
  }, [repliesNotice, employees]);

  // auto-scroll chat
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [repliesNotice, selectedChatEmployeeId]);

  // mark read
  useEffect(() => {
    if (!repliesNotice || !selectedChatEmployeeId || selectedChatEmployeeId === "ALL_EMPLOYEES") return;
    const msgs = repliesNotice.replies.filter(r => (r.employeeId?._id || r.employeeId) === selectedChatEmployeeId && r.sentBy === "Employee");
    if (!msgs.length) return;
    const latestId = msgs[msgs.length - 1]._id;
    const key = `${repliesNotice._id}_${selectedChatEmployeeId}`;
    if (readState[key] !== latestId) {
      const next = { ...readState, [key]: latestId };
      setReadState(next);
      saveReadStateToBackend(next);
    }
  }, [repliesNotice, selectedChatEmployeeId]);

  // ─── handlers ─────────────────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (isMeetingMode && name === "description") setMeetingDescManual(true);
    setNoticeData(prev => ({ ...prev, [name]: value }));
  };

  const toggleEmployeeSelection = (id) => {
    setNoticeData(prev => ({
      ...prev,
      recipients: prev.recipients.includes(id) ? prev.recipients.filter(r => r !== id) : [...prev.recipients, id]
    }));
  };

  const updateMeetingDescription = (date, time, link) => {
    if (meetingDescManual) return;
    setNoticeData(prev => ({
      ...prev,
      description: `Dear Candidate,\n\nYou are requested to join the scheduled meeting ${date || "{date}"} at ${time || "{time}"} as per the shared details. Please ensure you join on time and stay available for discussion.\n\nMeeting Link: ${link || "{link}"}`
    }));
  };

  const handleMeetingParamChange = (e) => {
    const { name, value } = e.target;
    const next = { ...meetingParams, [name]: value };
    setMeetingParams(next);
    updateMeetingDescription(next.date, next.time, meetingLink);
  };

  const handleLinkChange = (e) => {
    setMeetingLink(e.target.value);
    updateMeetingDescription(meetingParams.date, meetingParams.time, e.target.value);
  };

  const openModal = (notice = null) => {
    setIsMeetingMode(false);
    aiPausedRef.current = false;
    clearAiUI();
    if (notice) {
      setEditingNoticeId(notice._id);
      const detectedLink = (notice.description?.match(/(https?:\/\/[^\s]+)/) || [])[0];
      const dateMatch    = notice.description?.match(/scheduled meeting\s+(\d{4}-\d{2}-\d{2})/i);
      const timeMatch    = notice.description?.match(/at\s+(\d{2}:\d{2})/i);
      if (detectedLink && dateMatch && timeMatch) {
        setIsMeetingMode(true);
        setMeetingParams({ date: dateMatch[1], time: timeMatch[1] });
        setMeetingLink(detectedLink);
        setIsLinkEditable(false);
        const tpl = `Dear Candidate,\n\nYou are requested to join the scheduled meeting ${dateMatch[1]} at ${timeMatch[1]} as per the shared details. Please ensure you join on time and stay available for discussion.\n\nMeeting Link: ${detectedLink}`;
        setMeetingDescManual(notice.description.trim() !== tpl.trim());
      } else {
        setMeetingDescManual(false);
      }
      const isSpecific = Array.isArray(notice.recipients) && notice.recipients.length > 0;
      const matchedGroup = isSpecific ? groups.find(g => g.members.length === notice.recipients.length && g.members.every(m => notice.recipients.includes(m))) : null;
      setNoticeData({
        title: notice.title, description: notice.description, recipients: isSpecific ? notice.recipients : [],
        sendTo: matchedGroup ? "GROUP" : (isSpecific ? "SPECIFIC" : "ALL"),
        selectedGroupId: matchedGroup ? matchedGroup.id : null
      });
    } else {
      setEditingNoticeId(null);
      setNoticeData(initialFormState);
    }
    setIsModalOpen(true);
  };

  const openMeetingModal = () => {
    setEditingNoticeId(null);
    setNoticeData({ ...initialFormState, title: "📅 Scheduled Meeting" });
    setMeetingParams({ date: "", time: "" });
    setMeetingLink(DEFAULT_MEETING_LINK);
    setIsLinkEditable(false);
    setIsMeetingMode(true);
    setMeetingDescManual(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingNoticeId(null);
    setNoticeData(initialFormState);
    setIsDropdownOpen(false);
    setSearchTerm("");
    setIsMeetingMode(false);
    clearAiUI();
    aiPausedRef.current = false;
  };

  const handleNoticeGroupSelect = (group) => {
    setNoticeData(prev => ({ ...prev, selectedGroupId: group.id, recipients: group.members }));
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({ title: "Delete Notice?", text: "This action cannot be undone.", icon: "warning", showCancelButton: true, confirmButtonColor: "#ef4444", cancelButtonColor: "#6b7280", confirmButtonText: "Yes, Delete" });
    if (!result.isConfirmed) return;
    try { await deleteNoticeById(id); Swal.fire("Deleted", "Notice removed successfully.", "success"); fetchNotices(); }
    catch  { Swal.fire("Error", "Failed to delete.", "error"); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isMeetingMode) {
      if (!meetingParams.date || !meetingParams.time) return Swal.fire("Error", "Please select both date and time.", "error");
      if (!meetingLink) return Swal.fire("Error", "Meeting link is required.", "error");
    }
    setIsSubmitting(true);
    try {
      const finalRecipients = noticeData.sendTo === "ALL" ? "ALL" : noticeData.recipients;
      if (editingNoticeId) {
        await updateNotice(editingNoticeId, { title: noticeData.title, description: noticeData.description, recipients: finalRecipients });
        Swal.fire("Updated", "Notice updated successfully.", "success");
      } else {
        await addNotice({ title: noticeData.title, description: noticeData.description, recipients: finalRecipients === "ALL" ? [] : finalRecipients });
        Swal.fire("Posted", isMeetingMode ? "Meeting scheduled successfully." : "Notice sent successfully.", "success");
      }
      closeModal();
      fetchNotices();
    } catch { Swal.fire("Error", "Something went wrong.", "error"); }
    finally { setIsSubmitting(false); }
  };

  // ── AI generate description ────────────────────────────────────────────────
  // ✅ FIXED: All AI calls now go through `api` (your backend proxy), NOT localhost
  const handleAiGenerate = async () => {
    const title = noticeData.title.trim();
    if (!title) return Swal.fire("Info", "Enter a title first to generate with AI.", "info");
    setAiGenerating(true);
    aiPausedRef.current = true;  // pause suggestions after generate — ref won't re-trigger effect
    clearAiUI();
    try {
      const res = await api.post("/api/ai/generate", { title });
      setNoticeData(prev => ({ ...prev, description: res.data.description || "" }));
    } catch {
      Swal.fire("Error", "AI generation failed. Please try again.", "error");
    } finally {
      setAiGenerating(false);
    }
  };

  // ── reply AI enhance ──────────────────────────────────────────────────────
  // ✅ FIXED: Was calling 127.0.0.1:8000 — now routes through `/api/ai/reply-enhance`
  const handleAiReplyEnhance = async () => {
    if (!replyText.trim()) return Swal.fire("Info", "Type something first to enhance.", "info");
    try {
      const res = await api.post("/api/ai/reply-enhance", { prompt: replyText });
      setReplyText(res.data.text || replyText);
    } catch {
      Swal.fire("Error", "AI enhancement failed.", "error");
    }
  };

  // ── file handlers ─────────────────────────────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { Swal.fire("Error", "File too large. Max 5MB.", "error"); return; }
    setSelectedFile(file);
  };
  const clearSelectedFile = () => { setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  // ── admin reply ───────────────────────────────────────────────────────────
  const handleAdminReply = async (manualText = null) => {
    const text = manualText || replyText;
    if (!text?.trim() && !selectedFile) return;
    if (!repliesNotice || !selectedChatEmployeeId) return;

    let tempImageUrl = null;
    if (selectedFile) {
      tempImageUrl = URL.createObjectURL(selectedFile);
      lastUploadedImageRef.current = { url: tempImageUrl, timestamp: Date.now() };
    }

    const optimistic = {
      _id: Date.now(), message: text, image: tempImageUrl, sentBy: "Admin",
      repliedAt: new Date().toISOString(),
      employeeId: selectedChatEmployeeId === "ALL_EMPLOYEES" ? null : selectedChatEmployeeId,
      isSending: true
    };

    setRepliesNotice(prev => ({ ...prev, replies: [...(prev.replies || []), optimistic] }));
    setReplyText("");
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSendingReply(true);

    try {
      if (selectedChatEmployeeId === "ALL_EMPLOYEES") {
        const ids = [...new Set(repliesNotice.replies.map(r => r.employeeId?._id || r.employeeId).filter(Boolean))];
        await Promise.all(ids.map(empId => {
          if (selectedFile) {
            const fd = new FormData(); fd.append("message", text); fd.append("targetEmployeeId", empId); fd.append("image", selectedFile);
            return sendAdminReplyWithImage(repliesNotice._id, fd);
          }
          return api.post(`/api/notices/${repliesNotice._id}/admin-reply`, { message: text, targetEmployeeId: empId });
        }));
      } else if (selectedFile) {
        const fd = new FormData(); fd.append("message", text); fd.append("targetEmployeeId", selectedChatEmployeeId); fd.append("image", selectedFile);
        await sendAdminReplyWithImage(repliesNotice._id, fd);
      } else {
        await api.post(`/api/notices/${repliesNotice._id}/admin-reply`, { message: text, targetEmployeeId: selectedChatEmployeeId });
      }
      await fetchNotices();
    } catch {
      Swal.fire("Error", "Failed to send reply", "error");
    } finally {
      setSendingReply(false);
    }
  };

  const handleDeleteReply = async (noticeId, replyId, sentBy, msg, time) => {
    if (!window.confirm("Delete this message?")) return;
    try {
      if (selectedChatEmployeeId === "ALL_EMPLOYEES" && sentBy === "Admin") {
        const tgt = new Date(time).getTime();
        const matches = repliesNotice.replies.filter(r => r.sentBy === "Admin" && r.message === msg && Math.abs(new Date(r.repliedAt).getTime() - tgt) < 2000);
        await Promise.all(matches.length ? matches.map(m => api.delete(`/api/notices/${noticeId}/reply/${m._id}`)) : [api.delete(`/api/notices/${noticeId}/reply/${replyId}`)]);
      } else {
        await api.delete(`/api/notices/${noticeId}/reply/${replyId}`);
      }
      fetchNotices();
    } catch { Swal.fire("Error", "Failed to delete message", "error"); }
  };

  // ── grouped replies / unread ───────────────────────────────────────────────
  const getGroupedReplies = (notice) => {
    if (!notice?.replies) return {};
    const grouped = notice.replies.reduce((acc, r) => {
      const id = r.employeeId?._id || r.employeeId;
      if (!id) return acc;
      if (!acc[id]) acc[id] = { name: r.employeeId?.name || "Unknown", messages: [], hasUnread: false, employeeId: id };
      acc[id].messages.push(r);
      return acc;
    }, {});
    Object.keys(grouped).forEach(id => {
      const last = [...grouped[id].messages].reverse().find(m => m.sentBy === "Employee");
      if (last) {
        const key = `${notice._id}_${id}`;
        grouped[id].hasUnread = selectedChatEmployeeId !== id && readState[key] !== last._id && grouped[id].messages.some(m => m.sentBy === "Employee" && !m.isRead);
      }
    });
    return grouped;
  };

  const handleChatSelection = async (empId) => {
    setSelectedChatEmployeeId(empId);
    if (empId === "ALL_EMPLOYEES") {
      const ids = [...new Set(repliesNotice.replies.map(r => r.employeeId?._id || r.employeeId).filter(Boolean))];
      const newMap = { ...readState };
      ids.forEach(uid => {
        const msgs = repliesNotice.replies.filter(r => (r.employeeId?._id || r.employeeId) === uid && r.sentBy === "Employee");
        if (msgs.length) newMap[`${repliesNotice._id}_${uid}`] = msgs[msgs.length - 1]._id;
      });
      setReadState(newMap);
      saveReadStateToBackend(newMap);
      setRepliesNotice(p => ({ ...p, replies: p.replies.map(r => ({ ...r, isRead: true })) }));
      try { await Promise.all(ids.map(uid => api.put(`/api/notices/${repliesNotice._id}/reply/read/${uid}`))); fetchNotices(); } catch { /* silent */ }
      return;
    }
    const msgs = repliesNotice.replies.filter(r => (r.employeeId?._id || r.employeeId) === empId && r.sentBy === "Employee");
    if (msgs.length) {
      const key = `${repliesNotice._id}_${empId}`;
      const next = { ...readState, [key]: msgs[msgs.length - 1]._id };
      setReadState(next); saveReadStateToBackend(next);
    }
    setRepliesNotice(p => ({ ...p, replies: p.replies.map(r => { const id = r.employeeId?._id || r.employeeId; return id === empId && r.sentBy === "Employee" ? { ...r, isRead: true } : r; }) }));
    try { await api.put(`/api/notices/${repliesNotice._id}/reply/read/${empId}`); fetchNotices(); } catch { /* silent */ }
  };

  const formatDateTime = (ds) => {
    const d = new Date(ds);
    return {
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      time: d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    };
  };

  const getRecipientNamesList = (ids) => (ids || []).map(id => employees.find(e => e._id === id)?.name || "Unknown");
  const findEmployeeByEmployeeId = (id) => employees.find(e => e._id === id || e.employeeId === id);
  const getGroupNameForNotice = (ids) => {
    if (!ids?.length) return null;
    const set = new Set(ids);
    return groups.find(g => g.members.length === ids.length && g.members.every(m => set.has(m)))?.name || null;
  };

  const getSmartReplies = (messages) => {
    let replies = [...staticQuickReplies];
    const lastEmp = [...(messages || [])].reverse().find(m => m.sentBy === "Employee");
    if (lastEmp) {
      const t = lastEmp.message.toLowerCase();
      if (t.includes("hi") || t.includes("hello")) replies = ["Hello!", "Hi there", ...replies];
      if (t.includes("thank")) replies = ["You're welcome", "No problem", ...replies];
      if (t.includes("done") || t.includes("completed")) replies = ["Great work", "Thanks for the update", ...replies];
      if (t.includes("leave")) replies = ["Get well soon", "Approved", ...replies];
    }
    return [...new Set(replies)];
  };

  // ─── render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans pb-24">

      {/* ── HEADER ── */}
      <div className="relative bg-white rounded-3xl border-emerald-100 z-10 max-w-4xl mx-auto px-4 mt-8 space-y-6">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-400 rounded-xl flex items-center justify-center shadow-sm shadow-emerald-100">
                <FaBullhorn className="text-white text-xl" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full border-2 border-emerald-500" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">Team <span className="text-emerald-600">Announcements</span></h1>
              <p className="text-sm text-gray-600 font-medium mt-1">Share important updates and keep everyone informed</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setIsGroupModalOpen(true)} className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-lg font-semibold shadow-sm transition-all duration-200 border border-indigo-200">
              <FaUsersCog className="text-lg" /><span className="hidden sm:inline">Manage Groups</span>
            </button>
            <button onClick={openMeetingModal} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all duration-200 border border-indigo-700/20">
              <FaVideo className="text-sm" /><span className="hidden sm:inline">Create Meeting</span>
            </button>
            <button onClick={() => openModal()} className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-lg font-semibold shadow-sm hover:shadow transition-all duration-200 border border-emerald-600/20">
              <FaPlus className="text-sm" /><span className="hidden sm:inline">Create Announcement</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── NOTICE FEED ── */}
      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-6">
        {isLoadingNotices && notices.length === 0 ? (
          <div className="text-center py-24"><p className="mt-4 text-gray-600">Loading notices…</p></div>
        ) : notices.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-300 mx-4">
            <div className="text-5xl mb-4 grayscale opacity-30">📯</div>
            <p className="text-slate-400 text-lg font-medium">No active notices.</p>
            <p className="text-slate-300 text-sm">Create one to notify your team.</p>
          </div>
        ) : notices.map(notice => {
          const { date, time }         = formatDateTime(notice.date);
          const isSpecific             = Array.isArray(notice.recipients) && notice.recipients.length > 0;
          const recipientNames         = isSpecific ? getRecipientNamesList(notice.recipients) : [];
          const isExpandedRecipients   = expandedRecipientNoticeId === notice._id;
          const groupName              = isSpecific ? getGroupNameForNotice(notice.recipients) : null;
          const viewCount              = notice.readBy?.length || 0;
          const groupedChats           = getGroupedReplies(notice);
          const activeChatCount        = Object.keys(groupedChats).length;
          const unreadCount            = Object.values(groupedChats).filter(g => g.hasUnread).length;
          const detectedLink           = (notice.description?.match(/(https?:\/\/[^\s]+)/) || [])[0];
          const isMeeting              = detectedLink && (notice.title.toLowerCase().includes("meeting") || notice.description.toLowerCase().includes("meeting") || notice.description.includes("meet.google"));
          const sideBarColor = isMeeting ? "bg-gradient-to-b from-rose-500 to-pink-500" : isSpecific ? (groupName ? "bg-gradient-to-b from-indigo-600 to-violet-600" : "bg-gradient-to-b from-amber-500 to-orange-500") : "bg-gradient-to-b from-blue-500 to-cyan-500";
          const borderColor  = isMeeting ? "border-rose-100" : isSpecific ? (groupName ? "border-indigo-100" : "border-orange-100") : "border-slate-100";

          return (
            <div key={notice._id} className={`group relative bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 border ${borderColor} overflow-visible`}>
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl ${sideBarColor}`} />
              <div className="p-6 pl-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                        By: {notice.createdBy?.name || user?.name || "System"} ({notice.createdBy?.employeeId || user?.employeeId || "Admin"})
                      </span>
                      {isMeeting && <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-rose-200"><FaVideo /> Meeting</span>}
                      {isSpecific ? (groupName
                        ? <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-200"><FaLayerGroup /> {groupName}</span>
                        : <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-200">🔒 Specific</span>)
                        : <span className="inline-flex items-center gap-1.5 bg-cyan-50 text-cyan-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-cyan-200">📢 Everyone</span>}
                      {isSpecific && <button onClick={() => setExpandedRecipientNoticeId(p => p === notice._id ? null : notice._id)} className="flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors bg-slate-50 px-3 py-1 rounded-full cursor-pointer hover:bg-slate-100">{recipientNames.length} Cands {isExpandedRecipients ? <FaChevronUp /> : <FaChevronDown />}</button>}
                      <button onClick={() => setViewedByNotice(notice)} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-green-600 transition-colors bg-green-50 px-3 py-1 rounded-full border border-green-100 cursor-pointer"><FaEye /> {viewCount}</button>
                      {activeChatCount > 0 && (
                        <button onClick={() => { setRepliesNotice(notice); setSelectedChatEmployeeId(null); }} className="relative flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border cursor-pointer bg-white text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">
                          <FaCommentDots className="text-indigo-500" /> {activeChatCount} Chats
                          {unreadCount > 0 && <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[9px] text-white font-bold border-2 border-white shadow-sm">{unreadCount}</span>}
                        </button>
                      )}
                    </div>
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out origin-top ${isExpandedRecipients ? "max-h-60 opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 shadow-inner">
                        <div className="flex flex-wrap gap-2">{recipientNames.map((name, i) => <span key={i} className="flex items-center gap-1 bg-white text-slate-700 text-xs font-semibold px-2 py-1 rounded border border-slate-200 shadow-sm"><FaUserTag className="text-slate-300" /> {name}</span>)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 self-start whitespace-nowrap">
                    <span>{date}</span><span className="h-3 w-px bg-slate-300" /><span>{time}</span>
                  </div>
                </div>
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-700 transition-colors">{notice.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{notice.description}</p>
                  {isMeeting && detectedLink && (
                    <div className="mt-4">
                      <a href={detectedLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg font-bold text-sm shadow-md hover:shadow-lg transition-all">
                        <FaVideo /> Join Now
                      </a>
                    </div>
                  )}
                </div>
                <div className="pt-4 border-t border-slate-50 flex justify-end gap-2 opacity-100 sm:opacity-0 sm:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                  <button onClick={() => openModal(notice)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors shadow-sm"><FaEdit /> Edit</button>
                  <button onClick={() => handleDelete(notice._id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-sm"><FaTrash /> Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── VIEWED BY MODAL ── */}
      {viewedByNotice && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setViewedByNotice(null)} />
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative z-10 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-green-100 flex justify-between items-center bg-green-50">
              <h3 className="font-bold text-green-800 flex items-center gap-2"><FaEye /> Viewed By ({viewedByNotice.readBy?.length || 0})</h3>
              <button onClick={() => setViewedByNotice(null)} className="text-green-800 hover:bg-green-100 p-1 rounded"><FaTimes /></button>
            </div>
            <div className="p-4 overflow-y-auto bg-slate-50">
              {viewedByNotice.readBy?.length ? (
                <div className="space-y-2">
                  {[...viewedByNotice.readBy].reverse().map((r, i) => (
                    <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700">{r.employeeId?.name?.charAt(0) || "U"}</div>
                        <div><p className="text-sm font-bold text-slate-700">{r.employeeId?.name || "Unknown"}</p><p className="text-[10px] text-slate-400">{r.employeeId?.employeeId || "N/A"}</p></div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400"><p>{formatDateTime(r.readAt).date}</p><p>{formatDateTime(r.readAt).time}</p></div>
                    </div>
                  ))}
                </div>
              ) : <div className="text-center py-8 text-slate-400 italic">No one has viewed this yet.</div>}
            </div>
          </div>
        </div>
      )}

      {/* ── FULL SCREEN CHAT MODAL ── */}
      {repliesNotice && (
        <div className="fixed inset-0 z-[120] bg-white flex flex-col md:flex-row">
          {/* Mobile header */}
          <div className="md:hidden bg-slate-800 text-white p-4 flex items-center justify-between shadow-md z-20">
            <div className="flex items-center gap-3">
              <button onClick={() => selectedChatEmployeeId ? setSelectedChatEmployeeId(null) : setRepliesNotice(null)} className="text-white"><FaArrowLeft /></button>
              <span className="font-bold truncate">{selectedChatEmployeeId ? (selectedChatEmployeeId === "ALL_EMPLOYEES" ? "Group Chat" : "Chat") : "Messages"}</span>
            </div>
          </div>

          {/* SIDEBAR */}
          <div className={`w-full md:w-[350px] bg-slate-100 border-r border-slate-200 flex flex-col h-full ${selectedChatEmployeeId ? "hidden md:flex" : "flex"}`}>
            <div className="hidden md:flex bg-slate-800 text-white p-4 items-start gap-4 shadow-sm">
              <h2 className="font-bold flex items-center gap-2 whitespace-nowrap"><FaCommentDots /> Inbox</h2>
              <h2 className="flex-1 font-semibold text-base leading-snug break-words">{repliesNotice.title}</h2>
              <button onClick={() => setRepliesNotice(null)} className="hover:bg-slate-700 p-2 rounded-full self-start"><FaTimes /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div onClick={() => handleChatSelection("ALL_EMPLOYEES")} className={`p-4 cursor-pointer border-b border-slate-200 flex items-center gap-3 hover:bg-white transition-colors ${selectedChatEmployeeId === "ALL_EMPLOYEES" ? "bg-white border-l-4 border-l-indigo-600" : ""}`}>
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-lg"><FaUsers /></div>
                <div><h4 className="font-bold text-slate-800">Team Chat</h4><p className="text-xs text-slate-500">All responses in one place</p></div>
              </div>
              {!Object.keys(getGroupedReplies(repliesNotice)).length ? (
                <div className="text-center py-10 text-slate-400"><p>No private replies yet.</p></div>
              ) : Object.entries(getGroupedReplies(repliesNotice)).map(([empId, data]) => {
                const last    = data.messages[data.messages.length - 1];
                const emp     = findEmployeeByEmployeeId(empId);
                const online  = emp ? isEmployeeWorking(emp.employeeId) : false;
                const pic     = emp?.employeeId ? employeeImages[emp.employeeId] : null;
                return (
                  <div key={empId} onClick={() => handleChatSelection(empId)} className={`p-4 cursor-pointer border-b border-slate-200 flex items-center gap-3 hover:bg-white transition-colors relative ${selectedChatEmployeeId === empId ? "bg-white border-l-4 border-l-indigo-600 shadow-sm" : ""}`}>
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-white border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-lg shadow-sm overflow-hidden" onClick={e => { if (pic) { e.stopPropagation(); setPreviewImage(pic); } }}>
                        {pic ? <img src={pic} alt={data.name} className="w-full h-full object-cover hover:opacity-80 transition-opacity cursor-zoom-in" /> : data.name.charAt(0)}
                      </div>
                      {data.hasUnread && selectedChatEmployeeId !== empId && <span className="absolute -top-1 -right-1 flex h-4 w-4 bg-red-500 rounded-full border-2 border-white" />}
                      {online && <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className={`truncate ${data.hasUnread && selectedChatEmployeeId !== empId ? "font-extrabold text-slate-900" : "font-semibold text-slate-700"}`}>{data.name}</h4>
                        <span className="text-[10px] text-slate-400">{formatDateTime(last.repliedAt).time}</span>
                      </div>
                      <p className={`text-xs truncate ${data.hasUnread && selectedChatEmployeeId !== empId ? "font-bold text-slate-800" : "text-slate-500"}`}>{last.sentBy === "Admin" && "You: "}{last.message || "Image"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CHAT AREA */}
          <div className={`flex-1 bg-white flex flex-col h-full ${!selectedChatEmployeeId ? "hidden md:flex" : "flex"}`}>
            {selectedChatEmployeeId ? (() => {
              let displayMessages = [], chatTitle = "", subText = "";
              const grouped = getGroupedReplies(repliesNotice);

              if (selectedChatEmployeeId === "ALL_EMPLOYEES") {
                chatTitle = "Team Chat (Broadcast)";
                const participants = new Set(repliesNotice.replies.map(r => r.employeeId?._id || r.employeeId).filter(Boolean));
                let onlineCount = 0;
                participants.forEach(pid => { const e = employees.find(x => x._id === pid || x.employeeId === pid); if (e && isEmployeeWorking(e.employeeId)) onlineCount++; });
                subText = `${onlineCount} Online, ${participants.size - onlineCount} Offline`;
                const all = [...(repliesNotice.replies || [])].sort((a, b) => new Date(a.repliedAt) - new Date(b.repliedAt));
                const isMulti = participants.size > 1;
                let cluster = [];
                const flush = (c) => { if (!isMulti) displayMessages.push(c[0]); else if (c.length > 1) displayMessages.push(c[0]); };
                all.forEach(m => {
                  if (m.sentBy === "Employee") { if (cluster.length) { flush(cluster); cluster = []; } displayMessages.push(m); }
                  else {
                    if (!cluster.length) { cluster.push(m); }
                    else { const last = cluster[cluster.length - 1]; if (m.message === last.message && new Date(m.repliedAt) - new Date(last.repliedAt) < 2000) cluster.push(m); else { flush(cluster); cluster = [m]; } }
                  }
                });
                if (cluster.length) flush(cluster);
              } else {
                const emp = findEmployeeByEmployeeId(selectedChatEmployeeId);
                chatTitle = emp?.name || "Unknown User";
                const online = emp ? isEmployeeWorking(emp.employeeId) : false;
                subText = online ? "● Online" : "● Offline";
                displayMessages = grouped[selectedChatEmployeeId]?.messages || [];
              }

              const smartReplies = getSmartReplies(displayMessages);

              return (
                <>
                  {/* Chat header */}
                  <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shadow-sm z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">{selectedChatEmployeeId === "ALL_EMPLOYEES" ? <FaUsers /> : chatTitle.charAt(0)}</div>
                      <div>
                        <h3 className="font-bold text-slate-800 text-lg leading-tight">{chatTitle}</h3>
                        <span className={`text-xs flex items-center gap-1 font-medium ${subText.includes("Online") ? "text-green-600" : "text-slate-400"}`}>{subText}</span>
                      </div>
                    </div>
                    <button onClick={() => setRepliesNotice(null)} className="hidden md:block hover:bg-slate-100 p-2 rounded-full text-slate-500"><FaTimes size={20} /></button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 bg-[#f5f5f5]">
                    <div className="flex justify-center mb-4">
                      <div className="bg-indigo-50 text-indigo-800 px-4 py-2 rounded-lg text-sm max-w-lg text-center border border-indigo-100 shadow-sm">
                        <strong className="block text-xs uppercase tracking-wider mb-1 text-indigo-400">Context</strong>
                        "{repliesNotice.description}"
                      </div>
                    </div>
                    {displayMessages.map((msg, i) => {
                      const isAdmin = msg.sentBy === "Admin";
                      const msgEmp  = findEmployeeByEmployeeId(msg.employeeId?._id || msg.employeeId);
                      let imgSrc    = msg.image;
                      const isLast  = i === displayMessages.length - 1;
                      if (isAdmin && isLast && !msg.isSending && lastUploadedImageRef.current && Date.now() - lastUploadedImageRef.current.timestamp < 30000) {
                        imgSrc = lastUploadedImageRef.current.url;
                      }
                      return (
                        <div key={i} className={`flex w-full ${isAdmin ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[75%] md:max-w-[60%] p-4 rounded-2xl text-sm shadow-sm relative group ${isAdmin ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"}`}>
                            {!isAdmin && (
                              <div className="text-[10px] font-bold text-indigo-500 mb-1 border-b border-slate-100 pb-1 flex justify-between gap-4">
                                <span>{msgEmp?.name || "User"}</span><span className="text-slate-400 font-normal">{msgEmp?.employeeId || ""}</span>
                              </div>
                            )}
                            {imgSrc && (
                              <div className="mb-2 relative cursor-pointer" onClick={() => !msg.isSending && setPreviewImage(imgSrc)}>
                                <img src={imgSrc} alt="attachment" className={`rounded-lg max-w-full max-h-48 object-cover border border-black/10 transition-opacity ${msg.isSending ? "opacity-70" : "hover:opacity-90"}`} />
                                {msg.isSending && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg"><div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" /></div>}
                              </div>
                            )}
                            <p className="leading-relaxed">{msg.message}</p>
                            <div className={`text-[10px] mt-2 text-right ${isAdmin ? "text-indigo-200" : "text-slate-400"}`}>{formatDateTime(msg.repliedAt).time}</div>
                            {!msg.isSending && <button onClick={() => handleDeleteReply(repliesNotice._id, msg._id, msg.sentBy, msg.message, msg.repliedAt)} className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-black/10 ${isAdmin ? "text-white" : "text-slate-500"}`}><FaTrash size={10} /></button>}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input area */}
                  <div className="p-4 bg-white border-t border-slate-200">
                    {selectedFile && (
                      <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <img src={URL.createObjectURL(selectedFile)} alt="Preview" className="w-10 h-10 object-cover rounded bg-white border" />
                          <div><p className="text-xs font-bold text-slate-700 truncate max-w-[200px]">{selectedFile.name}</p><p className="text-[10px] text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p></div>
                        </div>
                        <button onClick={clearSelectedFile} className="text-slate-400 hover:text-red-500"><FaTimes /></button>
                      </div>
                    )}
                    <div className="flex gap-2 overflow-x-auto pb-3">
                      <div className="flex items-center gap-1 text-xs font-bold text-indigo-400 px-2 select-none"><FaRobot /> AI Suggestions:</div>
                      {smartReplies.map((r, i) => (
                        <button key={i} onClick={() => setReplyText(r)} className="whitespace-nowrap px-4 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-slate-600 text-xs font-medium hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">{r}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />
                      <button onClick={() => fileInputRef.current.click()} className={`p-2 rounded-full hover:bg-slate-200 transition-colors ${selectedFile ? "text-indigo-600 bg-indigo-50" : "text-slate-500"}`}><FaPaperclip /></button>
                      <input
                        className="flex-1 bg-transparent px-4 py-2 outline-none text-slate-700 placeholder-slate-400"
                        placeholder="Type your message…"
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleAdminReply()}
                      />
                      {/* ✅ AI Enhance — now routes through /api/ai/reply-enhance (not localhost) */}
                      <button type="button" onClick={handleAiReplyEnhance} title="Enhance with AI" className="w-10 h-10 flex items-center justify-center bg-slate-200 text-slate-700 rounded-lg hover:bg-indigo-200 transition-all">
                        <FaRobot />
                      </button>
                      <button onClick={() => handleAdminReply()} disabled={(!replyText.trim() && !selectedFile) || sendingReply} className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-all">
                        {sendingReply ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FaPaperPlane />}
                      </button>
                    </div>
                  </div>
                </>
              );
            })() : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/50">
                <FaCommentDots className="text-6xl mb-4 text-slate-200" />
                <h3 className="text-xl font-bold text-slate-400">Select a conversation</h3>
                <p className="text-slate-400">Choose a chat from the sidebar to start messaging</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {previewImage && (
        <div className="fixed inset-0 z-[130] bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <button className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full bg-white/10 backdrop-blur-sm"><FaTimes size={24} /></button>
          <img src={previewImage} alt="Full Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* ── MANAGE GROUPS MODAL ── */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col md:flex-row overflow-hidden">
            {/* Left panel */}
            <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 flex flex-col">
              <div className="p-5 border-b border-slate-200 bg-white"><h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FaLayerGroup className="text-indigo-600" /> My Groups</h3></div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {!groups.length && <div className="text-center py-10 text-slate-400"><p>No groups created yet.</p></div>}
                {groups.map(g => (
                  <div key={g.id} onClick={() => handleEditGroup(g)} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex justify-between items-center cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all">
                    <div className="min-w-0 flex-1"><h4 className="font-bold text-slate-700 truncate">{g.name}</h4><p className="text-xs text-slate-500">{g.members.length} members</p></div>
                    <button onClick={e => { e.stopPropagation(); handleDeleteGroup(g.id); }} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"><FaTrash /></button>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-100 border-t border-slate-200">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">System</div>
                <div onClick={() => { setViewUnassigned(true); resetGroupForm(); }} className={`bg-white p-3 rounded-lg border shadow-sm cursor-pointer transition-all ${viewUnassigned ? "border-orange-400 ring-1 ring-orange-400" : "border-slate-200 hover:border-orange-300"}`}>
                  <div className="flex justify-between items-center">
                    <h4 className={`font-bold text-sm ${viewUnassigned ? "text-orange-700" : "text-slate-600"}`}>Unassigned Employees</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${viewUnassigned ? "bg-orange-100 text-orange-700" : "bg-slate-200 text-slate-600"}`}>{getUnassignedEmployees().length}</span>
                  </div>
                </div>
              </div>
            </div>
            {/* Right panel */}
            <div className="w-full md:w-2/3 flex flex-col bg-white">
              {viewUnassigned ? (
                <>
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-orange-50/50">
                    <h3 className="font-bold text-xl text-orange-800 flex items-center gap-2"><FaExclamationCircle /> Unassigned Employees</h3>
                    <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"><FaTimes size={20} /></button>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {!getUnassignedEmployees().length ? (
                        <div className="col-span-2 text-center py-12 text-slate-400"><FaCheck className="mx-auto mb-2 text-green-400" size={24} /><p>All employees assigned!</p></div>
                      ) : getUnassignedEmployees().map(emp => (
                        <div key={emp._id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg bg-slate-50">
                          <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{emp.name.charAt(0)}</div>
                          <div className="min-w-0"><p className="text-sm font-bold text-slate-700 truncate">{emp.name}</p><p className="text-xs text-slate-500">{emp.employeeId}</p></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-xl text-slate-800">{editingGroupId ? "Edit Group" : "Create New Group"}</h3>
                    <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100"><FaTimes size={20} /></button>
                  </div>
                  <div className="p-6 flex-1 overflow-y-auto">
                    <div className="mb-6">
                      <label className="block text-sm font-bold text-slate-700 mb-2">Group Name</label>
                      <input type="text" placeholder="e.g. Marketing Team" value={groupForm.name} onChange={e => setGroupForm({ ...groupForm, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div className="mb-3 flex justify-between items-end">
                      <label className="block text-sm font-bold text-slate-700">Select Members ({groupForm.members.length})</label>
                      <input type="text" placeholder="Search…" value={groupSearchTerm} onChange={e => setGroupSearchTerm(e.target.value)} className="text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:border-indigo-500 outline-none" />
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto bg-slate-50/50">
                      {employees.filter(e => e.name.toLowerCase().includes(groupSearchTerm.toLowerCase())).map(emp => {
                        const sel = groupForm.members.includes(emp._id);
                        return (
                          <div key={emp._id} onClick={() => toggleGroupMemberSelection(emp._id)} className={`flex items-center gap-3 p-3 border-b border-slate-100 cursor-pointer transition-colors ${sel ? "bg-indigo-50 hover:bg-indigo-100" : "hover:bg-white"}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${sel ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"}`}>{sel && <FaCheck className="text-white text-xs" />}</div>
                            <div><p className={`text-sm font-semibold ${sel ? "text-indigo-900" : "text-slate-700"}`}>{emp.name}</p><p className="text-xs text-slate-500">{emp.employeeId}</p></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                    {editingGroupId && <button onClick={resetGroupForm} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg">Cancel Edit</button>}
                    <button onClick={handleSaveGroup} className="px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-2">
                      {editingGroupId ? <FaSave /> : <FaPlus size={12} />}{editingGroupId ? "Update" : "Create"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE / EDIT NOTICE MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative overflow-hidden border border-gray-200/80">
            {/* Modal header */}
            <div className={`px-6 py-4 bg-gradient-to-r text-white ${isMeetingMode ? "from-indigo-600 to-indigo-700" : "from-blue-500 to-blue-600"}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center shadow-inner">
                    {isMeetingMode ? <FaVideo className="text-white" size={20} /> : <FaBullhorn className="text-white" size={20} />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{isMeetingMode ? "Schedule Meeting" : (editingNoticeId ? "Edit Announcement" : "New Announcement")}</h2>
                    <p className="text-sm text-white/80 mt-0.5">{isMeetingMode ? "Set up a new virtual meeting" : (editingNoticeId ? "Update announcement details" : "Share updates with your team")}</p>
                  </div>
                </div>
                <button onClick={closeModal} className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-all"><FaTimes size={18} /></button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto bg-gradient-to-b from-gray-50/50 to-white">

              {/* Meeting params */}
              {isMeetingMode ? (
                <>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1.5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Date</label>
                      <input type="date" name="date" value={meetingParams.date} onChange={handleMeetingParamChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" required />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Time</label>
                      <input type="time" name="time" value={meetingParams.time} onChange={handleMeetingParamChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40" required />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase"><div className="w-2 h-2 rounded-full bg-indigo-500" /> Meeting Link</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <FaLink className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" value={meetingLink} onChange={handleLinkChange} readOnly={!isLinkEditable} className={`w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40 ${!isLinkEditable ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white"}`} required />
                      </div>
                      {!isLinkEditable && <button type="button" onClick={() => setIsLinkEditable(true)} className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold border border-indigo-200 hover:bg-indigo-100">Change</button>}
                    </div>
                    <div className="text-right">
                      <a href="https://meet.google.com/landing" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-indigo-600 hover:underline inline-flex items-center gap-1"><FaExternalLinkAlt /> Create New Link</a>
                    </div>
                  </div>
                </>
              ) : (
                /* Title field with AI ghost text */
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase"><div className="w-2 h-2 rounded-full bg-orange-500" /> Title</label>
                  <div className="relative w-full">
                    {/* Ghost text overlay — only show when AI is NOT paused and there's a completion */}
                    {noticeData.title.trim() && ghostText && !aiPausedRef.current && (
                      <div className="absolute inset-0 flex items-center px-4 pointer-events-none z-10 overflow-hidden">
                        <span className="invisible whitespace-pre font-normal text-sm">{noticeData.title}</span>
                        <span className="text-gray-300 italic text-sm whitespace-nowrap truncate"> {ghostText}</span>
                      </div>
                    )}
                    <input
                      type="text"
                      value={noticeData.title}
                      placeholder="Enter announcement title…"
                      className="w-full border border-gray-300 px-4 py-3 rounded-lg bg-white relative z-20 focus:outline-none focus:ring-2 focus:ring-blue-400/40 text-sm"
                      onChange={e => {
                        // Do NOT reset aiPausedRef here — the debounce effect handles resetting it
                        // on the NEXT debounce tick, giving one full cycle of silence after generate/tab
                        setNoticeData(p => ({ ...p, title: e.target.value }));
                        if (!e.target.value.trim()) clearAiUI();
                      }}
                      onKeyDown={e => {
                        // Tab accepts ghost autocomplete
                        if (e.key === "Tab" && ghostText && !aiPausedRef.current) {
                          e.preventDefault();
                          setNoticeData(p => ({ ...p, title: p.title + ghostText }));
                          aiPausedRef.current = true; // pause after accepting so it doesn't re-suggest same text
                          clearAiUI();
                        }
                      }}
                      onBlur={() => {
                        // Small delay so suggestion onClick fires before blur clears it
                        setTimeout(() => { setGhostText(""); setTitleSuggestions([]); }, 150);
                      }}
                    />
                    {/* Suggestions dropdown */}
                    {noticeData.title.trim() && titleSuggestions.length > 0 && !aiPausedRef.current && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-30 overflow-hidden">
                        {titleSuggestions.map((s, i) => (
                          <div
                            key={i}
                            onMouseDown={e => e.preventDefault()} // prevent input blur before click fires
                            onClick={() => {
                              setNoticeData(p => ({ ...p, title: s }));
                              aiPausedRef.current = true;
                              clearAiUI();
                            }}
                            className="px-4 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 border-b border-gray-100 last:border-0 transition"
                          >{s}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* "Thinking" indicator — shown while debounce is in-flight */}
                  {noticeData.title.trim() && loadingSuggest && !aiPausedRef.current && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      <span className="ml-1 text-gray-400">Thinking…</span>
                    </p>
                  )}
                  {/* TAB hint — only show when there's an active ghost suggestion */}
                  {ghostText && !aiPausedRef.current && (
                    <p className="text-[10px] text-gray-400">Press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px] font-mono">Tab</kbd> to accept suggestion</p>
                  )}
                </div>
              )}

              {/* ✅ Generate with AI button — OUTSIDE title wrapper, between Title and Description */}
              {!isMeetingMode && (
                <button
                  type="button"
                  onClick={handleAiGenerate}
                  disabled={aiGenerating || !noticeData.title.trim()}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold w-full justify-center"
                >
                  {aiGenerating
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating description…</>
                    : <><FaRobot size={13} /> Generate Description with AI</>
                  }
                </button>
              )}

              {/* Description */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Description</label>
                <textarea name="description" placeholder="Write your details here…" value={noticeData.description} onChange={handleChange} className={`w-full border border-gray-300 rounded-lg px-4 py-3 text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 placeholder-gray-500 text-gray-900 transition-all bg-white shadow-sm ${isMeetingMode ? "bg-gray-50" : ""}`} required />
              </div>

              {/* Audience */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase"><div className="w-2 h-2 rounded-full bg-violet-500" /> Audience</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "ALL",      label: "All Employees", Icon: FaUsers,     color: "blue"   },
                    { key: "GROUP",    label: "Group Sending", Icon: FaLayerGroup, color: "indigo" },
                    { key: "SPECIFIC", label: "Specific",      Icon: FaUserTag,   color: "purple" },
                  ].map(({ key, label, Icon, color }) => {
                    const active = noticeData.sendTo === key;
                    return (
                      <button key={key} type="button" onClick={() => setNoticeData(prev => ({ ...prev, sendTo: key, selectedGroupId: null, ...(key !== "SPECIFIC" ? {} : {}) }))} className={`p-2 rounded-lg border transition-all h-20 flex flex-col items-center justify-center gap-1 ${active ? `bg-${color}-50 border-${color}-300 shadow-sm` : `bg-white border-gray-300 hover:border-${color}-300`}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${active ? `bg-${color}-500 text-white` : "bg-gray-200 text-gray-500"}`}>{active ? <FaCheck size={10} /> : <Icon size={12} />}</div>
                        <span className={`text-[10px] font-bold ${active ? `text-${color}-700` : "text-gray-600"}`}>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group selector */}
              {noticeData.sendTo === "GROUP" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">Select Group</label>
                  {groups.length ? (
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-1">
                      {groups.map(g => (
                        <div key={g.id} onClick={() => handleNoticeGroupSelect(g)} className={`p-3 rounded-lg border cursor-pointer flex justify-between items-center transition-all ${noticeData.selectedGroupId === g.id ? "bg-indigo-50 border-indigo-400 ring-1 ring-indigo-400" : "bg-white border-gray-300 hover:border-indigo-300"}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${noticeData.selectedGroupId === g.id ? "bg-indigo-200 text-indigo-700" : "bg-gray-100 text-gray-500"}`}>{g.name.charAt(0)}</div>
                            <div><p className={`text-sm font-bold ${noticeData.selectedGroupId === g.id ? "text-indigo-800" : "text-gray-700"}`}>{g.name}</p><p className="text-xs text-slate-500">{g.members.length} Members</p></div>
                          </div>
                          {noticeData.selectedGroupId === g.id && <FaCheck className="text-indigo-600" />}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                      <p className="text-sm text-gray-500">No groups found.</p>
                      <button type="button" onClick={() => { setIsModalOpen(false); setIsGroupModalOpen(true); }} className="text-xs font-bold text-indigo-600 hover:underline mt-1">Create a Group first</button>
                    </div>
                  )}
                </div>
              )}

              {/* Specific employee selector */}
              {noticeData.sendTo === "SPECIFIC" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 uppercase"><div className="w-2 h-2 rounded-full bg-amber-500" /> Select Employees</label>
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">{noticeData.recipients.length} selected</span>
                  </div>
                  <div className="relative">
                    <div onClick={() => setIsDropdownOpen(p => !p)} className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg flex justify-between items-center cursor-pointer text-sm text-gray-700 hover:border-blue-400 transition-all shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 rounded-md"><FaUserFriends className="text-blue-500 text-sm" /></div>
                        <span className={noticeData.recipients.length === 0 ? "text-gray-500" : "text-gray-800 font-medium"}>{noticeData.recipients.length === 0 ? "Select team members…" : `${noticeData.recipients.length} employee${noticeData.recipients.length !== 1 ? "s" : ""} selected`}</span>
                      </div>
                      <FaChevronDown size={12} className={`text-gray-400 transition-all ${isDropdownOpen ? "rotate-180 text-blue-500" : ""}`} />
                    </div>
                    {isDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-xl z-30 max-h-56 overflow-y-auto">
                        <div className="sticky top-0 bg-white p-2 border-b border-gray-200">
                          <div className="relative"><FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" /><input type="text" placeholder="Search employees…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-blue-400/40" autoFocus /></div>
                        </div>
                        <div className="p-1">
                          {employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map(emp => (
                            <div key={emp._id} onClick={() => toggleEmployeeSelection(emp._id)} className="flex items-center gap-3 p-2 hover:bg-blue-50 cursor-pointer rounded text-xs transition-all">
                              <div className={`w-4 h-4 border-2 rounded flex items-center justify-center ${noticeData.recipients.includes(emp._id) ? "bg-blue-500 border-blue-600" : "border-gray-400"}`}>{noticeData.recipients.includes(emp._id) && <FaCheck className="text-white text-[8px]" />}</div>
                              <div className="flex-1 min-w-0"><span className={`font-medium truncate ${noticeData.recipients.includes(emp._id) ? "text-blue-700" : "text-gray-800"}`}>{emp.name}</span><div><span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${noticeData.recipients.includes(emp._id) ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500"}`}>{emp.employeeId}</span></div></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submit row */}
              <div className="flex gap-2 pt-4 mt-2 border-t border-gray-200">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition border border-gray-300">Cancel</button>
                <button type="submit" disabled={isSubmitting || (noticeData.sendTo === "GROUP" && !noticeData.selectedGroupId)} className="flex-1 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                  {isSubmitting ? (<><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>{editingNoticeId ? "Updating…" : "Posting…"}</span></>) : (<><FaPaperPlane className="text-xs" /><span>{editingNoticeId ? "Update" : (isMeetingMode ? "Schedule Meeting" : "Publish Announcement")}</span></>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotices;