import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { toLocalDateStr, snapToSunday } from '../utils/helpers';
import { onSnapshot, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { bustCache } from '../firebase/db';

const AppContext = createContext(null);

// TAB_VIEWS mirrors the original exactly
export const TAB_VIEWS = {
  calling: [
    { key: 'calls',       label: 'Calls',              roles: ['teamAdmin','serviceDevotee'] },
    { key: 'team-calling',label: 'Team Calling',       roles: ['teamAdmin','superAdmin'] },
    { divider: true,      label: 'REPORTS' },
    { key: 'weekly',      label: 'Weekly Report' },
    { key: 'submission',  label: 'Submission Report' },
    { key: 'late',        label: 'Late Submissions' },
    { key: 'history',     label: 'Calling History' },
    { key: 'not-interested', label: 'Not Interested' },
  ],
  attendance: [
    { key: 'live',       label: 'Live Attendance', attSevaOnly: true },
    { divider: true,     label: 'REPORTS' },
    { key: 'sheet',      label: 'Attendance Sheet' },
    { key: 'late',       label: 'Late Comers' },
    { key: 'newcomers',  label: 'New Comers' },
    { key: 'serious',    label: 'Serious Analysis' },
    { key: 'teams',      label: 'Team Leaderboard' },
    { key: 'trends',     label: 'Trends' },
    { key: 'accuracy',   label: 'Accuracy' },
  ],
  books:        [{ key:'log', label:'Log Entry' }, { key:'reports', label:'Reports' }],
  service:      [{ key:'log', label:'Log Entry' }, { key:'reports', label:'Reports' }],
  registration: [{ key:'log', label:'Log Entry' }, { key:'reports', label:'Reports' }],
  donation:     [{ key:'log', label:'Log Entry' }, { key:'reports', label:'Reports' }],
  'calling-mgmt': [
    { key: 'calling',       label: 'Calling List' },
    { key: 'newcomers',     label: 'New Comers' },
    { key: 'online',        label: 'Online Class' },
    { key: 'notinterested', label: 'Not Interested' },
    { key: 'festival',      label: 'Festival Calling' },
  ],
};

// Default view for each tab
const DEFAULT_VIEW = {
  calling: 'calls', attendance: 'live',
  books: 'log', service: 'log', registration: 'log', donation: 'log',
  'calling-mgmt': 'calling',
};

export function AppProvider({ children }) {
  // "Att-Seva-only" login mode set on the login screen — limits navigation to
  // the Attendance tab only and lands directly on Live Attendance.
  const attSevaOnly = typeof window !== 'undefined' && sessionStorage.getItem('attSevaOnly') === '1';
  const [activeTab, setActiveTabRaw] = useState(attSevaOnly ? 'attendance' : 'dashboard');
  const [activeView, setActiveViewRaw] = useState(attSevaOnly ? 'live' : '');
  const toastTimer = useRef(null);
  const [toast, setToast] = useState(null);

  // Master filter
  const [filters, setFilters] = useState({
    sessionId: '',
    sessionDate: toLocalDateStr(),
    team: '',
    callingBy: '',
  });
  const [sessionsCache, setSessionsCache] = useState([]);
  const [callingPersonsCache, setCallingPersonsCache] = useState([]);

  // ── Live data version counter — increments whenever a watched collection
  //    changes in Firestore. Pages depend on this in their useEffect deps so
  //    reports refresh instantly when someone edits anything.
  const [dataVersion, setDataVersion] = useState(0);
  useEffect(() => {
    const cols = ['devotees', 'sessions', 'attendanceRecords', 'callingStatus', 'callingSubmissions'];
    const unsubs = cols.map(col =>
      onSnapshot(collection(db, col), () => {
        bustCache();             // invalidate devotee cache so next read is fresh
        setDataVersion(v => v + 1);
      }, () => {})
    );
    return () => unsubs.forEach(u => u());
  }, []);

  function setActiveTab(tab) {
    setActiveTabRaw(tab);
    // Set default view when switching to a tab that has views
    setActiveViewRaw(DEFAULT_VIEW[tab] || '');
  }

  function navTo(tab, view) {
    setActiveTabRaw(tab);
    setActiveViewRaw(view || DEFAULT_VIEW[tab] || '');
  }

  function showToast(message, type = 'info', duration = 3000) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }

  const dispatchFilters = useCallback((updates) => {
    setFilters(prev => ({ ...prev, ...updates }));
  }, []);

  const value = {
    activeTab, setActiveTab, activeView, setActiveViewRaw, navTo,
    filters, dispatchFilters,
    sessionsCache, setSessionsCache,
    callingPersonsCache, setCallingPersonsCache,
    toast, showToast,
    attSevaOnly,
    dataVersion,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
