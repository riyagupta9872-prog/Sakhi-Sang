import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { avatarInitials, isBirthdayThisWeek } from '../utils/helpers';

const CATEGORIES = [
  { id: 'absentThisWeek',  label: 'Absent This Week',       color: '#dc2626' },
  { id: 'absentPast2Weeks',label: 'Absent 2+ Weeks',        color: '#d97706' },
  { id: 'inactive',        label: 'Inactive (3+ sessions)', color: '#6b7280' },
  { id: 'newcomers',       label: 'New This Week',          color: '#16a34a' },
  { id: 'birthdays',       label: 'Birthdays This Week 🎂', color: '#7c3aed' },
];

function exportExcel(label, list) {
  const rows = [['Name', 'Mobile', 'Team', 'Calling By', 'Lifetime AT']];
  list.forEach(d => rows.push([d.name, d.mobile || '', d.team_name || d.teamName || '', d.calling_by || d.callingBy || '', d.lifetime_attendance || 0]));
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, label.slice(0, 31));
  XLSX.writeFile(wb, `Care_${label.replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.xlsx`);
}

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
    const ft = list => filters.team ? list.filter(d => (d.team_name || d.teamName) === filters.team) : list;
    setCare({
      absentThisWeek:   ft(absent.absentThisWeek),
      absentPast2Weeks: ft(absent.absentPast2Weeks),
      inactive:         ft(inactive),
      newcomers:        ft(newcomers),
      birthdays:        ft(birthdays),
    });
    setLoading(false);
  }

  if (loading) return <div className="loading-spinner" />;

  return (
    <div className="tab-page">
      <div className="care-grid">
        {CATEGORIES.map(c => (
          <div key={c.id}
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
            <div style={{display:'flex',gap:6}}>
              {care[openId].length > 0 && <button className="btn-outline sm" onClick={() => exportExcel(CATEGORIES.find(c => c.id === openId)?.label || 'Care', care[openId])}>⬇ Excel</button>}
              <button className="btn-outline sm" onClick={() => setOpenId(null)}>✕ Close</button>
            </div>
          </div>
          {care[openId].length === 0
            ? <div className="empty-state">No devotees in this category</div>
            : care[openId].map(d => (
                <div key={d.id} className="care-detail-row">
                  <div className="devotee-avatar sm">{avatarInitials(d.name)}</div>
                  <div className="care-detail-info">
                    <div className="care-detail-name">
                      <strong>{d.name}</strong>
                      {isBirthdayThisWeek(d.dob) && <span title="Birthday this week"> 🎂</span>}
                      {d.devotee_status && <span className="badge badge-default ml-2" style={{fontSize:'.7rem'}}>{d.devotee_status}</span>}
                    </div>
                    <div className="care-detail-meta">
                      {(d.team_name || d.teamName) && <span className="badge badge-team">{d.team_name || d.teamName}</span>}
                      {d.mobile && <a href={`tel:${d.mobile}`}>📱 {d.mobile}</a>}
                      {(d.calling_by || d.callingBy) && <span className="text-muted">· {d.calling_by || d.callingBy}</span>}
                      <span className="text-muted">· AT: {d.lifetime_attendance || 0}</span>
                    </div>
                  </div>
                  <div className="care-detail-actions">
                    {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon">📞</a>}
                    {d.mobile && <a href={`https://wa.me/91${d.mobile}`} className="btn-icon" target="_blank" rel="noreferrer">💬</a>}
                  </div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}
