import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { avatarInitials, toLocalDateStr, formatDate } from '../../utils/helpers';
import Modal from '../common/Modal';
import UserManagement from '../admin/UserManagement';
import SignupRequests from '../admin/SignupRequests';

export default function Header() {
  const { userName, userRole, userTeam, userPosition, logout, changePassword, isSuper } = useAuth();
  const { showToast } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [showSignups, setShowSignups] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  async function handleChangePw(e) {
    e.preventDefault();
    setPwError('');
    if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match'); return; }
    if (pwForm.next.length < 6) { setPwError('Minimum 6 characters'); return; }
    setPwLoading(true);
    try {
      await changePassword(pwForm.current, pwForm.next);
      setShowChangePw(false);
      setPwForm({ current: '', next: '', confirm: '' });
      showToast('Password changed successfully', 'success');
    } catch (err) {
      setPwError(err.code === 'auth/wrong-password' ? 'Current password is incorrect' : err.message);
    } finally {
      setPwLoading(false);
    }
  }

  const roleLabel = { superAdmin: 'Super Admin', teamAdmin: 'Coordinator', serviceDevotee: 'Service Devotee' }[userRole] || userRole;

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
          <div className="header-user" onClick={() => setMenuOpen(m => !m)}>
            <div className="avatar">{avatarInitials(userName)}</div>
            <div className="header-user-info">
              <span className="header-user-name">{userName}</span>
              <span className="header-user-role">{roleLabel}{userTeam ? ` · ${userTeam}` : ''}</span>
            </div>
            <span className="header-chevron">▾</span>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="header-menu" onClick={() => setMenuOpen(false)}>
          <div className="header-menu-inner" onClick={e => e.stopPropagation()}>
            <button className="menu-item" onClick={() => { setShowProfile(true); setMenuOpen(false); }}>👤 My Profile</button>
            <button className="menu-item" onClick={() => { setShowChangePw(true); setMenuOpen(false); }}>🔑 Change Password</button>
            {isSuper && <button className="menu-item" onClick={() => { setShowUserMgmt(true); setMenuOpen(false); }}>👥 User Management</button>}
            {isSuper && <button className="menu-item" onClick={() => { setShowSignups(true); setMenuOpen(false); }}>📋 Signup Requests</button>}
            <div className="menu-divider" />
            <button className="menu-item menu-item-danger" onClick={logout}>⏻ Sign Out</button>
          </div>
        </div>
      )}

      <Modal open={showProfile} onClose={() => setShowProfile(false)} title="My Profile">
        <div className="profile-view">
          <div className="profile-avatar-large">{avatarInitials(userName)}</div>
          <div className="profile-name">{userName}</div>
          <div className="profile-meta">
            <span className="badge badge-role">{roleLabel}</span>
            {userTeam && <span className="badge badge-team">{userTeam}</span>}
          </div>
          {userPosition && <p className="profile-position">{userPosition}</p>}
        </div>
      </Modal>

      <Modal open={showChangePw} onClose={() => setShowChangePw(false)} title="Change Password">
        <form onSubmit={handleChangePw}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input className="form-input" type="password" value={pwForm.current} onChange={e => setPwForm(p => ({ ...p, current: e.target.value }))} required />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input className="form-input" type="password" value={pwForm.next} onChange={e => setPwForm(p => ({ ...p, next: e.target.value }))} required minLength={6} />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input className="form-input" type="password" value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} required />
          </div>
          {pwError && <div className="form-error">{pwError}</div>}
          <div className="form-actions">
            <button type="button" className="btn-outline" onClick={() => setShowChangePw(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={pwLoading}>{pwLoading ? 'Saving…' : 'Change Password'}</button>
          </div>
        </form>
      </Modal>

      {isSuper && <UserManagement open={showUserMgmt} onClose={() => setShowUserMgmt(false)} />}
      {isSuper && <SignupRequests open={showSignups} onClose={() => setShowSignups(false)} />}
    </>
  );
}
