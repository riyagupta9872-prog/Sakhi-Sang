import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebase/config';

export default function AuthScreen() {
  const { login, signup } = useAuth();
  const { showToast } = useApp();
  const [mode, setMode] = useState('login'); // login | signup | forgot
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [attSevaLogin, setAttSevaLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ERR = {
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/email-already-in-use': 'Email already registered',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/invalid-email': 'Invalid email address',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (mode === 'forgot' && !email.trim()) {
      setError('Enter your email to receive reset link');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        // Store att-seva login intent before auth — picked up by AppContext after auth
        if (attSevaLogin) sessionStorage.setItem('attSevaOnly', '1');
        else sessionStorage.removeItem('attSevaOnly');
        await login(email, password);
      } else if (mode === 'signup') {
        if (!displayName.trim()) { setError('Please enter your name'); setLoading(false); return; }
        await signup(email, password, displayName.trim());
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        showToast('Password reset email sent!', 'success');
        setMode('login');
      }
    } catch (err) {
      setError(ERR[err.code] || err.message);
    } finally { setLoading(false); }
  }

  // Reset stale form state when switching modes
  function switchMode(next) {
    setMode(next);
    setError('');
    setShowPw(false);
    if (next !== 'signup') setDisplayName('');
  }

  return (
    <div className="auth-screen-v2">
      <div className="auth-card-v2">
        <div className="auth-logo-circle">
          <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="Sakhi Sang" className="auth-logo-img" />
        </div>
        <h1 className="auth-title-v2">SAKHI SANG</h1>
        <p className="auth-subtitle-v2">Devotee Management System</p>

        {mode !== 'forgot' && (
          <div className="auth-tabs">
            <button type="button"
              className={`auth-tab${mode === 'login' ? ' active' : ''}`}
              onClick={() => switchMode('login')}
            >Login</button>
            <button type="button"
              className={`auth-tab${mode === 'signup' ? ' active' : ''}`}
              onClick={() => switchMode('signup')}
            >Sign Up</button>
          </div>
        )}

        <form className="auth-form-v2" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label-v2">Your Name</label>
              <input className="form-input-v2" type="text" value={displayName}
                onChange={e => setDisplayName(e.target.value)} placeholder="Full name" required />
            </div>
          )}

          <div className="form-group">
            <label className="form-label-v2">Email</label>
            <input className="form-input-v2" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@example.com"
              required autoComplete="email" />
          </div>

          {mode !== 'forgot' && (
            <div className="form-group">
              <label className="form-label-v2">Password</label>
              <div className="pw-wrap-v2">
                <input className="form-input-v2" type={showPw ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                <button type="button" className="pw-toggle-v2" onClick={() => setShowPw(s => !s)}>
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="auth-forgot-row">
              <button type="button" className="auth-forgot-link" onClick={() => { setMode('forgot'); setError(''); }}>
                Forgot password?
              </button>
            </div>
          )}

          {mode === 'login' && (
            <label className="auth-att-seva">
              <input type="checkbox" checked={attSevaLogin} onChange={e => setAttSevaLogin(e.target.checked)} />
              <span>
                Login as Attendance Service Devotee
                <span className="auth-att-seva-hint"> (only Attendance tab)</span>
              </span>
            </label>
          )}

          {error && <div className="auth-error-v2">{error}</div>}

          <button className="auth-submit-btn" type="submit" disabled={loading}>
            {loading ? 'Please wait…' :
              mode === 'login' ? <>➜ Login — Hare Krishna!</> :
              mode === 'signup' ? <>➜ Request Access</> :
              <>➜ Send Reset Email</>}
          </button>

          {mode === 'forgot' && (
            <button type="button" className="auth-back-link" onClick={() => switchMode('login')}>
              ← Back to Sign In
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
