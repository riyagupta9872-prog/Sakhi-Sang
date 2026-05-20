import React, { useEffect, useState, useCallback } from 'react';
import { DB } from '../firebase/db';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { TEAMS } from '../firebase/config';
import { avatarInitials, formatDate, isBirthdayThisWeek, statusBadge } from '../utils/helpers';
import Modal from '../components/common/Modal';
import DevoteePicker from '../components/common/DevoteePicker';
import FAB from '../components/common/FAB';
import ProfileGauge, { calcProfileCompletion } from '../components/common/ProfileGauge';
import { ProfileHistoryModal, CallingHistoryModal, TeamChangeHistoryModal, CallingStatusChangesModal } from '../components/common/DevoteeHistoryModals';
import ExcelImport from '../components/common/ExcelImport';
import * as XLSX from 'xlsx';

// Short label for the 5 devotee statuses (matches original 'ETS' style)
const STATUS_SHORT = {
  'Expected to be Serious': 'ETS',
  'Serious': 'Serious',
  'Most Serious': 'MS',
  'New Devotee': 'New',
  'Inactive': 'Inactive',
};

// ── DevoteeItem card ───────────────────────────────────────────────────────────
function DevoteeItem({ d, onOpen }) {
  return (
    <div className="devotee-item" onClick={() => onOpen(d.id)}>
      <div className="devotee-avatar">{avatarInitials(d.name)}</div>
      <div className="devotee-body">
        <div className="devotee-name">
          {d.name}
          {isBirthdayThisWeek(d.dob) && <span className="birthday-badge" title="Birthday this week">🎂</span>}
        </div>
        <div className="devotee-mobile-row">
          {d.mobile && <span className="devotee-mobile">{d.mobile}</span>}
        </div>
        <div className="devotee-meta">
          {d.devotee_status && (
            <span className={`badge ${statusBadge(d.devotee_status)}`} title={d.devotee_status}>
              {STATUS_SHORT[d.devotee_status] || d.devotee_status}
            </span>
          )}
          {d.team_name && <span className="badge badge-team">{d.team_name}</span>}
        </div>
        {d.reference_by && (
          <div className="devotee-ref-line">
            <span className="devotee-ref-icon">＋</span>
            <span>{d.reference_by}</span>
          </div>
        )}
      </div>
      <div className="devotee-actions">
        {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon icon-call" onClick={e => e.stopPropagation()} title="Call">📞</a>}
        {d.mobile && <a href={`https://wa.me/91${d.mobile}`} className="btn-icon icon-wa" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} title="WhatsApp">💬</a>}
      </div>
    </div>
  );
}

