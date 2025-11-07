import React, { useState, useContext } from "react";
import { PlusCircle, Edit, Trash, X, Save, RotateCcw } from "lucide-react";
import { NoticeContext } from "../context/NoticeContext";

const AdminNotices = () => {
  const { notices, addNotice, updateNotice, deleteNotice } = useContext(NoticeContext);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [notification, setNotification] = useState({ message: "", type: "" });
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMessage, setEditMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [noticeToDelete, setNoticeToDelete] = useState(null);

  // Function to show a temporary notification
  const showNotification = (msg, type) => {
    setNotification({ message: msg, type: type });
    setTimeout(() => {
      setNotification({ message: "", type: "" });
    }, 3000);
  };

  // Handles adding a new notice
  const handlePostNotice = (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      showNotification("Title and message are required.", "error");
      return;
    }
    setPosting(true);
    setTimeout(() => {
      addNotice(title, message, "Admin");
      setTitle("");
      setMessage("");
      setPosting(false);
      showNotification("Notice posted successfully!", "success");
    }, 700);
  };

  // Handles deleting a notice with confirmation modal
  const handleDelete = () => {
    if (noticeToDelete) {
      deleteNotice(noticeToDelete.id);
      setShowDeleteModal(false);
      setNoticeToDelete(null);
      showNotification("Notice deleted successfully.", "success");
    }
  };

  const openDeleteModal = (notice) => {
    setNoticeToDelete(notice);
    setShowDeleteModal(true);
  };
  
  // Handles starting the edit mode
  const startEdit = (notice) => {
    setEditId(notice.id);
    setEditTitle(notice.title);
    setEditMessage(notice.message);
  };

  // Handles canceling the edit mode
  const cancelEdit = () => {
    setEditId(null);
    setEditTitle("");
    setEditMessage("");
  };

  // Handles saving an edited notice
  const handleEditSave = (id) => {
    if (!editTitle.trim() || !editMessage.trim()) {
      showNotification("Title and message are required.", "error");
      return;
    }
    updateNotice(id, editTitle, editMessage);
    cancelEdit();
    showNotification("Notice updated successfully!", "success");
  };

  // ...existing code for rendering, notification toast, and modal...
  return (
    <div className="relative min-h-screen w-full flex flex-col items-center p-4 bg-gray-100 font-sans antialiased">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl p-6 sm:p-10 border border-gray-200">
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8">
          <div className="flex items-center gap-4 mb-4 sm:mb-0">
            <div className="p-3 bg-blue-500 rounded-full text-white shadow-lg">
              <PlusCircle className="h-6 w-6" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-800 tracking-tight leading-tight">Admin Notices</h1>
          </div>
          <p className="text-sm text-gray-500 font-medium">
            <span className="font-semibold text-gray-700">Today:</span> {new Date().toLocaleDateString()}
          </p>
        </header>

        {/* Post Notice Form */}
        <section className="mb-10 bg-blue-50 rounded-2xl p-6 sm:p-8 shadow-inner border border-blue-100">
          <form onSubmit={handlePostNotice} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="title" className="block font-semibold text-gray-700 mb-2 text-sm">Title</label>
                <input
                  id="title"
                  type="text"
                  className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-base font-medium transition-colors"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Important Policy Update"
                  disabled={posting}
                  maxLength={60}
                />
              </div>
              <div>
                <label htmlFor="message" className="block font-semibold text-gray-700 mb-2 text-sm">Message</label>
                <textarea
                  id="message"
                  className="w-full px-4 py-2 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-sm font-normal transition-colors"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write the full notice details here..."
                  rows={3}
                  disabled={posting}
                  maxLength={300}
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 rounded-full bg-blue-600 text-white font-bold shadow-lg hover:bg-blue-700 transition transform hover:scale-105 disabled:bg-blue-400 disabled:transform-none"
                disabled={posting}
              >
                {posting ? (
                  <>
                    <RotateCcw className="h-4 w-4 animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    Post Notice
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* All Notices List */}
        <section>
          <h3 className="text-2xl font-bold text-gray-800 mb-6 border-b pb-2">All Notices</h3>
          <div className="grid gap-6">
            {notices.length === 0 ? (
              <div className="text-gray-500 text-center py-12 text-lg font-medium bg-gray-50 rounded-xl border border-gray-200">
                No notices posted yet.
              </div>
            ) : (
              notices.map((notice) => (
                <div key={notice.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-md group relative transition-all duration-300 hover:shadow-xl">
                  {editId === notice.id ? (
                    // Edit mode UI
                    <div className="space-y-4">
                      <input
                        type="text"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 font-bold text-gray-700 text-lg transition-colors"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Edit title"
                        maxLength={60}
                      />
                      <textarea
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-base transition-colors"
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        placeholder="Edit message"
                        rows={3}
                        maxLength={300}
                      />
                      <div className="flex gap-3 justify-end pt-2">
                        <button
                          className="flex items-center gap-1 px-4 py-2 rounded-full bg-blue-600 text-white font-bold shadow-md hover:bg-blue-700 transition transform hover:scale-105"
                          onClick={() => handleEditSave(notice.id)}
                          type="button"
                        >
                          <Save className="h-4 w-4" />
                          Save
                        </button>
                        <button
                          className="flex items-center gap-1 px-4 py-2 rounded-full bg-gray-300 text-gray-700 font-bold shadow-md hover:bg-gray-400 transition transform hover:scale-105"
                          onClick={cancelEdit}
                          type="button"
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Read-only mode UI
                    <>
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-bold text-gray-800 text-xl tracking-tight leading-snug">{notice.title}</h4>
                        <span className="text-xs text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-full whitespace-nowrap">
                          {notice.date}
                        </span>
                      </div>
                      <p className="text-gray-700 mb-2 text-base leading-relaxed">{notice.message}</p>
                      <p className="text-xs text-gray-500 font-semibold mt-4">Posted by {notice.author}</p>
                      <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button
                          className="p-2 rounded-full bg-yellow-400 text-white shadow-md hover:bg-yellow-500 transition transform hover:scale-110"
                          onClick={() => startEdit(notice)}
                          title="Edit"
                          type="button"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 rounded-full bg-red-500 text-white shadow-md hover:bg-red-600 transition transform hover:scale-110"
                          onClick={() => openDeleteModal(notice)}
                          title="Delete"
                          type="button"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Notification Toast */}
      {notification.message && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-white font-semibold shadow-xl transition-all duration-300 ease-in-out z-50 transform ${notification.type === "success" ? "bg-green-500" : "bg-red-500"}`}>
          {notification.message}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-sm w-full text-center">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">Are you sure you want to delete this notice?</p>
            <div className="flex gap-4 justify-center">
              <button
                className="px-6 py-2 rounded-full bg-red-500 text-white font-bold shadow-md hover:bg-red-600 transition transform hover:scale-105"
                onClick={handleDelete}
              >
                Delete
              </button>
              <button
                className="px-6 py-2 rounded-full bg-gray-300 text-gray-700 font-bold shadow-md hover:bg-gray-400 transition transform hover:scale-105"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminNotices;
