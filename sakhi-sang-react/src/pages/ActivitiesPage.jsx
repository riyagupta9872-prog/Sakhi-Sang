import React, { useEffect, useState, useCallback } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { TEAMS } from '../firebase/config';
import { toLocalDateStr, formatDate, formatINR } from '../utils/helpers';
import DevoteePicker from '../components/common/DevoteePicker';

const ACTIVITIES = [
  { key: 'books', label: 'Book Distribution', icon: '📚', addFn: 'addBookDistribution', getFn: 'getBookDistributions', sumField: 'quantity', unit: 'books' },
  { key: 'service', label: 'Service', icon: '🤲', addFn: 'addService', getFn: 'getServices', sumField: null, unit: 'entries' },
  { key: 'registration', label: 'Registration', icon: '📋', addFn: 'addRegistration', getFn: 'getRegistrations', sumField: 'count', unit: 'registrations' },
  { key: 'donation', label: 'Donation', icon: '💰', addFn: 'addDonation', getFn: 'getDonations', sumField: 'amount', unit: '₹' },
];

function ActivityModule({ activity }) {
  const { showToast } = useApp();
  const { userTeam, userName, isSuper } = useAuth();
  const { filters } = useApp();
  const [subTab, setSubTab] = useState('log');
  const [form, setForm] = useState({ devoteeId: '', devoteeName: '', teamName: userTeam || '', date: toLocalDateStr(), quantity: '', count: '', amount: '', serviceDescription: '', note: '' });
  const [recent, setRecent] = useState([]);
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');

  useEffect(() => {
    loadRecent();
  }, [activity.key]);

  useEffect(() => {
    if (subTab === 'reports') loadReport();
  }, [subTab, rangeStart, rangeEnd, filters.team]);

  async function loadRecent() {
    const list = await DB[activity.getFn]({});
    setRecent(list.slice(0, 10));
  }

  async function loadReport() {
    setLoading(true);
    const list = await DB[activity.getFn]({ startDate: rangeStart, endDate: rangeEnd });
    const teamFiltered = filters.team ? list.filter(e => e.teamName === filters.team || e.team_name === filters.team) : list;

    const byTeam = {};
    teamFiltered.forEach(e => {
      const t = e.teamName || e.team_name || 'Unknown';
      if (!byTeam[t]) byTeam[t] = { team: t, entries: [], total: 0 };
      byTeam[t].entries.push(e);
      if (activity.sumField) byTeam[t].total += Number(e[activity.sumField] || 0);
      else byTeam[t].total++;
    });
    setReport(Object.values(byTeam));
    setLoading(false);
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setError('');
    const payload = {
      teamName: form.teamName,
      date: form.date,
      ...(form.devoteeId && { devoteeId: form.devoteeId, devoteeName: form.devoteeName }),
    };

    if (activity.key === 'books') {
      if (!form.quantity || Number(form.quantity) <= 0) { setError('Quantity required'); return; }
      payload.quantity = Number(form.quantity);
    } else if (activity.key === 'service') {
      if (!form.serviceDescription?.trim()) { setError('Description required'); return; }
      payload.serviceDescription = form.serviceDescription.trim();
    } else if (activity.key === 'registration') {
      if (!form.count || Number(form.count) <= 0) { setError('Count required'); return; }
      payload.count = Number(form.count);
    } else if (activity.key === 'donation') {
      if (!form.amount || Number(form.amount) <= 0) { setError('Amount required'); return; }
      payload.amount = Number(form.amount);
      if (form.note) payload.note = form.note;
    }

    setLoading(true);
    try {
      await DB[activity.addFn](payload);
      showToast('Entry saved', 'success');
      setForm(f => ({ ...f, devoteeId: '', devoteeName: '', quantity: '', count: '', amount: '', serviceDescription: '', note: '' }));
      loadRecent();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="activity-module">
      <div className="activity-header">
        <span className="activity-icon">{activity.icon}</span>
        <h3>{activity.label}</h3>
      </div>

      <div className="sub-tab-bar sm">
        <button className={`sub-tab-btn${subTab === 'log' ? ' active' : ''}`} onClick={() => setSubTab('log')}>Log Entry</button>
        <button className={`sub-tab-btn${subTab === 'reports' ? ' active' : ''}`} onClick={() => setSubTab('reports')}>Reports</button>
      </div>

      {subTab === 'log' && (
        <div>
          <div className="form-grid">
            {activity.key !== 'donation' && (
              <div className="form-group full">
                <label className="form-label">Devotee</label>
                <DevoteePicker
                  value={form.devoteeName}
                  onChange={v => { setF('devoteeName', v.name); setF('devoteeId', v.id); setF('teamName', v.team || form.teamName); }}
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Team</label>
              {isSuper ? (
                <select className="form-select" value={form.teamName} onChange={e => setF('teamName', e.target.value)}>
                  <option value="">Select team</option>
                  {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              ) : (
                <input className="form-input" value={form.teamName} readOnly />
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setF('date', e.target.value)} />
            </div>

            {activity.key === 'books' && (
              <div className="form-group"><label className="form-label">Quantity *</label><input className="form-input" type="number" min={1} value={form.quantity} onChange={e => setF('quantity', e.target.value)} /></div>
            )}
            {activity.key === 'service' && (
              <div className="form-group full"><label className="form-label">Description *</label><textarea className="form-textarea" rows={2} value={form.serviceDescription} onChange={e => setF('serviceDescription', e.target.value)} /></div>
            )}
            {activity.key === 'registration' && (
              <div className="form-group"><label className="form-label">Count *</label><input className="form-input" type="number" min={1} value={form.count} onChange={e => setF('count', e.target.value)} /></div>
            )}
            {activity.key === 'donation' && (
              <>
                <div className="form-group"><label className="form-label">Amount (₹) *</label><input className="form-input" type="number" min={1} value={form.amount} onChange={e => setF('amount', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Note</label><input className="form-input" value={form.note} onChange={e => setF('note', e.target.value)} /></div>
              </>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}
          <button className="btn-primary mt-2" onClick={handleSave} disabled={loading}>{loading ? 'Saving…' : 'Save Entry'}</button>

          {recent.length > 0 && (
            <div className="recent-entries">
              <h4 className="recent-title">Recent Entries</h4>
              <table className="simple-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Devotee</th><th>Team</th>
                    {activity.sumField && <th>{activity.label}</th>}
                    {activity.key === 'service' && <th>Description</th>}
                    {activity.key === 'donation' && <th>Amount</th>}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((e, i) => (
                    <tr key={i}>
                      <td>{formatDate(e.date)}</td>
                      <td>{e.devoteeName || e.devotee_name || '—'}</td>
                      <td>{e.teamName || e.team_name || '—'}</td>
                      {activity.key === 'books' && <td>{e.quantity}</td>}
                      {activity.key === 'service' && <td>{e.serviceDescription || e.service_description || '—'}</td>}
                      {activity.key === 'registration' && <td>{e.count}</td>}
                      {activity.key === 'donation' && <td>{formatINR(e.amount || 0)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === 'reports' && (
        <div>
          <div className="report-controls">
            <input className="form-input" type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} placeholder="Start" />
            <span>to</span>
            <input className="form-input" type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} placeholder="End" />
            <button className="btn-outline" onClick={loadReport}>Load</button>
          </div>

          {loading ? <div className="loading-spinner" /> : (
            <div>
              {report.length === 0 && <div className="empty-state">No data for this range</div>}
              {report.map((r, i) => (
                <div key={i} className="report-team-block">
                  <div className="report-team-header">
                    {r.team}
                    <span className="report-team-total">
                      {activity.key === 'donation' ? formatINR(r.total) : `${r.total} ${activity.unit}`}
                    </span>
                  </div>
                  <div className="report-team-entries">
                    {r.entries.map((e, j) => (
                      <div key={j} className="report-entry-row">
                        <span>{formatDate(e.date)}</span>
                        <span>{e.devoteeName || e.devotee_name || '—'}</span>
                        <span>
                          {activity.key === 'books' && `${e.quantity} books`}
                          {activity.key === 'service' && (e.serviceDescription || e.service_description || '—')}
                          {activity.key === 'registration' && `${e.count} registrations`}
                          {activity.key === 'donation' && formatINR(e.amount || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ActivitiesPage() {
  const [activeActivity, setActiveActivity] = useState('books');
  const activity = ACTIVITIES.find(a => a.key === activeActivity);

  return (
    <div className="tab-page">
      <div className="activities-nav">
        {ACTIVITIES.map(a => (
          <button
            key={a.key}
            className={`activity-nav-btn${activeActivity === a.key ? ' active' : ''}`}
            onClick={() => setActiveActivity(a.key)}
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
      </div>

      <ActivityModule activity={activity} />
    </div>
  );
}
