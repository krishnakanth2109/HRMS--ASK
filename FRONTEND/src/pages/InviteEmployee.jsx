import React, { useState, useEffect } from 'react';
import { Send, Plus, X, Trash2, RefreshCw, Briefcase, Mail, Building2, UserPlus, History, Banknote  ,
   CheckCircle, 
  Clock, FileText } from 'lucide-react';
import { getAllCompanies } from '../api';
import api from '../api';

const SendOnboardingForm = () => {
  const [activeTab, setActiveTab] = useState('single');
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Configuration States
  const [emailSubject, setEmailSubject] = useState('Welcome to [Company Name] – Complete Your Onboarding Process');
  const [formLink, setFormLink] = useState(`https://hrms-420.netlify.app/employee-onboarding`);
  const [emailMessage, setEmailMessage] = useState(`Dear [NAME],

We are pleased to welcome you to [COMPANY].

Congratulations on your appointment as [ROLE] ([EMPLOYMENT_TYPE]) in the [DEPT] department. We are excited to have you join our team and look forward to your contributions.

As part of the onboarding process, please complete your employee profile using the link below:

[ONBOARDING_LINK]

The information provided will help us set up your official records, system access, and other employment formalities.

Kindly complete the form at your earliest convenience. If you have any questions or need assistance, please contact the HR team.

We look forward to working with you.

Warm regards,  
HR Team  
[COMPANY]`);

  const [singleData, setSingleData] = useState({ email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' });
  const [bulkRows, setBulkRows] = useState([{ email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' }]);
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState([]);

  useEffect(() => {
    fetchCompanies();
    fetchHistory();
  }, []);

  const fetchCompanies = async () => {
    try {
      const response = await getAllCompanies();
      setCompanies(Array.isArray(response.data) ? response.data : response);
    } catch (error) { console.error(error); } finally { setLoadingCompanies(false); }
  };

  const fetchHistory = async () => {
    try {
      const response = await api.get('/api/invited-employees/history');
      setSentHistory(response.data.data);
    } catch (error) { console.error("History fetch error", error); }
  };

  const getSelectedCompanyName = () => {
    const comp = companies.find(c => c._id === selectedCompany);
    return comp ? comp.name : "[COMPANY NAME]";
  };

  const parseMessage = (msg, user) => {
    return msg
      .replace(/\[NAME\]/g, user.name || 'Employee')
      .replace(/\[ROLE\]/g, user.role || 'Team Member')
      .replace(/\[DEPT\]/g, user.department || 'General')
      .replace(/\[EMPLOYMENT_TYPE\]/g, user.employmentType || 'Full Time')
      .replace(/\[COMPANY\]/g, getSelectedCompanyName())
      .replace(/\[ONBOARDING_LINK\]/g, formLink);
  };
  const parseSubject = () => {
    return emailSubject.replace(/\[Company Name\]/g, getSelectedCompanyName());
  };


  const handleSendSingle = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Please select a company first');
    setSending(true);
    try {
      await api.post('/api/invited-employees/invite', { ...singleData, companyId: selectedCompany });

      await api.post('/api/mail/send-onboarding', {
        recipientEmail: singleData.email,
        emailSubject: parseSubject(),
        emailMessage: parseMessage(emailMessage, singleData),
        formLink: formLink
      });

      setSingleData({ email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' });
      fetchHistory();
      alert("Invitation sent successfully!");
    } catch (error) { alert(error.response?.data?.error || "Error"); } finally { setSending(false); }
  };

  const handleSendBulk = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return alert('Select Company');
    const validRows = bulkRows.filter(r => r.email && r.email.includes('@'));
    setSending(true);
    try {
      await api.post('/api/invited-employees/invite-bulk', { employees: validRows, companyId: selectedCompany });
      for (let emp of validRows) {
        await api.post('/api/mail/send-onboarding', {
          recipientEmail: emp.email,
          emailSubject: parseSubject(),
          emailMessage: parseMessage(emailMessage, emp),
          formLink: formLink
        });
      }
      setBulkRows([{ email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' }]);
      fetchHistory();
      alert("Bulk emails sent!");
    } catch (error) { console.error(error); } finally { setSending(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure? This will permanently delete the invitation record from the database.")) return;
    try {
      await api.delete(`/api/invited-employees/${id}`);
      setSentHistory(prev => prev.filter(item => item._id !== id));
    } catch (error) { alert("Delete failed"); }
  };

  const addBulkRow = () => setBulkRows([...bulkRows, { email: '', name: '', role: '', department: 'IT', employmentType: '', salary: '' }]);
  const updateBulkRow = (index, field, value) => {
    const updated = [...bulkRows];
    updated[index][field] = value;
    setBulkRows(updated);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 font-sans antialiased text-slate-800">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* LEFT COLUMN: SETUP & FORM */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
              <UserPlus className="text-blue-600" size={32} /> Invite Employee to Onboarding Process
            </h1>
          </div>

          {/* 1. CONFIGURATION CARD */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-4 text-blue-600 font-bold uppercase text-xs tracking-widest">
              <Mail size={16} /> Email Customization
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 ml-1">Subject Line</label>
                <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 ml-1">Onboarding Link</label>
                <input value={formLink} onChange={e => setFormLink(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 ml-1">Email Body</label>
              <textarea rows="4" value={emailMessage} onChange={e => setEmailMessage(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all" />
              <p className="text-[10px] text-slate-400 mt-1 italic">Available tags: [NAME], [COMPANY], [ROLE], [DEPT], [EMPLOYMENT_TYPE], [ONBOARDING_LINK]</p>
            </div>
          </div>

          {/* 2. COMPANY & TAB SELECTOR */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
              <label className="text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-2"><Building2 size={14} /> Target Company</label>
              <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} className="w-full p-3 bg-blue-50/50 border border-blue-100 rounded-xl font-semibold text-blue-700 outline-none">
                <option value="">Choose Company...</option>
                {companies.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            <div className="bg-slate-200/50 p-1.5 rounded-2xl flex gap-1">
              <button onClick={() => setActiveTab('single')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'single' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Single</button>
              <button onClick={() => setActiveTab('bulk')} className={`flex-1 py-3 rounded-xl font-bold transition-all ${activeTab === 'bulk' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Bulk Invite</button>
            </div>
          </div>

          {/* 3. INPUT FORM */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5"><Send size={80} /></div>

            {activeTab === 'single' ? (
              <form onSubmit={handleSendSingle} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Full Name</label>
                    <input placeholder="John Doe" required value={singleData.name} onChange={e => setSingleData({ ...singleData, name: e.target.value })} className="w-full p-3 border rounded-xl outline-none focus:border-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Email Address</label>
                    <input placeholder="john@company.com" type="email" required value={singleData.email} onChange={e => setSingleData({ ...singleData, email: e.target.value })} className="w-full p-3 border rounded-xl outline-none focus:border-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Designation / Role</label>
                    <input placeholder="Project Manager" required value={singleData.role} onChange={e => setSingleData({ ...singleData, role: e.target.value })} className="w-full p-3 border rounded-xl outline-none focus:border-blue-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Department</label>
                    <select value={singleData.department} onChange={e => setSingleData({ ...singleData, department: e.target.value })} className="w-full p-3 border rounded-xl outline-none focus:border-blue-500 bg-white">
                      <option value="IT">IT Department</option>
                      <option value="NON-IT">NON-IT Department</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Employment Type</label>
                    <select required value={singleData.employmentType} onChange={e => setSingleData({ ...singleData, employmentType: e.target.value })} className="w-full p-3 border rounded-xl outline-none focus:border-blue-500 bg-white">
                      <option value="">Select Type...</option>
                      <option value="Full-time">Full-time</option>
                      <option value="Intern">Intern</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </div>
                  {singleData.employmentType && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 ml-1 uppercase">Monthly Salary</label>
                      <input type="number" placeholder="Enter Amount" required value={singleData.salary} onChange={e => setSingleData({ ...singleData, salary: e.target.value })} className="w-full p-3 border rounded-xl outline-none focus:border-blue-500" />
                    </div>
                  )}
                </div>
                <button disabled={sending || !selectedCompany} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:bg-slate-300 flex items-center justify-center gap-2">
                  {sending ? <RefreshCw className="animate-spin" /> : <Send size={18} />}
                  {sending ? "Processing..." : `Send Invitation to ${singleData.name || 'Employee'}`}
                </button>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                  {bulkRows.map((row, idx) => (
                    <div key={idx} className="flex flex-wrap md:flex-nowrap gap-3 items-end bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                      <div className="flex-1 min-w-[120px]">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Name</label>
                        <input placeholder="Name" className="w-full p-2 text-sm border rounded-lg focus:ring-1 ring-blue-500 outline-none" value={row.name} onChange={e => updateBulkRow(idx, 'name', e.target.value)} />
                      </div>
                      <div className="flex-[1.2] min-w-[150px]">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Email</label>
                        <input placeholder="Email" className="w-full p-2 text-sm border rounded-lg focus:ring-1 ring-blue-500 outline-none" value={row.email} onChange={e => updateBulkRow(idx, 'email', e.target.value)} />
                      </div>
                      <div className="flex-1 min-w-[100px]">
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Role</label>
                        <input placeholder="Role" className="w-full p-2 text-sm border rounded-lg focus:ring-1 ring-blue-500 outline-none" value={row.role} onChange={e => updateBulkRow(idx, 'role', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Dept</label>
                        <select className="p-2 text-sm border rounded-lg bg-white outline-none" value={row.department} onChange={e => updateBulkRow(idx, 'department', e.target.value)}>
                          <option value="IT">IT</option>
                          <option value="NON-IT">NON-IT</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Type</label>
                        <select className="p-2 text-sm border rounded-lg bg-white outline-none" value={row.employmentType} onChange={e => updateBulkRow(idx, 'employmentType', e.target.value)}>
                          <option value="">Type</option>
                          <option value="FULL TIME">FT</option>
                          <option value="INTERN">INT</option>
                          <option value="CONTRACT">CON</option>
                        </select>
                      </div>
                      {row.employmentType && (
                        <div className="w-20">
                          <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">Sal</label>
                          <input type="number" placeholder="Amt" className="w-full p-2 text-sm border rounded-lg focus:ring-1 ring-blue-500 outline-none" value={row.salary} onChange={e => updateBulkRow(idx, 'salary', e.target.value)} />
                        </div>
                      )}
                      <button onClick={() => setBulkRows(bulkRows.filter((_, i) => i !== idx))} className="mb-1 p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <X size={18} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={addBulkRow} className="flex-1 py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 font-bold hover:bg-slate-50 hover:border-blue-300 hover:text-blue-600 transition-all flex items-center justify-center gap-2">
                    <Plus size={18} /> Add Employee Row
                  </button>
                  <button onClick={handleSendBulk} disabled={sending || !selectedCompany} className="flex-[2] py-4 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-xl disabled:bg-slate-300">
                    {sending ? "Blasting Emails..." : `Confirm & Send ${bulkRows.length} Invitations`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: REAL-TIME HISTORY */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[calc(100vh-100px)] sticky top-8">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h2 className="font-black text-xl flex items-center gap-2 italic tracking-tighter"><History size={20} />Onboarding Logs</h2>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Employees Onboarding Status</p>
              </div>
              <button onClick={fetchHistory} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-all">
                <RefreshCw size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50">
              {sentHistory.length === 0 && (
                <div className="text-center py-20">
                  <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300"><History size={32} /></div>
                  <p className="text-slate-400 text-sm font-medium">No invitations found in database.</p>
                </div>
              )}
         {sentHistory.map((item) => (
  <div key={item._id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
    <div className="flex justify-between items-start mb-2">
      <div className="flex-1">
        <h4 className="font-bold text-slate-900 truncate">{item.name || 'Unnamed Employee'}</h4>
        <p className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
          <Mail size={10} /> {item.email}
        </p>
      </div>
      <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter ${
        item.status === 'onboarded' ? 'bg-green-100 text-green-700' :
        item.status === 'revoked' ? 'bg-orange-100 text-orange-700' :
        'bg-blue-100 text-blue-700'
      }`}>
        {item.status}
      </span>
    </div>

    <div className="bg-slate-50 rounded-xl p-2.5 space-y-1 mb-3">
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
        <Building2 size={12} className="text-blue-500" /> 
        {item.company?.name || 'Unknown Company'}
      </div>
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
        <Briefcase size={12} /> {item.role} • <span className="text-blue-600">{item.department}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
        <span>{item.employmentType || 'FT'}</span>
        {item.salary && (
          <span className="text-green-600 ml-2 flex items-center gap-1">
            <Banknote size={10} /> {item.salary}
          </span>
        )}
      </div>
      
      {/* NEW: Display policy status and dates */}
  {/* NEW: Display policy status and dates */}
<div className="flex items-center gap-2 text-[10px] font-bold mt-2 pt-2 border-t border-slate-200">
  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] ${
    item.policyStatus === 'accepted' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'
  }`}>
    {item.policyStatus === 'accepted' ? <CheckCircle size={8} /> : <FileText size={8} />}
    Policy: {item.policyStatus || 'not accepted'}
  </span>
  {item.onboardedAt && (
    <span className="text-slate-500 flex items-center gap-1">
      <CheckCircle size={8} />
      Onboarded: {new Date(item.onboardedAt).toLocaleDateString()}
    </span>
  )}
  {item.policyAcceptedAt && (
    <span className="text-slate-500 flex items-center gap-1">
      <Clock size={8} />
      Policy: {new Date(item.policyAcceptedAt).toLocaleDateString()}
    </span>
  )}
</div>
    </div>

    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
      <span className="text-[9px] font-bold text-slate-400 uppercase">
        Invited: {new Date(item.invitedAt).toLocaleDateString()}
      </span>
      <button
        onClick={() => handleDelete(item._id)}
        className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
        title="Delete Permanently"
      >
        <Trash2 size={14} />
      </button>
    </div>
  </div>
))}
            </div>

            <div className="p-4 bg-white border-t border-slate-100 text-[10px] text-center font-bold text-slate-400 uppercase tracking-widest">
              Total Invitations: {sentHistory.length}
            </div>
          </div>
        </div>

      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default SendOnboardingForm;