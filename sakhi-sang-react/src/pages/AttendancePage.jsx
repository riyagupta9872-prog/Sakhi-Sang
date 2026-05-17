import React, { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import {
  avatarInitials, formatDate, isBirthdayThisWeek, attTimeStyle,
  getFYYears, toLocalDateStr, shiftDate,
} from '../utils/helpers';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

// ── Live Attendance ─────────────────────────────────────────────────────────
function LivePanel({ sessionId, sessionDate }) {
  const { showToast, filters } = useApp();
  const [stats, setStats] = useState({ present: 0, newDevotees: 0 });
  const [candidates, setCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    const [s, list] = await Promise.all([
      DB.getSessionStats(sessionId),
      DB.getAttendanceCandidates(sessionId, search, filters.team),
    ]);
    setStats(s); setCandidates(list); setLoading(false);
  }, [sessionId, search, filters.team]);

  useEffect(() => { load(); }, [load]);

  async function markPresent(d, isNew = false) {
    try {
      await DB.markPresent(sessionId, { id: d.id, name: d.name, teamName: d.team_name }, isNew);
      showToast(`${d.name} marked present`, 'success');
      load();
    } catch (err) { showToast(err.code === 409 ? 'Already marked' : 'Error', err.code === 409 ? 'warning' : 'error'); }
  }

  async function undoPresent(d) {
    if (!confirm(`Remove ${d.name}?`)) return;
    await DB.undoPresent(sessionId, d.id);
    showToast('Removed', 'info');
    load();
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
                    {d.coming_status === 'Yes' && <span className="badge-confirmed ml-2">Confirmed</span>}
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
                    </>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Attendance Sheet ────────────────────────────────────────────────────────
function SheetPanel() {
  const { filters } = useApp();
  const [yearIdx, setYearIdx] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const years = getFYYears();

  async function load() {
    setLoading(true);
    const d = await DB.getSheetData(years[yearIdx].startDate, years[yearIdx].endDate);
    setData(d); setLoading(false);
  }
  useEffect(() => { load(); }, [yearIdx]);

  function exportExcel() {
    if (!data) return;
    const { sessions, devotees, attMap } = data;
    const filtered = filters.team ? devotees.filter(d => d.team_name === filters.team) : devotees;
    const header = ['#', 'Name', 'Team', 'CR', 'AT', ...sessions.map(s => s.session_date.slice(5))];
    const rows = filtered.map((d, i) => [
      i + 1, d.name, d.team_name, d.chanting_rounds || 0, d.lifetime_attendance || 0,
      ...sessions.map(s => attMap[s.id]?.has(d.id) ? 'P' : ''),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, years[yearIdx].label);
    XLSX.writeFile(wb, `Attendance_Sheet_${years[yearIdx].label}.xlsx`);
  }

  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;
  const { sessions, devotees, attMap } = data;
  const filtered = filters.team ? devotees.filter(d => d.team_name === filters.team) : devotees;

  return (
    <div>
      <div className="sheet-controls">
        <select className="form-select" value={yearIdx} onChange={e => setYearIdx(Number(e.target.value))}>
          {years.map((y, i) => <option key={i} value={i}>{y.label}</option>)}
        </select>
        <button className="btn-outline" onClick={load}>Refresh</button>
        <button className="btn-outline" onClick={exportExcel}>⬇ Excel</button>
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

// ── Teams Leaderboard ───────────────────────────────────────────────────────
function LeaderboardPanel({ sessionId, sessionDate }) {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    const sat = sessionDate ? shiftDate(sessionDate, -1) : toLocalDateStr();
    DB.getTeamsReport(sat, sessionId).then(r => {
      setReport([...r].sort((a, b) => b.percentage - a.percentage));
      setLoading(false);
    });
  }, [sessionId]);

  if (loading) return <div className="loading-spinner" />;
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div>
      <h4 className="section-title">Team Leaderboard</h4>
      {report.map((r, i) => (
        <div key={i} className="leaderboard-row">
          <div className="leaderboard-rank">{medals[i] || `#${i + 1}`}</div>
          <div className="leaderboard-team">
            <div className="leaderboard-name">{r.team}</div>
            <div className="leaderboard-bar-wrap">
              <div className="leaderboard-bar" style={{
                width: `${Math.min(r.target ? r.percentage : 0, 100)}%`,
                background: r.percentage >= 80 ? 'var(--color-success)' : r.percentage >= 50 ? '#f59e0b' : 'var(--color-danger)'
              }} />
            </div>
          </div>
          <div className="leaderboard-stats">
            <strong>{r.actualPresent}</strong>
            {r.target > 0 && <span className={`pct-badge pct-${r.percentage >= 80 ? 'good' : r.percentage >= 50 ? 'ok' : 'low'} ml-2`}>{r.percentage}%</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Serious Analysis ────────────────────────────────────────────────────────
function SeriousPanel({ sessionId, sessionDate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    const sat = sessionDate ? shiftDate(sessionDate, -1) : toLocalDateStr();
    DB.getSeriousReport(sessionId, sat).then(d => { setData(d); setLoading(false); });
  }, [sessionId]);
  if (loading) return <div className="loading-spinner" />;
  return (
    <div>
      <h4 className="section-title">Serious Analysis</h4>
      <table className="simple-table">
        <thead><tr><th>Status</th><th>Promised (Calling)</th><th>Arrived</th><th>%</th></tr></thead>
        <tbody>
          {data.map((r, i) => (
            <tr key={i}>
              <td>{r.status}</td>
              <td>{r.promised}</td>
              <td><strong>{r.arrived}</strong></td>
              <td>{r.promised > 0 ? <span className={`pct-badge pct-${Math.round(r.arrived/r.promised*100) >= 80 ? 'good' : 'ok'}`}>{Math.round(r.arrived / r.promised * 100)}%</span> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Late Comers ─────────────────────────────────────────────────────────────
function LateComersPanel({ sessionId }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!sessionId) return;
    setLoading(true);
    DB.getLateComers(sessionId).then(l => { setList(l); setLoading(false); });
  }, [sessionId]);
  if (loading) return <div className="loading-spinner" />;
  return (
    <div>
      <h4 className="section-title">Late Comers</h4>
      {list.length === 0 && <div className="empty-state">No late comers recorded</div>}
      <table className="simple-table">
        <thead><tr><th>#</th><th>Name</th><th>Team</th><th>Arrived At</th></tr></thead>
        <tbody>
          {list.map((r, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{r.devotee_name}</td>
              <td>{r.team_name}</td>
              <td className={`att-time ${attTimeStyle(r.marked_at_client)}`}>
                {new Date(r.marked_at_client).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── New Comers ──────────────────────────────────────────────────────────────
function NewComersPanel({ sessionId }) {
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
    <div>
      <h4 className="section-title">New Comers — {list.length} this session</h4>
      {list.length === 0 && <div className="empty-state">No new comers this session</div>}
      <table className="simple-table">
        <thead><tr><th>#</th><th>Name</th><th>Team</th></tr></thead>
        <tbody>{list.map((r, i) => <tr key={i}><td>{i + 1}</td><td>{r.devotee_name}</td><td>{r.team_name}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

// ── Trends ──────────────────────────────────────────────────────────────────
function TrendsPanel() {
  const { filters } = useApp();
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    DB.getTrends('weekly', filters.team).then(t => { setTrends(t); setLoading(false); });
  }, [filters.team]);
  if (loading) return <div className="loading-spinner" />;
  if (!trends.length) return <div className="empty-state">No data</div>;
  const chartData = {
    labels: trends.map(t => t.period?.slice(5)),
    datasets: [{ label: 'Attendance', data: trends.map(t => t.count), borderColor: '#f5c518', backgroundColor: 'rgba(245,197,24,.15)', tension: 0.4, fill: true, pointRadius: 5 }],
  };
  return <div className="chart-wrap"><Line data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, precision: 0 } } }} /></div>;
}

// ── Teams Report ─────────────────────────────────────────────────────────────
function TeamsPanel({ sessionId, sessionDate }) {
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
    <div>
      <h4 className="section-title">Teams Report</h4>
      <table className="simple-table">
        <thead><tr><th>Team</th><th>Total</th><th>Present</th><th>Target</th><th>%</th></tr></thead>
        <tbody>
          {report.map((r, i) => (
            <tr key={i}>
              <td><strong>{r.team}</strong></td><td>{r.total}</td><td><strong>{r.actualPresent}</strong></td><td>{r.target || '—'}</td>
              <td>{r.target ? <span className={`pct-badge pct-${r.percentage >= 80 ? 'good' : r.percentage >= 50 ? 'ok' : 'low'}`}>{r.percentage}%</span> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Accuracy Panel (calling vs attendance) ──────────────────────────────────
function AccuracyPanel({ sessionId, sessionDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [absentModal, setAbsentModal] = useState(null);
  useEffect(() => {
    if (!sessionDate) return;
    setLoading(true);
    const wd = shiftDate(sessionDate, -1);
    DB.getYesAbsentList(wd, sessionDate).then(d => { setData(d); setLoading(false); });
  }, [sessionDate]);
  if (loading) return <div className="loading-spinner" />;
  if (!data) return <div className="empty-state">No session selected</div>;
  return (
    <div>
      <h4 className="section-title">Calling Accuracy</h4>
      {!data.hasSession && <div className="locked-banner amber">⚠ Attendance not yet marked for {formatDate(sessionDate)}</div>}
      <div className="stat-card" style={{display:'inline-block',margin:'8px 0'}}>
        <div className="stat-value">{data.list?.length ?? 0}</div>
        <div className="stat-label">Said Yes · Didn't Attend</div>
      </div>
      {data.list?.length > 0 && <button className="btn-outline ml-2" onClick={() => setAbsentModal(data.list)}>View List</button>}
      <Modal open={!!absentModal} onClose={() => setAbsentModal(null)} title="Said Yes — Didn't Attend">
        <table className="simple-table">
          <thead><tr><th>#</th><th>Name</th><th>Team</th><th>Calling By</th></tr></thead>
          <tbody>{absentModal?.map((d,i) => <tr key={i}><td>{i+1}</td><td>{d.devotee_name||d.name}</td><td>{d.team_name||d.teamName}</td><td>{d.calling_by||d.callingBy||'—'}</td></tr>)}</tbody>
        </table>
      </Modal>
    </div>
  );
}

// ── Main AttendancePage — driven by activeView from context ──────────────────
export default function AttendancePage() {
  const { filters, activeView } = useApp();
  const [sessionId, setSessionId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    DB.getTodaySession().then(s => { setSessionId(s.id); setSessionDate(s.session_date); setLoading(false); });
  }, []);
  useEffect(() => {
    if (filters.sessionId) setSessionId(filters.sessionId);
    if (filters.sessionDate) setSessionDate(filters.sessionDate);
  }, [filters.sessionId, filters.sessionDate]);

  const view = activeView || 'live';

  return (
    <div className="tab-page">
      {sessionDate && (
        <div className="session-info-bar">
          <span className="session-label">Session: <strong>{formatDate(sessionDate)}</strong></span>
        </div>
      )}
      {loading ? <div className="loading-spinner" /> : (
        <>
          {view === 'live'       && <LivePanel sessionId={sessionId} sessionDate={sessionDate} />}
          {view === 'sheet'      && <SheetPanel />}
          {view === 'leaderboard'&& <LeaderboardPanel sessionId={sessionId} sessionDate={sessionDate} />}
          {view === 'teams'      && <TeamsPanel sessionId={sessionId} sessionDate={sessionDate} />}
          {view === 'newcomers'  && <NewComersPanel sessionId={sessionId} />}
          {view === 'late'       && <LateComersPanel sessionId={sessionId} />}
          {view === 'serious'    && <SeriousPanel sessionId={sessionId} sessionDate={sessionDate} />}
          {view === 'trends'     && <TrendsPanel />}
          {view === 'accuracy'   && <AccuracyPanel sessionId={sessionId} sessionDate={sessionDate} />}
        </>
      )}
    </div>
  );
}
