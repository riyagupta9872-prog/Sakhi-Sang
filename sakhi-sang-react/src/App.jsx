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
import AnalyticsPage from './pages/AnalyticsPage';
import ActivitiesPage from './pages/ActivitiesPage';

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
        {activeTab === 'home' && <HomePage />}
        {activeTab === 'devotees' && <DevoteesPage />}
        {activeTab === 'attendance' && <AttendancePage />}
        {activeTab === 'calling' && <CallingPage />}
        {activeTab === 'analytics' && <AnalyticsPage />}
        {activeTab === 'activities' && <ActivitiesPage />}
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
