import React, { useEffect, useState, useCallback } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { avatarInitials, formatDate, isBirthdayThisWeek, attTimeStyle, getFYYears } from '../utils/helpers';

// ── Live Attendance ────────────────────────────────────────────────────────────
function LiveAttendance({ sessionId }) {
  const { filters } = useApp();
  const { showToast } = useApp();
  const { userRole } = useAuth();
  const [stats, setStats] = useState({ present: 0, newDevotees: 0, confirmed: 0, totalPresent: 0 });
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadStats = useCallback(async () => {
    const s = await DB.getSessionStats(sessionId);
    setStats(s);
  }, [sessionId]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    const list = await DB.getAttendanceCandidates(sessionId, search, filters.team);
    setCandidates(list);
    setLoading(false);
  }, [sessionId, search, filters.team]);

  useEffect(() => {
    if (!sessionId) return;
    loadStats();
    loadCandidates();
  }, [sessionId, loadStats, loadCandidates]);

  async function markPresent(d, isNew = false) {
    try {
      await DB.markPresent(sessionId, { id: d.id, name: d.name, teamName: d.team_name || d.teamName }, isNew);
      showToast(`${d.name} marked present`, 'success');
      loadStats();
      loadCandidates();
    } catch (err) {
      if (err.code === 409) showToast('Already marked present', 'warning');
      else showToast('Error marking present', 'error');
    }
  }

  async function undoPresent(d) {
    if (!confirm(`Remove ${d.name} from attendance?`)) return;
    await DB.undoPresent(sessionId, d.id);
    showToast(`${d.name} removed`, 'info');
    loadStats();
    loadCandidates();
  }

  return (
    <div>
      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card"><div className="stat-value">{stats.confirmed}</div><div className="stat-label">Confirmed</div></div>
        <div className="stat-card"><div className="stat-value">{stats.present}</div><div className="stat-label">Present</div></div>
        <div className="stat-card"><div className="stat-value">{stats.newDevotees}</div><div className="stat-label">New</div></div>
        <div className="stat-card"><div className="stat-value">{stats.totalPresent}</div><div className="stat-label">Total</div></div>
      </div>

      {/* Search */}
      <div className="search-box my-3">
        <input className="form-input" placeholder="Search devotee…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="loading-spinner" /> : (
        <div className="attendance-list">
          {candidates.length === 0 && <div className="empty-state">No candidates</div>}
          {candidates.map(d => (
            <div key={d.id} className={`attendance-card${d.is_present ? ' present' : ''}`}>
              <div className="att-card-left">
                <div className="devotee-avatar sm">{avatarInitials(d.name)}</div>
                <div className="att-card-info">
                  <div className="att-card-name">
                    {d.name}
                    {isBirthdayThisWeek(d.dob) && <span title="Birthday this week">🎂</span>}
                    {d.coming_status === 'Yes' && <span className="badge-confirmed">Confirmed</span>}
                  </div>
                  <div className="att-card-meta">
                    {d.team_name && <span>{d.team_name}</span>}
                    {d.calling_by && <span>· {d.calling_by}</span>}
                    {d.marked_at && <span className={`att-time ${attTimeStyle(d.marked_at_client)}`}>· ✓ {new Date(d.marked_at?.toDate?.() || d.marked_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                </div>
              </div>
              <div className="att-card-actions">
                {d.is_present ? (
                  <button className="btn-outline sm" onClick={() => undoPresent(d)}>Undo</button>
                ) : (
                  <>
                    <button className="present-btn" onClick={() => markPresent(d, false)}>Mark Present</button>
                    <button className="btn-outline sm" onClick={() => markPresent(d, true)}>New</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Attendance Sheet ───────────────────────────────────────────────────────────
function AttendanceSheet() {
  const { filters } = useApp();
  const [yearIdx, setYearIdx] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const years = getFYYears();

  async function loadSheet() {
    setLoading(true);
    const y = years[yearIdx];
    const d = await DB.getSheetData(y.startDate, y.endDate);
    setData(d);
    setLoading(false);
  }

  useEffect(() => { loadSheet(); }, [yearIdx]);

  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;

  const { sessions, devotees, attMap } = data;
  const filtered = filters.team ? devotees.filter(d => d.team_name === filters.team) : devotees;

  return (
    <div className="sheet-wrap">
      <div className="sheet-controls">
        <select className="form-select" value={yearIdx} onChange={e => setYearIdx(Number(e.target.value))}>
          {years.map((y, i) => <option key={i} value={i}>{y.label}</option>)}
        </select>
        <button className="btn-outline" onClick={loadSheet}>Refresh</button>
      </div>
      <div className="table-scroll">
        <table className="attendance-sheet-table">
          <thead>
            <tr>
              <th className="frozen sno">Sno</th>
              <th className="frozen name-col">Name</th>
              <th>Team</th>
              <th>CR</th>
              <th>AT</th>
              {sessions.map(s => <th key={s.id}>{s.session_date.slice(5)}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((d, i) => (
              <tr key={d.id}>
                <td className="frozen sno">{i + 1}</td>
                <td className="frozen name-col">{d.name}</td>
                <td>{d.team_name}</td>
                <td>{d.chanting_rounds || 0}</td>
                <td>{d.lifetime_attendance || 0}</td>
                {sessions.map(s => (
                  <td key={s.id} className={attMap[s.id]?.has(d.id) ? 'att-present' : ''}>
                    {attMap[s.id]?.has(d.id) ? 'P' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main AttendancePage ────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { filters, showToast } = useApp();
  const [subTab, setSubTab] = useState('live');
  const [sessionId, setSessionId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const s = await DB.getTodaySession();
      setSessionId(s.id);
      setSessionDate(s.session_date);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (filters.sessionId) setSessionId(filters.sessionId);
    if (filters.sessionDate) setSessionDate(filters.sessionDate);
  }, [filters.sessionId, filters.sessionDate]);

  return (
    <div className="tab-page">
      <div className="sub-tab-bar">
        {['live','sheet','reports'].map(t => (
          <button key={t} className={`sub-tab-btn${subTab === t ? ' active' : ''}`} onClick={() => setSubTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {sessionDate && (
        <div className="session-info-bar">
          <span className="session-label">Session: <strong>{formatDate(sessionDate)}</strong></span>
        </div>
      )}

      {loading ? <div className="loading-spinner" /> : (
        <>
          {subTab === 'live' && <LiveAttendance sessionId={sessionId} />}
          {subTab === 'sheet' && <AttendanceSheet />}
          {subTab === 'reports' && <AttendanceReports sessionId={sessionId} sessionDate={sessionDate} />}
        </>
      )}
    </div>
  );
}

function AttendanceReports({ sessionId, sessionDate }) {
  const { filters } = useApp();
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    // Calling date is Saturday before session Sunday
    const sat = sessionDate ? new Date(sessionDate) : new Date();
    sat.setDate(sat.getDate() - 1);
    const weekDate = sat.toISOString().slice(0,10);
    DB.getTeamsReport(weekDate, sessionId).then(r => { setReport(r); setLoading(false); });
  }, [sessionId, sessionDate]);

  if (loading) return <div className="loading-spinner" />;

  return (
    <div className="report-section">
      <h3 className="section-title">Team Attendance Report</h3>
      <table className="simple-table">
        <thead><tr><th>Team</th><th>Total</th><th>Present</th><th>Target</th><th>%</th></tr></thead>
        <tbody>
          {report.map((r, i) => (
            <tr key={i}>
              <td>{r.team}</td>
              <td>{r.total}</td>
              <td><strong>{r.actualPresent}</strong></td>
              <td>{r.target || '—'}</td>
              <td>
                <span className={`pct-badge pct-${r.percentage >= 80 ? 'good' : r.percentage >= 50 ? 'ok' : 'low'}`}>
                  {r.target ? `${r.percentage}%` : '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
