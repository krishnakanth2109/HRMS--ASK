import React, { useState, useMemo, useCallback } from 'react';
import { PermissionHoursContext } from './PermissionHoursContext';

// --- Mock JSON Data based on your 'permission_requests' table schema ---
const mockPermissionRequests = [
  {
    id: 1,
    employeeId: "EMP101",
    name: "John Doe",
    date: "2025-09-10",
    fromTime: "09:30:00",
    toTime: "11:00:00",
    reason: "Met with Client XYZ at their office for a project kickoff meeting.",
    requestDate: "2025-09-10T11:30:00Z",
    status: "PENDING",
    actionBy: null,
    actionDate: null,
    actionComments: null
  },
  {
    id: 2,
    employeeId: "EMP102",
    name: "Alice Johnson",
    date: "2025-09-08",
    fromTime: "14:00:00",
    toTime: "15:30:00",
    reason: "Attended an urgent vendor meeting off-site.",
    requestDate: "2025-09-08T16:00:00Z",
    status: "APPROVED",
    actionBy: "Admin01",
    actionDate: "2025-09-09T10:15:00Z",
    actionComments: "Approved as per discussion."
  },
  {
    id: 3,
    employeeId: "EMP104",
    name: "Priya Sharma",
    date: "2025-09-05",
    fromTime: "10:00:00",
    toTime: "10:45:00",
    reason: "Forgot to punch in after arriving.",
    requestDate: "2025-09-05T12:00:00Z",
    status: "REJECTED",
    actionBy: "Admin01",
    actionDate: "2025-09-06T09:00:00Z",
    actionComments: "Forgetting to punch in is not a valid reason for manual approval."
  },
  {
    id: 4,
    employeeId: "EMP103",
    name: "Michael Smith",
    date: "2025-08-28",
    fromTime: "16:00:00",
    toTime: "18:30:00",
    reason: "Had to work from a different location due to a power outage at home.",
    requestDate: "2025-08-28T19:00:00Z",
    status: "PENDING",
    actionBy: null,
    actionDate: null,
    actionComments: null
  }
];

export const PermissionHoursProvider = ({ children }) => {
  const [permissionRequests, setPermissionRequests] = useState(mockPermissionRequests);

  // State for filters, defaulting to the current month and year
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Memoized filtered requests for performance
  const filteredRequests = useMemo(() => {
    return permissionRequests.filter(req => {
      const reqDate = new Date(req.date);
      return reqDate.getMonth() + 1 === selectedMonth && reqDate.getFullYear() === selectedYear;
    });
  }, [permissionRequests, selectedMonth, selectedYear]);

  // --- Admin Actions ---
  const approveRequest = useCallback((id) => {
    setPermissionRequests(prev =>
      prev.map(req =>
        req.id === id
          ? { ...req, status: 'APPROVED', actionDate: new Date().toISOString() }
          : req
      )
    );
  }, []);

  const rejectRequest = useCallback((id) => {
    setPermissionRequests(prev =>
      prev.map(req =>
        req.id === id
          ? { ...req, status: 'REJECTED', actionDate: new Date().toISOString() }
          : req
      )
    );
  }, []);

  // Context value wrapped in useMemo for optimization
  const contextValue = useMemo(() => ({
    requests: filteredRequests,
    approveRequest,
    rejectRequest,
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
  }), [filteredRequests, approveRequest, rejectRequest, selectedMonth, selectedYear]);

  return (
    <PermissionHoursContext.Provider value={contextValue}>
      {children}
    </PermissionHoursContext.Provider>
  );
};