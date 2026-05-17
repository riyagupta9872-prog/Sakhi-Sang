import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp, TAB_VIEWS } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { createPortal } from 'react-dom';

export const TABS = [
  { id: 'dashboard',    label: 'Dashboard',    short: 'Home',     roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'devotees',     label: 'Devotees',     short: 'Devs',     roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'calling',      label: 'Calling',      short: 'Calling',  roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'attendance',   label: 'Attendance',   short: 'Att.',     roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'books',        label: 'Books',        short: 'Books',    roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'service',      label: 'Service',      short: 'Svc',      roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'registration', label: 'Registration', short: 'Reg.',     roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'donation',     label: 'Donation',     short: 'Donation', roles: ['superAdmin','teamAdmin','serviceDevotee'] },
  { id: 'care',         label: 'Care',         short: 'Care',     roles: ['superAdmin','teamAdmin'] },
  { id: 'events',       label: 'Events',       short: 'Events',   roles: ['superAdmin','teamAdmin'] },
  { id: 'calling-mgmt', label: 'Calling Mgmt', short: 'Mgmt',    roles: ['superAdmin'] },
];

// Dropdown rendered via portal so overflow:hidden on tab-nav doesn't clip it
function TabDropdown({ tabId, views, userRole, anchorRect, onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const style = {
    position: 'fixed',
    top: anchorRect.bottom + 4,
    left: Math.min(anchorRect.left, window.innerWidth - 200),
    minWidth: 190,
    zIndex: 9999,
  };

  return createPortal(
    <div className="tab-menu" style={style} ref={ref}>
      {views.map((v, i) => {
        if (v.divider) return <div key={i} className="tab-menu-divider">{v.label}</div>;
        if (v.roles && !v.roles.includes(userRole)) return null;
        return (
          <button key={v.key} className="tab-menu-item" onMouseDown={() => onSelect(tabId, v.key)}>
            {v.label}
          </button>
        );
      })}
    </div>,
    document.body
  );
}

export default function TabNav() {
  const { activeTab, activeView, navTo, setActiveTab } = useApp();
  const { userRole } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);   // tabId
  const [anchorRect, setAnchorRect] = useState(null);

  const visible = TABS.filter(t => t.roles.includes(userRole));

  function handleTabClick(tab, e) {
    const views = TAB_VIEWS[tab.id];
    if (views) {
      if (openMenu === tab.id) { setOpenMenu(null); return; }
      setAnchorRect(e.currentTarget.getBoundingClientRect());
      setOpenMenu(tab.id);
    } else {
      setActiveTab(tab.id);
      setOpenMenu(null);
    }
  }

  function handleViewSelect(tabId, viewKey) {
    navTo(tabId, viewKey);
    setOpenMenu(null);
  }

  const views = openMenu ? TAB_VIEWS[openMenu] : null;

  return (
    <>
      <nav className="tab-nav">
        {visible.map(tab => {
          const hasViews = !!TAB_VIEWS[tab.id];
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab-btn${isActive ? ' active' : ''}`}
              onClick={e => handleTabClick(tab, e)}
            >
              {tab.label}
              {hasViews && <span className="tab-caret">▾</span>}
            </button>
          );
        })}
      </nav>

      {openMenu && views && anchorRect && (
        <TabDropdown
          tabId={openMenu}
          views={views}
          userRole={userRole}
          anchorRect={anchorRect}
          onSelect={handleViewSelect}
          onClose={() => setOpenMenu(null)}
        />
      )}

      <Breadcrumb />
    </>
  );
}

// ── Breadcrumb ──────────────────────────────────────────────────────────────
function Breadcrumb() {
  const { activeTab, activeView, setActiveTab } = useApp();
  const tab = TABS.find(t => t.id === activeTab);
  const views = TAB_VIEWS[activeTab];
  const view = views?.find(v => !v.divider && v.key === activeView);

  return (
    <nav className="breadcrumb-trail">
      <button className="breadcrumb-item" onClick={() => setActiveTab('dashboard')}>Home</button>
      {tab && tab.id !== 'dashboard' && (
        <>
          <span className="breadcrumb-sep">›</span>
          <button className="breadcrumb-item">{tab.label}</button>
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
  const { activeTab, navTo, setActiveTab } = useApp();
  const { userRole } = useAuth();
  const scrollRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);

  const visible = TABS.filter(t => t.roles.includes(userRole));

  function scrollLeft()  { scrollRef.current?.scrollBy({ left: -100, behavior: 'smooth' }); }
  function scrollRight() { scrollRef.current?.scrollBy({ left: 100,  behavior: 'smooth' }); }

  function handleBnavClick(tab, e) {
    const views = TAB_VIEWS[tab.id];
    if (views) {
      if (openMenu === tab.id) { setOpenMenu(null); return; }
      setAnchorRect(e.currentTarget.getBoundingClientRect());
      setOpenMenu(tab.id);
    } else {
      setActiveTab(tab.id);
      setOpenMenu(null);
    }
  }

  function handleViewSelect(tabId, viewKey) {
    navTo(tabId, viewKey);
    setOpenMenu(null);
  }

  const views = openMenu ? TAB_VIEWS[openMenu] : null;

  return (
    <>
      <nav className="bottom-nav">
        <button className="bnav-arrow" onClick={scrollLeft}>‹</button>
        <div className="bnav-scroll" ref={scrollRef}>
          {visible.map(tab => {
            const hasViews = !!TAB_VIEWS[tab.id];
            return (
              <button
                key={tab.id}
                className={`bnav-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={e => handleBnavClick(tab, e)}
              >
                <span>{tab.short}</span>
                {hasViews && <span style={{ fontSize: '.55rem', lineHeight: 1 }}>▾</span>}
              </button>
            );
          })}
        </div>
        <button className="bnav-arrow" onClick={scrollRight}>›</button>
      </nav>

      {openMenu && views && anchorRect && createPortal(
        <div className="bnav-dropdown-portal" style={{
          position: 'fixed',
          bottom: window.innerHeight - anchorRect.top + 4,
          left: Math.min(anchorRect.left, window.innerWidth - 180),
          minWidth: 170,
          zIndex: 9999,
          background: 'white',
          border: '1.5px solid #f5c518',
          borderRadius: '8px 8px 0 0',
          boxShadow: '0 -4px 16px rgba(0,0,0,.12)',
          overflow: 'hidden',
        }}>
          {views.map((v, i) => {
            if (v.divider) return <div key={i} className="bnav-menu-divider">{v.label}</div>;
            if (v.roles && !v.roles.includes(userRole)) return null;
            return (
              <button key={v.key} className="bnav-menu-item" onMouseDown={() => handleViewSelect(openMenu, v.key)}>
                {v.label}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}
