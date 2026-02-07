// --- START OF FILE EmployeeOnboarding.jsx ---

import { useState, useEffect } from "react";
import Swal from "sweetalert2"; // ✅ SweetAlert for confirmations
import {
  FaUser, FaEnvelope, FaBuilding, FaPhone, FaMapMarkerAlt,
  FaCalendarAlt, FaBriefcase, FaMoneyBill, FaBirthdayCake, FaFlag,
  FaHeartbeat, FaUniversity, FaCreditCard, FaCodeBranch,
  FaEye, FaEyeSlash, FaLock
} from "react-icons/fa";

// Import API functions (Make sure to add publicOnboard to your api.js)
import { getAllCompanies, publicOnboard } from "../api"; 

const EmployeeOnboarding = () => {
  // State for Lists
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Password Toggle
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    company: "",
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    emergency: "",
    joiningDate: "",
    currentDepartment: "",
    currentRole: "",
    currentSalary: "",
    employmentType: "Full-Time",
    bankDetails: { accountNumber: "", bankName: "", ifsc: "", branch: "" },
    personalDetails: { dob: "", gender: "Male", maritalStatus: "Single", nationality: "" },
  });

  // Fetch Companies on Load
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await getAllCompanies(); // Should be a public or accessible endpoint
        setCompanies(response.data || response || []);
      } catch (err) {
        Swal.fire("Error", "Failed to load companies. Please contact HR.", "error");
      }
    };
    fetchCompanies();
  }, []);

  // Handle Input Changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Handle Nested Objects (Bank/Personal Details)
    if (name.startsWith("bankDetails.")) {
      const field = name.split(".")[1];
      setFormData(prev => ({
        ...prev,
        bankDetails: { ...prev.bankDetails, [field]: value }
      }));
    } else if (name.startsWith("personalDetails.")) {
      const field = name.split(".")[1];
      setFormData(prev => ({
        ...prev,
        personalDetails: { ...prev.personalDetails, [field]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Validation Logic
  const validateForm = () => {
    if (!formData.company) return "Please select your company.";
    if (!formData.name || !formData.email || !formData.password) return "Name, Email, and Password are required.";
    if (formData.password.length < 8) return "Password must be at least 8 characters.";
    if (formData.phone.length !== 10) return "Phone number must be 10 digits.";
    return null;
  };

  // Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();

    const error = validateForm();
    if (error) {
      Swal.fire("Validation Error", error, "warning");
      return;
    }

    // Confirmation Alert
    const confirm = await Swal.fire({
      title: "Submit Details?",
      text: "Please review your details. You cannot edit them after submission.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, Submit"
    });

    if (!confirm.isConfirmed) return;

    setLoading(true);

    // Prepare Payload (similar to AddEmployee structure)
    const payload = {
      ...formData,
      // Ensure specific fields match schema structure if needed
      experienceDetails: [{
        role: formData.currentRole,
        department: formData.currentDepartment,
        startDate: formData.joiningDate,
        lastWorkingDate: "Present",
        salary: formData.currentSalary
      }]
    };

    try {
      await publicOnboard(payload);
      
      Swal.fire({
        title: "Welcome Aboard!",
        text: "Your onboarding details have been submitted successfully.You can now log in our HRMS with your credentials.",
        icon: "success"
      }).then(() => {
        // Reset form or redirect to a login/thank you page
        window.location.href = "/"; 
      });

    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Submission Failed",
        text: err.response?.data?.error || "Something went wrong. Please try again.",
        icon: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-4 flex justify-center items-center">
      <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-800 p-8 text-center text-white">
          <h1 className="text-3xl font-bold tracking-wide">Employee Onboarding</h1>
          <p className="mt-2 text-blue-200">Please fill in your details accurately to complete your profile.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          
          {/* 1. Company Selection */}
          <Section title="Company Association" color="blue">
            <div className="relative">
              <label className="text-sm font-semibold text-gray-600 mb-1 block">Select Your Company *</label>
              <div className="relative">
                <FaBuilding className="absolute left-3 top-3.5 text-gray-400" />
                <select
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
                  required
                >
                  <option value="">-- Select Company --</option>
                  {companies.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          {/* 2. Personal Credentials */}
          <Section title="Personal Information" color="indigo">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input icon={<FaUser />} name="name" label="Full Name *" value={formData.name} onChange={handleChange} required />
              <Input icon={<FaEnvelope />} name="email" label="Email Address *" type="email" value={formData.email} onChange={handleChange} required />
              
              {/* Password */}
              <div className="relative">
                <label className="text-xs font-semibold text-gray-500 absolute left-10 top-2">Create Password *</label>
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full pl-10 pr-10 pt-6 pb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
                <div 
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </div>
              </div>

              <Input icon={<FaPhone />} name="phone" label="Phone Number *" type="tel" maxLength={10} value={formData.phone} onChange={handleChange} required />
              <Input icon={<FaMapMarkerAlt />} name="address" label="Current Address" value={formData.address} onChange={handleChange} />
              <Input icon={<FaHeartbeat />} name="emergency" label="Emergency Contact (Name & Phone)" value={formData.emergency} onChange={handleChange} />
              
              <Input icon={<FaBirthdayCake />} name="personalDetails.dob" type="date" label="Date of Birth" value={formData.personalDetails.dob} onChange={handleChange} />
              <Input icon={<FaFlag />} name="personalDetails.nationality" label="Nationality" value={formData.personalDetails.nationality} onChange={handleChange} />
            </div>
          </Section>

          {/* 3. Job Details */}
          <Section title="Job Details" color="green">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input icon={<FaBriefcase />} name="currentRole" label="Designation/Role *" value={formData.currentRole} onChange={handleChange} required />
              <Input icon={<FaBuilding />} name="currentDepartment" label="Department *" value={formData.currentDepartment} onChange={handleChange} required />
              <Input icon={<FaCalendarAlt />} name="joiningDate" label="Joining Date *" type="date" value={formData.joiningDate} onChange={handleChange} required />
              <Input icon={<FaMoneyBill />} name="currentSalary" label="Agreed Salary (Annual)" type="number" value={formData.currentSalary} onChange={handleChange} />
              
              <div className="relative pt-1">
                <label className="text-xs font-semibold text-gray-500 block mb-1">Employment Type</label>
                <select name="employmentType" value={formData.employmentType} onChange={handleChange} className="w-full p-3 border border-gray-300 rounded-lg bg-white">
                  <option>Full-Time</option>
                  <option>Part-Time</option>
                  <option>Contract</option>
                  <option>Intern</option>
                </select>
              </div>
            </div>
          </Section>

          {/* 4. Bank Details */}
          <Section title="Bank Details (For Salary Crediting)" color="purple">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input icon={<FaUniversity />} name="bankDetails.bankName" label="Bank Name" value={formData.bankDetails.bankName} onChange={handleChange} />
              <Input icon={<FaCreditCard />} name="bankDetails.accountNumber" label="Account Number" value={formData.bankDetails.accountNumber} onChange={handleChange} />
              <Input icon={<FaCodeBranch />} name="bankDetails.ifsc" label="IFSC Code" value={formData.bankDetails.ifsc} onChange={handleChange} maxLength={11} />
              <Input icon={<FaMapMarkerAlt />} name="bankDetails.branch" label="Branch Name" value={formData.bankDetails.branch} onChange={handleChange} />
            </div>
          </Section>

          {/* Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all transform hover:scale-[1.01] ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl"
              }`}
            >
              {loading ? "Submitting Application..." : "Submit Onboarding Form"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

/* --- Reusable Components --- */

const Section = ({ title, children, color }) => (
  <div className={`border border-${color}-100 rounded-xl p-6 bg-${color}-50/30`}>
    <h3 className={`text-xl font-bold text-${color}-800 border-b border-${color}-200 pb-3 mb-5`}>
      {title}
    </h3>
    {children}
  </div>
);

const Input = ({ icon, label, ...props }) => (
  <div className="relative group">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
      {icon}
    </div>
    <label className="absolute left-10 top-2 text-xs font-semibold text-gray-500 pointer-events-none transition-all">
      {label}
    </label>
    <input
      {...props}
      className="w-full pl-10 pr-4 pt-6 pb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white transition-all"
      placeholder=" " // Important for label positioning tricks if using CSS only, but here we hardcode positions
    />
  </div>
);

export default EmployeeOnboarding;