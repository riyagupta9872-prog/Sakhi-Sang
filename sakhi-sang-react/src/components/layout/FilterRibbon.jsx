import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { DB } from '../../firebase/db';
import { TEAMS } from '../../firebase/config';
import { formatDate, formatDateShort } from '../../utils/helpers';

export default function FilterRibbon() {
  const { filters, dispatchFilters, setSessionsCache, setCallingPersonsCache } = useApp();
  const { userTeam, isSuper } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [callers, setCallers] = useState([]);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [callerOpen, setCallerOpen] = useState(false);

  const teamLocked = !isSuper;

  useEffect(() => {
    async function load() {
      const [s, c] = await Promise.all([DB.getSessions(), DB.getCallingPersons()]);
      setSessions(s);
      setCallers(c);
      setSessionsCache(s);
      setCallingPersonsCache(c);
      if (s.length && !filters.sessionId) {
        const today = new Date().toISOString().slice(0, 10);
        const past = s.find(x => x.session_date <= today) || s[0];
        dispatchFilters({ sessionId: past.id, sessionDate: past.session_date });
      }
      if (teamLocked && !filters.team) dispatchFilters({ team: userTeam });
    }
    load();
  }, []);

  const selectedSession = sessions.find(s => s.id === filters.sessionId);

  function clearAll() {
    dispatchFilters({
      team: teamLocked ? userTeam : '',
      callingBy: '',
      sessionId: sessions[0]?.id || '',
      sessionDate: sessions[0]?.session_date || '',
    });
  }

  // Build the "Showing X team, for Y date" caption
  const teamPart = filters.team ? <><strong>{filters.team}</strong> team</> : <><strong>all teams</strong></>;
  const datePart = selectedSession ? <><strong>{formatDate(selectedSession.session_date)}</strong></> : null;
  const callerPart = filters.callingBy ? <> · called by <strong>{filters.callingBy}</strong></> : null;

  return (
    <div className="filter-ribbon-wrap">
      <div className="filter-ribbon">
        {/* Session picker */}
        <div className="fr-chip-wrap">
          <button className={`fr-chip${filters.sessionId ? ' active' : ''}`} onClick={() => { setSessionOpen(o => !o); setTeamOpen(false); setCallerOpen(false); }}>
            <span className="fr-chip-icon">🗓</span>
            <span className="fr-chip-label">Session</span>
            <span className="fr-chip-sep">|</span>
            <span className="fr-chip-value">{selectedSession ? formatDateShort(selectedSession.session_date) : 'All'}</span>
            {filters.sessionId && <span className="fr-chip-x" onClick={(e) => { e.stopPropagation(); dispatchFilters({ sessionId: '', sessionDate: '' }); }}>✕</span>}
            <span className="fr-chip-arrow">▾</span>
          </button>
          {sessionOpen && (
            <div className="fr-dropdown">
              <button className="fr-option" onClick={() => { dispatchFilters({ sessionId: '', sessionDate: '' }); setSessionOpen(false); }}>All sessions</button>
              {sessions.map(s => (
                <button key={s.id} className={`fr-option${s.id === filters.sessionId ? ' selected' : ''}`} onClick={() => { dispatchFilters({ sessionId: s.id, sessionDate: s.session_date }); setSessionOpen(false); }}>
                  {formatDateShort(s.session_date)}
                  {s.is_cancelled && <span className="badge-cancelled"> (Cancelled)</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Team picker */}
        <div className="fr-chip-wrap">
          <button
            className={`fr-chip${filters.team ? ' active' : ''}${teamLocked ? ' locked' : ''}`}
            onClick={() => { if (!teamLocked) { setTeamOpen(o => !o); setSessionOpen(false); setCallerOpen(false); } }}
          >
            <span className="fr-chip-icon">👥</span>
            <span className="fr-chip-label">Team</span>
            <span className="fr-chip-sep">|</span>
            <span className="fr-chip-value">{filters.team || 'All'}</span>
            {!teamLocked && <span className="fr-chip-arrow">▾</span>}
            {teamLocked && <span className="fr-chip-lock">🔒</span>}
          </button>
          {teamOpen && !teamLocked && (
            <div className="fr-dropdown">
              <button className="fr-option" onClick={() => { dispatchFilters({ team: '' }); setTeamOpen(false); }}>All teams</button>
              {TEAMS.map(t => (
                <button key={t} className={`fr-option${t === filters.team ? ' selected' : ''}`} onClick={() => { dispatchFilters({ team: t }); setTeamOpen(false); }}>{t}</button>
              ))}
            </div>
          )}
        </div>

        {/* Calling-by picker */}
        <div className="fr-chip-wrap">
          <button className={`fr-chip${filters.callingBy ? ' active' : ''}`} onClick={() => { setCallerOpen(o => !o); setSessionOpen(false); setTeamOpen(false); }}>
            <span className="fr-chip-icon">🎧</span>
            <span className="fr-chip-label">Calling By</span>
            <span className="fr-chip-sep">|</span>
            <span className="fr-chip-value">{filters.callingBy || 'All'}</span>
            <span className="fr-chip-arrow">▾</span>
          </button>
          {callerOpen && (
            <div className="fr-dropdown">
              <button className="fr-option" onClick={() => { dispatchFilters({ callingBy: '' }); setCallerOpen(false); }}>All callers</button>
              {callers.map(c => (
                <button key={c} className={`fr-option${c === filters.callingBy ? ' selected' : ''}`} onClick={() => { dispatchFilters({ callingBy: c }); setCallerOpen(false); }}>{c}</button>
              ))}
            </div>
          )}
        </div>

        {(filters.team && !teamLocked || filters.callingBy || filters.sessionId) && (
          <button className="fr-clear-all" onClick={clearAll} title="Clear all filters">
            🧹 Clear all
          </button>
        )}
      </div>

      {/* Caption — "Showing Lalita team, for Sun, 17 May, 2026" */}
      <div className="filter-caption">
        Showing {teamPart}{datePart && <>, for {datePart}</>}{callerPart}
      </div>
    </div>
  );
}
