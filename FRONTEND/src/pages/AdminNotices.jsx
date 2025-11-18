// --- ENHANCED AdminNotices.jsx ---

import React, { useState, useEffect, useCallback } from "react";
import { getAllNoticesForAdmin, addNotice, getEmployees, deleteNoticeById, updateNotice } from "../api";
import { FaEdit, FaTrash, FaPaperPlane, FaUsers, FaCalendarAlt, FaTimes, FaCheck, FaChevronDown } from 'react-icons/fa';

const AdminNotices = () => {
  const initialFormState = { title: "", description: "", recipients: [], sendTo: 'ALL' };
  const [noticeData, setNoticeData] = useState(initialFormState);
  const [notices, setNotices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [editingNoticeId, setEditingNoticeId] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchNotices = useCallback(async () => {
    try {
      const data = await getAllNoticesForAdmin();
      setNotices(data);
    } catch (error) {
      console.error("Error fetching all notices:", error);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await getEmployees();
      setEmployees(data.filter(emp => emp.isActive !== false));
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  }, []);

  useEffect(() => {
    fetchNotices();
    fetchEmployees();
  }, [fetchNotices, fetchEmployees]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNoticeData(prev => ({ ...prev, [name]: value }));
  };

  const toggleEmployeeSelection = (employeeId) => {
    setNoticeData(prev => {
      const isSelected = prev.recipients.includes(employeeId);
      if (isSelected) {
        return {
          ...prev,
          recipients: prev.recipients.filter(id => id !== employeeId)
        };
      } else {
        return {
          ...prev,
          recipients: [...prev.recipients, employeeId]
        };
      }
    });
  };

  const selectAllEmployees = () => {
    setNoticeData(prev => ({
      ...prev,
      recipients: employees.map(emp => emp._id)
    }));
  };

  const clearAllSelections = () => {
    setNoticeData(prev => ({
      ...prev,
      recipients: []
    }));
  };

  const resetForm = () => {
    setNoticeData(initialFormState);
    setEditingNoticeId(null);
    setMessage("");
    setIsDropdownOpen(false);
    setSearchTerm("");
  };

  const handleEdit = (notice) => {
    setEditingNoticeId(notice._id);
    
    const isSpecific = Array.isArray(notice.recipients) && notice.recipients.length > 0;
    
    setNoticeData({
      title: notice.title,
      description: notice.description,
      recipients: isSpecific ? notice.recipients : [],
      sendTo: isSpecific ? 'SPECIFIC' : 'ALL',
    });
    
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (noticeId) => {
    if (window.confirm("Are you sure you want to delete this notice permanently?")) {
      try {
        await deleteNoticeById(noticeId);
        setMessage("✅ Notice deleted successfully!");
        fetchNotices();
      } catch (error) {
        console.error(error);
        setMessage("❌ Failed to delete notice.");
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
        setMessage("✅ Notice updated successfully!");
      } else {
        const payload = {
          title: noticeData.title,
          description: noticeData.description,
          recipients: noticeData.sendTo === 'SPECIFIC' ? noticeData.recipients : [],
        };
        await addNotice(payload);
        setMessage("✅ Notice posted successfully!");
      }
      resetForm();
      fetchNotices();
    } catch (error) {
      console.error(error);
      setMessage(editingNoticeId ? "❌ Failed to update notice." : "❌ Failed to post notice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter employees based on search
  const filteredEmployees = employees.filter(emp => 
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to get recipient names for display
  const getRecipientNames = (recipients) => {
    if (recipients === 'ALL' || !Array.isArray(recipients) || recipients.length === 0) {
      return 'All Employees';
    }
    const names = recipients
      .map(id => employees.find(emp => emp._id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'Specific Employees';
  };

  const getSelectedEmployeesCount = () => noticeData.recipients.length;

  const getMessageColor = () => message.includes("✅") ? "text-green-700 bg-green-50 border-green-200" : "text-red-700 bg-red-50 border-red-200";
  
  const getNoticeBorderColor = (index) => {
    const colors = [
      "border-l-4 border-blue-500 bg-gradient-to-r from-blue-50 to-white",
      "border-l-4 border-green-500 bg-gradient-to-r from-green-50 to-white", 
      "border-l-4 border-purple-500 bg-gradient-to-r from-purple-50 to-white",
      "border-l-4 border-orange-500 bg-gradient-to-r from-orange-50 to-white",
      "border-l-4 border-pink-500 bg-gradient-to-r from-pink-50 to-white",
      "border-l-4 border-indigo-500 bg-gradient-to-r from-indigo-50 to-white"
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 py-12 px-4 flex flex-col items-center">
      {/* Form Section */}
      <div className="bg-white shadow-2xl rounded-3xl p-8 w-full max-w-2xl mb-16 border border-gray-100 transform transition-all duration-300 hover:shadow-3xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <FaPaperPlane className="text-white text-2xl" />
          </div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {editingNoticeId ? 'Edit Notice' : 'Post New Notice'}
          </h2>
          <p className="text-gray-500 mt-2">
            {editingNoticeId ? 'Update your notice details' : 'Share important updates with your team'}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block font-bold text-gray-800 text-lg">Notice Title</label>
            <input 
              type="text" 
              name="title" 
              value={noticeData.title} 
              onChange={handleChange} 
              required 
              placeholder="Enter a clear and concise title..."
              className="w-full border-2 border-gray-200 p-4 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300 bg-gray-50 hover:bg-white" 
            />
          </div>
          
          <div className="space-y-2">
            <label className="block font-bold text-gray-800 text-lg">Description</label>
            <textarea 
              name="description" 
              value={noticeData.description} 
              onChange={handleChange} 
              required 
              rows="5" 
              placeholder="Provide detailed information about this notice..."
              className="w-full border-2 border-gray-200 p-4 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all duration-300 resize-none bg-gray-50 hover:bg-white"
            ></textarea>
          </div>

          {/* Enhanced Recipient Selection */}
          <div className="space-y-4">
            <label className="block font-bold text-gray-800 text-lg">Audience</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setNoticeData(prev => ({ ...prev, sendTo: 'ALL' }))}
                className={`p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center ${
                  noticeData.sendTo === 'ALL' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' 
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                }`}
              >
                <FaUsers className="text-2xl mb-2" />
                <span className="font-semibold">All Employees</span>
              </button>
              
              <button
                type="button"
                onClick={() => setNoticeData(prev => ({ ...prev, sendTo: 'SPECIFIC' }))}
                className={`p-4 rounded-2xl border-2 transition-all duration-300 flex flex-col items-center justify-center ${
                  noticeData.sendTo === 'SPECIFIC' 
                    ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md' 
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
                }`}
              >
                <FaUsers className="text-2xl mb-2" />
                <span className="font-semibold">Specific Employees</span>
              </button>
            </div>
            
            {noticeData.sendTo === 'SPECIFIC' && (
              <div className="mt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block font-semibold text-gray-700 text-lg">Select Employees</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllEmployees}
                      className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={clearAllSelections}
                      className="px-3 py-1 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
                
                {/* Custom Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full p-4 border-2 border-gray-200 rounded-2xl bg-white flex justify-between items-center hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
                        {getSelectedEmployeesCount()} selected
                      </span>
                      <span className="text-gray-600">
                        {getSelectedEmployeesCount() === 0 ? 'Select employees...' : 'Employees selected'}
                      </span>
                    </div>
                    <FaChevronDown className={`text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isDropdownOpen && (
                    <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-2xl shadow-2xl max-h-96 overflow-hidden">
                      {/* Search Bar */}
                      <div className="p-4 border-b border-gray-100">
                        <input
                          type="text"
                          placeholder="Search employees..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full p-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                      </div>
                      
                      {/* Employee List */}
                      <div className="max-h-64 overflow-y-auto">
                        {filteredEmployees.map(employee => (
                          <div
                            key={employee._id}
                            onClick={() => toggleEmployeeSelection(employee._id)}
                            className={`flex items-center gap-4 p-4 border-b border-gray-100 cursor-pointer transition-colors ${
                              noticeData.recipients.includes(employee._id)
                                ? 'bg-blue-50 hover:bg-blue-100'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              noticeData.recipients.includes(employee._id)
                                ? 'border-blue-500 bg-blue-500'
                                : 'border-gray-300'
                            }`}>
                              {noticeData.recipients.includes(employee._id) && (
                                <FaCheck className="text-white text-xs" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-gray-800">{employee.name}</div>
                              <div className="text-sm text-gray-500">{employee.employeeId} • {employee.department}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Selected Employees Preview */}
                {noticeData.recipients.length > 0 && (
                  <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {noticeData.recipients.slice(0, 5).map(empId => {
                        const emp = employees.find(e => e._id === empId);
                        return emp ? (
                          <span key={empId} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                            {emp.name}
                            <button
                              type="button"
                              onClick={() => toggleEmployeeSelection(empId)}
                              className="text-blue-500 hover:text-blue-700"
                            >
                              <FaTimes className="text-xs" />
                            </button>
                          </span>
                        ) : null;
                      })}
                      {noticeData.recipients.length > 5 && (
                        <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                          +{noticeData.recipients.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="flex-1 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 transition-all duration-300 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
            >
              <FaPaperPlane /> 
              {isSubmitting ? 'Submitting...' : (editingNoticeId ? 'Update Notice' : 'Post Notice')}
            </button>
            {editingNoticeId && (
              <button 
                type="button" 
                onClick={resetForm} 
                className="px-8 py-4 rounded-2xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all duration-300 border border-gray-200"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        {message && (
          <div className={`mt-6 p-4 rounded-2xl text-center font-semibold border-2 ${getMessageColor()} animate-pulse`}>
            {message}
          </div>
        )}
      </div>

      {/* Notices List Section */}
      <div className="w-full max-w-7xl">
        <div className="text-center mb-12">
          <h3 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-3">
            All Posted Notices
          </h3>
          <p className="text-gray-500 text-lg">Manage and review all your organizational notices</p>
        </div>
        
        {notices.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <FaPaperPlane className="text-gray-400 text-3xl" />
            </div>
            <p className="text-gray-500 text-xl">No notices posted yet.</p>
            <p className="text-gray-400 mt-2">Create your first notice to get started!</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {notices.map((notice, index) => (
              <div 
                key={notice._id} 
                className={`p-6 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 ${getNoticeBorderColor(index)} relative overflow-hidden group`}
              >
                {/* Background Pattern */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white to-transparent opacity-50 rounded-bl-3xl"></div>
                
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex-grow mb-4">
                    <h4 className="text-2xl font-bold text-gray-800 mb-3 line-clamp-2 group-hover:text-gray-900 transition-colors">
                      {notice.title}
                    </h4>
                    <p className="text-gray-600 mb-4 line-clamp-3 leading-relaxed">
                      {notice.description}
                    </p>
                    
                    {/* Recipients Badge */}
                    <div className="mb-4">
                      <span className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 text-sm font-semibold px-3 py-2 rounded-full border border-blue-200">
                        <FaUsers className="text-blue-600" />
                        {getRecipientNames(notice.recipients)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-100 pt-4 mt-auto">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 text-gray-500">
                        <FaCalendarAlt className="text-gray-400" />
                        <span className="text-sm font-medium">
                          {new Date(notice.date).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleEdit(notice)} 
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-300 group/edit" 
                          title="Edit Notice"
                        >
                          <FaEdit className="group-hover/edit:scale-110 transition-transform" />
                        </button>
                        <button 
                          onClick={() => handleDelete(notice._id)} 
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-300 group/delete" 
                          title="Delete Notice"
                        >
                          <FaTrash className="group-hover/delete:scale-110 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotices;