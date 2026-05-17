import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { DB } from '../../firebase/db';
import { useApp } from '../../context/AppContext';
import { formatDate } from '../../utils/helpers';

export default function SessionManagement({ open, onClose }) {
  const { showToast } = useApp();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editSession, setEditSession] = useState(null);
  const [form, setForm] = useState({ topic: '', is_cancelled: false });

  useEffect(() => { if (open) load(); }, [open]);

  async function load() {
    setLoading(true);
    const list = await DB.getSessionsWithPresent();
    setSessions(list);
    setLoading(false);
  }

  function openEdit(s) {
    setEditSession(s);
    setForm({ topic: s.topic || '', is_cancelled: !!s.is_cancelled });
  }

  async function save() {
    await DB.configureSunday(editSession.id, { topic: form.topic, isCancelled: form.is_cancelled });
    showToast('Session updated', 'success');
    setEditSession(null);
    load();
  }

  return (
    <Modal open={open} onClose={onClose} title="Session Management" size="lg">
      {loading ? <div className="loading-spinner" /> : (
        <div className="table-scroll">
          <table className="simple-table">
            <thead>
              <tr><th>Date</th><th>Topic</th><th>Present</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {sessions.map(s => (
                <tr key={s.id} style={{ opacity: s.is_cancelled ? 0.5 : 1 }}>
                  <td>{formatDate(s.session_date)}</td>
                  <td>{s.topic || <span className="text-muted">—</span>}</td>
                  <td>{s.present || 0}</td>
                  <td>{s.is_cancelled ? <span className="badge-reason">Cancelled</span> : <span className="badge-confirmed">Active</span>}</td>
                  <td><button className="btn-outline sm" onClick={() => openEdit(s)}>✏ Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editSession && (
        <Modal open={!!editSession} onClose={() => setEditSession(null)} title={`Edit — ${formatDate(editSession.session_date)}`}>
          <div className="form-group">
            <label className="form-label">Topic</label>
            <input className="form-input" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="Session topic" />
          </div>
          <div className="form-group">
            <label className="checkbox-row">
              <input type="checkbox" checked={form.is_cancelled} onChange={e => setForm(f => ({ ...f, is_cancelled: e.target.checked }))} />
              Mark as Cancelled
            </label>
          </div>
          <div className="form-actions">
            <button className="btn-outline" onClick={() => setEditSession(null)}>Cancel</button>
            <button className="btn-primary" onClick={save}>Save</button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
