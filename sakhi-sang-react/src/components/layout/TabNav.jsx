import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp, TAB_VIEWS } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { createPortal } from 'react-dom';

const ALL_ROLES   = ['superAdmin', 'departmentAdmin', 'teamAdmin', 'serviceDevotee'];
const COORD_ROLES = ['superAdmin', 'departmentAdmin', 'teamAdmin'];
const ADMIN_ROLES = ['superAdmin', 'departmentAdmin'];

export const TABS = [
  { id: 'dashboard',    label: 'Dashboard',    short: 'Home',     icon: '⌂',  roles: ALL_ROLES },
  { id: 'devotees',     label: 'Devotees',     short: 'Devotees', icon: '👥', roles: ALL_ROLES },
  { id: 'calling',      label: 'Calling',      short: 'Calling',  icon: '📞', roles: ALL_ROLES },
  { id: 'attendance',   label: 'Attendance',   short: 'Att.',     icon: '✓',  roles: ALL_ROLES },
  { id: 'books',        label: 'Books',        short: 'Books',    icon: '📚', roles: ALL_ROLES },
  { id: 'service',      label: 'Service',      short: 'Service',  icon: '🤲', roles: ALL_ROLES },
  { id: 'registration', label: 'Registration', short: 'Reg.',     icon: '📋', roles: ALL_ROLES },
  { id: 'donation',     label: 'Donation',     short: 'Donation', icon: '💰', roles: ALL_ROLES },
  { id: 'care',         label: 'Care',         short: 'Care',     icon: '❤',  roles: COORD_ROLES },
  { id: 'events',       label: 'Events',       short: 'Events',   icon: '📅', roles: COORD_ROLES },
  { id: 'calling-mgmt', label: 'Calling Mgmt', short: 'Mgmt',     icon: '📊', roles: ADMIN_ROLES },
];

// Dropdown rendered via portal so overflow:hidden on tab-nav doesn't clip it
function TabDropdown({ tabId, views, userRole, isAttSevaDev, anchorRect, onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (!ref.current) return;
      // Click inside the dropdown → menu item's onMouseDown handles it
      if (ref.current.contains(e.target)) return;
      // Click on any tab button (current or sibling) → tab's onClick handles the
      // open/close/switch logic. Closing here would cause a flicker-reopen race.
      if (e.target.closest('.tab-btn') || e.target.closest('.bnav-btn')) return;
      onClose();
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
        if (v.attSevaOnly && !isAttSevaDev) return null;
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
  const { activeTab, activeView, navTo, setActiveTab, attSevaOnly } = useApp();
  const { userRole, isAttSevaDev } = useAuth();
  const [openMenu, setOpenMenu] = useState(null);   // tabId
  const [anchorRect, setAnchorRect] = useState(null);

  let visible = TABS.filter(t => t.roles.includes(userRole));
  if (attSevaOnly) visible = visible.filter(t => t.id === 'attendance');

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
          isAttSevaDev={isAttSevaDev}
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

// ── Scrollable Bottom Nav (mobile only) ─────────────────────────────────────
export function BottomNav() {
  const { activeTab, setActiveTab, attSevaOnly } = useApp();
  const { userRole } = useAuth();
  const scrollRef = useRef(null);
  let visible = TABS.filter(t => t.roles.includes(userRole));
  if (attSevaOnly) visible = visible.filter(t => t.id === 'attendance');

  // Auto-scroll active button into view when tab changes
  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector('.bnav-btn.active');
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeTab]);

  function scrollLeft()  { scrollRef.current?.scrollBy({ left: -160, behavior: 'smooth' }); }
  function scrollRight() { scrollRef.current?.scrollBy({ left: 160,  behavior: 'smooth' }); }

  return (
    <nav className="bottom-nav">
      <button className="bnav-arrow" onClick={scrollLeft} aria-label="Previous tabs">‹</button>
      <div className="bnav-scroll" ref={scrollRef}>
        {visible.map(tab => (
          <button
            key={tab.id}
            className={`bnav-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="bnav-icon">{tab.icon}</span>
            <span className="bnav-label">{tab.short}</span>
          </button>
        ))}
      </div>
      <button className="bnav-arrow" onClick={scrollRight} aria-label="Next tabs">›</button>
    </nav>
  );
}
