import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const TABS = [
  { id: 'dashboard',    label: 'Dashboard',    icon: '⌂',  roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'devotees',     label: 'Devotees',     icon: '👥', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'calling',      label: 'Calling',      icon: '📞', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'attendance',   label: 'Attendance',   icon: '✓',  roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'books',        label: 'Books',        icon: '📚', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'service',      label: 'Service',      icon: '🤲', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'registration', label: 'Registration', icon: '📋', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'donation',     label: 'Donation',     icon: '💰', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'care',         label: 'Care',         icon: '❤',  roles: ['superAdmin','teamAdmin'] },
  { id: 'events',       label: 'Events',       icon: '📅', roles: ['superAdmin','teamAdmin'] },
  { id: 'calling-mgmt', label: 'Calling Mgmt', icon: '📊', roles: ['superAdmin','teamAdmin'] },
];

export default function TabNav() {
  const { activeTab, setActiveTab } = useApp();
  const { userRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const visible = TABS.filter(t => t.roles.includes(userRole));

  useEffect(() => {
    const handler = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav className="tab-nav" ref={menuRef}>
      {/* Desktop: show all tabs scrollable */}
      <div className="tab-scroll-row">
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
      </div>

      {/* Mobile: show current tab + hamburger */}
      <div className="tab-mobile-bar">
        <div className="tab-current">
          {(() => { const t = visible.find(t => t.id === activeTab); return t ? `${t.icon} ${t.label}` : ''; })()}
        </div>
        <button className="tab-hamburger" onClick={() => setMenuOpen(o => !o)}>☰</button>
        {menuOpen && (
          <div className="tab-mobile-menu">
            {visible.map(tab => (
              <button
                key={tab.id}
                className={`tab-mobile-item${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => { setActiveTab(tab.id); setMenuOpen(false); }}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

export function BottomNav() {
  const { activeTab, setActiveTab } = useApp();
  const { userRole } = useAuth();
  // Show only first 5 tabs on bottom nav; rest via hamburger
  const visible = TABS.filter(t => t.roles.includes(userRole)).slice(0, 5);
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
