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
import { ProfileHistoryModal, CallingHistoryModal } from '../components/common/DevoteeHistoryModals';

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
        <div className="devotee-meta">
          {d.mobile && <span>📱 {d.mobile}</span>}
          {d.team_name && <span className="badge badge-team">{d.team_name}</span>}
          {d.devotee_status && <span className={`badge ${statusBadge(d.devotee_status)}`}>{d.devotee_status}</span>}
        </div>
        {d.reference_by && <div className="devotee-ref">Ref: {d.reference_by}</div>}
      </div>
      <div className="devotee-actions">
        {d.mobile && <a href={`tel:${d.mobile}`} className="btn-icon" onClick={e => e.stopPropagation()}>📞</a>}
        {d.mobile && <a href={`https://wa.me/91${d.mobile}`} className="btn-icon" target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>💬</a>}
      </div>
    </div>
  );
}

// ── Profile Modal ──────────────────────────────────────────────────────────────
function ProfileModal({ devoteeId, onClose, onEdit }) {
  const [d, setD] = useState(null);
  const [activeTab, setActiveTab] = useState('identity');
  const [showProfileHistory, setShowProfileHistory] = useState(false);
  const [showCallingHistory, setShowCallingHistory] = useState(false);
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
            <dt>Referred By</dt><dd>{d.reference_by || '—'}</dd>
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
                  <div key={r.id} className="referred-item">
                    <span className="devotee-avatar sm">{avatarInitials(r.name)}</span>
                    <span>{r.name}</span>
                    <span className="badge badge-team">{r.team_name}</span>
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
        {d.mobile && <a href={`tel:${d.mobile}`} className="btn-outline">📞 Call</a>}
        {d.mobile && <a href={`https://wa.me/91${d.mobile}`} className="btn-outline" target="_blank" rel="noreferrer">💬 WhatsApp</a>}
        {isSuper && <button className="btn-outline" onClick={handleNotInterested}>✕ Not Interested</button>}
        {isSuper && <button className="btn-danger" onClick={handleDelete}>🗑 Delete</button>}
      </div>

      <ProfileHistoryModal open={showProfileHistory} devoteeId={devoteeId} onClose={() => setShowProfileHistory(false)} />
      <CallingHistoryModal open={showCallingHistory} devoteeId={devoteeId} devoteeName={d.name} onClose={() => setShowCallingHistory(false)} />
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
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (form.mobile && !/^\d{10}$/.test(form.mobile)) { setError('Mobile must be 10 digits'); return; }
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
            <label className="form-label">Reference Person</label>
            <DevoteePicker value={form.reference_by} onChange={v => { set('reference_by', v.name); set('reference_id', v.id); }} placeholder="Search devotee…" />
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
          <div className="form-group"><label className="form-label">Chanting Rounds/day</label><input className="form-input" type="number" min={0} value={form.chanting_rounds} onChange={e => set('chanting_rounds', e.target.value)} /></div>
          <div className="form-group">
            <label className="form-label">Attire</label>
            <div className="checkbox-row">
              <label><input type="checkbox" checked={!!form.tilak} onChange={e => set('tilak', e.target.checked)} /> Tilak</label>
              <label><input type="checkbox" checked={!!form.kanthi} onChange={e => set('kanthi', e.target.checked)} /> Kanthi</label>
              <label><input type="checkbox" checked={!!form.gopi_dress} onChange={e => set('gopi_dress', e.target.checked)} /> Gopi Dress</label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Reads Books</label>
            <select className="form-select" value={form.reads_books} onChange={e => set('reads_books', e.target.value)}>
              <option value="">—</option>
              <option>Regularly</option><option>Sometimes</option><option>Rarely</option><option>No</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Hears Katha</label>
            <select className="form-select" value={form.hears_katha} onChange={e => set('hears_katha', e.target.value)}>
              <option value="">—</option>
              <option>Regularly</option><option>Sometimes</option><option>Rarely</option><option>No</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Plays Instrument</label>
            <select className="form-select" value={form.plays_instrument} onChange={e => set('plays_instrument', e.target.value)}>
              <option>No</option><option>Yes</option>
            </select>
          </div>
          {form.plays_instrument === 'Yes' && (
            <div className="form-group"><label className="form-label">Instrument Name</label><input className="form-input" value={form.instrument_name} onChange={e => set('instrument_name', e.target.value)} /></div>
          )}
          <div className="form-group">
            <label className="form-label">Wants Kirtan Class</label>
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
            <label className="form-label">Family Attitude</label>
            <select className="form-select" value={form.family_favourable} onChange={e => set('family_favourable', e.target.value)}>
              <option value="">—</option>
              <option>Very Favourable</option><option>Favourable</option><option>Neutral</option><option>Unfavourable</option>
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
  const { filters } = useApp();
  const { isTeamAdmin, isSuper } = useAuth();
  const [devotees, setDevotees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await DB.getDevotees({ search, team: filters.team, callingBy: filters.callingBy, status: statusFilter });
    setDevotees(list);
    setLoading(false);
  }, [search, filters.team, filters.callingBy, statusFilter]);

  useEffect(() => { load(); }, [load]);

  function openEdit(id) { setEditId(id); setShowForm(true); setSelectedId(null); }
  function openNew() { setEditId(null); setShowForm(true); }

  return (
    <div className="tab-page">
      {/* Toolbar */}
      <div className="page-toolbar">
        <div className="search-box">
          <input className="form-input" placeholder="Search name or mobile…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All status</option>
          {['Most Serious','Serious','Expected to be Serious','New Devotee','Inactive'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {isTeamAdmin && (
          <button className="btn-primary" onClick={openNew}>+ New Devotee</button>
        )}
      </div>

      <div className="list-count">{loading ? 'Loading…' : `${devotees.length} devotee${devotees.length !== 1 ? 's' : ''}`}</div>

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
        {selectedId && <ProfileModal devoteeId={selectedId} onClose={() => setSelectedId(null)} onEdit={id => { setSelectedId(null); openEdit(id); }} />}
      </Modal>

      {/* Form modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title={editId ? 'Edit Devotee' : 'Add Devotee'} size="lg">
        {showForm && <DevoteeForm editId={editId} onClose={() => setShowForm(false)} onSave={() => { setShowForm(false); load(); }} />}
      </Modal>

      {/* FAB for adding a new devotee — visible to coordinators+ */}
      {isTeamAdmin && <FAB icon="+" label="New Devotee" onClick={openNew} />}
    </div>
  );
}
