import React, { useEffect, useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, toLocalDateStr, shiftDate, avatarInitials, isBirthdayThisWeek } from '../utils/helpers';
import Modal from '../components/common/Modal';

const CALLING_REASONS = [
  { value: 'did_not_pick',      label: 'Did not pick',    needsDate: false, template: 'Call not picked' },
  { value: 'incoming_na',       label: 'Incoming N/A',    needsDate: false, template: 'Incoming not available / unreachable' },
  { value: 'wrong_number',      label: 'Wrong number',    needsDate: false, template: 'Wrong number — needs update' },
  { value: 'out_of_station',    label: 'Out of station',  needsDate: true,  template: 'Out of station, available from ' },
  { value: 'exams',             label: 'Exams/Study',     needsDate: true,  template: 'Exams — available from ' },
  { value: 'online_class',      label: 'Online class',    needsDate: false, template: 'Joining online' },
  { value: 'festival_calling',  label: 'Festival',        needsDate: false, template: 'Festival calling' },
  { value: 'not_interested_now',label: 'Not interested',  needsDate: false, template: 'Not interested now' },
  { value: 'other',             label: 'Other',           needsDate: false, template: '' },
];
const reasonTemplate = v => CALLING_REASONS.find(r => r.value === v)?.template || '';
const reasonLabel  = v => CALLING_REASONS.find(r => r.value === v)?.label || v || '—';
const reasonNeeds  = v => CALLING_REASONS.find(r => r.value === v)?.needsDate || false;

// ── Calling Status header card (matches original prominent banner) ─────────
function CallingStatusHeader({ cfg, weekDate, sessionDate, onDownload }) {
  if (!weekDate && !cfg) return null;
  return (
    <div className="calling-status-card">
      <div className="csc-header">
        <span className="csc-icon">📞</span>
        <span className="csc-title">Calling Status</span>
      </div>
      <div className="csc-dates">
        {weekDate && (
          <div className="csc-date-item">
            <span className="csc-date-icon">📞</span>
            <div>
              <div className="csc-date-label">Calling Day</div>
              <div className="csc-date-value">{formatDate(weekDate)}</div>
            </div>
          </div>
        )}
        {sessionDate && (
          <div className="csc-date-item">
            <span className="csc-date-icon">🪔</span>
            <div>
              <div className="csc-date-label">Session</div>
              <div className="csc-date-value">{formatDate(sessionDate)}</div>
            </div>
          </div>
        )}
      </div>
      {(cfg?.topic || cfg?.speakerName) && (
        <div className="csc-meta">
          {cfg.topic && <span>📖 {cfg.topic}</span>}
          {cfg.speakerName && <span> · 🎤 {cfg.speakerName}</span>}
          {cfg.sessionType === 'festival' && <span className="chip-festival"> · 🎉 Festival</span>}
        </div>
      )}
      <button className="btn-outline csc-download" onClick={onDownload}>
        <span style={{fontSize:'1rem'}}>📥</span> Download List
      </button>
    </div>
  );
}

