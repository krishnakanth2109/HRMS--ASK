import { useState, useContext, useMemo } from "react";
import { AttendanceContext } from "../context/AttendanceContext";
import { EmployeeContext } from "../context/EmployeeContext";
import { useNavigate } from "react-router-dom";
import { saveAs } from "file-saver";

const Attendance = () => {
  const { attendanceRecords = [] } = useContext(AttendanceContext);
  const { employees = [] } = useContext(EmployeeContext);
  const [sortOrder, setSortOrder] = useState("desc");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentWeek, setCurrentWeek] = useState(0);

  const navigate = useNavigate();

  const getCurrentWeekDates = (weekOffset = 0) => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (weekOffset * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0],
    };
  };

  const weekDates = getCurrentWeekDates(currentWeek);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Create a Map for efficient lookups of employee name and status.
  const employeeInfoMap = useMemo(() => 
    new Map(employees.map(emp => [
      String(emp.employeeId), 
      { isActive: emp.isActive, name: emp.name || "Unknown Employee" }
    ])),
    [employees]
  );

  const filteredAndSortedRecords = useMemo(() => {
    // 1. Enrich raw attendance records with employee name and status first.
    const enrichedRecords = attendanceRecords.map(record => {
      const employeeInfo = employeeInfoMap.get(String(record.employeeId));
      return {
        ...record,
        name: employeeInfo ? employeeInfo.name : 'Unknown Employee', // Prevents 'toLowerCase' of undefined error
        isInactive: employeeInfo ? !employeeInfo.isActive : true,
      };
    });

    // 2. Filter the enriched records
    const filtered = enrichedRecords.filter((record) => {
      const matchesName = record.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "All" || record.status === statusFilter;
      const matchesWeek = record.date >= weekDates.start && record.date <= weekDates.end;
      const isPastOrToday = record.date <= todayStr;
      return matchesName && matchesStatus && matchesWeek && isPastOrToday;
    });

    // 3. Sort the filtered records
    return filtered.sort((a, b) => {
      if (a.isInactive !== b.isInactive) {
        return a.isInactive ? 1 : -1; // Inactive records always go to the bottom
      }
      return sortOrder === "asc"
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
    });
  }, [attendanceRecords, searchTerm, statusFilter, sortOrder, weekDates.start, weekDates.end, todayStr, employeeInfoMap]);


  const formatWeekRange = (start, end) => {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    if (startDate.getFullYear() === endDate.getFullYear()) {
      const startOptions = { month: 'short', day: 'numeric' };
      return `${startDate.toLocaleDateString('en-US', startOptions)} - ${endDate.toLocaleDateString('en-US', options)}`;
    }
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
  };

  const handleExportCSV = () => {
    const header = ["ID", "Employee ID", "Name", "Date", "Status", "Details"];
    const rows = filteredAndSortedRecords.map((rec) => [
      rec.id,
      rec.employeeId,
      rec.name,
      rec.date,
      rec.status,
      rec.isHalfDay ? "Half Day" : ""
    ]);
    const csvContent = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "filtered_attendance_records.csv");
  };

  const statusBadge = (record) => {
    let color = "bg-gray-200 text-gray-700";
    let text = record.status;
    if (record.status === "Present") {
        color = record.isHalfDay ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
        text = record.isHalfDay ? "Half Day Present" : "Present";
    } else if (record.status === "Absent") {
        color = "bg-red-100 text-red-700";
    } else if (record.status === "Leave") {
        color = "bg-yellow-100 text-yellow-700";
    } else if (record.status === "Holiday") {
        color = "bg-purple-100 text-purple-700";
    }
    return <span className={`px-2 py-1 rounded-full text-xs font-semibold ${color}`}>{text}</span>;
  };

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Weekly Attendance Records</h2>
      <div className="bg-white p-4 rounded-xl shadow-lg">
        <div className="mb-4 flex flex-col md:flex-row flex-wrap gap-4 items-center">
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setCurrentWeek(currentWeek - 1)}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shadow"
            >
              &larr;
            </button>
            <span className="text-sm font-semibold text-gray-700 text-center w-48">
              {formatWeekRange(weekDates.start, weekDates.end)}
            </span>
            <button
              onClick={() => setCurrentWeek(currentWeek + 1)}
              disabled={currentWeek >= 0}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shadow disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              &rarr;
            </button>
            {currentWeek !== 0 && (
              <button
                onClick={() => setCurrentWeek(0)}
                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition shadow"
              >
                Current
              </button>
            )}
          </div>
          <div className="flex-grow flex flex-col md:flex-row flex-wrap gap-4">
            <input
              type="text"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border border-gray-300 px-4 py-2 rounded-lg w-full md:w-48"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 px-4 py-2 rounded-lg"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Leave">Leave</option>
              <option value="Holiday">Holiday</option>
            </select>
             <select
              value={sortOrder}
              // **FIX:** The onChange handler is now correctly implemented, resolving the error.
              onChange={(e) => setSortOrder(e.target.value)}
              className="border border-gray-300 px-4 py-2 rounded-lg"
            >
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
             <button
                onClick={handleExportCSV}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold"
              >
                Export CSV
              </button>
          </div>
        </div>

        <div className="overflow-x-auto">
            <table className="min-w-full bg-white">
            <thead className="bg-gray-100">
                <tr className="text-left text-sm font-semibold text-gray-600">
                <th className="p-3">Employee ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Date</th>
                <th className="p-3">Status</th>
                <th className="p-3">Actions</th>
                </tr>
            </thead>
            <tbody>
                {filteredAndSortedRecords.length > 0 ? (
                filteredAndSortedRecords.map((record) => (
                    <tr
                        key={record.id}
                        className={`border-t transition duration-150 ${
                        record.isInactive
                            ? "bg-gray-200 text-gray-500"
                            : "bg-white hover:bg-blue-50"
                        }`}
                    >
                        <td className="p-3 font-mono">{record.employeeId}</td>
                        <td className="p-3">
                        {record.name}
                        {record.isInactive && (
                            <span className="ml-2 px-2 py-1 bg-red-200 text-red-800 text-xs rounded-full font-semibold">
                            Inactive
                            </span>
                        )}
                        </td>
                        <td className="p-3 font-mono">{record.date}</td>
                        <td className="p-3">{statusBadge(record)}</td>
                        <td className="p-3">
                        <button
                            onClick={() => navigate(`/attendance/profile/${record.employeeId}`)}
                            className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold hover:bg-purple-200"
                            title="View Profile"
                        >
                            View Profile
                        </button>
                        </td>
                    </tr>
                    ))
                ) : (
                <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">
                    No matching attendance records found.
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default Attendance;