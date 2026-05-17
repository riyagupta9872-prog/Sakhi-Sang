// Generic activity tab — used by Books, Service, Registration, Donation pages
import React, { useEffect, useState } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { TEAMS } from '../firebase/config';
import { toLocalDateStr, formatDate, formatINR } from '../utils/helpers';
import DevoteePicker from '../components/common/DevoteePicker';

export default function ActivityTabPage({ config }) {
  const { showToast, filters } = useApp();
  const { userTeam, isSuper } = useAuth();
  const [subTab, setSubTab] = useState('log');
  const [form, setForm] = useState({
    devoteeId: '', devoteeName: '', teamName: userTeam || '', date: toLocalDateStr(),
    quantity: '', count: '', amount: '', serviceDescription: '', note: '',
  });
  const [recent, setRecent] = useState([]);
  const [report, setReport] = useState([]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadRecent(); }, [config.key]);
  useEffect(() => { if (subTab === 'reports') loadReport(); }, [subTab, rangeStart, rangeEnd, filters.team]);

  async function loadRecent() {
    const list = await DB[config.getFn]({});
    setRecent(list.slice(0, 10));
  }

  async function loadReport() {
    setLoading(true);
    const list = await DB[config.getFn]({ startDate: rangeStart, endDate: rangeEnd });
    const teamFiltered = filters.team ? list.filter(e => (e.teamName || e.team_name) === filters.team) : list;
    const byTeam = {};
    teamFiltered.forEach(e => {
      const t = e.teamName || e.team_name || 'Unknown';
      if (!byTeam[t]) byTeam[t] = { team: t, entries: [], total: 0 };
      byTeam[t].entries.push(e);
      if (config.sumField) byTeam[t].total += Number(e[config.sumField] || 0);
      else byTeam[t].total++;
    });
    setReport(Object.values(byTeam));
    setLoading(false);
  }

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSave() {
    setError('');
    const payload = { teamName: form.teamName, date: form.date };
    if (form.devoteeId) { payload.devoteeId = form.devoteeId; payload.devoteeName = form.devoteeName; }
    if (config.key === 'books') {
      if (!form.quantity || Number(form.quantity) <= 0) { setError('Quantity required'); return; }
      payload.quantity = Number(form.quantity);
    } else if (config.key === 'service') {
      if (!form.serviceDescription?.trim()) { setError('Description required'); return; }
      payload.serviceDescription = form.serviceDescription.trim();
    } else if (config.key === 'registration') {
      if (!form.count || Number(form.count) <= 0) { setError('Count required'); return; }
      payload.count = Number(form.count);
    } else if (config.key === 'donation') {
      if (!form.amount || Number(form.amount) <= 0) { setError('Amount required'); return; }
      payload.amount = Number(form.amount);
      if (form.note) payload.note = form.note;
    }
    setLoading(true);
    try {
      await DB[config.addFn](payload);
      showToast('Entry saved', 'success');
      setForm(f => ({ ...f, devoteeId: '', devoteeName: '', quantity: '', count: '', amount: '', serviceDescription: '', note: '' }));
      loadRecent();
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="tab-page">
      <div className="sub-tab-bar">
        <button className={`sub-tab-btn${subTab === 'log' ? ' active' : ''}`} onClick={() => setSubTab('log')}>Log Entry</button>
        <button className={`sub-tab-btn${subTab === 'reports' ? ' active' : ''}`} onClick={() => setSubTab('reports')}>Reports</button>
      </div>

      {subTab === 'log' && (
        <div>
          <div className="form-grid">
            {config.key !== 'donation' && (
              <div className="form-group full">
                <label className="form-label">Devotee</label>
                <DevoteePicker value={form.devoteeName} onChange={v => { setF('devoteeName', v.name); setF('devoteeId', v.id); if (v.team) setF('teamName', v.team); }} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Team</label>
              {isSuper
                ? <select className="form-select" value={form.teamName} onChange={e => setF('teamName', e.target.value)}>
                    <option value="">Select team</option>
                    {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                : <input className="form-input" value={form.teamName} readOnly />
              }
            </div>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setF('date', e.target.value)} />
            </div>
            {config.key === 'books' && (
              <div className="form-group"><label className="form-label">Quantity *</label><input className="form-input" type="number" min={1} value={form.quantity} onChange={e => setF('quantity', e.target.value)} /></div>
            )}
            {config.key === 'service' && (
              <div className="form-group full"><label className="form-label">Description *</label><textarea className="form-textarea" rows={2} value={form.serviceDescription} onChange={e => setF('serviceDescription', e.target.value)} /></div>
            )}
            {config.key === 'registration' && (
              <div className="form-group"><label className="form-label">Count *</label><input className="form-input" type="number" min={1} value={form.count} onChange={e => setF('count', e.target.value)} /></div>
            )}
            {config.key === 'donation' && (
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
                  <tr><th>Date</th><th>Devotee</th><th>Team</th><th>{config.label}</th></tr>
                </thead>
                <tbody>
                  {recent.map((e, i) => (
                    <tr key={i}>
                      <td>{formatDate(e.date)}</td>
                      <td>{e.devoteeName || e.devotee_name || '—'}</td>
                      <td>{e.teamName || e.team_name || '—'}</td>
                      <td>
                        {config.key === 'books' && `${e.quantity} books`}
                        {config.key === 'service' && (e.serviceDescription || e.service_description || '—')}
                        {config.key === 'registration' && `${e.count}`}
                        {config.key === 'donation' && formatINR(e.amount || 0)}
                      </td>
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
            <input className="form-input" type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} />
            <span className="text-muted">to</span>
            <input className="form-input" type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} />
            <button className="btn-outline" onClick={loadReport}>Load</button>
          </div>
          {loading ? <div className="loading-spinner" /> : (
            <>
              {report.length === 0 && <div className="empty-state">No data for this range</div>}
              {report.map((r, i) => (
                <div key={i} className="report-team-block">
                  <div className="report-team-header">
                    {r.team}
                    <span className="report-team-total">
                      {config.key === 'donation' ? formatINR(r.total) : `${r.total} ${config.unit}`}
                    </span>
                  </div>
                  {r.entries.map((e, j) => (
                    <div key={j} className="report-entry-row">
                      <span>{formatDate(e.date)}</span>
                      <span>{e.devoteeName || e.devotee_name || '—'}</span>
                      <span>
                        {config.key === 'books' && `${e.quantity} books`}
                        {config.key === 'service' && (e.serviceDescription || e.service_description)}
                        {config.key === 'registration' && `${e.count}`}
                        {config.key === 'donation' && formatINR(e.amount || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
