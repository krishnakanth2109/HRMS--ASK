import React, { useEffect, useState } from "react";
import axios from "axios";

const CurrentEmployeeProfile = () => {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ get logged user from localStorage
  const loggedUser = JSON.parse(localStorage.getItem("hrmsUser"));
  const loggedEmail = loggedUser?.email;

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const res = await axios.get("http://localhost:5000/employees");

        // ✅ find employee by email (same as dashboard)
        const emp = res.data.find((e) => e.email === loggedEmail);

        setEmployee(emp || null);
      } catch (err) {
        console.error("Error fetching employee:", err);
      } finally {
        setLoading(false);
      }
    };

    if (loggedEmail) fetchEmployee();
  }, [loggedEmail]);

  if (loading) return <div className="p-6 text-xl">Loading profile...</div>;
  if (!employee) return <div className="p-6 text-red-600">Employee not found</div>;

  // ✅ extract related data
  const personal = employee.personalDetails || {};
  const bank = employee.bankDetails || {};
  const experience = employee.experienceDetails || [];

  // ✅ split emergency name - number
  let emergencyName = "";
  let emergencyPhone = "";
  if (employee.emergency?.includes("-")) {
    const parts = employee.emergency.split("-");
    emergencyName = parts[0].trim();
    emergencyPhone = parts[1].trim();
  }

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-semibold mb-6">Employee Profile</h2>

      {/* BASIC DETAILS */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h3 className="font-bold text-lg mb-3">Basic Details</h3>
        <p><strong>Employee ID:</strong> {employee.employeeId}</p>
        <p><strong>Name:</strong> {employee.name}</p>
        <p><strong>Email:</strong> {employee.email}</p>
        <p><strong>Phone:</strong> {employee.phone}</p>
        <p><strong>Address:</strong> {employee.address}</p>
        <p><strong>Emergency Contact Name:</strong> {emergencyName}</p>
        <p><strong>Emergency Contact Phone:</strong> {emergencyPhone}</p>
      </div>

      {/* PERSONAL DETAILS */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h3 className="font-bold text-lg mb-3">Personal Details</h3>
        <p><strong>Date of Birth:</strong> {personal.dob?.split("T")[0]}</p>
        <p><strong>Gender:</strong> {personal.gender}</p>
        <p><strong>Marital Status:</strong> {personal.maritalStatus}</p>
        <p><strong>Nationality:</strong> {personal.nationality}</p>
        <p><strong>Aadhaar Number:</strong> {personal.aadharNumber}</p>
        <p><strong>PAN Number:</strong> {personal.panNumber}</p>

        <p>
          <strong>Aadhaar File:</strong>{" "}
          {personal.aadharFileUrl ? (
            <a href={personal.aadharFileUrl} className="text-blue-600 underline" target="_blank">
              View Aadhaar
            </a>
          ) : "Not Uploaded"}
        </p>

        <p>
          <strong>PAN File:</strong>{" "}
          {personal.panFileUrl ? (
            <a href={personal.panFileUrl} className="text-blue-600 underline" target="_blank">
              View PAN
            </a>
          ) : "Not Uploaded"}
        </p>
      </div>

      {/* JOB DETAILS */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h3 className="font-bold text-lg mb-3">Job Details</h3>
        <p><strong>Department:</strong> {employee.currentDepartment}</p>
        <p><strong>Role:</strong> {employee.currentRole}</p>
        <p><strong>Date of Joining:</strong> {employee.joiningDate?.split("T")[0]}</p>
        <p><strong>Current Salary:</strong> ₹{employee.currentSalary}</p>
      </div>

      {/* BANK DETAILS */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h3 className="font-bold text-lg mb-3">Bank Details</h3>
        <p><strong>Bank Name:</strong> {bank.bankName}</p>
        <p><strong>Account Number:</strong> {bank.accountNumber}</p>
        <p><strong>IFSC Code:</strong> {bank.ifsc}</p>
        <p><strong>Branch:</strong> {bank.branch}</p>
      </div>

      {/* EXPERIENCE */}
      <div className="bg-white p-6 rounded shadow mb-6">
        <h3 className="font-bold text-lg mb-4">Experience Details</h3>

        {experience.map((exp, index) => (
          <div key={index} className="mb-4 border-b pb-2">
            <p><strong>Company:</strong> {exp.company}</p>
            <p><strong>Role:</strong> {exp.role}</p>
            <p><strong>Department:</strong> {exp.department}</p>
            <p><strong>Years:</strong> {exp.years}</p>
            <p><strong>Joining:</strong> {exp.joiningDate?.split("T")[0]}</p>
            <p><strong>Last Working:</strong> 
              {exp.lastWorkingDate === "Present"
                ? "Present"
                : exp.lastWorkingDate?.split("T")[0]}
            </p>
            <p><strong>Salary:</strong> ₹{exp.salary}</p>
            <p><strong>Reason:</strong> {exp.reason || "N/A"}</p>

            {exp.experienceLetterUrl ? (
              <p>
                <a
                  href={exp.experienceLetterUrl}
                  className="text-blue-600 underline"
                  target="_blank"
                >
                  View Experience Letter
                </a>
              </p>
            ) : (
              <p><strong>Experience Letter:</strong> Not Uploaded</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CurrentEmployeeProfile;
