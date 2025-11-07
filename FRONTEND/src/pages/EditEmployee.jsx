import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axios from "axios";
import { FaUser, FaEnvelope, FaBuilding, FaPhone, FaAddressCard, FaCalendarAlt, FaExclamationTriangle, FaMoneyBill, FaFlag, FaTransgender, FaCreditCard, FaUniversity, FaCodeBranch, FaDownload } from "react-icons/fa";

const EditEmployee = () => {
  const { id } = useParams(); // _id from URL
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [formData, setFormData] = useState(null);
  const [snackbar, setSnackbar] = useState("");

  // ✅ Fetch employee from backend
  useEffect(() => {
    axios.get(`http://localhost:5000/employees/${id}`)
      .then(res => {
        const emp = res.data;

        // get current experience
        const currentExp = emp.experienceDetails?.find(exp => exp.lastWorkingDate === "Present") || {};

        setEmployee(emp);
        setFormData({
          name: emp.name,
          email: emp.email,
          phone: emp.phone,
          address: emp.address,
          emergency: emp.emergency,

          personalDetails: emp.personalDetails || {},
          bankDetails: emp.bankDetails || {},

          experienceDetails: emp.experienceDetails || [],

          currentDepartment: emp.currentDepartment || currentExp.department || "",
          currentRole: emp.currentRole || currentExp.role || "",
          currentSalary: emp.currentSalary || currentExp.salary || "",
          joiningDate: emp.joiningDate || currentExp.joiningDate || "",
          experienceLetterUrl: currentExp.experienceLetterUrl || ""
        });
      })
      .catch(err => console.log(err));
  }, [id]);

  if (!formData) return <div className="p-6 text-lg text-center">Loading Employee...</div>;

  // ✅ Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;

    // nested structures
    if (name.startsWith("bankDetails.")) {
      const key = name.split(".")[1];
      setFormData(prev => ({ ...prev, bankDetails: { ...prev.bankDetails, [key]: value } }));
    }
    else if (name.startsWith("personalDetails.")) {
      const key = name.split(".")[1];
      setFormData(prev => ({ ...prev, personalDetails: { ...prev.personalDetails, [key]: value } }));
    }
    else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // ✅ Submit updated data to backend
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...employee,
      ...formData,
      currentDepartment: formData.currentDepartment,
      currentRole: formData.currentRole,
      currentSalary: formData.currentSalary,
      joiningDate: formData.joiningDate,
      experienceDetails: formData.experienceDetails.map(exp => {
        if (exp.lastWorkingDate === "Present") {
          return {
            ...exp,
            department: formData.currentDepartment,
            role: formData.currentRole,
            salary: formData.currentSalary,
            joiningDate: formData.joiningDate,
            experienceLetterUrl: formData.experienceLetterUrl
          };
        }
        return exp;
      })
    };

    try {
      await axios.put(`http://localhost:5000/employees/${id}`, payload);
      setSnackbar("✅ Employee updated successfully");
      setTimeout(() => navigate(-1), 1500);
    } catch (err) {
      console.log(err);
      setSnackbar("❌ Update failed");
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
        <button onClick={() => navigate(-1)} className="mb-4 px-4 py-2 bg-gray-200 rounded">← Back</button>
        <h2 className="text-2xl font-bold text-center mb-6">Edit Employee</h2>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Name / Email */}
          <InputField icon={<FaUser />} name="name" label="Full Name" value={formData.name} onChange={handleChange} />
          <InputField icon={<FaEnvelope />} name="email" label="Email" value={formData.email} onChange={handleChange} />

          {/* Job Section */}
          <InputField icon={<FaBuilding />} name="currentDepartment" label="Department" value={formData.currentDepartment} onChange={handleChange} />
          <InputField icon={<FaUser />} name="currentRole" label="Role" value={formData.currentRole} onChange={handleChange} />
          <InputField icon={<FaMoneyBill />} name="currentSalary" label="Salary" value={formData.currentSalary} onChange={handleChange} />
          <InputField icon={<FaCalendarAlt />} name="joiningDate" type="date" label="Joining Date" value={formData.joiningDate?.substring(0,10)} onChange={handleChange} />

          {/* Bank section */}
          <InputField icon={<FaCreditCard />} name="bankDetails.accountNumber" label="Account Number" value={formData.bankDetails.accountNumber || ""} onChange={handleChange} />
          
          {/* Submit */}
          <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg w-full font-bold">
            Save Changes
          </button>
        </form>

        {snackbar && <div className="mt-4 bg-green-500 text-white px-4 py-2 rounded">{snackbar}</div>}
      </div>
    </div>
  );
};

// Reusable input
const InputField = ({ icon, label, ...props }) => (
  <div className="relative mb-3">
    <div className="absolute left-3 top-3">{icon}</div>
    <label className="block text-sm text-gray-500 ml-10">{label}</label>
    <input {...props} className="w-full border rounded pl-10 py-2 bg-gray-50" />
  </div>
);

export default EditEmployee;
