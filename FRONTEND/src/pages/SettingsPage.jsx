import React, { useState } from 'react';
import NotificationSettings from './NotificationSettings';
import DepartmentSettings from './DepartmentSettings';
import SoundSettings from './SoundSettings';
import { FaBell, FaBuilding, FaVolumeUp, FaInfoCircle } from 'react-icons/fa';

const TABS = {
  NOTIFICATION: 'Notification',
  DEPARTMENT: 'Department',
  SOUND: 'Sound',
  COMPANY_INFO: 'Company Info',
};

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState(TABS.NOTIFICATION);

  const renderContent = () => {
    switch (activeTab) {
      case TABS.NOTIFICATION:
        return <NotificationSettings />;
      case TABS.DEPARTMENT:
        return <DepartmentSettings />;
      case TABS.SOUND:
        return <SoundSettings />;
      case TABS.COMPANY_INFO:
        return <CompanyInfoSettings />;
      default:
        return <NotificationSettings />;
    }
  };

  const TabButton = ({ name, icon }) => (
    <button
      onClick={() => setActiveTab(name)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
        activeTab === name
          ? 'bg-blue-600 text-white shadow-md'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
    >
      {icon}
      {name}
    </button>
  );

  return (
    <div className="p-4 md:p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Application Settings</h1>
      
      <div className="flex flex-wrap items-center gap-3 p-3 bg-white rounded-xl shadow-sm mb-6">
        <TabButton name={TABS.NOTIFICATION} icon={<FaBell />} />
        <TabButton name={TABS.DEPARTMENT} icon={<FaBuilding />} />
        <TabButton name={TABS.SOUND} icon={<FaVolumeUp />} />
        <TabButton name={TABS.COMPANY_INFO} icon={<FaInfoCircle />} />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg animate-fade-in">
        {renderContent()}
      </div>
    </div>
  );
};

export default SettingsPage;