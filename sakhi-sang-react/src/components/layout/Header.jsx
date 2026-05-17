import React, { useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { avatarInitials } from '../../utils/helpers';
import Modal from '../common/Modal';
import UserManagement from '../admin/UserManagement';
import SignupRequests from '../admin/SignupRequests';
import ClearDataModal from '../admin/ClearDataModal';
import SessionManagement from '../admin/SessionManagement';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { TEAMS } from '../../firebase/config';

export default function Header() {
  const { userName, userRole, userTeam, userPosition, userId, logout, changePassword, isSuper, refreshUserDoc, userDoc } = useAuth();
  const { showToast } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [showSignups, setShowSignups] = useState(false);
  const [showClearData, setShowClearData] = useState(false);
  const [showSessionMgmt, setShowSessionMgmt] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, next: false });

  // Profile edit
  const [profileForm, setProfileForm] = useState({ displayName: '', position: '', teamName: '' });
  const [profilePic, setProfilePic] = useState(null); // base64
  const [picLoading, setPicLoading] = useState(false);
  const fileRef = useRef(null);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const roleLabel = { superAdmin: 'Super Admin', teamAdmin: 'Coordinator', serviceDevotee: 'Facilitator' }[userRole] || userRole;
  const pic = userDoc?.profilePic || null;

  function openProfile() {
    setProfileForm({
      displayName: userDoc?.displayName || userName || '',
      position: userDoc?.position || '',
      teamName: userDoc?.teamName || userTeam || '',
    });
    setProfilePic(pic);
    setShowProfile(true);
    setMenuOpen(false);
  }

  function handlePicSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 50 * 1024) { showToast('Image must be under 50 KB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = ev => setProfilePic(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function saveProfile() {
    setPicLoading(true);
    try {
      const updates = {
        displayName: profileForm.displayName.trim(),
        position: profileForm.position.trim(),
        updatedAt: serverTimestamp(),
      };
      if (isSuper) updates.teamName = profileForm.teamName;
      if (profilePic !== pic) updates.profilePic = profilePic || '';
      await updateDoc(doc(db, 'users', userId), updates);
      await refreshUserDoc();
      showToast('Profile updated', 'success');
      setShowProfile(false);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setPicLoading(false); }
  }

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
      showToast('Password changed', 'success');
    } catch (err) {
      setPwError(err.code === 'auth/wrong-password' ? 'Current password incorrect' : err.message);
    } finally { setPwLoading(false); }
  }

  const initials = avatarInitials(userName);

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
            <div className="avatar-wrap">
              {pic
                ? <img src={pic} alt={userName} className="avatar-img" />
                : <div className="avatar">{initials}</div>}
            </div>
            <div className="header-user-info">
              <span className="header-user-name">{userName}</span>
              <span className="header-user-role">{roleLabel}{userTeam ? ` · ${userTeam}` : ''}{userPosition ? ` · ${userPosition}` : ''}</span>
            </div>
            <span className="header-chevron">▾</span>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="header-menu" onClick={() => setMenuOpen(false)}>
          <div className="header-menu-inner" onClick={e => e.stopPropagation()}>
            <button className="menu-item" onClick={openProfile}>👤 My Profile</button>
            <button className="menu-item" onClick={() => { setShowChangePw(true); setMenuOpen(false); }}>🔑 Change Password</button>
            {isSuper && <button className="menu-item" onClick={() => { setShowUserMgmt(true); setMenuOpen(false); }}>👥 User Management</button>}
            {isSuper && <button className="menu-item" onClick={() => { setShowSignups(true); setMenuOpen(false); }}>📋 Signup Requests</button>}
            {isSuper && <button className="menu-item" onClick={() => { setShowSessionMgmt(true); setMenuOpen(false); }}>📅 Session Management</button>}
            {isSuper && <button className="menu-item" onClick={() => { setShowClearData(true); setMenuOpen(false); }}>🗑 Clear Data</button>}
            <div className="menu-divider" />
            <button className="menu-item menu-item-danger" onClick={logout}>⏻ Sign Out</button>
          </div>
        </div>
      )}

      {/* Profile modal */}
      <Modal open={showProfile} onClose={() => setShowProfile(false)} title="My Profile">
        <div className="profile-edit-wrap">
          <div className="profile-pic-section">
            <div className="profile-pic-preview" onClick={() => fileRef.current?.click()}>
              {profilePic
                ? <img src={profilePic} alt="Profile" className="profile-pic-img" />
                : <div className="profile-pic-initials">{initials}</div>}
              <span className="profile-pic-overlay">📷</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePicSelect} />
            <div className="profile-pic-actions">
              <button className="btn-outline sm" onClick={() => fileRef.current?.click()}>Upload Photo</button>
              {profilePic && <button className="btn-outline sm danger" onClick={() => setProfilePic(null)}>Remove</button>}
              <span className="text-muted" style={{ fontSize: '.72rem' }}>Max 50 KB</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={profileForm.displayName} onChange={e => setProfileForm(p => ({ ...p, displayName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Position / Title</label>
            <input className="form-input" value={profileForm.position} placeholder="e.g. Zone Coordinator" onChange={e => setProfileForm(p => ({ ...p, position: e.target.value }))} />
          </div>
          {isSuper && (
            <div className="form-group">
              <label className="form-label">Team</label>
              <select className="form-select" value={profileForm.teamName} onChange={e => setProfileForm(p => ({ ...p, teamName: e.target.value }))}>
                <option value="">No team</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          {!isSuper && (
            <div className="form-group">
              <label className="form-label">Team</label>
              <input className="form-input" value={userTeam} readOnly />
            </div>
          )}

          <div className="form-actions">
            <button className="btn-outline" onClick={() => setShowProfile(false)}>Cancel</button>
            <button className="btn-primary" onClick={saveProfile} disabled={picLoading}>{picLoading ? 'Saving…' : 'Save Profile'}</button>
          </div>
        </div>
      </Modal>

      {/* Change password */}
      <Modal open={showChangePw} onClose={() => setShowChangePw(false)} title="Change Password">
        <form onSubmit={handleChangePw}>
          {[
            { label: 'Current Password', key: 'current', auto: 'current-password' },
            { label: 'New Password', key: 'next', auto: 'new-password' },
            { label: 'Confirm New Password', key: 'confirm', auto: 'new-password' },
          ].map(f => (
            <div className="form-group" key={f.key}>
              <label className="form-label">{f.label}</label>
              <div className="pw-wrap">
                <input className="form-input" type={showPw[f.key] ? 'text' : 'password'}
                  value={pwForm[f.key]} onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                  required autoComplete={f.auto} />
                <button type="button" className="pw-toggle" onClick={() => setShowPw(s => ({ ...s, [f.key]: !s[f.key] }))}>
                  {showPw[f.key] ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          ))}
          {pwError && <div className="form-error">{pwError}</div>}
          <div className="form-actions">
            <button type="button" className="btn-outline" onClick={() => setShowChangePw(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={pwLoading}>{pwLoading ? 'Saving…' : 'Change Password'}</button>
          </div>
        </form>
      </Modal>

      {isSuper && <UserManagement open={showUserMgmt} onClose={() => setShowUserMgmt(false)} />}
      {isSuper && <SignupRequests open={showSignups} onClose={() => setShowSignups(false)} />}
      {isSuper && <ClearDataModal open={showClearData} onClose={() => setShowClearData(false)} />}
      {isSuper && <SessionManagement open={showSessionMgmt} onClose={() => setShowSessionMgmt(false)} />}
    </>
  );
}
