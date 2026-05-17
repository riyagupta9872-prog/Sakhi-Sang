import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp, TAB_VIEWS } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

export const TABS = [
  { id: 'dashboard',    label: 'Dashboard',    short: 'Home',    roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'devotees',     label: 'Devotees',     short: 'Devs',    roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'calling',      label: 'Calling',      short: 'Calling', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'attendance',   label: 'Attendance',   short: 'Att.',    roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'books',        label: 'Books',        short: 'Books',   roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'service',      label: 'Service',      short: 'Svc',     roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'registration', label: 'Registration', short: 'Reg.',    roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'donation',     label: 'Donation',     short: 'Donation',roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'care',         label: 'Care',         short: 'Care',    roles: ['superAdmin','teamAdmin'] },
  { id: 'events',       label: 'Events',       short: 'Events',  roles: ['superAdmin','teamAdmin'] },
  { id: 'calling-mgmt', label: 'Calling Mgmt', short: 'Mgmt',   roles: ['superAdmin'] },
];

function TabMenu({ tab, views, userRole, onSelect, menuRef }) {
  const visibleViews = views.filter(v => !v.divider && (!v.roles || v.roles.includes(userRole)));
  return (
    <div className="tab-menu" ref={menuRef}>
      {views.map((v, i) => {
        if (v.divider) return <div key={i} className="tab-menu-divider">{v.label}</div>;
        if (v.roles && !v.roles.includes(userRole)) return null;
        return (
          <button key={v.key} className="tab-menu-item" onClick={() => onSelect(tab.id, v.key)}>
            {v.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TabNav() {
  const { activeTab, activeView, navTo, setActiveTab } = useApp();
  const { userRole } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);
  const navRef = useRef(null);

  const visible = TABS.filter(t => t.roles.includes(userRole));

  // Close menu on outside click
  useEffect(() => {
    const h = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function handleTabClick(tab) {
    const views = TAB_VIEWS[tab.id];
    if (views) {
      setOpenMenu(openMenu === tab.id ? null : tab.id);
    } else {
      setActiveTab(tab.id);
      setOpenMenu(null);
    }
  }

  function handleViewSelect(tabId, viewKey) {
    navTo(tabId, viewKey);
    setOpenMenu(null);
  }

  return (
    <>
      <nav className="tab-nav" ref={navRef}>
        {visible.map(tab => {
          const hasViews = !!TAB_VIEWS[tab.id];
          const isActive = activeTab === tab.id;
          const views = TAB_VIEWS[tab.id];
          return (
            <div key={tab.id} className="tab-btn-group">
              <button
                className={`tab-btn${isActive ? ' active' : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                {tab.label}
                {hasViews && <span className="tab-caret">▾</span>}
              </button>
              {hasViews && openMenu === tab.id && (
                <TabMenu
                  tab={tab}
                  views={views}
                  userRole={userRole}
                  onSelect={handleViewSelect}
                />
              )}
            </div>
          );
        })}
      </nav>

      {/* Breadcrumb trail */}
      <Breadcrumb />
    </>
  );
}

// ── Breadcrumb ──────────────────────────────────────────────────────────────
function Breadcrumb() {
  const { activeTab, activeView, navTo, setActiveTab } = useApp();
  const tab = TABS.find(t => t.id === activeTab);
  const views = TAB_VIEWS[activeTab];
  const view = views?.find(v => !v.divider && v.key === activeView);

  if (!tab) return null;

  return (
    <nav className="breadcrumb-trail">
      <button className="breadcrumb-item" onClick={() => setActiveTab('dashboard')}>Home</button>
      {tab.id !== 'dashboard' && (
        <>
          <span className="breadcrumb-sep">›</span>
          <button
            className="breadcrumb-item"
            onClick={() => views ? undefined : setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        </>
      )}
      {view && (
        <>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-current">{view.label}</span>
        </>
      )}
    </nav>
  );
}

// ── Scrollable Bottom Nav ───────────────────────────────────────────────────
export function BottomNav() {
  const { activeTab, activeView, navTo, setActiveTab } = useApp();
  const { userRole } = useAuth();
  const scrollRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);

  const visible = TABS.filter(t => t.roles.includes(userRole));

  function scrollLeft() { scrollRef.current?.scrollBy({ left: -120, behavior: 'smooth' }); }
  function scrollRight() { scrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' }); }

  function handleBnavClick(tab) {
    const views = TAB_VIEWS[tab.id];
    if (views) {
      setOpenMenu(openMenu === tab.id ? null : tab.id);
    } else {
      setActiveTab(tab.id);
      setOpenMenu(null);
    }
  }

  function handleViewSelect(tabId, viewKey) {
    navTo(tabId, viewKey);
    setOpenMenu(null);
  }

  return (
    <nav className="bottom-nav">
      <button className="bnav-arrow" onClick={scrollLeft}>‹</button>
      <div className="bnav-scroll" ref={scrollRef}>
        {visible.map(tab => {
          const hasViews = !!TAB_VIEWS[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <div key={tab.id} style={{ position: 'relative' }}>
              <button
                className={`bnav-btn${isActive ? ' active' : ''}`}
                onClick={() => handleBnavClick(tab)}
              >
                {tab.short}
                {hasViews && <span style={{ fontSize: '.6rem' }}>▾</span>}
              </button>
              {hasViews && openMenu === tab.id && (
                <div className="bnav-menu">
                  {TAB_VIEWS[tab.id].map((v, i) => {
                    if (v.divider) return <div key={i} className="bnav-menu-divider">{v.label}</div>;
                    if (v.roles && !v.roles.includes(userRole)) return null;
                    return (
                      <button key={v.key} className="bnav-menu-item" onClick={() => handleViewSelect(tab.id, v.key)}>
                        {v.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="bnav-arrow" onClick={scrollRight}>›</button>
    </nav>
  );
}
