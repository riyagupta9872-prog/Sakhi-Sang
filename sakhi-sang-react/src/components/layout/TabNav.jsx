import React from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

const TABS = [
  { id: 'home', label: 'Dashboard', icon: '⌂', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'devotees', label: 'Devotees', icon: '👥', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'attendance', label: 'Attendance', icon: '✓', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'calling', label: 'Calling', icon: '📞', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'analytics', label: 'Reports', icon: '📊', roles: ['superAdmin','teamAdmin'] },
  { id: 'activities', label: 'Activities', icon: '📝', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
];

export default function TabNav() {
  const { activeTab, setActiveTab } = useApp();
  const { userRole } = useAuth();

  const visible = TABS.filter(t => t.roles.includes(userRole));

  return (
    <nav className="tab-nav">
      {visible.map(tab => (
        <button
          key={tab.id}
          className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const { activeTab, setActiveTab } = useApp();
  const { userRole } = useAuth();

  const visible = TABS.filter(t => t.roles.includes(userRole));

  return (
    <nav className="bottom-nav">
      {visible.map(tab => (
        <button
          key={tab.id}
          className={`bottom-nav-btn${activeTab === tab.id ? ' active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="bottom-nav-icon">{tab.icon}</span>
          <span className="bottom-nav-label">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
