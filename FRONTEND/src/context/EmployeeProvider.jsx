import { useState, useEffect } from "react";
import axios from "axios";
import { EmployeeContext } from "./EmployeeContext";

export const EmployeeProvider = ({ children }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Fetch data from backend
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get("http://localhost:5000/employees");
        setEmployees(response.data);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching employees:", err);
        setError("Failed to fetch employee data");
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  // ✅ Add new employee (POST to backend)
  const addEmployee = async (employee) => {
    try {
      const response = await axios.post("http://localhost:5000/api/employees", employee);
      setEmployees((prev) => [...prev, response.data]);
    } catch (err) {
      console.error("Error adding employee:", err);
      alert("Failed to add employee. Check console for details.");
    }
  };

  // ✅ Edit employee (PUT to backend)
  const editEmployee = async (employeeId, updatedData) => {
    try {
      const response = await axios.put(`http://localhost:5000/api/employees/${employeeId}`, updatedData);
      setEmployees((prev) =>
        prev.map((emp) => (emp.employeeId === employeeId ? response.data : emp))
      );
    } catch (err) {
      console.error("Error editing employee:", err);
      alert("Failed to update employee.");
    }
  };

  // ✅ Deactivate employment (PATCH to backend)
  const deactivateEmployment = async (employeeId, endDate, reason) => {
    try {
      const response = await axios.patch(`http://localhost:5000/api/employees/${employeeId}/deactivate`, {
        endDate,
        reason,
      });
      setEmployees((prev) =>
        prev.map((emp) => (emp.employeeId === employeeId ? response.data : emp))
      );
    } catch (err) {
      console.error("Error deactivating employee:", err);
    }
  };

  // ✅ Activate employee (PATCH to backend)
  const activateEmployee = async (employeeId) => {
    try {
      const response = await axios.patch(`http://localhost:5000/api/employees/${employeeId}/activate`);
      setEmployees((prev) =>
        prev.map((emp) => (emp.employeeId === employeeId ? response.data : emp))
      );
    } catch (err) {
      console.error("Error activating employee:", err);
    }
  };

  // ✅ Helper function
  const getEmployeeById = (employeeId) =>
    employees.find((emp) => emp.employeeId === employeeId);

  // ✅ Provide everything through context
  const contextValue = {
    employees,
    loading,
    error,
    addEmployee,
    editEmployee,
    deactivateEmployment,
    activateEmployee,
    getEmployeeById,
  };

  // Optional: show loader or error state globally
  if (loading) return <p>Loading employees...</p>;
  if (error) return <p style={{ color: "red" }}>{error}</p>;

  return (
    <EmployeeContext.Provider value={contextValue}>
      {children}
    </EmployeeContext.Provider>
  );
};
