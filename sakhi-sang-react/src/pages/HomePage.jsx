import React, { useEffect, useState } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatINR, toLocalDateStr, shiftDate, snapToSunday } from '../utils/helpers';
import Modal from '../components/common/Modal';

function AttendanceCard({ sessionId, sessionDate }) {
  const [report, setReport] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const sat = shiftDate(sessionDate || toLocalDateStr(), -1);
    const r = await DB.getTeamsReport(sat, sessionId);
    setReport(r);
    setLoading(false);
  }

  useEffect(() => { if (sessionId) load(); }, [sessionId]);

  const total = report.reduce((s, r) => s + r.actualPresent, 0);

  return (
    <div className="home-card" onClick={() => setOpen(true)}>
      <div className="home-card-icon">✓</div>
      <div className="home-card-body">
        <div className="home-card-value">{total}</div>
        <div className="home-card-label">Attendance</div>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Attendance Report">
        {loading ? <div className="loading-spinner" /> : (
          <table className="simple-table">
            <thead><tr><th>Team</th><th>Total</th><th>Called</th><th>Came</th></tr></thead>
            <tbody>
              {report.map((r, i) => (
                <tr key={i}>
                  <td>{r.team}</td><td>{r.total}</td><td>{r.callingList || 0}</td><td>{r.actualPresent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}

function QuickAddCard({ label, icon, onOpen }) {
  return (
    <div className="home-card quick-add-card" onClick={onOpen}>
      <div className="home-card-icon">{icon}</div>
      <div className="home-card-label">{label}</div>
    </div>
  );
}

// Session Config ─────────────────────────────────────────────────────────────
function SessionConfig({ open, onClose }) {
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

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <Modal open={open} onClose={onClose} title="Configure Session">
      <div className="form-grid">
        <div className="form-group"><label className="form-label">Calling Date (Saturday)</label><input className="form-input" type="date" value={form.callingDate} onChange={e => setF('callingDate', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Session Date (Sunday)</label><input className="form-input" type="date" value={form.sessionDate} onChange={e => setF('sessionDate', e.target.value)} /></div>
        <div className="form-group full"><label className="form-label">Topic</label><input className="form-input" value={form.topic} onChange={e => setF('topic', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Speaker</label><input className="form-input" value={form.speakerName} onChange={e => setF('speakerName', e.target.value)} /></div>
        <div className="form-group">
          <label className="form-label">Session Type</label>
          <select className="form-select" value={form.sessionType} onChange={e => setF('sessionType', e.target.value)}>
            <option value="regular">Regular</option>
            <option value="festival">Festival</option>
            <option value="special">Special</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save Config'}</button>
      </div>
    </Modal>
  );
}

// Events ─────────────────────────────────────────────────────────────────────
function EventsSection() {
  const { showToast } = useApp();
  const { isSuper } = useAuth();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [form, setForm] = useState({ event_name: '', event_date: '', description: '' });

  useEffect(() => { DB.getEvents().then(setEvents); }, []);

  async function saveEvent() {
    if (!form.event_name) return;
    if (editEvent) {
      await DB.updateEvent(editEvent.id, form);
      showToast('Event updated', 'success');
    } else {
      await DB.createEvent(form);
      showToast('Event created', 'success');
    }
    DB.getEvents().then(setEvents);
    setShowForm(false);
    setForm({ event_name: '', event_date: '', description: '' });
    setEditEvent(null);
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    await DB.deleteEvent(id);
    showToast('Event deleted', 'info');
    DB.getEvents().then(setEvents);
  }

  return (
    <div className="events-section">
      <div className="section-header">
        <h3 className="section-title">Events</h3>
        {isSuper && <button className="btn-primary sm" onClick={() => { setEditEvent(null); setForm({ event_name: '', event_date: '', description: '' }); setShowForm(true); }}>+ Event</button>}
      </div>

      {events.length === 0 ? (
        <div className="empty-state">No events scheduled</div>
      ) : events.map(e => (
        <div key={e.id} className="event-card">
          <div className="event-card-body">
            <div className="event-name">{e.event_name}</div>
            <div className="event-date">{formatDate(e.event_date)}</div>
            {e.description && <div className="event-desc text-muted">{e.description}</div>}
          </div>
          {isSuper && (
            <div className="event-actions">
              <button className="btn-icon" onClick={() => { setEditEvent(e); setForm({ event_name: e.event_name, event_date: e.event_date, description: e.description || '' }); setShowForm(true); }}>✏</button>
              <button className="btn-icon danger" onClick={() => deleteEvent(e.id)}>🗑</button>
            </div>
          )}
        </div>
      ))}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editEvent ? 'Edit Event' : 'New Event'}>
        <div className="form-group"><label className="form-label">Event Name *</label><input className="form-input" value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} /></div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="form-actions">
          <button className="btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          <button className="btn-primary" onClick={saveEvent}>Save</button>
        </div>
      </Modal>
    </div>
  );
}

// ── Main HomePage ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const { userName, isSuper } = useAuth();
  const { filters } = useApp();
  const [showSessionConfig, setShowSessionConfig] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [config, setConfig] = useState(null);

  useEffect(() => {
    async function init() {
      const s = await DB.getTodaySession();
      setSessionId(s.id);
      setSessionDate(s.session_date);
      const cfg = await DB.getCallingWeekConfig();
      setConfig(cfg);
    }
    init();
  }, []);

  const firstName = userName?.split(' ')[0] || 'Devotee';

  return (
    <div className="tab-page">
      <div className="home-greeting">
        <h2 className="greeting-text">Hare Krishna, {firstName}! 🙏</h2>
        {config && (
          <div className="session-chip">
            Next: {formatDate(config.sessionDate || config.session_date)}
            {config.topic && ` · ${config.topic}`}
          </div>
        )}
        {isSuper && (
          <button className="btn-outline sm" onClick={() => setShowSessionConfig(true)}>⚙ Configure Session</button>
        )}
      </div>

      {/* Quick stat cards */}
      {sessionId && (
        <div className="home-cards-row">
          <AttendanceCard sessionId={sessionId} sessionDate={sessionDate} />
        </div>
      )}

      {/* Events */}
      <EventsSection />

      {/* Session config modal */}
      {isSuper && <SessionConfig open={showSessionConfig} onClose={() => setShowSessionConfig(false)} />}
    </div>
  );
}
