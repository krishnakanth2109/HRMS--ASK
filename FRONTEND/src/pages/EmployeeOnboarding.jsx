import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
  FaUser, FaEnvelope, FaBuilding, FaPhone, FaMapMarkerAlt,
  FaCalendarAlt, FaBriefcase, FaMoneyBill, FaBirthdayCake, FaFlag,
  FaHeartbeat, FaUniversity, FaCreditCard, FaCodeBranch,
  FaEye, FaEyeSlash, FaLock, FaTimes
} from "react-icons/fa";

// Import API functions
import { getAllCompanies, publicOnboard, sendOnboardingOtp } from "../api"; 

const EmployeeOnboarding = () => {
  // State for Lists
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // OTP State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);

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

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const response = await getAllCompanies();
        setCompanies(response.data || response || []);
      } catch (err) {
        Swal.fire("Error", "Failed to load companies.", "error");
      }
    };
    fetchCompanies();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("bankDetails.")) {
      const field = name.split(".")[1];
      setFormData(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [field]: value } }));
    } else if (name.startsWith("personalDetails.")) {
      const field = name.split(".")[1];
      setFormData(prev => ({ ...prev, personalDetails: { ...prev.personalDetails, [field]: value } }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = () => {
    if (!formData.company) return "Please select your company.";
    if (!formData.name || !formData.email || !formData.password) return "Name, Email, and Password are required.";
    if (formData.password.length < 8) return "Password must be at least 8 characters.";
    if (formData.phone.length !== 10) return "Phone number must be 10 digits.";
    return null;
  };

  // --- STEP 1: INITIAL SUBMIT (SEND OTP) ---
  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      Swal.fire("Validation Error", error, "warning");
      return;
    }

    setLoading(true);
    try {
      // Send OTP to email
      await sendOnboardingOtp(formData.email);
      
      setLoading(false);
      // Open OTP Modal
      setShowOtpModal(true);
      Swal.fire({
        icon: 'info',
        title: 'OTP Sent',
        text: `We have sent a verification code to ${formData.email}`,
        timer: 3000
      });

    } catch (err) {
      setLoading(false);
      Swal.fire("Error", err.message || "Failed to send OTP.", "error");
    }
  };

  // --- STEP 2: FINAL SUBMIT (VERIFY OTP & CREATE) ---
  const handleFinalSubmit = async () => {
    if (otp.length !== 6) {
      Swal.fire("Error", "Please enter a valid 6-digit OTP", "warning");
      return;
    }

    setVerifying(true);

    const payload = {
      ...formData,
      otp: otp, // Include OTP in payload
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
      
      setShowOtpModal(false); // Close modal
      Swal.fire({
        title: "Welcome Aboard!",
        text: "Your onboarding details have been submitted successfully. You can now log in.",
        icon: "success"
      }).then(() => {
        window.location.href = "/"; 
      });

    } catch (err) {
      console.error(err);
      Swal.fire({
        title: "Submission Failed",
        text: err.error || "Invalid OTP or Server Error.",
        icon: "error"
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-10 px-4 flex justify-center items-center relative">
      <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="bg-blue-800 p-8 text-center text-white">
          <h1 className="text-3xl font-bold tracking-wide">Employee Onboarding</h1>
          <p className="mt-2 text-blue-200">Please fill in your details accurately to complete your profile.</p>
        </div>

        <form onSubmit={handleInitialSubmit} className="p-8 space-y-8">
          
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
              <Input icon={<FaHeartbeat />} name="emergency" label="Emergency Contact" value={formData.emergency} onChange={handleChange} />
              
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
              <Input icon={<FaMoneyBill />} name="currentSalary" label="Agreed Salary" type="number" value={formData.currentSalary} onChange={handleChange} />
              
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
          <Section title="Bank Details" color="purple">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input icon={<FaUniversity />} name="bankDetails.bankName" label="Bank Name" value={formData.bankDetails.bankName} onChange={handleChange} />
              <Input icon={<FaCreditCard />} name="bankDetails.accountNumber" label="Account Number" value={formData.bankDetails.accountNumber} onChange={handleChange} />
              <Input icon={<FaCodeBranch />} name="bankDetails.ifsc" label="IFSC Code" value={formData.bankDetails.ifsc} onChange={handleChange} maxLength={11} />
              <Input icon={<FaMapMarkerAlt />} name="bankDetails.branch" label="Branch Name" value={formData.bankDetails.branch} onChange={handleChange} />
            </div>
          </Section>

          {/* Initial Submit Button */}
          <div className="pt-6">
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all transform hover:scale-[1.01] ${
                loading ? "bg-gray-400 cursor-not-allowed" : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:shadow-xl"
              }`}
            >
              {loading ? "Sending Verification Code..." : "Next: Verify Email"}
            </button>
          </div>
        </form>
      </div>

      {/* --- OTP MODAL OVERLAY --- */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowOtpModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
            >
              <FaTimes size={20} />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <FaEnvelope size={28} />
              </div>
              <h2 className="text-2xl font-bold text-gray-800">Verify Email</h2>
              <p className="text-gray-500 text-sm mt-1">
                Enter the 6-digit code sent to <br/><span className="font-semibold text-blue-600">{formData.email}</span>
              </p>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full text-center text-3xl tracking-[10px] font-bold py-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                placeholder="000000"
                autoFocus
              />
              
              <button
                onClick={handleFinalSubmit}
                disabled={verifying}
                className={`w-full py-3 rounded-xl text-white font-bold text-lg shadow-lg ${
                  verifying ? "bg-gray-400" : "bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-emerald-500/30"
                }`}
              >
                {verifying ? "Verifying..." : "Confirm & Submit"}
              </button>

              <div className="text-center">
                <button 
                  type="button"
                  onClick={(e) => { setOtp(""); handleInitialSubmit(e); }}
                  className="text-sm text-blue-500 hover:underline"
                >
                  Resend Code
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

/* --- Reusable Components (Same as before) --- */
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
      placeholder=" " 
    />
  </div>
);

export default EmployeeOnboarding;