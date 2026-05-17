import React, { useEffect, useState, useCallback } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { avatarInitials, formatDate, isBirthdayThisWeek, attTimeStyle, getFYYears, toLocalDateStr, shiftDate } from '../utils/helpers';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// ── Live Attendance ────────────────────────────────────────────────────────
function LivePanel({ sessionId, sessionDate }) {
  const { showToast, filters } = useApp();
  const [stats, setStats] = useState({ present: 0, newDevotees: 0 });
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const [s, list] = await Promise.all([
      DB.getSessionStats(sessionId),
      DB.getAttendanceCandidates(sessionId, search, filters.team),
    ]);
    setStats(s);
    setCandidates(list);
    setLoading(false);
  }, [sessionId, search, filters.team]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function markPresent(d, isNew = false) {
    try {
      await DB.markPresent(sessionId, { id: d.id, name: d.name, teamName: d.team_name }, isNew);
      showToast(`${d.name} marked present`, 'success');
      loadAll();
    } catch (err) {
      showToast(err.code === 409 ? 'Already marked' : 'Error', err.code === 409 ? 'warning' : 'error');
    }
  }

  async function undoPresent(d) {
    if (!confirm(`Remove ${d.name}?`)) return;
    await DB.undoPresent(sessionId, d.id);
    showToast('Removed', 'info');
    loadAll();
  }

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-value">{stats.present}</div><div className="stat-label">Present</div></div>
        <div className="stat-card"><div className="stat-value">{stats.newDevotees}</div><div className="stat-label">New</div></div>
      </div>
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
                    {isBirthdayThisWeek(d.dob) && <span title="Birthday">🎂</span>}
                    {d.coming_status === 'Yes' && <span className="badge-confirmed">Confirmed</span>}
                  </div>
                  <div className="att-card-meta">
                    {d.team_name && <span>{d.team_name}</span>}
                    {d.calling_by && <span>· {d.calling_by}</span>}
                    {d.is_present && d.marked_at_client && (
                      <span className={`att-time ${attTimeStyle(d.marked_at_client)}`}>
                        · ✓ {new Date(d.marked_at_client).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="att-card-actions">
                {d.is_present
                  ? <button className="btn-outline sm" onClick={() => undoPresent(d)}>Undo</button>
                  : <>
                      <button className="present-btn" onClick={() => markPresent(d, false)}>Mark Present</button>
                      <button className="btn-outline sm" onClick={() => markPresent(d, true)}>New</button>
                    </>
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Attendance Sheet ───────────────────────────────────────────────────────
function SheetPanel() {
  const { filters } = useApp();
  const [yearIdx, setYearIdx] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const years = getFYYears();

  async function load() {
    setLoading(true);
    const d = await DB.getSheetData(years[yearIdx].startDate, years[yearIdx].endDate);
    setData(d);
    setLoading(false);
  }

  useEffect(() => { load(); }, [yearIdx]);

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
        <button className="btn-outline" onClick={load}>Refresh</button>
      </div>
      <div className="table-scroll">
        <table className="attendance-sheet-table">
          <thead>
            <tr>
              <th className="frozen sno">#</th>
              <th className="frozen name-col">Name</th>
              <th>Team</th><th>CR</th><th>AT</th>
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

// ── Reports sub-tabs ───────────────────────────────────────────────────────
function TeamsReport({ sessionId, sessionDate }) {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    const sat = sessionDate ? shiftDate(sessionDate, -1) : toLocalDateStr();
    DB.getTeamsReport(sat, sessionId).then(r => { setReport(r); setLoading(false); });
  }, [sessionId]);
  if (loading) return <div className="loading-spinner" />;
  return (
    <table className="simple-table">
      <thead><tr><th>Team</th><th>Total</th><th>Present</th><th>Target</th><th>%</th></tr></thead>
      <tbody>
        {report.map((r, i) => (
          <tr key={i}>
            <td>{r.team}</td><td>{r.total}</td><td><strong>{r.actualPresent}</strong></td><td>{r.target || '—'}</td>
            <td><span className={`pct-badge pct-${r.percentage >= 80 ? 'good' : r.percentage >= 50 ? 'ok' : 'low'}`}>{r.target ? `${r.percentage}%` : '—'}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TrendsReport() {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    DB.getTrends('weekly').then(t => { setTrends(t); setLoading(false); });
  }, []);
  if (loading) return <div className="loading-spinner" />;
  if (!trends.length) return <div className="empty-state">No data</div>;
  const chartData = {
    labels: trends.map(t => t.period?.slice(5)),
    datasets: [{ label: 'Attendance', data: trends.map(t => t.count), borderColor: '#f5c518', backgroundColor: 'rgba(245,197,24,.15)', tension: 0.4, fill: true, pointRadius: 4 }],
  };
  return <div className="chart-wrap"><Line data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} /></div>;
}

function NewComersReport({ sessionId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    DB.getSessionAttendance(sessionId).then(att => {
      setList(att.filter(a => a.is_new_devotee));
      setLoading(false);
    });
  }, [sessionId]);
  if (loading) return <div className="loading-spinner" />;
  return (
    <table className="simple-table">
      <thead><tr><th>Name</th><th>Team</th></tr></thead>
      <tbody>
        {list.length === 0 && <tr><td colSpan={2} className="empty-state">No new comers</td></tr>}
        {list.map((a, i) => <tr key={i}><td>{a.devotee_name}</td><td>{a.team_name}</td></tr>)}
      </tbody>
    </table>
  );
}

const REPORT_TABS = [
  { id: 'sheet',      label: 'Attendance Sheet' },
  { id: 'teams',      label: 'Teams' },
  { id: 'newcomers',  label: 'New Comers' },
  { id: 'trends',     label: 'Trends' },
];

function ReportsPanel({ sessionId, sessionDate }) {
  const [reportTab, setReportTab] = useState('sheet');
  return (
    <div>
      <div className="sub-tab-bar" style={{ marginTop: 8 }}>
        {REPORT_TABS.map(t => (
          <button key={t.id} className={`sub-tab-btn${reportTab === t.id ? ' active' : ''}`} onClick={() => setReportTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {reportTab === 'sheet'     && <SheetPanel />}
      {reportTab === 'teams'     && <TeamsReport sessionId={sessionId} sessionDate={sessionDate} />}
      {reportTab === 'newcomers' && <NewComersReport sessionId={sessionId} />}
      {reportTab === 'trends'    && <TrendsReport />}
    </div>
  );
}

// ── Main AttendancePage ────────────────────────────────────────────────────
export default function AttendancePage() {
  const { filters } = useApp();
  const [subTab, setSubTab] = useState('live');
  const [sessionId, setSessionId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DB.getTodaySession().then(s => {
      setSessionId(s.id);
      setSessionDate(s.session_date);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (filters.sessionId) setSessionId(filters.sessionId);
    if (filters.sessionDate) setSessionDate(filters.sessionDate);
  }, [filters.sessionId, filters.sessionDate]);

  return (
    <div className="tab-page">
      <div className="sub-tab-bar">
        <button className={`sub-tab-btn${subTab === 'live' ? ' active' : ''}`} onClick={() => setSubTab('live')}>Live</button>
        <button className={`sub-tab-btn${subTab === 'reports' ? ' active' : ''}`} onClick={() => setSubTab('reports')}>Reports</button>
      </div>

      {sessionDate && (
        <div className="session-info-bar">
          <span className="session-label">Session: <strong>{formatDate(sessionDate)}</strong></span>
        </div>
      )}

      {loading ? <div className="loading-spinner" /> : (
        <>
          {subTab === 'live'    && <LivePanel sessionId={sessionId} sessionDate={sessionDate} />}
          {subTab === 'reports' && <ReportsPanel sessionId={sessionId} sessionDate={sessionDate} />}
        </>
      )}
    </div>
  );
}
