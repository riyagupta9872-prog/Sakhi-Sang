import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, toLocalDateStr, shiftDate, snapToSunday, avatarInitials, isBirthdayThisWeek } from '../utils/helpers';
import Modal from '../components/common/Modal';

const CALLING_REASONS = [
  { value: 'did_not_pick',      label: 'Did not pick',     needsDate: false },
  { value: 'incoming_na',       label: 'Incoming N/A',     needsDate: false },
  { value: 'wrong_number',      label: 'Wrong number',     needsDate: false },
  { value: 'out_of_station',    label: 'Out of station',   needsDate: true  },
  { value: 'exams',             label: 'Exams/Study',      needsDate: true  },
  { value: 'online_class',      label: 'Online class',     needsDate: false },
  { value: 'festival_calling',  label: 'Festival calling', needsDate: false },
  { value: 'not_interested_now',label: 'Not interested',   needsDate: false },
  { value: 'other',             label: 'Other',            needsDate: false },
];

function reasonLabel(v) { return CALLING_REASONS.find(r => r.value === v)?.label || v || '—'; }
function reasonNeedsDate(v) { return CALLING_REASONS.find(r => r.value === v)?.needsDate || false; }

// ── Session info chip ──────────────────────────────────────────────────────
function SessionChip({ cfg, sessionDate }) {
  if (!cfg) return null;
  return (
    <div className="session-info-chip">
      {cfg.topic && <span className="chip-topic">📖 {cfg.topic}</span>}
      {cfg.speakerName && <span className="chip-speaker"> · {cfg.speakerName}</span>}
      {sessionDate && <span className="chip-date"> · {formatDate(sessionDate)}</span>}
      {cfg.sessionType === 'festival' && <span className="chip-festival"> 🎉 Festival</span>}
    </div>
  );
}

