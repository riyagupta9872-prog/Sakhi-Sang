import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { DB } from '../../firebase/db';
import { useApp } from '../../context/AppContext';
import { TEAMS } from '../../firebase/config';

export default function SignupRequests({ open, onClose }) {
  const { showToast } = useApp();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selections, setSelections] = useState({});

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function load() {
    setLoading(true);
    const list = await DB.getPendingSignups();
    setRequests(list);
    const sel = {};
    list.forEach(r => { sel[r.id] = { role: 'serviceDevotee', team: '' }; });
    setSelections(sel);
    setLoading(false);
  }

  async function approve(req) {
    const sel = selections[req.id] || { role: 'serviceDevotee', team: '' };
    await DB.approveSignupRequest(req.id, req.uid || req.id, sel.role, sel.team, req.displayName || req.display_name);
    showToast(`${req.displayName || 'User'} approved`, 'success');
    load();
  }

  async function reject(req) {
    await DB.rejectSignupRequest(req.id);
    showToast('Request rejected', 'info');
    load();
  }

  function setSel(id, field, val) {
    setSelections(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }));
  }

  return (
    <Modal open={open} onClose={onClose} title={`Signup Requests${requests.length ? ` (${requests.length})` : ''}`} size="lg">
      {loading ? <div className="loading-spinner" /> : (
        <div>
          {requests.length === 0 && <div className="empty-state">No pending requests</div>}
          {requests.map(r => (
            <div key={r.id} className="signup-row">
              <div className="signup-info">
                <strong>{r.displayName || r.display_name || '—'}</strong>
                <span className="text-muted">{r.email}</span>
              </div>
              <select className="form-select sm" value={selections[r.id]?.role || 'serviceDevotee'} onChange={e => setSel(r.id, 'role', e.target.value)}>
                <option value="serviceDevotee">Facilitator</option>
                <option value="teamAdmin">Team Coordinator</option>
                <option value="departmentAdmin">Department Admin</option>
                <option value="superAdmin">Super Admin</option>
              </select>
              <select className="form-select sm" value={selections[r.id]?.team || ''} onChange={e => setSel(r.id, 'team', e.target.value)}>
                <option value="">No team</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="signup-actions">
                <button className="btn-success sm" onClick={() => approve(r)}>Approve</button>
                <button className="btn-danger sm" onClick={() => reject(r)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
