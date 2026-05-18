import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Modal from './Modal';
import { DB } from '../../firebase/db';
import { useApp } from '../../context/AppContext';

// Column-name aliases → canonical field name
const ALIASES = {
  name:            ['name', 'devotee name', 'full name'],
  mobile:          ['mobile', 'phone', 'contact', 'mobile number'],
  mobile_alt:      ['alt mobile', 'mobile alt', 'alternate mobile'],
  email:           ['email', 'email id'],
  dob:             ['dob', 'date of birth', 'birthday'],
  address:         ['address'],
  team_name:       ['team', 'team name', 'team_name'],
  devotee_status:  ['status', 'devotee status', 'category'],
  reference_by:    ['reference', 'reference by', 'referred by', 'ref'],
  facilitator:     ['facilitator'],
  calling_by:      ['calling by', 'calling_by', 'coordinator'],
  education:       ['education', 'qualification'],
  profession:      ['profession', 'occupation', 'job'],
  chanting_rounds: ['chanting rounds', 'cr', 'rounds'],
  joining_date:    ['joining date', 'joined', 'admission date'],
  remarks:         ['remarks', 'note', 'notes'],
};

function detectColumn(header) {
  if (!header) return null;
  const h = String(header).trim().toLowerCase();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

export default function ExcelImport({ open, onClose, onImported }) {
  const { showToast } = useApp();
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [mode, setMode] = useState('add');
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  function handleFile(e) {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (data.length < 2) { showToast('Excel file is empty', 'error'); return; }
      const hdr = data[0].map(h => String(h || ''));
      const dataRows = data.slice(1).filter(r => r.some(c => c !== '' && c != null));
      setHeaders(hdr);
      setRows(dataRows);
      // Auto-detect mapping
      const detected = {};
      hdr.forEach((h, i) => {
        const f = detectColumn(h);
        if (f) detected[f] = i;
      });
      setMapping(detected);
      setStep('preview');
    };
    reader.readAsBinaryString(f);
  }

  async function doImport() {
    if (mapping.name == null) { showToast('Please map at least the Name column', 'error'); return; }
    const records = rows.map(row => {
      const rec = {};
      for (const [field, idx] of Object.entries(mapping)) {
        if (idx != null && idx !== '') {
          let v = row[idx];
          if (v instanceof Date) v = v.toISOString().slice(0, 10);
          rec[field] = v != null ? String(v).trim() : '';
        }
      }
      return rec;
    }).filter(r => r.name);

    setLoading(true);
    try {
      const res = await DB.importDevotees(records, mode);
      setResult(res);
      setStep('done');
      onImported?.();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  }

  function reset() {
    setRows([]); setHeaders([]); setMapping({}); setResult(null); setStep('upload');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="📤 Import Devotees from Excel" size="lg">
      {step === 'upload' && (
        <div>
          <p className="text-muted mb-3" style={{fontSize:'.85rem'}}>
            Upload an .xlsx file. The first row must contain column headers. Common columns are auto-detected:
            <strong> Name, Mobile, DOB, Address, Email, Team, Status, Reference, Calling By, Profession, Rounds, Joining Date, Remarks.</strong>
          </p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          <button className="btn-primary" onClick={() => fileRef.current?.click()}>
            📁 Choose Excel File
          </button>
        </div>
      )}

      {step === 'preview' && (
        <div>
          <div className="section-header">
            <div>
              <strong>{rows.length} rows detected</strong>
              <div className="text-muted" style={{fontSize:'.78rem'}}>Verify column mapping below, then click Import.</div>
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
                <label className="form-label">{field.replace(/_/g, ' ')}</label>
                <select className="form-select sm" value={mapping[field] ?? ''} onChange={e => setMapping(m => ({ ...m, [field]: e.target.value === '' ? null : Number(e.target.value) }))}>
                  <option value="">— ignore —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{i+1}. {h || '(unnamed)'}</option>)}
                </select>
              </div>
            ))}
          </div>

          {rows.length > 0 && (
            <>
              <h4 className="form-label" style={{marginTop:16}}>Preview (first 5 rows)</h4>
              <div className="table-scroll">
                <table className="simple-table">
                  <thead><tr>
                    {['name','mobile','team_name','devotee_status'].map(f => <th key={f}>{f.replace(/_/g, ' ')}</th>)}
                  </tr></thead>
                  <tbody>
                    {rows.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        {['name','mobile','team_name','devotee_status'].map(f => (
                          <td key={f}>{mapping[f] != null ? String(r[mapping[f]] ?? '') : <span className="text-muted">—</span>}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="form-actions">
            <button className="btn-outline" onClick={reset}>← Back</button>
            <button className="btn-primary" onClick={doImport} disabled={loading || mapping.name == null}>
              {loading ? 'Importing…' : `Import ${rows.length} Devotees`}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div className="import-result">
          <div className="import-result-icon">✅</div>
          <h3>Import complete</h3>
          <div className="import-result-stats">
            <div><strong>{result.imported}</strong> imported</div>
            <div><strong>{result.updated}</strong> updated</div>
            <div><strong>{result.skipped}</strong> skipped (duplicates)</div>
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
