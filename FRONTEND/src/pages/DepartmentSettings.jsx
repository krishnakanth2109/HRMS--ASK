import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { 
  FaClock, 
  FaUserTie, 
  FaSave, 
  FaSearch, 
  FaEdit,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
  FaUsers
} from 'react-icons/fa';
import { getEmployees, getAllShifts, createOrUpdateShift, deleteShift, bulkCreateShifts } from '../api';

const DepartmentSettings = () => {
  const { user } = useContext(AuthContext);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [viewMode, setViewMode] = useState('individual');

  const [shiftForm, setShiftForm] = useState({
    shiftStartTime: '09:00',
    shiftEndTime: '18:00',
    lateGracePeriod: 15,
    fullDayHours: 8,
    halfDayHours: 4,
    autoExtendShift: true,
    weeklyOffDays: [0]
  });

  const [bulkShiftForm, setBulkShiftForm] = useState({
    shiftStartTime: '09:00',
    shiftEndTime: '18:00',
    lateGracePeriod: 15,
    fullDayHours: 8,
    halfDayHours: 4,
    autoExtendShift: true,
    weeklyOffDays: [0]
  });
  
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeesData, shiftsData] = await Promise.all([
        getEmployees(),
        getAllShifts()
      ]);
      
      setEmployees(employeesData?.data || employeesData || []);
      setShifts(shiftsData || []);
    } catch (error) {
      console.error('Fetch error:', error);
      showMessage('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleEmployeeSelect = async (employee) => {
    setSelectedEmployee(employee);
    
    const existingShift = shifts.find(s => s.employeeId === employee.employeeId);
    
    if (existingShift) {
      setShiftForm({
        shiftStartTime: existingShift.shiftStartTime || '09:00',
        shiftEndTime: existingShift.shiftEndTime || '18:00',
        lateGracePeriod: existingShift.lateGracePeriod ?? 15,
        fullDayHours: existingShift.fullDayHours || 8,
        halfDayHours: existingShift.halfDayHours || 4,
        autoExtendShift: existingShift.autoExtendShift ?? true,
        weeklyOffDays: existingShift.weeklyOffDays || [0]
      });
    } else {
      setShiftForm({
        shiftStartTime: '09:00',
        shiftEndTime: '18:00',
        lateGracePeriod: 15,
        fullDayHours: 8,
        halfDayHours: 4,
        autoExtendShift: true,
        weeklyOffDays: [0]
      });
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setShiftForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleBulkFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBulkShiftForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleWeeklyOffToggle = (day) => {
    setShiftForm(prev => {
      const current = prev.weeklyOffDays || [];
      if (current.includes(day)) {
        return { ...prev, weeklyOffDays: current.filter(d => d !== day) };
      } else {
        return { ...prev, weeklyOffDays: [...current, day] };
      }
    });
  };

  const handleBulkWeeklyOffToggle = (day) => {
    setBulkShiftForm(prev => {
      const current = prev.weeklyOffDays || [];
      if (current.includes(day)) {
        return { ...prev, weeklyOffDays: current.filter(d => d !== day) };
      } else {
        return { ...prev, weeklyOffDays: [...current, day] };
      }
    });
  };

  const handleBulkEmployeeToggle = (employeeId) => {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleSelectAllEmployees = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map(emp => emp.employeeId));
    }
  };

  const handleSaveShift = async (e) => {
    e.preventDefault();
    
    if (!selectedEmployee) {
      showMessage('error', 'Please select an employee first');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employeeId: selectedEmployee.employeeId,
        shiftStartTime: shiftForm.shiftStartTime,
        shiftEndTime: shiftForm.shiftEndTime,
        lateGracePeriod: Number(shiftForm.lateGracePeriod),
        fullDayHours: Number(shiftForm.fullDayHours),
        halfDayHours: Number(shiftForm.halfDayHours),
        autoExtendShift: shiftForm.autoExtendShift,
        weeklyOffDays: shiftForm.weeklyOffDays
      };

      await createOrUpdateShift(payload);
      showMessage('success', 'Shift configuration saved successfully');
      await fetchData();
      
    } catch (error) {
      console.error('Save shift error:', error);
      showMessage('error', error.response?.data?.message || 'Failed to save shift');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSaveShift = async (e) => {
    e.preventDefault();
    
    if (selectedEmployeeIds.length === 0) {
      showMessage('error', 'Please select at least one employee');
      return;
    }

    setSaving(true);
    try {
      const shiftData = {
        shiftStartTime: bulkShiftForm.shiftStartTime,
        shiftEndTime: bulkShiftForm.shiftEndTime,
        lateGracePeriod: Number(bulkShiftForm.lateGracePeriod),
        fullDayHours: Number(bulkShiftForm.fullDayHours),
        halfDayHours: Number(bulkShiftForm.halfDayHours),
        autoExtendShift: bulkShiftForm.autoExtendShift,
        weeklyOffDays: bulkShiftForm.weeklyOffDays
      };

      await bulkCreateShifts(selectedEmployeeIds, shiftData);
      showMessage('success', `Successfully updated ${selectedEmployeeIds.length} employees`);
      
      setSelectedEmployeeIds([]);
      await fetchData();
      
    } catch (error) {
      console.error('Bulk save error:', error);
      showMessage('error', error.response?.data?.message || 'Failed to save shifts');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (employeeId) => {
    if (!window.confirm('Are you sure you want to reset this shift to default?')) {
      return;
    }

    try {
      await deleteShift(employeeId);
      showMessage('success', 'Shift reset to default successfully');
      await fetchData();
      
      if (selectedEmployee?.employeeId === employeeId) {
        setSelectedEmployee(null);
      }
    } catch (error) {
      console.error('Delete shift error:', error);
      showMessage('error', 'Failed to delete shift');
    }
  };

  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const weekDays = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FaClock className="text-blue-600" />
          Shift Management
        </h1>
        <p className="text-gray-600 mt-2">Configure employee shift timings and work hours</p>
      </div>

      {message.text && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        } flex items-center gap-2 animate-fade-in`}>
          {message.type === 'success' ? <FaCheckCircle /> : <FaTimesCircle />}
          {message.text}
        </div>
      )}

      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setViewMode('individual')}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            viewMode === 'individual'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <FaUserTie className="inline mr-2" />
          Individual Employee
        </button>
        <button
          onClick={() => setViewMode('bulk')}
          className={`px-6 py-2 rounded-lg font-semibold transition-all ${
            viewMode === 'bulk'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <FaUsers className="inline mr-2" />
          Bulk Assignment
        </button>
      </div>

      {viewMode === 'individual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-4">
            <div className="mb-4">
              <div className="relative">
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredEmployees.map(emp => {
                const hasShift = shifts.some(s => s.employeeId === emp.employeeId);
                return (
                  <div
                    key={emp.employeeId}
                    onClick={() => handleEmployeeSelect(emp)}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedEmployee?.employeeId === emp.employeeId
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-800">{emp.name}</p>
                        <p className="text-sm text-gray-600">{emp.employeeId}</p>
                        <p className="text-xs text-gray-500">{emp.email}</p>
                      </div>
                      {hasShift && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                          ✓ Custom
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
            {selectedEmployee ? (
              <form onSubmit={handleSaveShift}>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaEdit className="text-blue-600" />
                    Configure Shift for {selectedEmployee.name}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">ID: {selectedEmployee.employeeId}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Shift Start Time
                    </label>
                    <input
                      type="time"
                      name="shiftStartTime"
                      value={shiftForm.shiftStartTime}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Shift End Time
                    </label>
                    <input
                      type="time"
                      name="shiftEndTime"
                      value={shiftForm.shiftEndTime}
                      onChange={handleFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Late Grace Period (minutes)
                    </label>
                    <input
                      type="number"
                      name="lateGracePeriod"
                      value={shiftForm.lateGracePeriod}
                      onChange={handleFormChange}
                      min="0"
                      max="60"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Employee can punch in this many minutes late without penalty</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Day Hours
                    </label>
                    <input
                      type="number"
                      name="fullDayHours"
                      value={shiftForm.fullDayHours}
                      onChange={handleFormChange}
                      min="1"
                      max="24"
                      step="0.5"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Half Day Hours
                    </label>
                    <input
                      type="number"
                      name="halfDayHours"
                      value={shiftForm.halfDayHours}
                      onChange={handleFormChange}
                      min="1"
                      max="12"
                      step="0.5"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="autoExtendShift"
                      checked={shiftForm.autoExtendShift}
                      onChange={handleFormChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-sm font-semibold text-gray-700">
                      Auto-extend shift when late
                    </label>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Weekly Off Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleWeeklyOffToggle(day.value)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                          (shiftForm.weeklyOffDays || []).includes(day.value)
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex gap-4">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaSave />
                        Save Shift Configuration
                      </>
                    )}
                  </button>
                  
                  {shifts.some(s => s.employeeId === selectedEmployee.employeeId) && (
                    <button
                      type="button"
                      onClick={() => handleDeleteShift(selectedEmployee.employeeId)}
                      className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all flex items-center gap-2"
                    >
                      <FaTrash />
                      Reset to Default
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-gray-500">
                <FaUserTie className="text-6xl mb-4" />
                <p className="text-lg">Select an employee to configure their shift</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewMode === 'bulk' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white rounded-lg shadow-lg p-4">
            <div className="mb-4 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Select Employees</h3>
              <button
                onClick={handleSelectAllEmployees}
                className="text-sm text-blue-600 hover:text-blue-700 font-semibold"
              >
                {selectedEmployeeIds.length === filteredEmployees.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="mb-4">
              <div className="relative">
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-2">
              Selected: {selectedEmployeeIds.length} / {filteredEmployees.length}
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredEmployees.map(emp => (
                <div
                  key={emp.employeeId}
                  onClick={() => handleBulkEmployeeToggle(emp.employeeId)}
                  className={`p-3 rounded-lg cursor-pointer transition-all ${
                    selectedEmployeeIds.includes(emp.employeeId)
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.includes(emp.employeeId)}
                      onChange={() => {}}
                      className="w-5 h-5 text-blue-600 rounded"
                    />
                    <div>
                      <p className="font-semibold text-gray-800">{emp.name}</p>
                      <p className="text-sm text-gray-600">{emp.employeeId}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
            <form onSubmit={handleBulkSaveShift}>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <FaUsers className="text-blue-600" />
                  Bulk Shift Configuration
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Apply the same shift to {selectedEmployeeIds.length} selected employee{selectedEmployeeIds.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Shift Start Time
                  </label>
                  <input
                    type="time"
                    name="shiftStartTime"
                    value={bulkShiftForm.shiftStartTime}
                    onChange={handleBulkFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Shift End Time
                  </label>
                  <input
                    type="time"
                    name="shiftEndTime"
                    value={bulkShiftForm.shiftEndTime}
                    onChange={handleBulkFormChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Late Grace Period (minutes)
                  </label>
                  <input
                    type="number"
                    name="lateGracePeriod"
                    value={bulkShiftForm.lateGracePeriod}
                    onChange={handleBulkFormChange}
                    min="0"
                    max="60"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Day Hours
                  </label>
                  <input
                    type="number"
                    name="fullDayHours"
                    value={bulkShiftForm.fullDayHours}
                    onChange={handleBulkFormChange}
                    min="1"
                    max="24"
                    step="0.5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Half Day Hours
                  </label>
                  <input
                    type="number"
                    name="halfDayHours"
                    value={bulkShiftForm.halfDayHours}
                    onChange={handleBulkFormChange}
                    min="1"
                    max="12"
                    step="0.5"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="autoExtendShift"
                    checked={bulkShiftForm.autoExtendShift}
                    onChange={handleBulkFormChange}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="ml-3 text-sm font-semibold text-gray-700">
                    Auto-extend shift when late
                  </label>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Weekly Off Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {weekDays.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => handleBulkWeeklyOffToggle(day.value)}
                      className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                        (bulkShiftForm.weeklyOffDays || []).includes(day.value)
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-8">
                <button
                  type="submit"
                  disabled={saving || selectedEmployeeIds.length === 0}
                  className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <FaSave />
                      Apply to {selectedEmployeeIds.length} Employee{selectedEmployeeIds.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DepartmentSettings;