import React, { useEffect, useState } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { avatarInitials } from '../utils/helpers';

function CallingListPanel() {
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
          <tr><th className="frozen name-col">Name</th><th>Team</th><th>Calling By</th>
            {weeks.map(w => <th key={w}>{w.slice(5)}</th>)}<th>AT</th></tr>
        </thead>
        <tbody>
          {devotees.length === 0 && <tr><td colSpan={weeks.length+4} className="empty-state">No data</td></tr>}
          {devotees.map(d => (
            <tr key={d.id}>
              <td className="frozen name-col"><strong>{d.name}</strong></td>
              <td>{d.team_name}</td><td>{d.calling_by||'—'}</td>
              {weeks.map(w => <td key={w} className="cs-cell">{Object.keys(submMap[w]||{}).length?'●':'○'}</td>)}
              <td><strong>{d.lifetime_attendance||0}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeparateListPanel({ listKey, canRestore }) {
  const { showToast } = useApp();
  const { isSuper } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setLoading(true); DB.getMgmtSeparateLists().then(all => { setList(all[listKey]||[]); setLoading(false); }); }, [listKey]);
  async function restore(id) { await DB.setDevoteeCallingMode(id,'regular'); showToast('Restored','success'); DB.getMgmtSeparateLists().then(all => setList(all[listKey]||[])); }
  if (loading) return <div className="loading-spinner" />;
  return (
    <div>
      <div className="list-count">{list.length} devotees</div>
      {list.length === 0 && <div className="empty-state">No devotees in this list</div>}
      {list.map(d => (
        <div key={d.id} className="devotee-item">
          <div className="devotee-avatar sm">{avatarInitials(d.name)}</div>
          <div className="devotee-body">
            <div className="devotee-name">{d.name}</div>
            <div className="devotee-meta">{d.team_name && <span className="badge badge-team">{d.team_name}</span>}{d.mobile && <span>{d.mobile}</span>}</div>
          </div>
          {canRestore && isSuper && <button className="btn-outline sm" onClick={() => restore(d.id)}>Restore</button>}
          {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon">📞</a>}
        </div>
      ))}
    </div>
  );
}

function NewComersPanel() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setLoading(true); DB.getCareNewcomers().then(l => { setList(l); setLoading(false); }); }, []);
  if (loading) return <div className="loading-spinner" />;
  return (
    <div>
      {list.length === 0 && <div className="empty-state">No new comers this week</div>}
      {list.map(d => (
        <div key={d.id} className="devotee-item">
          <div className="devotee-avatar sm">{avatarInitials(d.name)}</div>
          <div className="devotee-body">
            <div className="devotee-name">{d.name}</div>
            <div className="devotee-meta">{d.team_name && <span className="badge badge-team">{d.team_name}</span>}{d.mobile && <span>{d.mobile}</span>}</div>
          </div>
          {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon">📞</a>}
        </div>
      ))}
    </div>
  );
}

export default function CallingMgmtPage() {
  const { activeView } = useApp();
  const view = activeView || 'calling';
  return (
    <div className="tab-page">
      {view === 'calling'       && <CallingListPanel />}
      {view === 'newcomers'     && <NewComersPanel />}
      {view === 'online'        && <SeparateListPanel listKey="online"        canRestore />}
      {view === 'notinterested' && <SeparateListPanel listKey="notInterested" canRestore />}
      {view === 'festival'      && <SeparateListPanel listKey="festival"      canRestore />}
    </div>
  );
}
