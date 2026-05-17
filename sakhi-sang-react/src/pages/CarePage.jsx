import React, { useEffect, useState } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';

const CATEGORIES = [
  { id: 'absentThisWeek',  label: 'Absent This Week',      color: '#dc2626' },
  { id: 'absentPast2Weeks',label: 'Absent 2+ Weeks',       color: '#d97706' },
  { id: 'inactive',        label: 'Inactive (3+ sessions)', color: '#6b7280' },
  { id: 'newcomers',       label: 'New This Week',          color: '#16a34a' },
  { id: 'birthdays',       label: 'Birthdays This Week 🎂', color: '#7c3aed' },
];

export default function CarePage() {
  const { filters } = useApp();
  const [care, setCare] = useState({ absentThisWeek: [], absentPast2Weeks: [], inactive: [], newcomers: [], birthdays: [] });
  const [loading, setLoading] = useState(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => { load(); }, [filters.team]);

  async function load() {
    setLoading(true);
    const [absent, inactive, newcomers, birthdays] = await Promise.all([
      DB.getCareAbsent(),
      DB.getCareInactive(),
      DB.getCareNewcomers(),
      DB.getCareBirthdays(),
    ]);
    const team = filters.team;
    const filterTeam = list => team ? list.filter(d => (d.team_name || d.teamName) === team) : list;
    setCare({
      absentThisWeek:  filterTeam(absent.absentThisWeek),
      absentPast2Weeks:filterTeam(absent.absentPast2Weeks),
      inactive:        filterTeam(inactive),
      newcomers:       filterTeam(newcomers),
      birthdays:       filterTeam(birthdays),
    });
    setLoading(false);
  }

  if (loading) return <div className="loading-spinner" />;

  return (
    <div className="tab-page">
      <div className="care-grid">
        {CATEGORIES.map(c => (
          <div
            key={c.id}
            className={`care-card${openId === c.id ? ' open' : ''}`}
            style={{ borderColor: c.color }}
            onClick={() => setOpenId(openId === c.id ? null : c.id)}
          >
            <div className="care-count" style={{ color: c.color }}>{care[c.id]?.length ?? 0}</div>
            <div className="care-label">{c.label}</div>
          </div>
        ))}
      </div>

      {openId && (
        <div className="care-list-wrap">
          <div className="section-header">
            <h4 className="care-list-title">{CATEGORIES.find(c => c.id === openId)?.label}</h4>
            <button className="btn-outline sm" onClick={() => setOpenId(null)}>✕ Close</button>
          </div>
          {care[openId].length === 0
            ? <div className="empty-state">No devotees in this category</div>
            : care[openId].map(d => (
                <div key={d.id} className="care-devotee-row">
                  <strong>{d.name}</strong>
                  <span className="badge badge-team">{d.team_name || d.teamName}</span>
                  {d.calling_by && <span className="text-muted">· {d.calling_by}</span>}
                  {d.mobile && (
                    <>
                      <a href={`tel:${d.mobile}`} className="btn-icon sm" onClick={e => e.stopPropagation()}>📞</a>
                      <a href={`https://wa.me/91${d.mobile}`} className="btn-icon sm" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>💬</a>
                    </>
                  )}
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
