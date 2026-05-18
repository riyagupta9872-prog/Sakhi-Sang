import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from '../common/Modal';
import { DB } from '../../firebase/db';
import { formatDate, formatINR, getFYYears } from '../../utils/helpers';
import DevoteePicker from '../common/DevoteePicker';

// Period helper — returns YYYY-MM-DD start & end for given month / fiscal year
function monthRange(year, month) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const last = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { start, end };
}

// ── Monthly Reports ─────────────────────────────────────────────────────────
export function MonthlyReports({ open, onClose }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { start, end } = monthRange(year, month);
    const [att, books, services, regs, donations] = await Promise.all([
      // get all session attendance in range
      DB.getSessions().then(async sessions => {
        const inRange = sessions.filter(s => s.session_date >= start && s.session_date <= end);
        const all = await Promise.all(inRange.map(s => DB.getSessionAttendance(s.id)));
        return { sessionCount: inRange.length, present: all.reduce((sum, r) => sum + r.length, 0) };
      }),
      DB.getBookDistributions({ startDate: start, endDate: end }),
      DB.getServices({ startDate: start, endDate: end }),
      DB.getRegistrations({ startDate: start, endDate: end }),
      DB.getDonations({ startDate: start, endDate: end }),
    ]);
    setData({
      attendance: att,
      books: books.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
      services: services.length,
      registrations: regs.reduce((s, r) => s + (Number(r.count) || 0), 0),
      donations: donations.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    });
    setLoading(false);
  }
  useEffect(() => { if (open) load(); }, [open, year, month]);

  function exportExcel() {
    if (!data) return;
    const rows = [['Metric', 'Value']];
    rows.push(['Period', `${monthName(month)} ${year}`]);
    rows.push(['Sessions held', data.attendance.sessionCount]);
    rows.push(['Total Attendance', data.attendance.present]);
    rows.push(['Books distributed', data.books]);
    rows.push(['Service entries', data.services]);
    rows.push(['Registrations', data.registrations]);
    rows.push(['Donations (₹)', data.donations]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly');
    XLSX.writeFile(wb, `Monthly_Report_${year}_${String(month + 1).padStart(2, '0')}.xlsx`);
  }

  return (
    <Modal open={open} onClose={onClose} title="📅 Monthly Reports" size="md">
      <div className="report-controls">
        <select className="form-select sm" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {Array.from({length:12}).map((_, i) => <option key={i} value={i}>{monthName(i)}</option>)}
        </select>
        <select className="form-select sm" value={year} onChange={e => setYear(Number(e.target.value))}>
          {Array.from({length:5}).map((_, i) => { const y = today.getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
        </select>
        {data && <button className="btn-outline sm" onClick={exportExcel}>⬇ Excel</button>}
      </div>
      {loading ? <div className="loading-spinner" /> : data && (
        <div className="kpi-grid">
          <KPI label="Sessions" value={data.attendance.sessionCount} icon="📅" />
          <KPI label="Total Attendance" value={data.attendance.present} icon="✓" />
          <KPI label="Books" value={data.books} icon="📚" />
          <KPI label="Services" value={data.services} icon="🤲" />
          <KPI label="Registrations" value={data.registrations} icon="📋" />
          <KPI label="Donations" value={formatINR(data.donations)} icon="💰" />
        </div>
      )}
    </Modal>
  );
}

// ── FY Reports ──────────────────────────────────────────────────────────────
export function FYReports({ open, onClose }) {
  const years = getFYYears();
  const [idx, setIdx] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const y = years[idx];
    const [sessions, books, services, regs, donations] = await Promise.all([
      DB.getSessions(),
      DB.getBookDistributions({ startDate: y.startDate, endDate: y.endDate }),
      DB.getServices({ startDate: y.startDate, endDate: y.endDate }),
      DB.getRegistrations({ startDate: y.startDate, endDate: y.endDate }),
      DB.getDonations({ startDate: y.startDate, endDate: y.endDate }),
    ]);
    const inRange = sessions.filter(s => s.session_date >= y.startDate && s.session_date <= y.endDate);
    const att = await Promise.all(inRange.map(s => DB.getSessionAttendance(s.id)));
    const present = att.reduce((sum, r) => sum + r.length, 0);
    setData({
      year: y.label,
      sessions: inRange.length,
      present,
      books: books.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
      services: services.length,
      registrations: regs.reduce((s, r) => s + (Number(r.count) || 0), 0),
      donations: donations.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    });
    setLoading(false);
  }
  useEffect(() => { if (open) load(); }, [open, idx]);

  function exportExcel() {
    if (!data) return;
    const rows = [['Metric', 'Value']];
    rows.push(['Fiscal Year', data.year]);
    rows.push(['Sessions held', data.sessions]);
    rows.push(['Total Attendance', data.present]);
    rows.push(['Books distributed', data.books]);
    rows.push(['Service entries', data.services]);
    rows.push(['Registrations', data.registrations]);
    rows.push(['Donations (₹)', data.donations]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FY');
    XLSX.writeFile(wb, `FY_${data.year}_Report.xlsx`);
  }

  return (
    <Modal open={open} onClose={onClose} title="📊 Fiscal Year Reports" size="md">
      <div className="report-controls">
        <select className="form-select sm" value={idx} onChange={e => setIdx(Number(e.target.value))}>
          {years.map((y, i) => <option key={i} value={i}>FY {y.label} (Apr–Mar)</option>)}
        </select>
        {data && <button className="btn-outline sm" onClick={exportExcel}>⬇ Excel</button>}
      </div>
      {loading ? <div className="loading-spinner" /> : data && (
        <div className="kpi-grid">
          <KPI label="Sessions" value={data.sessions} icon="📅" />
          <KPI label="Total Attendance" value={data.present} icon="✓" />
          <KPI label="Books" value={data.books} icon="📚" />
          <KPI label="Services" value={data.services} icon="🤲" />
          <KPI label="Registrations" value={data.registrations} icon="📋" />
          <KPI label="Donations" value={formatINR(data.donations)} icon="💰" />
        </div>
      )}
    </Modal>
  );
}

// ── Individual Reports ──────────────────────────────────────────────────────
export function IndividualReports({ open, onClose }) {
  const [selected, setSelected] = useState({ name: '', id: '' });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!selected.id) return;
    setLoading(true);
    const [devotee, callingHist, profileHist, teamHist] = await Promise.all([
      DB.getDevotee(selected.id),
      DB.getCallingHistory(selected.id, 12),
      DB.getProfileHistory(selected.id),
      DB.getTeamChangeHistory(selected.id),
    ]);
    setReport({ devotee, callingHist, profileHist, teamHist });
    setLoading(false);
  }
  useEffect(() => { if (selected.id) load(); }, [selected.id]);

  function exportExcel() {
    if (!report?.devotee) return;
    const d = report.devotee;
    const wb = XLSX.utils.book_new();
    const profile = [
      ['Field', 'Value'],
      ['Name', d.name], ['Mobile', d.mobile], ['DOB', d.dob], ['Email', d.email],
      ['Team', d.team_name], ['Status', d.devotee_status],
      ['Joined', d.joining_date], ['Lifetime Attendance', d.lifetime_attendance],
      ['Reference', d.reference_by], ['Calling By', d.calling_by],
      ['Chanting Rounds', d.chanting_rounds],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(profile), 'Profile');

    const callingRows = [['Week', 'Coming', 'Reason', 'Notes', 'Available From']];
    report.callingHist.forEach(h => {
      callingRows.push([h.week_date, h.coming_status || '', h.calling_reason || '', h.calling_notes || '', h.available_from || '']);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(callingRows), 'Calling History');

    XLSX.writeFile(wb, `Individual_${d.name.replace(/\s+/g, '_')}.xlsx`);
  }

  return (
    <Modal open={open} onClose={onClose} title="👤 Individual Report" size="lg">
      <div className="form-group full">
        <label className="form-label">Select Devotee</label>
        <DevoteePicker value={selected.name} onChange={v => setSelected({ name: v.name, id: v.id })} />
      </div>

      {loading && <div className="loading-spinner" />}
      {!loading && report?.devotee && (
        <div>
          <div className="section-header">
            <h4 className="section-title">{report.devotee.name}</h4>
            <button className="btn-outline sm" onClick={exportExcel}>⬇ Excel</button>
          </div>
          <div className="kpi-grid">
            <KPI label="Lifetime AT" value={report.devotee.lifetime_attendance || 0} icon="✓" />
            <KPI label="Chanting" value={`${report.devotee.chanting_rounds || 0}/day`} icon="📿" />
            <KPI label="Team" value={report.devotee.team_name || '—'} icon="👥" />
            <KPI label="Status" value={report.devotee.devotee_status || '—'} icon="⭐" />
          </div>
          <h4 className="form-label" style={{marginTop:14}}>Recent Calling History</h4>
          {report.callingHist.length === 0 ? <div className="empty-state">No calling history</div> :
            <table className="simple-table">
              <thead><tr><th>Week</th><th>Coming</th><th>Reason</th><th>Notes</th></tr></thead>
              <tbody>
                {report.callingHist.map((h, i) => (
                  <tr key={i}>
                    <td>{formatDate(h.week_date)}</td>
                    <td>{h.coming_status === 'Yes' ? <span className="badge-confirmed">✓</span> : '—'}</td>
                    <td>{h.calling_reason || '—'}</td>
                    <td className="text-muted">{h.calling_notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        </div>
      )}
    </Modal>
  );
}

function KPI({ label, value, icon }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon">{icon}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

function monthName(m) {
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m];
}
