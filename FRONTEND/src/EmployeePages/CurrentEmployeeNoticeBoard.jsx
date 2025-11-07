import React from "react";
import { NoticeContext } from "@/context/NoticeContext";
import { useNotice } from "../context/NoticeContext";


const CurrentEmployeeNoticeBoard = () => {
  const { notices } = useNotice(); // Pull from context

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Go Back Button */}
    

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Notice Board</h2>
          <p className="text-gray-500 text-sm">All important announcements will be listed here.</p>
        </div>

        {/* Filter (static UI for now) */}
        <div className="mt-4 md:mt-0">
          <label className="mr-2 text-sm font-medium text-gray-700">Filter By:</label>
          <select className="border border-gray-300 rounded-md px-2 py-1 text-sm">
            <option>All</option>
            <option>HR</option>
            <option>Admin</option>
            <option>General</option>
          </select>
        </div>
      </div>

      {/* Dynamic Notice List */}
      <div className="space-y-4">
        {notices.length === 0 ? (
          <p className="text-gray-500 text-sm">No notices available.</p>
        ) : (
          notices.map((notice) => (
            <div key={notice.id} className="bg-white rounded-lg shadow-md p-4">
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-lg font-semibold">{notice.title}</h3>
                <span className="text-sm text-gray-500">{notice.date}</span>
              </div>
              <p className="text-gray-600 text-sm">{notice.message}</p>
              <p className="text-xs text-blue-600 mt-1">Author: {notice.author}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CurrentEmployeeNoticeBoard;
