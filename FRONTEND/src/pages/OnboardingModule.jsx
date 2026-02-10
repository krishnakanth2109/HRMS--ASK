import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, UserCheck, Clock, Upload, ChevronRight, 
  ChevronLeft, CheckCircle2, AlertCircle, FileText, 
  Briefcase, X, Loader2
} from 'lucide-react';

const OnboardingModule = ({ userEmail = "test@company.com" }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [agreedPage1, setAgreedPage1] = useState(false);
  const [agreedPage2, setAgreedPage2] = useState(false);
  const [timer, setTimer] = useState(5);
  const [isLocked, setIsLocked] = useState(true);
  const [signatureFile, setSignatureFile] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
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
    formData.append('email', userEmail); // Ensure userEmail prop is passed to component
    formData.append('signature', signatureFile); // This matches upload.single('signature')

    const response = await fetch('/api/invited-employees/complete-onboarding', {
      method: 'POST',
      // No headers needed for FormData
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      setIsSubmitted(true);
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

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 text-center border border-emerald-100">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 mb-2">Onboarding Filed</h2>
          <p className="text-slate-500 mb-8">Success! Your policies are accepted and your signature is securely stored.</p>
          <button onClick={() => window.location.reload()} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700">Close Portal</button>
        </div>
      </div>
    );
  }

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
                  <PolicyCard index={1} text="Employees must maintain professional behavior with colleagues and clients." />
                  <PolicyCard index={2} text="Regular attendance and punctuality are mandatory." />
                  <PolicyCard index={3} text="All leave must be approved in advance." />
                  <PolicyCard index={4} text="Harassment or violence is strictly prohibited." />
                  <PolicyCard index={5} text="Alcohol or drugs during work hours are not allowed." />
                  <PolicyCard index={6} text="Protect company property like laptops and ID cards." />
                </div>

                <div className={`mt-12 p-8 rounded-3xl border-2 transition-all flex flex-col md:flex-row items-center justify-between gap-6 ${agreedPage1 ? 'border-indigo-600 bg-indigo-50/20' : 'border-slate-100 bg-slate-50'}`}>
                  <label className={`flex items-center gap-4 cursor-pointer ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input type="checkbox" disabled={isLocked} checked={agreedPage1} onChange={(e) => setAgreedPage1(e.target.checked)} className="w-7 h-7 rounded-lg text-indigo-600" />
                    <span className="text-lg font-bold text-slate-700">I agree to the Employee Discipline Policy</span>
                  </label>
                  {isLocked && <div className="text-indigo-600 font-bold tracking-tight flex items-center gap-2"><Clock size={18}/> {timer}s</div>}
                </div>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <h2 className="text-3xl font-bold text-slate-800 flex items-center gap-3 mb-10">
                  <ShieldCheck className="text-blue-600" size={32} /> Security & Privacy
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
                  <PolicyCard index={1} text="Company systems must be used only for official work." variant="blue" />
                  <PolicyCard index={2} text="Confidential info must not be shared externally." variant="blue" />
                  <PolicyCard index={3} text="Password sharing is strictly prohibited." variant="blue" />
                  <PolicyCard index={4} text="Unauthorized data transfer is a violation." variant="blue" />
                  <PolicyCard index={5} text="No illegal activities on company network." variant="blue" />
                  <PolicyCard index={6} text="Report security breaches immediately." variant="blue" />
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
                      <h3 className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-2 uppercase tracking-widest"><FileText size={16}/> Signature Upload</h3>
                      {!signaturePreview ? (
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-2xl cursor-pointer">
                          <Upload className="text-slate-500 mb-2" />
                          <p className="text-[10px] text-slate-400">Click to upload image</p>
                          <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                        </label>
                      ) : (
                        <div className="relative bg-white rounded-2xl p-4 h-32 flex justify-center">
                          <img src={signaturePreview} alt="Preview" className="max-h-full object-contain" />
                          <button onClick={() => {setSignaturePreview(null); setSignatureFile(null);}} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X size={14}/></button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && <div className="mx-8 md:mx-14 mb-6 p-4 bg-red-50 text-red-600 rounded-2xl flex items-center gap-3 font-bold text-sm"><AlertCircle size={20}/>{error}</div>}

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

// Sub-components
const TabItem = ({ active, done, label }) => (
  <div className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${active ? 'bg-slate-900 text-white' : 'text-slate-400'}`}>
    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 ${done ? 'bg-emerald-500 border-emerald-500 text-white' : active ? 'border-white' : 'border-slate-300'}`}>{done ? <CheckCircle2 size={10}/> : ""}</div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </div>
);

const PolicyCard = ({ index, text, variant = "indigo" }) => (
  <div className="flex gap-4 p-5 bg-white border border-slate-100 rounded-3xl hover:shadow-md transition-all">
    <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black border ${variant === "indigo" ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>{index}</span>
    <p className="text-slate-600 text-sm leading-relaxed">{text}</p>
  </div>
);

export default OnboardingModule;