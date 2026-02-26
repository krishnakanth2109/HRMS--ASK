import { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { updateUserProfile } from "../api";
import { FaUserCircle, FaPhone, FaEnvelope, FaBuilding, FaUserTag, FaGlobe } from "react-icons/fa";

// Clean, essential fields only
const FIELDS = [
  { name: "name", label: "Full Name", icon: <FaUserCircle />, editable: true },
  { name: "email", label: "Email Address", icon: <FaEnvelope />, editable: true },
  { name: "phone", label: "Phone Number", icon: <FaPhone />, editable: true },
  { name: "designation", label: "Designation", icon: <FaUserTag />, editable: true },
  { name: "department", label: "Department", icon: <FaBuilding />, editable: true },
  { name: "companyName", label: "Company Name", icon: <FaGlobe />, editable: true },
];

const AdminProfile = () => {
  const { user, updateUser } = useContext(AuthContext);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    if (user) setFormData({ ...user });
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Basic validation for name and phone
    if (name === "name" && !/^[A-Za-z\s]*$/.test(value)) return;
    if (name === "phone" && !/^\d*$/.test(value)) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const { data } = await updateUserProfile(formData);
      updateUser(data.user);
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (error) {
      alert("Failed to update profile.");
    }
  };

  if (!user) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto my-10 bg-white shadow-xl rounded-2xl overflow-hidden border">
      {/* Header */}
      <div className="bg-blue-600 p-6 text-white text-center">
        <FaUserCircle className="text-7xl mx-auto mb-2" />
        <h2 className="text-2xl font-bold">{user.name}</h2>
        <p className="text-blue-100">{user.email}</p>
      </div>

      {/* Fields Grid - No Tabs */}
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {FIELDS.map((field) => (
            <div key={field.name} className="flex flex-col">
              <label className="text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-2">
                {field.icon} {field.label}
              </label>
              
              {isEditing ? (
                <input
                  name={field.name}
                  value={formData[field.name] || ""}
                  onChange={handleChange}
                  className="w-full border-2 border-gray-100 rounded-lg px-3 py-2 focus:border-blue-500 outline-none transition-all"
                />
              ) : (
                <div className="text-gray-800 font-medium py-2 px-1 border-b border-gray-50">
                  {user[field.name] || "—"}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="mt-10 flex gap-4">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
            >
              Edit Profile
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { setIsEditing(false); setFormData(user); }}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;