// ── Profile Modal ──────────────────────────────────────────────────────────────
function ProfileModal({ devoteeId, onClose, onEdit, onNavigate }) {
  const [d, setD] = useState(null);
  const [activeTab, setActiveTab] = useState('identity');
  const [showProfileHistory, setShowProfileHistory] = useState(false);
  const [showCallingHistory, setShowCallingHistory] = useState(false);
  const [showTeamHistory, setShowTeamHistory] = useState(false);
  const [showStatusEdits, setShowStatusEdits] = useState(false);
  const [referredList, setReferredList] = useState([]);
  const { isSuper, isTeamAdmin } = useAuth();

  useEffect(() => {
    if (!devoteeId) return;
    setD(null); setActiveTab('identity');
    DB.getDevotee(devoteeId).then(setD);
  }, [devoteeId]);

  async function loadReferred() {
    const all = await DB.getDevotees({ search: '' });
    setReferredList(all.filter(x => x.reference_by === d?.name));
  }

  useEffect(() => {
    if (activeTab === 'referred' && d) loadReferred();
  }, [activeTab, d]);

  async function handleDelete() {
    if (!confirm(`Soft-delete ${d.name}? This cannot easily be undone.`)) return;
    await DB.softDeleteDevotee(devoteeId);
    onClose();
  }

  async function handleNotInterested() {
    if (!confirm(`Mark ${d.name} as Not Interested?`)) return;
    await DB.setDevoteeCallingMode(devoteeId, 'not_interested');
    onClose();
  }

  if (!d) return <div className="loading-spinner" />;

  const TABS = ['identity','team','professional','sadhana','family','referred'];

  return (
    <div className="profile-modal-content">
      {/* Hero */}
      <div className="profile-hero">
        <div className="profile-avatar-xl">{avatarInitials(d.name)}</div>
        <div className="profile-hero-info">
          <h2 className="profile-hero-name">{d.name} {isBirthdayThisWeek(d.dob) && '🎂'}</h2>
          <div className="profile-hero-badges">
            {d.team_name && <span className="badge badge-team">{d.team_name}</span>}
            {d.devotee_status && <span className={`badge ${statusBadge(d.devotee_status)}`}>{d.devotee_status}</span>}
            {d.calling_mode && d.calling_mode !== 'regular' && <span className="badge badge-mode">{d.calling_mode}</span>}
          </div>
          {d.mobile && <div className="profile-hero-contact">📱 {d.mobile} {d.mobile_alt && ` · ${d.mobile_alt}`}</div>}
          <div className="profile-hero-stats">AT: {d.lifetime_attendance || 0} · CR: {d.chanting_rounds || 0}/day</div>
        </div>
        <div className="profile-gauge-wrap">
          <ProfileGauge pct={calcProfileCompletion(d)} size={68} />
          <div className="profile-gauge-label">Complete</div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="profile-tabs">
        {TABS.map(t => (
          <button key={t} className={`profile-tab-btn${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="profile-tab-content">
        {activeTab === 'identity' && (
          <dl className="detail-list">
            <dt>DOB</dt><dd>{formatDate(d.dob) || '—'}</dd>
            <dt>Address</dt><dd>{d.address || '—'}</dd>
            <dt>Email</dt><dd>{d.email ? <a href={`mailto:${d.email}`}>{d.email}</a> : '—'}</dd>
            <dt>Mobile Alt</dt><dd>{d.mobile_alt || '—'}</dd>
            <dt>Joined</dt><dd>{formatDate(d.joining_date) || '—'}</dd>
            <dt>Admitted</dt><dd>{d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN') : '—'}</dd>
          </dl>
        )}
        {activeTab === 'team' && (
          <dl className="detail-list">
            <dt>Team</dt><dd>{d.team_name || '—'}</dd>
            <dt>Status</dt><dd>{d.devotee_status || '—'}</dd>
            <dt>Referred By</dt><dd>{d.reference_by
              ? (d.reference_id
                  ? <button className="link-btn" onClick={() => onNavigate?.(d.reference_id)}>{d.reference_by} →</button>
                  : d.reference_by)
              : '—'}</dd>
            <dt>Facilitator</dt><dd>{d.facilitator || '—'}</dd>
            <dt>Calling By</dt><dd>{d.calling_by || '—'}</dd>
            <dt>Remarks</dt><dd className="remarks-text">{d.remarks || '—'}</dd>
          </dl>
        )}
        {activeTab === 'professional' && (
          <dl className="detail-list">
            <dt>Education</dt><dd>{d.education || '—'}</dd>
            <dt>Profession</dt><dd>{d.profession || '—'}</dd>
          </dl>
        )}
        {activeTab === 'sadhana' && (
          <dl className="detail-list">
            <dt>Chanting Rounds</dt><dd>{d.chanting_rounds || 0}/day</dd>
            <dt>Lifetime Attendance</dt><dd>{d.lifetime_attendance || 0} sessions</dd>
            <dt>Tilak</dt><dd>{d.tilak ? 'Yes' : 'No'}</dd>
            <dt>Kanthi</dt><dd>{d.kanthi ? 'Yes' : 'No'}</dd>
            <dt>Gopi Dress</dt><dd>{d.gopi_dress ? 'Yes' : 'No'}</dd>
            <dt>Reads Books</dt><dd>{d.reads_books || '—'}</dd>
            <dt>Hears Katha</dt><dd>{d.hears_katha || '—'}</dd>
            <dt>Plays Instrument</dt><dd>{d.plays_instrument || '—'}{d.instrument_name && ` (${d.instrument_name})`}</dd>
            <dt>Wants Kirtan Class</dt><dd>{d.wants_kirtan || '—'}</dd>
          </dl>
        )}
        {activeTab === 'family' && (
          <dl className="detail-list">
            <dt>Family Members</dt><dd>{d.family_members ?? '—'}</dd>
            <dt>Attending Class</dt><dd>{d.family_participants ?? '—'}</dd>
            <dt>Family Attitude</dt><dd>{d.family_favourable || '—'}</dd>
            <dt>Hobbies</dt><dd>{d.hobbies || '—'}</dd>
          </dl>
        )}
        {activeTab === 'referred' && (
          <div>
            {referredList.length === 0
              ? <div className="empty-state">No referred devotees</div>
              : referredList.map(r => (
                  <div key={r.id} className="referred-item" onClick={() => onNavigate?.(r.id)} style={{cursor:'pointer'}}>
                    <span className="devotee-avatar sm">{avatarInitials(r.name)}</span>
                    <span><strong>{r.name}</strong></span>
                    <span className="badge badge-team">{r.team_name}</span>
                    <span className="text-muted ml-auto">→</span>
                  </div>
                ))
            }
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="profile-actions">
        {isTeamAdmin && <button className="btn-primary" onClick={() => onEdit(d.id)}>✏ Edit</button>}
        <button className="btn-outline" onClick={() => setShowCallingHistory(true)}>📞 Calling History</button>
        <button className="btn-outline" onClick={() => setShowProfileHistory(true)}>🕑 Profile Changes</button>
        <button className="btn-outline" onClick={() => setShowTeamHistory(true)}>🔄 Team History</button>
        <button className="btn-outline" onClick={() => setShowStatusEdits(true)}>📋 Calling Edits</button>
        {d.mobile && <a href={`tel:${d.mobile}`} className="btn-outline">📞 Call</a>}
        {d.mobile && <a href={`https://wa.me/91${d.mobile}`} className="btn-outline" target="_blank" rel="noreferrer">💬 WhatsApp</a>}
        {isSuper && <button className="btn-outline" onClick={handleNotInterested}>✕ Not Interested</button>}
        {isSuper && <button className="btn-danger" onClick={handleDelete}>🗑 Delete</button>}
      </div>

      <ProfileHistoryModal open={showProfileHistory} devoteeId={devoteeId} onClose={() => setShowProfileHistory(false)} />
      <CallingHistoryModal open={showCallingHistory} devoteeId={devoteeId} devoteeName={d.name} onClose={() => setShowCallingHistory(false)} />
      <TeamChangeHistoryModal open={showTeamHistory} devoteeId={devoteeId} devoteeName={d.name} currentTeam={d.team_name} onClose={() => setShowTeamHistory(false)} />
      <CallingStatusChangesModal open={showStatusEdits} devoteeId={devoteeId} devoteeName={d.name} onClose={() => setShowStatusEdits(false)} />
    </div>
  );
}

// ── DevoteeForm ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['Most Serious','Serious','Expected to be Serious','New Devotee','Inactive'];

function DevoteeForm({ editId, onSave, onClose, fromAttendance = false }) {
  const { isSuper, userTeam, isTeamAdmin, userName } = useAuth();
  const { showToast } = useApp();
  const [tab, setTab] = useState('identity');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const FORM_TABS = ['identity','team','professional','sadhana','family'];

  const [form, setForm] = useState({
    name: '', mobile: '', mobile_alt: '', email: '', dob: '', address: '',
    team_name: userTeam || 'Other', devotee_status: fromAttendance ? 'New Devotee' : 'Expected to be Serious',
    reference_by: '', reference_id: '', facilitator: '', calling_by: '',
    education: '', profession: '', chanting_rounds: 0,
    tilak: false, kanthi: false, gopi_dress: false,
    reads_books: '', hears_katha: '', plays_instrument: 'No', instrument_name: '',
    wants_kirtan: '', family_members: '', family_participants: '', family_favourable: '',
    hobbies: '', remarks: '', joining_date: new Date().toISOString().slice(0,10), prior_sessions: 0,
  });

  useEffect(() => {
    if (!editId) return;
    DB.getDevotee(editId).then(d => {
      if (!d) return;
      setForm({
        name: d.name || '', mobile: d.mobile || '', mobile_alt: d.mobile_alt || '',
        email: d.email || '', dob: d.dob || '', address: d.address || '',
        team_name: d.team_name || '', devotee_status: d.devotee_status || '',
        reference_by: d.reference_by || '', reference_id: d.reference_id || '',
        facilitator: d.facilitator || '', calling_by: d.calling_by || '',
        education: d.education || '', profession: d.profession || '',
        chanting_rounds: d.chanting_rounds || 0,
        tilak: !!d.tilak, kanthi: !!d.kanthi, gopi_dress: !!d.gopi_dress,
        reads_books: d.reads_books || '', hears_katha: d.hears_katha || '',
        plays_instrument: d.plays_instrument || 'No', instrument_name: d.instrument_name || '',
        wants_kirtan: d.wants_kirtan || '',
        family_members: d.family_members ?? '', family_participants: d.family_participants ?? '',
        family_favourable: d.family_favourable || '',
        hobbies: d.hobbies || '', remarks: d.remarks || '',
        joining_date: d.joining_date || '', prior_sessions: d.prior_sessions || 0,
      });
    });
  }, [editId]);

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Name is required'); setTab('identity'); return; }
    if (form.mobile && !/^\d{10}$/.test(form.mobile)) { setError('Mobile must be exactly 10 digits'); setTab('identity'); return; }
    if (!form.reference_by?.trim()) { setError('Reference Person is required'); setTab('team'); return; }
    setLoading(true); setError('');
    try {
      const payload = { ...form, tilak: form.tilak ? 1 : 0, kanthi: form.kanthi ? 1 : 0, gopi_dress: form.gopi_dress ? 1 : 0 };
      if (editId) {
        await DB.updateDevotee(editId, payload, userName);
        showToast('Devotee updated', 'success');
      } else {
        await DB.createDevotee(payload);
        showToast('Devotee added', 'success');
      }
      onSave?.();
    } catch (err) {
      if (err.code === 409) {
        if (confirm('A devotee with this name and mobile already exists. Add anyway?')) {
          await DB.forceCreateDevotee(form);
          showToast('Devotee added (duplicate confirmed)', 'warning');
          onSave?.();
        }
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  const tabIdx = FORM_TABS.indexOf(tab);

  return (
    <div className="devotee-form">
      <div className="form-tabs">
        {FORM_TABS.map(t => (
          <button key={t} className={`form-tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'identity' && (
        <div className="form-grid">
          <div className="form-group full"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Mobile</label><input className="form-input" type="tel" maxLength={10} value={form.mobile} onChange={e => set('mobile', e.target.value.replace(/\D/g,''))} /></div>
          <div className="form-group"><label className="form-label">Mobile Alt</label><input className="form-input" type="tel" maxLength={10} value={form.mobile_alt} onChange={e => set('mobile_alt', e.target.value.replace(/\D/g,''))} /></div>
          <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Date of Birth</label><input className="form-input" type="date" value={form.dob} onChange={e => set('dob', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Joining Date</label><input className="form-input" type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} /></div>
          <div className="form-group full"><label className="form-label">Address</label><textarea className="form-textarea" rows={2} value={form.address} onChange={e => set('address', e.target.value)} /></div>
        </div>
      )}

      {tab === 'team' && (
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Team</label>
            {isSuper ? (
              <select className="form-select" value={form.team_name} onChange={e => set('team_name', e.target.value)}>
                <option value="">Select team</option>
                {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            ) : (
              <input className="form-input" value={form.team_name} readOnly />
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Status</label>
            <select className="form-select" value={form.devotee_status} onChange={e => set('devotee_status', e.target.value)}>
              <option value="">Select status</option>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group full">
            <label className="form-label">Reference Person <span style={{ color: 'var(--color-danger)' }}>*</span></label>
            <DevoteePicker value={form.reference_by} onChange={v => { set('reference_by', v.name); set('reference_id', v.id); }} placeholder="Search who referred them…" />
          </div>
          <div className="form-group full">
            <label className="form-label">Calling By (Coordinator)</label>
            <input className="form-input" value={form.calling_by} onChange={e => set('calling_by', e.target.value)} placeholder="Coordinator name" />
          </div>
          <div className="form-group full">
            <label className="form-label">Facilitator</label>
            <input className="form-input" value={form.facilitator} onChange={e => set('facilitator', e.target.value)} />
          </div>
          <div className="form-group"><label className="form-label">Prior Sessions</label><input className="form-input" type="number" min={0} value={form.prior_sessions} onChange={e => set('prior_sessions', e.target.value)} /></div>
          <div className="form-group full"><label className="form-label">Remarks</label><textarea className="form-textarea" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} /></div>
        </div>
      )}

      {tab === 'professional' && (
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Education</label><input className="form-input" value={form.education} onChange={e => set('education', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Profession</label><input className="form-input" value={form.profession} onChange={e => set('profession', e.target.value)} /></div>
        </div>
      )}

      {tab === 'sadhana' && (
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Chanting Rounds / day</label>
            <input className="form-input" type="number" min={0} max={64} value={form.chanting_rounds} onChange={e => set('chanting_rounds', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Sessions Before App</label>
            <input className="form-input" type="number" min={0} value={form.prior_sessions} onChange={e => set('prior_sessions', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Reading</label>
            <select className="form-select" value={form.reads_books} onChange={e => set('reads_books', e.target.value)}>
              <option value="">—</option>
              <option>None</option><option>Occasionally</option><option>Regular</option><option>Daily</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Hearing</label>
            <select className="form-select" value={form.hears_katha} onChange={e => set('hears_katha', e.target.value)}>
              <option value="">—</option>
              <option>None</option><option>Occasionally</option><option>Regular</option><option>Daily</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Tilak</label>
            <select className="form-select" value={form.tilak ? '1' : '0'} onChange={e => set('tilak', e.target.value === '1')}>
              <option value="0">No</option><option value="1">Yes</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kanthi</label>
            <select className="form-select" value={form.kanthi ? '1' : '0'} onChange={e => set('kanthi', e.target.value === '1')}>
              <option value="0">No</option><option value="1">Yes</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Gopi Dress</label>
            <select className="form-select" value={form.gopi_dress ? '1' : '0'} onChange={e => set('gopi_dress', e.target.value === '1')}>
              <option value="0">No</option><option value="1">Yes</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Plays an Instrument?</label>
            <select className="form-select" value={form.plays_instrument} onChange={e => set('plays_instrument', e.target.value)}>
              <option value="">—</option><option>Yes</option><option>No</option>
            </select>
          </div>
          {form.plays_instrument === 'Yes' && (
            <div className="form-group">
              <label className="form-label">Which Instrument?</label>
              <select className="form-select" value={form.instrument_name} onChange={e => set('instrument_name', e.target.value)}>
                <option value="">—</option>
                <option>Kartal</option><option>Whomper</option><option>Mridanga</option><option>Harmonium</option><option>Drum</option>
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Wants Kirtan Class?</label>
            <select className="form-select" value={form.wants_kirtan} onChange={e => set('wants_kirtan', e.target.value)}>
              <option value="">—</option><option>Yes</option><option>No</option>
            </select>
          </div>
        </div>
      )}

      {tab === 'family' && (
        <div className="form-grid">
          <div className="form-group"><label className="form-label">Family Members</label><input className="form-input" type="number" min={0} value={form.family_members} onChange={e => set('family_members', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Attending Class</label><input className="form-input" type="number" min={0} value={form.family_participants} onChange={e => set('family_participants', e.target.value)} /></div>
          <div className="form-group">
            <label className="form-label">Favorable to Devotion</label>
            <select className="form-select" value={form.family_favourable} onChange={e => set('family_favourable', e.target.value)}>
              <option value="">—</option>
              <option value="Yes">Yes – Fully supportive</option>
              <option value="Partial">Partial – Some support</option>
              <option value="No">No – Not supportive</option>
            </select>
          </div>
          <div className="form-group full"><label className="form-label">Hobbies</label><textarea className="form-textarea" rows={2} value={form.hobbies} onChange={e => set('hobbies', e.target.value)} /></div>
        </div>
      )}

      {error && <div className="form-error">{error}</div>}

      <div className="form-actions">
        <button className="btn-outline" onClick={() => setTab(FORM_TABS[Math.max(0, tabIdx - 1)])} disabled={tabIdx === 0}>← Prev</button>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        {tabIdx < FORM_TABS.length - 1
          ? <button className="btn-primary" onClick={() => setTab(FORM_TABS[tabIdx + 1])}>Next →</button>
          : <button className="btn-primary" onClick={handleSubmit} disabled={loading}>{loading ? 'Saving…' : editId ? 'Update' : 'Add Devotee'}</button>
        }
      </div>
    </div>
  );
}

// ── Main DevoteesPage ──────────────────────────────────────────────────────────
export default function DevoteesPage() {
  const { filters, dataVersion, showToast } = useApp();
  const { isTeamAdmin, isSuper } = useAuth();
  const [devotees, setDevotees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Debounce search input by 300ms so we don't hit DB on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  const [selectedId, setSelectedId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await DB.getDevotees({ search: debouncedSearch, team: filters.team, callingBy: filters.callingBy, status: statusFilter });
    setDevotees(list);
    setLoading(false);
  }, [debouncedSearch, filters.team, filters.callingBy, statusFilter, dataVersion]);

  useEffect(() => { load(); }, [load]);

  function openEdit(id) { setEditId(id); setShowForm(true); setSelectedId(null); }
  function openNew() { setEditId(null); setShowForm(true); }

  async function exportAllToExcel() {
    const all = await DB.getDevotees({});
    if (all.length === 0) { showToast?.('No devotees to export', 'warning'); return; }

    // Full column set with grouped headers (Identity | Team | Professional | Sadhana | Family)
    const groupHeaders = [
      '#',
      'Identity', '', '', '', '', '',
      'Team Management', '', '', '', '', '',
      'Professional', '',
      'Sadhana & Practices', '', '', '', '', '', '', '', '', '',
      'Social & Family', '', '', '',
    ];
    const colHeaders = [
      'Sr.No',
      'Full Name','Date of Birth','Mobile','Mobile Alt','Address','Email',
      'Team','Status','Joining Date','Reference By','Facilitator','Calling By',
      'Education','Profession',
      'Daily Chanting Rounds','Sessions Before App','Reading','Hearing','Tilak','Kanthi','Gopi Dress','Plays Instrument','Instrument Name','Wants Kirtan',
      'Total Family Members','Family Members in Class','Family Favorable','Hobbies','Remarks',
    ];

    function rowFor(d, i) {
      return [
        i + 1,
        d.name||'', d.dob||'', d.mobile||'', d.mobile_alt||'', d.address||'', d.email||'',
        d.team_name||'', d.devotee_status||'', d.joining_date||'', d.reference_by||'', d.facilitator||'', d.calling_by||'',
        d.education||'', d.profession||'',
        d.chanting_rounds||0, d.prior_sessions||0, d.reads_books||'', d.hears_katha||'',
        d.tilak?'Yes':'No', d.kanthi?'Yes':'No', d.gopi_dress?'Yes':'No',
        d.plays_instrument||'', d.instrument_name||'', d.wants_kirtan||'',
        d.family_members ?? '', d.family_participants ?? '', d.family_favourable||'', d.hobbies||'', d.remarks||'',
      ];
    }

    function makeSheet(devs) {
      const rows = [groupHeaders, colHeaders, ...devs.map(rowFor)];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      // Set reasonable column widths
      ws['!cols'] = colHeaders.map((_, i) => ({ wch: i === 0 ? 5 : 16 }));
      // Freeze the top 2 header rows + the Sr.No column
      ws['!freeze'] = { xSplit: 1, ySplit: 2 };
      // Merge the grouped header cells
      ws['!merges'] = [
        { s: { r: 0, c: 1 },  e: { r: 0, c: 6 } },   // Identity
        { s: { r: 0, c: 7 },  e: { r: 0, c: 12 } },  // Team Management
        { s: { r: 0, c: 13 }, e: { r: 0, c: 14 } },  // Professional
        { s: { r: 0, c: 15 }, e: { r: 0, c: 24 } },  // Sadhana
        { s: { r: 0, c: 25 }, e: { r: 0, c: 29 } },  // Family
      ];
      return ws;
    }

    function flatSheet(devs) {
      // Re-Import-friendly flat sheet — single header row, no merges
      const rows = [colHeaders.slice(1), ...devs.map(d => rowFor(d, 0).slice(1))];
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = colHeaders.slice(1).map(() => ({ wch: 16 }));
      return ws;
    }

    const wb = XLSX.utils.book_new();

    // 1) "All Teams" sheet (everyone, grouped headers)
    XLSX.utils.book_append_sheet(wb, makeSheet(all), 'All Teams');

    // 2) Per-team sheets — one per team that has devotees
    const byTeam = {};
    all.forEach(d => {
      const t = d.team_name || 'Other';
      (byTeam[t] = byTeam[t] || []).push(d);
    });
    Object.entries(byTeam).sort(([a],[b]) => a.localeCompare(b)).forEach(([team, devs]) => {
      const sheetName = `Team_${team}`.slice(0, 31); // Excel 31-char limit
      XLSX.utils.book_append_sheet(wb, makeSheet(devs), sheetName);
    });

    // 3) "Re-Import (Flat)" sheet — for round-tripping back into Import Excel
    XLSX.utils.book_append_sheet(wb, flatSheet(all), 'Re-Import (Flat)');

    // 4) "Overall" stats sheet
    const overall = [
      ['Sakhi Sang — Devotee Database Export'],
      ['Exported on', new Date().toLocaleString('en-IN')],
      ['Total active devotees', all.length],
      [],
      ['Per-team count'],
      ...Object.entries(byTeam).sort(([a],[b]) => a.localeCompare(b)).map(([t, list]) => [t, list.length]),
      [],
      ['Per-status count'],
      ...['Most Serious','Serious','Expected to be Serious','New Devotee','Inactive'].map(s =>
        [s, all.filter(d => d.devotee_status === s).length]
      ),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(overall), 'Overall');

    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    XLSX.writeFile(wb, `Sakhi-Sang-Devotees-${stamp}.xlsx`);
    showToast?.(`Exported ${all.length} devotees across ${Object.keys(byTeam).length} teams`, 'success');
  }

  return (
    <div className="tab-page">
      {/* Prominent profiles card with Import/Export buttons */}
      {isSuper && (
        <div className="devotee-profiles-card">
          <div className="dpc-header">
            <span className="dpc-icon">🌸</span>
            <span className="dpc-title">Devotee Profiles</span>
          </div>
          <div className="dpc-actions">
            <button className="btn-outline" onClick={() => setShowImport(true)}>
              <span style={{fontSize:'1.1rem'}}>📥</span> Import Excel
            </button>
            <button className="btn-outline" onClick={exportAllToExcel}>
              <span style={{fontSize:'1.1rem'}}>💾</span> Export DB
            </button>
          </div>
        </div>
      )}

      {/* Search + status filter */}
      <div className="devotees-search-card">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input className="form-input" placeholder="Search by name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          {['Most Serious','Serious','Expected to be Serious','New Devotee','Inactive'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="list-count">{loading ? 'Loading…' : `${devotees.length} devotee${devotees.length !== 1 ? 's' : ''} found`}</div>

      {loading ? (
        <div className="loading-spinner" />
      ) : devotees.length === 0 ? (
        <div className="empty-state">No devotees found</div>
      ) : (
        <div className="devotee-list">
          {devotees.map(d => <DevoteeItem key={d.id} d={d} onOpen={id => setSelectedId(id)} />)}
        </div>
      )}

      {/* Profile modal */}
      <Modal open={!!selectedId} onClose={() => setSelectedId(null)} title="Devotee Profile" size="lg" noPad>
        {selectedId && <ProfileModal devoteeId={selectedId} onClose={() => setSelectedId(null)} onEdit={id => { setSelectedId(null); openEdit(id); }} onNavigate={(id) => setSelectedId(id)} />}
      </Modal>

      {/* Form modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editId ? 'Edit Devotee' : 'Add Devotee'} size="lg">
        {showForm && <DevoteeForm editId={editId} onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); load(); }} />}
      </Modal>

      {/* FAB for adding a new devotee — visible to coordinators+ */}
      {isTeamAdmin && <FAB icon="+" label="New Devotee" onClick={openNew} />}

      {/* Excel Import modal */}
      <ExcelImport open={showImport} onClose={() => setShowImport(false)} onImported={load} />
    </div>
  );
}
