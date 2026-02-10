import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import {
  FaUser, FaEnvelope, FaBuilding, FaPhone, FaMapMarkerAlt,
  FaCalendarAlt, FaBriefcase, FaMoneyBill, FaBirthdayCake, FaFlag,
  FaHeartbeat, FaUniversity, FaCreditCard, FaCodeBranch,
  FaEye, FaEyeSlash, FaLock, FaTimes, FaCheckCircle, FaSearch, FaIdCard
} from "react-icons/fa";
import {
  ShieldCheck, UserCheck, Clock, Upload, ChevronRight,
  ChevronLeft, CheckCircle2, AlertCircle, FileText,
  Briefcase, X, Loader2
} from 'lucide-react';

// Import API functions
import { publicOnboard, sendOnboardingOtp } from "../api";
import api from "../api";

const EmployeeOnboarding = () => {
  // Stage Management: 'onboarding' -> 'compliance' -> 'completed'
  const [stage, setStage] = useState('onboarding');

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
          text: `${error.response.data.message}\n\nPlease contact the HR team to continue.`,
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

      setVerifying(false);
      setShowOtpModal(false);

      Swal.fire({
        icon: 'success',
        title: 'Details Submitted!',
        text: 'Now please review and accept company policies.',
        timer: 3000,
        showConfirmButton: true
      });

      // Transition to HR Compliance Portal
      setStage('compliance');

    } catch (err) {
      setVerifying(false);
      console.error("Onboarding error:", err);
      Swal.fire("Error", err.response?.data?.error || "Onboarding failed. Please try again.", "error");
    }
  };

  // Render based on stage
  if (stage === 'compliance') {
    return <ComplianceModule userEmail={formData.email} userName={formData.name} companyName={verifiedCompany?.name} onComplete={() => setStage('completed')} />;
  }

  if (stage === 'completed') {
    return <CompletionScreen userName={formData.name} companyName={verifiedCompany?.name} />;
  }

  // Default: Onboarding Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-2xl p-8 md:p-12">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">Hi! Welcome to Onboarding Process</h1>
          <p className="text-gray-500">Complete your profile to join your team</p>
        </div>

        <form onSubmit={handleInitialSubmit}>
          <Section title="Email Verification" color="blue">
            <div className="space-y-4">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Input
                    icon={<FaEnvelope />}
                    name="email"
                    label="Company Email Address *"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    readOnly={emailVerified}
                    placeholder="Enter Your Invited Email"
                  />
                </div>
                <div>
                  {!emailVerified && (
                    <button
                      type="button"
                      onClick={handleVerifyEmail}
                      disabled={emailCheckLoading || !formData.email}
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

// HR Compliance Portal Component
const ComplianceModule = ({ userEmail, userName, companyName, onComplete }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [agreedPage1, setAgreedPage1] = useState(false);
  const [agreedPage2, setAgreedPage2] = useState(false);
  const [timer, setTimer] = useState(5);
  const [isLocked, setIsLocked] = useState(true);
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTimer(5);
    setIsLocked(true);
  }, [currentPage]);

  useEffect(() => {
    if (timer > 0) {
      const countdown = setInterval(() => setTimer(prev => prev - 1), 1000);
      return () => clearInterval(countdown);
    } else {
      setIsLocked(false);
    }
  }, [timer]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Please upload a valid image file.");
        return;
      }
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setSignaturePreview(reader.result);
      reader.readAsDataURL(file);
      setError("");
    }
  };

  const handleFinalSubmit = async () => {
    if (!agreedPage1 || !agreedPage2 || !signatureFile) {
      setError("Please ensure both policies are agreed to and your signature is uploaded.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append('email', userEmail);
      formData.append('signature', signatureFile);

      const response = await fetch('/api/invited-employees/complete-onboarding', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: 'Policies Accepted!',
          text: 'Your signature has been securely stored.',
          timer: 2000,
          showConfirmButton: false
        });
        onComplete();
      } else {
        setError(result.error || "Submission failed. Please try again.");
      }
    } catch (err) {
      console.error("Submission error:", err);
      setError("Connection error. Is the backend server running?");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfdfe] py-12 px-4 font-sans text-slate-900">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white shadow-sm border border-slate-200 rounded-2xl">
              <Briefcase className="text-indigo-600" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">HR Compliance Portal</h1>
              <p className="text-sm text-slate-500 font-medium">Agreement for: {userEmail}</p>
            </div>
          </div>

          <div className="flex items-center bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200">
            <TabItem active={currentPage === 1} done={agreedPage1} label="Professional Conduct" />
            <div className="w-4 h-[1px] bg-slate-200 mx-1" />
            <TabItem active={currentPage === 2} done={agreedPage2} label="Security & Privacy" />
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-slate-100 overflow-hidden">
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-slate-50">
            <div
              className="h-full bg-indigo-600 transition-all duration-1000 ease-linear"
              style={{ width: isLocked ? `${(5 - timer) * 20}%` : '100%' }}
            />
          </div>

          <div className="p-8 md:p-14">
            {currentPage === 1 ? (
              <div className="animate-in fade-in duration-500">
                <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3 mb-10">
                  <UserCheck className="text-indigo-600" size={32} /> Workplace Conduct
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <PolicyCard
                    index={1}
                    text="Employees must maintain professional, respectful, and ethical behavior with colleagues, clients, and management at all times while representing the organization."
                  />
                  <PolicyCard
                    index={2}
                    text="Regular attendance and punctuality are mandatory, and repeated late login, early logout, or unapproved absence may result in salary deductions or disciplinary action."
                  />
                  <PolicyCard
                    index={3}
                    text="All leave requests must be submitted and approved in advance through proper channels, and unauthorized leave will be treated as Loss of Pay (LOP)."
                  />
                  <PolicyCard
                    index={4}
                    text="Harassment, discrimination, abusive language, threats, or any form of violence in the workplace is strictly prohibited and may lead to strict disciplinary action."
                  />
                  <PolicyCard
                    index={5}
                    text="Consumption or possession of alcohol, drugs, or any intoxicating substances during work hours or within office premises is strictly not allowed."
                  />
                  <PolicyCard
                    index={6}
                    text="Employees are responsible for safeguarding company property such as laptops, ID cards, systems, and official documents, and misuse or damage may lead to recovery or action."
                  />
                </div>


                <div className={`mt-12 p-8 rounded-3xl border-2 transition-all flex flex-col md:flex-row items-center justify-between gap-6 ${agreedPage1 ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-100 bg-slate-50'}`}>
                  <label className={`flex items-center gap-4 cursor-pointer ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input type="checkbox" disabled={isLocked} checked={agreedPage1} onChange={(e) => setAgreedPage1(e.target.checked)} className="w-7 h-7 rounded-lg text-indigo-600" />
                    <span className="text-lg font-bold text-slate-700">I agree to the Employee Discipline Policy</span>
                  </label>
                  {isLocked && <div className="text-indigo-600 font-bold tracking-tight flex items-center gap-2"><Clock size={18} /> {timer}s</div>}
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3 mb-10">
                  <ShieldCheck className="text-blue-600" size={32} /> Security & Privacy
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
                  <PolicyCard
                    index={1}
                    text="Company systems, computers, email accounts, and network resources must be used strictly for authorized and official work-related purposes only."
                    variant="blue"
                  />
                  <PolicyCard
                    index={2}
                    text="Confidential company, employee, and client information must not be disclosed, shared, or discussed with any unauthorized person inside or outside the organization."
                    variant="blue"
                  />
                  <PolicyCard
                    index={3}
                    text="Sharing passwords, login credentials, or access details with others is strictly prohibited, and employees are personally responsible for securing their accounts."
                    variant="blue"
                  />
                  <PolicyCard
                    index={4}
                    text="Copying, transferring, downloading, or storing official company data without proper authorization is considered a serious policy violation."
                    variant="blue"
                  />
                  <PolicyCard
                    index={5}
                    text="Employees must not use company internet or network access for illegal, harmful, offensive, or non-work-related activities that could affect security."
                    variant="blue"
                  />
                  <PolicyCard
                    index={6}
                    text="Any suspected data breach, phishing attempt, system vulnerability, or unusual activity must be reported immediately to the IT or administration team."
                    variant="blue"
                  />
                </div>


                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                  <div className="lg:col-span-3">
                    <div className={`p-8 rounded-3xl border-2 transition-all h-full ${agreedPage2 ? 'border-blue-600 bg-blue-50/20' : 'border-slate-100 bg-slate-50'}`}>
                      <label className={`flex items-center gap-4 cursor-pointer ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <input type="checkbox" disabled={isLocked} checked={agreedPage2} onChange={(e) => setAgreedPage2(e.target.checked)} className="w-7 h-7 rounded-lg text-blue-600" />
                        <span className="text-lg font-bold text-slate-700">I agree to the Privacy & Security Policy</span>
                      </label>
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="bg-slate-900 rounded-3xl p-6 text-white">
                      <h3 className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest"><FileText size={16} /> Signature Upload</h3>
                      {!signaturePreview ? (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-2xl cursor-pointer">
                          <Upload className="text-slate-500 mb-2" />
                          <p className="text-[10px] text-slate-400">Click to upload image</p>
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      ) : (
                        <div className="relative bg-white rounded-2xl p-4 h-32 flex justify-center">
                          <img src={signaturePreview} alt="Preview" className="max-h-full object-contain" />
                          <button onClick={() => { setSignaturePreview(null); setSignatureFile(null); }} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={14} /></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <div className="mx-8 md:mx-14 mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 font-bold text-sm"><AlertCircle size={20} />{error}</div>}

          {/* Footer */}
          <div className="px-8 md:px-14 py-8 bg-slate-50 border-t flex justify-between">
            <button onClick={() => setCurrentPage(1)} className={`font-bold text-slate-600 ${currentPage === 1 ? 'invisible' : ''}`}>Back</button>
            {currentPage === 1 ? (
              <button onClick={() => setCurrentPage(2)} disabled={!agreedPage1} className={`px-10 py-4 rounded-2xl font-bold ${agreedPage1 ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>Next Policy</button>
            ) : (
              <button onClick={handleFinalSubmit} disabled={isSubmitting} className={`flex items-center gap-2 px-12 py-4 rounded-2xl font-bold text-white ${agreedPage2 && signatureFile ? 'bg-slate-900 hover:bg-black' : 'bg-slate-400'}`}>
                {isSubmitting ? <><Loader2 className="animate-spin" /> Submitting...</> : 'Complete Onboarding'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Completion Screen Component
const CompletionScreen = ({ userName, companyName }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-blue-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl p-10 md:p-16 text-center border-2 border-emerald-100">
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
          <CheckCircle2 className="w-14 h-14 text-white" strokeWidth={3} />
        </div>

        <h2 className="text-4xl md:text-5xl font-bold text-slate-800 mb-3">
          Onboarding Completed
        </h2>

        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-6 my-8 border border-indigo-100">
          <p className="text-lg text-slate-700 mb-2">
            Welcome aboard, <span className="font-bold text-indigo-600">{userName}</span>!
          </p>
          <p className="text-slate-600">
            You are now officially part of <span className="font-bold text-blue-600">{companyName}</span>
          </p>
        </div>

        <div className="space-y-3 text-left bg-slate-50 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-slate-700">Your personal details have been recorded</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-slate-700">Company policies have been accepted</p>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-slate-700">Your signature has been securely stored</p>
          </div>
        </div>

        <p className="text-slate-500 mb-8 text-sm">
          Your HR team will be in touch shortly with your next steps. Check your email for login credentials and additional information.
        </p>

        <button
          onClick={() => window.location.href = '/'}
          className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold text-lg hover:from-indigo-700 hover:to-blue-700 shadow-lg transition-all active:scale-95"
        >
          Go to Login Portal
        </button>
      </div>
    </div>
  );
};

// Sub-components
const TabItem = ({ active, done, label }) => (
  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${active ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 ${done ? 'bg-emerald-500 border-emerald-500 text-white' : active ? 'border-white' : 'border-slate-300'}`}>{done ? <CheckCircle2 size={10} /> : ""}</div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </div>
);

const PolicyCard = ({ index, text, variant = "indigo" }) => (
  <div className="flex gap-4 p-5 bg-white border border-slate-100 rounded-3xl hover:shadow-md transition-all">
    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border ${variant === "indigo" ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>{index}</span>
    <p className="text-slate-600 text-sm leading-relaxed">{text}</p>
  </div>
);

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