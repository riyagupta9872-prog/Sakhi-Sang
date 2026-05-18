import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { DB } from '../../firebase/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { formatDate, toLocalDateStr } from '../../utils/helpers';
import DevoteePicker from '../common/DevoteePicker';

export default function PersonalMeetings({ open, onClose }) {
  const { showToast } = useApp();
  const { userName } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({ devoteeId: '', devoteeName: '', teamName: '', scheduledDate: toLocalDateStr(), metBy: '', status: 'scheduled', notes: '' });

  useEffect(() => { if (open) load(); }, [open]);

  async function load() {
    setLoading(true);
    const l = await DB.getPersonalMeetings();
    setList(l);
    setLoading(false);
  }

  function openNew() {
    setEdit(null);
    setForm({ devoteeId: '', devoteeName: '', teamName: '', scheduledDate: toLocalDateStr(), metBy: userName, status: 'scheduled', notes: '' });
    setShowForm(true);
  }
  function openEdit(m) {
    setEdit(m);
    setForm({
      devoteeId: m.devoteeId || '', devoteeName: m.devoteeName || '',
      teamName: m.teamName || '', scheduledDate: m.scheduledDate || '',
      metBy: m.metBy || '', status: m.status || 'scheduled', notes: m.notes || '',
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.devoteeName || !form.scheduledDate) { showToast('Devotee and date required', 'error'); return; }
    if (edit) await DB.updatePersonalMeeting(edit.id, form);
    else      await DB.addPersonalMeeting(form);
    showToast(edit ? 'Meeting updated' : 'Meeting added', 'success');
    setShowForm(false);
    load();
  }

  async function del(id) {
    if (!confirm('Delete this meeting?')) return;
    await DB.deletePersonalMeeting(id);
    showToast('Deleted', 'info');
    load();
  }

  return (
    <Modal open={open} onClose={onClose} title="🤝 Personal Meetings" size="lg">
      <div className="section-header">
        <span className="text-muted">{list.length} meetings</span>
        <button className="btn-primary sm" onClick={openNew}>+ New Meeting</button>
      </div>

      {loading ? <div className="loading-spinner" /> : (
        list.length === 0
          ? <div className="empty-state">No personal meetings recorded</div>
          : <div className="meeting-list">
              {list.map(m => (
                <div key={m.id} className="meeting-card">
                  <div className="meeting-card-body">
                    <div className="meeting-name">{m.devoteeName}</div>
                    <div className="meeting-meta">
                      <span>📅 {formatDate(m.scheduledDate)}</span>
                      {m.metBy && <span>· Met by {m.metBy}</span>}
                      <span className={`badge badge-${m.status === 'done' ? 'ms' : m.status === 'cancelled' ? 'inactive' : 'expected'}`}>
                        {m.status}
                      </span>
                    </div>
                    {m.notes && <div className="meeting-notes text-muted">{m.notes}</div>}
                  </div>
                  <div className="meeting-actions">
                    <button className="btn-icon" onClick={() => openEdit(m)}>✏</button>
                    <button className="btn-icon danger" onClick={() => del(m.id)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={edit ? 'Edit Meeting' : 'New Personal Meeting'}>
        <div className="form-group full">
          <label className="form-label">Devotee *</label>
          <DevoteePicker
            value={form.devoteeName}
            onChange={v => setForm(p => ({ ...p, devoteeName: v.name, devoteeId: v.id, teamName: v.team || p.teamName }))}
          />
        </div>
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Date *</label>
            <input className="form-input" type="date" value={form.scheduledDate} onChange={e => setForm(p => ({ ...p, scheduledDate: e.target.value }))} /></div>
          <div className="form-group"><label className="form-label">Met By</label>
            <input className="form-input" value={form.metBy} onChange={e => setForm(p => ({ ...p, metBy: e.target.value }))} /></div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
              <option value="scheduled">Scheduled</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        <div className="form-group full"><label className="form-label">Notes</label>
          <textarea className="form-textarea" rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
        <div className="form-actions">
          <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          <button className="btn-primary" onClick={save}>{edit ? 'Update' : 'Add Meeting'}</button>
        </div>
      </Modal>
    </Modal>
  );
}
