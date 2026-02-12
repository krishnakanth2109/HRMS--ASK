import React, { useContext, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EmployeeContext } from '../context/EmployeeContext';
import api from '../api';

// Helper to ensure URLs are always HTTPS to prevent "Failed to load PDF" errors
const getSecureUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http:")) {
    return url.replace("http:", "https:");
  }
  return url;
};

const EmployeeProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { employees } = useContext(EmployeeContext);
  const [activeTab, setActiveTab] = React.useState('personal');
  const [profileImage, setProfileImage] = useState(null);
  const [loadingImage, setLoadingImage] = useState(true);
  
  const employee = employees.find((emp) => String(emp.employeeId) === String(id));

  useEffect(() => {
    const loadProfilePic = async () => {
      if (!employee || !employee.employeeId) return;
      
      if (employee.profilePhoto?.url) {
        setProfileImage(employee.profilePhoto.url);
        setLoadingImage(false);
        return;
      }
      
      setLoadingImage(true);
      try {
        const res = await api.get(`/api/profile/${employee.employeeId}`);
        if (res?.data?.profilePhoto?.url) {
          setProfileImage(res.data.profilePhoto.url);
        }
      } catch (err) {
        console.error("Failed to load profile picture:", err);
      } finally {
        setLoadingImage(false);
      }
    };

    loadProfilePic();
  }, [employee]);

  if (!employee) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full border">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Employee Not Found</h2>
        <p className="text-gray-600 mb-6">The employee you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate(-1)} className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 font-medium">
          Go Back
        </button>
      </div>
    </div>
  );

  const initials = employee.name?.split(' ').map(n => n[0]).join('').toUpperCase();

  const currentExp = Array.isArray(employee.experienceDetails) && employee.experienceDetails.length > 0
    ? (employee.experienceDetails.find(exp => exp.lastWorkingDate === "Present") || employee.experienceDetails[employee.experienceDetails.length - 1])
    : null;

  const safe = (val, fallback = "N/A") => (val !== undefined && val !== null && val !== "") ? val : fallback;

  // Render content based on active tab
  const renderTabContent = () => {
    if (activeTab === 'personal') {
      return (
        <div className="space-y-8">
          {/* Information Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InfoCard label="Full Name" value={safe(employee.name)} />
            <InfoCard label="Email Address" value={safe(employee.email)} />
            <InfoCard label="Phone Number" value={safe(employee.phone)} />
            <InfoCard label="Date of Birth" value={safe(employee.personalDetails?.dob?.split('T')[0])} />
            <InfoCard label="Gender" value={safe(employee.personalDetails?.gender)} />
            <InfoCard label="Nationality" value={safe(employee.personalDetails?.nationality)} />
            <InfoCard label="PAN Number" value={safe(employee.personalDetails?.panNumber)} />
            <InfoCard label="Aadhaar Number" value={safe(employee.personalDetails?.aadhaarNumber)} />
            <InfoCard label="Emergency Contact" value={safe(employee.emergency)} />
          </div>

          {/* Dynamic Identity Document Buttons */}
          <div className="mt-6 border-t pt-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Identity Documents</h3>
            <div className="flex flex-wrap gap-4">
               {employee.personalDetails?.aadhaarFileUrl ? (
                 <a href={getSecureUrl(employee.personalDetails.aadhaarFileUrl)} target="_blank" rel="noopener noreferrer" 
                    className="flex items-center gap-3 bg-white border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 px-6 py-3 rounded-xl transition-all shadow-sm group">
                    <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg group-hover:bg-emerald-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">Verified</p>
                        <p className="text-sm font-bold text-gray-800">Aadhaar Card</p>
                    </div>
                 </a>
               ) : (
                 <div className="px-6 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium">Aadhaar Not Uploaded</div>
               )}

               {employee.personalDetails?.panFileUrl ? (
                 <a href={getSecureUrl(employee.personalDetails.panFileUrl)} target="_blank" rel="noopener noreferrer" 
                    className="flex items-center gap-3 bg-white border-2 border-indigo-100 hover:border-indigo-500 hover:bg-indigo-50 px-6 py-3 rounded-xl transition-all shadow-sm group">
                    <div className="bg-indigo-100 text-indigo-600 p-2 rounded-lg group-hover:bg-indigo-200">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase">Verified</p>
                        <p className="text-sm font-bold text-gray-800">PAN Card</p>
                    </div>
                 </a>
               ) : (
                 <div className="px-6 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium">PAN Not Uploaded</div>
               )}
            </div>
          </div>
        </div>
      );
    }
    
    if (activeTab === 'bank') {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoCard label="Account Number" value={safe(employee.bankDetails?.accountNumber)} />
            <InfoCard label="Bank Name" value={safe(employee.bankDetails?.bankName)} />
            <InfoCard label="IFSC Code" value={safe(employee.bankDetails?.ifsc)} />
            <InfoCard label="Branch" value={safe(employee.bankDetails?.branch)} />
          </div>
        </div>
      );
    }

    if (activeTab === 'experience') {
      return (
        <div className="space-y-6">
          {currentExp && (
            <div className="bg-white border border-blue-200 rounded-lg p-6 shadow-sm mb-4">
              <h3 className="text-lg font-bold text-blue-800 mb-2">Current Employment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoCard label="Company" value={safe(currentExp.company)} />
                <InfoCard label="Department" value={safe(currentExp.department)} />
                <InfoCard label="Role/Position" value={safe(currentExp.role)} />
                <InfoCard label="Salary" value={currentExp.salary ? `₹${Number(currentExp.salary).toLocaleString()}` : "N/A"} />
                <InfoCard label="Joining Date" value={safe(currentExp.joiningDate?.split('T')[0])} />
                <InfoCard label="Employment Type" value={safe(currentExp.employmentType)} />
              </div>
            </div>
          )}
          
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Past Experience</h3>
            {Array.isArray(employee.experienceDetails) && employee.experienceDetails.filter(exp => exp !== currentExp).length > 0 ? (
              employee.experienceDetails
                .filter((exp) => exp !== currentExp)
                .map((exp, idx) => (
                  <div key={idx} className="mb-4 pb-4 border-b last:border-b-0 last:mb-0 last:pb-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoCard label="Company" value={safe(exp.company)} />
                      <InfoCard label="Role/Position" value={safe(exp.role)} />
                      <InfoCard label="Experience Letter" value={exp.experienceLetterUrl ? (
                        <a href={getSecureUrl(exp.experienceLetterUrl)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-medium hover:text-blue-800">View Document</a>
                      ) : "N/A"} />
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-gray-500 text-center py-4">No past experience found.</div>
            )}
          </div>
        </div>
      );
    }

    // ✅ NEW TAB: Company Documents
    if (activeTab === 'documents') {
        return (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-6">Signed Company Documents</h3>
                {employee.companyDocuments && employee.companyDocuments.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {employee.companyDocuments.map((doc, index) => (
                            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl hover:shadow-md transition-all">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="bg-blue-100 text-blue-600 p-2 rounded-lg">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="text-sm font-bold text-gray-800 truncate" title={doc.fileName}>{doc.fileName}</p>
                                        <p className="text-[10px] text-gray-500 font-medium">Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <a href={getSecureUrl(doc.fileUrl)} target="_blank" rel="noopener noreferrer" 
                                   className="ml-4 p-2 bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition-colors">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                </a>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <div className="text-gray-300 mb-2 flex justify-center">
                            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                        </div>
                        <p className="text-gray-400 font-medium">No company documents found for this employee.</p>
                    </div>
                )}
            </div>
          </div>
        );
    }
  };

  const InfoCard = ({ label, value }) => (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="text-sm font-medium text-gray-500 mb-1">{label}</div>
      <div className="text-base font-semibold text-gray-900 truncate" title={typeof value === 'string' ? value : ''}>{value}</div>
    </div>
  );

  function TabButton({ active, onClick, label }) {
    return (
      <button
        className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none ${
          active ? 'border-blue-800 text-blue-900' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }`}
        onClick={onClick}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => navigate(-1)} className="mb-6 flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors duration-200 group">
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">Back to Employee List</span>
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          <div className="bg-blue-800 px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-600 flex items-center justify-center text-3xl sm:text-4xl text-white font-bold mb-6 shadow-lg overflow-hidden border-4 border-white">
                {loadingImage ? (
                  <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full"></div>
                ) : profileImage ? (
                  <img src={profileImage} alt={employee.name} className="w-full h-full object-cover" />
                ) : initials }
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">{safe(employee.name)}</h1>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="px-4 py-2 rounded-md bg-blue-700 text-white font-medium">ID: {safe(employee.employeeId)}</span>
                <span className="px-4 py-2 rounded-md bg-blue-600 text-white font-medium">Dept: {safe(currentExp?.department)}</span>
                <span className="px-4 py-2 rounded-md bg-blue-600 text-white font-medium">Role: {safe(currentExp?.role)}</span>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 bg-white">
            <nav className="flex justify-center overflow-x-auto">
              <div className="flex space-x-8 px-6">
                <TabButton active={activeTab === 'personal'} onClick={() => setActiveTab('personal')} label="Personal" />
                <TabButton active={activeTab === 'bank'} onClick={() => setActiveTab('bank')} label="Banking" />
                <TabButton active={activeTab === 'experience'} onClick={() => setActiveTab('experience')} label="Experience" />
                <TabButton active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} label="Documents" />
              </div>
            </nav>
          </div>

          <div className="p-8 bg-gray-50 min-h-[500px]">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;