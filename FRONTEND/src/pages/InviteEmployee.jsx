import React, { useState } from 'react';
import { Send, Link, Mail, Copy, Users, Clock, CheckCircle, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
// Assuming your centralized api is in ../utils/api
import api from '../api'; 

const SendOnboardingForm = () => {
  const [activeTab, setActiveTab] = useState('single');
  const [formData, setFormData] = useState({
    recipientEmail: '',
    recipientName: '',
    recipientList: '',
    emailSubject: 'Complete Your Onboarding Form',
    emailMessage: `Hello!

Please complete your onboarding form using the link below:

[ONBOARDING_LINK]

This form is required for your employment setup.

Best regards,
HR Team`,
    formLink: `https://hrms-420.netlify.app/employee-onboarding`, // Dynamic link to your onboarding page
    expiryDate: '',
    sendReminders: false,
    reminderFrequency: 'weekly',
    allowMultipleSubmissions: false,
    trackResponses: true,
    notifyOnCompletion: true
  });

  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentEmails, setSentEmails] = useState([]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(formData.formLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateEmailContent = () => {
    return formData.emailMessage.replace('[ONBOARDING_LINK]', formData.formLink);
  };

  // --- API CALL: SEND SINGLE ---
  const handleSendSingle = async (e) => {
    e.preventDefault();
    setSending(true);
    
    try {
      await api.post('/api/mail/send-onboarding', {
        recipientEmail: formData.recipientEmail,
        emailSubject: formData.emailSubject,
        emailMessage: formData.emailMessage,
        formLink: formData.formLink
      });

      const newEmail = {
        id: Date.now(),
        email: formData.recipientEmail,
        name: formData.recipientName || 'Employee',
        status: 'sent',
        sentAt: new Date().toLocaleTimeString(),
        link: formData.formLink
      };
      
      setSentEmails(prev => [newEmail, ...prev]);
      alert(`Onboarding link sent to ${formData.recipientEmail}`);
      setFormData(prev => ({ ...prev, recipientEmail: '', recipientName: '' }));
    } catch (error) {
      console.error(error);
      alert("Failed to send email. Check console for details.");
    } finally {
      setSending(false);
    }
  };

  // --- API CALL: SEND BULK ---
  const handleSendBulk = async (e) => {
    e.preventDefault();
    setSending(true);
    
    try {
      const response = await api.post('/api/mail/send-onboarding', {
        recipientList: formData.recipientList,
        emailSubject: formData.emailSubject,
        emailMessage: formData.emailMessage,
        formLink: formData.formLink
      });

      const emails = formData.recipientList.split(/[\n,;]/).filter(e => e.includes('@'));
      const newEntries = emails.map(email => ({
        id: Math.random(),
        email: email.trim(),
        name: email.split('@')[0],
        status: 'sent',
        sentAt: new Date().toLocaleTimeString()
      }));

      setSentEmails(prev => [...newEntries, ...prev]);
      alert(response.data.message);
      setFormData(prev => ({ ...prev, recipientList: '' }));
    } catch (error) {
      alert("Bulk send failed.");
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (emailObj) => {
    try {
      await api.post('/api/mail/send-onboarding', {
        recipientEmail: emailObj.email,
        emailSubject: formData.emailSubject,
        emailMessage: formData.emailMessage,
        formLink: formData.formLink
      });
      alert(`Resent to ${emailObj.email}`);
    } catch (error) {
      alert("Resend failed.");
    }
  };

  const handleRevoke = (emailId) => {
    setSentEmails(prev => prev.map(e => e.id === emailId ? { ...e, status: 'revoked' } : e));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Send Onboarding Form</h1>
          <p className="text-gray-600">Share your onboarding form link via email with new hires.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            
            {/* LINK CARD */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <Link className="w-5 h-5 text-blue-600 mr-2" />
                  <h2 className="text-lg font-semibold">Onboarding Form Link</h2>
                </div>
                <button onClick={copyToClipboard} className={`flex items-center px-3 py-1.5 text-sm rounded-lg transition ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>
                  {copied ? <CheckCircle className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
              <input 
                type="text" 
                value={formData.formLink} 
                onChange={(e) => setFormData(prev => ({...prev, formLink: e.target.value}))}
                className="w-full px-4 py-2 border rounded-lg bg-gray-50 mb-4" 
              />
            </div>

            {/* RECIPIENTS CARD */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex border-b mb-6">
                <button onClick={() => setActiveTab('single')} className={`px-4 py-2 ${activeTab === 'single' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Single</button>
                <button onClick={() => setActiveTab('multiple')} className={`px-4 py-2 ${activeTab === 'multiple' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}>Multiple</button>
              </div>

              {activeTab === 'single' ? (
                <form onSubmit={handleSendSingle} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" name="recipientName" placeholder="Name" value={formData.recipientName} onChange={handleChange} className="p-2 border rounded" />
                    <input type="email" name="recipientEmail" placeholder="Email Address" value={formData.recipientEmail} onChange={handleChange} className="p-2 border rounded" required />
                  </div>
                  <button type="submit" disabled={sending} className="bg-blue-600 text-white px-6 py-2 rounded flex items-center disabled:bg-blue-300">
                    {sending ? <RefreshCw className="animate-spin mr-2" /> : <Send className="mr-2" />} Send Link
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSendBulk} className="space-y-4">
                  <textarea name="recipientList" rows="5" placeholder="Enter emails separated by commas..." value={formData.recipientList} onChange={handleChange} className="w-full p-2 border rounded" required />
                  <button type="submit" disabled={sending} className="bg-blue-600 text-white px-6 py-2 rounded disabled:bg-blue-300">
                    {sending ? "Sending..." : "Send to All Recipients"}
                  </button>
                </form>
              )}
            </div>

            {/* TEMPLATE CARD */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
               <h2 className="text-lg font-semibold mb-4">Email Template</h2>
               <label className="block text-sm mb-1">Subject</label>
               <input type="text" name="emailSubject" value={formData.emailSubject} onChange={handleChange} className="w-full p-2 border rounded mb-4" />
               <label className="block text-sm mb-1">Message</label>
               <textarea name="emailMessage" rows="6" value={formData.emailMessage} onChange={handleChange} className="w-full p-2 border rounded" />
               <div className="mt-4 p-4 bg-gray-50 rounded border">
                 <p className="text-xs font-bold text-gray-400 mb-2 uppercase">Live Preview</p>
                 <div className="whitespace-pre-wrap text-sm text-gray-700">{generateEmailContent()}</div>
               </div>
            </div>
          </div>

          {/* RIGHT COLUMN: SENT LOG */}
          <div className="space-y-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="font-semibold mb-4">Sent History ({sentEmails.length})</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sentEmails.length === 0 && <p className="text-gray-400 text-sm italic">No history yet.</p>}
                {sentEmails.map(email => (
                  <div key={email.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold">{email.name}</p>
                        <p className="text-gray-500 text-xs">{email.email}</p>
                      </div>
                      <span className={`text-[10px] uppercase font-bold px-1 rounded ${email.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {email.status}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => handleResend(email)} className="text-blue-600 flex items-center"><RefreshCw size={12} className="mr-1"/> Resend</button>
                      <button onClick={() => handleRevoke(email.id)} className="text-red-500 flex items-center"><Trash2 size={12} className="mr-1"/> Revoke</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default SendOnboardingForm;