// ── Calling row ────────────────────────────────────────────────────────────
function CallingRow({ d, locked, onChange }) {
  const notesTimer = useRef(null);

  function toggleComing() {
    const next = d.coming_status === 'Yes' ? '' : 'Yes';
    onChange(d.devotee_id || d.id, { coming_status: next, calling_reason: next === 'Yes' ? '' : d.calling_reason });
  }
  function onReason(e) {
    onChange(d.devotee_id || d.id, { calling_reason: e.target.value, coming_status: '', available_from: '' });
  }
  function onNotes(e) {
    if (notesTimer.current) clearTimeout(notesTimer.current);
    const v = e.target.value;
    notesTimer.current = setTimeout(() => onChange(d.devotee_id || d.id, { calling_notes: v }), 800);
  }

  const name = d.devotee_name || d.name || '';
  const isYes = d.coming_status === 'Yes';

  if (locked) return (
    <tr className={isYes ? 'row-confirmed' : d.calling_reason ? 'row-has-reason' : ''}>
      <td>{avatarInitials(name)}</td>
      <td><strong>{name}</strong></td>
      <td>{d.mobile || '—'}</td>
      <td>{d.team_name || d.teamName}</td>
      <td>{d.calling_by || d.callingBy || '—'}</td>
      <td>
        {isYes && <span className="badge-confirmed">Coming ✓</span>}
        {!isYes && d.calling_reason && <span className="badge-reason">{reasonLabel(d.calling_reason)}</span>}
        {!isYes && !d.calling_reason && <span className="text-muted">—</span>}
      </td>
    </tr>
  );

  return (
    <tr className={isYes ? 'row-confirmed' : d.calling_reason ? 'row-has-reason' : ''}>
      <td>{avatarInitials(name)}</td>
      <td>
        <strong>{name}</strong>
        {isBirthdayThisWeek(d.dob) && <span title="Birthday this week"> 🎂</span>}
      </td>
      <td>{d.mobile || '—'}</td>
      <td>{d.team_name || d.teamName}</td>
      <td>{d.calling_by || d.callingBy || '—'}</td>
      <td>
        <button className={`coming-toggle${isYes ? ' active' : ''}`} onClick={toggleComing}>
          {isYes ? '✓ Coming' : 'Mark Yes'}
        </button>
      </td>
      <td>
        <div className="reason-cell">
          <select className="form-select sm" value={d.calling_reason || ''} onChange={onReason}>
            <option value="">— Reason —</option>
            {CALLING_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {reasonNeedsDate(d.calling_reason) && (
            <input type="date" className="form-input sm" value={d.available_from || ''}
              onChange={e => onChange(d.devotee_id || d.id, { available_from: e.target.value })} />
          )}
          <input type="text" className="form-input sm" placeholder="Notes…"
            defaultValue={d.calling_notes || ''} onChange={onNotes} />
        </div>
      </td>
    </tr>
  );
}

// ── Calls Panel (personal calling list) ───────────────────────────────────
function CallsPanel({ weekDate, locked, cfg, sessionDate }) {
  const { showToast } = useApp();
  const { userId, userName, userTeam, userRole } = useAuth();
  const { filters } = useApp();
  const [devotees, setDevotees] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const saveTimers = useRef({});

  useEffect(() => { if (weekDate) load(); }, [weekDate]);

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
    if (search) { const q = search.toLowerCase(); list = list.filter(d => (d.devotee_name || d.name || '').toLowerCase().includes(q) || (d.mobile || '').includes(q)); }
    if (statusFilter === 'confirmed') list = list.filter(d => d.coming_status === 'Yes');
    else if (statusFilter === 'reason') list = list.filter(d => d.calling_reason && d.coming_status !== 'Yes');
    else if (statusFilter === 'not_called') list = list.filter(d => !d.coming_status && !d.calling_reason);
    if (filters.team) list = list.filter(d => (d.team_name || d.teamName) === filters.team);
    if (filters.callingBy) list = list.filter(d => (d.calling_by || d.callingBy) === filters.callingBy);
    setFiltered(list);
  }, [devotees, search, statusFilter, filters.team, filters.callingBy]);

  function onChange(devoteeId, updates) {
    setDevotees(prev => prev.map(d => (d.devotee_id === devoteeId || d.id === devoteeId) ? { ...d, ...updates } : d));
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
    }, 600);
  }

  async function doSubmit() {
    await DB.submitCallingWeek(weekDate, userId, userName, userTeam);
    showToast('Calling submitted!', 'success');
    const sub = await DB.getMyCallingSubmission(weekDate, userId);
    setSubmission(sub);
  }

  const stats = {
    confirmed: devotees.filter(d => d.coming_status === 'Yes').length,
    notReached: devotees.filter(d => ['did_not_pick','incoming_na','wrong_number'].includes(d.calling_reason)).length,
    unavailable: devotees.filter(d => ['out_of_station','exams'].includes(d.calling_reason)).length,
    online: devotees.filter(d => d.calling_reason === 'online_class').length,
    festival: devotees.filter(d => d.calling_reason === 'festival_calling').length,
    notInterested: devotees.filter(d => d.calling_reason === 'not_interested_now').length,
    notCalled: devotees.filter(d => !d.coming_status && !d.calling_reason).length,
  };

  return (
    <div>
      <SessionChip cfg={cfg} sessionDate={sessionDate} />

      {!weekDate && <div className="locked-banner gray">⚙ Calling dates not configured yet. Please configure from Dashboard.</div>}

      {/* Stats pills */}
      <div className="calling-stats">
        {[
          { key: 'confirmed',    label: 'Confirmed',      cls: 'green',  val: stats.confirmed },
          { key: 'not_reached',  label: 'Not reached',    cls: 'red',    val: stats.notReached },
          { key: 'unavailable',  label: 'Unavailable',    cls: 'orange', val: stats.unavailable },
          { key: 'online',       label: 'Online',         cls: 'blue',   val: stats.online },
          { key: 'festival',     label: 'Festival',       cls: 'purple', val: stats.festival },
          { key: 'not_called',   label: 'Not called',     cls: 'gray',   val: stats.notCalled },
        ].map(s => (
          <button key={s.key}
            className={`stat-pill ${s.cls}${statusFilter === s.key ? ' active' : ''}`}
            onClick={() => setStatusFilter(f => f === s.key ? '' : s.key)}>
            {s.label}: <strong>{s.val}</strong>
          </button>
        ))}
      </div>

      {/* Search + filter */}
      <div className="calling-toolbar">
        <input className="form-input" placeholder="Search name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn-outline sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>Clear</button>
      </div>

      {/* Locked banner */}
      {locked && <div className="locked-banner amber">🔒 Calling list is locked. Showing read-only view.</div>}

      {loading ? <div className="loading-spinner" /> : (
        <div className="table-scroll">
          <table className="calling-table">
            <thead>
              <tr><th></th><th>Name</th><th>Mobile</th><th>Team</th><th>Calling By</th><th>Coming</th>{!locked && <th>Reason & Notes</th>}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="empty-state">No devotees</td></tr>}
              {filtered.map(d => <CallingRow key={d.id || d.devotee_id} d={d} locked={locked} onChange={onChange} />)}
            </tbody>
          </table>
        </div>
      )}

      {/* Submit bar */}
      {!locked && userRole !== 'superAdmin' && (
        <div className="submit-bar">
          {submission ? (
            <span className="submit-status">
              ✓ Submitted {submission.submitted_at_client ? new Date(submission.submitted_at_client).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
              <button className="btn-outline sm ml-2" onClick={doSubmit}>Re-submit</button>
            </span>
          ) : (
            <button className="btn-primary" onClick={doSubmit}>Submit Calling Week</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Team Calling Panel ─────────────────────────────────────────────────────
function TeamCallingPanel({ weekDate }) {
  const { userRole, userTeam } = useAuth();
  const { filters } = useApp();
  const [data, setData] = useState({ devotees: [], submittedCallers: new Set() });
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (weekDate) load(); }, [weekDate, filters.team]);

  async function load() {
    setLoading(true);
    const d = await DB.getTeamCallingStatus(weekDate, userRole, userTeam);
    setData(d);
    setLoading(false);
  }

  if (loading) return <div className="loading-spinner" />;

  // Group by team → caller
  const groups = {};
  data.devotees.forEach(d => {
    const team = d.team_name || d.teamName || 'Unknown';
    const caller = d.calling_by || d.callingBy || 'Unassigned';
    if (!groups[team]) groups[team] = {};
    if (!groups[team][caller]) groups[team][caller] = [];
    groups[team][caller].push(d);
  });

  return (
    <div>
      {Object.keys(groups).length === 0 && <div className="empty-state">No calling data for this week</div>}
      {Object.entries(groups).map(([team, callers]) => (
        <div key={team} className="team-calling-block">
          <div className="team-calling-header">{team}</div>
          {Object.entries(callers).map(([caller, devs]) => {
            const confirmed = devs.filter(d => d.coming_status === 'Yes').length;
            const submitted = data.submittedCallers.has(caller);
            return (
              <div key={caller} className="caller-block">
                <div className="caller-header">
                  <strong>{caller}</strong>
                  <span className="text-muted ml-2">{devs.length} devotees · {confirmed} confirmed</span>
                  {submitted && <span className="badge-submitted ml-2">✓ Submitted</span>}
                </div>
                <div className="table-scroll">
                  <table className="calling-table sm">
                    <thead><tr><th>Name</th><th>Mobile</th><th>Status</th><th>Notes</th></tr></thead>
                    <tbody>
                      {devs.map(d => (
                        <tr key={d.id || d.devotee_id} className={d.coming_status === 'Yes' ? 'row-confirmed' : d.calling_reason ? 'row-has-reason' : ''}>
                          <td>{d.devotee_name || d.name}</td>
                          <td>{d.mobile || '—'}</td>
                          <td>
                            {d.coming_status === 'Yes' && <span className="badge-confirmed">Coming ✓</span>}
                            {d.calling_reason && d.coming_status !== 'Yes' && <span className="badge-reason">{reasonLabel(d.calling_reason)}</span>}
                            {!d.coming_status && !d.calling_reason && <span className="text-muted">Not called</span>}
                          </td>
                          <td className="text-muted">{d.calling_notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Calling Summary Report ─────────────────────────────────────────────────
function SummaryReport({ weekDate }) {
  const [report, setReport] = useState({});
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});

  useEffect(() => { if (weekDate) load(); }, [weekDate]);

  async function load() {
    setLoading(true);
    const r = await DB.getCallingReport(weekDate);
    setReport(r);
    setLoading(false);
  }

  if (loading) return <div className="loading-spinner" />;

  const teams = Object.entries(report);
  const totals = { called: 0, yes: 0, notCalled: 0, came: 0 };
  teams.forEach(([, callers]) => Object.values(callers).forEach(s => {
    totals.called += s.called; totals.yes += s.yes; totals.notCalled += s.notCalled; totals.came += s.came;
  }));

  return (
    <div>
      <h4 className="section-title">Calling Summary — {formatDate(weekDate)}</h4>
      {teams.length === 0 && <div className="empty-state">No submitted calling data for this week</div>}
      <table className="simple-table">
        <thead>
          <tr><th>Team / Coordinator</th><th>Called</th><th>Confirmed</th><th>Not Called</th><th>Attended</th></tr>
        </thead>
        <tbody>
          {teams.map(([team, callers]) => {
            const ts = Object.values(callers).reduce((a, s) => ({
              called: a.called + s.called, yes: a.yes + s.yes, notCalled: a.notCalled + s.notCalled, came: a.came + s.came
            }), { called: 0, yes: 0, notCalled: 0, came: 0 });
            return (
              <React.Fragment key={team}>
                <tr className="team-header-row" onClick={() => setExpanded(e => ({ ...e, [team]: !e[team] }))} style={{ cursor: 'pointer' }}>
                  <td><strong>{expanded[team] ? '▾' : '▸'} {team}</strong></td>
                  <td>{ts.called}</td><td>{ts.yes}</td><td>{ts.notCalled}</td><td>{ts.came}</td>
                </tr>
                {expanded[team] && Object.entries(callers).map(([caller, s]) => (
                  <tr key={caller} className="caller-detail-row">
                    <td className="pl-4">· {caller}</td>
                    <td>{s.called}</td><td>{s.yes}</td><td>{s.notCalled}</td><td>{s.came}</td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
          {teams.length > 0 && (
            <tr className="grand-total-row">
              <td><strong>Grand Total</strong></td>
              <td><strong>{totals.called}</strong></td><td><strong>{totals.yes}</strong></td>
              <td><strong>{totals.notCalled}</strong></td><td><strong>{totals.came}</strong></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Accuracy Report ────────────────────────────────────────────────────────
function AccuracyReport({ weekDate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [absentModal, setAbsentModal] = useState(null);

  useEffect(() => { if (weekDate) load(); }, [weekDate]);

  async function load() {
    setLoading(true);
    const sessionDate = shiftDate(weekDate, 1);
    const d = await DB.getYesAbsentList(weekDate, sessionDate);
    setData(d);
    setLoading(false);
  }

  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;

  return (
    <div>
      <h4 className="section-title">Calling Accuracy — {formatDate(weekDate)}</h4>
      {!data.hasSession && <div className="locked-banner amber">⚠ Session attendance not yet marked for {formatDate(shiftDate(weekDate, 1))}</div>}
      <div className="stat-card" style={{ display: 'inline-block', margin: '8px 0' }}>
        <div className="stat-value">{data.list?.length ?? 0}</div>
        <div className="stat-label">Said Yes · Didn't Attend</div>
      </div>
      {data.list?.length > 0 && (
        <button className="btn-outline ml-2" onClick={() => setAbsentModal(data.list)}>View List</button>
      )}
      <Modal open={!!absentModal} onClose={() => setAbsentModal(null)} title="Said Yes — Didn't Attend">
        <table className="simple-table">
          <thead><tr><th>#</th><th>Name</th><th>Team</th><th>Calling By</th></tr></thead>
          <tbody>
            {absentModal?.map((d, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{d.devotee_name || d.name}</td>
                <td>{d.team_name || d.teamName}</td>
                <td>{d.calling_by || d.callingBy || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    </div>
  );
}

// ── Submission Report ──────────────────────────────────────────────────────
function SubmissionReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setLoading(true);
    DB.getSubmissionReport().then(d => { setData(d); setLoading(false); });
  }, []);
  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;
  const { fourWeeks, submMap, teamRows } = data;
  return (
    <div>
      <h4 className="section-title">Submission Report</h4>
      <div className="table-scroll">
        <table className="simple-table">
          <thead>
            <tr><th>Team / Coordinator</th>{fourWeeks.map(w => <th key={w}>{w.slice(5)}</th>)}</tr>
          </thead>
          <tbody>
            {Object.entries(teamRows).map(([team, members]) => (
              <React.Fragment key={team}>
                <tr className="team-header-row"><td colSpan={fourWeeks.length + 1}><strong>{team}</strong></td></tr>
                {members.map(m => (
                  <tr key={m.userId}>
                    <td className="pl-4">{m.userName}</td>
                    {fourWeeks.map(w => (
                      <td key={w} style={{ textAlign: 'center' }}>
                        {submMap[w]?.[m.userName] ? <span className="badge-submitted">✓</span> : <span className="text-muted">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reports Panel ──────────────────────────────────────────────────────────
function ReportsPanel({ weekDate }) {
  const [reportType, setReportType] = useState('summary');
  return (
    <div>
      <div className="report-type-toggle">
        <button className={`btn-outline sm${reportType === 'summary' ? ' active-toggle' : ''}`} onClick={() => setReportType('summary')}>Weekly Summary</button>
        <button className={`btn-outline sm${reportType === 'accuracy' ? ' active-toggle' : ''}`} onClick={() => setReportType('accuracy')}>Calling Accuracy</button>
        <button className={`btn-outline sm${reportType === 'submissions' ? ' active-toggle' : ''}`} onClick={() => setReportType('submissions')}>Submissions</button>
      </div>
      {reportType === 'summary'     && <SummaryReport weekDate={weekDate} />}
      {reportType === 'accuracy'    && <AccuracyReport weekDate={weekDate} />}
      {reportType === 'submissions' && <SubmissionReport />}
    </div>
  );
}

// ── Calling History Grid ───────────────────────────────────────────────────
function HistoryPanel() {
  const { filters } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, [filters.team, filters.callingBy]);

  async function load() {
    setLoading(true);
    const d = await DB.getCallingHistoryGrid(filters.team, filters.callingBy);
    setData(d);
    setLoading(false);
  }

  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;
  const { weeks, devotees, submMap } = data;

  function cellContent(d, w) {
    const statusRec = Object.values(submMap[w] || {});
    const submitted = statusRec.length > 0;
    return submitted ? '●' : '○';
  }

  return (
    <div className="table-scroll">
      <table className="calling-table">
        <thead>
          <tr>
            <th className="frozen name-col">Name</th>
            <th>Team</th>
            <th>Calling By</th>
            {weeks.map(w => <th key={w}>{w.slice(5)}</th>)}
            <th>AT</th>
          </tr>
        </thead>
        <tbody>
          {devotees.length === 0 && <tr><td colSpan={weeks.length + 4} className="empty-state">No data</td></tr>}
          {devotees.map(d => (
            <tr key={d.id}>
              <td className="frozen name-col"><strong>{d.name}</strong></td>
              <td>{d.team_name}</td>
              <td>{d.calling_by || '—'}</td>
              {weeks.map(w => <td key={w} className="cs-cell">{cellContent(d, w)}</td>)}
              <td><strong>{d.lifetime_attendance || 0}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Not Interested Panel ───────────────────────────────────────────────────
function NotInterestedPanel() {
  const { showToast } = useApp();
  const { isSuper } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);
  async function load() {
    setLoading(true);
    const all = await DB.getMgmtSeparateLists();
    setList(all.notInterested || []);
    setLoading(false);
  }
  async function restore(id) {
    await DB.setDevoteeCallingMode(id, 'regular');
    showToast('Restored', 'success');
    load();
  }

  if (loading) return <div className="loading-spinner" />;
  return (
    <div>
      <div className="list-count">{list.length} devotees</div>
      {list.length === 0 && <div className="empty-state">No devotees marked Not Interested</div>}
      <table className="simple-table">
        <thead><tr><th>#</th><th>Name</th><th>Mobile</th><th>Team</th>{isSuper && <th></th>}</tr></thead>
        <tbody>
          {list.map((d, i) => (
            <tr key={d.id}>
              <td>{i + 1}</td>
              <td>{d.name}</td>
              <td>{d.mobile || '—'}</td>
              <td>{d.team_name}</td>
              {isSuper && <td><button className="btn-outline sm" onClick={() => restore(d.id)}>Restore</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main CallingPage ───────────────────────────────────────────────────────
const SUB_TABS = [
  { id: 'calls',          label: 'Calls' },
  { id: 'team-calling',   label: 'Team Calling' },
  { id: 'reports',        label: 'Reports' },
  { id: 'history',        label: 'Calling History' },
  { id: 'not-interested', label: 'Not Interested' },
];

export default function CallingPage() {
  const { filters } = useApp();
  const [subTab, setSubTab] = useState('calls');
  const [cfg, setCfg] = useState(null);
  const [weekDate, setWeekDate] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [locked, setLocked] = useState(true);

  useEffect(() => {
    DB.getCallingWeekConfig().then(c => {
      if (!c) return;
      setCfg(c);
      const wd = c.callingDate || c.calling_date || '';
      const sd = c.sessionDate || c.session_date || '';
      setWeekDate(wd);
      setSessionDate(sd);
      const today = toLocalDateStr();
      setLocked(today !== wd && today > wd);
    });
  }, []);

  // sync session from master filter
  useEffect(() => {
    if (filters.sessionDate && cfg) {
      const wd = shiftDate(filters.sessionDate, -1);
      setWeekDate(wd);
      setSessionDate(filters.sessionDate);
      const today = toLocalDateStr();
      setLocked(today !== wd);
    }
  }, [filters.sessionDate, cfg]);

  return (
    <div className="tab-page">
      <div className="sub-tab-bar">
        {SUB_TABS.map(t => (
          <button key={t.id} className={`sub-tab-btn${subTab === t.id ? ' active' : ''}`} onClick={() => setSubTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {weekDate && (
        <div className="session-info-bar">
          <span className="session-label">
            Calling: <strong>{formatDate(weekDate)}</strong>
            {sessionDate && <> · Session: <strong>{formatDate(sessionDate)}</strong></>}
            {locked && <span className="locked-badge">🔒 Locked</span>}
          </span>
        </div>
      )}

      {subTab === 'calls'          && <CallsPanel weekDate={weekDate} locked={locked} cfg={cfg} sessionDate={sessionDate} />}
      {subTab === 'team-calling'   && <TeamCallingPanel weekDate={weekDate} />}
      {subTab === 'reports'        && <ReportsPanel weekDate={weekDate} />}
      {subTab === 'history'        && <HistoryPanel />}
      {subTab === 'not-interested' && <NotInterestedPanel />}
    </div>
  );
}
