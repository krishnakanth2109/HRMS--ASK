import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
  FaUser, FaEnvelope, FaBuilding, FaPhone, FaMapMarkerAlt,
  FaCalendarAlt, FaBriefcase, FaMoneyBill, FaBirthdayCake, FaFlag,
  FaHeartbeat, FaUniversity, FaCreditCard, FaCodeBranch,
  FaEye, FaEyeSlash, FaLock, FaTimes, FaCheckCircle, FaSearch, FaIdCard
} from "react-icons/fa";

// Import API functions
import { publicOnboard, sendOnboardingOtp } from "../api";
import api from "../api";

const EmployeeOnboarding = () => {
  // State for Lists
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Email Verification State
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifiedCompany, setVerifiedCompany] = useState(null);
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);

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
    currentSalary: 0,
    employmentType: "",
    bankDetails: { accountNumber: "", bankName: "", ifsc: "", branch: "" },
    personalDetails: { dob: "", gender: "Male", maritalStatus: "Single", nationality: "" },
  });

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

  // --- UPDATED EMAIL VERIFICATION HANDLER ---
  const handleVerifyEmail = async () => {
    const email = formData.email.trim();

    if (!email || !email.includes('@')) {
      Swal.fire("Invalid Email", "Please enter a valid email address", "warning");
      return;
    }

    setEmailCheckLoading(true);

    try {
      const response = await api.post('/api/invited-employees/verify-email', { email });

      if (response.data.success) {
        const empData = response.data.data;
        setEmailVerified(true);
        setVerifiedCompany(empData.company);

        // Auto-fill and lock fields (Added Employment Type and Salary logic)
        setFormData(prev => ({
          ...prev,
          company: empData.company._id,
          name: empData.name || "",
          currentRole: empData.role || "",
          currentDepartment: empData.department || "",
          employmentType: empData.employmentType || "FULL TIME",
          currentSalary: empData.salary || 0
        }));

        Swal.fire({
          icon: 'success',
          title: 'Email Verified!',
          text: `Welcome to ${empData.company.name}, ${empData.name || 'Employee'}! Please complete your onboarding form.`,
          timer: 4000,
          showConfirmButton: true
        });
      }
    } catch (error) {
      setEmailVerified(false);
      setVerifiedCompany(null);

      if (error.response?.data?.onboarded) {
        Swal.fire({
          icon: 'info',
          title: 'Already Onboarded',
          text: error.response.data.message,
          confirmButtonColor: '#3085d6'
        });
      } else if (error.response?.status === 404) {
        Swal.fire({
          icon: 'error',
          title: 'Email Not Invited',
          text: 'This email has not been invited by any company. Please contact your HR department.',
          confirmButtonColor: '#dc2626'
        });
      } else {
        Swal.fire("Error", error.response?.data?.error || "Verification failed", "error");
      }
    } finally {
      setEmailCheckLoading(false);
    }
  };

  const validateForm = () => {
    if (!formData.company) return "Company verification failed. Please use an invited email.";
    if (!formData.name || !formData.email || !formData.password) return "Name, Email, and Password are required.";
    if (formData.password.length < 8) return "Password must be at least 8 characters.";
    if (formData.phone.length !== 10) return "Phone number must be 10 digits.";
    if (!emailVerified) return "Please verify your email first.";
    return null;
  };

  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      Swal.fire("Validation Error", error, "warning");
      return;
    }

    setLoading(true);
    try {
      await sendOnboardingOtp(formData.email);
      setLoading(false);
      setShowOtpModal(true);
      Swal.fire({ icon: 'info', title: 'OTP Sent', text: `Verification code sent to ${formData.email}`, timer: 3000 });
    } catch (err) {
      setLoading(false);
      Swal.fire("Error", err.message || "Failed to send OTP.", "error");
    }
  };



