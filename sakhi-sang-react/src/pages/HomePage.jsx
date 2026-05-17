import React, { useEffect, useState } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatINR, toLocalDateStr, shiftDate } from '../utils/helpers';
import Modal from '../components/common/Modal';

// ── Birthday Popup ──────────────────────────────────────────────────────────
function BirthdayPopup({ list, onClose }) {
  if (!list.length) return null;
  return (
    <Modal open onClose={onClose} title="🎂 Birthdays This Week">
      <div className="birthday-list">
        {list.map(d => (
          <div key={d.id} className="birthday-item">
            <div className="devotee-avatar sm">🎂</div>
            <div>
              <strong>{d.name}</strong>
              <div className="text-muted" style={{ fontSize: '.78rem' }}>
                {d.team_name} {d.dob ? `· ${new Date(d.dob).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}` : ''}
              </div>
            </div>
            {d.mobile && <a href={`https://wa.me/91${d.mobile}`} className="btn-icon" target="_blank" rel="noreferrer">💬</a>}
          </div>
        ))}
      </div>
      <div className="form-actions">
        <button className="btn-primary btn-full" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
}

// ── Session Config ──────────────────────────────────────────────────────────
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
    await DB.setCallingWeekConfig(form.callingDate, form.sessionDate, {
      topic: form.topic, speakerName: form.speakerName, sessionType: form.sessionType,
    });
    if (form.sessionDate) await DB.getOrCreateSession(form.sessionDate);
    showToast('Session configured', 'success');
    setLoading(false);
    onClose();
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  return (
    <Modal open={open} onClose={onClose} title="Configure Session">
      <div className="form-grid">
        <div className="form-group"><label className="form-label">Calling Date (Saturday)</label>
          <input className="form-input" type="date" value={form.callingDate} onChange={e => setF('callingDate', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Session Date (Sunday)</label>
          <input className="form-input" type="date" value={form.sessionDate} onChange={e => setF('sessionDate', e.target.value)} /></div>
        <div className="form-group full"><label className="form-label">Topic</label>
          <input className="form-input" value={form.topic} onChange={e => setF('topic', e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Speaker</label>
          <input className="form-input" value={form.speakerName} onChange={e => setF('speakerName', e.target.value)} /></div>
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
        <button className="btn-primary" onClick={save} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
      </div>
    </Modal>
  );
}

// ── Dashboard KPIs ──────────────────────────────────────────────────────────
function DashboardKPIs({ sessionId, sessionDate }) {
  const { filters } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (sessionId) load(); }, [sessionId, filters.team]);

  async function load() {
    setLoading(true);
    const sat = sessionDate ? shiftDate(sessionDate, -1) : toLocalDateStr();
    const sun = shiftDate(sat, -6);
    const [att, books, services, registrations, donations] = await Promise.all([
      DB.getSessionAttendance(sessionId),
      DB.getBookDistributions({ startDate: sun, endDate: sat }),
      DB.getServices({ startDate: sun, endDate: sat }),
      DB.getRegistrations({ startDate: sun, endDate: sat }),
      DB.getDonations({ startDate: sun, endDate: sat }),
    ]);
    setData({
      present: att.length,
      newDevotees: att.filter(a => a.is_new_devotee).length,
      books: books.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
      services: services.length,
      registrations: registrations.reduce((s, r) => s + (Number(r.count) || 0), 0),
      donations: donations.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    });
    setLoading(false);
  }

  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;

  const kpis = [
    { label: 'Present', value: data.present, icon: '✓' },
    { label: 'New Comers', value: data.newDevotees, icon: '⭐' },
    { label: 'Books', value: data.books, icon: '📚' },
    { label: 'Service', value: data.services, icon: '🤲' },
    { label: 'Donations', value: formatINR(data.donations), icon: '💰' },
  ];

  return (
    <div className="dashboard-kpis">
      {kpis.map(k => (
        <div key={k.label} className="kpi-card">
          <div className="kpi-icon">{k.icon}</div>
          <div className="kpi-value">{k.value}</div>
          <div className="kpi-label">{k.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main HomePage ───────────────────────────────────────────────────────────
export default function HomePage() {
  const { userName, isSuper } = useAuth();
  const [showSessionConfig, setShowSessionConfig] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [cfg, setCfg] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [showBirthdays, setShowBirthdays] = useState(false);

  useEffect(() => {
    async function init() {
      const [s, c, bd] = await Promise.all([
        DB.getTodaySession(),
        DB.getCallingWeekConfig(),
        DB.getCareBirthdays(),
      ]);
      setSessionId(s.id);
      setSessionDate(s.session_date);
      setCfg(c);
      if (bd.length) { setBirthdays(bd); setShowBirthdays(true); }
    }
    init();
  }, []);

  const firstName = userName?.split(' ')[0] || 'Devotee';

  return (
    <div className="tab-page">
      <BirthdayPopup list={birthdays} onClose={() => setShowBirthdays(false)} />

      <div className="home-greeting">
        <h2 className="greeting-text">Hare Krishna, {firstName}! 🙏</h2>
        {cfg && (
          <div className="session-chip">
            {cfg.topic && <span>📖 {cfg.topic}</span>}
            {cfg.sessionDate && <span> · {formatDate(cfg.sessionDate || cfg.session_date)}</span>}
            {cfg.sessionType === 'festival' && <span> · 🎉 Festival</span>}
          </div>
        )}
        <div className="home-actions">
          {isSuper && <button className="btn-outline sm" onClick={() => setShowSessionConfig(true)}>⚙ Configure Session</button>}
          {birthdays.length > 0 && <button className="btn-outline sm" onClick={() => setShowBirthdays(true)}>🎂 {birthdays.length} Birthday{birthdays.length > 1 ? 's' : ''}</button>}
        </div>
      </div>

      {sessionId && <DashboardKPIs sessionId={sessionId} sessionDate={sessionDate} />}

      {isSuper && <SessionConfig open={showSessionConfig} onClose={() => setShowSessionConfig(false)} />}
    </div>
  );
}
