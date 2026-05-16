import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { toLocalDateStr, snapToSunday } from '../utils/helpers';

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [activeTab, setActiveTab] = useState('home');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // Master filter state
  const [filters, setFilters] = useState({
    sessionId: '',
    sessionDate: toLocalDateStr(),
    team: '',
    callingBy: '',
    period: 'weekly',
  });

  // Sessions cache for filter bar
  const [sessionsCache, setSessionsCache] = useState([]);
  const [callingPersonsCache, setCallingPersonsCache] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState('');

  // Modal states
  const [modals, setModals] = useState({});

  function openModal(id) { setModals(m => ({ ...m, [id]: true })); }
  function closeModal(id) { setModals(m => ({ ...m, [id]: false })); }
  function isModalOpen(id) { return !!modals[id]; }

  function showToast(message, type = 'info', duration = 3000) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }

  const dispatchFilters = useCallback((updates) => {
    setFilters(prev => ({ ...prev, ...updates }));
  }, []);

  const value = {
    activeTab,
    setActiveTab,
    filters,
    dispatchFilters,
    sessionsCache,
    setSessionsCache,
    callingPersonsCache,
    setCallingPersonsCache,
    currentSessionId,
    setCurrentSessionId,
    toast,
    showToast,
    modals,
    openModal,
    closeModal,
    isModalOpen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
