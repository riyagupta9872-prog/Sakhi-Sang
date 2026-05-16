import React, { useEffect, useState, useRef, useCallback } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatINR, getFYYears, shiftDate, snapToSunday, toLocalDateStr } from '../utils/helpers';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// ── Dashboard KPIs ─────────────────────────────────────────────────────────────
function Dashboard() {
  const { filters } = useApp();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
  }, [filters.sessionId, filters.team]);

  async function load() {
    setLoading(true);
    const sessions = await DB.getSessions();
    const session = sessions.find(s => s.id === filters.sessionId) || sessions[0];
    if (!session) { setLoading(false); return; }

    // Activity window: the week of the session
    const sat = shiftDate(session.session_date, -1);
    const sun = shiftDate(session.session_date, -7);

    const [att, books, services, registrations, donations, teams] = await Promise.all([
      DB.getSessionAttendance(session.id),
      DB.getBookDistributions({ startDate: sun, endDate: sat }),
      DB.getServices({ startDate: sun, endDate: sat }),
      DB.getRegistrations({ startDate: sun, endDate: sat }),
      DB.getDonations({ startDate: sun, endDate: sat }),
      DB.getTeamsReport(sat, session.id),
    ]);

    setData({
      session,
      present: att.length,
      booksQty: books.reduce((s, b) => s + (Number(b.quantity) || 0), 0),
      servicesCount: services.length,
      registrationsCount: registrations.reduce((s, r) => s + (Number(r.count) || 0), 0),
      donationsTotal: donations.reduce((s, d) => s + (Number(d.amount) || 0), 0),
      teams,
    });
    setLoading(false);
  }

  if (loading) return <div className="loading-spinner" />;
  if (!data) return <div className="empty-state">No data available</div>;

  return (
    <div>
      <div className="dashboard-kpis">
        <div className="kpi-card"><div className="kpi-value">{data.present}</div><div className="kpi-label">Present</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.booksQty}</div><div className="kpi-label">Books Distributed</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.servicesCount}</div><div className="kpi-label">Services</div></div>
        <div className="kpi-card"><div className="kpi-value">{data.registrationsCount}</div><div className="kpi-label">Registrations</div></div>
        <div className="kpi-card"><div className="kpi-value">{formatINR(data.donationsTotal)}</div><div className="kpi-label">Donations</div></div>
      </div>

      <h3 className="section-title mt-4">Team Performance</h3>
      <table className="dashboard-table">
        <thead>
          <tr><th>Team</th><th>Total</th><th>Present</th><th>Target</th><th>%</th></tr>
        </thead>
        <tbody>
          {data.teams.map((t, i) => (
            <tr key={i}>
              <td className="dt-team">{t.team}</td>
              <td>{t.total}</td>
              <td><strong>{t.actualPresent}</strong></td>
              <td>{t.target || '—'}</td>
              <td>
                <div className="pct-bar-wrap">
                  <div className="pct-bar" style={{ width: `${Math.min(t.percentage, 100)}%`, background: t.percentage >= 80 ? 'var(--color-success)' : t.percentage >= 50 ? '#f59e0b' : 'var(--color-danger)' }} />
                  <span className="pct-text">{t.target ? `${t.percentage}%` : '—'}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Trends Chart ───────────────────────────────────────────────────────────────
function TrendsChart() {
  const { filters } = useApp();
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    DB.getTrends('weekly', filters.team).then(t => { setTrends(t); setLoading(false); });
  }, [filters.team]);

  if (loading) return <div className="loading-spinner" />;
  if (!trends.length) return <div className="empty-state">No trend data</div>;

  const chartData = {
    labels: trends.map(t => t.period?.slice(5) || t.period),
    datasets: [{
      label: 'Attendance',
      data: trends.map(t => t.count),
      borderColor: '#c8860a',
      backgroundColor: 'rgba(200,134,10,0.15)',
      tension: 0.4,
      fill: true,
      pointRadius: 4,
    }],
  };

  const options = {
    responsive: true,
    plugins: { legend: { display: false }, title: { display: false } },
    scales: { y: { beginAtZero: true, precision: 0 } },
  };

  return (
    <div className="chart-wrap">
      <Line data={chartData} options={options} />
    </div>
  );
}

// ── Care section ──────────────────────────────────────────────────────────────
function CareSection() {
  const { filters } = useApp();
  const [care, setCare] = useState({ absentThisWeek: [], absentPast2Weeks: [], inactive: [], newcomers: [], birthdays: [] });
  const [loading, setLoading] = useState(false);
  const [openCard, setOpenCard] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      DB.getCareAbsent(),
      DB.getCareInactive(),
      DB.getCareNewcomers(),
      DB.getCareBirthdays(),
    ]).then(([absent, inactive, newcomers, birthdays]) => {
      setCare({ ...absent, inactive, newcomers, birthdays });
      setLoading(false);
    });
  }, []);

  const cards = [
    { id: 'absentThisWeek', label: 'Absent This Week', list: care.absentThisWeek, color: '#dc2626' },
    { id: 'absentPast2Weeks', label: 'Absent 2+ Weeks', list: care.absentPast2Weeks, color: '#d97706' },
    { id: 'inactive', label: 'Inactive (3+ sessions)', list: care.inactive, color: '#6b7280' },
    { id: 'newcomers', label: 'New This Week', list: care.newcomers, color: '#16a34a' },
    { id: 'birthdays', label: 'Birthdays This Week 🎂', list: care.birthdays, color: '#7c3aed' },
  ];

  if (loading) return <div className="loading-spinner" />;

  return (
    <div>
      <div className="care-grid">
        {cards.map(c => (
          <div key={c.id} className="care-card" style={{ borderColor: c.color }} onClick={() => setOpenCard(openCard === c.id ? null : c.id)}>
            <div className="care-count" style={{ color: c.color }}>{c.list.length}</div>
            <div className="care-label">{c.label}</div>
          </div>
        ))}
      </div>

      {openCard && (
        <div className="care-list-wrap">
          <h4 className="care-list-title">{cards.find(c => c.id === openCard)?.label}</h4>
          {cards.find(c => c.id === openCard)?.list.slice(0, 50).map(d => (
            <div key={d.id} className="care-devotee-row">
              <strong>{d.name}</strong>
              <span className="text-muted">{d.team_name}</span>
              {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon sm">📞</a>}
              {d.calling_by && <span className="text-muted">· {d.calling_by}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Submission Report ──────────────────────────────────────────────────────────
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
    <div className="table-scroll">
      <table className="simple-table">
        <thead>
          <tr>
            <th>Team / Coordinator</th>
            {fourWeeks.map(w => <th key={w}>{w.slice(5)}</th>)}
          </tr>
        </thead>
        <tbody>
          {Object.entries(teamRows).map(([team, members]) => (
            <React.Fragment key={team}>
              <tr className="team-header-row"><td colSpan={fourWeeks.length + 1}><strong>{team}</strong></td></tr>
              {members.map(m => (
                <tr key={m.userId}>
                  <td className="pl-4">{m.userName}</td>
                  {fourWeeks.map(w => (
                    <td key={w}>
                      {submMap[w]?.[m.userName]
                        ? <span className="badge-submitted">✓</span>
                        : <span className="text-muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main AnalyticsPage ─────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [subTab, setSubTab] = useState('dashboard');

  const SUB_TABS = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'trends', label: 'Trends' },
    { id: 'care', label: 'Care' },
    { id: 'submissions', label: 'Submissions' },
  ];

  return (
    <div className="tab-page">
      <div className="sub-tab-bar">
        {SUB_TABS.map(t => (
          <button key={t.id} className={`sub-tab-btn${subTab === t.id ? ' active' : ''}`} onClick={() => setSubTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'dashboard' && <Dashboard />}
      {subTab === 'trends' && <TrendsChart />}
      {subTab === 'care' && <CareSection />}
      {subTab === 'submissions' && <SubmissionReport />}
    </div>
  );
}
