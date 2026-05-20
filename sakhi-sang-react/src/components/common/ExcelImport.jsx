import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { DB } from '../../firebase/db';
import { useApp } from '../../context/AppContext';

// Column-name aliases → canonical field name (matches original Excel.js import map)
const ALIASES = {
  name:            ['name', 'fullname', 'full name', 'devotee name', 'devoteename'],
  mobile:          ['mobile', 'phone', 'contact', 'mobile number', 'phone number', 'primary mobile'],
  mobile_alt:      ['alt mobile', 'mobile alt', 'alternate mobile', 'mobile 2', 'second mobile'],
  email:           ['email', 'email id', 'mail'],
  dob:             ['dob', 'date of birth', 'birthday', 'birth date'],
  address:         ['address', 'residential address', 'home address'],
  team_name:       ['team', 'team name', 'team_name', 'assigned team'],
  devotee_status:  ['status', 'devotee status', 'category', 'level'],
  reference_by:    ['reference', 'reference by', 'referred by', 'reference person', 'ref', 'reference_by'],
  facilitator:     ['facilitator', 'mentor'],
  calling_by:      ['calling by', 'calling_by', 'coordinator', 'coordinator name'],
  education:       ['education', 'qualification'],
  profession:      ['profession', 'occupation', 'job'],
  chanting_rounds: ['chanting rounds', 'cr', 'rounds', 'japa rounds'],
  joining_date:    ['joining date', 'joined', 'admission date', 'joining'],
  remarks:         ['remarks', 'note', 'notes', 'comments'],
};

