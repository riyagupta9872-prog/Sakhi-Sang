import React, { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import { DB } from '../../firebase/db';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

const GEMINI_KEY_STORAGE = 'gemini_api_key';
const GEMINI_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
];

// ── Build context for AI from current devotee/calling data ─────────────────
async function buildContext() {
  try {
    const [devotees, sessions] = await Promise.all([
      DB.getDevotees({}),
      DB.getSessions(),
    ]);

    const teamCounts = {};
    const statusCounts = {};
    let totalAT = 0;
    devotees.forEach(d => {
      const t = d.team_name || 'Unknown';
      teamCounts[t] = (teamCounts[t] || 0) + 1;
      const s = d.devotee_status || 'Unspecified';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
      totalAT += Number(d.lifetime_attendance) || 0;
    });

    return {
      totalDevotees: devotees.length,
      teamCounts,
      statusCounts,
      totalLifetimeAttendance: totalAT,
      sessionsCount: sessions.length,
      latestSession: sessions[0]?.session_date,
    };
  } catch (err) {
    console.error('buildContext:', err);
    return { error: err.message };
  }
}

// ── Call Gemini API ────────────────────────────────────────────────────────
async function askGemini(apiKey, question, context) {
  const systemPrompt = `You are an assistant for the Sakhi Sang devotee management system. Answer concisely (max 3-4 sentences) based ONLY on the data below. If the answer isn't in the data, say "I don't have that information yet."

Data summary:
${JSON.stringify(context, null, 2)}`;

  // Try models in order until one works
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [{ text: `${systemPrompt}\n\nQuestion: ${question}` }],
            }],
            generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 404) continue; // try next model
        throw new Error(err.error?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (text) return text.trim();
    } catch (err) {
      if (model === GEMINI_MODELS[GEMINI_MODELS.length - 1]) throw err;
    }
  }
  throw new Error('No Gemini model available');
}

// ── AI Floating Button (draggable) ─────────────────────────────────────────
export function AIFloatingButton({ onClick }) {
  const btnRef = useRef(null);
  const [pos, setPos] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('aiFabPos') || 'null');
      return saved || { right: 20, bottom: 100 };
    } catch { return { right: 20, bottom: 100 }; }
  });
  const dragState = useRef({ dragging: false, moved: false, startX: 0, startY: 0 });

  function onDown(e) {
    const pt = e.touches?.[0] || e;
    dragState.current = { dragging: true, moved: false, startX: pt.clientX, startY: pt.clientY };
  }
  function onMove(e) {
    if (!dragState.current.dragging) return;
    const pt = e.touches?.[0] || e;
    const dx = pt.clientX - dragState.current.startX;
    const dy = pt.clientY - dragState.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragState.current.moved = true;
      const right = Math.max(8, Math.min(window.innerWidth - 60, (pos.right || 20) - dx));
      const bottom = Math.max(8, Math.min(window.innerHeight - 60, (pos.bottom || 100) - dy));
      setPos({ right, bottom });
    }
  }
  function onUp() {
    if (dragState.current.dragging) {
      if (dragState.current.moved) {
        localStorage.setItem('aiFabPos', JSON.stringify(pos));
        dragState.current.dragging = false;
      } else {
        dragState.current.dragging = false;
        onClick?.();
      }
    }
  }

  useEffect(() => {
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove);
    document.addEventListener('touchend', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  });

  return (
    <button
      ref={btnRef}
      className="ai-fab"
      style={{ right: pos.right, bottom: pos.bottom }}
      onMouseDown={onDown}
      onTouchStart={onDown}
      title="AI Assistant"
      aria-label="Open AI assistant"
    >
      <span className="ai-fab-icon">✨</span>
    </button>
  );
}

// ── AI Chat Modal ──────────────────────────────────────────────────────────
export function AIChatModal({ open, onClose }) {
  const { showToast } = useApp();
  const { userName } = useAuth();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(GEMINI_KEY_STORAGE) || '');
  const [editingKey, setEditingKey] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'ai', text: `Hare Krishna ${userName?.split(' ')[0] || ''}! 🙏 I'm your AI assistant. Ask me anything about your devotee data — attendance trends, team performance, or specific devotees.` }]);
    }
  }, [open]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  function saveKey() {
    localStorage.setItem(GEMINI_KEY_STORAGE, apiKey.trim());
    setEditingKey(false);
    showToast('API key saved', 'success');
  }
  function clearKey() {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    setApiKey('');
    setEditingKey(true);
  }

  async function send() {
    const q = input.trim(); if (!q) return;
    if (!apiKey) { setEditingKey(true); return; }
    setInput('');
    setMessages(m => [...m, { role: 'user', text: q }]);
    setLoading(true);
    try {
      const context = await buildContext();
      const answer = await askGemini(apiKey, q, context);
      setMessages(m => [...m, { role: 'ai', text: answer }]);
    } catch (err) {
      setMessages(m => [...m, { role: 'ai', text: `⚠ ${err.message || 'Failed to get response. Check your API key.'}`, error: true }]);
    } finally { setLoading(false); }
  }

  const showKeyForm = editingKey || !apiKey;

  return (
    <Modal open={open} onClose={onClose} title="✨ AI Assistant" size="md">
      {showKeyForm ? (
        <div className="ai-key-form">
          <p className="text-muted mb-3" style={{ fontSize: '.85rem' }}>
            This AI uses Google's <strong>Gemini API</strong>. Get a free API key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: '#b8860b', fontWeight: 700 }}>aistudio.google.com/apikey</a>
            {' '}then paste it below. Key is stored only on this device.
          </p>
          <div className="form-group">
            <label className="form-label">Gemini API Key</label>
            <input
              type="password"
              className="form-input"
              placeholder="AIza..."
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && apiKey.trim() && saveKey()}
            />
          </div>
          <div className="form-actions">
            <button className="btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={saveKey} disabled={!apiKey.trim()}>Save & Start Chatting</button>
          </div>
        </div>
      ) : (
        <div className="ai-chat-wrap">
          <div className="ai-chat-messages" ref={scrollRef}>
            {messages.map((m, i) => (
              <div key={i} className={`ai-msg ai-msg-${m.role}${m.error ? ' ai-msg-error' : ''}`}>
                {m.text.split('\n').map((line, j) => <div key={j}>{line}</div>)}
              </div>
            ))}
            {loading && <div className="ai-msg ai-msg-ai ai-msg-thinking"><span className="ai-dots"><span/><span/><span/></span></div>}
          </div>

          <div className="ai-chat-input-wrap">
            <input
              className="form-input"
              placeholder="Ask something… e.g. 'how many devotees per team?'"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && send()}
              disabled={loading}
            />
            <button className="btn-primary" onClick={send} disabled={loading || !input.trim()}>↑</button>
          </div>
          <div className="ai-chat-footer">
            <button className="link-btn" onClick={() => setEditingKey(true)}>Change API key</button>
            <button className="link-btn" onClick={() => setMessages([{ role: 'ai', text: 'Conversation cleared. What would you like to know?' }])}>Clear chat</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
