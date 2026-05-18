import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { DB } from '../../firebase/db';
import { useApp } from '../../context/AppContext';
import { TEAMS } from '../../firebase/config';
import { doc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../context/AuthContext';

export default function UserManagement({ open, onClose }) {
  const { showToast } = useApp();
  const { userId } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function load() {
    setLoading(true);
    const list = await DB.getUsers(search);
    setUsers(list);
    setLoading(false);
  }

  async function saveUser(uid, updates) {
    await updateDoc(doc(db, 'users', uid), { ...updates, updatedAt: serverTimestamp() });
    showToast('User updated', 'success');
    load();
  }

  async function removeUser(uid) {
    if (uid === userId) { showToast('Cannot remove yourself', 'error'); return; }
    if (!confirm('Remove this user? They will lose access.')) return;
    await deleteDoc(doc(db, 'users', uid));
    showToast('User removed', 'success');
    load();
  }

  return (
    <Modal open={open} onClose={onClose} title="User Management" size="lg">
      <div className="search-box mb-3">
        <input className="form-input" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <button className="btn-primary" onClick={load}>Search</button>
      </div>
      {loading ? <div className="loading-spinner" /> : (
        <div className="user-list">
          {users.map(u => (
            <div key={u.id} className="user-row">
              <div className="user-info">
                <strong>{u.displayName || u.name || '—'}</strong>
                <span className="text-muted">{u.email || ''}</span>
              </div>
              <select className="form-select sm" value={u.role || ''} onChange={e => saveUser(u.id, { role: e.target.value })}>
                <option value="serviceDevotee">Facilitator</option>
                <option value="teamAdmin">Coordinator</option>
                <option value="superAdmin">Super Admin</option>
              </select>
              <select className="form-select sm" value={u.teamName || u.team_name || ''} onChange={e => saveUser(u.id, { teamName: e.target.value })}>
                <option value="">No team</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="user-att-toggle" title="Allow marking live attendance">
                <input type="checkbox" checked={!!u.isAttSevaDev} onChange={e => saveUser(u.id, { isAttSevaDev: e.target.checked })} />
                <span>Att. Seva</span>
              </label>
              <button className="btn-icon danger" onClick={() => removeUser(u.id)} title="Remove user">✕</button>
            </div>
          ))}
          {!loading && users.length === 0 && <div className="empty-state">No users found</div>}
        </div>
      )}
    </Modal>
  );
}
