// // --- START OF FILE LeaveRequestProvider.jsx ---

import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
  useDeferredValue,
} from "react";
import { LeaveRequestContext } from "./LeaveRequestContext";
import {
  getLeaveRequests,
  approveLeaveRequestById,
  rejectLeaveRequestById,
} from "../api";

// ---------------------------------------------------------------------------
// Date utilities (module-level — never recreated)
// ---------------------------------------------------------------------------
const getWeekDates = (baseDate = new Date(), weekOffset = 0) => {
  const today = new Date(baseDate);
  today.setDate(today.getDate() + weekOffset * 7);
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
};

// Stable empty array so consumers that use [] as a default never re-render
const EMPTY_ARRAY = [];

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export const LeaveRequestProvider = ({ children }) => {
  const [leaveRequests, setLeaveRequests] = useState(EMPTY_ARRAY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI filter state
  const [currentWeek, setCurrentWeek] = useState(0);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDept, setFilterDept] = useState("All");

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchRef = useRef(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSetSearchQuery = useCallback((value) => {
    setSearchQuery(value); // keep input responsive
    clearTimeout(debouncedSearchRef.current);
    debouncedSearchRef.current = setTimeout(() => setDebouncedSearch(value), 250);
  }, []);


  const abortRef = useRef(null);

  const fetchLeaveRequests = useCallback(async () => {
    const token =
      sessionStorage.getItem("token") || sessionStorage.getItem("hrms-token");
    if (!token) return;


    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setLoading(true);
      setError(null);
      const data = await getLeaveRequests({ signal: controller.signal });
      if (!controller.signal.aborted) {
        setLeaveRequests(data);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("Error fetching leave requests:", err);
        setError("Failed to load leave data.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []); // no deps — stable for the lifetime of the provider

  useEffect(() => {
    fetchLeaveRequests();
    return () => abortRef.current?.abort(); // cleanup on unmount
  }, [fetchLeaveRequests]);



  const approveLeave = useCallback(
    async (id) => {
      const previous = leaveRequests; // snapshot for rollback

      // Optimistic update
      setLeaveRequests((prev) =>
        prev.map((req) =>
          req.id === id ? { ...req, status: "Approved" } : req
        )
      );

      try {
        await approveLeaveRequestById(id);
        // Server confirmed — no refetch needed; local state is already correct.
      } catch (err) {
        console.error("Failed to approve leave:", err);
        setLeaveRequests(previous); // rollback
        alert("Failed to approve leave request.");
      }
    },
    [leaveRequests]
  );

  const rejectLeave = useCallback(
    async (id) => {
      const previous = leaveRequests;

      setLeaveRequests((prev) =>
        prev.map((req) =>
          req.id === id ? { ...req, status: "Rejected" } : req
        )
      );

      try {
        await rejectLeaveRequestById(id);
      } catch (err) {
        console.error("Failed to reject leave:", err);
        setLeaveRequests(previous);
        alert("Failed to reject leave request.");
      }
    },
    [leaveRequests]
  );

  const buildEmployeeMap = useCallback((employeesData) => {
    if (!employeesData) return {};
    return employeesData.reduce((acc, emp) => {
      acc[emp.employeeId] = emp;
      return acc;
    }, {});
  }, []);

 
  const deferredLeaveRequests = useDeferredValue(leaveRequests);

  // ── Derived metadata (departments, months) ────────────────────────────────
  const { allDepartments, allMonths } = useMemo(() => {
    const depts = [
      ...new Set(deferredLeaveRequests.map((r) => r.department).filter(Boolean)),
    ].sort();
    const months = [
      ...new Set(deferredLeaveRequests.map((r) => r.from.slice(0, 7))),
    ]
      .sort()
      .reverse();
    return { allDepartments: depts, allMonths: months };
  }, [deferredLeaveRequests]);

  // ── getLeaveSummary ───────────────────────────────────────────────────────
  const getLeaveSummary = useCallback(
    ({ selectedMonth, departmentFilter, statusFilter }) => {
      const base =
        selectedMonth === "All"
          ? deferredLeaveRequests
          : deferredLeaveRequests.filter((r) =>
              r.from.startsWith(selectedMonth)
            );

      const filteredRequests = base.filter(
        (r) =>
          (departmentFilter === "All" || r.department === departmentFilter) &&
          (statusFilter === "All" || r.status === statusFilter)
      );

      const summaryStats = filteredRequests.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;
          return acc;
        },
        { Total: filteredRequests.length, Approved: 0, Rejected: 0, Pending: 0 }
      );

      return { summaryStats, filteredRequests };
    },
    [deferredLeaveRequests]
  );

  // ── getWeeklyFilteredRequests ─────────────────────────────────────────────

  const getWeeklyFilteredRequests = useCallback(
    (employeesData) => {
      const weekDates = getWeekDates(new Date(), currentWeek);
      const empMap = buildEmployeeMap(employeesData); // O(n) once

      const filteredRequests = deferredLeaveRequests.filter((req) => {
        // O(1) map lookup instead of .find()
        const emp = empMap[req.employeeId];
        const dept = emp?.experienceDetails?.find(
          (ex) => ex.lastWorkingDate === "Present"
        )?.department;

        const lowerSearch = debouncedSearch.toLowerCase();
        const nameMatch = req.name.toLowerCase().includes(lowerSearch);
        const idMatch = req.employeeId.toLowerCase().includes(lowerSearch);

        return (
          (filterStatus === "All" || req.status === filterStatus) &&
          (filterDept === "All" || dept === filterDept) &&
          (nameMatch || idMatch) &&
          req.from <= weekDates.end &&
          req.to >= weekDates.start
        );
      });

      return { weekDates, filteredRequests };
    },
    [
      deferredLeaveRequests,
      currentWeek,
      filterStatus,
      debouncedSearch, // ← debounced, not raw
      filterDept,
      buildEmployeeMap,
    ]
  );

  // ── Week navigation helpers ───────────────────────────────────────────────
  // Defined outside useMemo so they're stable references across renders.
  const goToPreviousWeek = useCallback(() => setCurrentWeek((w) => w - 1), []);
  const goToNextWeek = useCallback(() => setCurrentWeek((w) => w + 1), []);
  const resetToCurrentWeek = useCallback(() => setCurrentWeek(0), []);
  const isSandwichLeave = useCallback(() => null, []);

  // ── Context value ─────────────────────────────────────────────────────────
  // ── OPTIMIZATION 7: only re-creates the object when something genuinely changes.
  //    Stable callback refs (defined with [] or fixed deps) never trigger
  //    unnecessary re-renders in consumers.
  const contextValue = useMemo(
    () => ({
      leaveRequests,
      loading,
      error,
      approveLeave,
      rejectLeave,
      getLeaveSummary,
      allDepartments,
      allMonths,
      getWeeklyFilteredRequests,
      currentWeek,
      goToPreviousWeek,
      goToNextWeek,
      resetToCurrentWeek,
      filterStatus,
      setFilterStatus,
      searchQuery,           // raw value → keep inputs responsive
      setSearchQuery: handleSetSearchQuery, // debounced setter
      filterDept,
      setFilterDept,
      isSandwichLeave,
      refetch: fetchLeaveRequests, // expose for manual refresh if needed
    }),
    [
      leaveRequests,
      loading,
      error,
      approveLeave,
      rejectLeave,
      getLeaveSummary,
      allDepartments,
      allMonths,
      getWeeklyFilteredRequests,
      currentWeek,
      filterStatus,
      searchQuery,
      filterDept,
      isSandwichLeave,
      handleSetSearchQuery,
      fetchLeaveRequests,
      goToPreviousWeek,
      goToNextWeek,
      resetToCurrentWeek,
    ]
  );

  return (
    <LeaveRequestContext.Provider value={contextValue}>
      {children}
    </LeaveRequestContext.Provider>
  );
};






// import React, { useState, useMemo, useCallback, useEffect } from "react";
// import { LeaveRequestContext } from "./LeaveRequestContext";
// // ✅ IMPORT THE CENTRALIZED API FUNCTIONS
// import { getLeaveRequests, approveLeaveRequestById, rejectLeaveRequestById } from "../api";

// // --- Date Utilities ---
// const getWeekDates = (baseDate = new Date(), weekOffset = 0) => {
//     const today = new Date(baseDate);
//     today.setDate(today.getDate() + weekOffset * 7);
//     const day = today.getDay();
//     const monday = new Date(today);
//     monday.setDate(today.getDate() - day + (day === 0 ? -6 : 1));
//     const sunday = new Date(monday);
//     sunday.setDate(monday.getDate() + 6);
//     return {
//         start: monday.toISOString().split('T')[0],
//         end: sunday.toISOString().split('T')[0],
//     };
// };

// const expandLeaveRange = (from, to) => {
//   // ... (this helper function is correct) ...
// };

// export const LeaveRequestProvider = ({ children }) => {
//   // Single source of truth for all leave requests, fetched from the backend
//   const [leaveRequests, setLeaveRequests] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState(null);

//   // State for UI filters
//   const [currentWeek, setCurrentWeek] = useState(0);
//   const [filterStatus, setFilterStatus] = useState("All");
//   const [searchQuery, setSearchQuery] = useState("");
//   const [filterDept, setFilterDept] = useState("All");

//   // ✅ FETCH ALL LEAVE REQUESTS FROM THE BACKEND
//   const fetchLeaveRequests = useCallback(async () => {
//     // ✅ Skip if no auth token — user is not logged in yet
//     const token = sessionStorage.getItem("token") || sessionStorage.getItem("hrms-token");
//     if (!token) return;

//     try {
//       setLoading(true);
//       const data = await getLeaveRequests();
//       setLeaveRequests(data);
//     } catch (err) {
//       console.error("Error fetching leave requests:", err);
//       setError("Failed to load leave data.");
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     fetchLeaveRequests();
//   }, [fetchLeaveRequests]);

//   // ✅ ACTIONS THAT CALL THE API AND THEN REFETCH DATA
//   const approveLeave = useCallback(async (id) => {
//     try {
//       await approveLeaveRequestById(id);
//       fetchLeaveRequests();
//     } catch (error) {
//       console.error("Failed to approve leave:", error);
//       alert("Failed to approve leave request.");
//     }
//   }, [fetchLeaveRequests]);

//   const rejectLeave = useCallback(async (id) => {
//     try {
//       await rejectLeaveRequestById(id);
//       fetchLeaveRequests();
//     } catch (error) {
//       console.error("Failed to reject leave:", error);
//       alert("Failed to reject leave request.");
//     }
//   }, [fetchLeaveRequests]);

//   // --- DERIVED DATA AND FILTERING FUNCTIONS (NO API CALLS HERE) ---
//   const { allDepartments, allMonths } = useMemo(() => {
//     const depts = [...new Set(leaveRequests.map(req => req.department).filter(Boolean))].sort();
//     const months = [...new Set(leaveRequests.map(req => req.from.slice(0, 7)))].sort().reverse();
//     return { allDepartments: depts, allMonths: months };
//   }, [leaveRequests]);

//   const getLeaveSummary = useCallback((filters) => {
//     // This function now filters the already fetched data
//     const { selectedMonth, departmentFilter, statusFilter } = filters;
//     let requestsToFilter = selectedMonth === 'All'
//       ? leaveRequests
//       : leaveRequests.filter(req => req.from.startsWith(selectedMonth));

//     const filteredRequests = requestsToFilter.filter(req => 
//       (departmentFilter === 'All' || req.department === departmentFilter) &&
//       (statusFilter === 'All' || req.status === statusFilter)
//     );

//     const summaryStats = filteredRequests.reduce((acc, req) => {
//       acc[req.status] = (acc[req.status] || 0) + 1;
//       return acc;
//     }, { Total: filteredRequests.length, Approved: 0, Rejected: 0, Pending: 0 });

//     return { summaryStats, filteredRequests };
//   }, [leaveRequests]);
  
//   const getWeeklyFilteredRequests = useCallback((employeesData) => {
//     // This function also filters the already fetched data
//     const weekDates = getWeekDates(new Date(), currentWeek);
//     const filtered = leaveRequests.filter(req => {
//         const emp = employeesData?.find(e => e.employeeId === req.employeeId);
//         const dept = emp?.experienceDetails?.find(ex => ex.lastWorkingDate === 'Present')?.department;
//         return (filterStatus === 'All' || req.status === filterStatus) &&
//                (filterDept === 'All' || dept === filterDept) &&
//                (req.name.toLowerCase().includes(searchQuery.toLowerCase()) || req.employeeId.toLowerCase().includes(searchQuery.toLowerCase())) &&
//                (req.from <= weekDates.end && req.to >= weekDates.start);
//     });
//     return { weekDates, filteredRequests: filtered };
//   }, [leaveRequests, currentWeek, filterStatus, searchQuery, filterDept]);

//   // --- Other helper functions ---
//   const isSandwichLeave = useCallback(() => null, []);
//   const goToPreviousWeek = useCallback(() => setCurrentWeek(w => w - 1), []);
//   const goToNextWeek = useCallback(() => setCurrentWeek(w => w + 1), []);
//   const resetToCurrentWeek = useCallback(() => setCurrentWeek(0), []);

//   const contextValue = useMemo(() => ({
//     leaveRequests, loading, error, approveLeave, rejectLeave, getLeaveSummary,
//     allDepartments, allMonths, getWeeklyFilteredRequests, currentWeek,
//     goToPreviousWeek, goToNextWeek, resetToCurrentWeek, filterStatus,
//     setFilterStatus, searchQuery, setSearchQuery, filterDept, setFilterDept,
//     isSandwichLeave
//   }), [
//     leaveRequests, loading, error, approveLeave, rejectLeave, getLeaveSummary,
//     allDepartments, allMonths, getWeeklyFilteredRequests, currentWeek, 
//     filterStatus, searchQuery, filterDept, isSandwichLeave
//   ]);

//   return (
//     <LeaveRequestContext.Provider value={contextValue}>
//       {children}
//     </LeaveRequestContext.Provider>
//   );
// };