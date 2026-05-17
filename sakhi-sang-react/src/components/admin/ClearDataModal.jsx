import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useApp } from '../../context/AppContext';
import { TEAMS } from '../../firebase/config';
import {
  collection, getDocs, query, where, writeBatch, doc, deleteDoc, updateDoc, increment
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { bustCache } from '../../firebase/db';
import { chunkArray } from '../../utils/helpers';

async function deleteCollection(colName, constraints = []) {
  const q = constraints.length ? query(collection(db, colName), ...constraints) : collection(db, colName);
  const snap = await getDocs(q);
  const chunks = chunkArray(snap.docs, 400);
  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

export default function ClearDataModal({ open, onClose }) {
  const { showToast } = useApp();
  const [mode, setMode] = useState('date'); // date | team | all
  const [date, setDate] = useState('');
  const [team, setTeam] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);

  async function clearByDate() {
    if (!date) { showToast('Select a date', 'error'); return; }
    if (!confirm(`Delete ALL attendance and calling data for ${date}?`)) return;
    setLoading(true);
    try {
      // Find session for date
      const sessSnap = await getDocs(query(collection(db, 'sessions'), where('session_date', '==', date)));
      const sessionIds = sessSnap.docs.map(d => d.id);

      // Delete attendance records
      for (const sid of sessionIds) {
        await deleteCollection('attendanceRecords', [where('session_id', '==', sid)]);
      }
      // Delete calling status for Saturday before
      const sat = new Date(date); sat.setDate(sat.getDate() - 1);
      const satStr = sat.toISOString().slice(0, 10);
      await deleteCollection('callingStatus', [where('week_date', '==', satStr)]);
      await deleteCollection('callingSubmissions', [where('week_date', '==', satStr)]);

      bustCache();
      showToast('Data cleared for ' + date, 'success');
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  async function clearByTeamDate() {
    if (!date || !team) { showToast('Select date and team', 'error'); return; }
    if (!confirm(`Delete attendance data for team ${team} on ${date}?`)) return;
    setLoading(true);
    try {
      const sessSnap = await getDocs(query(collection(db, 'sessions'), where('session_date', '==', date)));
      for (const s of sessSnap.docs) {
        const attSnap = await getDocs(query(collection(db, 'attendanceRecords'), where('session_id', '==', s.id), where('team_name', '==', team)));
        for (const a of attSnap.docs) {
          // Decrement lifetime attendance
          const devId = a.data().devotee_id;
          if (devId) await updateDoc(doc(db, 'devotees', devId), { lifetimeAttendance: increment(-1) });
          await deleteDoc(a.ref);
        }
      }
      bustCache();
      showToast(`Cleared ${team} data for ${date}`, 'success');
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  async function clearAll() {
    if (confirmText !== 'DELETE ALL') { showToast('Type DELETE ALL to confirm', 'error'); return; }
    setLoading(true);
    try {
      const cols = ['attendanceRecords', 'callingStatus', 'callingSubmissions', 'callingWeekHistory', 'profileChanges', 'sessions'];
      for (const col of cols) await deleteCollection(col);
      // Reset lifetime attendance on all devotees
      const devSnap = await getDocs(collection(db, 'devotees'));
      const chunks = chunkArray(devSnap.docs, 400);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => batch.update(d.ref, { lifetimeAttendance: 0, inactivityFlag: false }));
        await batch.commit();
      }
      bustCache();
      showToast('All data cleared', 'success');
      setConfirmText('');
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Clear Data (SuperAdmin)">
      <div className="clear-mode-tabs">
        {[['date', 'By Date'], ['team', 'By Team+Date'], ['all', 'Clear All']].map(([m, l]) => (
          <button key={m} className={`sub-tab-btn${mode === m ? ' active' : ''}`} onClick={() => setMode(m)}>{l}</button>
        ))}
      </div>

      {mode === 'date' && (
        <div className="mt-3">
          <p className="text-muted mb-3">Deletes all attendance + calling records for the selected session date.</p>
          <div className="form-group"><label className="form-label">Session Date (Sunday)</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <button className="btn-danger" onClick={clearByDate} disabled={loading || !date}>{loading ? 'Clearing…' : 'Clear This Date'}</button>
        </div>
      )}

      {mode === 'team' && (
        <div className="mt-3">
          <p className="text-muted mb-3">Deletes attendance for a specific team on a session date.</p>
          <div className="form-group"><label className="form-label">Session Date</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Team</label>
            <select className="form-select" value={team} onChange={e => setTeam(e.target.value)}>
              <option value="">Select team</option>
              {TEAMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>
          <button className="btn-danger" onClick={clearByTeamDate} disabled={loading || !date || !team}>{loading ? 'Clearing…' : 'Clear Team Data'}</button>
        </div>
      )}

      {mode === 'all' && (
        <div className="mt-3">
          <div className="auth-error" style={{ marginBottom: 16 }}>
            ⚠ This will permanently delete ALL attendance, calling, sessions, and profile history. This cannot be undone.
          </div>
          <div className="form-group"><label className="form-label">Type <strong>DELETE ALL</strong> to confirm</label>
            <input className="form-input" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="DELETE ALL" /></div>
          <button className="btn-danger" onClick={clearAll} disabled={loading || confirmText !== 'DELETE ALL'}>{loading ? 'Clearing…' : 'Clear Everything'}</button>
        </div>
      )}
    </Modal>
  );
}