// ── Calling Row ─────────────────────────────────────────────────────────────
function CallingRow({ d, locked, onChange }) {
  const timer = useRef(null);
  const id = d.devotee_id || d.id;
  const isYes = d.coming_status === 'Yes';

  function toggleComing() {
    onChange(id, { coming_status: isYes ? '' : 'Yes', calling_reason: isYes ? d.calling_reason : '', available_from: isYes ? d.available_from : '' });
  }
  function onReason(e) {
    const reason = e.target.value;
    // Auto-fill notes template ONLY if notes is empty (don't overwrite user input)
    const tmpl = reasonTemplate(reason);
    const updates = { calling_reason: reason, coming_status: '', available_from: '' };
    if (!d.calling_notes && tmpl) updates.calling_notes = tmpl;
    onChange(id, updates);
  }
  function onNotes(e) {
    clearTimeout(timer.current);
    const v = e.target.value;
    timer.current = setTimeout(() => onChange(id, { calling_notes: v }), 800);
  }

  const name = d.devotee_name || d.name || '';

  if (locked) return (
    <tr className={isYes ? 'row-confirmed' : d.calling_reason ? 'row-has-reason' : ''}>
      <td className="att-avatar">{avatarInitials(name)}</td>
      <td><strong>{name}</strong>{isBirthdayThisWeek(d.dob) && ' 🎂'}</td>
      <td>{d.mobile || '—'}</td>
      <td>{d.team_name || d.teamName || '—'}</td>
      <td>{d.calling_by || d.callingBy || '—'}</td>
      <td>
        {isYes && <span className="badge-confirmed">Coming ✓</span>}
        {!isYes && d.calling_reason && <span className="badge-reason">{reasonLabel(d.calling_reason)}</span>}
        {!isYes && !d.calling_reason && <span className="text-muted">—</span>}
        {d.calling_notes && <div className="calling-note">{d.calling_notes}</div>}
      </td>
    </tr>
  );

  return (
    <tr className={isYes ? 'row-confirmed' : d.calling_reason ? 'row-has-reason' : ''}>
      <td className="att-avatar">{avatarInitials(name)}</td>
      <td><strong>{name}</strong>{isBirthdayThisWeek(d.dob) && ' 🎂'}</td>
      <td>{d.mobile || '—'}</td>
      <td>{d.team_name || d.teamName || '—'}</td>
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
          {reasonNeeds(d.calling_reason) && (
            <input type="date" className="form-input sm" value={d.available_from || ''}
              onChange={e => onChange(id, { available_from: e.target.value })} />
          )}
          <input className="form-input sm" type="text" placeholder="Notes…"
            key={`notes-${id}-${d.calling_reason || ''}`}
            defaultValue={d.calling_notes || ''} onChange={onNotes} />
        </div>
      </td>
    </tr>
  );
}

