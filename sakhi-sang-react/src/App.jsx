import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import AuthScreen from './components/auth/AuthScreen';
import PendingApproval from './components/auth/PendingApproval';
import Header from './components/layout/Header';
import TabNav, { BottomNav } from './components/layout/TabNav';
import FilterRibbon from './components/layout/FilterRibbon';
import Toast from './components/common/Toast';

import HomePage from './pages/HomePage';
import DevoteesPage from './pages/DevoteesPage';
import AttendancePage from './pages/AttendancePage';
import CallingPage from './pages/CallingPage';
import CarePage from './pages/CarePage';
import EventsPage from './pages/EventsPage';
import CallingMgmtPage from './pages/CallingMgmtPage';
import ActivityTabPage from './pages/ActivityTabPage';

const ACTIVITY_CONFIGS = {
  books:        { key: 'books',        label: 'Books',        addFn: 'addBookDistribution', getFn: 'getBookDistributions', sumField: 'quantity', unit: 'books' },
  service:      { key: 'service',      label: 'Service',      addFn: 'addService',           getFn: 'getServices',           sumField: null,       unit: 'entries' },
  registration: { key: 'registration', label: 'Registration', addFn: 'addRegistration',      getFn: 'getRegistrations',      sumField: 'count',    unit: 'count' },
  donation:     { key: 'donation',     label: 'Donation',     addFn: 'addDonation',          getFn: 'getDonations',          sumField: 'amount',   unit: '₹' },
};

function AppShell() {
  const { authState } = useAuth();
  const { activeTab } = useApp();

  if (authState === 'loading') {
    return (
      <div className="app-loading">
        <div className="loading-logo">🌸</div>
        <div className="loading-text">Loading Sakhi Sang…</div>
      </div>
    );
  }

  if (authState === 'auth' || authState === 'rejected') return <AuthScreen />;
  if (authState === 'pending') return <PendingApproval />;

  return (
    <div className="app-shell">
      <Header />
      <TabNav />
      <FilterRibbon />
      <main className="main-content">
        {activeTab === 'dashboard'    && <HomePage />}
        {activeTab === 'devotees'     && <DevoteesPage />}
        {activeTab === 'calling'      && <CallingPage />}
        {activeTab === 'attendance'   && <AttendancePage />}
        {activeTab === 'books'        && <ActivityTabPage config={ACTIVITY_CONFIGS.books} />}
        {activeTab === 'service'      && <ActivityTabPage config={ACTIVITY_CONFIGS.service} />}
        {activeTab === 'registration' && <ActivityTabPage config={ACTIVITY_CONFIGS.registration} />}
        {activeTab === 'donation'     && <ActivityTabPage config={ACTIVITY_CONFIGS.donation} />}
        {activeTab === 'care'         && <CarePage />}
        {activeTab === 'events'       && <EventsPage />}
        {activeTab === 'calling-mgmt' && <CallingMgmtPage />}
      </main>
      <BottomNav />
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </AuthProvider>
  );
}
