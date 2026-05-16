import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, shiftDate, snapToSunday, toLocalDateStr } from '../utils/helpers';

const CALLING_REASONS = [
  { value: 'did_not_pick', label: 'Did not pick', text: 'Call not picked' },
  { value: 'incoming_na', label: 'Incoming N/A', text: 'Phone not reachable' },
  { value: 'wrong_number', label: 'Wrong number', text: 'Wrong number' },
  { value: 'out_of_station', label: 'Out of station', needsDate: true, text: 'Will be available from' },
  { value: 'exams', label: 'Exams/Study', needsDate: true, text: 'Exams until' },
  { value: 'online_class', label: 'Online class', text: 'Joining online' },
  { value: 'festival_calling', label: 'Festival', text: 'Festival calling' },
  { value: 'not_interested_now', label: 'Not interested', text: 'Not interested now' },
  { value: 'other', label: 'Other', text: '' },
];

function CallingRow({ d, locked, onChange }) {
  const notesTimer = useRef(null);

  function toggleComing() {
    const newStatus = d.coming_status === 'Yes' ? '' : 'Yes';
    onChange(d.id, { coming_status: newStatus, calling_reason: newStatus === 'Yes' ? '' : d.calling_reason });
  }

  function onReasonChange(e) {
    const reason = e.target.value;
    onChange(d.id, { calling_reason: reason, coming_status: reason ? '' : d.coming_status, available_from: '' });
  }

  function onNotesChange(e) {
    const notes = e.target.value;
    onChange(d.id, { calling_notes: notes }, 800);
  }

  const reason = CALLING_REASONS.find(r => r.value === d.calling_reason);

  if (locked) {
    return (
      <tr className={d.coming_status === 'Yes' ? 'row-confirmed' : d.calling_reason ? 'row-has-reason' : ''}>
        <td>{d.name}</td>
        <td>{d.mobile}</td>
        <td>{d.team_name}</td>
        <td>{d.calling_by}</td>
        <td>
          {d.coming_status === 'Yes' && <span className="badge-confirmed">Coming ✓</span>}
          {d.calling_reason && !d.coming_status && <span className="badge-reason">{reason?.label || d.calling_reason}</span>}
          {!d.coming_status && !d.calling_reason && <span className="text-muted">—</span>}
        </td>
      </tr>
    );
  }

  return (
    <tr className={d.coming_status === 'Yes' ? 'row-confirmed' : d.calling_reason ? 'row-has-reason' : ''}>
      <td>{d.name}</td>
      <td>{d.mobile || '—'}</td>
      <td>{d.team_name}</td>
      <td>{d.calling_by}</td>
      <td>
        <button
          className={`coming-toggle${d.coming_status === 'Yes' ? ' active' : ''}`}
          onClick={toggleComing}
        >
          {d.coming_status === 'Yes' ? '✓ Coming' : 'Mark Yes'}
        </button>
      </td>
      <td>
        <div className="reason-cell">
          <select className="form-select sm" value={d.calling_reason || ''} onChange={onReasonChange}>
            <option value="">— Reason —</option>
            {CALLING_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {reason?.needsDate && (
            <input type="date" className="form-input sm" value={d.available_from || ''} onChange={e => onChange(d.id, { available_from: e.target.value })} />
          )}
          <input type="text" className="form-input" placeholder="Notes…" value={d.calling_notes || ''} onChange={onNotesChange} />
        </div>
      </td>
    </tr>
  );
}

// ── Calling List ──────────────────────────────────────────────────────────────
function CallingList({ weekDate, locked, sessionDate }) {
  const { showToast } = useApp();
  const { userId, userName, userTeam, userRole } = useAuth();
  const { filters } = useApp();
  const [devotees, setDevotees] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(false);
  const saveTimers = useRef({});

  useEffect(() => {
    if (!weekDate) return;
    load();
  }, [weekDate]);

  async function load() {
    setLoading(true);
    const [{ devotees: list }, sub] = await Promise.all([
      DB.getTeamCallingStatus(weekDate, userRole, userTeam),
      DB.getMyCallingSubmission(weekDate, userId),
    ]);
    setDevotees(list);
    setSubmission(sub);
    setLoading(false);
  }

  useEffect(() => {
    let list = [...devotees];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => (d.name || '').toLowerCase().includes(q) || (d.mobile || '').includes(q));
    }
    if (statusFilter === 'confirmed') list = list.filter(d => d.coming_status === 'Yes');
    else if (statusFilter === 'reason') list = list.filter(d => d.calling_reason && d.coming_status !== 'Yes');
    else if (statusFilter === 'not_called') list = list.filter(d => !d.coming_status && !d.calling_reason);
    if (filters.team) list = list.filter(d => (d.team_name || d.teamName) === filters.team);
    if (filters.callingBy) list = list.filter(d => (d.calling_by || d.callingBy) === filters.callingBy);
    setFiltered(list);
  }, [devotees, search, statusFilter, filters.team, filters.callingBy]);

  function onChange(devoteeId, updates, debounceMs = 0) {
    setDevotees(prev => prev.map(d => d.devotee_id === devoteeId || d.id === devoteeId ? { ...d, ...updates } : d));
    if (saveTimers.current[devoteeId]) clearTimeout(saveTimers.current[devoteeId]);
    saveTimers.current[devoteeId] = setTimeout(async () => {
      const d = devotees.find(x => x.devotee_id === devoteeId || x.id === devoteeId);
      if (!d) return;
      const merged = { ...d, ...updates };
      await DB.updateCallingStatus(devoteeId, weekDate, {
        coming_status: merged.coming_status || '',
        calling_reason: merged.calling_reason || '',
        calling_notes: merged.calling_notes || '',
        available_from: merged.available_from || '',
        calling_by: d.calling_by || d.callingBy || userName,
        team_name: d.team_name || d.teamName || userTeam,
        devotee_name: d.devotee_name || d.name || '',
      });
    }, debounceMs || 600);
  }

  async function doSubmit() {
    await DB.submitCallingWeek(weekDate, userId, userName, userTeam);
    showToast('Calling submitted!', 'success');
    const sub = await DB.getMyCallingSubmission(weekDate, userId);
    setSubmission(sub);
  }

  const stats = {
    confirmed: devotees.filter(d => d.coming_status === 'Yes').length,
    notCalled: devotees.filter(d => !d.coming_status && !d.calling_reason).length,
    hasReason: devotees.filter(d => d.calling_reason && d.coming_status !== 'Yes').length,
  };

  return (
    <div>
      <div className="calling-stats">
        <button className={`stat-pill green${statusFilter === 'confirmed' ? ' active' : ''}`} onClick={() => setStatusFilter(f => f === 'confirmed' ? '' : 'confirmed')}>
          ✓ Confirmed: {stats.confirmed}
        </button>
        <button className={`stat-pill orange${statusFilter === 'reason' ? ' active' : ''}`} onClick={() => setStatusFilter(f => f === 'reason' ? '' : 'reason')}>
          ⚠ Reason: {stats.hasReason}
        </button>
        <button className={`stat-pill gray${statusFilter === 'not_called' ? ' active' : ''}`} onClick={() => setStatusFilter(f => f === 'not_called' ? '' : 'not_called')}>
          ○ Not called: {stats.notCalled}
        </button>
      </div>

      <div className="search-box my-3">
        <input className="form-input" placeholder="Search name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div className="loading-spinner" /> : (
        <div className="table-scroll">
          <table className="calling-table">
            <thead>
              <tr>
                <th>Name</th><th>Mobile</th><th>Team</th><th>Calling By</th>
                <th>Coming</th>
                {!locked && <th>Reason &amp; Notes</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={6} className="empty-state">No devotees</td></tr>}
              {filtered.map(d => (
                <CallingRow key={d.id || d.devotee_id} d={d} locked={locked} onChange={onChange} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Submit bar */}
      {!locked && (
        <div className="submit-bar">
          {submission ? (
            <div className="submit-status">
              ✓ Submitted {submission.submitted_at_client ? new Date(submission.submitted_at_client).toLocaleString('en-IN') : ''}
              <button className="btn-outline sm ml-2" onClick={doSubmit}>Re-submit</button>
            </div>
          ) : (
            <button className="btn-primary" onClick={doSubmit}>Submit Calling Week</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Calling Reports ────────────────────────────────────────────────────────────
function CallingReports({ weekDate }) {
  const [report, setReport] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!weekDate) return;
    setLoading(true);
    DB.getCallingReport(weekDate).then(r => { setReport(r); setLoading(false); });
  }, [weekDate]);

  if (loading) return <div className="loading-spinner" />;

  return (
    <div className="report-section">
      <h3 className="section-title">Calling Summary — {weekDate}</h3>
      {Object.keys(report).length === 0 && <div className="empty-state">No data for this week</div>}
      {Object.entries(report).map(([team, callers]) => (
        <div key={team} className="report-team-block">
          <div className="report-team-header">{team}</div>
          <table className="simple-table">
            <thead><tr><th>Coordinator</th><th>Called</th><th>Yes</th><th>Not Called</th><th>Came</th></tr></thead>
            <tbody>
              {Object.entries(callers).map(([caller, stats]) => (
                <tr key={caller}>
                  <td>{caller}</td>
                  <td>{stats.called}</td>
                  <td>{stats.yes}</td>
                  <td>{stats.notCalled}</td>
                  <td>{stats.came}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

// ── Calling History ────────────────────────────────────────────────────────────
function CallingHistory() {
  const { filters } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    DB.getCallingHistoryGrid(filters.team, filters.callingBy).then(d => { setData(d); setLoading(false); });
  }, [filters.team, filters.callingBy]);

  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;

  const { weeks, devotees, submMap } = data;

  return (
    <div className="table-scroll">
      <table className="calling-table">
        <thead>
          <tr>
            <th className="frozen name-col">Name</th>
            <th>Team</th>
            {weeks.map(w => <th key={w}>{w.slice(5)}</th>)}
          </tr>
        </thead>
        <tbody>
          {devotees.slice(0, 100).map(d => (
            <tr key={d.id}>
              <td className="frozen name-col">{d.name}</td>
              <td>{d.team_name}</td>
              {weeks.map(w => {
                const sub = submMap[w]?.[d.calling_by || d.callingBy];
                return <td key={w} className="cs-cell">{sub ? '●' : '○'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main CallingPage ──────────────────────────────────────────────────────────
export default function CallingPage() {
  const { filters } = useApp();
  const [subTab, setSubTab] = useState('list');
  const [config, setConfig] = useState(null);
  const [weekDate, setWeekDate] = useState('');
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    DB.getCallingWeekConfig().then(cfg => {
      if (cfg) {
        setConfig(cfg);
        setWeekDate(cfg.callingDate || cfg.calling_date || '');
        const now = toLocalDateStr();
        setLocked(now > (cfg.callingDate || cfg.calling_date || ''));
      }
    });
  }, []);

  return (
    <div className="tab-page">
      <div className="sub-tab-bar">
        {['list','reports','history'].map(t => (
          <button key={t} className={`sub-tab-btn${subTab === t ? ' active' : ''}`} onClick={() => setSubTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {config && (
        <div className="session-info-bar">
          <span className="session-label">
            Calling: <strong>{formatDate(weekDate)}</strong>
            {config.topic && ` · Topic: ${config.topic}`}
            {locked && <span className="locked-badge">🔒 Locked</span>}
          </span>
        </div>
      )}

      {subTab === 'list' && <CallingList weekDate={weekDate} locked={locked} sessionDate={config?.sessionDate || config?.session_date} />}
      {subTab === 'reports' && <CallingReports weekDate={weekDate} />}
      {subTab === 'history' && <CallingHistory />}
    </div>
  );
}