// ── Stat drilldown modal ────────────────────────────────────────────────────
function StatDrilldownModal({ open, title, list, onClose }) {
  const [search, setSearch] = useState('');
  if (!open) return null;
  const filtered = search
    ? list.filter(d => {
        const n = (d.devotee_name || d.name || '').toLowerCase();
        const m = (d.mobile || '');
        return n.includes(search.toLowerCase()) || m.includes(search);
      })
    : list;
  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <div className="search-box mb-3">
        <input className="form-input" placeholder="Search name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="text-muted mb-3" style={{fontSize:'.8rem'}}>{filtered.length} devotee{filtered.length !== 1 ? 's' : ''}</div>
      <table className="simple-table">
        <thead><tr><th>#</th><th>Name</th><th>Mobile</th><th>Team</th><th>Calling By</th></tr></thead>
        <tbody>
          {filtered.length === 0 && <tr><td colSpan={5} className="empty-state">No devotees</td></tr>}
          {filtered.map((d, i) => (
            <tr key={d.id || d.devotee_id || i}>
              <td>{i+1}</td>
              <td><strong>{d.devotee_name || d.name}</strong></td>
              <td>{d.mobile ? <a href={`tel:${d.mobile}`}>{d.mobile}</a> : '—'}</td>
              <td>{d.team_name || d.teamName || '—'}</td>
              <td>{d.calling_by || d.callingBy || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

// ── Calls panel ─────────────────────────────────────────────────────────────
function CallsPanel({ weekDate, locked, cfg, sessionDate }) {
  const { showToast, filters } = useApp();
  const { userId, userName, userTeam, userRole } = useAuth();
  const [devotees, setDevotees] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [submission, setSubmission] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [drilldown, setDrilldown] = useState(null);
  const timers = useRef({});

  useEffect(() => { if (weekDate) load(); }, [weekDate]);

  async function load() {
    setLoading(true);
    const [{ devotees: list }, sub] = await Promise.all([
      DB.getTeamCallingStatus(weekDate, userRole, userTeam),
      DB.getMyCallingSubmission(weekDate, userId),
    ]);
    // For facilitator (serviceDevotee), show only their assigned devotees
    const filtered = userRole === 'serviceDevotee'
      ? list.filter(d => (d.calling_by || d.callingBy) === userName)
      : list;
    setDevotees(filtered); setSubmission(sub); setLoading(false);
  }

  useEffect(() => {
    let list = [...devotees];
    const q = search.toLowerCase();
    if (q) list = list.filter(d => (d.devotee_name || d.name || '').toLowerCase().includes(q) || (d.mobile || '').includes(q));
    if (statusFilter === 'confirmed')         list = list.filter(d => d.coming_status === 'Yes');
    else if (statusFilter === 'not_reached')  list = list.filter(d => ['did_not_pick','incoming_na','wrong_number'].includes(d.calling_reason));
    else if (statusFilter === 'unavailable')  list = list.filter(d => ['out_of_station','exams'].includes(d.calling_reason));
    else if (statusFilter === 'online')       list = list.filter(d => d.calling_reason === 'online_class');
    else if (statusFilter === 'not_interested') list = list.filter(d => d.calling_reason === 'not_interested_now');
    else if (statusFilter === 'not_called')   list = list.filter(d => !d.coming_status && !d.calling_reason);
    if (filters.team) list = list.filter(d => (d.team_name || d.teamName) === filters.team);
    if (filters.callingBy) list = list.filter(d => (d.calling_by || d.callingBy) === filters.callingBy);
    setFiltered(list);
  }, [devotees, search, statusFilter, filters.team, filters.callingBy]);

  function onChange(devoteeId, updates) {
    setDevotees(prev => prev.map(d => (d.devotee_id === devoteeId || d.id === devoteeId) ? { ...d, ...updates } : d));
    clearTimeout(timers.current[devoteeId]);
    timers.current[devoteeId] = setTimeout(async () => {
      const d = devotees.find(x => x.devotee_id === devoteeId || x.id === devoteeId);
      if (!d) return;
      const m = { ...d, ...updates };
      await DB.updateCallingStatus(devoteeId, weekDate, {
        coming_status: m.coming_status || '',
        calling_reason: m.calling_reason || '',
        calling_notes: m.calling_notes || '',
        available_from: m.available_from || '',
        calling_by: d.calling_by || d.callingBy || userName,
        team_name: d.team_name || d.teamName || userTeam,
        devotee_name: d.devotee_name || d.name || '',
      }, userName);
    }, 600);
  }

  async function submit() {
    await DB.submitCallingWeek(weekDate, userId, userName, userTeam);
    showToast('Calling submitted!', 'success');
    setSubmission(await DB.getMyCallingSubmission(weekDate, userId));
  }

  const stats = {
    confirmed:    devotees.filter(d => d.coming_status === 'Yes').length,
    notReached:   devotees.filter(d => ['did_not_pick','incoming_na','wrong_number'].includes(d.calling_reason)).length,
    unavailable:  devotees.filter(d => ['out_of_station','exams'].includes(d.calling_reason)).length,
    online:       devotees.filter(d => d.calling_reason === 'online_class').length,
    notInterested:devotees.filter(d => d.calling_reason === 'not_interested_now').length,
    notCalled:    devotees.filter(d => !d.coming_status && !d.calling_reason).length,
  };

  // Matches original order/labels: Confirmed · Not reached · Unavailable · Online · Not Interested · Not called
  const PILLS = [
    { key:'confirmed',     label:'Confirmed',     cls:'green',  val: stats.confirmed },
    { key:'not_reached',   label:'Not reached',   cls:'red',    val: stats.notReached },
    { key:'unavailable',   label:'Unavailable',   cls:'orange', val: stats.unavailable },
    { key:'online',        label:'Online',        cls:'blue',   val: stats.online },
    { key:'not_interested',label:'Not Interested',cls:'purple', val: stats.notInterested },
    { key:'not_called',    label:'Not called',    cls:'gray',   val: stats.notCalled },
  ];

  return (
    <div>
      <CallingStatusHeader cfg={cfg} weekDate={weekDate} sessionDate={sessionDate} onDownload={() => {
        const rows = [['Name','Mobile','Team','Calling By','Coming','Reason','Notes','Available From']];
        devotees.forEach(d => rows.push([
          d.devotee_name || d.name || '', d.mobile || '', d.team_name || d.teamName || '',
          d.calling_by || d.callingBy || '', d.coming_status || '',
          reasonLabel(d.calling_reason), d.calling_notes || '', d.available_from || '',
        ]));
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Calling List');
        XLSX.writeFile(wb, `Calling_List_${weekDate || 'unset'}.xlsx`);
      }} />
      {!weekDate && <div className="locked-banner gray">⚙ No session configured. Configure from Dashboard → ⚙ Configure Session.</div>}
      <div className="calling-stats">
        {PILLS.map(p => {
          // Compute the list for this stat for drilldown
          const matchesPill = (d) => {
            if (p.key === 'confirmed')      return d.coming_status === 'Yes';
            if (p.key === 'not_reached')    return ['did_not_pick','incoming_na','wrong_number'].includes(d.calling_reason);
            if (p.key === 'unavailable')    return ['out_of_station','exams'].includes(d.calling_reason);
            if (p.key === 'online')         return d.calling_reason === 'online_class';
            if (p.key === 'not_interested') return d.calling_reason === 'not_interested_now';
            if (p.key === 'not_called')     return !d.coming_status && !d.calling_reason;
            return false;
          };
          return (
            <div key={p.key} className="stat-pill-wrap">
              <button className={`stat-pill ${p.cls}${statusFilter === p.key ? ' active' : ''}`}
                onClick={() => setStatusFilter(f => f === p.key ? '' : p.key)}>
                {p.label}: <strong>{p.val}</strong>
              </button>
              <button className="stat-pill-drill" title="View list" onClick={() => setDrilldown({ title: p.label, list: devotees.filter(matchesPill) })}>
                ⊕
              </button>
            </div>
          );
        })}
      </div>
      <StatDrilldownModal open={!!drilldown} title={drilldown?.title} list={drilldown?.list || []} onClose={() => setDrilldown(null)} />
      <div className="calling-toolbar">
        <input className="form-input" placeholder="Search name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
        <button className="btn-outline sm" onClick={() => { setSearch(''); setStatusFilter(''); }}>Clear</button>
      </div>
      {locked && <div className="locked-banner amber">🔒 Calling list is locked — read-only view.</div>}
      {loading ? <div className="loading-spinner" /> : (
        <div className="table-scroll">
          <table className="calling-table">
            <thead>
              <tr><th></th><th>Name</th><th>Mobile</th><th>Team</th><th>Calling By</th>
                <th>Coming</th>{!locked && <th>Reason &amp; Notes</th>}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} className="empty-state">No devotees</td></tr>}
              {filtered.map(d => <CallingRow key={d.id || d.devotee_id} d={d} locked={locked} onChange={onChange} />)}
            </tbody>
          </table>
        </div>
      )}
      {!locked && userRole !== 'superAdmin' && (
        <div className="submit-bar">
          {submission
            ? <span className="submit-status">✓ Submitted {submission.submitted_at_client ? new Date(submission.submitted_at_client).toLocaleString('en-IN',{hour:'2-digit',minute:'2-digit'}) : ''}
                <button className="btn-outline sm ml-2" onClick={submit}>Re-submit</button>
              </span>
            : <button className="btn-primary" onClick={submit}>Submit Calling Week</button>}
        </div>
      )}
    </div>
  );
}

// ── Team Calling panel ──────────────────────────────────────────────────────
function TeamCallingPanel({ weekDate }) {
  const { userRole, userTeam } = useAuth();
  const { filters } = useApp();
  const [data, setData] = useState({ devotees: [], submittedCallers: new Set() });
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (weekDate) { setLoading(true); DB.getTeamCallingStatus(weekDate, userRole, userTeam).then(d => { setData(d); setLoading(false); }); } }, [weekDate, filters.team]);

  if (loading) return <div className="loading-spinner" />;
  const groups = {};
  data.devotees.forEach(d => {
    const t = d.team_name || d.teamName || 'Unknown';
    const c = d.calling_by || d.callingBy || 'Unassigned';
    if (!groups[t]) groups[t] = {};
    if (!groups[t][c]) groups[t][c] = [];
    groups[t][c].push(d);
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
                          <td>{d.coming_status === 'Yes' ? <span className="badge-confirmed">Coming ✓</span>
                              : d.calling_reason ? <span className="badge-reason">{reasonLabel(d.calling_reason)}</span>
                              : <span className="text-muted">Not called</span>}</td>
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

// ── Weekly Summary Report ───────────────────────────────────────────────────
function WeeklyReport({ weekDate }) {
  const [report, setReport] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (weekDate) { setLoading(true); DB.getCallingReport(weekDate).then(r => { setReport(r); setLoading(false); }); } }, [weekDate]);

  if (loading) return <div className="loading-spinner" />;
  const teams = Object.entries(report);
  const totals = teams.reduce((a, [, c]) => {
    Object.values(c).forEach(s => { a.called += s.called; a.yes += s.yes; a.notCalled += s.notCalled; a.came += s.came; });
    return a;
  }, { called:0, yes:0, notCalled:0, came:0 });

  function exportExcel() {
    const rows = [['Team','Coordinator','Called','Confirmed','Not Called','Attended']];
    teams.forEach(([team, callers]) => {
      Object.entries(callers).forEach(([caller, s]) => rows.push([team, caller, s.called, s.yes, s.notCalled, s.came]));
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calling Summary');
    XLSX.writeFile(wb, `Calling_Summary_${weekDate}.xlsx`);
  }

  return (
    <div>
      <div className="section-header">
        <h4 className="section-title">Weekly Report — {formatDate(weekDate)}</h4>
        <button className="btn-outline sm" onClick={exportExcel}>⬇ Excel</button>
      </div>
      {teams.length === 0 && <div className="empty-state">No submitted calling data</div>}
      <table className="simple-table">
        <thead><tr><th>Team / Coordinator</th><th>Called</th><th>Confirmed</th><th>Not Called</th><th>Attended</th></tr></thead>
        <tbody>
          {teams.map(([team, callers]) => {
            const ts = Object.values(callers).reduce((a, s) => ({ called: a.called+s.called, yes: a.yes+s.yes, notCalled: a.notCalled+s.notCalled, came: a.came+s.came }), {called:0,yes:0,notCalled:0,came:0});
            return (
              <React.Fragment key={team}>
                <tr className="team-header-row" onClick={() => setExpanded(e => ({ ...e, [team]: !e[team] }))} style={{cursor:'pointer'}}>
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

// ── Submission Report ───────────────────────────────────────────────────────
function SubmissionReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setLoading(true); DB.getSubmissionReport().then(d => { setData(d); setLoading(false); }); }, []);

  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;
  const { fourWeeks, submMap, teamRows } = data;

  function exportExcel() {
    const rows = [['Team', 'Coordinator', ...fourWeeks.map(w => w)]];
    Object.entries(teamRows).forEach(([team, members]) => {
      members.forEach(m => {
        rows.push([team, m.userName, ...fourWeeks.map(w => submMap[w]?.[m.userName] ? '✓' : '')]);
      });
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Submissions');
    XLSX.writeFile(wb, `Submission_Report_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  return (
    <div>
      <div className="section-header">
        <h4 className="section-title">Submission Report — Last 4 Weeks</h4>
        <button className="btn-outline sm" onClick={exportExcel}>⬇ Excel</button>
      </div>
      <div className="table-scroll">
        <table className="simple-table">
          <thead><tr><th>Team / Coordinator</th>{fourWeeks.map(w => <th key={w}>{w.slice(5)}</th>)}</tr></thead>
          <tbody>
            {Object.entries(teamRows).map(([team, members]) => (
              <React.Fragment key={team}>
                <tr className="team-header-row"><td colSpan={fourWeeks.length+1}><strong>{team}</strong></td></tr>
                {members.map(m => (
                  <tr key={m.userId}>
                    <td className="pl-4">{m.userName}</td>
                    {fourWeeks.map(w => (
                      <td key={w} style={{textAlign:'center'}}>
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

// ── Late Submission Report ──────────────────────────────────────────────────
function LateSubmissionReport() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const remarkTimers = useRef({});
  useEffect(() => {
    setLoading(true);
    DB.getLateSubmissionGrid(4).then(d => { setData(d); setLoading(false); });
  }, []);

  function onRemarkChange(submissionId, value) {
    if (remarkTimers.current[submissionId]) clearTimeout(remarkTimers.current[submissionId]);
    remarkTimers.current[submissionId] = setTimeout(() => DB.saveLateRemark(submissionId, value), 800);
  }

  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;

  // Find each row's most recent late week (for remarks input)
  const rowsWithLate = data.rows.map(r => {
    const lastLate = [...r.weeks].reverse().find(w => w.submitted && w.isLate);
    return { ...r, lastLate };
  });

  return (
    <div>
      <h4 className="section-title">Late Submission Tracking</h4>
      <p className="text-muted mb-3" style={{fontSize:'.78rem'}}>
        ✓ on-time (before 9 PM) · ⚠ late (after 9 PM) · — not submitted · Remarks column saves automatically
      </p>
      <div className="table-scroll">
        <table className="simple-table">
          <thead>
            <tr>
              <th>Coordinator</th>
              <th>Team</th>
              {data.weeks.map(w => <th key={w}>{w.slice(5)}</th>)}
              <th>Late</th>
              <th style={{minWidth:160}}>Remarks (latest late)</th>
            </tr>
          </thead>
          <tbody>
            {rowsWithLate.map(r => (
              <tr key={r.userId} className={r.weeks[r.weeks.length-1]?.isLate ? 'row-recent-late' : ''}>
                <td>
                  {r.role === 'teamAdmin' && <span title="Coordinator">👑 </span>}
                  <strong>{r.name}</strong>
                </td>
                <td>{r.team || '—'}</td>
                {r.weeks.map((w, i) => (
                  <td key={i} style={{textAlign:'center'}}>
                    {!w.submitted && <span className="text-muted">—</span>}
                    {w.submitted && !w.isLate && <span className="badge-submitted" title="On time">✓</span>}
                    {w.submitted && w.isLate && (
                      <span className="badge-late" title={`Late at ${new Date(w.time).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`}>⚠</span>
                    )}
                  </td>
                ))}
                <td><strong style={{color: r.lateCount > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}}>{r.lateCount}</strong></td>
                <td>
                  {r.lastLate
                    ? <input className="form-input sm" placeholder="Add note…"
                        defaultValue={r.lastLate.remarks || ''}
                        onChange={e => onRemarkChange(r.lastLate.submissionId, e.target.value)} />
                    : <span className="text-muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Calling History Grid ────────────────────────────────────────────────────
function HistoryPanel() {
  const { filters } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setLoading(true); DB.getCallingHistoryGrid(filters.team, filters.callingBy).then(d => { setData(d); setLoading(false); }); }, [filters.team, filters.callingBy]);
  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;
  const { weeks, devotees, submMap } = data;
  return (
    <div className="table-scroll">
      <table className="calling-table">
        <thead>
          <tr>
            <th className="frozen name-col">Name</th><th>Team</th><th>Calling By</th>
            {weeks.map(w => <th key={w}>{w.slice(5)}</th>)}
            <th>AT</th>
          </tr>
        </thead>
        <tbody>
          {devotees.length === 0 && <tr><td colSpan={weeks.length+4} className="empty-state">No data</td></tr>}
          {devotees.map(d => (
            <tr key={d.id}>
              <td className="frozen name-col"><strong>{d.name}</strong></td>
              <td>{d.team_name}</td>
              <td>{d.calling_by || '—'}</td>
              {weeks.map(w => <td key={w} className="cs-cell">{Object.keys(submMap[w]||{}).length ? '●' : '○'}</td>)}
              <td><strong>{d.lifetime_attendance || 0}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Not Interested ──────────────────────────────────────────────────────────
function NotInterestedPanel() {
  const { showToast } = useApp();
  const { isSuper } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setLoading(true); DB.getMgmtSeparateLists().then(all => { setList(all.notInterested || []); setLoading(false); }); }, []);
  async function restore(id) { await DB.setDevoteeCallingMode(id, 'regular'); showToast('Restored', 'success'); DB.getMgmtSeparateLists().then(all => setList(all.notInterested || [])); }
  if (loading) return <div className="loading-spinner" />;
  return (
    <div>
      <div className="list-count">{list.length} devotees</div>
      {list.length === 0 && <div className="empty-state">No devotees marked Not Interested</div>}
      <table className="simple-table">
        <thead><tr><th>#</th><th>Name</th><th>Mobile</th><th>Team</th>{isSuper && <th></th>}</tr></thead>
        <tbody>
          {list.map((d, i) => (
            <tr key={d.id}><td>{i+1}</td><td>{d.name}</td><td>{d.mobile||'—'}</td><td>{d.team_name}</td>
              {isSuper && <td><button className="btn-outline sm" onClick={() => restore(d.id)}>Restore</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main CallingPage — driven by activeView + filters from context ─────────
export default function CallingPage() {
  const { activeView, filters } = useApp();
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    DB.getCallingWeekConfig().then(c => setCfg(c || null)).catch(() => {});
  }, []);

  // Derive weekDate (Saturday) reactively from filter session OR config OR today
  const filterSessionDate = filters.sessionDate;
  const configCallingDate = cfg?.callingDate || cfg?.calling_date || '';
  const configSessionDate = cfg?.sessionDate || cfg?.session_date || '';

  // Priority: filter session → derive calling-date; otherwise use config; otherwise today
  const weekDate = filterSessionDate
    ? shiftDate(filterSessionDate, -1)
    : configCallingDate || shiftDate(toLocalDateStr(), -1);
  const sessionDateForCalls = filterSessionDate || configSessionDate;
  const today = toLocalDateStr();
  const locked = !!weekDate && today !== weekDate && today > weekDate;

  const view = activeView || 'calls';

  return (
    <div className="tab-page">
      {weekDate && (
        <div className="session-info-bar">
          <span className="session-label">
            Calling: <strong>{formatDate(weekDate)}</strong>
            {sessionDateForCalls && <> · Session: <strong>{formatDate(sessionDateForCalls)}</strong></>}
            {locked && <span className="locked-badge">🔒 Locked</span>}
          </span>
        </div>
      )}
      {view === 'calls'         && <CallsPanel weekDate={weekDate} locked={locked} cfg={cfg} sessionDate={sessionDateForCalls} />}
      {view === 'team-calling'  && <TeamCallingPanel weekDate={weekDate} />}
      {view === 'weekly'        && <WeeklyReport weekDate={weekDate} />}
      {view === 'submission'    && <SubmissionReport />}
      {view === 'late'          && <LateSubmissionReport />}
      {view === 'history'       && <HistoryPanel />}
      {view === 'not-interested'&& <NotInterestedPanel />}
    </div>
  );
}
