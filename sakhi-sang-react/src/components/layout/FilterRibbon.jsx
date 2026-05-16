import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { DB } from '../../firebase/db';
import { TEAMS } from '../../firebase/config';
import { toLocalDateStr, formatDateShort, shiftDate, snapToSunday } from '../../utils/helpers';

export default function FilterRibbon() {
  const { filters, dispatchFilters, sessionsCache, setSessionsCache, setCallingPersonsCache } = useApp();
  const { userRole, userTeam, isSuper } = useAuth();
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
        dispatchFilters({ sessionId: s[0].id, sessionDate: s[0].session_date });
      }
      if (teamLocked && !filters.team) {
        dispatchFilters({ team: userTeam });
      }
    }
    load();
  }, []);

  const selectedSession = sessions.find(s => s.id === filters.sessionId);

  function pickSession(s) {
    dispatchFilters({ sessionId: s.id, sessionDate: s.session_date });
    setSessionOpen(false);
  }

  function pickTeam(t) {
    dispatchFilters({ team: t });
    setTeamOpen(false);
  }

  function pickCaller(c) {
    dispatchFilters({ callingBy: c });
    setCallerOpen(false);
  }

  return (
    <div className="filter-ribbon">
      {/* Session picker */}
      <div className="fr-chip-wrap">
        <button className={`fr-chip${filters.sessionId ? ' active' : ''}`} onClick={() => setSessionOpen(o => !o)}>
          <span className="fr-chip-label">Session</span>
          <span className="fr-chip-value">{selectedSession ? formatDateShort(selectedSession.session_date) : 'All'}</span>
          <span className="fr-chip-arrow">▾</span>
        </button>
        {sessionOpen && (
          <div className="fr-dropdown">
            <button className="fr-option" onClick={() => { dispatchFilters({ sessionId: '', sessionDate: '' }); setSessionOpen(false); }}>All sessions</button>
            {sessions.map(s => (
              <button key={s.id} className={`fr-option${s.id === filters.sessionId ? ' selected' : ''}`} onClick={() => pickSession(s)}>
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
          onClick={() => !teamLocked && setTeamOpen(o => !o)}
          data-locked={teamLocked}
        >
          <span className="fr-chip-label">Team</span>
          <span className="fr-chip-value">{filters.team || 'All'}</span>
          {!teamLocked && <span className="fr-chip-arrow">▾</span>}
          {teamLocked && <span className="fr-chip-lock">🔒</span>}
        </button>
        {teamOpen && !teamLocked && (
          <div className="fr-dropdown">
            <button className="fr-option" onClick={() => { dispatchFilters({ team: '' }); setTeamOpen(false); }}>All teams</button>
            {TEAMS.map(t => (
              <button key={t} className={`fr-option${t === filters.team ? ' selected' : ''}`} onClick={() => pickTeam(t)}>{t}</button>
            ))}
          </div>
        )}
      </div>

      {/* Calling-by picker */}
      <div className="fr-chip-wrap">
        <button className={`fr-chip${filters.callingBy ? ' active' : ''}`} onClick={() => setCallerOpen(o => !o)}>
          <span className="fr-chip-label">Calling By</span>
          <span className="fr-chip-value">{filters.callingBy || 'All'}</span>
          <span className="fr-chip-arrow">▾</span>
        </button>
        {callerOpen && (
          <div className="fr-dropdown">
            <button className="fr-option" onClick={() => { dispatchFilters({ callingBy: '' }); setCallerOpen(false); }}>All callers</button>
            {callers.map(c => (
              <button key={c} className={`fr-option${c === filters.callingBy ? ' selected' : ''}`} onClick={() => pickCaller(c)}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {(filters.team || filters.callingBy) && (
        <button className="fr-clear" onClick={() => dispatchFilters({ team: teamLocked ? userTeam : '', callingBy: '' })}>
          ✕ Clear
        </button>
      )}
    </div>
  );
}
