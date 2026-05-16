import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DB } from '../../firebase/db';
import { useAuth } from '../../context/AuthContext';

export default function DevoteePicker({ value, onChange, placeholder = 'Search devotee…', team = '', className = '' }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (q) => {
    setLoading(true);
    const list = await DB.getDevotees({ search: q, team });
    setResults(list.slice(0, 10));
    setLoading(false);
    setOpen(true);
  }, [team]);

  function handleChange(e) {
    const v = e.target.value;
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    if (!v) { onChange?.({ name: '', id: '' }); setResults([]); setOpen(false); return; }
    timer.current = setTimeout(() => search(v), 300);
  }

  function handleFocus() {
    if (!query) search('');
  }

  function select(d) {
    setQuery(d.name);
    setOpen(false);
    onChange?.({ name: d.name, id: d.id, team: d.team_name, mobile: d.mobile });
  }

  return (
    <div className={`picker-wrap ${className}`} ref={wrapRef}>
      <input
        className="picker-input form-input"
        type="text"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && (
        <div className="picker-menu">
          {loading && <div className="picker-item picker-loading">Searching…</div>}
          {!loading && results.length === 0 && <div className="picker-item picker-empty">No devotee found</div>}
          {results.map(d => (
            <button key={d.id} className="picker-item" onMouseDown={() => select(d)}>
              <span className="picker-name">{d.name}</span>
              <span className="picker-meta">{d.team_name} · {d.mobile}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
