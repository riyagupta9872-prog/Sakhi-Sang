import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { DB } from '../../firebase/db';
import { formatDate, tsToISO } from '../../utils/helpers';

const CALLING_REASON_LABELS = {
  did_not_pick: 'Did not pick', incoming_na: 'Incoming N/A', wrong_number: 'Wrong number',
  out_of_station: 'Out of station', exams: 'Exams/Study', online_class: 'Online class',
  festival_calling: 'Festival', not_interested_now: 'Not interested', other: 'Other',
};

// ── Profile change history (field-level audit) ─────────────────────────────
export function ProfileHistoryModal({ open, devoteeId, onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !devoteeId) return;
    setLoading(true);
    DB.getProfileHistory(devoteeId).then(h => { setList(h); setLoading(false); });
  }, [open, devoteeId]);

  const FIELD_LABELS = {
    name: 'Name', mobile: 'Mobile', chanting_rounds: 'Chanting Rounds',
    kanthi: 'Kanthi', gopi_dress: 'Gopi Dress', team_name: 'Team',
    devotee_status: 'Status', facilitator: 'Facilitator',
    reference_by: 'Reference', calling_by: 'Calling By', remarks: 'Remarks',
  };

  return (
    <Modal open={open} onClose={onClose} title="Profile Change History" size="md">
      {loading ? <div className="loading-spinner" /> :
        list.length === 0 ? <div className="empty-state">No changes recorded yet</div> :
        <table className="simple-table">
          <thead><tr><th>Field</th><th>From</th><th>To</th><th>By</th><th>When</th></tr></thead>
          <tbody>
            {list.map((h, i) => (
              <tr key={i}>
                <td><strong>{FIELD_LABELS[h.field] || h.field}</strong></td>
                <td className="text-muted">{h.oldValue || '—'}</td>
                <td>{h.newValue || '—'}</td>
                <td>{h.changedBy || '—'}</td>
                <td className="text-muted" style={{ fontSize: '.75rem' }}>
                  {h.changedAtClient ? new Date(h.changedAtClient).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </Modal>
  );
}

// ── Team Change History (devotee team reassignments) ────────────────────────
export function TeamChangeHistoryModal({ open, devoteeId, devoteeName, currentTeam, onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !devoteeId) return;
    setLoading(true);
    DB.getTeamChangeHistory(devoteeId).then(h => { setList(h); setLoading(false); });
  }, [open, devoteeId]);

  return (
    <Modal open={open} onClose={onClose} title={`🔄 Team Change History — ${devoteeName || ''}`} size="md">
      <div className="text-muted mb-3" style={{ fontSize: '.82rem' }}>
        Current team: <strong style={{ color: '#1a1a1a' }}>{currentTeam || '—'}</strong>
      </div>
      {loading ? <div className="loading-spinner" /> :
        list.length === 0 ? <div className="empty-state">No team changes recorded</div> :
        <table className="simple-table">
          <thead><tr><th>When</th><th>By</th><th>From</th><th>To</th></tr></thead>
          <tbody>
            {list.map((h, i) => (
              <tr key={i}>
                <td className="text-muted" style={{ fontSize: '.75rem' }}>
                  {h.changedAtClient ? new Date(h.changedAtClient).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
                <td>{h.changedBy || '—'}</td>
                <td className="text-muted">{h.oldValue || '—'}</td>
                <td><strong>{h.newValue || '—'}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </Modal>
  );
}

// ── Calling Status Change History (field-level audit of calling edits) ────
export function CallingStatusChangesModal({ open, devoteeId, devoteeName, onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !devoteeId) return;
    setLoading(true);
    DB.getCallingStatusChanges(devoteeId).then(h => { setList(h); setLoading(false); });
  }, [open, devoteeId]);

  const FIELD_LABELS = {
    coming_status: 'Coming Status',
    calling_reason: 'Reason',
    calling_notes: 'Notes',
    available_from: 'Available From',
  };
  const valueLabel = (field, v) => {
    if (!v) return '—';
    if (field === 'calling_reason') return CALLING_REASON_LABELS[v] || v;
    if (field === 'available_from') return formatDate(v);
    return v;
  };

  return (
    <Modal open={open} onClose={onClose} title={`📋 Calling Status Edits — ${devoteeName || ''}`} size="md">
      {loading ? <div className="loading-spinner" /> :
        list.length === 0 ? <div className="empty-state">No status edits recorded yet</div> :
        <table className="simple-table">
          <thead><tr><th>Field</th><th>From</th><th>To</th><th>By</th><th>Week</th><th>When</th></tr></thead>
          <tbody>
            {list.map((h, i) => (
              <tr key={i}>
                <td><strong>{FIELD_LABELS[h.field] || h.field}</strong></td>
                <td className="text-muted">{valueLabel(h.field, h.oldValue)}</td>
                <td>{valueLabel(h.field, h.newValue)}</td>
                <td>{h.changedBy || '—'}</td>
                <td>{h.weekDate ? formatDate(h.weekDate) : '—'}</td>
                <td className="text-muted" style={{ fontSize: '.74rem' }}>
                  {h.changedAtClient ? new Date(h.changedAtClient).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    </Modal>
  );
}

// ── Calling history (4-week record per devotee) ────────────────────────────
export function CallingHistoryModal({ open, devoteeId, devoteeName, onClose }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !devoteeId) return;
    setLoading(true);
    DB.getCallingHistory(devoteeId, 4).then(h => { setList(h); setLoading(false); });
  }, [open, devoteeId]);

  return (
    <Modal open={open} onClose={onClose} title={`🕒 Calling History — ${devoteeName || ''}`} size="md">
      {loading ? <div className="loading-spinner" /> :
        list.length === 0 ? <div className="empty-state">No calling history yet</div> :
        <div className="calling-history-list">
          {list.map((h, i) => (
            <div key={i} className="calling-history-entry">
              <div className="ch-week">📅 {formatDate(h.week_date || h.weekDate)}</div>
              <div className="ch-status">
                {h.coming_status === 'Yes'
                  ? <span className="badge-confirmed">Coming ✓</span>
                  : h.calling_reason
                    ? <span className="badge-reason">{CALLING_REASON_LABELS[h.calling_reason] || h.calling_reason}</span>
                    : <span className="text-muted">Not called</span>}
                {h.available_from && <span className="text-muted ml-2">· Available from {formatDate(h.available_from)}</span>}
              </div>
              {h.calling_notes && <div className="ch-notes">{h.calling_notes}</div>}
              <div className="ch-caller text-muted">— {h.calling_by || h.callingBy || '—'}</div>
            </div>
          ))}
        </div>
      }
    </Modal>
  );
}
