import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { avatarInitials } from '../../utils/helpers';
import { DB } from '../../firebase/db';
import Modal from '../common/Modal';
import UserManagement from '../admin/UserManagement';
import SignupRequests from '../admin/SignupRequests';
import ClearDataModal from '../admin/ClearDataModal';
import SessionManagement from '../admin/SessionManagement';
import { TEAMS } from '../../firebase/config';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';

export default function Sidebar({ open, onClose }) {
  const { userName, userRole, userTeam, userPosition, userDoc, userId, logout, changePassword, isSuper, refreshUserDoc } = useAuth();
  const { showToast } = useApp();

  const [groups, setGroups] = useState({ management: true, reports: false });
  const [pendingCount, setPendingCount] = useState(0);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [showSignups, setShowSignups] = useState(false);
  const [showClearData, setShowClearData] = useState(false);
  const [showSessionMgmt, setShowSessionMgmt] = useState(false);
  const [showSessionConfig, setShowSessionConfig] = useState(false);
  const [showTargets, setShowTargets] = useState(false);
  const [showTeamRename, setShowTeamRename] = useState(false);

  useEffect(() => {
    if (!isSuper) return;
    DB.getPendingSignups().then(list => setPendingCount(list.length)).catch(() => {});
  }, [open, isSuper]);

  function tg(g) { setGroups(prev => ({ ...prev, [g]: !prev[g] })); }
  function close() { onClose(); }

  const roleLabel = { superAdmin: 'Super Admin', teamAdmin: 'Coordinator', serviceDevotee: 'Facilitator' }[userRole] || userRole;
  const pic = userDoc?.profilePic;

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={close} />}
      <aside className={`app-sidebar${open ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              {pic ? <img src={pic} alt={userName} /> : <span>{avatarInitials(userName)}</span>}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-role">{roleLabel}{userTeam ? ` · ${userTeam}` : ''}</div>
            </div>
          </div>
          <button className="btn-icon" onClick={close} title="Close">✕</button>
        </div>

        <nav className="sidebar-nav">
          {isSuper && (
            <>
              <div className="sidebar-group">
                <button className="sidebar-group-header" onClick={() => tg('management')}>
                  <span className="sg-icon">⚙</span>
                  <span>Management</span>
                  <span className={`sg-chevron${groups.management ? ' open' : ''}`}>▾</span>
                </button>
                {groups.management && (
                  <div className="sidebar-group-body">
                    <button className="sidebar-item sub" onClick={() => { setShowSessionConfig(true); close(); }}>
                      <span>📅</span><span>Session Configuration</span>
                    </button>
                    <button className="sidebar-item sub" onClick={() => { setShowSessionMgmt(true); close(); }}>
                      <span>🗂</span><span>Session Management</span>
                    </button>
                    <button className="sidebar-item sub" onClick={() => { setShowUserMgmt(true); close(); }}>
                      <span>👥</span><span>User Management</span>
                    </button>
                    <button className="sidebar-item sub" onClick={() => { setShowSignups(true); close(); }}>
                      <span>📋</span><span>Sign-up Requests</span>
                      {pendingCount > 0 && <span className="sidebar-item-badge">{pendingCount > 9 ? '9+' : pendingCount}</span>}
                    </button>
                    <button className="sidebar-item sub" onClick={() => { setShowTargets(true); close(); }}>
                      <span>🎯</span><span>Target Management</span>
                    </button>
                    <button className="sidebar-item sub danger" onClick={() => { setShowClearData(true); close(); }}>
                      <span>🗑</span><span>Clear Data</span>
                    </button>
                  </div>
                )}
              </div>

              <button className="sidebar-item" onClick={() => { setShowTeamRename(true); close(); }}>
                <span>🔄</span><span>Rename Team</span>
              </button>

              <div className="sidebar-divider" />
            </>
          )}

          <button className="sidebar-item" onClick={() => { setShowProfile(true); close(); }}>
            <span>✏</span><span>Edit Profile</span>
          </button>
          <button className="sidebar-item" onClick={() => { setShowChangePw(true); close(); }}>
            <span>🔑</span><span>Change Password</span>
          </button>

          <div className="sidebar-divider" />

          <button className="sidebar-item danger" onClick={() => { close(); logout(); }}>
            <span>⏻</span><span>Logout</span>
          </button>
        </nav>
      </aside>

      <ProfileModal open={showProfile} onClose={() => setShowProfile(false)} />
      <ChangePasswordModal open={showChangePw} onClose={() => setShowChangePw(false)} />
      {isSuper && <UserManagement open={showUserMgmt} onClose={() => setShowUserMgmt(false)} />}
      {isSuper && <SignupRequests open={showSignups} onClose={() => setShowSignups(false)} />}
      {isSuper && <ClearDataModal open={showClearData} onClose={() => setShowClearData(false)} />}
      {isSuper && <SessionManagement open={showSessionMgmt} onClose={() => setShowSessionMgmt(false)} />}
      {isSuper && <SessionConfigModal open={showSessionConfig} onClose={() => setShowSessionConfig(false)} />}
      {isSuper && <TargetMgmtModal open={showTargets} onClose={() => setShowTargets(false)} />}
      {isSuper && <TeamRenameModal open={showTeamRename} onClose={() => setShowTeamRename(false)} />}
    </>
  );
}

// ── Profile modal (sub) ─────────────────────────────────────────────────────
function ProfileModal({ open, onClose }) {
  const { userName, userDoc, userId, userTeam, isSuper, refreshUserDoc } = useAuth();
  const { showToast } = useApp();
  const [form, setForm] = useState({ displayName: '', position: '', teamName: '' });
  const [pic, setPic] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = React.useRef(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      displayName: userDoc?.displayName || userName || '',
      position: userDoc?.position || '',
      teamName: userDoc?.teamName || userTeam || '',
    });
    setPic(userDoc?.profilePic || null);
  }, [open, userDoc, userName, userTeam]);

  function handlePicSelect(e) {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 50 * 1024) { showToast('Image must be under 50 KB', 'error'); return; }
    const r = new FileReader();
    r.onload = ev => setPic(ev.target.result);
    r.readAsDataURL(f);
  }

  async function save() {
    setLoading(true);
    try {
      const updates = {
        displayName: form.displayName.trim(),
        position: form.position.trim(),
        updatedAt: serverTimestamp(),
      };
      if (isSuper) updates.teamName = form.teamName;
      updates.profilePic = pic || '';
      await updateDoc(doc(db, 'users', userId), updates);
      await refreshUserDoc();
      showToast('Profile updated', 'success');
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  const initials = avatarInitials(userName);
  return (
    <Modal open={open} onClose={onClose} title="Edit Profile">
      <div className="profile-pic-section">
        <div className="profile-pic-preview" onClick={() => fileRef.current?.click()}>
          {pic ? <img src={pic} alt="" className="profile-pic-img" /> : <div className="profile-pic-initials">{initials}</div>}
          <span className="profile-pic-overlay">📷</span>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePicSelect} />
        <div className="profile-pic-actions">
          <button className="btn-outline sm" onClick={() => fileRef.current?.click()}>Upload Photo</button>
          {pic && <button className="btn-outline sm" onClick={() => setPic(null)}>Remove</button>}
          <span className="text-muted" style={{fontSize:'.72rem'}}>Max 50 KB</span>
        </div>
      </div>
      <div className="form-group"><label className="form-label">Name</label>
        <input className="form-input" value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} /></div>
      <div className="form-group"><label className="form-label">Position / Title</label>
        <input className="form-input" value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="e.g. Zone Coordinator" /></div>
      <div className="form-group">
        <label className="form-label">Team</label>
        {isSuper
          ? <select className="form-select" value={form.teamName} onChange={e => setForm(p => ({ ...p, teamName: e.target.value }))}>
              <option value="">No team</option>{TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          : <input className="form-input" value={userTeam} readOnly />}
      </div>
      <div className="form-actions">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

// ── Change Password modal (sub) ─────────────────────────────────────────────
function ChangePasswordModal({ open, onClose }) {
  const { changePassword } = useAuth();
  const { showToast } = useApp();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({});
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setErr('');
    if (form.next !== form.confirm) { setErr('Passwords do not match'); return; }
    if (form.next.length < 6) { setErr('Minimum 6 characters'); return; }
    setLoading(true);
    try {
      await changePassword(form.current, form.next);
      showToast('Password changed', 'success');
      setForm({ current: '', next: '', confirm: '' });
      onClose();
    } catch (e) { setErr(e.code === 'auth/wrong-password' ? 'Current password incorrect' : e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Change Password">
      <form onSubmit={submit}>
        {[
          { label: 'Current Password', key: 'current' },
          { label: 'New Password', key: 'next' },
          { label: 'Confirm New Password', key: 'confirm' },
        ].map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label}</label>
            <div className="pw-wrap">
              <input className="form-input" type={show[f.key] ? 'text' : 'password'} value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} required />
              <button type="button" className="pw-toggle" onClick={() => setShow(s => ({ ...s, [f.key]: !s[f.key] }))}>{show[f.key] ? '🙈' : '👁'}</button>
            </div>
          </div>
        ))}
        {err && <div className="form-error">{err}</div>}
        <div className="form-actions">
          <button type="button" className="btn-outline" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Change Password'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Session Configuration modal ─────────────────────────────────────────────
function SessionConfigModal({ open, onClose }) {
  const { showToast } = useApp();
  const [form, setForm] = useState({ callingDate: '', sessionDate: '', topic: '', speakerName: '', sessionType: 'regular' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    DB.getCallingWeekConfig().then(cfg => {
      if (cfg) setForm({
        callingDate: cfg.callingDate || cfg.calling_date || '',
        sessionDate: cfg.sessionDate || cfg.session_date || '',
        topic: cfg.topic || '',
        speakerName: cfg.speakerName || cfg.speaker_name || '',
        sessionType: cfg.sessionType || cfg.session_type || 'regular',
      });
    });
  }, [open]);

  async function save() {
    setLoading(true);
    await DB.setCallingWeekConfig(form.callingDate, form.sessionDate, { topic: form.topic, speakerName: form.speakerName, sessionType: form.sessionType });
    if (form.sessionDate) await DB.getOrCreateSession(form.sessionDate);
    showToast('Session configured', 'success');
    setLoading(false);
    onClose();
  }

  function setF(k, v) { setForm(p => ({ ...p, [k]: v })); }
  return (
    <Modal open={open} onClose={onClose} title="Session Configuration">
      <div className="form-grid">
        <div className="form-group"><label className="form-label">Calling Date (Saturday)</label><input className="form-input" type="date" value={form.callingDate} onChange={e => setF('callingDate', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Session Date (Sunday)</label><input className="form-input" type="date" value={form.sessionDate} onChange={e => setF('sessionDate', e.target.value)} /></div>
        <div className="form-group full"><label className="form-label">Topic</label><input className="form-input" value={form.topic} onChange={e => setF('topic', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Speaker</label><input className="form-input" value={form.speakerName} onChange={e => setF('speakerName', e.target.value)} /></div>
        <div className="form-group">
          <label className="form-label">Type</label>
          <select className="form-select" value={form.sessionType} onChange={e => setF('sessionType', e.target.value)}>
            <option value="regular">Regular</option><option value="festival">Festival</option><option value="special">Special</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

// ── Target Management modal ─────────────────────────────────────────────────
function TargetMgmtModal({ open, onClose }) {
  const { showToast } = useApp();
  const [global, setGlobal] = useState(0);
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    DB.getAttendanceTargets().then(t => {
      setGlobal(t.global || 0);
      setTeams(t.teams || {});
    });
  }, [open]);

  async function save() {
    setLoading(true);
    await DB.setAttendanceTargets('teams', teams, Number(global) || 0);
    showToast('Targets saved', 'success');
    setLoading(false); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Target Management">
      <div className="form-group">
        <label className="form-label">Global Default Target</label>
        <input className="form-input" type="number" min={0} value={global} onChange={e => setGlobal(e.target.value)} />
      </div>
      <h4 className="form-label" style={{marginTop:12}}>Per-Team Targets</h4>
      {TEAMS.map(t => (
        <div key={t} className="form-group" style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
          <label className="form-label" style={{flex:1,textTransform:'none'}}>{t}</label>
          <input className="form-input" style={{maxWidth:100}} type="number" min={0} value={teams[t] || ''} onChange={e => setTeams(p => ({ ...p, [t]: Number(e.target.value) || 0 }))} />
        </div>
      ))}
      <div className="form-actions">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save Targets'}</button>
      </div>
    </Modal>
  );
}

// ── Team Rename modal ───────────────────────────────────────────────────────
function TeamRenameModal({ open, onClose }) {
  const { showToast } = useApp();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  async function save() {
    if (!from || !to.trim()) { showToast('Both names required', 'error'); return; }
    if (!confirm(`Rename "${from}" → "${to}" across all collections?`)) return;
    setLoading(true);
    try {
      const count = await DB.renameTeam(from, to.trim());
      showToast(`Renamed ${count} records`, 'success');
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Rename Team">
      <p className="text-muted mb-3" style={{fontSize:'.8rem'}}>This renames a team across <strong>all collections</strong> (devotees, users, attendance, calling, activities).</p>
      <div className="form-group">
        <label className="form-label">From</label>
        <select className="form-select" value={from} onChange={e => setFrom(e.target.value)}>
          <option value="">Select team</option>{TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">To (new name)</label>
        <input className="form-input" value={to} onChange={e => setTo(e.target.value)} placeholder="New team name" />
      </div>
      <div className="form-actions">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={loading || !from || !to.trim()}>{loading ? 'Renaming…' : 'Rename'}</button>
      </div>
    </Modal>
  );
}