function detectColumn(header) {
  if (!header) return null;
  const h = String(header).trim().toLowerCase();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

// Parse Excel-serial-date or YYYY-MM-DD / DD-MM-YYYY / DD/MM/YYYY into YYYY-MM-DD
function importDate(v) {
  if (!v) return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return s;
}

// Build a transformed payload from a row using current mapping
function rowToPayload(row, mapping) {
  const p = {};
  for (const [field, idx] of Object.entries(mapping)) {
    if (idx == null || idx === '') continue;
    let v = row[idx];
    if (v == null) continue;
    if (field === 'dob' || field === 'joining_date') v = importDate(v);
    else v = String(v).trim();
    p[field] = v;
  }
  return p;
}

export default function ExcelImport({ open, onClose, onImported }) {
  const { showToast } = useApp();
  const fileRef = useRef(null);
  const [step, setStep] = useState('upload'); // upload | mapping | preview | result
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [mode, setMode] = useState('add');
  const [previewData, setPreviewData] = useState(null); // { newRows: [], dupRows: [], blankRows: [] }
  const [includeNew, setIncludeNew] = useState({});      // index → bool
  const [includeDup, setIncludeDup] = useState({});      // index → bool (Add Anyway / Update)
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep('upload'); setRows([]); setHeaders([]); setMapping({});
    setPreviewData(null); setIncludeNew({}); setIncludeDup({}); setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function handleFile(e) {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (data.length < 2) { showToast('Excel file is empty', 'error'); return; }
      const hdr = data[0].map(h => String(h || ''));
      const dataRows = data.slice(1).filter(r => r.some(c => c !== '' && c != null));
      setHeaders(hdr); setRows(dataRows);
      const detected = {};
      hdr.forEach((h, i) => { const f = detectColumn(h); if (f) detected[f] = i; });
      setMapping(detected);
      setStep('mapping');
    };
    reader.readAsBinaryString(f);
  }

  async function buildPreview() {
    if (mapping.name == null) { showToast('Please map at least the Name column', 'error'); return; }
    setLoading(true);
    try {
      const existing = await DB.getDevotees({});
      const existingMap = new Map();
      existing.forEach(d => {
        const key = `${(d.name || '').toLowerCase()}__${d.mobile || ''}`;
        existingMap.set(key, d);
      });

      const newRows = [], dupRows = [], blankRows = [];
      rows.forEach((row, idx) => {
        const payload = rowToPayload(row, mapping);
        if (!payload.name) { blankRows.push({ idx, payload, raw: row }); return; }
        const key = `${payload.name.toLowerCase()}__${payload.mobile || ''}`;
        const match = existingMap.get(key);
        if (match) dupRows.push({ idx, payload, raw: row, match });
        else newRows.push({ idx, payload, raw: row });
      });

      // Default: all new rows included, all duplicates excluded (in Add mode)
      const newSel = {}, dupSel = {};
      newRows.forEach(r => { newSel[r.idx] = true; });
      dupRows.forEach(r => { dupSel[r.idx] = mode === 'upsert'; });
      setIncludeNew(newSel); setIncludeDup(dupSel);
      setPreviewData({ newRows, dupRows, blankRows });
      setStep('preview');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  async function doImport() {
    if (!previewData) return;
    setLoading(true);
    try {
      const toCreate = previewData.newRows.filter(r => includeNew[r.idx]);
      const toUpsert = previewData.dupRows.filter(r => includeDup[r.idx]);

      let imported = 0, updated = 0, skipped = 0, errors = 0;
      // Use forceCreate for selected duplicates (don't trigger duplicate-error)
      // For 'add' mode, dup rows that are checked are treated as 'add anyway'
      for (const r of toCreate) {
        try { await DB.forceCreateDevotee(r.payload); imported++; }
        catch (e) { console.error(e); errors++; }
      }
      for (const r of toUpsert) {
        try {
          if (mode === 'upsert') {
            await DB.updateDevotee(r.match.id, r.payload);
            updated++;
          } else {
            await DB.forceCreateDevotee(r.payload);
            imported++;
          }
        } catch (e) { console.error(e); errors++; }
      }
      skipped = (previewData.newRows.length - toCreate.length) + (previewData.dupRows.length - toUpsert.length);
      setResult({ imported, updated, skipped, errors, blank: previewData.blankRows.length });
      setStep('result');
      onImported?.();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="📤 Import Devotees from Excel" size="lg">

      {step === 'upload' && (
        <div>
          <p className="text-muted mb-3" style={{fontSize:'.85rem'}}>
            Upload an .xlsx with column headers in row 1. These columns are auto-detected:
            <strong> Name, Mobile, Alt Mobile, Email, DOB, Address, Team, Status, Reference, Calling By, Facilitator, Education, Profession, Rounds, Joining Date, Remarks.</strong>
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          <button className="btn-primary" onClick={() => fileRef.current?.click()}>📁 Choose Excel File</button>
        </div>
      )}

      {step === 'mapping' && (
        <div>
          <div className="section-header">
            <div>
              <strong>{rows.length} rows in file</strong>
              <div className="text-muted" style={{fontSize:'.78rem'}}>Confirm or adjust column mapping below, then continue to duplicate check.</div>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Mode</label>
              <select className="form-select sm" value={mode} onChange={e => setMode(e.target.value)}>
                <option value="add">Add only (skip duplicates)</option>
                <option value="upsert">Update if exists</option>
              </select>
            </div>
          </div>
          <h4 className="form-label" style={{marginTop:12}}>Column Mapping</h4>
          <div className="form-grid">
            {Object.keys(ALIASES).map(field => (
              <div className="form-group" key={field}>
                <label className="form-label">{field.replace(/_/g,' ')}</label>
                <select className="form-select sm" value={mapping[field] ?? ''} onChange={e => setMapping(m => ({ ...m, [field]: e.target.value === '' ? null : Number(e.target.value) }))}>
                  <option value="">— ignore —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{i+1}. {h || '(unnamed)'}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn-outline" onClick={reset}>← Back</button>
            <button className="btn-primary" onClick={buildPreview} disabled={loading || mapping.name == null}>
              {loading ? 'Checking…' : 'Next: Check Duplicates →'}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && previewData && (
        <div>
          <div className="import-stats">
            <div className="import-stat new"><strong>{previewData.newRows.length}</strong><span>new</span></div>
            <div className="import-stat dup"><strong>{previewData.dupRows.length}</strong><span>duplicates</span></div>
            <div className="import-stat blank"><strong>{previewData.blankRows.length}</strong><span>blank</span></div>
          </div>

          {previewData.newRows.length > 0 && (
            <details className="import-section" open>
              <summary><strong>✨ New devotees ({previewData.newRows.length})</strong> — uncheck to skip</summary>
              <table className="simple-table">
                <thead><tr><th><input type="checkbox" checked={previewData.newRows.every(r => includeNew[r.idx])} onChange={e => {
                  const v = e.target.checked; const next = { ...includeNew };
                  previewData.newRows.forEach(r => next[r.idx] = v); setIncludeNew(next);
                }} /></th><th>Name</th><th>Mobile</th><th>Team</th><th>Status</th></tr></thead>
                <tbody>
                  {previewData.newRows.map(r => (
                    <tr key={r.idx}>
                      <td><input type="checkbox" checked={!!includeNew[r.idx]} onChange={e => setIncludeNew(s => ({ ...s, [r.idx]: e.target.checked }))} /></td>
                      <td>{r.payload.name}</td>
                      <td>{r.payload.mobile || '—'}</td>
                      <td>{r.payload.team_name || '—'}</td>
                      <td>{r.payload.devotee_status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {previewData.dupRows.length > 0 && (
            <details className="import-section">
              <summary><strong>⚠ Duplicates ({previewData.dupRows.length})</strong> — same name+mobile already exists. {mode === 'upsert' ? 'They will be updated.' : 'Check "Add Anyway" to create duplicate.'}</summary>
              <table className="simple-table">
                <thead><tr><th>{mode === 'upsert' ? 'Update' : 'Add Anyway'}</th><th>Name</th><th>Mobile</th><th>Existing Team</th></tr></thead>
                <tbody>
                  {previewData.dupRows.map(r => (
                    <tr key={r.idx}>
                      <td><input type="checkbox" checked={!!includeDup[r.idx]} onChange={e => setIncludeDup(s => ({ ...s, [r.idx]: e.target.checked }))} /></td>
                      <td>{r.payload.name}</td>
                      <td>{r.payload.mobile || '—'}</td>
                      <td className="text-muted">{r.match.team_name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}

          {previewData.blankRows.length > 0 && (
            <details className="import-section">
              <summary><strong>🚫 Blank rows ({previewData.blankRows.length})</strong> — no name, will be skipped</summary>
            </details>
          )}

          <div className="form-actions">
            <button className="btn-outline" onClick={() => setStep('mapping')}>← Back to Mapping</button>
            <button className="btn-primary" onClick={doImport} disabled={loading}>
              {loading ? 'Importing…' : 'Import Selected'}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && result && (
        <div className="import-result">
          <div className="import-result-icon">✅</div>
          <h3>Import complete</h3>
          <div className="import-result-stats">
            <div><strong>{result.imported}</strong> imported</div>
            <div><strong>{result.updated}</strong> updated</div>
            <div><strong>{result.skipped}</strong> skipped</div>
            <div><strong>{result.blank}</strong> blank</div>
            {result.errors > 0 && <div className="text-danger"><strong>{result.errors}</strong> errors</div>}
          </div>
          <div className="form-actions">
            <button className="btn-outline" onClick={reset}>Import Another</button>
            <button className="btn-primary" onClick={() => { reset(); onClose(); }}>Done</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
