import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { avatarInitials } from '../../utils/helpers';
import { DB } from '../../firebase/db';
import Sidebar from './Sidebar';

export default function Header() {
  const { userName, userRole, userTeam, userDoc, isSuper } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!isSuper) return;
    DB.getPendingSignups().then(l => setPendingCount(l.length)).catch(() => {});
  }, [isSuper]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const roleLabel = { superAdmin: 'Super Admin', teamAdmin: 'Coordinator', serviceDevotee: 'Facilitator' }[userRole] || userRole;
  const pic = userDoc?.profilePic;

  return (
    <>
      <header className="app-header">
        <div className="header-left">
          <div className="header-logo">
            <span className="header-logo-icon">🌸</span>
            <span className="header-brand">Sakhi Sang</span>
          </div>
          <span className="header-date">{today}</span>
        </div>
        <div className="header-right">
          <div className="header-user-display">
            <div className="avatar-wrap">
              {pic ? <img src={pic} alt={userName} className="avatar-img" /> : <div className="avatar">{avatarInitials(userName)}</div>}
            </div>
            <div className="header-user-info">
              <span className="header-user-name">{userName}</span>
              <span className="header-user-role">{roleLabel}{userTeam ? ` · ${userTeam}` : ''}</span>
            </div>
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)} title="Menu" aria-label="Open menu">
            <span className="hamburger-icon">☰</span>
            {pendingCount > 0 && <span className="sidebar-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>}
          </button>
        </div>
      </header>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
