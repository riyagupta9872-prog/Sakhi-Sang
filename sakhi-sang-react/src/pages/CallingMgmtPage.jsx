import React, { useEffect, useState } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { avatarInitials, formatDate } from '../utils/helpers';

// ── Calling List (4-week grid) ─────────────────────────────────────────────
function CallingListPanel() {
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

  return (
    <div className="table-scroll">
      <table className="calling-table">
        <thead>
          <tr>
            <th className="frozen name-col">Name</th>
            <th>Team</th>
            <th>Calling By</th>
            {weeks.map(w => <th key={w}>{w.slice(5)}</th>)}
            <th>Total AT</th>
          </tr>
        </thead>
        <tbody>
          {devotees.length === 0 && <tr><td colSpan={6 + weeks.length} className="empty-state">No devotees</td></tr>}
          {devotees.slice(0, 100).map(d => (
            <tr key={d.id}>
              <td className="frozen name-col"><strong>{d.name}</strong></td>
              <td>{d.team_name}</td>
              <td>{d.calling_by || '—'}</td>
              {weeks.map(w => {
                const submitted = submMap[w] && Object.keys(submMap[w]).length > 0;
                return (
                  <td key={w} className={`cs-cell${submitted ? ' submitted' : ''}`}>
                    {submitted ? '●' : '○'}
                  </td>
                );
              })}
              <td><strong>{d.lifetime_attendance || 0}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Separate lists (Online / Festival / Not Interested) ────────────────────
function SeparateListPanel({ listKey, label, canRestore }) {
  const { showToast } = useApp();
  const { isSuper } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const all = await DB.getMgmtSeparateLists();
    setList(all[listKey] || []);
    setLoading(false);
  }

  async function restore(devoteeId) {
    await DB.setDevoteeCallingMode(devoteeId, 'regular');
    showToast('Restored to regular calling', 'success');
    load();
  }

  if (loading) return <div className="loading-spinner" />;

  return (
    <div>
      <div className="list-count">{list.length} devotees</div>
      {list.length === 0
        ? <div className="empty-state">No devotees in {label}</div>
        : list.map(d => (
            <div key={d.id} className="devotee-item">
              <div className="devotee-avatar sm">{avatarInitials(d.name)}</div>
              <div className="devotee-body">
                <div className="devotee-name">{d.name}</div>
                <div className="devotee-meta">
                  {d.team_name && <span className="badge badge-team">{d.team_name}</span>}
                  {d.mobile && <span>{d.mobile}</span>}
                </div>
              </div>
              {canRestore && isSuper && (
                <button className="btn-outline sm" onClick={() => restore(d.id)}>Restore</button>
              )}
              {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon" onClick={e => e.stopPropagation()}>📞</a>}
            </div>
          ))
      }
    </div>
  );
}

// ── New Comers in Calling ──────────────────────────────────────────────────
function NewComersPanel() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    DB.getCareNewcomers().then(l => { setList(l); setLoading(false); });
  }, []);

  if (loading) return <div className="loading-spinner" />;

  return (
    <div>
      {list.length === 0 ? <div className="empty-state">No new comers this week</div> : (
        list.map(d => (
          <div key={d.id} className="devotee-item">
            <div className="devotee-avatar sm">{avatarInitials(d.name)}</div>
            <div className="devotee-body">
              <div className="devotee-name">{d.name}</div>
              <div className="devotee-meta">
                {d.team_name && <span className="badge badge-team">{d.team_name}</span>}
                {d.mobile && <span>{d.mobile}</span>}
              </div>
            </div>
            {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon">📞</a>}
          </div>
        ))
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
const SUB_TABS = [
  { id: 'calling',       label: 'Calling List' },
  { id: 'newcomers',     label: 'New Comers' },
  { id: 'online',        label: 'Online Class' },
  { id: 'notinterested', label: 'Not Interested' },
  { id: 'festival',      label: 'Festival Calling' },
];

export default function CallingMgmtPage() {
  const [subTab, setSubTab] = useState('calling');

  return (
    <div className="tab-page">
      <div className="sub-tab-bar">
        {SUB_TABS.map(t => (
          <button key={t.id} className={`sub-tab-btn${subTab === t.id ? ' active' : ''}`} onClick={() => setSubTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'calling'       && <CallingListPanel />}
      {subTab === 'newcomers'     && <NewComersPanel />}
      {subTab === 'online'        && <SeparateListPanel listKey="online"       label="Online Class"    canRestore />}
      {subTab === 'notinterested' && <SeparateListPanel listKey="notInterested" label="Not Interested" canRestore />}
      {subTab === 'festival'      && <SeparateListPanel listKey="festival"      label="Festival Calling" canRestore />}
    </div>
  );
}
