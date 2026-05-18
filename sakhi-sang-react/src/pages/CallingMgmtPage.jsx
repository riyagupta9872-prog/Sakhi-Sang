import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { avatarInitials } from '../utils/helpers';

// Bulk action toolbar
function BulkBar({ selected, onClear, onAction }) {
  if (selected.size === 0) return null;
  return (
    <div className="bulk-bar">
      <span><strong>{selected.size}</strong> selected</span>
      <button className="btn-outline sm" onClick={() => onAction('online')}>→ Online</button>
      <button className="btn-outline sm" onClick={() => onAction('festival')}>→ Festival</button>
      <button className="btn-outline sm" onClick={() => onAction('not_interested')}>→ Not Interested</button>
      <button className="btn-outline sm" onClick={() => onAction('regular')}>→ Regular</button>
      <button className="btn-icon" onClick={onClear} title="Clear selection">✕</button>
    </div>
  );
}

// ── Calling List with 4-week grid ──────────────────────────────────────────
function CallingListPanel() {
  const { filters, showToast } = useApp();
  const { isSuper } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());

  async function load() {
    setLoading(true);
    const d = await DB.getCallingHistoryGrid(filters.team, filters.callingBy);
    setData(d); setLoading(false);
  }
  useEffect(() => { load(); }, [filters.team, filters.callingBy]);

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkAction(mode) {
    if (!confirm(`Move ${selected.size} devotees to "${mode}" mode?`)) return;
    for (const id of selected) await DB.setDevoteeCallingMode(id, mode);
    showToast(`${selected.size} devotees updated`, 'success');
    setSelected(new Set());
    load();
  }

  function exportExcel() {
    if (!data) return;
    const { weeks, devotees, submMap } = data;
    const header = ['Name', 'Team', 'Calling By', ...weeks, 'Lifetime AT'];
    const rows = devotees.map(d => [
      d.name, d.team_name, d.calling_by || '—',
      ...weeks.map(w => Object.keys(submMap[w]||{}).length ? '●' : '○'),
      d.lifetime_attendance || 0,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calling List');
    XLSX.writeFile(wb, `Calling_List_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  if (loading) return <div className="loading-spinner" />;
  if (!data) return null;
  const { weeks, devotees, submMap } = data;

  return (
    <div>
      <div className="section-header">
        <span className="text-muted">{devotees.length} devotees</span>
        <div style={{display:'flex',gap:6}}>
          {isSuper && selected.size > 0 && (
            <button className="btn-outline sm" onClick={() => setSelected(new Set(devotees.map(d => d.id)))}>Select All</button>
          )}
          <button className="btn-outline sm" onClick={exportExcel}>⬇ Excel</button>
        </div>
      </div>

      <div className="table-scroll">
        <table className="calling-table">
          <thead>
            <tr>
              {isSuper && <th style={{width:34}}></th>}
              <th className="frozen name-col">Name</th>
              <th>Team</th>
              <th>Calling By</th>
              {weeks.map(w => <th key={w}>{w.slice(5)}</th>)}
              <th>AT</th>
            </tr>
          </thead>
          <tbody>
            {devotees.length === 0 && <tr><td colSpan={weeks.length + 5} className="empty-state">No data</td></tr>}
            {devotees.map(d => (
              <tr key={d.id} className={selected.has(d.id) ? 'row-selected' : ''}>
                {isSuper && (
                  <td><input type="checkbox" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} /></td>
                )}
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

      <BulkBar selected={selected} onClear={() => setSelected(new Set())} onAction={bulkAction} />
    </div>
  );
}

// ── Separate list panel (Online / Festival / Not Interested) ───────────────
function SeparateListPanel({ listKey, canRestore }) {
  const { showToast } = useApp();
  const { isSuper } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const all = await DB.getMgmtSeparateLists();
    setList(all[listKey] || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [listKey]);

  async function restore(id) { await DB.setDevoteeCallingMode(id, 'regular'); showToast('Restored', 'success'); load(); }

  function exportExcel() {
    const rows = [['Name','Mobile','Team','Calling By','Joined']];
    list.forEach(d => rows.push([d.name, d.mobile || '', d.team_name || '', d.calling_by || '', d.joining_date || '']));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, listKey);
    XLSX.writeFile(wb, `${listKey}_${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  if (loading) return <div className="loading-spinner" />;

  return (
    <div>
      <div className="section-header">
        <span className="text-muted">{list.length} devotees</span>
        {list.length > 0 && <button className="btn-outline sm" onClick={exportExcel}>⬇ Excel</button>}
      </div>
      {list.length === 0 && <div className="empty-state">No devotees in this list</div>}
      {list.map(d => (
        <div key={d.id} className="devotee-item">
          <div className="devotee-avatar sm">{avatarInitials(d.name)}</div>
          <div className="devotee-body">
            <div className="devotee-name">{d.name}</div>
            <div className="devotee-meta">
              {d.team_name && <span className="badge badge-team">{d.team_name}</span>}
              {d.mobile && <span>{d.mobile}</span>}
              {d.calling_by && <span>· {d.calling_by}</span>}
            </div>
          </div>
          {canRestore && isSuper && <button className="btn-outline sm" onClick={() => restore(d.id)}>Restore</button>}
          {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon" onClick={e => e.stopPropagation()}>📞</a>}
          {d.mobile && <a href={`https://wa.me/91${d.mobile}`} className="btn-icon" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>💬</a>}
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
      <div className="section-header"><span className="text-muted">{list.length} new this week</span></div>
      {list.length === 0 && <div className="empty-state">No new comers this week</div>}
      {list.map(d => (
        <div key={d.id} className="devotee-item">
          <div className="devotee-avatar sm">{avatarInitials(d.name)}</div>
          <div className="devotee-body">
            <div className="devotee-name">{d.name}</div>
            <div className="devotee-meta">{d.team_name && <span className="badge badge-team">{d.team_name}</span>}{d.mobile && <span>{d.mobile}</span>}</div>
          </div>
          {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon">📞</a>}
          {d.mobile && <a href={`https://wa.me/91${d.mobile}`} className="btn-icon" target="_blank" rel="noreferrer">💬</a>}
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
