import React, { useEffect, useState, useCallback } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatINR, toLocalDateStr, shiftDate } from '../utils/helpers';
import Modal from '../components/common/Modal';

// ── Birthday popup ──────────────────────────────────────────────────────────
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
              <div className="text-muted" style={{fontSize:'.78rem'}}>
                {d.team_name} {d.dob ? `· ${new Date(d.dob).toLocaleDateString('en-IN',{day:'numeric',month:'long'})}` : ''}
              </div>
            </div>
            {d.mobile && <a href={`https://wa.me/91${d.mobile}`} className="btn-icon" target="_blank" rel="noreferrer">💬</a>}
          </div>
        ))}
      </div>
      <div className="form-actions"><button className="btn-primary btn-full" onClick={onClose}>Close</button></div>
    </Modal>
  );
}

// ── KPI tile (matches original layout: icon top-left, value, label) ────────
function KPI({ icon, iconBg, value, label }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-tile-icon" style={{ background: iconBg }}>{icon}</div>
      <div className="kpi-tile-body">
        <div className="kpi-tile-value">{value ?? '—'}</div>
        <div className="kpi-tile-label">{label}</div>
      </div>
    </div>
  );
}

// ── Today's Snapshot Banner ────────────────────────────────────────────────
function SnapshotBanner({ onRefresh }) {
  return (
    <div className="snapshot-banner">
      <div className="snapshot-banner-left">
        <div className="snapshot-icon">ॐ</div>
        <div>
          <div className="snapshot-title">Hare Krishna!</div>
          <div className="snapshot-subtitle">Today's snapshot</div>
        </div>
      </div>
      <button className="snapshot-refresh" onClick={onRefresh} title="Refresh">↻</button>
    </div>
  );
}

// ── Dashboard KPIs ──────────────────────────────────────────────────────────
function DashboardKPIs({ sessionId, sessionDate, generation }) {
  const { filters } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) { setData(null); return; }
    setLoading(true);
    try {
      const sat = sessionDate ? shiftDate(sessionDate, -1) : toLocalDateStr();
      const sun = shiftDate(sat, -6);

      const [att, csSnap, books, services, regs, donations] = await Promise.all([
        DB.getSessionAttendance(sessionId),
        DB.getCallingReport(sat),
        DB.getBookDistributions({ startDate: sun, endDate: sat }),
        DB.getServices({ startDate: sun, endDate: sat }),
        DB.getRegistrations({ startDate: sun, endDate: sat }),
        DB.getDonations({ startDate: sun, endDate: sat }),
      ]);

      const filterTeam = list => filters.team ? list.filter(e => (e.team_name||e.teamName) === filters.team) : list;
      const attF = filterTeam(att);
      const booksF = filterTeam(books);
      const servicesF = filterTeam(services);
      const regsF = filterTeam(regs);
      const donationsF = filterTeam(donations);

      // Calling list size + confirmed + came → calling accuracy
      let callingListCount = 0, totalYes = 0, totalCame = 0;
      Object.entries(csSnap).forEach(([team, callers]) => {
        if (filters.team && team !== filters.team) return;
        Object.values(callers).forEach(s => {
          callingListCount += s.called;
          totalYes += s.yes;
          totalCame += s.came;
        });
      });
      const accuracy = totalYes > 0 ? Math.round((totalCame / totalYes) * 100) : null;

      setData({
        present: attF.length,
        callingListCount,
        accuracy,
        books: booksF.reduce((s,b)=>s+(Number(b.quantity)||0), 0),
        services: servicesF.length,
        registrations: regsF.reduce((s,r)=>s+(Number(r.count)||0), 0),
        donations: donationsF.reduce((s,d)=>s+(Number(d.amount)||0), 0),
      });
    } catch (e) { console.error('Dashboard KPIs:', e); }
    finally { setLoading(false); }
  }, [sessionId, sessionDate, filters.team, generation]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="loading-spinner" />;

  // Attended KPI shows "X/Y" (attended / calling-list size)
  const attendedValue = data
    ? (data.callingListCount > 0 ? `${data.present}/${data.callingListCount}` : data.present)
    : '—';

  return (
    <div className="kpi-tiles-grid">
      <KPI icon="✓" iconBg="rgba(22,163,74,.15)"   value={attendedValue}                                label="Attended" />
      <KPI icon="📞" iconBg="rgba(37,99,235,.15)"   value={data?.accuracy != null ? `${data.accuracy}%` : '—'} label="Calling Accuracy" />
      <KPI icon="📚" iconBg="rgba(245,197,24,.18)" value={data?.books}                                 label="Books" />
      <KPI icon="🤲" iconBg="rgba(217,119,6,.15)"  value={data?.services}                              label="Services" />
      <KPI icon="📋" iconBg="rgba(124,58,237,.15)" value={data?.registrations}                         label="Registrations" />
      <KPI icon="💖" iconBg="rgba(236,72,153,.15)" value={data?.donations != null ? formatINR(data.donations) : '—'} label="Donation ₹" />
    </div>
  );
}

