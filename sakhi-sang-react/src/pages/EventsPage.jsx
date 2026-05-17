import React, { useEffect, useState } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/helpers';
import Modal from '../components/common/Modal';
import DevoteePicker from '../components/common/DevoteePicker';

function EventRoster({ event, onClose }) {
  const { showToast } = useApp();
  const { isSuper } = useAuth();
  const [devotees, setDevotees] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [event.id]);

  async function load() {
    setLoading(true);
    const list = await DB.getEventDevotees(event.id);
    setDevotees(list);
    setLoading(false);
  }

  async function add(d) {
    try {
      await DB.addEventDevotee(event.id, { id: d.id, name: d.name, teamName: d.team });
      load();
      showToast(`${d.name} registered`, 'success');
    } catch { showToast('Already registered', 'warning'); }
  }

  async function remove(devoteeId) {
    await DB.removeEventDevotee(event.id, devoteeId);
    load();
  }

  return (
    <div>
      <div className="event-roster-header">
        <h3>{event.event_name}</h3>
        <span className="text-muted">{formatDate(event.event_date)} · {devotees.length} registered</span>
      </div>
      <div className="form-group mt-3">
        <label className="form-label">Add Devotee</label>
        <DevoteePicker value="" onChange={d => d.id && add(d)} placeholder="Search and select…" />
      </div>
      {loading ? <div className="loading-spinner" /> : (
        <table className="simple-table mt-3">
          <thead><tr><th>#</th><th>Name</th><th>Team</th>{isSuper && <th></th>}</tr></thead>
          <tbody>
            {devotees.map((d, i) => (
              <tr key={d.id}>
                <td>{i + 1}</td>
                <td>{d.devotee_name || d.devoteeName}</td>
                <td>{d.team_name || d.teamName}</td>
                {isSuper && <td><button className="btn-icon danger" onClick={() => remove(d.devotee_id || d.devoteeId)}>✕</button></td>}
              </tr>
            ))}
            {devotees.length === 0 && <tr><td colSpan={4} className="empty-state">No registrations yet</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function EventsPage() {
  const { showToast } = useApp();
  const { isSuper } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [rosterEvent, setRosterEvent] = useState(null);
  const [form, setForm] = useState({ event_name: '', event_date: '', description: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    DB.getEvents().then(e => { setEvents(e); setLoading(false); });
  }

  function openNew() { setEditEvent(null); setForm({ event_name: '', event_date: '', description: '' }); setShowForm(true); }
  function openEdit(e) { setEditEvent(e); setForm({ event_name: e.event_name, event_date: e.event_date, description: e.description || '' }); setShowForm(true); }

  async function saveEvent() {
    if (!form.event_name.trim()) return;
    if (editEvent) {
      await DB.updateEvent(editEvent.id, form);
      showToast('Event updated', 'success');
    } else {
      await DB.createEvent(form);
      showToast('Event created', 'success');
    }
    setShowForm(false);
    load();
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event and all its registrations?')) return;
    await DB.deleteEvent(id);
    showToast('Event deleted', 'info');
    load();
  }

  return (
    <div className="tab-page">
      <div className="section-header">
        <h3 className="section-title">Events</h3>
        {isSuper && <button className="btn-primary" onClick={openNew}>+ New Event</button>}
      </div>

      {loading ? <div className="loading-spinner" /> : (
        <div>
          {events.length === 0 && <div className="empty-state">No events yet</div>}
          {events.map(e => (
            <div key={e.id} className="event-card">
              <div className="event-card-body" onClick={() => setRosterEvent(e)} style={{ cursor: 'pointer' }}>
                <div className="event-name">{e.event_name}</div>
                <div className="event-date">{formatDate(e.event_date)}</div>
                {e.description && <div className="event-desc text-muted">{e.description}</div>}
              </div>
              <div className="event-actions">
                <button className="btn-outline sm" onClick={() => setRosterEvent(e)}>👥 Roster</button>
                {isSuper && <button className="btn-icon" onClick={() => openEdit(e)}>✏</button>}
                {isSuper && <button className="btn-icon danger" onClick={() => deleteEvent(e.id)}>🗑</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editEvent ? 'Edit Event' : 'New Event'}>
        <div className="form-group"><label className="form-label">Event Name *</label><input className="form-input" value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="form-actions">
          <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          <button className="btn-primary" onClick={saveEvent}>Save</button>
        </div>
      </Modal>

      <Modal open={!!rosterEvent} onClose={() => setRosterEvent(null)} title="Event Roster" size="lg">
        {rosterEvent && <EventRoster event={rosterEvent} onClose={() => setRosterEvent(null)} />}
      </Modal>
    </div>
  );
}
