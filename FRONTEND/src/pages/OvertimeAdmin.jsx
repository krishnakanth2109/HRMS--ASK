import React, { useEffect, useState, useMemo, useCallback } from "react";
import { FaFilter, FaSearch, FaCalendarAlt, FaCheckCircle, FaClock, FaHourglassHalf, FaTimesCircle, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { getAllOvertimeRequests, updateOvertimeStatus } from "../api";

// --- START OF NEW UI COMPONENTS ---

// A reusable card for displaying key metrics
const StatCard = ({ icon, title, value, color }) => (
  <div className="bg-white p-5 shadow-lg rounded-xl flex items-center space-x-4">
    <div className={`text-4xl ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
    </div>
  </div>
);

// A reusable filter input component
const FilterInput = ({ label, value, onChange, placeholder, children }) => (
    <div className="w-full">
        <label className="text-sm font-semibold text-gray-600 mb-1 block">{label}</label>
        <div className="relative">
            {children}
            <input 
                type="text"
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
        </div>
    </div>
);

// --- END OF NEW UI COMPONENTS ---


const OvertimeAdmin = () => {
  const [overtimeList, setOvertimeList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  
  // --- START OF NEW STATE FOR FILTERS ---
  const [filters, setFilters] = useState({
    status: 'ALL', // ALL, PENDING, APPROVED, REJECTED
    search: '',
    month: new Date().toISOString().slice(0, 7)
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const handlePrevMonth = () => {
    const [year, month] = filters.month.split("-").map(Number);
    const date = new Date(year, month - 2, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    setFilters(prev => ({ ...prev, month: `${y}-${m}` }));
    setCurrentPage(1);
  };

  const handleNextMonth = () => {
    const [year, month] = filters.month.split("-").map(Number);
    const date = new Date(year, month, 1);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    setFilters(prev => ({ ...prev, month: `${y}-${m}` }));
    setCurrentPage(1);
  };
  // --- END OF NEW STATE FOR FILTERS ---


  // ✅ Fetch all Overtime Requests (NO CHANGE)
  const fetchOvertimes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAllOvertimeRequests();
      setOvertimeList(data);
    } catch (err) {
      console.error("Error fetching overtime:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOvertimes();
  }, [fetchOvertimes]);

  // ✅ Update OT Status (NO CHANGE)
  const updateStatus = async (id, newStatus) => {
    try {
      setUpdatingId(id);
      await updateOvertimeStatus(id, { status: newStatus });
      setOvertimeList((prev) =>
        prev.map((ot) => (ot._id === id ? { ...ot, status: newStatus } : ot))
      );
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };


  // --- START OF NEW DYNAMIC FILTERING LOGIC ---
  const filteredOvertimeList = useMemo(() => {
    return overtimeList.filter(ot => {
        const matchesStatus = filters.status === 'ALL' || ot.status === filters.status;
        const matchesSearch = filters.search.toLowerCase() === '' || 
                              ot.employeeName.toLowerCase().includes(filters.search.toLowerCase()) ||
                              ot.employeeId.toLowerCase().includes(filters.search.toLowerCase());
        const matchesMonth = !filters.month || ot.date.startsWith(filters.month);
        
        return matchesStatus && matchesSearch && matchesMonth;
    });
  }, [overtimeList, filters]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredOvertimeList.length / itemsPerPage);
  const paginatedList = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOvertimeList.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOvertimeList, currentPage]);
  
  const handleFilterChange = (e) => {
      const { name, value } = e.target;
      setFilters(prev => ({...prev, [name]: value}));
      setCurrentPage(1);
  }
  // --- END OF NEW DYNAMIC FILTERING LOGIC ---


  // --- START OF NEW COUNT CONTAINERS LOGIC ---
  const counts = useMemo(() => {
      const today = new Date().toISOString().split('T')[0];
      return {
          approved: overtimeList.filter(ot => ot.status === 'APPROVED').length,
          pending: overtimeList.filter(ot => ot.status === 'PENDING').length,
          rejected: overtimeList.filter(ot => ot.status === 'REJECTED').length, // ✅ ADDED: Rejected count
          workingToday: overtimeList.filter(ot => ot.status === 'APPROVED' && ot.date === today).length
      }
  }, [overtimeList]);
  // --- END OF NEW COUNT CONTAINERS LOGIC ---


  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="p-5 text-center text-xl font-semibold text-indigo-800">
            Loading Overtime Requests...
        </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className=" bg-white/60 backdrop-blur-md rounded-2xl shadow-sm border border-gray-200 p-6 text-4xl font-bold text-indigo-900 mb-6">Overtime Dashboard</h1>

        {/* --- START OF NEW COUNT CONTAINERS UI --- */}
        {/* ✅ ADDED: Changed lg:grid-cols-3 to lg:grid-cols-4 to fit the 4th card nicely */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 ">
            <StatCard icon={<FaCheckCircle />} title="Approved Overtime" value={counts.approved} color="text-green-500" />
            <StatCard icon={<FaHourglassHalf />} title="Pending Requests" value={counts.pending} color="text-yellow-500" />
            {/* ✅ ADDED: Rejected StatCard */}
            <StatCard icon={<FaTimesCircle />} title="Rejected Requests" value={counts.rejected} color="text-red-500" />
            <StatCard icon={<FaClock />} title="Working OT Today" value={counts.workingToday} color="text-blue-500" />
        </div>
        {/* --- END OF NEW COUNT CONTAINERS UI --- */}


        <div className="md:bg-white/60 md:backdrop-blur-md md:rounded-2xl md:shadow-sm md:border border-gray-200 md:p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 md:mb-6 px-1 md:px-0">Manage Requests</h2>

            {/* --- START OF NEW FILTERS UI --- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-200 md:bg-transparent md:p-0 md:rounded-none md:shadow-none md:border-0">
                <FilterInput label="Search by Name or ID" value={filters.search} onChange={(e) => setFilters({...filters, search: e.target.value})} placeholder="e.g., John Doe or 12345">
                    <FaSearch className="absolute top-1/2 left-3 transform -translate-y-1/2 text-gray-400" />
                </FilterInput>

                <div>
                    <label className="text-sm font-semibold text-gray-600 mb-1 block">Filter by Month</label>
                    <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1 shadow-sm">
                        <button 
                            onClick={handlePrevMonth}
                            className="p-2 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded transition-all"
                        >
                            <FaChevronLeft size={10} />
                        </button>
                        <input 
                            type="month" 
                            value={filters.month} 
                            onChange={(e) => { setFilters({...filters, month: e.target.value}); setCurrentPage(1); }} 
                            className="bg-transparent border-none text-xs outline-none font-bold text-gray-700 w-full" 
                        />
                        <button 
                            onClick={handleNextMonth}
                            className="p-2 hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 rounded transition-all"
                        >
                            <FaChevronRight size={10} />
                        </button>
                    </div>
                </div>
            </div>
            {/* --- END OF NEW FILTERS UI --- */}

            {/* --- DESKTOP TABLE --- */}
            <div className="hidden md:block overflow-x-auto rounded-xl shadow-sm border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-indigo-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-800 uppercase tracking-wider">Employee ID</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-800 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-800 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-indigo-800 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-indigo-800 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-center text-xs font-bold text-indigo-800 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedList.length > 0 ? (
                            paginatedList.map((ot) => (
                                <tr key={ot._id} className="hover:bg-gray-50 transition-colors duration-200">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ot.employeeId}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{ot.employeeName}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{ot.date}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{ot.type}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${
                                            ot.status === "APPROVED" ? "bg-green-100 text-green-800"
                                            : ot.status === "REJECTED" ? "bg-red-100 text-red-800"
                                            : "bg-yellow-100 text-yellow-800"
                                        }`}>
                                            {ot.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                                        <div className="flex gap-2 justify-center">
                                        {ot.status === 'PENDING' ? (
                                            <>
                                                <button
                                                    disabled={updatingId === ot._id}
                                                    onClick={() => updateStatus(ot._id, "APPROVED")}
                                                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    disabled={updatingId === ot._id}
                                                    onClick={() => updateStatus(ot._id, "REJECTED")}
                                                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                                >
                                                    Reject
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-gray-400 italic">No actions available</span>
                                        )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="text-center py-10 text-gray-500 bg-white">
                                    <p className="font-semibold text-lg">No Overtime Requests Found</p>
                                    <p className="text-sm">Try adjusting your filters or check back later.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* --- MOBILE LIST VIEW --- */}
            <div className="md:hidden flex flex-col gap-4">
                {paginatedList.length > 0 ? (
                    paginatedList.map((ot) => (
                        <div key={ot._id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-col gap-3 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                                            {ot.employeeName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm">{ot.employeeName}</h4>
                                            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{ot.employeeId}</p>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 inline-flex text-[9px] font-bold rounded-md tracking-wider uppercase ${
                                        ot.status === "APPROVED" ? "bg-green-50 text-green-700 border border-green-200"
                                        : ot.status === "REJECTED" ? "bg-red-50 text-red-700 border border-red-200"
                                        : "bg-yellow-50 text-yellow-700 border border-yellow-200"
                                    }`}>
                                        {ot.status}
                                    </span>
                                </div>

                                <div className="flex flex-row items-center gap-3 text-xs mt-1">
                                    <div className="flex items-center gap-1.5 text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        <FaCalendarAlt className="text-gray-400 text-[10px]" />
                                        <span className="font-medium text-[11px]">{ot.date}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                                        <span className="font-bold text-[10px] uppercase tracking-wider">{ot.type}</span>
                                    </div>
                                </div>

                                {ot.status === 'PENDING' && (
                                    <div className="flex gap-2 w-full mt-2">
                                        <button
                                            disabled={updatingId === ot._id}
                                            onClick={() => updateStatus(ot._id, "APPROVED")}
                                            className="flex-1 bg-[#10B981] text-white px-3 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-[#059669] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            disabled={updatingId === ot._id}
                                            onClick={() => updateStatus(ot._id, "REJECTED")}
                                            className="flex-1 bg-[#EF4444] text-white px-3 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-[#DC2626] disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 bg-white rounded-2xl shadow-sm border border-gray-200">
                            <p className="font-semibold text-gray-500">No Requests Found</p>
                        </div>
                    )}
            </div>
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2 pb-8">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-all text-gray-600 shadow-sm"
          >
            <FaChevronLeft size={12} />
          </button>

          <div className="flex items-center gap-1">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  currentPage === i + 1
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 transition-all text-gray-600 shadow-sm"
          >
            <FaChevronRight size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

export default OvertimeAdmin;