// ── Coordinator Performance — full 11-column grid ─────────────────────────
function CoordinatorPerformance({ sessionId, sessionDate, generation }) {
  const { filters } = useApp();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!sessionId) return;
      setLoading(true);
      try {
        const sat = sessionDate ? shiftDate(sessionDate, -1) : toLocalDateStr();
        const all = await DB.getCoordinatorPerformance(sat, sessionId, sessionDate);
        const filtered = filters.team ? all.filter(r => r.team === filters.team) : all;
        setRows(filtered);
      } catch (e) { console.error('CoordinatorPerformance:', e); }
      finally { setLoading(false); }
    }
    load();
  }, [sessionId, sessionDate, filters.team, generation]);

  // Group rows by team for visual separation
  const byTeam = {};
  rows.forEach(r => { (byTeam[r.team] = byTeam[r.team] || []).push(r); });

  // Grand totals
  const totals = rows.reduce((a, r) => ({
    called: a.called + r.called, yes: a.yes + r.yes, attended: a.attended + r.attended,
    books: a.books + r.books, services: a.services + r.services,
    registrations: a.registrations + r.registrations, donations: a.donations + r.donations,
  }), { called: 0, yes: 0, attended: 0, books: 0, services: 0, registrations: 0, donations: 0 });

  return (
    <div className="coordinator-performance">
      <h3 className="cp-title">📋 Coordinator Performance</h3>
      {loading ? <div className="loading-spinner" /> :
        rows.length === 0
          ? <div className="empty-state">No submitted calling data for this session yet</div>
          : <div className="table-scroll">
              <table className="simple-table coordinator-grid">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Coordinator</th>
                    <th title="Devotees called">Called</th>
                    <th title="Said yes">Confirmed</th>
                    <th title="Actually attended">Attended</th>
                    <th>Target</th>
                    <th>%</th>
                    <th title="Books distributed">📚</th>
                    <th title="Service entries">🤲</th>
                    <th title="Registrations">📋</th>
                    <th title="Donations ₹">💰</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(byTeam).map(([team, list]) => {
                    const tt = list.reduce((a, r) => ({
                      called: a.called + r.called, yes: a.yes + r.yes, attended: a.attended + r.attended,
                      books: a.books + r.books, services: a.services + r.services,
                      registrations: a.registrations + r.registrations, donations: a.donations + r.donations,
                    }), { called: 0, yes: 0, attended: 0, books: 0, services: 0, registrations: 0, donations: 0 });
                    return (
                      <React.Fragment key={team}>
                        {list.map((r, i) => (
                          <tr key={`${team}-${i}`}>
                            {i === 0
                              ? <td rowSpan={list.length + 1} className="team-cell"><strong>{team}</strong></td>
                              : null}
                            <td>{r.caller}</td>
                            <td>{r.called}</td>
                            <td>{r.yes}</td>
                            <td><strong>{r.attended}</strong></td>
                            <td>{r.target || '—'}</td>
                            <td>
                              {r.target > 0
                                ? <span className={`pct-badge pct-${r.percentage >= 80 ? 'good' : r.percentage >= 50 ? 'ok' : 'low'}`}>{r.percentage}%</span>
                                : '—'}
                            </td>
                            <td>{r.books || '—'}</td>
                            <td>{r.services || '—'}</td>
                            <td>{r.registrations || '—'}</td>
                            <td>{r.donations ? formatINR(r.donations) : '—'}</td>
                          </tr>
                        ))}
                        <tr className="team-subtotal-row">
                          <td><em>Total</em></td>
                          <td>{tt.called}</td>
                          <td>{tt.yes}</td>
                          <td><strong>{tt.attended}</strong></td>
                          <td></td>
                          <td></td>
                          <td>{tt.books || '—'}</td>
                          <td>{tt.services || '—'}</td>
                          <td>{tt.registrations || '—'}</td>
                          <td>{tt.donations ? formatINR(tt.donations) : '—'}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  <tr className="grand-total-row">
                    <td colSpan={2}><strong>Grand Total</strong></td>
                    <td><strong>{totals.called}</strong></td>
                    <td><strong>{totals.yes}</strong></td>
                    <td><strong>{totals.attended}</strong></td>
                    <td></td>
                    <td></td>
                    <td><strong>{totals.books || '—'}</strong></td>
                    <td><strong>{totals.services || '—'}</strong></td>
                    <td><strong>{totals.registrations || '—'}</strong></td>
                    <td><strong>{totals.donations ? formatINR(totals.donations) : '—'}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
      }
    </div>
  );
}

// ── Session Config modal ────────────────────────────────────────────────────
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
    await DB.setCallingWeekConfig(form.callingDate, form.sessionDate, {
      topic: form.topic, speakerName: form.speakerName, sessionType: form.sessionType,
    });
    if (form.sessionDate) await DB.getOrCreateSession(form.sessionDate);
    showToast('Session configured', 'success');
    setLoading(false); onClose();
  }
  function setF(k, v) { setForm(p => ({ ...p, [k]: v })); }

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

// ── Main HomePage ───────────────────────────────────────────────────────────
export default function HomePage() {
  const { userName, isSuper } = useAuth();
  const { filters } = useApp();
  const [showSessionConfig, setShowSessionConfig] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [cfg, setCfg] = useState(null);
  const [birthdays, setBirthdays] = useState([]);
  const [showBirthdays, setShowBirthdays] = useState(false);
  const [generation, setGeneration] = useState(0);

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
      // Only auto-show birthday popup once per day
      const lastShown = sessionStorage.getItem('birthdayShown');
      const today = toLocalDateStr();
      if (bd.length && lastShown !== today) {
        setBirthdays(bd);
        setShowBirthdays(true);
        sessionStorage.setItem('birthdayShown', today);
      } else {
        setBirthdays(bd);
      }
    }
    init();
  }, []);

  // Sync with master filter
  useEffect(() => {
    if (filters.sessionId) setSessionId(filters.sessionId);
    if (filters.sessionDate) setSessionDate(filters.sessionDate);
  }, [filters.sessionId, filters.sessionDate]);

  function refreshAll() {
    setGeneration(g => g + 1);
  }

  const firstName = userName?.split(' ')[0] || 'Devotee';

  return (
    <div className="tab-page">
      <BirthdayPopup list={birthdays} onClose={() => setShowBirthdays(false)} />

      {/* Snapshot banner — matches original "Hare Krishna! Today's snapshot" */}
      <SnapshotBanner onRefresh={refreshAll} />

      {/* KPI tiles */}
      {sessionId && <DashboardKPIs sessionId={sessionId} sessionDate={sessionDate} generation={generation} />}

      {/* Coordinator Performance */}
      {sessionId && <CoordinatorPerformance sessionId={sessionId} sessionDate={sessionDate} generation={generation} />}

      {/* Greeting + session config (compact, below content) */}
      <div className="home-greeting compact">
        <span>Hare Krishna, <strong>{firstName}</strong>! 🙏</span>
        {cfg?.sessionDate && <span className="text-muted ml-2">· Next: {formatDate(cfg.sessionDate || cfg.session_date)}{cfg.topic ? ` · ${cfg.topic}` : ''}</span>}
        <div className="home-actions">
          {isSuper && <button className="btn-outline sm" onClick={() => setShowSessionConfig(true)}>⚙ Configure Session</button>}
          {birthdays.length > 0 && <button className="btn-outline sm" onClick={() => setShowBirthdays(true)}>🎂 {birthdays.length} Birthday{birthdays.length > 1 ? 's' : ''}</button>}
        </div>
      </div>

      {isSuper && <SessionConfigModal open={showSessionConfig} onClose={() => setShowSessionConfig(false)} />}
    </div>
  );
}