const handleFinalSubmit = async () => {
  if (otp.length !== 6) {
    Swal.fire("Error", "Please enter a valid 6-digit OTP", "warning");
    return;
  }

  setVerifying(true);

  // Construct the payload to match employeeModel.js
  const payload = {
    ...formData,
    otp: otp,
    // Ensure this matches the experienceSchema in your model
    experienceDetails: [{
      company: verifiedCompany?.name || "", // Optional: Add current company name
      role: formData.currentRole,
      department: formData.currentDepartment,
      joiningDate: formData.joiningDate, // Change from 'startDate' to 'joiningDate'
      lastWorkingDate: "Present",
      salary: Number(formData.currentSalary),
      employmentType: formData.employmentType, // <--- ADD THIS HERE
    }]
  };

  try {
    // 1. Send to public onboarding route
    await publicOnboard(payload);

    // 2. Mark as onboarded in your invitation tracking table
    await api.post('/api/invited-employees/mark-onboarded', {
      email: formData.email
    });

    setShowOtpModal(false);
    Swal.fire({
      title: "Welcome Aboard!",
      text: "Your onboarding details have been submitted successfully.",
      icon: "success"
    }).then(() => {
      window.location.href = "/";
    });

  } catch (err) {
    console.error("Onboarding Error:", err);
    Swal.fire({
      title: "Submission Failed",
      text: err.response?.data?.error || "Invalid OTP or Server Error.",
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

          {/* Email Verification Section */}
          <Section title="Email Verification" color="blue">
            <div className="space-y-4">
              <div className="relative">
                <label className="text-sm font-semibold text-gray-600 mb-1 block">
                  Enter Your Invited Email Address *
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      readOnly={emailVerified}
                      className={`w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${emailVerified ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                      placeholder="e.g. john.doe@company.com"
                      required
                    />
                    {emailCheckLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                      </div>
                    )}
                  </div>
                  {!emailVerified && (
                    <button
                      type="button"
                      onClick={handleVerifyEmail}
                      disabled={emailCheckLoading}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center gap-2"
                    >
                      <FaSearch size={14} /> Proceed
                    </button>
                  )}
                </div>
              </div>

              {emailVerified && verifiedCompany && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
                  <FaCheckCircle className="text-green-600 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <p className="text-green-800 font-semibold">✓ Email Verified Successfully</p>
                    <p className="text-green-700 text-sm mt-1">
                      Company: <span className="font-bold">{verifiedCompany.name}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {emailVerified && (
            <>
              <Section title="Personal Information" color="indigo">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    icon={<FaUser />}
                    name="name"
                    label="Full Name *"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    readOnly={emailVerified}
                    placeholder="Enter your full name"
                  />

                  <div className="relative">
                    <label className="text-xs font-semibold text-gray-500 absolute left-10 top-2">Create Password *</label>
                    <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min 8 characters"
                      className="w-full pl-10 pr-10 pt-6 pb-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gray-400"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Please remember this password for future logins.</p>
                  </div>

                  <Input icon={<FaPhone />} name="phone" label="Phone Number *" type="tel" maxLength={10} value={formData.phone} onChange={handleChange} required placeholder="10-digit mobile number" />
                  <Input icon={<FaMapMarkerAlt />} name="address" label="Current Address" value={formData.address} onChange={handleChange} placeholder="House No, Street, City, State" />
                  <Input icon={<FaHeartbeat />} name="emergency" label="Emergency Contact" value={formData.emergency} onChange={handleChange} placeholder="Name - Relationship - Phone" />

                  <Input icon={<FaBirthdayCake />} name="personalDetails.dob" type="date" label="Date of Birth" value={formData.personalDetails.dob} onChange={handleChange} />
                  <Input icon={<FaFlag />} name="personalDetails.nationality" label="Nationality" value={formData.personalDetails.nationality} onChange={handleChange} placeholder="e.g. Indian" />
                </div>
              </Section>

              <Section title="Job Details" color="green">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input
                    icon={<FaBriefcase />}
                    name="currentRole"
                    label="Designation/Role *"
                    value={formData.currentRole}
                    onChange={handleChange}
                    required
                    readOnly={true}
                    placeholder="Role"
                  />
                  <Input
                    icon={<FaBuilding />}
                    name="currentDepartment"
                    label="Department *"
                    value={formData.currentDepartment}
                    onChange={handleChange}
                    required
                    readOnly={true}
                    placeholder="Department"
                  />
                  <Input
                    icon={<FaIdCard />}
                    name="employmentType"
                    label="Employment Type *"
                    value={formData.employmentType}
                    readOnly={true}
                    placeholder="Employment Type"
                  />
                  <Input icon={<FaCalendarAlt />} name="joiningDate" label="Joining Date *" type="date" value={formData.joiningDate} onChange={handleChange} required />
                  
                  {/* Conditional Agreed Salary Field */}
                  {Number(formData.currentSalary) > 0 && (
                    <Input 
                      icon={<FaMoneyBill />} 
                      name="currentSalary" 
                      label="Agreed Salary" 
                      type="number" 
                      value={formData.currentSalary} 
                      readOnly={true}
                      placeholder="Salary Amount"
                    />
                  )}
                </div>
              </Section>

              {/* Conditional Bank Details Section */}
              {Number(formData.currentSalary) > 0 && (
                <Section title="Bank Details" color="purple">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input icon={<FaUniversity />} name="bankDetails.bankName" label="Bank Name" value={formData.bankDetails.bankName} onChange={handleChange} placeholder="e.g. HDFC Bank" />
                    <Input icon={<FaCreditCard />} name="bankDetails.accountNumber" label="Account Number" value={formData.bankDetails.accountNumber} onChange={handleChange} placeholder="Enter Account Number" />
                    <Input icon={<FaCodeBranch />} name="bankDetails.ifsc" label="IFSC Code" value={formData.bankDetails.ifsc} onChange={handleChange} maxLength={11} placeholder="e.g. HDFC0001234" />
                    <Input icon={<FaMapMarkerAlt />} name="bankDetails.branch" label="Branch Name" value={formData.bankDetails.branch} onChange={handleChange} placeholder="Enter Branch Name" />
                  </div>
                </Section>
              )}

              <div className="pt-6">
                <button type="submit" disabled={loading} className="w-full py-4 rounded-xl text-white font-bold text-lg bg-blue-600 hover:bg-blue-700 shadow-lg transition-all active:scale-95">
                  {loading ? "Processing..." : "Submit Onboarding Details"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>

      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setShowOtpModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
              <FaTimes size={20} />
            </button>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">Verify Email</h2>
              <p className="text-gray-500">Enter code sent to {formData.email}</p>
            </div>
            <input
              type="text"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center text-3xl font-bold py-4 border-2 rounded-xl focus:border-blue-500 outline-none"
              placeholder="000000"
            />
            <button onClick={handleFinalSubmit} disabled={verifying} className="w-full py-3 mt-4 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition shadow-md">
              {verifying ? "Verifying..." : "Confirm & Submit"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Reusable Components
const Section = ({ title, children, color }) => (
  <div className={`border border-${color}-100 rounded-xl p-6 bg-${color}-50/30 mb-6 shadow-sm`}>
    <h3 className={`text-xl font-bold text-${color}-800 border-b border-${color}-200 pb-3 mb-5`}>{title}</h3>
    {children}
  </div>
);

const Input = ({ icon, label, readOnly, ...props }) => (
  <div className="relative group">
    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
    <label className="absolute left-10 top-2 text-xs font-semibold text-gray-500">{label}</label>
    <input
      {...props}
      readOnly={readOnly}
      className={`w-full pl-10 pr-4 pt-6 pb-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-400 ${readOnly ? 'bg-gray-100 cursor-not-allowed text-gray-600' : 'bg-white'}`}
    />
  </div>
);

export default EmployeeOnboarding;