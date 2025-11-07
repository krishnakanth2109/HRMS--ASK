import React, { useContext, useState } from 'react';
import { SettingsContext } from '../context/SettingsContext';

const DepartmentSettings = () => {
    const { settings } = useContext(SettingsContext);
    const [selectedRuleId, setSelectedRuleId] = useState(settings.departmentRules[0]?.id || null);

    const selectedRule = settings.departmentRules.find(r => r.id === selectedRuleId);

    if (!selectedRule) return <p>No department rules found.</p>;

    return (
        <div>
            <h2 className="text-xl font-bold text-gray-800 mb-4">Department Policy Rules</h2>
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Select Rule to Edit</label>
                <select 
                    value={selectedRuleId} 
                    onChange={(e) => setSelectedRuleId(Number(e.target.value))}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                    {settings.departmentRules.map(rule => (
                        <option key={rule.id} value={rule.id}>{rule.ruleName}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Displaying a few key fields for demonstration */}
                <div><label>Office Start Time:</label><input type="text" value={selectedRule.officeStart} readOnly className="mt-1 p-2 w-full border rounded-md bg-gray-100" /></div>
                <div><label>Office End Time:</label><input type="text" value={selectedRule.officeEnd} readOnly className="mt-1 p-2 w-full border rounded-md bg-gray-100" /></div>
                <div><label>Late Login Threshold:</label><input type="text" value={selectedRule.lateLoginThreshold} readOnly className="mt-1 p-2 w-full border rounded-md bg-gray-100" /></div>
                <div><label>Full Day Hours:</label><input type="text" value={selectedRule.fullDayHours} readOnly className="mt-1 p-2 w-full border rounded-md bg-gray-100" /></div>
            </div>
             <button className="mt-6 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">Save Changes</button>
        </div>
    );
};

export default DepartmentSettings;